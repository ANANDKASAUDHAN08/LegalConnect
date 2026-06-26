import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import BareAct, { SectionModel } from '../models/BareAct';
import { splitTitle, getParsedContent } from '../utils/textParser';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI as string;
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const sections = await SectionModel.find({});
  console.log(`Found ${sections.length} sections in database.`);

  for (const sec of sections) {
    console.log(`Reparsing section ${sec.section_number} of ${sec.actShortName}...`);
    const { cleanTitle, introText } = splitTitle(sec.title || '');
    const contentBlocks = getParsedContent(sec.content || '', introText);
    
    // Sanitize required fields to prevent mongoose validation errors
    if (!sec.chapterNumber || !sec.chapterNumber.trim()) {
      sec.chapterNumber = '1';
    }
    if (!sec.title || !sec.title.trim()) {
      sec.title = 'Untitled Section';
    }
    if (!sec.content || !sec.content.trim()) {
      sec.content = 'No content available.';
    }

    sec.clean_title = cleanTitle;
    sec.introduction_text = introText || undefined;
    sec.content_blocks = contentBlocks.map(b => ({ type: b.type, text: b.text }));

    if (sec.content_hi) {
      const { cleanTitle: cleanTitleHi, introText: introTextHi } = splitTitle(sec.title_hi || sec.title || '');
      const contentBlocksHi = getParsedContent(sec.content_hi, introTextHi);
      sec.clean_title_hi = cleanTitleHi;
      sec.introduction_text_hi = introTextHi || undefined;
      sec.content_blocks_hi = contentBlocksHi.map(b => ({ type: b.type, text: b.text }));
    }
    
    await sec.save();
    console.log(`Saved section ${sec.section_number} of ${sec.actShortName}.`);
  }

  console.log('Finished reparsing database!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
