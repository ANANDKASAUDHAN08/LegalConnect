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

// In-Memory Cache Fallback Stores
const searchCache = new Map<string, any>();
const mappingCache = new Map<string, any>();
const askCache = new Map<string, any>();
let cachedAllActs: any = null;
const cachedActsByShortName = new Map<string, any>();

// Redis Initialization with Graceful Fallback
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
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } }).limit(20);

    // Fetch act metadata to match shortNames to full names/years
    const acts = await BareAct.find({}, 'actName shortName year description');
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
    if (req.query.refresh !== 'true') {
      const cached = await getCache(`legal:act:${shortName}`);
      if (cached) {
        res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
        return res.json({ success: true, data: cached, fromCache: true });
      }
    }

    const act = await BareAct.findOne({ shortName });
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    await setCache(`legal:act:${shortName}`, act);
    if (req.query.refresh === 'true') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    } else {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    }
    res.json({ success: true, data: act });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get outline of act (structural metadata, excluding heavy content fields)
router.get('/acts/:shortName/outline', async (req: Request, res: Response) => {
  try {
    const shortName = req.params.shortName as string;
    const cacheKey = `legal:act:outline:${shortName}`;
    if (req.query.refresh !== 'true') {
      const cached = await getCache(cacheKey);
      if (cached) {
        res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
        return res.json({ success: true, data: cached, fromCache: true });
      }
    }

    const act = await BareAct.findOne(
      { shortName },
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

    await setCache(cacheKey, act);
    if (req.query.refresh === 'true') {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    } else {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    }
    res.json({ success: true, data: act });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a specific section
router.get('/acts/:shortName/sections/:sectionNumber', async (req: Request, res: Response) => {
  try {
    const section = await SectionModel.findOne({
      actShortName: req.params.shortName,
      section_number: req.params.sectionNumber
    });
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

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
      content_blocks_hi: section.content_blocks_hi
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
    const sectionNumber = req.params.sectionNumber as string;

    const act = await BareAct.findOne({ shortName }, 'actName shortName');
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    const section = await SectionModel.findOne({ actShortName: shortName, section_number: sectionNumber });
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    // If summary already exists, return it from DB
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
    const sectionNumber = req.params.sectionNumber as string;

    const act = await BareAct.findOne({ shortName }, 'actName shortName');
    if (!act) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Act not found.' })}\n\n`);
      return res.end();
    }

    const section = await SectionModel.findOne({ actShortName: shortName, section_number: sectionNumber });
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

// GET /api/legal/help/categories - Fetch all legal help categories with dynamic counts
router.get('/help/categories', async (req: Request, res: Response) => {
  try {
    const locationStr = (req.query.location as string || 'New Delhi').trim();
    const cacheKey = `legal:help:categories:${locationStr.toLowerCase()}`;

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

    // Handle city aliases dynamically (e.g., Delhi vs New Delhi, Bengaluru vs Bangalore)
    let cityPattern = `^${locationStr}$`;
    const cleanedLoc = locationStr.trim().toLowerCase();
    if (cleanedLoc === 'delhi' || cleanedLoc === 'new delhi') {
      cityPattern = '^(delhi|new delhi)$';
    } else if (cleanedLoc === 'bengaluru' || cleanedLoc === 'bangalore') {
      cityPattern = '^(bengaluru|bangalore)$';
    } else if (cleanedLoc === 'gurgaon' || cleanedLoc === 'gurugram') {
      cityPattern = '^(gurgaon|gurugram)$';
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

    const cacheKey = `legal:help-near-me:${categoryStr.toLowerCase()}:${locationStr.toLowerCase()}:${(stateParam || '').toLowerCase()}`;
    const cachedResult = await getCache(cacheKey);
    if (cachedResult) {
      res.set('Cache-Control', 'public, max-age=300, must-revalidate');
      return res.json({ ...cachedResult, fromCache: true });
    }

    // Resolve state for small villages or towns fallback
    let resolvedState = stateParam;

    const cityToStateMap: Record<string, string> = {
      'ayodhya': 'Uttar Pradesh',
      'lucknow': 'Uttar Pradesh',
      'kanpur': 'Uttar Pradesh',
      'noida': 'Uttar Pradesh',
      'ghaziabad': 'Uttar Pradesh',
      'mumbai': 'Maharashtra',
      'pune': 'Maharashtra',
      'nagpur': 'Maharashtra',
      'bengaluru': 'Karnataka',
      'bangalore': 'Karnataka',
      'mysore': 'Karnataka',
      'chennai': 'Tamil Nadu',
      'coimbatore': 'Tamil Nadu',
      'kolkata': 'West Bengal',
      'darjeeling': 'West Bengal',
      'hyderabad': 'Telangana',
      'ahmedabad': 'Gujarat',
      'surat': 'Gujarat',
      'jaipur': 'Rajasthan',
      'jodhpur': 'Rajasthan',
      'patna': 'Bihar',
      'gaya': 'Bihar',
      'bhopal': 'Madhya Pradesh',
      'indore': 'Madhya Pradesh',
      'ernakulam': 'Kerala',
      'kochi': 'Kerala',
      'trivandrum': 'Kerala',
      'panchkula': 'Haryana',
      'gurugram': 'Haryana',
      'amritsar': 'Punjab',
      'ludhiana': 'Punjab',
      'shimla': 'Himachal Pradesh',
      'dehradun': 'Uttarakhand',
      'nainital': 'Uttarakhand',
      'ranchi': 'Jharkhand',
      'jamshedpur': 'Jharkhand',
      'raipur': 'Chhattisgarh',
      'bilaspur': 'Chhattisgarh',
      'panaji': 'Goa',
      'port blair': 'Andaman & Nicobar',
      'leh': 'Ladakh',
      'kavaratti': 'Lakshadweep',
      'silvassa': 'Dadra & Nagar Haveli',
      'daman': 'Daman & Diu',
      'new delhi': 'Delhi'
    };

    const cleanLoc = locationStr.toLowerCase().trim();
    if (!resolvedState) {
      for (const [city, st] of Object.entries(cityToStateMap)) {
        if (cleanLoc.includes(city)) {
          resolvedState = st;
          break;
        }
      }
    }

    if (!resolvedState) {
      // Look up any resource in this city in database to extract state
      const sample = await LegalResource.findOne({
        city: { $regex: new RegExp(`^${locationStr}$`, 'i') },
        state: { $exists: true }
      }).lean();
      if (sample && sample.state) {
        resolvedState = sample.state;
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

    // Handle city aliases dynamically (e.g., Delhi vs New Delhi, Bengaluru vs Bangalore)
    let cityPattern = `^${locationStr}$`;
    const cleanedLoc = locationStr.trim().toLowerCase();
    if (cleanedLoc === 'delhi' || cleanedLoc === 'new delhi') {
      cityPattern = '^(delhi|new delhi)$';
    } else if (cleanedLoc === 'bengaluru' || cleanedLoc === 'bangalore') {
      cityPattern = '^(bengaluru|bangalore)$';
    } else if (cleanedLoc === 'gurgaon' || cleanedLoc === 'gurugram') {
      cityPattern = '^(gurgaon|gurugram)$';
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

    // Search across all supported acts for matching section numbers or titles
    const supportedActs = ['IPC', 'CrPC', 'IEA', 'BNS', 'BNSS', 'BSA'];
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
    const sectionNumber = req.params.sectionNumber as string;

    const act = await BareAct.findOne({ shortName }, 'actName shortName');
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    const section = await SectionModel.findOne({ actShortName: shortName, section_number: sectionNumber });
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
    const sectionNumber = req.params.sectionNumber as string;

    const act = await BareAct.findOne({ shortName }, 'actName shortName year');
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    const section = await SectionModel.findOne({ actShortName: shortName, section_number: sectionNumber });
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
    const [contentResult, titleResult] = await Promise.all([
      aiService.generateRawContent(contentPrompt),
      aiService.generateRawContent(titlePrompt)
    ]);

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
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const packs = await SavedCasePack.find({ userId: user._id }).sort({ savedAt: -1 }).lean();
    res.json({ success: true, data: packs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/legal/case-packs/sync — Upsert an array of offline Case Packs for user
router.post('/case-packs/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { packs } = req.body;
    if (!Array.isArray(packs) || packs.length === 0) {
      return res.status(400).json({ success: false, message: '"packs" must be a non-empty array.' });
    }

    let synced = 0;
    for (const pack of packs) {
      if (!pack.category || !pack.location) continue;
      await SavedCasePack.findOneAndUpdate(
        { userId: user._id, category: pack.category, location: pack.location },
        {
          userId: user._id,
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
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await SavedCasePack.findOneAndDelete({ _id: req.params.id, userId: user._id });
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