/**
 * Utility functions for cleaning, normalizing, and formatting legal Act names and short codes.
 */

const MINOR_WORDS = new Set([
  'of', 'and', 'the', 'in', 'for', 'to', 'on', 'by', 'or', 'under', 'with', 'as', 'a', 'an', 're'
]);

/**
 * Comprehensive mapping of known Indian legislative act abbreviations.
 * Sourced from conventions used in Indian Kanoon, SCC Online, Manupatra, and Bar Council records.
 * This prevents garbage auto-generated abbreviations for well-known statutes.
 */
const SHORT_NAME_MAP: Record<string, string> = {
  // --- Fixes for known garbage auto-generated codes ---
  'A(DOFAOSBAS': 'AADHAAR',
  'DOFAOSBAS': 'AADHAAR',
  'THCC': 'THCC',
  '`THCC': 'THCC',
  'HCC': 'THCC',
  'INDIAN_TRUSTS_1882': 'TRUSTS',
  'INDIAN_TRUSTS': 'TRUSTS',
  'AT(': 'ATM',
  'AP(AM': 'APGM',
  'AOSAIR2': 'ASIR',
  'AOCAAA': 'ACAA',
  'AAPFPEDA': 'APEDA',
  'APCP': 'APCP',

  // --- Core Criminal Law ---
  'IPC': 'IPC',
  'BNS': 'BNS',
  'CRPC': 'CrPC',
  'CrPC': 'CrPC',
  'BNSS': 'BNSS',
  'BSA': 'BSA',
  'IEA': 'IEA',

  // --- Civil & Commercial ---
  'CPC': 'CPC',
  'ICA': 'ICA',
  'SGA': 'SGA',
  'TPA': 'TPA',
  'IDA': 'IDA',
  'NIA': 'NIA',
  'SARFAESI': 'SARFAESI',
  'IBC': 'IBC',

  // --- Constitutional & Administrative ---
  'COI': 'COI',
  'RTI': 'RTI',
  'RPAT': 'RPAT',

  // --- Financial & Regulatory ---
  'RERA': 'RERA',
  'SEBI': 'SEBI',
  'FEMA': 'FEMA',
  'PMLA': 'PMLA',
  'GST': 'GST',
  'CGST': 'CGST',
  'IGST': 'IGST',
  'IT-ACT': 'IT-ACT',

  // --- Labour & Employment ---
  'POSH': 'POSH',
  'ESI': 'ESI',
  'EPF': 'EPF',
  'MW': 'MWA',
  'ID': 'IDA',

  // --- Criminal Special Laws ---
  'NDPS': 'NDPS',
  'POCSO': 'POCSO',
  'UAPA': 'UAPA',
  'SC/ST': 'SCST',
  'PCMA': 'PCMA',
  'DV': 'DVA',
  'JJ': 'JJA',

  // --- Environmental ---
  'EPA': 'EPA',
  'WPA': 'WPA',
  'FA': 'FCA',
  'APC': 'APCA',

  // --- Intellectual Property ---
  'PA': 'PAT',
  'CA': 'COPY',
  'TMA': 'TMA',
  'DA': 'DSGN',

  // --- Corporate & Company ---
  'CA2013': 'CA2013',
  'LLP': 'LLP',
  'SCRA': 'SCRA',

  // --- Family & Personal Law ---
  'HMA': 'HMA',
  'SMA': 'SMA',
  'DMMA': 'DMMA',
  'HSA': 'HSA',
  'ISA': 'ISA',
  'GWA': 'GWA',

  // --- Land & Property ---
  'LA': 'LARR',
  'RFCTLARR': 'LARR',
  'RA': 'REG',
  'ISA1882': 'ISA',

  // --- Modern Digital & Tech ---
  'ITAA': 'ITAA',
  'DPDP': 'DPDP',

  // --- Advocates & Legal ---
  'AA': 'ADV',
  'AMF': 'ADWF',
  'ADF': 'ADF',
};

/**
 * Pattern-based short name lookup by act title keywords.
 * Matches when the act title (uppercase) contains the given keyword.
 */
