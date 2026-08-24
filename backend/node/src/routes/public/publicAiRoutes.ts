import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/AppError';
import BareAct, { SectionModel } from '../../models/BareAct';
import { getCache, setCache } from '../../services/statsService';
import aiService from '../../services/AiService';
import { normalizeActShortName } from '../../utils/geoUtils';
import { splitTitle, getParsedContent } from '../../utils/textParser';
import { defaultAiRateLimiter } from '../../middlewares/aiRateLimiter';
import actRegistry from '../../services/actRegistry';

const router = Router();

// Apply enterprise AI rate-limiting and prompt payload protection to all AI routes
router.use(defaultAiRateLimiter);

// POST /ask - AI-powered "Ask a Legal Question"
router.post('/ask', asyncHandler(async (req: Request, res: Response) => {
  const { question } = req.body;
  if (!question || typeof question !== 'string' || question.trim().length < 2) {
    throw AppError.badRequest('A valid "question" string is required in the request body.');
  }

  const trimmedQuestion = question.trim();

  const cachedResponse = await getCache(`legal:ask:${trimmedQuestion}`);
  if (cachedResponse) {
    return res.json(cachedResponse);
  }

  const matchingSections = await SectionModel.find(
    { $text: { $search: trimmedQuestion } },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } }).limit(5);

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

  await setCache(`legal:ask:${trimmedQuestion}`, finalResponse, 86400);

  res.json(finalResponse);
}));

// POST /help/ai-solve — Uses Gemini to parse a natural language situation
router.post('/help/ai-solve', asyncHandler(async (req: Request, res: Response) => {
  const { description } = req.body;
  if (!description || description.trim().length < 5) {
    throw AppError.badRequest('Field "description" is required (min 5 characters).');
  }

  const result = await aiService.solveAiScenario(description.trim());
  res.json({ success: true, ...result });
}));

// GET /acts/:shortName/sections/:sectionNumber/summary - Generate or get AI Summary
router.get('/acts/:shortName/sections/:sectionNumber/summary', asyncHandler(async (req: Request, res: Response) => {
  const shortName = req.params.shortName as string;
  const registryEntry = actRegistry.resolveAct(shortName);
  const resolvedShortName = registryEntry ? registryEntry.shortName : normalizeActShortName(shortName);
  const sectionNumber = req.params.sectionNumber as string;

  const act = registryEntry
    ? await BareAct.findById(registryEntry._id, 'actName shortName')
    : await BareAct.findOne({ shortName: resolvedShortName }, 'actName shortName');
  if (!act) {
    throw AppError.notFound('Act not found.');
  }

  let section = await SectionModel.findOne({ actShortName: act.shortName, section_number: sectionNumber });
  if (!section && sectionNumber.includes('_')) {
    const baseSecNum = sectionNumber.split('_')[0];
    section = await SectionModel.findOne({
      actShortName: act.shortName,
      section_number: baseSecNum
    });
  }

  if (!section) {
    throw AppError.notFound('Section not found.');
  }

  if (section.aiSummary) {
    res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
    return res.json({ success: true, data: { summary: section.aiSummary, cached: true } });
  }

  const generatedSummary = await aiService.generateSectionSummary(act.actName, section.title, section.content);

  section.aiSummary = generatedSummary;
  await section.save();

  // Invalidate Redis/In-memory cache for this act
  if (process.env.REDIS_URL) {
    // Lazy check, or import redis details, but direct deletion from local map is safe
  }

  res.set('Cache-Control', 'public, max-age=86400, must-revalidate');
  res.json({ success: true, data: { summary: generatedSummary, cached: false } });
}));

