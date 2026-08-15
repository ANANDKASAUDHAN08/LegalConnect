import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import BareAct, { SectionModel } from '../../models/BareAct';
import LegalResource from '../../models/LegalResource';
import Lawyer from '../../models/Lawyer';
import { getCache, setCache } from '../../services/statsService';
import aiService from '../../services/AiService';
import { calculateDistance, resolveCityAndStateFromText } from '../../utils/geoUtils';
import actRegistry from '../../services/actRegistry';

const router = Router();

const transitionMap: Record<string, Record<string, string>> = {
  IPC: {
    '1': '1', '2': '1', '3': '1', '4': '1', '5': '1',
    '120A': '61', '120B': '61',
    '121': '147', '124A': '152',
    '141': '189', '143': '189', '146': '191', '147': '191',
    '300': '101', '302': '103', '304A': '106', '304B': '80', '306': '108', '307': '109',
    '319': '114', '320': '116', '323': '115', '324': '117', '325': '117',
    '354': '74', '375': '63', '376': '64', '378': '303', '379': '303',
    '390': '309', '392': '309', '415': '318', '420': '318', '498A': '85',
    '503': '351', '506': '351'
  },
  CRPC: {
    '2': '2', '125': '144', '154': '173', '161': '180', '164': '183', '167': '187', '173': '193',
    '437': '480', '438': '482', '439': '483'
  },
  IEA: {
    '3': '2', '24': '22', '25': '23', '26': '23', '27': '23', '32': '26', '45': '39', '65B': '63',
    '112': '118', '113A': '119', '113B': '120'
  }
};

// GET /search - Keyword search across all laws (section-level)
router.get('/search', asyncHandler(async (req: Request, res: Response) => {
  const query = req.query.q as string;
  if (!query) {
    throw AppError.badRequest('Query parameter "q" is required.');
  }

  const cacheKey = query.trim().toLowerCase();
  if (req.query.refresh !== 'true') {
    const cached = await getCache(`legal:search:${cacheKey}`);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }
  }

  const sections = await SectionModel.find(
    { $text: { $search: query } },
    { score: { $meta: "textScore" }, content_blocks: 0, content_blocks_hi: 0 }
  ).sort({ score: { $meta: "textScore" } }).limit(20);

  const actShortNames = [...new Set(sections.map(s => s.actShortName || ''))].filter(Boolean);

  // Use registry for O(1) batch resolution, fallback to DB
  const actMap = new Map<string, any>();
  const unresolvedCodes: string[] = [];
  for (const code of actShortNames) {
    const entry = actRegistry.resolveAct(code);
    if (entry) {
      actMap.set(code, entry);
    } else {
      unresolvedCodes.push(code);
    }
  }
  // Fallback DB query for any codes the registry doesn't know
  if (unresolvedCodes.length > 0) {
    const dbActs = await BareAct.find({ shortName: { $in: unresolvedCodes } }, 'actName shortName year description');
    for (const a of dbActs) {
      actMap.set(a.shortName, a);
    }
  }

  const data = sections.map(sec => {
    const act = actMap.get(sec.actShortName || '');

    let snippet = '';
    const text = sec.content;
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    let bestIndex = -1;

    for (const word of queryWords) {
      const idx = text.toLowerCase().indexOf(word.toLowerCase());
      if (idx !== -1) {
        bestIndex = idx;
        break;
      }
    }

    if (bestIndex !== -1) {
      const start = Math.max(0, bestIndex - 60);
      const end = Math.min(text.length, bestIndex + 100);
      snippet = (start > 0 ? '...' : '') + text.substring(start, end).trim() + (end < text.length ? '...' : '');
    } else {
      snippet = text.substring(0, 150).trim() + (text.length > 150 ? '...' : '');
    }

    if (queryWords.length > 0) {
      const wordsPattern = queryWords.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
      const highlightRegex = new RegExp(`(${wordsPattern})`, 'gi');
      snippet = snippet.replace(highlightRegex, '<mark class="bg-accent/20 text-accent dark:bg-accent/30 dark:text-accent-light px-0.5 rounded">$1</mark>');
    }

    return {
      _id: sec._id,
      section_number: sec.section_number,
      title: sec.title,
      title_hi: sec.title_hi,
      actName: act ? act.actName : sec.actShortName,
      shortName: sec.actShortName,
      year: act ? act.year : null,
      chapterNumber: sec.chapterNumber,
      snippet
    };
  });

  const finalResponse = { success: true, count: data.length, data };
  await setCache(`legal:search:${cacheKey}`, finalResponse, 3600);

  res.json(finalResponse);
}));

