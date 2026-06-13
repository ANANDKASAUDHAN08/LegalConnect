import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import BareAct from '../models/BareAct';
import { splitTitle, getParsedContent } from '../utils/textParser';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  const mongoUri = process.env.MONGODB_URI as string;
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const acts = await BareAct.find({});
  console.log(`Found ${acts.length} acts in database.`);

  for (const act of acts) {
    console.log(`Reparsing ${act.shortName}...`);
    for (const chap of act.chapters) {
      for (const sec of chap.sections) {
        const { cleanTitle, introText } = splitTitle(sec.title);
        const contentBlocks = getParsedContent(sec.content, introText);
        
        sec.clean_title = cleanTitle;
        sec.introduction_text = introText || undefined;
        sec.content_blocks = contentBlocks.map(b => ({ type: b.type, text: b.text }));

        if (sec.content_hi) {
          const { cleanTitle: cleanTitleHi, introText: introTextHi } = splitTitle(sec.title_hi || sec.title);
          const contentBlocksHi = getParsedContent(sec.content_hi, introTextHi);
          sec.clean_title_hi = cleanTitleHi;
          sec.introduction_text_hi = introTextHi || undefined;
          sec.content_blocks_hi = contentBlocksHi.map(b => ({ type: b.type, text: b.text }));
        }
      }
    }
    // Mark modified since chapters is an array of subdocuments
    act.markModified('chapters');
    await act.save();
    console.log(`Saved ${act.shortName}.`);
  }

  console.log('Finished reparsing database!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
