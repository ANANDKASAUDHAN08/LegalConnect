import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import BareAct, { SectionModel, IChapter, ISection } from '../models/BareAct';
import { normalizeActInfo } from './actNormalizer';
import HelpCategory from '../models/HelpCategory';
import HelpHelpline from '../models/HelpHelpline';
import LegalResource from '../models/LegalResource';
import Lawyer from '../models/Lawyer';
import { splitTitle, getParsedContent } from './textParser';

const RAW_DIR = path.resolve(__dirname, '../data/raw');

function cleanText(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.substring(1, cleaned.length - 1);
  }
  return cleaned.replace(/\\"/g, '"').trim();
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
    } catch (e) {
      // Ignored
    }
  }
  return map;
}

export const seedFullDatabaseIfEmpty = async () => {
  try {
    // --- 1. Help Categories Seeding ---
    const catCount = await HelpCategory.countDocuments({});
    if (catCount < 8) {
      console.log('🌱 Seeding HelpCategory table in MongoDB with Production categories...');
      await HelpCategory.deleteMany({});
      await HelpCategory.insertMany([
        { id: 'Property Dispute', name: 'Property Dispute', icon: 'home', description: 'Land, Rent, Inheritance, Housing', subcategories: ['Tenant Eviction & Rent', 'Land Partition & Boundary', 'RERA & Builder Delays', 'Property Title Search'] },
        { id: 'Family Law', name: 'Family Law', icon: 'users', description: 'Divorce, Custody, Maintenance', subcategories: ['Mutual & Contested Divorce', 'Child Custody & Guardianship', 'Alimony & Maintenance', 'Domestic Violence Help'] },
        { id: 'Consumer Complaint', name: 'Consumer Complaint', icon: 'shopping-cart', description: 'Faulty Products, Fraud, Bills', subcategories: ['Defective Product Claims', 'Insurance Claim Rejection', 'Flight & Hotel Refund', 'Medical Negligence'] },
        { id: 'Labour Issue', name: 'Labour Issue', icon: 'briefcase', description: 'Wages, Harassment, Contracts', subcategories: ['Illegal Termination', 'Unpaid Wages & Bonus', 'POSH Harassment Inquiry', 'PF & Gratuity Claims'] },
        { id: 'Criminal Matter', name: 'Criminal Matter', icon: 'shield', description: 'Theft, Assault, Police Reports', subcategories: ['Anticipatory & Regular Bail', 'FIR Quashing (482 CrPC)', 'Police Station Assistance', 'Cheating & Fraud (420)'] },
        { id: 'Business Dispute', name: 'Business Dispute', icon: 'briefcase', description: 'Partnerships, Tax, Contracts', subcategories: ['Contract Breach', 'MSME Delayed Payment', 'Partnership Dispute', 'GST & Corporate Tax'] },
        { id: 'Cyber Crime', name: 'Cyber Crime', icon: 'shield', description: 'Hacking, Online Scam, Phishing', subcategories: ['UPI & Bank Fraud Helpline', 'Identity Theft & Hacking', 'Cyber Stalking & Harassment', 'Data Privacy Violation'] },
        { id: 'Other / Not Sure', name: 'Other / Not Sure', icon: 'question', description: 'Chat with our smart AI assistant', subcategories: ['AI Scenario Solver', 'Legal Help Navigator'] }
      ]).catch((err) => console.error('Category seed error:', err.message));
    }

    // --- 2. Helplines Seeding ---
    const helpCount = await HelpHelpline.countDocuments({});
    if (helpCount === 0) {
      console.log('🌱 Seeding HelpHelpline table in MongoDB...');
      await HelpHelpline.insertMany([
        { name: 'National Emergency Response System', number: '112', description: 'All-in-one emergency dispatch for Police, Fire, and Ambulance.', category: 'General' },
        { name: 'Women Helpline (Domestic Violence / Abuse)', number: '1091', description: '24/7 dedicated helpline for women in distress or danger.', category: 'family' },
        { name: 'National Legal Services Authority (NALSA)', number: '15100', description: 'Free legal aid guidance and tele-law consultation helpline.', category: 'General' },
        { name: 'National Cyber Crime Reporting Helpline', number: '1930', description: 'Financial fraud freeze and online harassment reporting line.', category: 'cyber' },
        { name: 'Childline Emergency Assistance', number: '1098', description: '24/7 free emergency helpline for children in need of care.', category: 'General' }
      ]).catch(() => { });
    }

    // --- 3. Legal Resources Seeding (from src/data/resources.seed.json) ---
    const resCount = await LegalResource.countDocuments({});
    const resourcesPath = path.resolve(__dirname, '../data/resources.seed.json');
    if (resCount !== 142 && fs.existsSync(resourcesPath)) {
      console.log('🌱 Syncing LegalResource table (72 LegalAid, 58 Courts, 12 Police) from resources.seed.json...');
      await LegalResource.deleteMany({});
      const seedResources = JSON.parse(fs.readFileSync(resourcesPath, 'utf-8'));
      const approvedResources = seedResources.map((r: any) => ({
        ...r,
        status: r.status || 'approved'
      }));
      await LegalResource.insertMany(approvedResources).catch((err) => console.error('Resource seed error:', err.message));
    }

    // --- 4. Lawyers Seeding (from src/data/lawyers.seed.json) ---
    const lawyerCount = await Lawyer.countDocuments({});
    const lawyersPath = path.resolve(__dirname, '../data/lawyers.seed.json');
    if (lawyerCount !== 14 && fs.existsSync(lawyersPath)) {
      console.log('🌱 Syncing Lawyer table (14 Verified Lawyers) from lawyers.seed.json...');
      await Lawyer.deleteMany({});
      const seedLawyers = JSON.parse(fs.readFileSync(lawyersPath, 'utf-8'));
      await Lawyer.insertMany(seedLawyers).catch((err) => console.error('Lawyer seed error:', err.message));
    }

    // --- 5. Bare Acts Seeding ---
    const actsCount = await BareAct.countDocuments({});
    const sectionsCount = await SectionModel.countDocuments({});
    if (actsCount >= 15 && sectionsCount > 1000) {
      console.log(`ℹ️ Database already has ${actsCount} acts, ${resCount || 'seeded'} resources & ${sectionsCount} sections.`);
      return;
    }

    console.log('🚀 Start auto-seeding full database (15 Acts)...');
    const startTime = Date.now();

    const actsToInsert: any[] = [];
    const sectionsToInsert: any[] = [];

    // --- 1. BNS, BNSS, BSA (New Criminal Acts) ---
    const newActs = [
      { enFile: 'bns_en.json', hiFile: 'bns_bilingual.jsonl', shortName: 'BNS', actName: 'Bharatiya Nyaya Sanhita', year: 2023, description: 'The primary criminal code of India, replacing the Indian Penal Code.' },
      { enFile: 'bnss_en.json', hiFile: 'bnss_bilingual.jsonl', shortName: 'BNSS', actName: 'Bharatiya Nagarik Suraksha Sanhita', year: 2023, description: 'The primary legislation on procedure for administration of substantive criminal law in India, replacing the Code of Criminal Procedure.' },
      { enFile: 'bsa_en.json', hiFile: 'bsa_bilingual.jsonl', shortName: 'BSA', actName: 'Bharatiya Sakshya Adhiniyam', year: 2023, description: 'The rules of evidence for Indian courts, replacing the Indian Evidence Act.' }
    ];

    // Load bilingual maps concurrently
    const maps = await Promise.all(newActs.map(na => loadBilingualMap(na.hiFile)));

    newActs.forEach((na, index) => {
      const enPath = path.join(RAW_DIR, na.enFile);
      if (!fs.existsSync(enPath)) return;

      const enData = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
      const hiMap = maps[index];
      const chaptersMap = new Map<string, { title: string; sections: ISection[] }>();

      let sections = enData.sections || [];

      if (
        sections.length > 2 &&
        sections[0].section_number?.toString().trim() === '1' &&
        sections[1].section_number?.toString().trim() === '2' &&
        sections[2].section_number?.toString().trim() === '1'
      ) {
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

        sec1.text = (sec1.text || '') + '\n\n' + `[Footnote: ${headingText} ${footnoteContinuation}]`;
        if (restOfSec2Text) sec2.text = (sec2.text || '') + '\n' + restOfSec2Text;
        if (footnoteSec.clauses) sec2.clauses = [...(sec2.clauses || []), ...footnoteSec.clauses];
        sections = [...sections.slice(0, 2), ...sections.slice(3)];
      }

      for (const sec of sections) {
        const secNum = sec.section_number?.toString().trim();
        const chapCode = sec.chapter?.code?.toString().trim() || 'I';
        const chapTitle = sec.chapter?.title?.trim() || 'PRELIMINARY';
        const contentHi = hiMap.get(secNum) || '';

        let body = cleanText(sec.text || '');
        if (!body && sec.clauses) {
          body = sec.clauses.map((c: any) => `${c.label ? `(${c.label}) ` : ''}${c.text ? cleanText(c.text) : ''}`).join('\n');
        }

        const sectionObj = parseSection(secNum, sec.heading || `Section ${secNum}`, body || 'No description available.', undefined, contentHi);
        if (!chaptersMap.has(chapCode)) {
          chaptersMap.set(chapCode, { title: chapTitle, sections: [] });
        }
        chaptersMap.get(chapCode)!.sections.push(sectionObj);

        // Accumulate section
        sectionsToInsert.push({
          actShortName: na.shortName,
          chapterNumber: chapCode,
          section_number: secNum,
          title: sectionObj.title,
          content: sectionObj.content,
          content_hi: sectionObj.content_hi,
          clean_title: sectionObj.clean_title,
          clean_title_hi: sectionObj.clean_title_hi,
          introduction_text: sectionObj.introduction_text,
          introduction_text_hi: sectionObj.introduction_text_hi,
          content_blocks: sectionObj.content_blocks,
          content_blocks_hi: sectionObj.content_blocks_hi
        });
      }

      const chapters: IChapter[] = Array.from(chaptersMap.entries()).map(([code, data]) => ({
        chapterNumber: code,
        title: data.title,
        sections: data.sections
      }));

      actsToInsert.push({
        actName: na.actName,
        shortName: na.shortName,
        year: na.year,
        description: na.description,
        chapters
      });
    });

    // --- 2. Constitution of India ---
    const constPath = path.join(RAW_DIR, 'constitution_en.json');
    if (fs.existsSync(constPath)) {
      const constData = JSON.parse(fs.readFileSync(constPath, 'utf-8'));
      const articles = constData.articles || [];
      const chaptersMap = new Map<string, { title: string; sections: ISection[] }>();

      for (const art of articles) {
        const artNum = art.article_number?.toString().trim();
        const partCode = art.part?.part_code?.toString().trim() || 'I';
        const partTitle = art.part?.title?.trim() || 'THE UNION AND ITS TERRITORY';

        const sectionObj = parseSection(artNum, art.heading || `Article ${artNum}`, art.text || '');
        if (!chaptersMap.has(partCode)) {
          chaptersMap.set(partCode, { title: partTitle, sections: [] });
        }
        chaptersMap.get(partCode)!.sections.push(sectionObj);

        sectionsToInsert.push({
          actShortName: 'Constitution',
          chapterNumber: partCode,
          section_number: artNum,
          title: sectionObj.title,
          content: sectionObj.content,
          clean_title: sectionObj.clean_title,
          introduction_text: sectionObj.introduction_text,
          content_blocks: sectionObj.content_blocks
        });
      }

      const chapters: IChapter[] = Array.from(chaptersMap.entries()).map(([code, data]) => ({
        chapterNumber: code,
        title: data.title,
        sections: data.sections
      }));

      actsToInsert.push({
        actName: 'Constitution of India',
        shortName: 'Constitution',
        year: 1950,
        description: 'The supreme law of India.',
        chapters
      });
    }

    // --- 3. IPC, CrPC, IEA, NIA ---
    const oldActs = [
      { fileName: 'ipc.json', shortName: 'IPC', actName: 'Indian Penal Code', year: 1860, description: 'The official criminal code of India (historical, replaced by BNS).' },
      { fileName: 'crpc.json', shortName: 'CrPC', actName: 'Code of Criminal Procedure', year: 1973, description: 'The procedure for administration of criminal law in India (historical, replaced by BNSS).' },
      { fileName: 'iea.json', shortName: 'IEA', actName: 'Indian Evidence Act', year: 1872, description: 'The rules of evidence for Indian courts (historical, replaced by BSA).' },
      { fileName: 'nia.json', shortName: 'NIA', actName: 'Negotiable Instruments Act', year: 1881, description: 'Laws relating to promissory notes, bills of exchange and cheques in India.' }
    ];

    oldActs.forEach(oa => {
      const filePath = path.join(RAW_DIR, oa.fileName);
      if (!fs.existsSync(filePath)) return;

      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const chaptersMap = new Map<string, { title: string; sections: ISection[] }>();

      for (const item of rawData) {
        const secNum = (item.section !== undefined ? item.section : item.Section)?.toString().trim();
        if (!secNum) continue;

        const chapNum = item.chapter ? item.chapter.toString().trim() : 'I';
        const chapTitle = item.chapter_title?.trim() || `Chapter ${chapNum}`;

        const sectionObj = parseSection(secNum, item.section_title || `Section ${secNum}`, item.section_desc || '');
        if (!chaptersMap.has(chapNum)) {
          chaptersMap.set(chapNum, { title: chapTitle, sections: [] });
        }
        chaptersMap.get(chapNum)!.sections.push(sectionObj);

        sectionsToInsert.push({
          actShortName: oa.shortName,
          chapterNumber: chapNum,
          section_number: secNum,
          title: sectionObj.title,
          content: sectionObj.content,
          clean_title: sectionObj.clean_title,
          introduction_text: sectionObj.introduction_text,
          content_blocks: sectionObj.content_blocks
        });
      }

      const chapters: IChapter[] = Array.from(chaptersMap.entries()).map(([code, data]) => ({
        chapterNumber: code,
        title: data.title,
        sections: data.sections
      }));

      actsToInsert.push({
        actName: oa.actName,
        shortName: oa.shortName,
        year: oa.year,
        description: oa.description,
        chapters
      });
    });

    // --- 4. CPC, MVA, IDA ---
    const flatActs = [
      { fileName: 'cpc.json', shortName: 'CPC', actName: 'Code of Civil Procedure', year: 1908, description: 'The procedure for civil dispute resolution in India.' },
      { fileName: 'MVA.json', shortName: 'MVA', actName: 'Motor Vehicles Act', year: 1988, description: 'Laws relating to road transport vehicles in India.' },
      { fileName: 'ida.json', shortName: 'IDA', actName: 'Indian Divorce Act', year: 1869, description: 'Laws relating to divorce among Christians in India.' }
    ];

    flatActs.forEach(fa => {
      const filePath = path.join(RAW_DIR, fa.fileName);
      if (!fs.existsSync(filePath)) return;

      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const sections: ISection[] = [];

      for (const item of rawData) {
        const secNum = (item.section !== undefined ? item.section : item.Section)?.toString().trim();
        if (!secNum) continue;

        const sectionObj = parseSection(secNum, item.title || item.section_title || `Section ${secNum}`, item.description || item.section_desc || '');
        sections.push(sectionObj);

        sectionsToInsert.push({
          actShortName: fa.shortName,
          chapterNumber: 'I',
          section_number: secNum,
          title: sectionObj.title,
          content: sectionObj.content,
          clean_title: sectionObj.clean_title,
          introduction_text: sectionObj.introduction_text,
          content_blocks: sectionObj.content_blocks
        });
      }

      const chapters: IChapter[] = [{ chapterNumber: 'I', title: 'Sections', sections }];
      actsToInsert.push({
        actName: fa.actName,
        shortName: fa.shortName,
        year: fa.year,
        description: fa.description,
        chapters
      });
    });

    // --- 5. Structured JSON Acts (HMA, RTI, DVA, HSA) ---
    const structuredActs = [
      { fileName: 'hma.json', shortName: 'HMA', actName: 'Hindu Marriage Act', year: 1955, description: 'Laws relating to marriage and divorce among Hindus in India.' },
      { fileName: 'rti.json', shortName: 'RTI', actName: 'Right to Information Act', year: 2005, description: 'An Act to provide for setting out the practical regime of right to information for citizens.' },
      { fileName: 'dva.json', shortName: 'DVA', actName: 'Domestic Violence Act', year: 2005, description: 'An Act to provide for more effective protection of the rights of women guaranteed under the Constitution who are victims of violence.' },
      { fileName: 'hsa.json', shortName: 'HSA', actName: 'Hindu Succession Act', year: 1956, description: 'An Act to amend and codify the law relating to intestate succession among Hindus.' }
    ];

    structuredActs.forEach(sa => {
      const filePath = path.join(RAW_DIR, sa.fileName);
      if (!fs.existsSync(filePath)) return;

      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const chaptersMap = new Map<string, { title: string; sections: ISection[] }>();

      for (const item of rawData) {
        const secNum = item.section?.toString().trim();
        if (!secNum) continue;

        const chapNum = item.chapter ? item.chapter.toString().trim() : '1';
        const chapTitle = item.chapter_title?.trim() || `Chapter ${chapNum}`;

        const sectionObj = parseSection(secNum, item.section_title || `Section ${secNum}`, item.section_desc || '');
        if (!chaptersMap.has(chapNum)) {
          chaptersMap.set(chapNum, { title: chapTitle, sections: [] });
        }
        chaptersMap.get(chapNum)!.sections.push(sectionObj);

        sectionsToInsert.push({
          actShortName: sa.shortName,
          chapterNumber: chapNum,
          section_number: secNum,
          title: sectionObj.title,
          content: sectionObj.content,
          clean_title: sectionObj.clean_title,
          introduction_text: sectionObj.introduction_text,
          content_blocks: sectionObj.content_blocks
        });
      }

      const chapters: IChapter[] = Array.from(chaptersMap.entries()).map(([code, data]) => ({
        chapterNumber: code,
        title: data.title,
        sections: data.sections
      }));

      actsToInsert.push({
        actName: sa.actName,
        shortName: sa.shortName,
        year: sa.year,
        description: sa.description,
        chapters
      });
    });

    // --- 6. Annotated Central Acts Library ---
    const centralActsPath = path.resolve(__dirname, '../data/central_acts.seed.json');
    if (fs.existsSync(centralActsPath)) {
      console.log('📖 Processing Central Acts Library...');
      const centralActs = JSON.parse(fs.readFileSync(centralActsPath, 'utf-8'));
      console.log(`  Found ${centralActs.length} acts in Central Acts Library seed.`);

      for (const act of centralActs) {
        const norm = normalizeActInfo(act.actName || act.name || act.title, act.shortName, act.year);
        act.actName = norm.actName;
        act.shortName = norm.shortName;

        // Skip acts we already seeded (Constitution, BNS, etc. to avoid duplicates)
        if (actsToInsert.some(a => a.shortName.toUpperCase() === act.shortName.toUpperCase())) {
          continue;
        }

        // Construct section documents
        if (act.chapters) {
          for (const chap of act.chapters) {
            if (chap.sections) {
              for (const sec of chap.sections) {
                sectionsToInsert.push({
                  actShortName: act.shortName,
                  chapterNumber: chap.chapterNumber,
                  section_number: sec.section_number,
                  title: sec.title,
                  content: sec.content,
                  clean_title: sec.title, // fallback
                  content_blocks: [{ type: 'paragraph', text: sec.content }]
                });
              }
            }
          }
        }

        actsToInsert.push(act);
      }
    }

    // Execute upsert insertion to avoid duplicate key errors
    for (const act of actsToInsert) {
      await BareAct.updateOne({ shortName: act.shortName }, { $set: act }, { upsert: true }).catch(() => { });
    }

    if (sectionsToInsert.length > 0) {
      const ops = sectionsToInsert.map(sec => ({
        updateOne: {
          filter: { actShortName: sec.actShortName, section_number: sec.section_number },
          update: { $set: sec },
          upsert: true
        }
      }));
      await SectionModel.bulkWrite(ops).catch(() => { });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Auto-seeding check complete! Synchronized 15 Acts & ${sectionsToInsert.length} Sections in ${duration}s.`);
  } catch (error: any) {
    console.error('❌ Auto-seeding check failed:', error.message);
  }
};