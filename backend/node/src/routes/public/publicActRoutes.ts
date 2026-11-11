import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import BareAct, { SectionModel } from '../../models/BareAct';
import { getCache, setCache } from '../../services/statsService';
import { normalizeActShortName } from '../../utils/geoUtils';
import { normalizeActInfo } from '../../utils/actNormalizer';
import actRegistry from '../../services/actRegistry';
import StatutoryRightModel from '../../models/StatutoryRight';
import JudicialDecisionModel from '../../models/JudicialDecision';
import IngestionLogModel from '../../models/IngestionLog';

const router = Router();

/**
 * Ensures a value from MongoDB is always returned as a plain string.
 * Prevents [object Object] rendering bugs when nested documents
 * leak through as raw objects instead of strings.
 */
function safeString(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') {
    // Strip literal [object Object] artifacts baked into database strings
    return val.replace(/\[object\s+Object\]/gi, '').replace(/;\s*$/, '').trim();
  }
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    return val.map(item => {
      if (typeof item === 'string') return item.replace(/\[object\s+Object\]/gi, '');
      if (item && typeof item === 'object' && item.text) return item.text;
      return '';
    }).filter(Boolean).join('\n');
  }
  if (typeof val === 'object' && val.text) return String(val.text);
  try { return JSON.stringify(val); } catch { return ''; }
}

// GET /acts - Get all acts (name, shortName, year, description, chapters)
router.get('/acts', asyncHandler(async (req: Request, res: Response) => {
  if (req.query.refresh !== 'true') {
    const cached = await getCache('legal:acts');
    if (cached) {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
      return res.json({ success: true, count: cached.length, data: cached, fromCache: true });
    }
  }

  // Use in-memory registry if available (O(1), zero DB queries)
  if (actRegistry.initialized) {
    const directory = actRegistry.getActDirectory();
    await setCache('legal:acts', directory);
    if (req.query.refresh === 'true') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    } else {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    }
    return res.json({ success: true, count: directory.length, data: directory });
  }

  // Fallback to DB query if registry not yet initialized
  const acts = await BareAct.find({}, 'actName shortName year description category act_code legacy_short_names hierarchical_id updatedAt').lean();
  const normalizedActs = acts.map((act: any) => {
    const rawTitle = act.actName || act.name || act.title;
    const norm = normalizeActInfo(rawTitle, act.shortName, act.year);
    return {
      ...act,
      actName: norm.actName,
      name: norm.actName,
      shortName: norm.shortName,
      legacy_short_names: act.legacy_short_names || [],
      act_code: act.act_code || norm.shortName,
      category: act.category || null,
      hierarchical_id: act.hierarchical_id || null,
      updatedAt: (act as any).updatedAt || null
    };
  });

  await setCache('legal:acts', normalizedActs);
  if (req.query.refresh === 'true') {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  } else {
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
  }
  res.json({ success: true, count: normalizedActs.length, data: normalizedActs });
}));

