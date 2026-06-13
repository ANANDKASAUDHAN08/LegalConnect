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

  async askLegalQuestion(question: string, availableActs: string[]): Promise<{ answer: string; suggestedActs: string[] }> {
    if (!this.isConfigured || !this.ai) {
      return {
        answer: `(Mock) Your question "${question}" relates to Indian legal provisions. Please configure GEMINI_API_KEY for real AI responses.`,
        suggestedActs: availableActs.slice(0, 2)
      };
    }

    try {
      const prompt = `You are an expert Indian legal assistant. A user is searching a legal library with the following question or keyword:
"${question}"

Available acts in our database: ${availableActs.join(', ')}

Your task:
1. Identify which 1-3 acts from the list above are most relevant to the user's query.
2. Provide a very short 1-2 sentence direct answer to the question in simple plain English (no jargon).

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
    } catch (error) {
      console.error('Error in askLegalQuestion:', error);
      return { answer: 'Could not process your question. Try a keyword search instead.', suggestedActs: [] };
    }
  }
}

export default new AiService();
