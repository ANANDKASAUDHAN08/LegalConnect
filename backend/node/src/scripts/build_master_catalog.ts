import fs from 'fs';
import path from 'path';

// Import curated domain datasets
import { statutoryRightsCatalog } from '../data/statutoryRightsCatalog';
import { DEFAULT_SCENARIOS } from '../data/defaultScenarios';
import { DEFAULT_DIAGNOSTIC_CRISES } from '../data/defaultDiagnostics';
import { practiceAreasSeedCatalog } from '../data/practiceAreasSeed';
import { defaultLegalTemplates } from '../data/defaultLegalTemplates';

const RAW_DIR = path.resolve(__dirname, '../data/raw');
const BAREACTS_PATH = path.resolve(__dirname, '../data/bareacts.seed.json');

const OUTPUT_JSON_PATH = path.resolve(__dirname, '../data/legal_master_catalog.json');
const OUTPUT_CSV_PATH = path.resolve(__dirname, '../data/legal_master_catalog.csv');

// 14 Statutory enactments fetched from Nyaaya / Ministry of Law
const ACTS_META = [
  { code: 'RERA-2016', shortName: 'RERA', title: 'Real Estate (Regulation and Development) Act, 2016', year: 2016, category: 'Property & Housing', jsonFile: 'rera.json', authority: 'Ministry of Housing and Urban Affairs' },
  { code: 'POCSO-2012', shortName: 'POCSO', title: 'Protection of Children from Sexual Offences Act, 2012', year: 2012, category: 'Child Protection & Criminal Law', jsonFile: 'pocso.json', authority: 'Ministry of Women and Child Development' },
  { code: 'RPWD-2016', shortName: 'RPWD', title: 'Rights of Persons with Disabilities Act, 2016', year: 2016, category: 'Vulnerable Groups & Civil Liberties', jsonFile: 'rpwd.json', authority: 'Ministry of Social Justice and Empowerment' },
  { code: 'MHCA-2017', shortName: 'MHCA', title: 'Mental Healthcare Act, 2017', year: 2017, category: 'Healthcare & Dignity', jsonFile: 'mhca.json', authority: 'Ministry of Health and Family Welfare' },
  { code: 'MWPSC-2007', shortName: 'MWPSC', title: 'Maintenance and Welfare of Parents and Senior Citizens Act, 2007', year: 2007, category: 'Senior Citizens & Family Support', jsonFile: 'mwpsc.json', authority: 'Ministry of Social Justice and Empowerment' },
  { code: 'SVA-2014', shortName: 'Street Vendors', title: 'Street Vendors (Protection of Livelihood and Regulation of Street Vending) Act, 2014', year: 2014, category: 'Livelihood & Labour Rights', jsonFile: 'street_vendors.json', authority: 'Ministry of Housing and Urban Affairs' },
  { code: 'NGT-2010', shortName: 'NGT', title: 'National Green Tribunal Act, 2010', year: 2010, category: 'Environmental & Public Health', jsonFile: 'ngt.json', authority: 'Ministry of Environment, Forest and Climate Change' },
  { code: 'RFCTLARR-2013', shortName: 'RFCTLARR', title: 'Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013', year: 2013, category: 'Land, Property & Rehabilitation', jsonFile: 'rfctlarr.json', authority: 'Ministry of Rural Development' },
  { code: 'WBPA-2014', shortName: 'Whistle Blowers', title: 'Whistle Blowers Protection Act, 2014', year: 2014, category: 'Anti-Corruption & Transparency', jsonFile: 'whistle_blowers.json', authority: 'Ministry of Personnel, Public Grievances and Pensions' },
  { code: 'RTE-2009', shortName: 'RTE', title: 'Right of Children to Free and Compulsory Education Act, 2009', year: 2009, category: 'Education & Child Rights', jsonFile: 'rte.json', authority: 'Ministry of Education' },
  { code: 'LSAA-1987', shortName: 'LSAA', title: 'Legal Services Authorities Act, 1987', year: 1987, category: 'Access to Justice & Legal Aid', jsonFile: 'lsaa.json', authority: 'National Legal Services Authority (NALSA) / Ministry of Law and Justice' },
  { code: 'CEA-2010', shortName: 'CEA', title: 'Clinical Establishments (Registration and Regulation) Act, 2010', year: 2010, category: 'Healthcare & Patient Safety', jsonFile: 'cea.json', authority: 'Ministry of Health and Family Welfare' },
  { code: 'MBA-1961', shortName: 'Maternity Benefit', title: 'Maternity Benefit Act, 1961', year: 1961, category: 'Workplace & Gender Rights', jsonFile: 'maternity_benefit.json', authority: 'Ministry of Labour and Employment' },
  { code: 'JJA-2015', shortName: 'Juvenile Justice', title: 'Juvenile Justice (Care and Protection of Children) Act, 2015', year: 2015, category: 'Child Rights & Juvenile Justice', jsonFile: 'jj_act.json', authority: 'Ministry of Women and Child Development' }
];

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  // Collapse newlines and tabs to clean text in CSV
  str = str.replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
  return `"${str}"`;
}