// GET /acts/:shortName - Get detailed act structure with sections
router.get('/acts/:shortName', asyncHandler(async (req: Request, res: Response) => {
  const shortName = req.params.shortName as string;

  // Resolve via O(1) registry (handles ASIR, ATM, AOSAIR2, AT(, etc.)
  const registryEntry = actRegistry.resolveAct(shortName);
  const resolvedShortName = registryEntry ? registryEntry.shortName : normalizeActShortName(shortName);

  if (req.query.refresh !== 'true') {
    const cached = await getCache(`legal:act:${resolvedShortName}`);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
      return res.json({ success: true, data: cached, fromCache: true });
    }
  }

  // Use registry _id for indexed lookup, fallback to shortName query
  let act;
  if (registryEntry) {
    act = await BareAct.findById(registryEntry._id);
  }
  if (!act) {
    // Fallback: try both the resolved and raw shortName
    act = await BareAct.findOne({ shortName: resolvedShortName });
  }
  if (!act) {
    act = await BareAct.findOne({ shortName: new RegExp(`^${normalizeActShortName(shortName)}$`, 'i') });
  }
  if (!act) {
    throw AppError.notFound('Act not found.');
  }

  const actObj: any = act.toObject ? act.toObject() : { ...act };
  const rawTitle = actObj.actName || actObj.name || actObj.title;
  const norm = normalizeActInfo(rawTitle, actObj.shortName, actObj.year);
  actObj.actName = norm.actName;
  actObj.name = norm.actName;
  actObj.shortName = norm.shortName;

  // Join full section documents — use resolved shortName for section lookup
  const dbShortName = act.shortName;
  const fullSections = await SectionModel.find({ actShortName: dbShortName }).lean();
  if (fullSections && fullSections.length > 0) {
    const sectionMap = new Map(fullSections.map(s => [s.section_number, s]));
    if (actObj.chapters && Array.isArray(actObj.chapters)) {
      actObj.chapters.forEach((chap: any) => {
        if (chap.sections && Array.isArray(chap.sections)) {
          const seenSecNums = new Set<string>();
          const cleanSecs: any[] = [];

          chap.sections.forEach((sec: any) => {
            const secNum = String(sec.section_number || sec.sectionNumber || '').trim();
            if (!secNum || seenSecNums.has(secNum)) return;
            seenSecNums.add(secNum);

            const fullSec = sectionMap.get(secNum);
            let processedSec = { ...sec };

            if (fullSec) {
              let blocks = (fullSec.content_blocks || []).map((b: any) => ({
                ...b,
                text: safeString(b.text)
              })).filter((b: any) => {
                const txt = (b.text || '').trim();
                return !/^(February|January|March|April|May|June|July|August|September|October|November|December),\s*\d{4},?\s*see/i.test(txt) &&
                  !/^Gazette of India/i.test(txt) && txt.length > 0;
              });

              blocks.sort((a: any, b: any) => {
                const matchA = (a.text || '').match(/^\((\d+)\)/);
                const matchB = (b.text || '').match(/^\((\d+)\)/);
                if (matchA && matchB) {
                  return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
                }
                if (matchA) return -1;
                if (matchB) return 1;
                return 0;
              });

              processedSec = {
                ...sec,
                _id: fullSec._id,
                content: safeString(fullSec.content),
                content_hi: safeString(fullSec.content_hi),
                content_blocks: blocks,
                content_blocks_hi: (fullSec.content_blocks_hi || []).map((b: any) => ({ ...b, text: safeString(b.text) })),
                introduction_text: safeString(fullSec.content || fullSec.introduction_text || sec.introduction_text),
                introduction_text_hi: safeString(fullSec.content_hi || fullSec.introduction_text_hi || sec.introduction_text_hi)
              };
            }

            cleanSecs.push(processedSec);
          });

          chap.sections = cleanSecs;
        }
      });
    }
  }

  await setCache(`legal:act:${resolvedShortName}`, actObj);
  if (req.query.refresh === 'true') {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  } else {
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
  }
  res.json({ success: true, data: actObj });
}));

// GET /acts/:shortName/outline - Get outline of act (structural metadata, excluding heavy content fields)
router.get('/acts/:shortName/outline', asyncHandler(async (req: Request, res: Response) => {
  const shortName = req.params.shortName as string;
  const registryEntry = actRegistry.resolveAct(shortName);
  const resolvedShortName = registryEntry ? registryEntry.shortName : normalizeActShortName(shortName);
  const cacheKey = `legal:act:outline:${resolvedShortName}`;

  if (req.query.refresh !== 'true') {
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
      return res.json({ success: true, data: cached, fromCache: true });
    }
  }

  let act;
  if (registryEntry) {
    act = await BareAct.findById(registryEntry._id, {
      actName: 1, shortName: 1, year: 1, description: 1,
      'chapters.chapterNumber': 1, 'chapters.title': 1,
      'chapters.sections.section_number': 1, 'chapters.sections.title': 1,
      'chapters.sections.title_hi': 1, 'chapters.sections.clean_title': 1,
      'chapters.sections.clean_title_hi': 1
    });
  }
  if (!act) {
    act = await BareAct.findOne(
      { shortName: resolvedShortName },
      {
        actName: 1, shortName: 1, year: 1, description: 1,
        'chapters.chapterNumber': 1, 'chapters.title': 1,
        'chapters.sections.section_number': 1, 'chapters.sections.title': 1,
        'chapters.sections.title_hi': 1, 'chapters.sections.clean_title': 1,
        'chapters.sections.clean_title_hi': 1
      }
    );
  }

  if (!act) {
    throw AppError.notFound('Act not found.');
  }

  const actObj = act.toObject ? act.toObject() : { ...act };
  actObj.shortName = shortName;

  await setCache(cacheKey, actObj);
  if (req.query.refresh === 'true') {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  } else {
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
  }
  res.json({ success: true, data: actObj });
}));

