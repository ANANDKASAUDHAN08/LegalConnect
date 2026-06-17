import { Router, Request, Response } from 'express';
import { createClient } from 'redis';
import BareAct, { SectionModel } from '../models/BareAct';
import aiService from '../services/AiService';
import LegalResource from '../models/LegalResource';
import Lawyer from '../models/Lawyer';
import { splitTitle, getParsedContent } from '../utils/textParser';

const router = Router();

// In-Memory Cache Fallback Stores
const searchCache = new Map<string, any>();
const mappingCache = new Map<string, any>();
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

    // Get all act shortNames for context
    const acts = await BareAct.find({}, 'shortName actName');
    const availableActs = acts.map(a => a.shortName);

    const result = await aiService.askLegalQuestion(question.trim(), availableActs);
    res.json({ success: true, ...result });
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
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
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

// GET /api/legal/help-near-me - Find resources, lawyers, helplines & customized roadmap
router.get('/help-near-me', async (req: Request, res: Response) => {
  try {
    const { category, location } = req.query;

    if (!category || !location) {
      return res.status(400).json({ 
        success: false, 
        message: 'Parameters "category" and "location" are required.' 
      });
    }

    const categoryStr = category as string;
    const locationStr = location as string;

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

    const resourceFilter = {
      city: { $regex: new RegExp(`^${locationStr}$`, 'i') },
      $or: [
        { categories: categoryStr },
        { categories: 'General' }
      ]
    };

    const [resources, lawyers] = await Promise.all([
      LegalResource.find(resourceFilter),
      Lawyer.find({
        city: { $regex: new RegExp(`^${locationStr}$`, 'i') },
        specializations: { $regex: specQuery },
        isVerified: true
      }).sort({ rating: -1 }).limit(10)
    ]);

    // 3. Construct category-specific emergency helplines
    const helplines: any[] = [];
    
    // Add general NALSA legal aid helpline to everything
    helplines.push({
      name: 'National Legal Aid Helpline (NALSA)',
      number: '15100',
      description: 'Free legal aid services and counseling available 24/7 across India.'
    });

    if (categoryStr === 'Cyber Crime') {
      helplines.push({
        name: 'National Cyber Crime Helpline',
        number: '1930',
        description: 'Toll-free emergency number to report financial cyber fraud immediately.'
      });
      helplines.push({
        name: 'Emergency Police Support',
        number: '112',
        description: 'National emergency service provider.'
      });
    } else if (categoryStr === 'Domestic Violence' || categoryStr === 'Family Law') {
      helplines.push({
        name: 'National Women Helpline',
        number: '1091',
        description: 'Dedicated helpline for women facing harassment or domestic distress.'
      });
      helplines.push({
        name: 'Women & Child Helpline',
        number: '181',
        description: 'Single contact number for women in distress, functioning 24/7.'
      });
    } else if (categoryStr === 'Consumer Complaint') {
      helplines.push({
        name: 'National Consumer Helpline',
        number: '1915',
        description: 'Government toll-free helpline for consumer grievance registration.'
      });
    } else if (categoryStr === 'Labour Issue') {
      helplines.push({
        name: 'Labour Grievance Cell',
        number: '155214',
        description: 'Shram Suvidha helpline for workers and industrial dispute guidance.'
      });
    }

    // 4. Generate Personalized Legal Roadmap & Lok Adalat guidance
    let roadmap: any = {
      steps: [],
      documents: [],
      onlineLinks: [],
      lokAdalatGuidance: ''
    };

    if (categoryStr === 'Property Dispute') {
      roadmap = {
        steps: [
          { title: 'Verify Title Deeds', detail: 'Verify land ownership records, mutations, and khata entries online or at the local Sub-Registrar Office.' },
          { title: 'Check RERA Status', detail: 'Ensure the property/builder is registered on the state RERA portal. Check for outstanding complaints.' },
          { title: 'Send Legal Notice', detail: 'Issue a formal legal notice to the builder, tenant, or opponent giving them 15 days to respond (use LegalConnect templates).' },
          { title: 'File Conciliation/Suit', detail: 'File a conciliation request in RERA, a civil suit, or file with the Land Revenue Tribunal.' }
        ],
        documents: ['Registered Sale Deed', 'Khata / Mutation Certificate', 'Property Tax Receipts', 'Contract / Builder-Buyer Agreement', 'Notice & Proof of Service'],
        onlineLinks: [
          { name: 'Delhi Land Records (DLRC)', url: 'https://dlrc.delhigovt.nic.in' },
          { name: 'Kaveri Online Services (Karnataka)', url: 'https://kaverionline.karnataka.gov.in' }
        ],
        lokAdalatGuidance: 'Property disputes, partitioning, and tenancy issues are highly suited for Lok Adalat. You can request the court to refer your case to the next Lok Adalat session to resolve it without court fees.'
      };
    } else if (categoryStr === 'Consumer Complaint') {
      roadmap = {
        steps: [
          { title: 'Lodge Grievance at NCH', detail: 'Register a complaint on the National Consumer Helpline portal (1915) to seek corporate resolution.' },
          { title: 'Send Demand Notice', detail: 'Draft and mail a formal notice to the service provider demanding refund/replacement within 15 days.' },
          { title: 'File on e-Daakhil', detail: 'If resolving fails, log in to e-Daakhil and file a formal consumer complaint to the District Consumer Commission.' }
        ],
        documents: ['Purchase Invoice / Receipt', 'Warranty Card / Guarantee Card', 'Written communication / Support emails', 'Photographs of defective product / proof of service deficiency'],
        onlineLinks: [
          { name: 'National Consumer Helpline (NCH)', url: 'https://consumerhelpline.gov.in' },
          { name: 'e-Daakhil Filing Portal', url: 'https://edaakhil.nic.in' }
        ],
        lokAdalatGuidance: 'Consumer cases (especially insurance claims, bank service disputes, and electricity billing issues) are frequently resolved in Lok Adalats with full stamp duty refunds and mutual settlements.'
      };
    } else if (categoryStr === 'Domestic Violence') {
      roadmap = {
        steps: [
          { title: 'Report to Protection Officer', detail: 'Contact a Protection Officer appointed under the DV Act or visit the local Sakhi One Stop Center for immediate support.' },
          { title: 'Seek Medical Aid & Logs', detail: 'If there is physical injury, visit a government hospital for a medical examination and obtain a medico-legal report.' },
          { title: 'File a DIR (Domestic Incident Report)', detail: 'Lodge a complaint under Section 12 of the DV Act in Family Court or file an FIR in the local police cell.' }
        ],
        documents: ['Incident timeline with dates', 'Medical/physical injury reports', 'Chat history, audio clips, or videos of incidents', 'Proof of residence/joint assets'],
        onlineLinks: [
          { name: 'National Commission for Women (NCW)', url: 'http://ncw.nic.in' },
          { name: 'Sakhi One Stop Center WCD Directory', url: 'https://wcd.nic.in' }
        ],
        lokAdalatGuidance: 'Matrimonial disputes and family maintenance issues can be referred to court-annexed mediation centers. Only compoundable offenses can be referred to Lok Adalats.'
      };
    } else if (categoryStr === 'Cyber Crime') {
      roadmap = {
        steps: [
          { title: 'Freeze Accounts immediately', detail: 'In case of financial fraud, notify your bank immediately (within 2 hours) to freeze cards and reverse transactions.' },
          { title: 'Preserve Digital Evidence', detail: 'Take screenshots of chat history, website URLs, phone numbers, fake profiles, and bank SMS transaction alerts.' },
          { title: 'File Online Cyber Complaint', detail: 'Register your complaint at cybercrime.gov.in or report to the nearest dedicated Cyber Crime Police Cell.' }
        ],
        documents: ['Screenshots of communication / phishing links', 'Bank transaction statement / debit SMS alerts', 'Email headers of suspicious emails', 'ID Proof of the victim'],
        onlineLinks: [
          { name: 'National Cyber Crime Reporting Portal', url: 'https://cybercrime.gov.in' },
          { name: 'RBI Ombudsman Portal', url: 'https://cms.rbi.org.in' }
        ],
        lokAdalatGuidance: 'While core cyber crimes are non-compoundable, secondary financial recoveries against banks or merchants for unauthorized transactions can be settled in Lok Adalats.'
      };
    } else if (categoryStr === 'Labour Issue') {
      roadmap = {
        steps: [
          { title: 'Submit Grievance online', detail: 'File a grievance on the Ministry of Labour Shram Suvidha portal or EPFO Portal.' },
          { title: 'Initiate Conciliation', detail: 'Submit a petition to the Assistant Labour Commissioner (ALC) to initiate conciliation proceedings with your employer.' },
          { title: 'Approach Labour Court', detail: 'If conciliation fails, request a referral from the ALC to present your case before the Labour Court.' }
        ],
        documents: ['Offer Letter / Employment Contract', 'Salary Slips (last 6 months) & Bank statement', 'Termination notice / Show Cause Letter', 'Appraisal records / Performance emails'],
        onlineLinks: [
          { name: 'Shram Suvidha Portal', url: 'https://shramsuvidha.gov.in' },
          { name: 'EPFO Grievances Portal', url: 'https://epfigms.gov.in' }
        ],
        lokAdalatGuidance: 'Labour disputes involving unpaid wages, gratuity, retrenchment compensation, or reinstatement benefits are routinely referred to Lok Adalats for quick cash settlements.'
      };
    } else {
      // General Fallback
      roadmap = {
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
    }

    res.json({
      success: true,
      category: categoryStr,
      location: locationStr,
      roadmap,
      helplines,
      resources,
      lawyers
    });

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

export default router;