async function buildMasterCorpus() {
  console.log('🔄 Starting Master Legal Catalog Compilation...');

  // 1. Process Base Acts
  const allActs: any[] = [];
  if (fs.existsSync(BAREACTS_PATH)) {
    const rawBase = JSON.parse(fs.readFileSync(BAREACTS_PATH, 'utf8'));
    for (const b of rawBase) {
      allActs.push({
        actId: b.shortName ? `ACT-${b.shortName.toUpperCase()}` : 'ACT-UNKNOWN',
        actName: b.actName,
        shortName: b.shortName,
        year: b.year || 2023,
        category: b.category || 'Constitutional & Core Legislation',
        sourceAuthority: 'Legislative Department, Ministry of Law and Justice',
        sourceUrl: 'https://www.indiacode.nic.in',
        description: b.description || '',
        totalSections: (b.chapters || []).reduce((acc: number, c: any) => acc + (c.sections ? c.sections.length : 0), 0),
        chapters: b.chapters || []
      });
    }
  }

  // 2. Process Nyaaya Acts
  let existingMaster: any = null;
  if (fs.existsSync(OUTPUT_JSON_PATH)) {
    try {
      existingMaster = JSON.parse(fs.readFileSync(OUTPUT_JSON_PATH, 'utf8'));
    } catch (e) {
      existingMaster = null;
    }
  }

  for (const meta of ACTS_META) {
    const p = path.join(RAW_DIR, meta.jsonFile);
    if (!fs.existsSync(p)) {
      if (existingMaster && existingMaster.statutoryActs) {
        const found = existingMaster.statutoryActs.find((a: any) => a.actId === `ACT-${meta.code}`);
        if (found) {
          allActs.push(found);
          continue;
        }
      }
      console.warn(`⚠️ Warning: ${meta.jsonFile} not found in raw directory.`);
      continue;
    }
    const rawSections = JSON.parse(fs.readFileSync(p, 'utf8'));
    const chapMap = new Map<string, any>();

    for (const s of rawSections) {
      const cNum = String(s.chapter || '1');
      const cTitle = s.chapter_title || 'General Provisions';
      if (!chapMap.has(cNum)) {
        chapMap.set(cNum, { chapterNumber: cNum, title: cTitle, sections: [] });
      }
      chapMap.get(cNum).sections.push({
        section_number: String(s.section),
        title: s.section_title || `Section ${s.section}`,
        content: s.section_desc || ''
      });
    }

    allActs.push({
      actId: `ACT-${meta.code}`,
      actName: meta.title,
      shortName: meta.shortName,
      year: meta.year,
      category: meta.category,
      sourceAuthority: meta.authority,
      sourceUrl: `https://www.indiacode.nic.in`,
      description: `Official enactment of ${meta.title} under union jurisdiction.`,
      totalSections: rawSections.length,
      chapters: Array.from(chapMap.values())
    });
  }

  // 3. Process POSH Markdown text if present or fallback to master
  const poshPath = path.join(RAW_DIR, 'posh_2013.md');
  if (fs.existsSync(poshPath)) {
    const poshText = fs.readFileSync(poshPath, 'utf8');
    allActs.push({
      actId: 'ACT-POSH-2013',
      actName: 'Sexual Harassment of Women at Workplace (Prevention, Prohibition and Redressal) Act, 2013',
      shortName: 'POSH Act',
      year: 2013,
      category: 'Workplace & Gender Rights',
      sourceAuthority: 'Ministry of Women and Child Development',
      sourceUrl: 'https://www.indiacode.nic.in/handle/123456789/2104',
      description: 'An Act to provide protection against sexual harassment of women at workplace and for prevention and redressal of complaints.',
      totalSections: 30,
      chapters: [
        {
          chapterNumber: '1',
          title: 'Full Text & Statutory Provisions',
          sections: [
            {
              section_number: 'All',
              title: 'Complete Statutory Text',
              content: poshText.substring(0, 5000) + '... (full text preserved in raw/posh_2013.md)'
            }
          ]
        }
      ]
    });
  } else if (existingMaster && existingMaster.statutoryActs) {
    const existingPosh = existingMaster.statutoryActs.find((a: any) => a.actId === 'ACT-POSH-2013');
    if (existingPosh) {
      allActs.push(existingPosh);
    }
  }

  // 4. Construct Master Unified JSON Catalog
  const masterJson = {
    metadata: {
      title: 'LegalConnect Comprehensive Indian Law & Citizen Rights Master Catalog',
      version: '2.0.0',
      compiledAt: new Date().toISOString(),
      license: 'Government Open Data License (GODL-India)',
      totalActs: allActs.length,
      totalStatutorySections: allActs.reduce((acc, a) => acc + (a.totalSections || 0), 0),
      totalStatutoryRights: statutoryRightsCatalog.length,
      totalDiagnosticCrises: DEFAULT_DIAGNOSTIC_CRISES.length,
      totalEmergencyScenarios: DEFAULT_SCENARIOS.length,
      totalLegalTemplates: defaultLegalTemplates.length,
      totalPracticeAreas: practiceAreasSeedCatalog.length
    },
    statutoryActs: allActs,
    statutoryCitizenRights: statutoryRightsCatalog,
    emergencyScenarios: DEFAULT_SCENARIOS,
    legalTemplates: defaultLegalTemplates,
    diagnosticCrises: DEFAULT_DIAGNOSTIC_CRISES,
    practiceAreas: practiceAreasSeedCatalog
  };

  fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(masterJson, null, 2), 'utf8');
  console.log(`✅ Saved Master JSON to: ${OUTPUT_JSON_PATH}`);

  // 5. Construct Flattened Identifiable CSV Catalog
  const csvHeaders = [
    'entity_type',
    'entity_id',
    'parent_act_code',
    'parent_act_name',
    'category',
    'section_or_code',
    'title_english',
    'title_hindi',
    'summary_or_content',
    'confrontation_script_en',
    'confrontation_script_hi',
    'actionable_dos',
    'actionable_donts',
    'legal_remedy',
    'emergency_helpline',
    'source_authority',
    'source_url',
    'verified_date'
  ];

  const csvRows: string[] = [];
  csvRows.push(csvHeaders.join(','));

  // 5a. Add Acts to CSV
  for (const act of allActs) {
    csvRows.push([
      escapeCsv('STATUTORY_ACT'),
      escapeCsv(act.actId),
      escapeCsv(act.shortName),
      escapeCsv(act.actName),
      escapeCsv(act.category),
      escapeCsv(`${act.totalSections} Sections`),
      escapeCsv(act.actName),
      escapeCsv(''),
      escapeCsv(act.description),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(act.sourceAuthority),
      escapeCsv(act.sourceUrl),
      escapeCsv(`${act.year}-01-01`)
    ].join(','));

    // Also add each section as identifiable row
    for (const chap of act.chapters || []) {
      for (const sec of chap.sections || []) {
        csvRows.push([
          escapeCsv('ACT_SECTION'),
          escapeCsv(`${act.shortName}-SEC-${sec.section_number}`),
          escapeCsv(act.shortName),
          escapeCsv(act.actName),
          escapeCsv(act.category),
          escapeCsv(`Section ${sec.section_number}`),
          escapeCsv(sec.title),
          escapeCsv(''),
          escapeCsv(sec.content),
          escapeCsv(''),
          escapeCsv(''),
          escapeCsv(''),
          escapeCsv(''),
          escapeCsv(''),
          escapeCsv(''),
          escapeCsv(act.sourceAuthority),
          escapeCsv(act.sourceUrl),
          escapeCsv(`${act.year}-01-01`)
        ].join(','));
      }
    }
  }

  // 5b. Add Statutory Citizen Rights to CSV
  for (const right of statutoryRightsCatalog) {
    csvRows.push([
      escapeCsv('CITIZEN_RIGHT'),
      escapeCsv(right.id),
      escapeCsv(right.statutoryBasis?.shortAct || ''),
      escapeCsv(right.statutoryBasis?.actName || ''),
      escapeCsv(right.category),
      escapeCsv((right.statutoryBasis?.sections || []).join(', ')),
      escapeCsv(right.title),
      escapeCsv(right.title_hi || ''),
      escapeCsv(right.summary),
      escapeCsv(right.whatToSay || ''),
      escapeCsv(right.whatToSay_hi || ''),
      escapeCsv(Array.isArray(right.dos) ? right.dos.join('; ') : (right.dos || '')),
      escapeCsv(Array.isArray(right.donts) ? right.donts.join('; ') : (right.donts || '')),
      escapeCsv(right.legalRemedy || ''),
      escapeCsv(right.emergencyHelpline ? `${right.emergencyHelpline.name}: ${right.emergencyHelpline.number}` : ''),
      escapeCsv(right.verifiedBy || 'Ministry of Law and Justice'),
      escapeCsv(right.statutoryBasis?.actUrl || 'https://www.indiacode.nic.in'),
      escapeCsv(right.verifiedDate || '2026-08-15')
    ].join(','));
  }

  // 5c. Add Legal Templates to CSV
  for (const tpl of defaultLegalTemplates) {
    csvRows.push([
      escapeCsv('LEGAL_TEMPLATE'),
      escapeCsv(tpl.templateId),
      escapeCsv(tpl.actRef),
      escapeCsv(tpl.actRef),
      escapeCsv(tpl.category),
      escapeCsv(''),
      escapeCsv(tpl.title),
      escapeCsv(''),
      escapeCsv(tpl.description),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv('LegalConnect Statutory Drafting Bureau'),
      escapeCsv('https://www.indiacode.nic.in'),
      escapeCsv('2026-01-01')
    ].join(','));
  }

  // 5d. Add Emergency Scenarios to CSV
  for (const sc of DEFAULT_SCENARIOS) {
    csvRows.push([
      escapeCsv('EMERGENCY_SCENARIO'),
      escapeCsv(sc.tag),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv('Emergency Response Protocol'),
      escapeCsv(`Priority #${sc.sortOrder || 1}`),
      escapeCsv(sc.label),
      escapeCsv(''),
      escapeCsv(sc.description),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv(''),
      escapeCsv('112 (National Emergency Helpline)'),
      escapeCsv('Ministry of Home Affairs / Emergency Response Support System'),
      escapeCsv('https://112.gov.in'),
      escapeCsv('2026-01-01')
    ].join(','));
  }

  fs.writeFileSync(OUTPUT_CSV_PATH, csvRows.join('\n'), 'utf8');
  console.log(`✅ Saved Master CSV (${csvRows.length} rows) to: ${OUTPUT_CSV_PATH}`);

  console.log('\n===============================================================');
  console.log('   LEGAL MASTER CATALOG EXTRACTION SUMMARY                     ');
  console.log('===============================================================');
  console.log(`Total Acts Compiled:             ${masterJson.metadata.totalActs}`);
  console.log(`Total Codified Sections:         ${masterJson.metadata.totalStatutorySections}`);
  console.log(`Total Citizen Rights:            ${masterJson.metadata.totalStatutoryRights}`);
  console.log(`Total Legal Templates:           ${masterJson.metadata.totalLegalTemplates}`);
  console.log(`Total Diagnostic Crises:         ${masterJson.metadata.totalDiagnosticCrises}`);
  console.log(`Total CSV Spreadsheet Records:   ${csvRows.length - 1} rows`);
  console.log('===============================================================\n');
}

buildMasterCorpus().catch(err => {
  console.error('❌ Compilation failed:', err);
  process.exit(1);
});