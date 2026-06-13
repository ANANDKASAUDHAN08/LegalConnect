import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import BareAct from '../models/BareAct';
import Lawyer from '../models/Lawyer';
import { splitTitle, getParsedContent } from '../utils/textParser';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI as string;
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB!');

    // --- Seed BareActs ---
    const actsSeedFilePath = path.resolve(__dirname, '../data/bareacts.seed.json');
    const actsRawData = fs.readFileSync(actsSeedFilePath, 'utf-8');
    const acts = JSON.parse(actsRawData);

    console.log('🗑️  Clearing existing BareActs...');
    await BareAct.deleteMany({});
    console.log('💾 Seeding legal acts...');
    for (const act of acts) {
      if (act.chapters) {
        for (const chap of act.chapters) {
          if (chap.sections) {
            chap.sections = chap.sections.map((sec: any) => {
              const rawTitle = sec.title || `Section ${sec.section_number}`;
              const body = sec.content || '';
              
              const cleanText = (text: string) => {
                if (!text) return '';
                let cleaned = text.trim();
                if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                  cleaned = cleaned.substring(1, cleaned.length - 1);
                }
                return cleaned.replace(/\\"/g, '"').trim();
              };

              const title = cleanText(rawTitle) || `Section ${sec.section_number}`;
              let content = cleanText(body);
              if (!content) {
                content = 'No description available.';
              }
              const { cleanTitle, introText } = splitTitle(title);
              const contentBlocks = getParsedContent(content, introText);

              sec.title = title;
              sec.content = content;
              sec.clean_title = cleanTitle;
              sec.introduction_text = introText || undefined;
              sec.content_blocks = contentBlocks.map(b => ({ type: b.type, text: b.text }));

              // Parse Hindi if present
              if (sec.title_hi || sec.content_hi) {
                const titleHi = cleanText(sec.title_hi || '');
                const contentHi = cleanText(sec.content_hi || '');
                const { cleanTitle: cleanTitleHi, introText: introTextHi } = splitTitle(titleHi || title);
                const contentBlocksHi = getParsedContent(contentHi || content, introTextHi);
                
                if (sec.title_hi || titleHi) {
                  sec.title_hi = titleHi || undefined;
                  sec.clean_title_hi = cleanTitleHi;
                  sec.introduction_text_hi = introTextHi || undefined;
                }
                if (sec.content_hi) {
                  sec.content_hi = contentHi;
                  sec.content_blocks_hi = contentBlocksHi.map(b => ({ type: b.type, text: b.text }));
                }
              }
              return sec;
            });
          }
        }
      }
      const newAct = new BareAct(act);
      await newAct.save();
      console.log(`  ✅ Inserted: "${act.actName}"`);
    }

    // --- Seed Lawyers ---
    const lawyersSeedFilePath = path.resolve(__dirname, '../data/lawyers.seed.json');
    const lawyersRawData = fs.readFileSync(lawyersSeedFilePath, 'utf-8');
    const lawyers = JSON.parse(lawyersRawData);

    console.log('\n🗑️  Clearing existing Lawyers...');
    await Lawyer.deleteMany({});
    console.log('💾 Seeding lawyers...');
    for (const lawyer of lawyers) {
      const newLawyer = new Lawyer({
        ...lawyer,
        isVerified: true
      });
      await newLawyer.save();
      console.log(`  ✅ Inserted: "${lawyer.name}"`);
    }

    console.log('\n🎉 Database seeded successfully!');
    console.log(`   Acts inserted: ${acts.length}`);
    console.log(`   Lawyers inserted: ${lawyers.length}`);
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedData();

