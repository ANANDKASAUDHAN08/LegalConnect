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
}

export default new AiService();
