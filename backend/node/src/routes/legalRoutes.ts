import { Router, Request, Response } from 'express';
import { createClient } from 'redis';
import BareAct, { SectionModel } from '../models/BareAct';
import aiService from '../services/AiService';
import LegalResource from '../models/LegalResource';
import Lawyer from '../models/Lawyer';
import HelpCategory from '../models/HelpCategory';
import HelpRoadmap from '../models/HelpRoadmap';
import HelpHelpline from '../models/HelpHelpline';
import SavedCasePack from '../models/SavedCasePack';
import { splitTitle, getParsedContent } from '../utils/textParser';
import { requireAuth } from '../middleware/auth';

const router = Router();

function normalizeActShortName(shortName: string): string {
  if (!shortName) return shortName;
  const upper = shortName.toUpperCase().trim();
  if (upper === 'CPA') return 'CP';
  if (upper === 'ITA') return 'IT';
  return shortName;
}

// In-Memory Cache Fallback Stores
const searchCache = new Map<string, any>();
const mappingCache = new Map<string, any>();
const askCache = new Map<string, any>();
let cachedAllActs: any = null;
const cachedActsByShortName = new Map<string, any>();

// Redis Initialization with Graceful Fallback
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const redisUrl = process.env.REDIS_URL;
let redisClient: any = null;
let isRedisConnected = false;

if (redisUrl) {
  redisClient = createClient({ url: redisUrl });
  redisClient.on('error', (err: any) => {
    console.error('Redis client error:', err.message);
    isRedisConnected = false;
  });
  redisClient.on('connect', () => {
    console.log('✅ Redis connected successfully.');
    isRedisConnected = true;
  });
  redisClient.connect().catch((err: any) => {
    console.warn('⚠️ Failed to connect to Redis. Falling back to in-memory cache.', err.message);
    isRedisConnected = false;
  });
} else {
  console.log('ℹ️ Redis URL not provided. Using in-memory cache fallback.');
}

async function getCache(key: string): Promise<any> {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
    } catch (err) {
      console.warn(`Redis get error for key ${key}:`, err);
    }
  }

  if (key === 'legal:acts') {
    return cachedAllActs;
  } else if (key.startsWith('legal:act:')) {
    const shortName = key.replace('legal:act:', '');
    return cachedActsByShortName.get(shortName);
  } else if (key.startsWith('legal:search:')) {
    const query = key.replace('legal:search:', '');
    return searchCache.get(query);
  } else if (key.startsWith('legal:mapping:')) {
    const mapKey = key.replace('legal:mapping:', '');
    return mappingCache.get(mapKey);
  } else if (key.startsWith('legal:ask:')) {
    const askKey = key.replace('legal:ask:', '');
    return askCache.get(askKey);
  } else if (key === 'legal:help:stats') {
    return mappingCache.get('help:stats');
  }
  return null;
}

async function setCache(key: string, value: any, ttlSeconds: number = 86400): Promise<void> {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), {
        EX: ttlSeconds
      });
    } catch (err) {
      console.warn(`Redis set error for key ${key}:`, err);
    }
  }

  if (key === 'legal:acts') {
    cachedAllActs = value;
  } else if (key.startsWith('legal:act:')) {
    const shortName = key.replace('legal:act:', '');
    cachedActsByShortName.set(shortName, value);
  } else if (key.startsWith('legal:search:')) {
    const query = key.replace('legal:search:', '');
    if (searchCache.size >= 200) {
      const firstKey = searchCache.keys().next().value;
      if (firstKey) searchCache.delete(firstKey);
    }
    searchCache.set(query, value);
  } else if (key.startsWith('legal:mapping:')) {
    const mapKey = key.replace('legal:mapping:', '');
    if (mappingCache.size >= 100) {
      const firstKey = mappingCache.keys().next().value;
      if (firstKey) mappingCache.delete(firstKey);
    }
    mappingCache.set(mapKey, value);
  } else if (key.startsWith('legal:ask:')) {
    const askKey = key.replace('legal:ask:', '');
    if (askCache.size >= 200) {
      const firstKey = askCache.keys().next().value;
      if (firstKey) askCache.delete(firstKey);
    }
    askCache.set(askKey, value);
  } else if (key === 'legal:help:stats') {
    mappingCache.set('help:stats', value);
  }
}