const TITLE_TO_SHORT: Array<[string, string]> = [
  ['AADHAAR', 'AADHAAR'],
  ['HOMOEOPATHY CENTRAL COUNCIL', 'THCC'],
  ['BHARATIYA NYAYA SANHITA', 'BNS'],
  ['BHARATIYA NAGARIK SURAKSHA SANHITA', 'BNSS'],
  ['BHARATIYA SAKSHYA', 'BSA'],
  ['INDIAN PENAL CODE', 'IPC'],
  ['CODE OF CRIMINAL PROCEDURE', 'CrPC'],
  ['CODE OF CIVIL PROCEDURE', 'CPC'],
  ['INDIAN EVIDENCE ACT', 'IEA'],
  ['INFORMATION TECHNOLOGY', 'ITA'],
  ['RIGHT TO INFORMATION', 'RTI'],
  ['PREVENTION OF CORRUPTION', 'PCA'],
  ['SEXUAL HARASSMENT.*WORKPLACE', 'POSH'],
  ['PROTECTION OF CHILDREN FROM SEXUAL', 'POCSO'],
  ['NARCOTIC DRUGS', 'NDPS'],
  ['PREVENTION OF MONEY LAUNDERING', 'PMLA'],
  ['FOREIGN EXCHANGE MANAGEMENT', 'FEMA'],
  ['INSOLVENCY AND BANKRUPTCY', 'IBC'],
  ['REAL ESTATE.*REGULATION', 'RERA'],
  ['GOODS AND SERVICES TAX', 'GST'],
  ['CONSUMER PROTECTION', 'CPA'],
  ['MOTOR VEHICLES', 'MVA'],
  ['NEGOTIABLE INSTRUMENTS', 'NIA'],
  ['ARBITRATION AND CONCILIATION', 'ACA'],
  ['HINDU MARRIAGE', 'HMA'],
  ['SPECIAL MARRIAGE', 'SMA'],
  ['GUARDIANS AND WARDS', 'GWA'],
  ['DOMESTIC VIOLENCE', 'DVA'],
  ['JUVENILE JUSTICE', 'JJA'],
  ['SCHEDULED CASTES.*SCHEDULED TRIBES', 'SCST'],
  ['COMPANIES ACT.*2013', 'CA2013'],
  ['LIMITED LIABILITY PARTNERSHIP', 'LLP'],
  ['TRADE MARKS', 'TMA'],
  ['PATENTS ACT', 'PAT'],
  ['COPYRIGHT', 'COPY'],
  ['SPECIFIC RELIEF', 'SRA'],
  ['TRANSFER OF PROPERTY', 'TPA'],
  ['INDIAN CONTRACT', 'ICA'],
  ['SALE OF GOODS', 'SGA'],
  ['INDIAN TRUSTS', 'TRUSTS'],
  ['INDIAN SUCCESSION', 'ISA'],
  ['REGISTRATION ACT', 'REG'],
  ['STAMP ACT', 'STAMP'],
  ['ELECTRICITY ACT', 'ELEC'],
  ['ENVIRONMENT.*PROTECTION', 'EPA'],
  ['WILDLIFE.*PROTECTION', 'WPA'],
  ['FOREST.*CONSERVATION', 'FCA'],
  ['AIR.*PREVENTION.*CONTROL.*POLLUTION', 'APCA'],
  ['WATER.*PREVENTION.*CONTROL.*POLLUTION', 'WPCA'],
  ['ADVOCATES ACT', 'ADV'],
  ['ADVOCATES.*WELFARE FUND', 'ADWF'],
  ['AFRICAN DEVELOPMENT FUND', 'ADF'],
  ['ADMINISTRATIVE TRIBUNALS', 'ATA'],
  ['ANTIQUITIES.*ART TREASURES', 'AATA'],
  ['AGRICULTURAL.*PROCESSED FOOD.*EXPORT', 'APEDA'],
  ['AGRICULTURAL PRODUCE.*GRADING', 'APGM'],
  ['ACQUIRED TERRITORIES.*MERGER', 'ATM'],
  ['ACQUISITION.*AYODHYA', 'ACAA'],
  ['ADMIRALTY.*JURISDICTION', 'AJSM'],
  ['ACADEMY.*SCIENTIFIC.*INNOVATIVE', 'ASIR'],
];

/**
 * Converts a string to Title Case following legal title conventions.
 */
