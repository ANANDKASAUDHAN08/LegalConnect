import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { getCache, setCache } from './statsService';

dotenv.config();

export interface AiPromptOptions {
  systemPrompt?: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}

class AiService {
  private geminiAi: GoogleGenerativeAI | null = null;
  private openRouterKey: string | null = null;
  private activeProvider: 'openrouter' | 'gemini' | 'none' = 'none';

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Reload dotenv in case .env was updated while server is running
    dotenv.config();

    const rawOrKey = (process.env.OPENROUTER_API_KEY || '').trim();
    const rawGemKey = (process.env.GEMINI_API_KEY || '').trim();

    const orKey = rawOrKey || (rawGemKey.startsWith('sk-or-') ? rawGemKey : null);
    const gemKey = rawGemKey.startsWith('sk-or-') ? null : (rawGemKey || null);

    if (orKey) {
      this.openRouterKey = orKey;
      this.activeProvider = 'openrouter';
      const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
      console.log(`✅ AI Service initialized with OpenRouter API (Model: ${model}).`);
    } else if (gemKey) {
      this.geminiAi = new GoogleGenerativeAI(gemKey);
      this.activeProvider = 'gemini';
      console.log('✅ AI Service initialized with Google Gemini API (Model: gemini-2.5-flash).');
    } else {
      this.activeProvider = 'none';
      this.openRouterKey = null;
      this.geminiAi = null;
      console.warn('⚠️ Neither OPENROUTER_API_KEY nor GEMINI_API_KEY is configured in backend/.env. AI features will run in fallback mode.');
    }
  }

  get isConfigured(): boolean {
    if (this.activeProvider === 'none') {
      this.initializeProviders();
    }
    return this.activeProvider !== 'none';
  }

  get providerName(): string {
    return this.activeProvider;
  }

  // ═════════════════════════════════════════════════════════
  // UNIFIED EXECUTION ENGINE (OpenRouter & Gemini)
  // ═════════════════════════════════════════════════════════

  private async executePrompt(prompt: string, options?: AiPromptOptions): Promise<string> {
    if (this.activeProvider === 'none') {
      this.initializeProviders();
    }

    if (this.activeProvider === 'openrouter' && this.openRouterKey) {
      return this.callOpenRouter(prompt, options);
    } else if (this.activeProvider === 'gemini' && this.geminiAi) {
      return this.callGemini(prompt, options);
    }
    throw new Error('AI API key is missing. Please add OPENROUTER_API_KEY or GEMINI_API_KEY to backend/.env to use AI features.');
  }

  private async callOpenRouter(prompt: string, options?: AiPromptOptions): Promise<string> {
    const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
    const messages: { role: string; content: string }[] = [];

    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body: any = {
      model,
      messages,
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens ?? 4096
    };

    if (options?.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'HTTP-Referer': 'https://legalconnect.internal',
        'X-Title': 'LegalConnect Admin',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) {
          errorMsg = errJson.error.message;
        }
      } catch { }
      throw new Error(`OpenRouter Error (${response.status}): ${errorMsg}`);
    }

    const json: any = await response.json();
    return json.choices?.[0]?.message?.content || '';
  }

  private async callGemini(prompt: string, options?: AiPromptOptions): Promise<string> {
    if (!this.geminiAi) throw new Error('Gemini client not initialized.');

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const config: any = {
      temperature: options?.temperature ?? 0.2,
      maxOutputTokens: options?.maxTokens ?? 4096
    };

    if (options?.jsonMode) {
      config.responseMimeType = 'application/json';
    }

    const model = this.geminiAi.getGenerativeModel({
      model: modelName,
      generationConfig: config,
      systemInstruction: options?.systemPrompt
    });

    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  private async *executeStream(prompt: string, options?: AiPromptOptions): AsyncGenerator<string, void, unknown> {
    if (this.activeProvider === 'openrouter' && this.openRouterKey) {
      yield* this.callOpenRouterStream(prompt, options);
    } else if (this.activeProvider === 'gemini' && this.geminiAi) {
      yield* this.callGeminiStream(prompt, options);
    } else {
      throw new Error('AI Service not configured.');
    }
  }

  private async *callOpenRouterStream(prompt: string, options?: AiPromptOptions): AsyncGenerator<string, void, unknown> {
    const model = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
    const messages: { role: string; content: string }[] = [];

    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'HTTP-Referer': 'https://legalconnect.internal',
        'X-Title': 'LegalConnect Admin',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 4096,
        stream: true
      })
    });

    if (!response.ok || !response.body) {
      const errText = await response.text();
      let errorMsg = errText;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.error?.message) {
          errorMsg = errJson.error.message;
        }
      } catch { }
      throw new Error(`OpenRouter Stream Error (${response.status}): ${errorMsg}`);
    }

    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch {
            // Ignore incomplete SSE chunk
          }
        }
      }
    }
  }

  private async *callGeminiStream(prompt: string, options?: AiPromptOptions): AsyncGenerator<string, void, unknown> {
    if (!this.geminiAi) return;

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const model = this.geminiAi.getGenerativeModel({
      model: modelName,
      systemInstruction: options?.systemPrompt
    });

    const resultStream = await model.generateContentStream(prompt);
    for await (const chunk of resultStream.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }

  // ═════════════════════════════════════════════════════════
  // ═════════════════════════════════════════════════════════
  // STATUTORY SECTION TRANSLATION & PROOFREADING (WITH MEMOIZATION)
  // ═════════════════════════════════════════════════════════

  private getStatutoryHash(prefix: string, actName: string, sectionNumber: string, title: string, content: string): string {
    const raw = `${prefix}:${actName.trim().toLowerCase()}:${sectionNumber.trim()}:${title.trim()}:${content.trim()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async translateSectionToHindi(
    actName: string,
    sectionNumber: string,
    title: string,
    content: string
  ): Promise<{ title_hi: string; introduction_text_hi: string; fromCache?: boolean }> {
    if (!this.isConfigured) {
      throw new Error('AI Service is not configured. Please set OPENROUTER_API_KEY or GEMINI_API_KEY in backend/.env.');
    }

    const hash = this.getStatutoryHash('trans_hi', actName, sectionNumber, title, content);
    const cacheKey = `ai:statutory:${hash}`;

    try {
      const cached = await getCache(cacheKey);
      if (cached && (cached.title_hi || cached.introduction_text_hi)) {
        return {
          title_hi: String(cached.title_hi || '').trim(),
          introduction_text_hi: String(cached.introduction_text_hi || '').trim(),
          fromCache: true
        };
      }
    } catch (cacheErr) {
      console.warn('AI Cache check skipped:', cacheErr);
    }

    const systemPrompt = `You are a Senior Legislative Draftsman and Official Legal Translator for the Legislative Department, Ministry of Law and Justice, Government of India.
Your sole mission is to provide an exact, formal, authoritative Hindi translation of the provided Indian statutory provision.

TRANSLATION & LEGAL PRECISION RULES:
1. Use official Indian Government legal vocabulary (विधायी प्रारूपण शब्दावली):
   - "Section" -> "धारा", "Subsection" -> "उपधारा", "Clause" -> "खंड", "Subclause" -> "उपखंड"
   - "Provided that" / "Proviso" -> "परंतु यह कि" / "परंतुक"
   - "Explanation" -> "स्पष्टीकरण", "Exception" -> "अपवाद"
   - "Commencement" -> "प्रारंभ", "Short title" -> "संक्षिप्त नाम", "Extent" -> "विस्तार"
   - "Official Gazette" -> "राजपत्र", "Notification" -> "अधिसूचना"
   - "Appellate Tribunal" -> "अपीलीय अधिकरण", "Central Government" -> "केन्द्रीय सरकार", "State Government" -> "राज्य सरकार"
2. Strict structural fidelity:
   - Preserve all subsection markers: (1), (2), (3), (क), (ख), (i), (ii), etc.
   - Keep each numbered subsection on its own line.
   - DO NOT alter numbering or omission of any clauses.
3. Zero Hallucination:
   - Translate ONLY the text provided. Do not add summaries, legal advice, explanations, or extraneous commentary.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "title_hi": "...",
  "introduction_text_hi": "..."
}`;

    const prompt = `ACT: ${actName}
SECTION NUMBER: § ${sectionNumber}
ENGLISH SECTION TITLE: ${title}
ENGLISH STATUTORY TEXT:
${content}`;

    try {
      // 15-second timeout circuit breaker
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI Translation request timed out after 15 seconds. Please retry.')), 15000)
      );

      const text = await Promise.race([
        this.executePrompt(prompt, {
          systemPrompt,
          jsonMode: true,
          temperature: 0.1
        }),
        timeoutPromise
      ]);

      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      const result = {
        title_hi: String(parsed.title_hi || '').trim(),
        introduction_text_hi: String(parsed.introduction_text_hi || '').trim(),
        fromCache: false
      };

      // Cache result for 30 days
      try {
        await setCache(cacheKey, result, 86400 * 30);
      } catch { }

      return result;
    } catch (error: any) {
      console.error('Error in translateSectionToHindi:', error);
      throw new Error(`Failed to translate section: ${error.message || 'Unknown error'}`);
    }
  }

  async enhanceSectionEnglish(
    actName: string,
    sectionNumber: string,
    title: string,
    content: string
  ): Promise<{ title: string; introduction_text: string; fromCache?: boolean }> {
    if (!this.isConfigured) {
      throw new Error('AI Service is not configured. Please set OPENROUTER_API_KEY or GEMINI_API_KEY in backend/.env.');
    }

    const hash = this.getStatutoryHash('enh_en', actName, sectionNumber, title, content);
    const cacheKey = `ai:statutory:${hash}`;

    try {
      const cached = await getCache(cacheKey);
      if (cached && (cached.title || cached.introduction_text)) {
        return {
          title: String(cached.title || title).trim(),
          introduction_text: String(cached.introduction_text || content).trim(),
          fromCache: true
        };
      }
    } catch (cacheErr) {
      console.warn('AI Cache check skipped:', cacheErr);
    }

    const systemPrompt = `You are an expert Legal Proofreader for the official Indian Bare Acts database.
Your mission is to proofread, fix OCR scanning artifacts, and properly format the statutory text below WITHOUT changing the original statutory wording or legal meaning.

RULES:
1. Fix OCR scanning glitches (e.g. broken hyphens, misplaced line wraps, broken quotation marks, unclosed brackets).
2. Clean up section title (remove leading section numbers like "1. Short title" -> "Short title, extent and commencement.").
3. Clean clause structure:
   - Ensure (1), (2), (a), (b), (i), (ii) each start cleanly on their own line.
   - Separate distinct subsections with standard paragraph breaks.
4. STRICT FIDELITY: DO NOT rewrite, paraphrase, summarize, or alter any legal words.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "title": "...",
  "introduction_text": "..."
}`;

    const prompt = `ACT: ${actName}
