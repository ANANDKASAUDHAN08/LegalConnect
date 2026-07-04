import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

class AiService {
  private ai: GoogleGenerativeAI | null = null;
  private isConfigured = false;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenerativeAI(apiKey);
      this.isConfigured = true;
      console.log('✅ AI Service initialized with Gemini API Key.');
    } else {
      console.warn('⚠️ GEMINI_API_KEY is not set in the environment. AI Summaries will return mock data.');
    }
  }

  async generateSectionSummary(actName: string, sectionTitle: string, content: string): Promise<string> {
    if (!this.isConfigured || !this.ai) {
      return `(Mock Summary) This section titled "${sectionTitle}" from "${actName}" outlines specific rules and conditions. Please provide a GEMINI_API_KEY in the backend/.env file to generate real AI summaries.`;
    }

    try {
      const prompt = `You are an expert Indian legal assistant. Your task is to explain a specific section of a law in simple, "Plain English" so that a common citizen can understand it easily.

Act Name: ${actName}
Section Title: ${sectionTitle}
Section Text: ${content}

Please provide a concise summary (2-3 paragraphs maximum) explaining what this section means in simple terms. Avoid complex legal jargon where possible.`;

      const model = this.ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);

      return result.response.text() || "Could not generate summary.";
    } catch (error) {
      console.error('Error generating AI summary:', error);
      throw new Error('Failed to generate AI summary.');
    }
  }

  async *generateSectionSummaryStream(actName: string, sectionTitle: string, content: string): AsyncGenerator<string, void, unknown> {
    if (!this.isConfigured || !this.ai) {
      // Return simulated mock stream typewriter-style
      const mockText = `(Mock Summary) This section titled "${sectionTitle}" from "${actName}" outlines specific rules and conditions. Please provide a GEMINI_API_KEY in the backend/.env file to generate real AI summaries.`;
      const words = mockText.split(' ');
      for (const word of words) {
        yield word + ' ';
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      return;
    }

    try {
      const prompt = `You are an expert Indian legal assistant. Your task is to explain a specific section of a law in simple, "Plain English" so that a common citizen can understand it easily.

Act Name: ${actName}
Section Title: ${sectionTitle}
Section Text: ${content}

Please provide a concise summary (2-3 paragraphs maximum) explaining what this section means in simple terms. Avoid complex legal jargon where possible.`;

      const model = this.ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const resultStream = await model.generateContentStream(prompt);

      for await (const chunk of resultStream.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    } catch (error) {
      console.error('Error generating AI summary stream:', error);
      throw new Error('Failed to generate AI summary stream.');
    }
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
    if (!this.isConfigured || !this.ai) {
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

      const model = this.ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text() || "Could not generate transition comparison.";
    } catch (error) {
      console.error('Error generating transition explanation:', error);
      return `Failed to generate comparison.`;
    }
  }

  async generateRawContent(prompt: string): Promise<string> {
    if (!this.isConfigured || !this.ai) {
      return '(Mock Translation) GEMINI_API_KEY is not configured. Please set it in backend/.env to enable real translations.';
    }

    try {
      const model = this.ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Error generating raw content:', error);
      throw new Error('Failed to generate content from AI.');
    }
  }

  private getFallbackAnswer(question: string, availableActs: string[], context?: string): { answer: string; suggestedActs: string[] } {
    const qLower = question.toLowerCase();

    // Match cheque bounce / limitation queries
    if (qLower.includes('cheque') && (qLower.includes('bounce') || qLower.includes('limit') || qLower.includes('138'))) {
      return {
        answer: "Under Section 138 of the Negotiable Instruments Act, 1881, cheque bounce is a criminal offense. The limitation period to file a complaint in court is 30 days from the date of receipt of the demand notice by the drawer. The legal notice must be sent within 30 days of receiving the cheque return memo from the bank, and the drawer has 15 days to pay from the receipt of the notice.",
        suggestedActs: ["NIA"]
      };
    }

    // Match trusts / Indian trusts queries
    if (qLower.includes('trust') || qLower.includes('trusts')) {
      return {
        answer: "Under Section 4 of the Indian Trusts Act, 1882, a trust may be created for any lawful purpose. A purpose is lawful unless it is forbidden by law, defeats the provisions of any law, is fraudulent, or involves injury to the person or property of another, or the Court regards it as immoral or opposed to public policy. All trusts created for an unlawful purpose are void.",
        suggestedActs: ["INDIAN_TRUSTS_1882"]
      };
    }

    // Dynamic RAG Fallback using context from MongoDB
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

    // Default general fallback
    return {
      answer: `Your question "${question}" relates to Indian legal provisions. Specifically, please search for relevant Bare Acts like ${availableActs.slice(0, 3).join(', ')} to inspect the exact statutory sections.`,
      suggestedActs: availableActs.slice(0, 2)
    };
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

    if (!this.isConfigured || !this.ai) {
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

      const model = this.ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
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

  async askLegalQuestion(question: string, availableActs: string[], context?: string): Promise<{ answer: string; suggestedActs: string[] }> {
    if (!this.isConfigured || !this.ai) {
      return this.getFallbackAnswer(question, availableActs, context);
    }

    try {
      let prompt = `You are an expert Indian legal assistant. A user is searching a legal library with the following question or keyword:
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

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{"answer":"Your plain English answer here.","suggestedActs":["ACT1","ACT2"]}`;

      const model = this.ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Parse JSON, stripping any potential markdown backticks
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
}

export default new AiService();