export function toLegalTitleCase(str: string): string {
  if (!str) return str;

  // Split into words preserving parentheses
  const words = str.trim().split(/\s+/);
  return words.map((word, index) => {
    let prefix = '';
    let suffix = '';
    let core = word;

    // Handle leading/trailing symbols or punctuation like ( or ) or ,
    while (core.length > 0 && /^[^a-zA-Z0-9]/.test(core)) {
      prefix += core[0];
      core = core.slice(1);
    }
    while (core.length > 0 && /[^a-zA-Z0-9]$/.test(core)) {
      suffix = core[core.length - 1] + suffix;
      core = core.slice(0, -1);
    }

    if (!core) return word;

    const lowerCore = core.toLowerCase();

    // IMPORTANT: Check minor connector words FIRST (before acronym check)
    // This prevents "OF", "AND", "THE" from being treated as acronyms
    if (index > 0 && MINOR_WORDS.has(lowerCore)) {
      return prefix + lowerCore + suffix;
    }

    // Known legal/government acronyms that should stay uppercase
    const KNOWN_ACRONYMS = new Set([
      'GST', 'CGST', 'IGST', 'SGST', 'RERA', 'SEBI', 'FEMA', 'PMLA', 'RBI',
      'IPC', 'BNS', 'BNSS', 'BSA', 'IEA', 'NIA', 'NDPS', 'POCSO', 'UAPA',
      'CPC', 'ICA', 'SGA', 'TPA', 'IDA', 'IBC', 'RTI', 'POSH', 'ESI', 'EPF',
      'EPA', 'WPA', 'LLP', 'TMA', 'SCRA', 'HMA', 'SMA', 'SARFAESI',
      'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII', 'XIII', 'XIV', 'XV',
      'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI',
      'SC', 'ST', 'OBC', 'ATM', 'IT', 'AI', 'UN', 'EU', 'UK', 'US', 'USA',
      'NITI', 'DPDP', 'ITAA', 'AADHAR', 'AADHAAR'
    ]);

    // Only preserve as uppercase if it's a KNOWN acronym or a pure number
    if (KNOWN_ACRONYMS.has(core) || /^\d+$/.test(core)) {
      return prefix + core + suffix;
    }

    // Capitalize first character (proper title case for everything else)
    return prefix + lowerCore.charAt(0).toUpperCase() + lowerCore.slice(1) + suffix;
  }).join(' ');
}

/**
 * Generates a clean, readable short abbreviation from an act title.
 * Unlike the previous version, this never produces garbage with parentheses.
 */
function generateCleanAbbreviation(actName: string): string {
  // 1. Try to match against known title patterns first
  const upper = actName.toUpperCase();
  for (const [pattern, code] of TITLE_TO_SHORT) {
    if (new RegExp(pattern).test(upper)) {
      return code;
    }
  }

  // 2. Generate from significant words (strip parenthetical content first)
  const cleaned = actName.replace(/\([^)]*\)/g, '').replace(/[^a-zA-Z\s]/g, '');
  const words = cleaned.split(/\s+/).filter(w =>
    w.length > 2 && !MINOR_WORDS.has(w.toLowerCase())
  );

  if (words.length === 0) return 'ACT';

  // Take first letters of up to 4 significant words
  let abbr = words.slice(0, 4).map(w => w[0].toUpperCase()).join('');

  // If result is too short (< 2 chars), use first 3 chars of first significant word
  if (abbr.length < 2 && words[0]) {
    abbr = words[0].substring(0, 3).toUpperCase();
  }

  // If result is too long (> 8 chars), truncate
  if (abbr.length > 8) {
    abbr = abbr.substring(0, 6);
  }

  // Final validation: must be alphanumeric only
  abbr = abbr.replace(/[^A-Z0-9]/g, '');

  return abbr || 'ACT';
}

/**
 * Normalizes raw act titles and short codes into clean, professional, standardized formats.
 */