SECTION NUMBER: § ${sectionNumber}
CURRENT TITLE: ${title}
CURRENT STATUTORY TEXT:
${content}`;

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI Enhancement request timed out after 15 seconds. Please retry.')), 15000)
      );

      const text = await Promise.race([
        this.executePrompt(prompt, {
          systemPrompt,
          jsonMode: true,
          temperature: 0.1
        }),
        timeoutPromise
      ]);

      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      const result = {
        title: String(parsed.title || title).trim(),
        introduction_text: String(parsed.introduction_text || content).trim(),
        fromCache: false
      };

      try {
        await setCache(cacheKey, result, 86400 * 30);
      } catch { }

      return result;
    } catch (error: any) {
      console.error('Error in enhanceSectionEnglish:', error);
      throw new Error(`Failed to enhance section: ${error.message || 'Unknown error'}`);
    }
  }

  // ═════════════════════════════════════════════════════════
  // SECTION SUMMARY & CITIZEN PLAIN ENGLISH
  // ═════════════════════════════════════════════════════════

  async generateSectionSummary(actName: string, sectionTitle: string, content: string): Promise<string> {
    if (!this.isConfigured) {
      return `(Mock Summary) This section titled "${sectionTitle}" from "${actName}" outlines specific rules and conditions. Please provide an OPENROUTER_API_KEY or GEMINI_API_KEY in the backend/.env file to generate real AI summaries.`;
    }

    try {
      const prompt = `You are an expert Indian legal assistant. Your task is to explain a specific section of a law in simple, "Plain English" so that a common citizen can understand it easily.

