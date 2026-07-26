import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import BareAct, { SectionModel } from '../../models/BareAct';
import { getCache, setCache } from '../../services/statsService';
import { normalizeActShortName } from '../../utils/geoUtils';

const router = Router();

// GET /acts - Get all acts (name, shortName, year, description, chapters)
router.get('/acts', asyncHandler(async (req: Request, res: Response) => {
  if (req.query.refresh !== 'true') {
    const cached = await getCache('legal:acts');
    if (cached) {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
      return res.json({ success: true, count: cached.length, data: cached, fromCache: true });
    }
  }

  const acts = await BareAct.find({}, 'actName shortName year description chapters');
  await setCache('legal:acts', acts);
  if (req.query.refresh === 'true') {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  } else {
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
  }
  res.json({ success: true, count: acts.length, data: acts });
}));

// GET /acts/:shortName - Get detailed act structure with sections
router.get('/acts/:shortName', asyncHandler(async (req: Request, res: Response) => {
  const shortName = req.params.shortName as string;
  const normalizedShortName = normalizeActShortName(shortName);
  if (req.query.refresh !== 'true') {
    const cached = await getCache(`legal:act:${shortName}`);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
      return res.json({ success: true, data: cached, fromCache: true });
    }
  }

  const act = await BareAct.findOne({ shortName: new RegExp(`^${normalizedShortName}$`, 'i') });
  if (!act) {
    throw AppError.notFound('Act not found.');
  }

  const actObj = act.toObject ? act.toObject() : { ...act };
  actObj.shortName = shortName;

  // Join full section documents from SectionModel to get complete legal provisions, clauses, and content blocks
  const fullSections = await SectionModel.find({ actShortName: new RegExp(`^${normalizedShortName}$`, 'i') }).lean();
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
              let blocks = fullSec.content_blocks || [];
              blocks = blocks.filter((b: any) => {
                const txt = (b.text || '').trim();
                return !/^(February|January|March|April|May|June|July|August|September|October|November|December),\s*\d{4},?\s*see/i.test(txt) &&
                  !/^Gazette of India/i.test(txt);
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
                content: fullSec.content,
                content_hi: fullSec.content_hi,
                content_blocks: blocks,
                content_blocks_hi: fullSec.content_blocks_hi,
                introduction_text: fullSec.content || fullSec.introduction_text || sec.introduction_text,
                introduction_text_hi: fullSec.content_hi || fullSec.introduction_text_hi || sec.introduction_text_hi
              };
            }

            cleanSecs.push(processedSec);
          });

          chap.sections = cleanSecs;
        }
      });
    }
  }

  await setCache(`legal:act:${shortName}`, actObj);
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
  const normalizedShortName = normalizeActShortName(shortName);
  const cacheKey = `legal:act:outline:${shortName}`;
  if (req.query.refresh !== 'true') {
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
      return res.json({ success: true, data: cached, fromCache: true });
    }
  }

  const act = await BareAct.findOne(
    { shortName: new RegExp(`^${normalizedShortName}$`, 'i') },
    {
      actName: 1,
      shortName: 1,
      year: 1,
      description: 1,
      'chapters.chapterNumber': 1,
      'chapters.title': 1,
      'chapters.sections.section_number': 1,
      'chapters.sections.title': 1,
      'chapters.sections.title_hi': 1,
      'chapters.sections.clean_title': 1,
      'chapters.sections.clean_title_hi': 1
    }
  );

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
  const normalizedShortName = normalizeActShortName(shortName);
  let section = await SectionModel.findOne({
    actShortName: new RegExp(`^${normalizedShortName}$`, 'i'),
    section_number: sectionNumber
  });

  if (!section && sectionNumber.includes('_')) {
    const baseSecNum = sectionNumber.split('_')[0];
    section = await SectionModel.findOne({
      actShortName: new RegExp(`^${normalizedShortName}$`, 'i'),
      section_number: baseSecNum
    });
  }

  if (!section) {
    throw AppError.notFound('Section not found.');
  }

  const act = await BareAct.findOne({ shortName: new RegExp(`^${normalizedShortName}$`, 'i') }, 'actName year');

  const secNum = parseInt(section.section_number) || 0;
  let isBailable = true;
  let isCognizable = false;
  let compoundable = 'Non-Compoundable';
  let punishment = 'Fine or minor imprisonment';
  let severity = 'low';

  if (normalizedShortName === 'IPC' || normalizedShortName === 'BNS') {
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

export default router;