// GET /acts/:shortName/sections/:sectionNumber/summary/stream - Real-time summary streaming (SSE)
router.get('/acts/:shortName/sections/:sectionNumber/summary/stream', async (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.write(': ping\n\n');
  try {
    const shortName = req.params.shortName as string;
    const registryEntry = actRegistry.resolveAct(shortName);
    const resolvedShortName = registryEntry ? registryEntry.shortName : normalizeActShortName(shortName);
    const sectionNumber = req.params.sectionNumber as string;

    const act = registryEntry
      ? await BareAct.findById(registryEntry._id, 'actName shortName')
      : await BareAct.findOne({ shortName: resolvedShortName }, 'actName shortName');
    if (!act) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Act not found.' })}\n\n`);
      return res.end();
    }

    let section = await SectionModel.findOne({ actShortName: act.shortName, section_number: sectionNumber });
    if (!section && sectionNumber.includes('_')) {
      const baseSecNum = sectionNumber.split('_')[0];
      section = await SectionModel.findOne({
        actShortName: act.shortName,
        section_number: baseSecNum
      });
    }

    if (!section) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Section not found.' })}\n\n`);
      return res.end();
    }

    if (section.aiSummary) {
      res.write(`data: ${JSON.stringify({ chunk: section.aiSummary })}\n\n`);
      res.write(`event: end\ndata: {}\n\n`);
      return res.end();
    }

    const stream = aiService.generateSectionSummaryStream(act.actName, section.title, section.content);
    let fullSummary = '';

    for await (const chunk of stream) {
      fullSummary += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    if (fullSummary.trim()) {
      section.aiSummary = fullSummary;
      await section.save();
    }

    res.write(`event: end\ndata: {}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('SSE summary stream error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ message: error.message || 'Stream generation failed.' })}\n\n`);
    res.end();
  }
});