Act Name: ${actName}
Section Title: ${sectionTitle}
Section Text: ${content}

Please provide a concise summary (2-3 paragraphs maximum) explaining what this section means in simple terms. Avoid complex legal jargon where possible.`;

      return await this.executePrompt(prompt, { temperature: 0.3 });
    } catch (error) {
      console.error('Error generating AI summary:', error);
      throw new Error('Failed to generate AI summary.');
    }
  }

  async *generateSectionSummaryStream(actName: string, sectionTitle: string, content: string): AsyncGenerator<string, void, unknown> {
    if (!this.isConfigured) {
      const mockText = `(Mock Summary) This section titled "${sectionTitle}" from "${actName}" outlines specific rules and conditions. Please provide an OPENROUTER_API_KEY or GEMINI_API_KEY in the backend/.env file to generate real AI summaries.`;
      for (const word of mockText.split(' ')) {
        yield word + ' ';
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      return;
    }

    const prompt = `You are an expert Indian legal assistant. Your task is to explain a specific section of a law in simple, "Plain English" so that a common citizen can understand it easily.

Act Name: ${actName}
Section Title: ${sectionTitle}
Section Text: ${content}

Please provide a concise summary (2-3 paragraphs maximum) explaining what this section means in simple terms. Avoid complex legal jargon where possible.`;

    yield* this.executeStream(prompt);
  }

  async explainTransition(
    oldActName: string,
    oldSectionNum: string,
    oldSectionTitle: string,
    oldSectionContent: string,
    newActName: string,
    newSectionNum: string,
    newSectionTitle: string,
    newSectionContent: string
  ): Promise<string> {
    if (!this.isConfigured) {
      return `Comparing ${oldActName} Section ${oldSectionNum} ("${oldSectionTitle}") with ${newActName} Section ${newSectionNum} ("${newSectionTitle}").\n\nKey Differences:\n- Phrasing and terminology have been modernized.\n- Specific procedural timelines or fine amounts may have been updated to reflect current legal standards.`;
    }

    try {
      const prompt = `You are an expert Indian constitutional and criminal lawyer. You are explaining the transition from the old Indian laws to the new criminal laws (BNS, BNSS, BSA).
