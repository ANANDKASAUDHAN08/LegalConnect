import { Router, Request, Response } from 'express';
import { createClient } from 'redis';
import BareAct from '../models/BareAct';
import aiService from '../services/AiService';

const router = Router();

// In-Memory Cache Fallback Stores
const searchCache = new Map<string, any>();
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
  }
}

// Semantic/Keyword search across all laws
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

    // Using MongoDB $text index for fast full-text search
    const results = await BareAct.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } }).limit(10);

    const sanitizedResults = results.map(act => ({
      _id: act._id,
      actName: act.actName,
      shortName: act.shortName,
      year: act.year,
      description: act.description,
      chapters: act.chapters.map(ch => ({
        chapterNumber: ch.chapterNumber,
        title: ch.title,
        sectionsCount: ch.sections.length
      }))
    }));

    const finalResponse = { success: true, count: sanitizedResults.length, data: sanitizedResults };
    await setCache(`legal:search:${cacheKey}`, finalResponse, 3600); // cache search results for 1 hour

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
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
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
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    res.json({ success: true, data: act });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get a specific section
router.get('/acts/:shortName/sections/:sectionNumber', async (req: Request, res: Response) => {
  try {
    const act = await BareAct.findOne({ shortName: req.params.shortName });
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    let foundSection = null;
    for (const chapter of act.chapters) {
      const section = chapter.sections.find(s => s.section_number === req.params.sectionNumber);
      if (section) {
        foundSection = {
          chapter: chapter.title,
          section_number: section.section_number,
          title: section.title,
          content: section.content,
          aiSummary: section.aiSummary
        };
        break;
      }
    }

    if (!foundSection) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    res.json({ success: true, data: foundSection });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate or get AI Summary
router.get('/acts/:shortName/sections/:sectionNumber/summary', async (req: Request, res: Response) => {
  try {
    const act = await BareAct.findOne({ shortName: req.params.shortName });
    if (!act) {
      return res.status(404).json({ success: false, message: 'Act not found.' });
    }

    let targetSection: any = null;
    let targetChapterIndex = -1;
    let targetSectionIndex = -1;

    for (let i = 0; i < act.chapters.length; i++) {
      for (let j = 0; j < act.chapters[i].sections.length; j++) {
        if (act.chapters[i].sections[j].section_number === req.params.sectionNumber) {
          targetSection = act.chapters[i].sections[j];
          targetChapterIndex = i;
          targetSectionIndex = j;
          break;
        }
      }
      if (targetSection) break;
    }

    if (!targetSection) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    // If summary already exists, return it from DB
    if (targetSection.aiSummary) {
      res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
      return res.json({ success: true, data: { summary: targetSection.aiSummary, cached: true } });
    }

    // Call AI Service
    const generatedSummary = await aiService.generateSectionSummary(act.actName, targetSection.title, targetSection.content);

    // Save back to DB
    act.chapters[targetChapterIndex].sections[targetSectionIndex].aiSummary = generatedSummary;
    // Mark modified for deeply nested arrays
    act.markModified(`chapters.${targetChapterIndex}.sections.${targetSectionIndex}.aiSummary`);
    await act.save();

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

    const act = await BareAct.findOne({ shortName });
    if (!act) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Act not found.' })}\n\n`);
      return res.end();
    }

    let targetSection: any = null;
    let targetChapterIndex = -1;
    let targetSectionIndex = -1;

    for (let i = 0; i < act.chapters.length; i++) {
      for (let j = 0; j < act.chapters[i].sections.length; j++) {
        if (act.chapters[i].sections[j].section_number === sectionNumber) {
          targetSection = act.chapters[i].sections[j];
          targetChapterIndex = i;
          targetSectionIndex = j;
          break;
        }
      }
      if (targetSection) break;
    }

    if (!targetSection) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Section not found.' })}\n\n`);
      return res.end();
    }

    // If summary already exists in DB, stream it back directly in one chunk
    if (targetSection.aiSummary) {
      res.write(`data: ${JSON.stringify({ chunk: targetSection.aiSummary })}\n\n`);
      res.write(`event: end\ndata: {}\n\n`);
      return res.end();
    }

    // Generate summary stream from AI Service
    const stream = aiService.generateSectionSummaryStream(act.actName, targetSection.title, targetSection.content);
    let fullSummary = '';

    for await (const chunk of stream) {
      fullSummary += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    // Save generated summary back to DB
    if (fullSummary.trim()) {
      act.chapters[targetChapterIndex].sections[targetSectionIndex].aiSummary = fullSummary;
      act.markModified(`chapters.${targetChapterIndex}.sections.${targetSectionIndex}.aiSummary`);
      await act.save();

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

export default router;