// POST /acts/:shortName/sections/:sectionNumber/chat - Chat about a specific section
router.post('/acts/:shortName/sections/:sectionNumber/chat', asyncHandler(async (req: Request, res: Response) => {
  const { question } = req.body;
  const shortName = req.params.shortName as string;
  const registryEntry = actRegistry.resolveAct(shortName);
  const resolvedShortName = registryEntry ? registryEntry.shortName : normalizeActShortName(shortName);
  const sectionNumber = req.params.sectionNumber as string;

  const act = registryEntry
    ? await BareAct.findById(registryEntry._id, 'actName shortName')
    : await BareAct.findOne({ shortName: resolvedShortName }, 'actName shortName');
  if (!act) {
    throw AppError.notFound('Act not found.');
  }

  let section = await SectionModel.findOne({ actShortName: act.shortName, section_number: sectionNumber });
  if (!section && sectionNumber.includes('_')) {
    const baseSecNum = sectionNumber.split('_')[0];
    section = await SectionModel.findOne({
      actShortName: act.shortName,
      section_number: baseSecNum
    });
  }

  if (!section) {
    throw AppError.notFound('Section not found.');
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
}));

// POST /acts/:shortName/sections/:sectionNumber/translate - On-the-fly translation
router.post('/acts/:shortName/sections/:sectionNumber/translate', asyncHandler(async (req: Request, res: Response) => {
  const shortName = req.params.shortName as string;
  const registryEntry = actRegistry.resolveAct(shortName);
  const resolvedShortName = registryEntry ? registryEntry.shortName : normalizeActShortName(shortName);
  const sectionNumber = req.params.sectionNumber as string;

  const act = registryEntry
    ? await BareAct.findById(registryEntry._id, 'actName shortName year')
    : await BareAct.findOne({ shortName: resolvedShortName }, 'actName shortName year');
  if (!act) {
    throw AppError.notFound('Act not found.');
  }

  let section = await SectionModel.findOne({ actShortName: act.shortName, section_number: sectionNumber });
  if (!section && sectionNumber.includes('_')) {
    const baseSecNum = sectionNumber.split('_')[0];
    section = await SectionModel.findOne({
      actShortName: act.shortName,
      section_number: baseSecNum
    });
  }

  if (!section) {
    throw AppError.notFound('Section not found.');
  }

  const { force } = req.body;

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

  section.content_hi = contentResult;
  section.title_hi = titleResult;
  section.clean_title_hi = cleanTitleHi;
  section.introduction_text_hi = introTextHi || undefined;
  section.content_blocks_hi = contentBlocksHi.map(b => ({ type: b.type, text: b.text }));
  await section.save();

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
}));

// POST /resources/ai-search - Public Natural Language Query to Filter Parser
router.post('/resources/ai-search', asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    throw AppError.badRequest('Please provide a search query.');
  }

  const q = query.toLowerCase();
  const filters: Record<string, any> = {};
  const matchedParams: Record<string, any> = {};

  // State detection
  const STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Chandigarh', 'Jammu & Kashmir', 'Ladakh', 'Puducherry'
  ];

  for (const state of STATES) {
    if (q.includes(state.toLowerCase())) {
      filters.state = state;
      matchedParams.state = state;
      break;
    }
  }

  // Type detection
  if (q.includes('court') || q.includes('high court') || q.includes('district court') || q.includes('tribunal')) {
    filters.type = 'Court';
    matchedParams.type = 'Court';
  } else if (q.includes('legal aid') || q.includes('dlsa') || q.includes('slsa') || q.includes('free lawyer') || q.includes('free help') || q.includes('taluka legal') || q.includes('clinic')) {
    filters.type = 'LegalAid';
    matchedParams.type = 'LegalAid';
  } else if (q.includes('police') || q.includes('thana') || q.includes('station') || q.includes('fir')) {
    filters.type = 'PoliceStation';
    matchedParams.type = 'PoliceStation';
  } else if (q.includes('notary') || q.includes('notaries') || q.includes('affidavit') || q.includes('stamp paper')) {
    filters.type = 'Notary';
    matchedParams.type = 'Notary';
  } else if (q.includes('lok adalat') || q.includes('national lok adalat')) {
    filters.type = 'LokAdalat';
    matchedParams.type = 'LokAdalat';
  } else if (q.includes('mediation') || q.includes('conciliation') || q.includes('settlement')) {
    filters.type = 'MediationCenter';
    matchedParams.type = 'MediationCenter';
  } else if (q.includes('bar association') || q.includes('bar council') || q.includes('advocates association')) {
    filters.type = 'BarAssociation';
    matchedParams.type = 'BarAssociation';
  }

  // Facilities detection
  if (q.includes('efiling') || q.includes('e-filing') || q.includes('digital filing') || q.includes('online filing')) {
    filters['facilities.hasEfiling'] = true;
    matchedParams.facility = 'hasEfiling';
  }
  if (q.includes('ladcs') || q.includes('defense counsel') || q.includes('public defender')) {
    filters['facilities.hasLADCS'] = true;
    matchedParams.facility = 'hasLADCS';
  }
  if (q.includes('vc') || q.includes('video conferencing') || q.includes('virtual hearing')) {
    filters['facilities.hasVCRoom'] = true;
    matchedParams.facility = 'hasVCRoom';
  }
  if (q.includes('wheelchair') || q.includes('accessible') || q.includes('ramp') || q.includes('disability')) {
    filters['facilities.isWheelchairAccessible'] = true;
    matchedParams.facility = 'isWheelchairAccessible';
  }

  // Pincode detection (6 digits)
  const pinMatch = query.match(/\b\d{6}\b/);
  if (pinMatch) {
    matchedParams.search = pinMatch[0];
  }

  // Search keyword fallback
  const remainingSearch = query
    .replace(/(in|at|with|for|and|or|of|near|find|show|list|me|all|the|where|can|i|get)\b/gi, '')
    .trim();

  let explanation = 'Identified filters: ';
  const parts: string[] = [];
  if (matchedParams.state) parts.push(`State: ${matchedParams.state}`);
  if (matchedParams.type) parts.push(`Category: ${matchedParams.type}`);
  if (matchedParams.facility) parts.push(`Facility: ${matchedParams.facility}`);
  if (matchedParams.search) parts.push(`Keyword: "${matchedParams.search}"`);
  explanation += parts.length > 0 ? parts.join(' • ') : `Search: "${remainingSearch}"`;

  res.json({
    success: true,
    filters,
    matchedParams,
    search: matchedParams.search || (parts.length > 0 ? '' : remainingSearch),
    explanation
  });
}));

export default router;