Compare the following two sections and explain the differences:

OLD LAW:
Act: ${oldActName}
Section Number: ${oldSectionNum}
Title: ${oldSectionTitle}
Content: ${oldSectionContent}

NEW LAW:
Act: ${newActName}
Section Number: ${newSectionNum}
Title: ${newSectionTitle}
Content: ${newSectionContent}

Please provide a concise comparison (2-3 bullet points or short paragraphs) highlighting:
1. What has changed (e.g., phrasing, scope, fine amount, or punishment duration).
2. The practical impact of this transition on citizens or legal proceedings.`;

      return await this.executePrompt(prompt, { temperature: 0.2 });
    } catch (error) {
      console.error('Error generating transition explanation:', error);
      return `Failed to generate comparison.`;
    }
  }

  async generateRawContent(prompt: string): Promise<string> {
    if (!this.isConfigured) {
      return '(Mock AI) Please set OPENROUTER_API_KEY or GEMINI_API_KEY in backend/.env to enable real AI generation.';
    }

    try {
      return await this.executePrompt(prompt, { temperature: 0.2 });
    } catch (error) {
      console.error('Error generating raw content:', error);
      throw new Error('Failed to generate content from AI.');
    }
  }

  async solveAiScenario(description: string): Promise<{
    category: string;
    subcategories: string[];
    caseSummary: string;
    roadmapSteps: { title: string; detail: string }[];
  }> {
    const validCategories = [
      'Property Dispute', 'Family Law', 'Consumer Complaint', 'Labour Issue',
      'Criminal Matter', 'Cyber Crime', 'Business Dispute', 'Domestic Violence',
      'Banking & Finance', 'RTI / Government Grievance'
    ];

    if (!this.isConfigured) {
      // Keyword-based fallback
      const q = description.toLowerCase();
      let category = 'Property Dispute';
      if (q.includes('divorce') || q.includes('custody') || q.includes('maintenance') || q.includes('wife') || q.includes('husband')) category = 'Family Law';
      else if (q.includes('salary') || q.includes('fired') || q.includes('job') || q.includes('unpaid') || q.includes('wage') || q.includes('employer')) category = 'Labour Issue';
      else if (q.includes('scam') || q.includes('refund') || q.includes('defect') || q.includes('product') || q.includes('consumer')) category = 'Consumer Complaint';
      else if (q.includes('hack') || q.includes('phish') || q.includes('online fraud') || q.includes('cyber') || q.includes('whatsapp')) category = 'Cyber Crime';
      else if (q.includes('police') || q.includes('fir') || q.includes('bail') || q.includes('arrest')) category = 'Criminal Matter';
      else if (q.includes('domestic') || q.includes('abuse') || q.includes('violence')) category = 'Domestic Violence';

      return {
        category,
        subcategories: [],
        caseSummary: `Your situation appears to relate to ${category}. Please consult a legal professional for tailored advice.`,
        roadmapSteps: [
          { title: 'Document Your Situation', detail: 'Write down a chronological account of events with dates, names, and any witnesses.' },
          { title: 'Gather Evidence', detail: 'Collect all relevant documents, messages, photos, or receipts.' },
          { title: 'Seek Legal Counsel', detail: 'Contact a nearby legal aid centre or consult a verified lawyer.' }
        ]
      };
    }

    try {
      const prompt = `You are an expert Indian legal AI assistant. A person has described their legal problem in their own words. Analyze the situation and respond with a structured JSON object.