// Semantic/Keyword search across all laws (section-level)
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ success: false, message: 'Query parameter "q" is required.' });
    }

    const cacheKey = query.trim().toLowerCase();
    if (req.query.refresh !== 'true') {
      const cached = await getCache(`legal:search:${cacheKey}`);
      if (cached) {
        return res.json({ ...cached, fromCache: true });
      }
    }

    // Using MongoDB $text index for fast section-level full-text search
    const sections = await SectionModel.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" }, content_blocks: 0, content_blocks_hi: 0 }
    ).sort({ score: { $meta: "textScore" } }).limit(20);

    // Fetch act metadata to match shortNames to full names/years (optimized lookup)
    const actShortNames = [...new Set(sections.map(s => s.actShortName || ''))].filter(Boolean);
    const acts = actShortNames.length > 0
      ? await BareAct.find({ shortName: { $in: actShortNames } }, 'actName shortName year description')
      : [];
    const actMap = new Map(acts.map(a => [a.shortName, a]));

    const data = sections.map(sec => {
      const act = actMap.get(sec.actShortName || '');

      // Extract a snippet around the query word
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

      // Highlight the query word in the snippet
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
    await setCache(`legal:search:${cacheKey}`, finalResponse, 3600); // cache search results for 1 hour

    res.json(finalResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Unified Omnisearch Hub
router.get('/search-hub', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    const city = (req.query.city as string || '').trim();
    const limit = parseInt(req.query.limit as string) || 3;

    if (!query) {
      return res.status(400).json({ success: false, message: 'Query parameter "q" is required.' });
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

    // Direct Act/Section parser
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

    // Prepare Lawyer filter
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

    // Prepare LegalResource filter
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

    // Fetch sections, inserting the direct match at index 0 if found
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

    // Fetch matching act metadata dynamically (only lookup referenced acts to optimize performance)
    const actShortNames = [...new Set(sections.map(s => s.actShortName || ''))].filter(Boolean);
    const acts = actShortNames.length > 0
      ? await BareAct.find({ shortName: { $in: actShortNames } }, 'actName shortName year description')
      : [];
    const actMap = new Map(acts.map(a => [a.shortName, a]));

    // Map section results with highlighting and metadata
    const mappedSections = sections.map(sec => {
      const act = actMap.get(sec.actShortName || '');
      let snippet = '';
      const text = sec.content || '';
      const textHi = sec.content_hi || '';

      // Determine snippet source text (use Hindi if search query is in Hindi)
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

      // Highlight matching query words in the snippet
      if (searchWords.length > 0) {
        const wordsPattern = searchWords.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
        const highlightRegex = new RegExp(`(${wordsPattern})`, 'gi');
        snippet = snippet.replace(highlightRegex, '<mark class="bg-accent/20 text-accent dark:bg-accent/30 dark:text-accent-light px-0.5 rounded">$1</mark>');
      }

      // Heuristic rules for criminal offense details for IPC/BNS sections
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

    // Cache the result for 5 minutes (300 seconds)
    await setCache(cacheKey, finalResponse, 300);

    res.json(finalResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// AI-powered "Ask a Legal Question" — returns a plain answer + suggested acts
router.post('/ask', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string' || question.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'A valid "question" string is required in the request body.' });
    }

    const trimmedQuestion = question.trim();

    // Check cache first
    const cachedResponse = await getCache(`legal:ask:${trimmedQuestion}`);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // Grounding: Search MongoDB text index for matching sections to build context
    const matchingSections = await SectionModel.find(
      { $text: { $search: trimmedQuestion } },
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } }).limit(5);

    // Get all act metadata for mapping
    const acts = await BareAct.find({}, 'shortName actName year');
    const actMap = new Map(acts.map(a => [a.shortName, a]));
    const availableActs = acts.map(a => a.shortName);

    let context = '';
    if (matchingSections.length > 0) {
      context = matchingSections.map((sec, idx) => {
        const act = actMap.get(sec.actShortName || '');
        const actName = act ? act.actName : sec.actShortName;
        return `Source ${idx + 1}: ${actName} - Section ${sec.section_number} (${sec.title})\nText:\n${sec.content}`;
      }).join('\n\n---\n\n');
    }

    const result = await aiService.askLegalQuestion(trimmedQuestion, availableActs, context);
    const finalResponse = { success: true, ...result };

    // Cache results for 1 day (86400 seconds)
    await setCache(`legal:ask:${trimmedQuestion}`, finalResponse, 86400);

    res.json(finalResponse);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all acts (name, shortName, year only - no full data)
router.get('/acts', async (req: Request, res: Response) => {
  try {
    if (req.query.refresh !== 'true') {
      const cached = await getCache('legal:acts');
      if (cached) {
        res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
        return res.json({ success: true, count: cached.length, data: cached, fromCache: true });
      }
    }

    const acts = await BareAct.find({}, 'actName shortName year description');
    await setCache('legal:acts', acts);
    if (req.query.refresh === 'true') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    } else {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    }
    res.json({ success: true, count: acts.length, data: acts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/acts/:shortName', async (req: Request, res: Response) => {
  try {
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
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    const actObj = act.toObject ? act.toObject() : { ...act };
    actObj.shortName = shortName;

    await setCache(`legal:act:${shortName}`, actObj);
    if (req.query.refresh === 'true') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    } else {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    }
    res.json({ success: true, data: actObj });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get outline of act (structural metadata, excluding heavy content fields)
router.get('/acts/:shortName/outline', async (req: Request, res: Response) => {
  try {
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
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    const actObj = act.toObject ? act.toObject() : { ...act };
    actObj.shortName = shortName; // preserve requested shortName

    await setCache(cacheKey, actObj);
    if (req.query.refresh === 'true') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    } else {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    }
    res.json({ success: true, data: actObj });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a specific section
router.get('/acts/:shortName/sections/:sectionNumber', async (req: Request, res: Response) => {
  try {
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
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    const act = await BareAct.findOne({ shortName: new RegExp(`^${normalizedShortName}$`, 'i') }, 'actName year');

    // Heuristic rules for criminal offense details for IPC/BNS sections
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});
// Generate or get AI Summary
router.get('/acts/:shortName/sections/:sectionNumber/summary', async (req: Request, res: Response) => {
  try {
    const shortName = req.params.shortName as string;
    const normalizedShortName = normalizeActShortName(shortName);
    const sectionNumber = req.params.sectionNumber as string;

    const act = await BareAct.findOne({ shortName: new RegExp(`^${normalizedShortName}$`, 'i') }, 'actName shortName');
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    let section = await SectionModel.findOne({ actShortName: new RegExp(`^${normalizedShortName}$`, 'i'), section_number: sectionNumber });

    if (!section && sectionNumber.includes('_')) {
      const baseSecNum = sectionNumber.split('_')[0];
      section = await SectionModel.findOne({
        actShortName: new RegExp(`^${normalizedShortName}$`, 'i'),
        section_number: baseSecNum
      });
    }

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }
    if (section.aiSummary) {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
      return res.json({ success: true, data: { summary: section.aiSummary, cached: true } });
    }

    // Call AI Service
    const generatedSummary = await aiService.generateSectionSummary(act.actName, section.title, section.content);

    // Save back to DB atomically
    section.aiSummary = generatedSummary;
    await section.save();

    // Invalidate cache
    cachedActsByShortName.delete(shortName);
    if (isRedisConnected && redisClient) {
      await redisClient.del(`legal:act:${shortName}`);
    }

    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    res.json({ success: true, data: { summary: generatedSummary, cached: false } });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Real-time stream AI summary
router.get('/acts/:shortName/sections/:sectionNumber/summary/stream', async (req: Request, res: Response) => {
  // Set headers for Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.write(': ping\n\n');
  try {
    const shortName = req.params.shortName as string;
    const normalizedShortName = normalizeActShortName(shortName);
    const sectionNumber = req.params.sectionNumber as string;

    const act = await BareAct.findOne({ shortName: new RegExp(`^${normalizedShortName}$`, 'i') }, 'actName shortName');
    if (!act) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Act not found.' })}\n\n`);
      return res.end();
    }
    let section = await SectionModel.findOne({ actShortName: new RegExp(`^${normalizedShortName}$`, 'i'), section_number: sectionNumber });

    if (!section && sectionNumber.includes('_')) {
      const baseSecNum = sectionNumber.split('_')[0];
      section = await SectionModel.findOne({
        actShortName: new RegExp(`^${normalizedShortName}$`, 'i'),
        section_number: baseSecNum
      });
    }

    if (!section) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Section not found.' })}\n\n`);
      return res.end();
    }

    // If summary already exists in DB, stream it back directly in one chunk
    if (section.aiSummary) {
      res.write(`data: ${JSON.stringify({ chunk: section.aiSummary })}\n\n`);
      res.write(`event: end\ndata: {}\n\n`);
      return res.end();
    }

    // Generate summary stream from AI Service
    const stream = aiService.generateSectionSummaryStream(act.actName, section.title, section.content);
    let fullSummary = '';

    for await (const chunk of stream) {
      fullSummary += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    // Save generated summary back to DB atomically
    if (fullSummary.trim()) {
      section.aiSummary = fullSummary;
      await section.save();

      // Invalidate acts cache so next load gets the updated summary
      cachedActsByShortName.delete(shortName);
      if (isRedisConnected && redisClient) {
        await redisClient.del(`legal:act:${shortName}`);
      }
    }

    res.write(`event: end\ndata: {}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('SSE summary stream error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ message: error.message || 'Stream generation failed.' })}\n\n`);
    res.end();
  }
});

async function resolveCityAndStateFromText(locationStr: string): Promise<{ city: string; state: string | null; lat?: number; lng?: number }> {
  const cleanLoc = locationStr.toLowerCase().trim();
  
  try {
    // Get all unique cities from database dynamically
    const dbCities = await LegalResource.distinct('city');
    // Sort by length descending to match longer names first (e.g. "New Delhi" before "Delhi")
    dbCities.sort((a, b) => b.length - a.length);

    for (const city of dbCities) {
      if (city && cleanLoc.includes(city.toLowerCase())) {
        // Find the state for this city from the database
        const sample = await LegalResource.findOne({
          city: { $regex: new RegExp(`^${city}$`, 'i') },
          state: { $exists: true }
        }).lean();
        
        // Find coordinates of any resource in this city to assist proximity mapping
        const coordSample = await LegalResource.findOne({
          city: { $regex: new RegExp(`^${city}$`, 'i') },
          'coordinates.lat': { $exists: true }
        }).lean();

        return {
          city: city,
          state: (sample && sample.state) ? sample.state : null,
          lat: coordSample?.coordinates?.lat || undefined,
          lng: coordSample?.coordinates?.lng || undefined
        };
      }
    }
  } catch (err) {
    console.error('Failed to query distinct cities from DB:', err);
  }

  // Comma-separated address fallback
  if (locationStr.includes(',')) {
    const parts = locationStr.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      const cityCandidate = parts[parts.length - 3];
      try {
        const sample = await LegalResource.findOne({
          city: { $regex: new RegExp(`^${cityCandidate}$`, 'i') }
        }).lean();
        if (sample) {
          return {
            city: sample.city,
            state: sample.state || null,
            lat: sample.coordinates?.lat || undefined,
            lng: sample.coordinates?.lng || undefined
          };
        }
      } catch (err) {}
    } else if (parts.length >= 2) {
      const cityCandidate = parts[parts.length - 2];
      try {
        const sample = await LegalResource.findOne({
          city: { $regex: new RegExp(`^${cityCandidate}$`, 'i') }
        }).lean();
        if (sample) {
          return {
            city: sample.city,
            state: sample.state || null,
            lat: sample.coordinates?.lat || undefined,
            lng: sample.coordinates?.lng || undefined
          };
        }
      } catch (err) {}
    }
  }

  // If no city from DB matches, capitalize and clean original location string
  const cleanTarget = locationStr.replace(/\b\d{5,}\b/g, '').replace(/,?\s*india/i, '').trim();
  return { city: cleanTarget || locationStr, state: null };
}

// GET /api/legal/help/categories - Fetch all legal help categories with dynamic counts
router.get('/help/categories', async (req: Request, res: Response) => {
  try {
    const locationStr = (req.query.location as string || 'New Delhi').trim();
    const latVal = (req.query.lat && req.query.lat !== 'null' && req.query.lat !== 'undefined') ? Number(req.query.lat) : null;
    const lngVal = (req.query.lng && req.query.lng !== 'null' && req.query.lng !== 'undefined') ? Number(req.query.lng) : null;
    const latParamStr = latVal !== null ? latVal.toFixed(4) : '';
    const lngParamStr = lngVal !== null ? lngVal.toFixed(4) : '';
    const cacheKey = `legal:help:categories:${locationStr.toLowerCase()}:${latParamStr}:${lngParamStr}`;

    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      res.set('Cache-Control', 'public, max-age=300, must-revalidate');
      return res.json({ success: true, data: cachedData, fromCache: true });
    }

    // Fetch all HelpCategory records
    const dbCategories = await HelpCategory.find({}).lean();
    if (!dbCategories || dbCategories.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Resolve city from coordinates if available
    let resolvedCity = locationStr;
    const nearbyCities = new Set<string>();
    let coordsResolved = false;

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
      const textRes = await resolveCityAndStateFromText(locationStr);
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

    // Handle city aliases dynamically
    let cityPattern = `^${resolvedCity}$`;
    const cleanedLoc = resolvedCity.trim().toLowerCase();
    if (cleanedLoc === 'delhi' || cleanedLoc === 'new delhi') {
      cityPattern = '^(delhi|new delhi)$';
    } else if (cleanedLoc === 'bengaluru' || cleanedLoc === 'bangalore') {
      cityPattern = '^(bengaluru|bangalore)$';
    } else if (cleanedLoc === 'gurgaon' || cleanedLoc === 'gurugram') {
      cityPattern = '^(gurgaon|gurugram)$';
    }

    // Include all nearby cities from coordinate resolution
    if (nearbyCities.size > 1) {
      const escaped = Array.from(nearbyCities).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      cityPattern = `^(${escaped.join('|')})$`;
    }

    // Compute active counts for the given location in parallel
    const categoriesWithCounts = await Promise.all(dbCategories.map(async (cat) => {
      let specQuery: any = cat.id;
      if (cat.id === 'Property Dispute') {
        specQuery = /Property|Real Estate|Civil|Land/i;
      } else if (cat.id === 'Family Law' || cat.id === 'Domestic Violence') {
        specQuery = /Family|Divorce|Domestic|Women|Criminal/i;
      } else if (cat.id === 'Consumer Complaint') {
        specQuery = /Consumer|Civil|Insurance/i;
      } else if (cat.id === 'Cyber Crime') {
        specQuery = /Cyber|Criminal|IT Law|Information Technology/i;
      } else if (cat.id === 'Labour Issue') {
        specQuery = /Labour|Employment|Service Law/i;
      } else if (cat.id === 'Criminal Matter') {
        specQuery = /Criminal|Bail/i;
      } else if (cat.id === 'Business Dispute') {
        specQuery = /Corporate|Commercial|Contract|Business/i;
      }

      const resourcesFilter = {
        city: { $regex: new RegExp(cityPattern, 'i') },
        status: 'approved' as const,
        $or: [
          { categories: cat.name },
          { categories: 'General' }
        ]
      };

      const [legalAid, courts, govOffices, lawyers, helplines] = await Promise.all([
        LegalResource.countDocuments({ ...resourcesFilter, type: 'LegalAid' }),
        LegalResource.countDocuments({ ...resourcesFilter, type: 'Court' }),
        LegalResource.countDocuments({ ...resourcesFilter, type: { $in: ['GovernmentOffice', 'PoliceStation'] } }),
        Lawyer.countDocuments({
          city: { $regex: new RegExp(cityPattern, 'i') },
          specializations: { $regex: specQuery },
          isVerified: true
        }),
        HelpHelpline.countDocuments({
          $or: [
            { category: cat.id },
            { category: 'General' }
          ]
        })
      ]);

      const totalCount = legalAid + courts + govOffices + lawyers + helplines;

      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
        subcategories: cat.subcategories,
        resourceCount: totalCount,
        breakdown: {
          legalAid,
          courts,
          govOffices,
          helplines,
          lawyers
        }
      };
    }));

    await setCache(cacheKey, categoriesWithCounts, 300);

    res.set('Cache-Control', 'public, max-age=300, must-revalidate');
    res.json({ success: true, data: categoriesWithCounts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/all-authorities - Returns all SLSA (state) and NALSA (national) authority records
router.get('/all-authorities', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'legal:all-authorities';
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
      return res.json({ success: true, data: cached, fromCache: true });
    }

    const authorities = await LegalResource.find({
      $or: [{ isStateAuthority: true }, { isNationalAuthority: true }],
      status: 'approved'
    }).lean();

    await setCache(cacheKey, authorities, 3600);
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.json({ success: true, data: authorities });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/help-near-me - Find resources, lawyers, helplines & customized roadmap
router.get('/help-near-me', async (req: Request, res: Response) => {
  try {
    const { category, location, state } = req.query;

    if (!category || !location) {
      return res.status(400).json({
        success: false,
        message: 'Parameters "category" and "location" are required.'
      });
    }

    const categoryStr = category as string;
    const locationStr = location as string;
    const stateParam = state as string;

    const latParamStr = req.query.lat ? String(req.query.lat) : '';
    const lngParamStr = req.query.lng ? String(req.query.lng) : '';
    const cacheKey = `legal:help-near-me:${categoryStr.toLowerCase()}:${locationStr.toLowerCase()}:${(stateParam || '').toLowerCase()}:${latParamStr}:${lngParamStr}`;
    const cachedResult = await getCache(cacheKey);
    if (cachedResult) {
      res.set('Cache-Control', 'public, max-age=300, must-revalidate');
      return res.json({ ...cachedResult, fromCache: true });
    }

    let targetCity = locationStr.trim();
    let resolvedState = stateParam;

    const latVal = (req.query.lat && req.query.lat !== 'null' && req.query.lat !== 'undefined') ? Number(req.query.lat) : null;
    const lngVal = (req.query.lng && req.query.lng !== 'null' && req.query.lng !== 'undefined') ? Number(req.query.lng) : null;
    let coordsResolved = false;

    // 0. Geospatial resolution: If coordinates are passed, resolve closest resource and its city name
    const nearbyCities = new Set<string>();
    if (latVal !== null && lngVal !== null && !isNaN(latVal) && !isNaN(lngVal)) {
      const delta = 0.8; // roughly 80km bounding box
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
            // Collect all cities within the bounding box
            if (res.city) {
              nearbyCities.add(res.city);
            }
            if (dist < minDistance) {
              minDistance = dist;
              closestResource = res;
            }
          }
        }
        if (closestResource) {
          targetCity = closestResource.city;
          resolvedState = closestResource.state || resolvedState;
          coordsResolved = true;
        }
      }
    }

    // Fallback to text matching if coordinates are not available or couldn't resolve a city
    if (!coordsResolved) {
      const textRes = await resolveCityAndStateFromText(locationStr);
      targetCity = textRes.city;
      resolvedState = textRes.state || resolvedState;
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

    // 1. Fetch Legal Resources and Lawyers in this city in parallel
    let specQuery: any = categoryStr;
    if (categoryStr === 'Property Dispute') {
      specQuery = /Property|Real Estate|Civil|Land/i;
    } else if (categoryStr === 'Family Law' || categoryStr === 'Domestic Violence') {
      specQuery = /Family|Divorce|Domestic|Women|Criminal/i;
    } else if (categoryStr === 'Consumer Complaint') {
      specQuery = /Consumer|Civil|Insurance/i;
    } else if (categoryStr === 'Cyber Crime') {
      specQuery = /Cyber|Criminal|IT Law|Information Technology/i;
    } else if (categoryStr === 'Labour Issue') {
      specQuery = /Labour|Employment|Service Law/i;
    } else if (categoryStr === 'Criminal Matter') {
      specQuery = /Criminal|Bail/i;
    } else if (categoryStr === 'Business Dispute') {
      specQuery = /Corporate|Commercial|Contract|Business/i;
    }

    // Handle city aliases dynamically using the clean targetCity
    let cityPattern = `^${targetCity}$`;
    const cleanedLoc = targetCity.trim().toLowerCase();
    if (cleanedLoc === 'delhi' || cleanedLoc === 'new delhi') {
      cityPattern = '^(delhi|new delhi)$';
    } else if (cleanedLoc === 'bengaluru' || cleanedLoc === 'bangalore') {
      cityPattern = '^(bengaluru|bangalore)$';
    } else if (cleanedLoc === 'gurgaon' || cleanedLoc === 'gurugram') {
      cityPattern = '^(gurgaon|gurugram)$';
    }

    // If coordinate resolution found multiple nearby cities, include them all
    if (nearbyCities.size > 1) {
      const escaped = Array.from(nearbyCities).map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      cityPattern = `^(${escaped.join('|')})$`;
    }

    const resourceFilter = {
      city: { $regex: new RegExp(cityPattern, 'i') },
      status: 'approved' as const,
      $or: [
        { categories: categoryStr },
        { categories: 'General' }
      ]
    };

    const [resources, lawyers, dbRoadmap, dbHelplines, slsaResource, nalsaHq] = await Promise.all([
      LegalResource.find(resourceFilter),
      Lawyer.find({
        city: { $regex: new RegExp(cityPattern, 'i') },
        specializations: { $regex: specQuery },
        isVerified: true
      }).sort({ rating: -1 }).limit(10),
      HelpRoadmap.findOne({ category: categoryStr }).lean(),
      HelpHelpline.find({
        $or: [
          { category: categoryStr },
          { category: 'General' }
        ]
      }).lean(),
      resolvedState ? LegalResource.findOne({
        isStateAuthority: true,
        state: { $regex: new RegExp(`^${resolvedState}$`, 'i') }
      }).exec() : Promise.resolve(null),
      LegalResource.findOne({
        isNationalAuthority: true
      }).exec()
    ]);

    const combinedResources: any[] = [...resources];
    if (slsaResource && !combinedResources.some(r => r._id.toString() === slsaResource._id.toString())) {
      combinedResources.unshift(slsaResource);
    }
    if (nalsaHq && !combinedResources.some(r => r._id.toString() === nalsaHq._id.toString())) {
      combinedResources.unshift(nalsaHq);
    }

    const roadmap = dbRoadmap || {
      steps: [
        { title: 'Seek Legal Advice', detail: 'Consult a legal aid center or hire a verified attorney to evaluate your rights.' },
        { title: 'Draft a Written Narrative', detail: 'Write a chronological summary of what happened, detailing names, dates, and witnesses.' },
        { title: 'Gather Supporting Documents', detail: 'Collect all contracts, identity documents, bills, and communications.' }
      ],
      documents: ['Government Issued Photo ID', 'Relevant Contracts/Agreements', 'Correspondence history (emails/letters)'],
      onlineLinks: [
        { name: 'e-Courts Services Portal', url: 'https://ecourts.gov.in' }
      ],
      lokAdalatGuidance: 'Civil suits and minor compoundable offenses can be settled in Lok Adalats to save costs, stress, and time.'
    };

    const helplines = dbHelplines && dbHelplines.length > 0 ? dbHelplines : [
      {
        name: 'National Legal Aid Helpline (NALSA)',
        number: '15100',
        description: 'Free legal aid services and counseling available 24/7 across India.'
      }
    ];

    const result = {
      success: true,
      category: categoryStr,
      location: locationStr,
      roadmap,
      helplines,
      resources: combinedResources,
      lawyers
    };

    await setCache(cacheKey, result, 300);

    res.set('Cache-Control', 'public, max-age=300, must-revalidate');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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

// Typeahead suggestions for mapper search — returns section numbers + titles matching a query
router.get('/mapping/suggestions', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (!q || q.length < 1) {
      return res.json({ success: true, data: [] });
    }

    const cacheKey = `legal:mapping:suggestions:${q.toLowerCase()}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ success: true, data: cached, fromCache: true });
    }

    // Search across all supported acts dynamically fetched from database
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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/mapping', async (req: Request, res: Response) => {
  try {
    const { act, section } = req.query;
    if (!act || !section) {
      return res.status(400).json({
        success: false,
        message: 'Parameters "act" and "section" are required.'
      });
    }

    const actStr = (act as string).toUpperCase();
    const sectionStr = (section as string).trim();

    // Check cache first (mapping + AI comparison is expensive)
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
      return res.status(400).json({
        success: false,
        message: 'Mapping is only supported for IPC, CrPC, IEA, BNS, BNSS, and BSA.'
      });
    }

    const [oldActObj, newActObj] = await Promise.all([
      BareAct.findOne({ shortName: oldActShortName }, 'actName shortName chapters.chapterNumber chapters.title'),
      BareAct.findOne({ shortName: newActShortName }, 'actName shortName chapters.chapterNumber chapters.title')
    ]);

    if (!oldActObj || !newActObj) {
      return res.status(404).json({
        success: false,
        message: `Acts not found in database. Please ensure seeding is complete.`
      });
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

    // Cache the full result (AI comparison is expensive)
    await setCache(mapCacheKey, finalResult, 3600);
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.json(finalResult);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/acts/:shortName/sections/:sectionNumber/chat', async (req: Request, res: Response) => {
  try {
    const { question } = req.body;
    const shortName = req.params.shortName as string;
    const normalizedShortName = normalizeActShortName(shortName);
    const sectionNumber = req.params.sectionNumber as string;

    const act = await BareAct.findOne({ shortName: new RegExp(`^${normalizedShortName}$`, 'i') }, 'actName shortName');
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    let section = await SectionModel.findOne({ actShortName: new RegExp(`^${normalizedShortName}$`, 'i'), section_number: sectionNumber });
    if (!section && sectionNumber.includes('_')) {
      const baseSecNum = sectionNumber.split('_')[0];
      section = await SectionModel.findOne({
        actShortName: new RegExp(`^${normalizedShortName}$`, 'i'),
        section_number: baseSecNum
      });
    }

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    const prompt = `You are an expert legal assistant. A user is asking a question about a specific section of a law.
    
Act: ${act.actName} (${act.shortName})
Section Number: ${sectionNumber}
Section Title: ${section.title}
Section Content:
${section.content}

User Question: ${question}

Provide a helpful, direct, and concise answer in plain language (1-2 short paragraphs). Relate it directly to the statutory content of this section.`;

    const answer = await aiService.generateRawContent(prompt);
    res.json({ success: true, answer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// On-the-fly Hindi translation for a specific section
router.post('/acts/:shortName/sections/:sectionNumber/translate', async (req: Request, res: Response) => {
  try {
    const shortName = req.params.shortName as string;
    const normalizedShortName = normalizeActShortName(shortName);
    const sectionNumber = req.params.sectionNumber as string;

    const act = await BareAct.findOne({ shortName: new RegExp(`^${normalizedShortName}$`, 'i') }, 'actName shortName year');
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    let section = await SectionModel.findOne({ actShortName: new RegExp(`^${normalizedShortName}$`, 'i'), section_number: sectionNumber });
    if (!section && sectionNumber.includes('_')) {
      const baseSecNum = sectionNumber.split('_')[0];
      section = await SectionModel.findOne({
        actShortName: new RegExp(`^${normalizedShortName}$`, 'i'),
        section_number: baseSecNum
      });
    }

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    const { force } = req.body;

    // If already translated, return existing translation (unless force is requested)
    if (!force && section.content_hi && section.content_hi.trim().length > 10) {
      return res.json({
        success: true,
        data: {
          content_hi: section.content_hi,
          title_hi: section.title_hi || section.title,
          clean_title_hi: section.clean_title_hi,
          introduction_text_hi: section.introduction_text_hi,
          content_blocks_hi: section.content_blocks_hi,
          cached: true
        }
      });
    }

    // Translate using Gemini
    const context = `${act.actName} (${act.shortName}), ${act.year}`;

    const contentPrompt = `You are an expert legal translator. Translate the following Indian legal statute text from English to Hindi (Devanagari script).

RULES:
- Produce ONLY the Hindi translation, no explanations or commentary.
- Preserve the exact structure: line breaks, clause numbering like (a), (b), (c), Explanations, Illustrations etc.
- Translate clause labels like (a) to (क), (b) to (ख), (c) to (ग), (d) to (घ), (e) to (ङ) etc.
- Keep proper nouns (names of places, acts, courts) in their original English form.
- Use standard legal Hindi terminology.
- Translate "Explanation" as "स्पष्टीकरण" and "Illustration" as "दृष्टांत".

Context: This is from ${context}.

English text to translate:
${section.content}`;

    const titlePrompt = `Translate this Indian legal section title from English to Hindi (Devanagari script). Output ONLY the Hindi translation, nothing else. Keep proper nouns in English.

Title: ${section.title}`;

    // Run translations in parallel
    let contentResult = '';
    let titleResult = '';
    let isFallback = false;

    try {
      const [cRes, tRes] = await Promise.all([
        aiService.generateRawContent(contentPrompt),
        aiService.generateRawContent(titlePrompt)
      ]);
      contentResult = cRes;
      titleResult = tRes;
      
      if (contentResult.includes('Mock Translation') || contentResult.includes('GEMINI_API_KEY')) {
        isFallback = true;
      }
    } catch (err: any) {
      console.error('Gemini translation failed, falling back to English:', err);
      isFallback = true;
    }

    if (isFallback) {
      const cleanTitleHi = section.clean_title || section.title;
      const contentBlocksHi = section.content_blocks && section.content_blocks.length > 0
        ? section.content_blocks.map(b => ({ type: b.type, text: b.text }))
        : [{ type: 'main', text: section.content }];

      return res.json({
        success: true,
        data: {
          content_hi: section.content,
          title_hi: section.title,
          clean_title_hi: cleanTitleHi,
          introduction_text_hi: section.introduction_text || undefined,
          content_blocks_hi: contentBlocksHi,
          cached: false,
          translationUnavailable: true
        }
      });
    }

    const { cleanTitle: cleanTitleHi, introText: introTextHi } = splitTitle(titleResult);
    const contentBlocksHi = getParsedContent(contentResult, introTextHi);

    // Save to DB atomically
    section.content_hi = contentResult;
    section.title_hi = titleResult;
    section.clean_title_hi = cleanTitleHi;
    section.introduction_text_hi = introTextHi || undefined;
    section.content_blocks_hi = contentBlocksHi.map(b => ({ type: b.type, text: b.text }));
    await section.save();

    // Invalidate cache for this act
    cachedActsByShortName.delete(shortName);
    if (isRedisConnected && redisClient) {
      await redisClient.del(`legal:act:${shortName}`);
    }

    res.json({
      success: true,
      data: {
        content_hi: contentResult,
        title_hi: titleResult,
        clean_title_hi: cleanTitleHi,
        introduction_text_hi: introTextHi || undefined,
        content_blocks_hi: contentBlocksHi.map(b => ({ type: b.type, text: b.text })),
        cached: false
      }
    });
  } catch (error: any) {
    console.error('Translation error:', error);
    res.status(500).json({ success: false, message: 'Translation failed: ' + error.message });
  }
});

// AI Jargon Buster: Explains highlighted legal terminology
router.get('/jargon', async (req: Request, res: Response) => {
  try {
    const term = req.query.term as string;
    if (!term || term.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Query parameter "term" is required and must be at least 2 characters.' });
    }

    const cacheKey = `legal:jargon:${term.trim().toLowerCase()}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json({ success: true, term: term.trim(), definition: cached, fromCache: true });
    }

    // Call Gemini to explain the legal term in plain English
    const prompt = `You are a professional legal glossary explainer. Explain the following legal jargon or term in simple plain English so a non-lawyer can understand.
Keep the definition concise (1-2 sentences maximum).

Term: "${term.trim()}"

Definition:`;

    const definition = await aiService.generateRawContent(prompt);

    await setCache(cacheKey, definition, 86400 * 7); // Cache for 7 days

    res.json({
      success: true,
      term: term.trim(),
      definition,
      fromCache: false
    });
  } catch (error: any) {
    console.error('Jargon explainer error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// User Suggestion Endpoint (Public)
router.post('/suggest-resource', async (req: Request, res: Response) => {
  try {
    const { name, type, categories, subcategories, city, state, address, contactNumber, website, languages, coordinates } = req.body;
    if (!name || !type || !city || !address || !coordinates || !coordinates.lat || !coordinates.lng) {
      return res.status(400).json({ success: false, message: 'Required fields: name, type, city, address, coordinates.' });
    }

    const newResource = new LegalResource({
      name,
      type,
      categories: categories || ['General'],
      subcategories: subcategories || [],
      city,
      state,
      address,
      contactNumber,
      website,
      languages: languages || ['English', 'Hindi'],
      coordinates,
      isVerified: false,
      status: 'pending',
      source: 'user_suggestion'
    });

    await newResource.save();
    res.status(201).json({ success: true, message: 'Resource suggestion submitted successfully for moderation.', data: newResource });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/resources/:id - Get a single legal resource by ID (Public)
router.get('/resources/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const resource = await LegalResource.findById(id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }
    res.json({ success: true, data: resource });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/helplinesAll - Fetch all emergency helplines (Public)
router.get('/helplinesAll', async (req: Request, res: Response) => {
  try {
    const helplines = await HelpHelpline.find({});
    res.json({ success: true, data: helplines });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/resourcesAll - Fetch all legal aid resources/courts (Public)
router.get('/resourcesAll', async (req: Request, res: Response) => {
  try {
    const resources = await LegalResource.find({ status: 'approved' });
    res.json({ success: true, data: resources });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/legal/helplines/batch - Fetch helplines details for an array of IDs
router.post('/helplines/batch', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'ids must be an array.' });
    }
    const helplines = await HelpHelpline.find({ _id: { $in: ids } });
    res.json({ success: true, data: helplines });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/legal/resources/batch - Fetch resources details for an array of IDs
router.post('/resources/batch', async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'ids must be an array.' });
    }
    const resources = await LegalResource.find({ _id: { $in: ids } });
    res.json({ success: true, data: resources });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin Resource List (Protected)
router.get('/admin/resources', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, city, type, search, page = '1', limit = '10' } = req.query;
    const filter: any = {};

    if (status) filter.status = status;
    if (city) filter.city = { $regex: new RegExp(city as string, 'i') };
    if (type) filter.type = type;
    if (search) {
      filter.$or = [
        { name: { $regex: new RegExp(search as string, 'i') } },
        { address: { $regex: new RegExp(search as string, 'i') } }
      ];
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [resources, total] = await Promise.all([
      LegalResource.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      LegalResource.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: resources,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin Resource Create (Protected)
router.post('/admin/resources', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, type, categories, subcategories, city, state, address, contactNumber, website, languages, coordinates, status } = req.body;
    if (!name || !type || !city || !address || !coordinates || !coordinates.lat || !coordinates.lng) {
      return res.status(400).json({ success: false, message: 'Required fields: name, type, city, address, coordinates.' });
    }

    const newResource = new LegalResource({
      name,
      type,
      categories: categories || ['General'],
      subcategories: subcategories || [],
      city,
      state,
      address,
      contactNumber,
      website,
      languages: languages || ['English', 'Hindi'],
      coordinates,
      isVerified: true,
      status: status || 'approved',
      source: 'admin_dashboard'
    });

    await newResource.save();
    res.status(201).json({ success: true, message: 'Resource created successfully.', data: newResource });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin Resource Update / Approve (Protected)
router.put('/admin/resources/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const resource = await LegalResource.findById(id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }

    if (updates.status === 'approved') {
      updates.isVerified = true;
    }

    const updatedResource = await LegalResource.findByIdAndUpdate(id, updates, { new: true });
    res.json({ success: true, message: 'Resource updated successfully.', data: updatedResource });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin Resource Delete (Protected)
router.delete('/admin/resources/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const resource = await LegalResource.findByIdAndDelete(id);
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found.' });
    }
    res.json({ success: true, message: 'Resource deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── AI Scenario Solver ─────────────────────────────────────────────────────
// POST /api/legal/help/ai-solve — Uses Gemini to parse a natural language situation
router.post('/help/ai-solve', async (req: Request, res: Response) => {
  try {
    const { description } = req.body;
    if (!description || description.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Field "description" is required (min 5 characters).' });
    }

    const result = await aiService.solveAiScenario(description.trim());
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('AI solve error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Offline Case Pack Sync (Auth Required) ──────────────────────────────────
// GET /api/legal/case-packs — Get all synced Case Packs for logged-in user
router.get('/case-packs', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const packs = await SavedCasePack.find({ userId }).sort({ savedAt: -1 }).lean();
    res.json({ success: true, data: packs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/legal/case-packs/sync — Upsert an array of offline Case Packs for user
router.post('/case-packs/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { packs } = req.body;
    if (!Array.isArray(packs) || packs.length === 0) {
      return res.status(400).json({ success: false, message: '"packs" must be a non-empty array.' });
    }

    let synced = 0;
    for (const pack of packs) {
      if (!pack.category || !pack.location) continue;
      await SavedCasePack.findOneAndUpdate(
        { userId, category: pack.category, location: pack.location },
        {
          userId,
          category: pack.category,
          location: pack.location,
          roadmap: pack.roadmap || {},
          helplines: pack.helplines || [],
          resources: pack.resources || [],
          savedAt: pack.savedAt ? new Date(pack.savedAt) : new Date()
        },
        { upsert: true, new: true }
      );
      synced++;
    }

    res.json({ success: true, synced, message: `${synced} Case Pack(s) synced to your account.` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/legal/case-packs/:id — Remove a specific synced Case Pack
router.delete('/case-packs/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await SavedCasePack.findOneAndDelete({ _id: req.params.id, userId });
    res.json({ success: true, message: 'Case Pack removed from account.' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/legal/help/stats — Fetch real counts of legal resources from database
router.get('/help/stats', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'legal:help:stats';
    const cached = await getCache(cacheKey);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=600, must-revalidate');
      return res.json({ success: true, data: cached, fromCache: true });
    }

    const [legalClinics, distCourts, verifiedLawyers] = await Promise.all([
      LegalResource.countDocuments({ type: 'LegalAid', status: 'approved' }),
      LegalResource.countDocuments({ type: 'Court', status: 'approved' }),
      Lawyer.countDocuments({ isVerified: true })
    ]);

    const stats = {
      legalClinics,
      distCourts,
      verifiedLawyers
    };

    await setCache(cacheKey, stats, 600); // cache for 10 minutes

    res.set('Cache-Control', 'public, max-age=600, must-revalidate');
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;