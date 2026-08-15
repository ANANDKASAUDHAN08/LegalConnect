import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

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
      } catch {}
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
      } catch {}
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
  // STATUTORY SECTION TRANSLATION & PROOFREADING
  // ═════════════════════════════════════════════════════════

  async translateSectionToHindi(
    actName: string,
    sectionNumber: string,
    title: string,
    content: string
  ): Promise<{ title_hi: string; introduction_text_hi: string }> {
    if (!this.isConfigured) {
      throw new Error('AI Service is not configured. Please set OPENROUTER_API_KEY or GEMINI_API_KEY in backend/.env.');
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
      const text = await this.executePrompt(prompt, {
        systemPrompt,
        jsonMode: true,
        temperature: 0.1
      });

      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        title_hi: String(parsed.title_hi || '').trim(),
        introduction_text_hi: String(parsed.introduction_text_hi || '').trim()
      };
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
  ): Promise<{ title: string; introduction_text: string }> {
    if (!this.isConfigured) {
      throw new Error('AI Service is not configured. Please set OPENROUTER_API_KEY or GEMINI_API_KEY in backend/.env.');
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
      const text = await this.executePrompt(prompt, {
        systemPrompt,
        jsonMode: true,
        temperature: 0.1
      });

      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      return {
        title: String(parsed.title || title).trim(),
        introduction_text: String(parsed.introduction_text || content).trim()
      };
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
    const qLower = question.toLowerCase();

    if (qLower.includes('cheque') && (qLower.includes('bounce') || qLower.includes('limit') || qLower.includes('138'))) {
      return {
        answer: "Under Section 138 of the Negotiable Instruments Act, 1881, cheque bounce is a criminal offense. The limitation period to file a complaint in court is 30 days from the date of receipt of the demand notice by the drawer. The legal notice must be sent within 30 days of receiving the cheque return memo from the bank, and the drawer has 15 days to pay from the receipt of the notice.",
        suggestedActs: ["NIA"]
      };
    }

    if (qLower.includes('trust') || qLower.includes('trusts')) {
      return {
        answer: "Under Section 4 of the Indian Trusts Act, 1882, a trust may be created for any lawful purpose. A purpose is lawful unless it is forbidden by law, defeats the provisions of any law, is fraudulent, or involves injury to the person or property of another, or the Court regards it as immoral or opposed to public policy. All trusts created for an unlawful purpose are void.",
        suggestedActs: ["INDIAN_TRUSTS_1882"]
      };
    }

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
          answer: `According to Section ${sectionNum} of the ${actName} ${sectionTitle ? `(${sectionTitle})` : ''}, this is legally defined and regulated. The law states that this provision applies to cases meeting these statutory requirements. Clicking on the cited pills below will take you to the full Bare Act for detailed study.`,
          suggestedActs: [suggestedAct]
        };
      }
    }

    return {
      answer: `Your question "${question}" relates to Indian legal provisions. Specifically, please search for relevant Bare Acts like ${availableActs.slice(0, 3).join(', ')} to inspect the exact statutory sections.`,
      suggestedActs: availableActs.slice(0, 2)
    };
  }
}

export default new AiService();