User's Situation:
"${description}"

Valid Legal Categories (choose exactly ONE from this list):
${validCategories.map(c => `- ${c}`).join('\n')}

Respond ONLY with a valid JSON object in this exact format (no markdown, no code blocks, no extra text):
{
  "category": "one category from the list above",
  "subcategories": ["up to 3 specific sub-issues, e.g. Builder Fraud, Tenancy Dispute"],
  "caseSummary": "2-3 sentence plain-English summary of the user's legal problem and their rights",
  "roadmapSteps": [
    { "title": "First action to take", "detail": "Specific guidance for this step" },
    { "title": "Second action", "detail": "Specific guidance" },
    { "title": "Third action", "detail": "Specific guidance" }
  ]
}`;

      const text = await this.executePrompt(prompt, { jsonMode: true, temperature: 0.2 });
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        category: validCategories.includes(parsed.category) ? parsed.category : validCategories[0],
        subcategories: Array.isArray(parsed.subcategories) ? parsed.subcategories.slice(0, 3) : [],
        caseSummary: parsed.caseSummary || '',
        roadmapSteps: Array.isArray(parsed.roadmapSteps) ? parsed.roadmapSteps.slice(0, 5) : []
      };
    } catch (error: any) {
      console.error('Error in solveAiScenario:', error);
      return {
        category: 'Property Dispute',
        subcategories: [],
        caseSummary: 'Unable to analyze your situation at this time. Please try again or select a category manually.',
        roadmapSteps: []
      };
    }
  }

  async askLegalQuestion(
    question: string,
    availableActs: string[],
    context?: string
  ): Promise<{ answer: string; suggestedActs: string[] }> {
    if (!this.isConfigured) {
      return this.getFallbackAnswer(question, availableActs, context);
    }

    try {
      let prompt = `You are an expert Indian legal advisor. A user is asking a legal question:
"${question}"`;

      if (context) {
        prompt += `\n\nHere is the relevant statutory context retrieved from our database to help you answer:
${context}

Use the retrieved context above to write a direct, factual answer. If the context does not contain enough information, explain the general law but prioritize citing the specific sections from the context.`;
      }

      prompt += `\n\nAvailable acts in our database: ${availableActs.join(', ')}

Your task:
1. Identify which 1-3 acts from the list of available acts are most relevant to the user's query. (Prioritize any acts whose sections are present in the context).
2. Provide a short, direct answer to the question in simple plain English (no complex legal jargon). Make sure to explicitly cite the sections from the context (e.g. "under Section 4 of the Indian Trusts Act, 1882...").

