import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import BareAct, { SectionModel } from '../models/BareAct';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BATCH_DELAY_MS = 1500; // delay between API calls to avoid rate limiting

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function translateText(ai: GoogleGenerativeAI, text: string, context: string): Promise<string> {
  const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `You are an expert legal translator. Translate the following Indian legal statute text from English to Hindi (Devanagari script). 

RULES:
- Produce ONLY the Hindi translation, no explanations or commentary.
- Preserve the exact structure: line breaks, clause numbering like (a), (b), (c), Explanations, Illustrations etc.
- Translate clause labels like (a) to (क), (b) to (ख), (c) to (ग), (d) to (घ), (e) to (ङ), (f) to (च), (g) to (छ), (h) to (ज), (i) to (झ), (j) to (ञ) etc.
- Keep proper nouns (names of places, acts, courts) in their original English form.
- Use standard legal Hindi terminology.
- Translate "Explanation" as "स्पष्टीकरण" and "Illustration" as "दृष्टांत".

Context: This is from ${context}.

English text to translate:
${text}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function translateTitle(ai: GoogleGenerativeAI, title: string): Promise<string> {
  const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `Translate this Indian legal section title from English to Hindi (Devanagari script). Output ONLY the Hindi translation, nothing else. Keep proper nouns in English.

Title: ${title}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const actFlagIdx = args.indexOf('--act');
  const targetAct = actFlagIdx !== -1 && args[actFlagIdx + 1] ? args[actFlagIdx + 1] : null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY is not set in .env');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
  }

  const ai = new GoogleGenerativeAI(apiKey);

  console.log('📦 Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB!\n');

  const query: any = {};
  if (targetAct) {
    query.actShortName = targetAct;
    console.log(`🎯 Targeting act: ${targetAct}`);
  }

  const sections = await SectionModel.find(query);
  console.log(`📚 Found ${sections.length} section(s) to process.\n`);

  let totalTranslated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // Cache act metadata to avoid redundant lookups
  const acts = await BareAct.find({}, 'actName shortName year');
  const actMap = new Map(acts.map(a => [a.shortName, a]));

  for (const section of sections) {
    const act = actMap.get(section.actShortName || '');
    const context = act ? `${act.actName} (${act.shortName}), ${act.year}` : (section.actShortName || '');

    // Skip if already translated
    if (section.content_hi && section.content_hi.trim().length > 10) {
      totalSkipped++;
      continue;
    }

    const label = `  §${section.section_number} "${section.title}"`;

    try {
      console.log(`${label} — translating...`);

      // Translate content
      const translatedContent = await translateText(ai, section.content || '', context);
      await sleep(BATCH_DELAY_MS);

      // Translate title
      const translatedTitle = await translateTitle(ai, section.title || '');
      await sleep(BATCH_DELAY_MS / 2);

      if (dryRun) {
        console.log(`  [DRY RUN] Title: ${translatedTitle}`);
        console.log(`  [DRY RUN] Content (first 200 chars): ${translatedContent.substring(0, 200)}...`);
        console.log('  ✅ Dry run complete. Exiting.');
        await mongoose.disconnect();
        process.exit(0);
      }

      // Save to DB
      section.content_hi = translatedContent;
      section.title_hi = translatedTitle;
      await section.save();

      totalTranslated++;
      console.log(`${label} — ✅ done`);
    } catch (err: any) {
      totalErrors++;
      console.error(`${label} — ❌ Error: ${err.message}`);
      await sleep(3000);
    }
  }

  console.log(`\n🎉 Translation complete!`);
  console.log(`   ✅ Translated: ${totalTranslated}`);
  console.log(`   ⏭️  Skipped (already had Hindi): ${totalSkipped}`);
  console.log(`   ❌ Errors: ${totalErrors}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