// GET /acts/:shortName/sections/:sectionNumber - Get a specific section
router.get('/acts/:shortName/sections/:sectionNumber', asyncHandler(async (req: Request, res: Response) => {
  const shortName = req.params.shortName as string;
  const sectionNumber = req.params.sectionNumber as string;
  const registryEntry = actRegistry.resolveAct(shortName);
  const resolvedShortName = registryEntry ? registryEntry.shortName : normalizeActShortName(shortName);
  const dbShortName = registryEntry?.dbShortName || resolvedShortName;

  const candidateShortNames = Array.from(new Set([
    dbShortName,
    resolvedShortName,
    shortName,
    shortName.toUpperCase(),
    shortName.charAt(0).toUpperCase() + shortName.slice(1).toLowerCase(),
    'Constitution'
  ].filter(Boolean)));

  const cleanSec = sectionNumber.replace(/^(?:section|sec|article|art|rule|order|clause)\.?\s*/i, '').trim();
  const candidateSecNumbers = Array.from(new Set([
    sectionNumber,
    cleanSec,
    sectionNumber.includes('_') ? sectionNumber.split('_')[0] : null,
    cleanSec.includes('_') ? cleanSec.split('_')[0] : null
  ].filter(Boolean) as string[]));

  let section = await SectionModel.findOne({
    actShortName: { $in: candidateShortNames },
    section_number: { $in: candidateSecNumbers }
  });

  if (!section) {
    section = await SectionModel.findOne({
      actShortName: { $regex: new RegExp(`^${resolvedShortName}$`, 'i') },
      section_number: { $in: candidateSecNumbers }
    });
  }

  if (!section) {
    throw AppError.notFound('Section not found.');
  }

  const act = await BareAct.findOne({ shortName: { $in: candidateShortNames } }, 'actName year');

  const secNum = parseInt(section.section_number) || 0;
  let isBailable = true;
  let isCognizable = false;
  let compoundable = 'Non-Compoundable';
  let punishment = 'Fine or minor imprisonment';
  let severity = 'low';

  if (resolvedShortName === 'IPC' || resolvedShortName === 'BNS') {
    if (secNum === 302 || secNum === 101 || secNum === 307 || secNum === 109 || secNum === 376 || secNum === 64) {
      isBailable = false;
      isCognizable = true;
      punishment = 'Death or Life Imprisonment';
      severity = 'high';
    } else if (secNum === 379 || secNum === 303 || secNum === 420 || secNum === 318 || secNum === 324 || secNum === 117) {
      isBailable = false;
      isCognizable = true;
      punishment = 'Up to 3 to 7 Years Imprisonment';
      severity = 'medium';
      if (secNum === 420 || secNum === 318) {
        compoundable = 'Compoundable with court permission';
      }
    } else if (secNum === 323 || secNum === 115 || secNum === 504 || secNum === 352) {
      isBailable = true;
      isCognizable = false;
      compoundable = 'Compoundable';
      punishment = 'Up to 1 Year or Fine';
      severity = 'low';
    }
  }

  const complexityRating = severity === 'high' ? 'High' : (severity === 'medium' ? 'Medium' : 'Low');

  const foundSection = {
    chapter: section.chapterNumber,
    section_number: section.section_number,
    title: section.title,
    title_hi: section.title_hi,
    content: section.content,
    content_hi: section.content_hi,
    aiSummary: section.aiSummary,
    clean_title: section.clean_title,
    clean_title_hi: section.clean_title_hi,
    introduction_text: section.introduction_text,
    introduction_text_hi: section.introduction_text_hi,
    content_blocks: section.content_blocks,
    content_blocks_hi: section.content_blocks_hi,
    actName: act ? act.actName : req.params.shortName,
    year: act ? act.year : null,
    complexityRating,
    criminalDetails: {
      isBailable,
      isCognizable,
      compoundable,
      punishment,
      severity
    }
  };

  res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
  res.json({ success: true, data: foundSection });
}));