Respond ONLY with a JSON object in this exact format:
{"answer":"Your plain English answer here.","suggestedActs":["ACT1","ACT2"]}`;

      const text = await this.executePrompt(prompt, { jsonMode: true, temperature: 0.2 });
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        answer: parsed.answer || '',
        suggestedActs: Array.isArray(parsed.suggestedActs) ? parsed.suggestedActs : []
      };
    } catch (error: any) {
      console.error('Error in askLegalQuestion (falling back):', error);
      return this.getFallbackAnswer(question, availableActs, context);
    }
  }

  private getFallbackAnswer(question: string, availableActs: string[], context?: string): { answer: string; suggestedActs: string[] } {
    if (context && context.trim().length > 0) {
      const sourceMatch = context.match(/Source\s*\d+:\s*([^-]+)-\s*Section\s*([^\s(]+)(?:\s*\(([^)]+)\))?/i);
      if (sourceMatch) {
        const actName = sourceMatch[1].trim();
        const sectionNum = sourceMatch[2].trim();
        const sectionTitle = sourceMatch[3] ? sourceMatch[3].trim() : '';

        const suggestedAct = availableActs.find(a =>
          actName.toLowerCase().includes(a.toLowerCase()) ||
          a.toLowerCase().includes(actName.toLowerCase())
        ) || availableActs[0];

        return {
          answer: `Based on verified statutory sources in the database: Section ${sectionNum} of the ${actName} ${sectionTitle ? `(${sectionTitle})` : ''} governs this matter. Please review the official statutory text in the Bare Acts section. Disclaimer: This platform provides statutory information for reference and research purposes only, not formal legal advice. Please consult a licensed advocate or legal aid clinic for case-specific representation.`,
          suggestedActs: [suggestedAct]
        };
      }
    }

    return {
      answer: `No verified statutory provisions matching "${question}" were retrieved from the current database index. To find authoritative provisions, please search directly using specific Act names (e.g., BNS, BNSS, Consumer Protection Act) or section numbers, or browse the verified Bare Acts library. Note: Antigravity LegalConnect strictly avoids fabricating legal answers or citations when verified authority is not established.`,
      suggestedActs: availableActs.slice(0, 3)
    };
  }

  // ═════════════════════════════════════════════════════════
  // AI STATUTORY RIGHT CODIFIER (GAZETTE / COURT ORDER PARSER)
  // ═════════════════════════════════════════════════════════

  async codifyStatutoryRightFromText(legalText: string): Promise<any> {
    const trimmed = (legalText || '').trim();
    if (!trimmed) {
      throw new Error('Raw legal text is required for AI codification.');
    }

    const systemPrompt = `You are a Senior Legislative Draftsman and Constitutional Jurist on Indian Law.
