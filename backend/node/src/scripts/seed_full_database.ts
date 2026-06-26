import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import BareAct, { SectionModel, IBareAct, IChapter, ISection } from '../models/BareAct';
import { splitTitle, getParsedContent } from '../utils/textParser';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const RAW_DIR = path.resolve(__dirname, '../data/raw');

async function saveNormalizedAct(bareAct: any, rawChapters: any[]) {
  const sectionsToInsert: any[] = [];
  for (const chap of rawChapters) {
    for (const sec of chap.sections) {
      sectionsToInsert.push({
        actShortName: bareAct.shortName,
        chapterNumber: chap.chapterNumber,
        section_number: sec.section_number,
        title: sec.title,
        title_hi: sec.title_hi,
        content: sec.content,
        content_hi: sec.content_hi,
        aiSummary: sec.aiSummary,
        clean_title: sec.clean_title,
        clean_title_hi: sec.clean_title_hi,
        introduction_text: sec.introduction_text,
        introduction_text_hi: sec.introduction_text_hi,
        content_blocks: sec.content_blocks,
        content_blocks_hi: sec.content_blocks_hi
      });
    }
  }

  await bareAct.save();
  if (sectionsToInsert.length > 0) {
    await SectionModel.insertMany(sectionsToInsert);
  }
}