export function normalizeActInfo(
  rawName: string,
  rawShortName: string,
  rawYear?: number | string
): { actName: string; shortName: string } {
  let actName = (rawName || '').trim();
  let shortName = (rawShortName || '').trim();
  const year = rawYear ? Number(rawYear) : undefined;

  // 1. Strip noise characters (backticks, escaped quotes, stray symbols)
  actName = actName
    .replace(/^[`'"\s\\–—-]+/, '')
    .replace(/[`'"\s\\–—-]+$/, '')
    .replace(/`/g, '')
    .trim();

  shortName = shortName
    .replace(/^[`'"\s\\–—-]+/, '')
    .replace(/[`'"\s\\–—-]+$/, '')
    .replace(/`/g, '')
    .trim();

  // 2. Normalize Short Name
  if (SHORT_NAME_MAP[shortName]) {
    shortName = SHORT_NAME_MAP[shortName];
  } else if (
    shortName.includes('(') ||  // Contains parentheses = garbage
    shortName.length > 8 ||     // Too long = unreadable
    /[^A-Z0-9\-_]/.test(shortName) || // Contains invalid chars
    shortName.length < 2        // Too short
  ) {
    // Try title-based lookup first, then generate clean abbreviation
    shortName = generateCleanAbbreviation(actName);
  }

  // 3. Specific Act Title Overrides & Cleanups
  const upperName = actName.toUpperCase();

  if (upperName.includes('HOMOEOPATHY CENTRAL COUNCIL')) {
    actName = 'The Homoeopathy Central Council Act, 1973';
    shortName = 'THCC';
  } else if (upperName.startsWith('AADHAAR')) {
    actName = 'Aadhaar (Targeted Delivery of Financial and Other Subsidies, Benefits and Services) Act, 2016';
    shortName = 'AADHAAR';
  } else {
    // Convert ALL CAPS titles to Title Case
    if (actName === actName.toUpperCase()) {
      actName = toLegalTitleCase(actName);
    } else {
      // Still ensure proper title case for first letter
      actName = toLegalTitleCase(actName);
    }

    // Append 'Act' if missing and not Code/Sanhita/Adhiniyam/Constitution/Rules
    const lower = actName.toLowerCase();
    if (
      !lower.includes('act') &&
      !lower.includes('sanhita') &&
      !lower.includes('adhiniyam') &&
      !lower.includes('code') &&
      !lower.includes('constitution') &&
      !lower.includes('rules')
    ) {
      actName = `${actName} Act`;
    }

    // Append year if provided and not already in title
    if (year && !actName.includes(String(year))) {
      actName = `${actName}, ${year}`;
    }
  }

  return { actName, shortName };
}

/**
 * Category taxonomy constants used across the Indian legal corpus.
 * Modeled after classification systems used by Indian Kanoon, SCC Online, and Manupatra.
 */
export type ActCategory =
  | 'CONSTITUTIONAL'
  | 'CRIMINAL'
  | 'CIVIL'
  | 'COMMERCIAL'
  | 'FINANCIAL'
  | 'LABOUR'
  | 'ADMINISTRATIVE'
  | 'ENVIRONMENTAL'
  | 'FAMILY'
  | 'PROPERTY'
  | 'IP'
  | 'DEFENCE'
  | 'SPECIAL';

/**
 * Classifies an act into a legal domain category based on its title.
 */
const CATEGORY_PATTERNS: Array<[RegExp, ActCategory]> = [
  [/CONSTITUTION/i, 'CONSTITUTIONAL'],
  [/RIGHT TO INFORMATION/i, 'CONSTITUTIONAL'],
  [/REPRESENTATION.*PEOPLE/i, 'CONSTITUTIONAL'],
  [/CITIZENSHIP/i, 'CONSTITUTIONAL'],
  [/ELECTION/i, 'CONSTITUTIONAL'],

  [/PENAL|CRIMINAL|NYAYA SANHITA|NAGARIK SURAKSHA|SAKSHYA|EVIDENCE|NARCOTIC|POCSO|ARMS ACT|EXPLOSIVE|UNLAWFUL ACTIVITIES|TERRORISM|SEDITION/i, 'CRIMINAL'],

  [/CIVIL PROCEDURE|LIMITATION|SPECIFIC RELIEF|ARBITRATION|CONCILIATION/i, 'CIVIL'],

  [/COMPAN|INSOLVENCY|BANKRUPTCY|LLP|PARTNERSHIP|SECURITIES|SARFAESI|NEGOTIABLE|CONTRACT|SALE OF GOODS/i, 'COMMERCIAL'],

  [/TAX|GST|GOODS AND SERVICE|INCOME|CUSTOMS|EXCISE|FINANCE|BANKING|INSURANCE|RBI|SEBI|FEMA|MONEY LAUNDERING|STAMP|FOREIGN EXCHANGE|BENAMI/i, 'FINANCIAL'],

  [/LABOUR|INDUSTRIAL|WAGE|EMPLOYEE|FACTORY|MINE|PLANTATION|GRATUITY|PROVIDENT|TRADE UNION|WORKMEN|BONUS|APPRENTICE|MATERNITY|SEXUAL HARASSMENT|POSH/i, 'LABOUR'],

  [/TRIBUNAL|ADMINISTRATIVE|COMMISSION|AUTHORITY|REGULATORY|TELECOM|ELECTRICITY|RAIL|AIRPORT|PORT|HIGHWAY|METRO|MUNICIPAL/i, 'ADMINISTRATIVE'],

  [/ENVIRONMENT|POLLUTION|FOREST|WILDLIFE|WATER.*PREVENTION|AIR.*PREVENTION|BIOLOGICAL DIVERSITY|COASTAL/i, 'ENVIRONMENTAL'],

  [/MARRIAGE|DIVORCE|ADOPTION|MAINTENANCE|CUSTODY|GUARDIAN|SUCCESSION|DOWRY|DOMESTIC VIOLENCE|MUSLIM WOMEN|HINDU/i, 'FAMILY'],

  [/PROPERTY|TRANSFER|REGISTRATION|LAND|ACQUISITION|REHABILITATION|RESETTLEMENT|REAL ESTATE|RERA|TENANCY|RENT/i, 'PROPERTY'],

  [/PATENT|COPYRIGHT|TRADEMARK|DESIGN|GEOGRAPHICAL INDICATION|TRADE MARK/i, 'IP'],

  [/ARMY|NAVY|AIR FORCE|ARMED FORCES|DEFENCE|CANTONMENT|TERRITORIAL|COAST GUARD|BSF|CISF|CRPF/i, 'DEFENCE'],
];

export function classifyActCategory(actName: string): ActCategory {
  const upper = (actName || '').toUpperCase();
  for (const [pattern, category] of CATEGORY_PATTERNS) {
    if (pattern.test(upper)) {
      return category;
    }
  }
  return 'SPECIAL';
}

/**
 * Generates a deterministic hierarchical URN for an act.
 * Format: IN:ACT:<CATEGORY>:<SHORTNAME>:<YEAR>
 */
export function generateHierarchicalId(
  shortName: string,
  year: number | string | undefined,
  category: ActCategory
): string {
  const y = year ? String(year) : '0000';
  const code = (shortName || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `IN:ACT:${category}:${code}:${y}`;
}

/**
 * Generates a section-level hierarchical URN.
 * Format: IN:ACT:<SHORTNAME>:<YEAR>:SEC:<SECTION_NUMBER>
 */
export function generateSectionHierarchicalId(
  shortName: string,
  year: number | string | undefined,
  sectionNumber: string
): string {
  const y = year ? String(year) : '0000';
  const code = (shortName || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const secNum = (sectionNumber || '0').replace(/[^A-Za-z0-9_-]/g, '');
  return `IN:ACT:${code}:${y}:SEC:${secNum}`;
}

/**
 * Builds a reverse alias map from the SHORT_NAME_MAP.
 * Maps clean codes BACK to their legacy/raw codes.
 * Example: { 'ASIR': ['AOSAIR2'], 'ATM': ['AT('], 'THCC': ['HCC', '`THCC'] }
 */
export function buildReverseAliasMap(): Map<string, string[]> {
  const reverseMap = new Map<string, string[]>();
  for (const [rawCode, cleanCode] of Object.entries(SHORT_NAME_MAP)) {
    if (rawCode === cleanCode) continue; // Skip identity mappings
    const existing = reverseMap.get(cleanCode) || [];
    existing.push(rawCode);
    reverseMap.set(cleanCode, existing);
  }
  return reverseMap;
}

/**
 * Returns the internal SHORT_NAME_MAP for external use (e.g. registry population).
 */
export function getShortNameMap(): Record<string, string> {
  return { ...SHORT_NAME_MAP };
}

/**
 * Returns the TITLE_TO_SHORT patterns for external use.
 */
export function getTitleToShortPatterns(): Array<[string, string]> {
  return [...TITLE_TO_SHORT];
}