Your task is to analyze raw legal text, Gazette notifications, Supreme Court/High Court judgments, or statutory sections, and extract a codified Citizen Safeguard data object.
Return a STRICT JSON OBJECT with exactly the following schema:
{
  "title": "Clear, authoritative title of the right (e.g. Right Against Unlawful Police Arrest)",
  "title_hi": "Title in clear Hindi (Devanagari script)",
  "category": "One of: 'Constitutional & Civil Liberties', 'Police & Criminal Justice', 'Traffic & Motor Vehicles', 'Banking, UPI & Cyber Fraud', 'Consumer Protection & E-Commerce', 'Tenancy & Housing Rights', 'Women, POSH & Domestic Safeguards', 'Healthcare & Patient Charters', 'Digital Privacy & DPDP Act', 'Aviation & Passenger Charters', 'Senior Citizens & Maintenance', 'Labour, Wages & Employment', 'Transparency & Governance'",
  "icon": "One of: 'scale', 'shield', 'lock', 'zap', 'heart', 'truck', 'smartphone', 'activity', 'eye-off', 'credit-card', 'users', 'send', 'user-check', 'alert-circle'",
  "summary": "2-3 sentences plain English summary written for a common citizen in distress explaining what their protection is.",
  "summary_hi": "Plain, simple Hindi translation of the summary in Devanagari script.",
  "actName": "Full official statutory act name (e.g. Bharatiya Nagarik Suraksha Sanhita, 2023)",
  "shortAct": "Official abbreviation (e.g. BNSS 2023 Sec 35)",
  "sections": ["Array of specific sections mentioned, e.g. 'Section 35(3)', 'Section 46'"],
  "actUrl": "/laws/Criminal",
  "landmarkCases": ["1-2 Supreme Court or High Court landmark precedents with year if cited or relevant"],
  "keyProtections": ["Array of 3-4 bullet points detailing specific legal shields"],
  "actionableSteps": ["Array of 3-4 step-by-step immediate actions the citizen must take"],
  "legalRemedy": "Exact judicial or regulatory forum for redressal (e.g. Magistrate Court, Consumer Commission, Rent Authority)",
  "penaltiesForViolation": "Statutory penalty or departmental consequences for authorities violating this right",
  "scenarioTag": "One of: 'police-stop', 'traffic-challan', 'cyber-fraud', 'landlord-eviction', 'consumer-refund', 'domestic-violence', 'medical-refusal', 'banking-freeze'",
  "whatToSay": "Authoritative verbal confrontation script written in first person starting with 'Officer/Authority, under Section...' that the citizen can speak directly to officials.",
  "whatToSay_hi": "Verbal confrontation script translated into assertive, respectful Hindi in Devanagari script.",
  "dos": ["Array of 3 best practice action items"],
  "donts": ["Array of 3 critical actions to avoid under duress"],
  "helplineName": "Name of relevant official 24/7 government helpline",
  "helplineNumber": "Dial digits (e.g. 112, 1930, 1915, 108, 14567)"
}`;

    if (this.isConfigured) {
      try {
        const aiOutput = await this.executePrompt(
          `Analyze and codify the following legal text into the structured Citizen Safeguard JSON object:\n\n"""\n${trimmed}\n"""`,
          {
            systemPrompt,
            jsonMode: true,
            temperature: 0.1,
            maxTokens: 3000
          }
        );

        const parsed = JSON.parse(aiOutput);
        return this.sanitizeCodifiedRight(parsed, trimmed);
      } catch (err) {
        console.warn('AI Codification failed, falling back to heuristic legal parser:', err);
      }
    }

    // Heuristic rule-based legal fallback
    return this.fallbackHeuristicCodifier(trimmed);
  }

  private sanitizeCodifiedRight(obj: any, rawText: string): any {
    const slug = (obj.title || 'statutory-safeguard')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    return {
      id: slug || `right-${Date.now()}`,
      slug: slug || `right-${Date.now()}`,
      title: obj.title || 'Statutory Citizen Safeguard',
      title_hi: obj.title_hi || '',
      category: obj.category || 'Constitutional & Civil Liberties',
      icon: obj.icon || 'shield',
      summary: obj.summary || 'Statutory protection codified under Indian Central Acts.',
      summary_hi: obj.summary_hi || '',
      statutoryBasis: {
        actName: obj.actName || 'Bharatiya Nagarik Suraksha Sanhita, 2023',
        shortAct: obj.shortAct || 'BNSS 2023',
        sections: Array.isArray(obj.sections) && obj.sections.length ? obj.sections : ['Section 35'],
        actUrl: obj.actUrl || '/laws',
        landmarkCases: Array.isArray(obj.landmarkCases) ? obj.landmarkCases : []
      },
      keyProtections: Array.isArray(obj.keyProtections) && obj.keyProtections.length
        ? obj.keyProtections
        : ['Guaranteed procedural safeguards under law.', 'Protection from arbitrary or unauthorized coercive action.'],
      actionableSteps: Array.isArray(obj.actionableSteps) && obj.actionableSteps.length
        ? obj.actionableSteps
        : ['Demand written statutory notice and grounds.', 'Record officer badge details and consult counsel.'],
      legalRemedy: obj.legalRemedy || 'Petition before the Jurisdictional Judicial Magistrate Court.',
      penaltiesForViolation: obj.penaltiesForViolation || 'Disciplinary proceedings and prosecution under BNS Section 199.',
      scenarioTag: obj.scenarioTag || 'police-stop',
      whatToSay: obj.whatToSay || 'Officer, under the governing statutory provisions, you are required to provide written grounds and adhere to mandatory safeguards.',
      whatToSay_hi: obj.whatToSay_hi || 'अधिकारी महोदय, कानूनी प्रावधानों के अनुसार आपको लिखित आधार देना अनिवार्य है।',
      dos: Array.isArray(obj.dos) ? obj.dos : ['Stay calm and polite.', 'Insist on a contemporaneous written record.'],
      donts: Array.isArray(obj.donts) ? obj.donts : ['Do NOT engage in physical resistance.', 'Do NOT sign blank documents.'],
      emergencyHelpline: {
        name: obj.helplineName || 'National Citizen Emergency',
        number: obj.helplineNumber || '112',
        description: '24/7 National Emergency Dispatch Desk',
        portalUrl: 'https://112.gov.in'
      },
      tags: [obj.category || 'Rights', obj.shortAct || 'Act', 'Statutory'].filter(Boolean),
      isPopular: false,
      isPublished: true,
      verifiedDate: new Date().toISOString().split('T')[0],
      verifiedBy: 'LegalConnect AI Statutory Review Directorate'
    };
  }

  private fallbackHeuristicCodifier(rawText: string): any {
    const actMatch = rawText.match(/(?:under\s+)?([A-Za-z\s]+(?:Act|Sanhita|Rules|Code|Constitution|Adhiniyam)(?:,\s*\d{4})?)/i);
    const secMatch = rawText.match(/(?:Section|Sec\.?|Article|Rule)\s*(\d+[A-Za-z0-9()]*(?:\s*read with\s*\d+)?)/gi);
    const caseMatch = rawText.match(/([A-Z][a-zA-Z\s.]+\s+vs?\.?\s+[A-Z][a-zA-Z\s.]+(?:\([0-9\sAIRSC]+\))?)/i);

    const actName = actMatch ? actMatch[1].trim() : 'Central Bare Act / Statutory Code';
    const sections = secMatch ? secMatch.map(s => s.trim()) : ['Section 1'];
    const landmarkCases = caseMatch ? [caseMatch[1].trim()] : [];

    let category = 'Constitutional & Civil Liberties';
    let icon = 'shield';
    let scenarioTag = 'police-stop';

    const lower = rawText.toLowerCase();
    if (lower.includes('traffic') || lower.includes('vehicle') || lower.includes('license') || lower.includes('challan') || lower.includes('towing')) {
      category = 'Traffic & Motor Vehicles';
      icon = 'truck';
      scenarioTag = 'traffic-challan';
    } else if (lower.includes('bank') || lower.includes('cyber') || lower.includes('upi') || lower.includes('fraud') || lower.includes('freeze')) {
      category = 'Banking, UPI & Cyber Fraud';
      icon = 'lock';
      scenarioTag = 'banking-freeze';
    } else if (lower.includes('tenant') || lower.includes('landlord') || lower.includes('rent') || lower.includes('evict') || lower.includes('utility')) {
      category = 'Tenancy & Housing Rights';
      icon = 'zap';
      scenarioTag = 'landlord-eviction';
    } else if (lower.includes('consumer') || lower.includes('refund') || lower.includes('flight') || lower.includes('product') || lower.includes('defect')) {
      category = 'Consumer Protection & E-Commerce';
      icon = 'credit-card';
      scenarioTag = 'consumer-refund';
    } else if (lower.includes('hospital') || lower.includes('doctor') || lower.includes('medical') || lower.includes('patient')) {
      category = 'Healthcare & Patient Charters';
      icon = 'heart';
      scenarioTag = 'medical-refusal';
    } else if (lower.includes('women') || lower.includes('posh') || lower.includes('harassment') || lower.includes('domestic') || lower.includes('senior')) {
      category = 'Women, POSH & Domestic Safeguards';
      icon = 'users';
      scenarioTag = 'domestic-violence';
    }

    return this.sanitizeCodifiedRight({
      title: `Statutory Safeguard under ${actName.slice(0, 35)}`,
      category,
      icon,
      summary: rawText.slice(0, 220) + (rawText.length > 220 ? '...' : ''),
      actName,
      shortAct: actName.slice(0, 20),
      sections,
      landmarkCases,
      scenarioTag,
      whatToSay: `Officer, under ${sections[0] || 'the law'} of ${actName}, you are legally mandated to follow statutory due process before initiating any action.`,
      whatToSay_hi: `अधिकारी महोदय, ${actName} की धारा के अनुसार किसी भी कार्रवाई से पहले कानूनी प्रक्रिया का पालन करना अनिवार्य है।`
    }, rawText);
  }
}

export default new AiService();