function cleanText(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  // Strip leading and trailing double quotes if they enclose the string
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  // Replace escaped double quotes with normal ones
  cleaned = cleaned.replace(/\\"/g, '"');
  return cleaned.trim();
}

function parseSection(
  sectionNum: string,
  rawTitle: string,
  content: string,
  rawTitleHi?: string,
  contentHi?: string
): ISection {
  const title = cleanText(rawTitle) || `Section ${sectionNum}`;
  let body = cleanText(content);
  if (!body) {
    body = 'No description available.';
  }
  
  const { cleanTitle, introText } = splitTitle(title);
  const contentBlocks = getParsedContent(body, introText);
  
  const sectionObj: ISection = {
    section_number: sectionNum,
    title,
    content: body,
    clean_title: cleanTitle,
    introduction_text: introText || undefined,
    content_blocks: contentBlocks.map(b => ({ type: b.type, text: b.text }))
  };

  if (rawTitleHi || contentHi) {
    const titleHi = cleanText(rawTitleHi || '');
    const bodyHi = cleanText(contentHi || '');
    
    const { cleanTitle: cleanTitleHi, introText: introTextHi } = splitTitle(titleHi || title);
    const contentBlocksHi = getParsedContent(bodyHi || body, introTextHi);
    
    if (rawTitleHi || titleHi) {
      sectionObj.title_hi = titleHi || undefined;
      sectionObj.clean_title_hi = cleanTitleHi;
      sectionObj.introduction_text_hi = introTextHi || undefined;
    }
    if (bodyHi) {
      sectionObj.content_hi = bodyHi;
      sectionObj.content_blocks_hi = contentBlocksHi.map(b => ({ type: b.type, text: b.text }));
    }
  }

  return sectionObj;
}

async function loadBilingualMap(jsonlFilename: string): Promise<Map<string, string>> {
  const filePath = path.join(RAW_DIR, jsonlFilename);
  const map = new Map<string, string>();
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️ Warning: Bilingual file not found at ${filePath}`);
    return map;
  }

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line);
      const secNum = parsed.section_number?.toString().trim();
      const textHi = parsed.text_hi?.trim();
      if (secNum && textHi) {
        map.set(secNum, textHi);
      }
    } catch (e: any) {
      console.error(`  ❌ Failed to parse bilingual JSONL line in ${jsonlFilename}:`, e.message);
    }
  }
  return map;
}

async function seedData() {
  try {
    const mongoUri = process.env.MONGODB_URI as string;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not defined.');
    }
    console.log('📦 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB!');

    console.log('🗑️ Clearing existing BareActs & Sections...');
    await BareAct.deleteMany({});
    try {
      await SectionModel.collection.drop();
      console.log('✅ Section collection and indexes dropped.');
    } catch (err) {
      await SectionModel.deleteMany({});
    }
    console.log('✅ BareActs & Sections cleared.');

    // --- 1. BNS, BNSS, BSA (New Criminal Acts) ---
    const newActs = [
      {
        enFile: 'bns_en.json',
        hiFile: 'bns_bilingual.jsonl',
        shortName: 'BNS',
        actName: 'Bharatiya Nyaya Sanhita',
        year: 2023,
        description: 'The primary criminal code of India, replacing the Indian Penal Code.'
      },
      {
        enFile: 'bnss_en.json',
        hiFile: 'bnss_bilingual.jsonl',
        shortName: 'BNSS',
        actName: 'Bharatiya Nagarik Suraksha Sanhita',
        year: 2023,
        description: 'The primary legislation on procedure for administration of substantive criminal law in India, replacing the Code of Criminal Procedure.'
      },
      {
        enFile: 'bsa_en.json',
        hiFile: 'bsa_bilingual.jsonl',
        shortName: 'BSA',
        actName: 'Bharatiya Sakshya Adhiniyam',
        year: 2023,
        description: 'The rules of evidence for Indian courts, replacing the Indian Evidence Act.'
      }
    ];

    for (const na of newActs) {
      console.log(`\n📖 Processing ${na.shortName}...`);
      const enPath = path.join(RAW_DIR, na.enFile);
      if (!fs.existsSync(enPath)) {
        console.error(`  ❌ English file not found at ${enPath}`);
        continue;
      }

      const enData = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
      // Load pre-existing Hindi translations from the bilingual jsonl file
      const hiMap = na.hiFile ? await loadBilingualMap(na.hiFile) : new Map<string, string>();

      // Group sections by chapter
      const chaptersMap = new Map<string, { title: string; sections: ISection[] }>();

      let sections = enData.sections || [];
      
      // Preprocess sections for BNS, BNSS, BSA to fix footnote split bug
      if (
        sections.length > 2 &&
        sections[0].section_number?.toString().trim() === '1' &&
        sections[1].section_number?.toString().trim() === '2' &&
        sections[2].section_number?.toString().trim() === '1'
      ) {
        console.log(`  🛠️ Preprocessing duplicate Section 1 (footnote split) for ${na.shortName}...`);
        const sec1 = sections[0];
        const sec2 = sections[1];
        const footnoteSec = sections[2];

        const headingText = footnoteSec.heading || '';
        const textContent = footnoteSec.text || '';
        const newlineIndex = textContent.indexOf('\n');

        let footnoteContinuation = '';
        let restOfSec2Text = '';

        if (newlineIndex !== -1) {
          footnoteContinuation = textContent.slice(0, newlineIndex).trim();
          restOfSec2Text = textContent.slice(newlineIndex + 1).trim();
        } else {
          footnoteContinuation = textContent.trim();
        }

        const fullFootnote = `[Footnote: ${headingText} ${footnoteContinuation}]`;
        sec1.text = (sec1.text || '') + '\n\n' + fullFootnote;

        if (restOfSec2Text) {
          sec2.text = (sec2.text || '') + '\n' + restOfSec2Text;
        }

        if (footnoteSec.clauses && footnoteSec.clauses.length > 0) {
          if (!sec2.clauses) sec2.clauses = [];
          sec2.clauses = [...sec2.clauses, ...footnoteSec.clauses];
        }

        // Remove the duplicate footnote section
        sections = [...sections.slice(0, 2), ...sections.slice(3)];
        console.log(`  ✅ Preprocessing complete. Duplicate Section 1 removed.`);
      }

      console.log(`  Found ${sections.length} English sections.`);

      for (const sec of sections) {
        const secNum = sec.section_number?.toString().trim();
        const chapCode = sec.chapter?.code?.toString().trim() || 'I';
        const chapTitle = sec.chapter?.title?.trim() || 'PRELIMINARY';

        const contentHi = hiMap.get(secNum) || '';
        let body = cleanText(sec.text || '');
        if (!body && sec.clauses && sec.clauses.length > 0) {
          body = sec.clauses.map((c: any) => {
            const clauseText = c.text ? cleanText(c.text) : '';
            const clauseLabel = c.label ? `(${c.label}) ` : '';
            return `${clauseLabel}${clauseText}`;
          }).join('\n');
        }
        if (!body) {
          body = 'No description available.';
        }

        const sectionObj = parseSection(
          secNum,
          sec.heading || `Section ${secNum}`,
          body,
          undefined,
          contentHi
        );

        if (!chaptersMap.has(chapCode)) {
          chaptersMap.set(chapCode, { title: chapTitle, sections: [] });
        }
        chaptersMap.get(chapCode)!.sections.push(sectionObj);
      }

      const chapters: IChapter[] = Array.from(chaptersMap.entries()).map(([code, data]) => ({
        chapterNumber: code,
        title: data.title,
        sections: data.sections
      }));

      const bareAct = new BareAct({
        actName: na.actName,
        shortName: na.shortName,
        year: na.year,
        description: na.description,
        chapters
      });

      await saveNormalizedAct(bareAct, chapters);
      console.log(`  ✅ Successfully saved BareAct: ${na.actName} (${chapters.length} chapters, ${sections.length} sections)`);
    }

    // --- 2. Constitution of India ---
    console.log('\n📖 Processing Constitution...');
    const constPath = path.join(RAW_DIR, 'constitution_en.json');
    if (fs.existsSync(constPath)) {
      const constData = JSON.parse(fs.readFileSync(constPath, 'utf-8'));
      const articles = constData.articles || [];
      const chaptersMap = new Map<string, { title: string; sections: ISection[] }>();

      for (const art of articles) {
        const artNum = art.article_number?.toString().trim();
        const partCode = art.part?.part_code?.toString().trim() || 'I';
        const partTitle = art.part?.title?.trim() || 'THE UNION AND ITS TERRITORY';

        const sectionObj = parseSection(
          artNum,
          art.heading || `Article ${artNum}`,
          art.text || ''
        );

        if (!chaptersMap.has(partCode)) {
          chaptersMap.set(partCode, { title: partTitle, sections: [] });
        }
        chaptersMap.get(partCode)!.sections.push(sectionObj);
      }

      const chapters: IChapter[] = Array.from(chaptersMap.entries()).map(([code, data]) => ({
        chapterNumber: code,
        title: data.title,
        sections: data.sections
      }));

      const bareAct = new BareAct({
        actName: 'Constitution of India',
        shortName: 'Constitution',
        year: 1950,
        description: 'The supreme law of India.',
        chapters
      });

      await saveNormalizedAct(bareAct, chapters);
      console.log(`  ✅ Successfully saved BareAct: Constitution of India (${chapters.length} parts/chapters, ${articles.length} articles)`);
    } else {
      console.error(`  ❌ Constitution file not found at ${constPath}`);
    }

    // --- 3. IPC, CrPC, IEA, NIA (Flat sections with chapters) ---
    const oldActs = [
      {
        fileName: 'ipc.json',
        shortName: 'IPC',
        actName: 'Indian Penal Code',
        year: 1860,
        description: 'The official criminal code of India (historical, replaced by BNS).'
      },
      {
        fileName: 'crpc.json',
        shortName: 'CrPC',
        actName: 'Code of Criminal Procedure',
        year: 1973,
        description: 'The procedure for administration of criminal law in India (historical, replaced by BNSS).'
      },
      {
        fileName: 'iea.json',
        shortName: 'IEA',
        actName: 'Indian Evidence Act',
        year: 1872,
        description: 'The rules of evidence for Indian courts (historical, replaced by BSA).'
      },
      {
        fileName: 'nia.json',
        shortName: 'NIA',
        actName: 'Negotiable Instruments Act',
        year: 1881,
        description: 'Laws relating to promissory notes, bills of exchange and cheques in India.'
      }
    ];

    for (const oa of oldActs) {
      console.log(`\n📖 Processing ${oa.shortName}...`);
      const filePath = path.join(RAW_DIR, oa.fileName);
      if (!fs.existsSync(filePath)) {
        console.error(`  ❌ File not found at ${filePath}`);
        continue;
      }

      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const chaptersMap = new Map<string, { title: string; sections: ISection[] }>();

      for (const item of rawData) {
        const secNum = (item.section !== undefined ? item.section : item.Section)?.toString().trim();
        if (!secNum) continue;

        const chapNum = item.chapter ? item.chapter.toString().trim() : 'I';
        const chapTitle = item.chapter_title?.trim() || `Chapter ${chapNum}`;

        const sectionObj = parseSection(
          secNum,
          item.section_title || `Section ${secNum}`,
          item.section_desc || ''
        );

        if (!chaptersMap.has(chapNum)) {
          chaptersMap.set(chapNum, { title: chapTitle, sections: [] });
        }
        chaptersMap.get(chapNum)!.sections.push(sectionObj);
      }

      const chapters: IChapter[] = Array.from(chaptersMap.entries()).map(([code, data]) => ({
        chapterNumber: code,
        title: data.title,
        sections: data.sections
      }));

      const totalSections = chapters.reduce((sum, c) => sum + c.sections.length, 0);

      const bareAct = new BareAct({
        actName: oa.actName,
        shortName: oa.shortName,
        year: oa.year,
        description: oa.description,
        chapters
      });

      await saveNormalizedAct(bareAct, chapters);
      console.log(`  ✅ Successfully saved BareAct: ${oa.actName} (${chapters.length} chapters, ${totalSections} sections)`);
    }

    // --- 4. CPC, MVA, IDA (Flat sections without chapters) ---
    const flatActs = [
      {
        fileName: 'cpc.json',
        shortName: 'CPC',
        actName: 'Code of Civil Procedure',
        year: 1908,
        description: 'The procedure for civil dispute resolution in India.'
      },
      {
        fileName: 'MVA.json',
        shortName: 'MVA',
        actName: 'Motor Vehicles Act',
        year: 1988,
        description: 'Laws relating to road transport vehicles in India.'
      },
      {
        fileName: 'ida.json',
        shortName: 'IDA',
        actName: 'Indian Divorce Act',
        year: 1869,
        description: 'Laws relating to divorce among Christians in India.'
      }
    ];

    for (const fa of flatActs) {
      console.log(`\n📖 Processing ${fa.shortName}...`);
      const filePath = path.join(RAW_DIR, fa.fileName);
      if (!fs.existsSync(filePath)) {
        console.error(`  ❌ File not found at ${filePath}`);
        continue;
      }

      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const sections: ISection[] = [];

      for (const item of rawData) {
        const secNum = (item.section !== undefined ? item.section : item.Section)?.toString().trim();
        if (!secNum) continue;

        const sectionObj = parseSection(
          secNum,
          item.title || item.section_title || `Section ${secNum}`,
          item.description || item.section_desc || ''
        );
        sections.push(sectionObj);
      }

      const chapters: IChapter[] = [
        {
          chapterNumber: 'I',
          title: 'Sections',
          sections
        }
      ];

      const bareAct = new BareAct({
        actName: fa.actName,
        shortName: fa.shortName,
        year: fa.year,
        description: fa.description,
        chapters
      });

      await saveNormalizedAct(bareAct, chapters);
      console.log(`  ✅ Successfully saved BareAct: ${fa.actName} (1 chapter, ${sections.length} sections)`);
    }

    // --- 5. Structured JSON Acts (HMA, RTI, DVA, HSA) ---
    const structuredActs = [
      {
        fileName: 'hma.json',
        shortName: 'HMA',
        actName: 'Hindu Marriage Act',
        year: 1955,
        description: 'Laws relating to marriage and divorce among Hindus in India.'
      },
      {
        fileName: 'rti.json',
        shortName: 'RTI',
        actName: 'Right to Information Act',
        year: 2005,
        description: 'An Act to provide for setting out the practical regime of right to information for citizens.'
      },
      {
        fileName: 'dva.json',
        shortName: 'DVA',
        actName: 'Domestic Violence Act',
        year: 2005,
        description: 'An Act to provide for more effective protection of the rights of women guaranteed under the Constitution who are victims of violence.'
      },
      {
        fileName: 'hsa.json',
        shortName: 'HSA',
        actName: 'Hindu Succession Act',
        year: 1956,
        description: 'An Act to amend and codify the law relating to intestate succession among Hindus.'
      }
    ];

    for (const sa of structuredActs) {
      console.log(`\n📖 Processing ${sa.shortName}...`);
      const filePath = path.join(RAW_DIR, sa.fileName);
      if (fs.existsSync(filePath)) {
        const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const chaptersMap = new Map<string, { title: string; sections: ISection[] }>();

        for (const item of rawData) {
          const secNum = item.section?.toString().trim();
          if (!secNum) continue;

          const chapNum = item.chapter ? item.chapter.toString().trim() : '1';
          const chapTitle = item.chapter_title?.trim() || `Chapter ${chapNum}`;

          const sectionObj = parseSection(
            secNum,
            item.section_title || `Section ${secNum}`,
            item.section_desc || ''
          );

          if (!chaptersMap.has(chapNum)) {
            chaptersMap.set(chapNum, { title: chapTitle, sections: [] });
          }
          chaptersMap.get(chapNum)!.sections.push(sectionObj);
        }

        const chapters: IChapter[] = Array.from(chaptersMap.entries()).map(([code, data]) => ({
          chapterNumber: code,
          title: data.title,
          sections: data.sections
        }));

        const totalSections = chapters.reduce((sum, c) => sum + c.sections.length, 0);

        const bareAct = new BareAct({
          actName: sa.actName,
          shortName: sa.shortName,
          year: sa.year,
          description: sa.description,
          chapters
        });

        await saveNormalizedAct(bareAct, chapters);
        console.log(`  ✅ Successfully saved BareAct: ${sa.actName} (${chapters.length} chapters, ${totalSections} sections)`);
      } else {
        console.error(`  ❌ File not found at ${filePath}`);
      }
    }

    console.log('\n🎉 All 15 Bare Acts seeded successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Database seeding failed:', error.message);
    process.exit(1);
  }
}

seedData();