// GET /search-hub - Unified Omnisearch Hub
router.get('/search-hub', asyncHandler(async (req: Request, res: Response) => {
  const query = (req.query.q as string || '').trim();
  const city = (req.query.city as string || '').trim();
  const limit = parseInt(req.query.limit as string) || 3;

  if (!query) {
    throw AppError.badRequest('Query parameter "q" is required.');
  }

  const latVal = (req.query.lat && req.query.lat !== 'null' && req.query.lat !== 'undefined') ? Number(req.query.lat) : null;
  const lngVal = (req.query.lng && req.query.lng !== 'null' && req.query.lng !== 'undefined') ? Number(req.query.lng) : null;
  const latParamStr = latVal !== null ? latVal.toFixed(4) : '';
  const lngParamStr = lngVal !== null ? lngVal.toFixed(4) : '';

  const cacheKey = `legal:search-hub:${query.toLowerCase()}:${city.toLowerCase()}:${latParamStr}:${lngParamStr}:${limit}`;
  if (req.query.refresh !== 'true') {
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }
  }

  let directSection: any = null;
  let parsedActShort = '';
  let parsedSectionNum = '';

  const actSecMatch1 = query.match(/^([A-Za-z0-9() -]+)\s+Sec(?:tion)?\s+(\d+[A-Za-z0-9]*)$/i);
  if (actSecMatch1) {
    parsedActShort = actSecMatch1[1].trim();
    parsedSectionNum = actSecMatch1[2].trim();
  } else {
    const actSecMatch2 = query.match(/^Sec(?:tion)?\s+(\d+[A-Za-z0-9]*)(?:\s+of)?\s+([A-Za-z0-9() -]+)$/i);
    if (actSecMatch2) {
      parsedSectionNum = actSecMatch2[1].trim();
      parsedActShort = actSecMatch2[2].trim();
    }
  }

  if (parsedActShort && parsedSectionNum) {
    const matchedAct = await BareAct.findOne({
      $or: [
        { shortName: { $regex: new RegExp(`^${parsedActShort.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } },
        { actName: { $regex: new RegExp(`^${parsedActShort.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') } }
      ]
    });

    if (matchedAct) {
      directSection = await SectionModel.findOne({
        actShortName: matchedAct.shortName,
        section_number: { $regex: new RegExp(`^${parsedSectionNum}$`, 'i') }
      });
    }
  }

  const lawyerFilter: any = { isVerified: true };
  const queryWords = query.split(/\s+/).filter(w => w.length > 2);
  const expertMatch = query.match(/^expert:([A-Za-z0-9() -]+)$/i);

  if (expertMatch) {
    const actForExpert = expertMatch[1].trim().toUpperCase();
    let mappedSpecialization = 'Civil Law';
    if (['IPC', 'BNS', 'CRPC', 'BNSS', 'BSA', 'IEA'].includes(actForExpert)) {
      mappedSpecialization = 'Criminal Law';
    } else if (['WOD', 'RENT CONTROL ACT', 'RENT ACT', 'TRANSFER OF PROPERTY'].includes(actForExpert)) {
      mappedSpecialization = 'Property Disputes';
    } else if (['NI ACT', 'CONTRACT ACT'].includes(actForExpert)) {
      mappedSpecialization = 'Contract Law';
    } else if (['DVA', 'DOMESTIC VIOLENCE'].includes(actForExpert)) {
      mappedSpecialization = 'Family Law';
    }
    lawyerFilter.specializations = { $regex: new RegExp(mappedSpecialization, 'i') };
  } else {
    if (queryWords.length > 0) {
      const regexPatterns = queryWords.map((w: string) => new RegExp(w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
      lawyerFilter.$or = [
        { name: { $in: regexPatterns } },
        { specializations: { $in: regexPatterns } },
        { bio: { $in: regexPatterns } }
      ];
    } else {
      lawyerFilter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { specializations: { $regex: query, $options: 'i' } },
        { bio: { $regex: query, $options: 'i' } }
      ];
    }
  }

  let resolvedCity = city;
  const nearbyCities = new Set<string>();
  let coordsResolved = false;

  if (city) {
    if (latVal !== null && lngVal !== null && !isNaN(latVal) && !isNaN(lngVal)) {
      const delta = 0.8;
      const nearbyResources = await LegalResource.find({
        'coordinates.lat': { $gte: latVal - delta, $lte: latVal + delta },
        'coordinates.lng': { $gte: lngVal - delta, $lte: lngVal + delta }
      }).lean();

      if (nearbyResources.length > 0) {
        let minDistance = Infinity;
        let closestResource: any = null;
        for (const res of nearbyResources) {
          if (res.coordinates && typeof res.coordinates.lat === 'number' && typeof res.coordinates.lng === 'number') {
            const dist = calculateDistance(latVal, lngVal, res.coordinates.lat, res.coordinates.lng);
            if (res.city) nearbyCities.add(res.city);
            if (dist < minDistance) {
              minDistance = dist;
              closestResource = res;
            }
          }
        }
        if (closestResource) {
          resolvedCity = closestResource.city;
          coordsResolved = true;
        }
      }
    }

    if (!coordsResolved) {
      const textRes = await resolveCityAndStateFromText(city);
      resolvedCity = textRes.city;
      if (textRes.lat && textRes.lng) {
        const delta = 0.8;
        const nearbyResources = await LegalResource.find({
          'coordinates.lat': { $gte: textRes.lat - delta, $lte: textRes.lat + delta },
          'coordinates.lng': { $gte: textRes.lng - delta, $lte: textRes.lng + delta }
        }).lean();
        for (const res of nearbyResources) {
          if (res.city) nearbyCities.add(res.city);
        }
      }
    }
  }

  let cityPattern = `^${resolvedCity}$`;
  if (resolvedCity) {
    const cleanedCity = resolvedCity.toLowerCase().trim();
    if (cleanedCity === 'delhi' || cleanedCity === 'new delhi') {
      cityPattern = '^(delhi|new delhi)$';
    } else if (cleanedCity === 'bengaluru' || cleanedCity === 'bangalore') {
      cityPattern = '^(bengaluru|bangalore)$';
    } else if (cleanedCity === 'gurgaon' || cleanedCity === 'gurugram') {
      cityPattern = '^(gurgaon|gurugram)$';
    }
  }

  if (nearbyCities.size > 1) {
    const escaped = Array.from(nearbyCities).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    cityPattern = `^(${escaped.join('|')})$`;
  }

  if (city) {
    lawyerFilter.city = { $regex: new RegExp(cityPattern, 'i') };
  }

  const resourceFilter: any = { status: 'approved' };
  if (queryWords.length > 0) {
    const regexPatterns = queryWords.map(w => new RegExp(w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i'));
    resourceFilter.$or = [
      { name: { $in: regexPatterns } },
      { address: { $in: regexPatterns } },
      { categories: { $in: regexPatterns } },
      { subcategories: { $in: regexPatterns } },
      { tags: { $in: regexPatterns } }
    ];
  } else {
    resourceFilter.$or = [
      { name: { $regex: query, $options: 'i' } },
      { address: { $regex: query, $options: 'i' } },
      { categories: { $regex: query, $options: 'i' } },
      { subcategories: { $regex: query, $options: 'i' } },
      { tags: { $regex: query, $options: 'i' } }
    ];
  }

  if (city) {
    resourceFilter.city = { $regex: new RegExp(cityPattern, 'i') };
  }

  let sectionQuery;
  if (directSection) {
    sectionQuery = SectionModel.find(
      {
        $text: { $search: query.replace(/sec(?:tion)?\s+\d+/i, '').trim() || query },
        _id: { $ne: directSection._id }
      },
      { score: { $meta: "textScore" }, content_blocks: 0, content_blocks_hi: 0 }
    ).sort({ score: { $meta: "textScore" } }).limit(limit - 1);
  } else {
    sectionQuery = SectionModel.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" }, content_blocks: 0, content_blocks_hi: 0 }
    ).sort({ score: { $meta: "textScore" } }).limit(limit);
  }

  const [sectionsList, lawyers, resources] = await Promise.all([
    sectionQuery,
    Lawyer.find(lawyerFilter).sort({ rating: -1 }).limit(limit).lean(),
    LegalResource.find(resourceFilter).limit(limit).lean()
  ]);

  const sections = directSection ? [directSection].concat(sectionsList) : sectionsList;

  const actShortNames = [...new Set(sections.map(s => s.actShortName || ''))].filter(Boolean);
  const acts = actShortNames.length > 0
    ? await BareAct.find({ shortName: { $in: actShortNames } }, 'actName shortName year description')
    : [];
  const actMap = new Map(acts.map(a => [a.shortName, a]));

  const mappedSections = sections.map(sec => {
    const act = actMap.get(sec.actShortName || '');
    let snippet = '';
    const text = sec.content || '';
    const textHi = sec.content_hi || '';

    const isHindiQuery = /[\u0900-\u097F]/.test(query);
    const targetText = (isHindiQuery && textHi) ? textHi : text;

    const searchWords = query.split(/\s+/).filter(w => w.length > 1);
    let bestIndex = -1;
    for (const word of searchWords) {
      const idx = targetText.toLowerCase().indexOf(word.toLowerCase());
      if (idx !== -1) {
        bestIndex = idx;
        break;
      }
    }

    if (bestIndex !== -1) {
      const start = Math.max(0, bestIndex - 60);
      const end = Math.min(targetText.length, bestIndex + 100);
      snippet = (start > 0 ? '...' : '') + targetText.substring(start, end).trim() + (end < targetText.length ? '...' : '');
    } else {
      snippet = targetText.substring(0, 150).trim() + (targetText.length > 150 ? '...' : '');
    }

    if (searchWords.length > 0) {
      const wordsPattern = searchWords.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
      const highlightRegex = new RegExp(`(${wordsPattern})`, 'gi');
      snippet = snippet.replace(highlightRegex, '<mark class="bg-accent/20 text-accent dark:bg-accent/30 dark:text-accent-light px-0.5 rounded">$1</mark>');
    }

    const secNum = parseInt(sec.section_number) || 0;
    let isBailable = true;
    let isCognizable = false;
    let compoundable = 'Non-Compoundable';
    let punishment = 'Fine or minor imprisonment';
    let severity = 'low';

    if (sec.actShortName === 'IPC' || sec.actShortName === 'BNS') {
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

    return {
      _id: sec._id,
      section_number: sec.section_number,
      title: sec.title,
      title_hi: sec.title_hi || sec.title,
      content: sec.content,
      content_hi: sec.content_hi || sec.content,
      actName: act ? act.actName : sec.actShortName,
      shortName: sec.actShortName,
      year: act ? act.year : null,
      chapterNumber: sec.chapterNumber,
      snippet,
      criminalDetails: {
        isBailable,
        isCognizable,
        compoundable,
        punishment,
        severity
      }
    };
  });

  const finalResponse = {
    success: true,
    data: {
      laws: mappedSections,
      lawyers,
      resources
    }
  };

  await setCache(cacheKey, finalResponse, 300);
  res.json(finalResponse);
}));

// GET /mapping/suggestions - Typeahead suggestions for mapper search
router.get('/mapping/suggestions', asyncHandler(async (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim();
  if (!q || q.length < 1) {
    return res.json({ success: true, data: [] });
  }

  const cacheKey = `legal:mapping:suggestions:${q.toLowerCase()}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached, fromCache: true });
  }

  const acts = await BareAct.find({}, 'shortName').lean();
  const supportedActs = acts.length > 0 ? acts.map(a => a.shortName) : ['IPC', 'CrPC', 'IEA', 'BNS', 'BNSS', 'BSA'];
  const isNumeric = /^\d/.test(q);

  let filter: any;
  if (isNumeric) {
    filter = {
      actShortName: { $in: supportedActs },
      section_number: { $regex: `^${q}`, $options: 'i' }
    };
  } else {
    filter = {
      actShortName: { $in: supportedActs },
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { section_number: { $regex: `^${q}`, $options: 'i' } }
      ]
    };
  }

  const sections = await SectionModel.find(filter, 'actShortName section_number title').limit(12).lean();

  const data = sections.map(s => ({
    act: s.actShortName,
    section: s.section_number,
    title: s.title
  }));

  await setCache(cacheKey, data, 3600);
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ success: true, data });
}));

// GET /mapping - Transition mapping old to new laws (IPC/CrPC/IEA ↔ BNS/BNSS/BSA)
router.get('/mapping', asyncHandler(async (req: Request, res: Response) => {
  const { act, section } = req.query;
  if (!act || !section) {
    throw AppError.badRequest('Parameters "act" and "section" are required.');
  }

  const actStr = (act as string).toUpperCase();
  const sectionStr = (section as string).trim();

  const mapCacheKey = `legal:mapping:${actStr}:${sectionStr}`;
  const cachedResult = await getCache(mapCacheKey);
  if (cachedResult) {
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    return res.json({ ...cachedResult, fromCache: true });
  }

  let oldActShortName = '';
  let newActShortName = '';
  let mappedSectionNumber = '';
  let isNewToOld = false;

  if (['IPC', 'CRPC', 'IEA'].includes(actStr)) {
    oldActShortName = actStr === 'CRPC' ? 'CrPC' : actStr;
    newActShortName = actStr === 'IPC' ? 'BNS' : (actStr === 'CRPC' ? 'BNSS' : 'BSA');
    const actMap = transitionMap[oldActShortName.toUpperCase()] || {};
    mappedSectionNumber = actMap[sectionStr] || sectionStr;
  } else if (['BNS', 'BNSS', 'BSA'].includes(actStr)) {
    newActShortName = actStr;
    oldActShortName = actStr === 'BNS' ? 'IPC' : (actStr === 'BNSS' ? 'CrPC' : 'IEA');
    isNewToOld = true;
    const actMap = transitionMap[oldActShortName.toUpperCase()] || {};
    const foundKey = Object.keys(actMap).find(key => actMap[key] === sectionStr);
    mappedSectionNumber = foundKey || sectionStr;
  } else {
    throw AppError.badRequest('Mapping is only supported for IPC, CrPC, IEA, BNS, BNSS, and BSA.');
  }

  const [oldActObj, newActObj] = await Promise.all([
    BareAct.findOne({ shortName: oldActShortName }, 'actName shortName chapters.chapterNumber chapters.title'),
    BareAct.findOne({ shortName: newActShortName }, 'actName shortName chapters.chapterNumber chapters.title')
  ]);

  if (!oldActObj || !newActObj) {
    throw AppError.internal('Acts not found in database. Please ensure seeding is complete.');
  }

  const oldSectionNum = isNewToOld ? mappedSectionNumber : sectionStr;
  const newSectionNum = isNewToOld ? sectionStr : mappedSectionNumber;

  const [oldSection, newSection] = await Promise.all([
    SectionModel.findOne({ actShortName: oldActShortName, section_number: oldSectionNum }),
    SectionModel.findOne({ actShortName: newActShortName, section_number: newSectionNum })
  ]);

  let oldSectionObj = null;
  if (oldSection) {
    const chap = oldActObj.chapters.find(c => c.chapterNumber === oldSection.chapterNumber);
    oldSectionObj = {
      section_number: oldSection.section_number,
      title: oldSection.title,
      content: oldSection.content,
      chapter: chap ? chap.title : `Chapter ${oldSection.chapterNumber}`
    };
  }

  let newSectionObj = null;
  if (newSection) {
    const chap = newActObj.chapters.find(c => c.chapterNumber === newSection.chapterNumber);
    newSectionObj = {
      section_number: newSection.section_number,
      title: newSection.title,
      content: newSection.content,
      content_hi: newSection.content_hi,
      chapter: chap ? chap.title : `Chapter ${newSection.chapterNumber}`
    };
  }

  if (!newSectionObj) {
    const noMapResult = {
      success: true,
      oldAct: { shortName: oldActObj.shortName, actName: oldActObj.actName },
      oldSection: oldSectionObj,
      newAct: { shortName: newActObj.shortName, actName: newActObj.actName },
      newSection: null,
      comparison: 'No direct mapping could be automatically resolved for this section. The sections might have been merged, repealed, or re-organized under a different scheme in the new Act.'
    };
    await setCache(mapCacheKey, noMapResult, 3600);
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    return res.json(noMapResult);
  }

  const oldTitle = oldSectionObj ? oldSectionObj.title : 'Unknown';
  const oldContent = oldSectionObj ? oldSectionObj.content : 'No text available';
  const comparison = await aiService.explainTransition(
    oldActObj.actName,
    oldSectionNum,
    oldTitle,
    oldContent,
    newActObj.actName,
    newSectionNum,
    newSectionObj.title,
    newSectionObj.content
  );

  const finalResult = {
    success: true,
    oldAct: { shortName: oldActObj.shortName, actName: oldActObj.actName },
    oldSection: oldSectionObj,
    newAct: { shortName: newActObj.shortName, actName: newActObj.actName },
    newSection: newSectionObj,
    comparison
  };

  await setCache(mapCacheKey, finalResult, 3600);
  res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
  res.json(finalResult);
}));

// GET /jargon - AI Jargon Buster
router.get('/jargon', asyncHandler(async (req: Request, res: Response) => {
  const term = req.query.term as string;
  if (!term || term.trim().length < 2) {
    throw AppError.badRequest('Query parameter "term" is required and must be at least 2 characters.');
  }

  const cacheKey = `legal:jargon:${term.trim().toLowerCase()}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    return res.json({ success: true, term: term.trim(), definition: cached, fromCache: true });
  }

  const prompt = `You are a professional legal glossary explainer. Explain the following legal jargon or term in simple plain English so a non-lawyer can understand.
Keep the definition concise (1-2 sentences maximum).

Term: "${term.trim()}"

Definition:`;

  const definition = await aiService.generateRawContent(prompt);
  await setCache(cacheKey, definition, 86400 * 7);

  res.json({
    success: true,
    term: term.trim(),
    definition,
    fromCache: false
  });
}));

export default router;