// GET /acts/:shortName/sections/:sectionNumber/wiki-context - Interlinked Legal Knowledge Graph for LegalPedia
router.get('/acts/:shortName/sections/:sectionNumber/wiki-context', asyncHandler(async (req: Request, res: Response) => {
  const shortName = req.params.shortName as string;
  const sectionNumber = req.params.sectionNumber as string;
  const registryEntry = actRegistry.resolveAct(shortName);
  const resolvedShortName = registryEntry ? registryEntry.shortName : normalizeActShortName(shortName);
  const dbShortName = registryEntry?.dbShortName || resolvedShortName;

  const candidateShortNames = Array.from(new Set([
    dbShortName,
    resolvedShortName,
    shortName,
    shortName.toUpperCase(),
    shortName.charAt(0).toUpperCase() + shortName.slice(1).toLowerCase(),
    'Constitution'
  ].filter(Boolean)));

  const cleanSec = sectionNumber.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const secRegex = new RegExp(`^(?:Section\\s+)?${cleanSec}$`, 'i');
  const secWordRegex = new RegExp(`\\b${cleanSec}\\b`, 'i');
  const actRegex = new RegExp(`^${resolvedShortName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i');

  const [section, act] = await Promise.all([
    SectionModel.findOne({
      actShortName: { $in: candidateShortNames },
      section_number: sectionNumber
    }).lean(),
    BareAct.findOne({ shortName: { $in: candidateShortNames } }, 'actName year category').lean()
  ]);

  if (!section) {
    throw AppError.notFound(`Section ${sectionNumber} of Act ${resolvedShortName} not found.`);
  }

  const actNameEsc = (act?.actName || '').replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const actSearchRegex = new RegExp(`(?:${resolvedShortName}${actNameEsc ? '|' + actNameEsc : ''})`, 'i');

  const [relatedRights, landmarkDecisions] = await Promise.all([
    StatutoryRightModel.find({
      isPublished: true,
      $or: [
        { 'statutoryBasis.shortAct': actRegex, 'statutoryBasis.sections': secWordRegex },
        { 'statutoryBasis.sections': sectionNumber },
        { tags: resolvedShortName.toLowerCase() }
      ]
    }).lean(),
    JudicialDecisionModel.find({
      $or: [
        { connectedSections: secWordRegex, connectedActs: actSearchRegex },
        { connectedSections: secWordRegex }
      ]
    }).limit(6).lean()
  ]);

  // Extract legal jargon keywords from section text
  const JARGON_TERMS: Record<string, string> = {
    'cognizable': 'An offence for which a police officer may arrest without a court warrant under BNSS / CrPC.',
    'non-cognizable': 'An offence where police cannot arrest without a court warrant and cannot investigate without magistrate order.',
    'bailable': 'Offence where bail is a statutory right as a matter of law, not at court discretion.',
    'non-bailable': 'Offence where grant of bail is at judicial discretion of the Court or Magistrate.',
    'compoundable': 'Offences that can be amicably compromised or settled between the victim and accused.',
    'injunction': 'A judicial order restraining a party from beginning or continuing an action threatening legal rights.',
    'adjudicating officer': 'A designated judicial or statutory authority empowered to assess damages or penalties.',
    'plaint': 'A formal written document presented by a plaintiff initiating a civil court proceeding.',
    'affidavit': 'A written sworn statement confirmed by oath or affirmation for use as court evidence.',
    'ultra vires': 'An act performed beyond legal authority or exceeding the scope of constitutional/statutory power.',
    'locus standi': 'The right or capacity of a party to bring an action or to appear in a court.',
    'habeas corpus': 'Prerogative writ under Article 32 or 226 commanding the production of a detained individual to test legality of arrest.'
  };

  const detectedJargon: Array<{ term: string; definition: string }> = [];
  const contentLower = ((section.content || '') + ' ' + (section.title || '')).toLowerCase();
  for (const [term, definition] of Object.entries(JARGON_TERMS)) {
    if (new RegExp(`\\b${term}\\b`, 'i').test(contentLower)) {
      detectedJargon.push({ term: term.toUpperCase(), definition });
    }
  }

  res.json({
    success: true,
    data: {
      act: {
        shortName: resolvedShortName,
        actName: act ? act.actName : resolvedShortName,
        year: act ? act.year : null,
        category: act ? act.category : 'General'
      },
      section: {
        section_number: section.section_number,
        title: section.title,
        title_hi: section.title_hi,
        content: section.content,
        content_hi: section.content_hi,
        aiSummary: section.aiSummary,
        clean_title: section.clean_title,
        chapter: section.chapterNumber
      },
      wikiContext: {
        citizenRights: relatedRights.map(r => ({
          id: r.id,
          title: r.title,
          title_hi: r.title_hi,
          summary: r.summary,
          keyProtections: r.keyProtections,
          whatToSay: r.whatToSay,
          dos: r.dos,
          donts: r.donts,
          legalRemedy: r.legalRemedy
        })),
        landmarkPrecedents: landmarkDecisions.map(d => ({
          title: d.title,
          citation: d.citation,
          court: d.court,
          decisionDate: d.decisionDate,
          holding: d.holding,
          ratioDecidendi: d.ratioDecidendi
        })),
        noticeTemplates: [],
        detectedJargon
      }
    }
  });
}));

// POST /acts/:shortName/sections/:sectionNumber/contribute - Crowdsourced / Lawyer Contribution Pipeline (Wikipedia Model)
router.post('/acts/:shortName/sections/:sectionNumber/contribute', asyncHandler(async (req: Request, res: Response) => {
  const shortName = req.params.shortName as string;
  const sectionNumber = req.params.sectionNumber as string;
  const { contributorName, contributorRole, barCouncilNumber, contributionType, summaryText, citations, notes } = req.body;

  if (!summaryText && !citations) {
    throw AppError.badRequest('Either summaryText or citations must be provided.');
  }

  // Create audit ingestion log tracking this community/advocate revision
  const auditLog = await IngestionLogModel.create({
    sourceAuthority: contributorRole === 'advocate' && barCouncilNumber ? `Advocate (${barCouncilNumber})` : 'LegalPedia Community Contributor',
    sourceUrl: `/laws/${shortName}/sections/${sectionNumber}`,
    actCode: `${shortName}:${sectionNumber}`,
    status: 'PARTIAL', // Pending editorial moderation
    recordsProcessed: 1,
    recordsImported: 0,
    recordsSkipped: 0,
    license: 'Creative Commons Attribution-ShareAlike (CC BY-SA)',
    notes: `Community revision submitted by ${contributorName || 'Anonymous'} (${contributionType || 'explanation'}). Notes: ${notes || 'None'}. Citations: ${citations || 'None'}. Text: ${summaryText || ''}`.substring(0, 500),
    retrievedAt: new Date()
  });

  res.status(201).json({
    success: true,
    message: 'Contribution successfully recorded! It will be reviewed by verified legal editors before being merged into the official LegalPedia entry.',
    contributionId: auditLog._id
  });
}));

// GET /acts/:shortName/sections/:sectionNumber/contributions - Retrieve verified community & lawyer annotations
router.get('/acts/:shortName/sections/:sectionNumber/contributions', asyncHandler(async (req: Request, res: Response) => {
  const shortName = req.params.shortName as string;
  const sectionNumber = req.params.sectionNumber as string;
  const registryEntry = actRegistry.resolveAct(shortName);
  const resolvedShortName = registryEntry ? registryEntry.shortName : normalizeActShortName(shortName);
  const dbShortName = registryEntry?.dbShortName || resolvedShortName;

  const actCode = `${resolvedShortName}:${sectionNumber}`;
  const actCodes = Array.from(new Set([
    actCode,
    `${dbShortName}:${sectionNumber}`,
    `${shortName}:${sectionNumber}`
  ]));
  const verifiedContributions = await IngestionLogModel.find({
    actCode: { $in: actCodes },
    status: 'SUCCESS'
  })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  res.json({
    success: true,
    data: {
      actCode,
      total: verifiedContributions.length,
      contributions: verifiedContributions.map(c => ({
        id: c._id,
        author: c.sourceAuthority,
        license: c.license,
        date: c.createdAt,
        content: c.notes
      }))
    }
  });
}));

export default router;