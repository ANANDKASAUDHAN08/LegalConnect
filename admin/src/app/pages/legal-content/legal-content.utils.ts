import { BareAct } from './legal-content.models';

export interface CategoryTheme {
  name: string;
  badgeClass: string;
  glowClass: string;
  stripeGradient: string;
  bgGlow: string;
  iconSvg: string;
}

export interface DensityBadge {
  label: string;
  class: string;
  tooltip: string;
}

export interface EraBadgeInfo {
  label: string;
  tag: string;
  class: string;
}

/** Memoization Cache Map for Category Theme Lookups */
const themeCache = new Map<string, CategoryTheme>();

/**
 * Resolves the visual theme attributes (color badge, hover glow, accent stripe, ambient light, icon SVG)
 * for a given BareAct based on its explicit category or inferred legal domain.
 */
export function getCategoryTheme(act: BareAct): CategoryTheme {
  const cacheKey = `${act._id || act.shortName}_${act.category || ''}`;
  if (themeCache.has(cacheKey)) {
    return themeCache.get(cacheKey)!;
  }

  const cat = (act.category || '').toUpperCase();
  const nameUpper = (act.actName || '').toUpperCase();
  const shortUpper = (act.shortName || '').toUpperCase();

  let theme: CategoryTheme;

  // 1. Criminal Law
  if (
    cat.includes('CRIMINAL') ||
    shortUpper.includes('IPC') ||
    shortUpper.includes('BNS') ||
    shortUpper.includes('CRPC') ||
    shortUpper.includes('BSA') ||
    shortUpper.includes('IEA') ||
    nameUpper.includes('PENAL') ||
    nameUpper.includes('CRIMINAL') ||
    nameUpper.includes('OFFENCES')
  ) {
    theme = {
      name: 'CRIMINAL',
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/35 shadow-rose-500/10',
      glowClass: 'hover:border-rose-500/50 hover:shadow-rose-500/15',
      stripeGradient: 'linear-gradient(90deg, #f43f5e, #e11d48, #fda4af)',
      bgGlow: 'rgba(244, 63, 94, 0.04)',
      iconSvg: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'
    };
  }
  // 2. Commercial / Business / Corporate / Trade
  else if (
    cat.includes('COMMERCIAL') ||
    cat.includes('COMPANY') ||
    shortUpper.includes('COMP') ||
    shortUpper.includes('SEBI') ||
    shortUpper.includes('RBI') ||
    shortUpper.includes('GST') ||
    nameUpper.includes('COMMERCIAL') ||
    nameUpper.includes('COMPANY') ||
    nameUpper.includes('CONTRACT') ||
    nameUpper.includes('PARTNERSHIP') ||
    nameUpper.includes('SALE OF GOODS') ||
    nameUpper.includes('ARBITRATION')
  ) {
    theme = {
      name: 'COMMERCIAL',
      badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/35 shadow-indigo-500/10',
      glowClass: 'hover:border-indigo-500/50 hover:shadow-indigo-500/15',
      stripeGradient: 'linear-gradient(90deg, #6366f1, #4f46e5, #818cf8)',
      bgGlow: 'rgba(99, 102, 241, 0.04)',
      iconSvg: 'M20 7h-3a2 2 0 0 0-2-2h-6a2 2 0 0 0-2 2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z'
    };
  }
  // 3. Financial / Tax / Revenue
  else if (
    cat.includes('FINAN') ||
    cat.includes('TAX') ||
    cat.includes('BANK') ||
    shortUpper.includes('IT') ||
    shortUpper.includes('GST') ||
    nameUpper.includes('TAX') ||
    nameUpper.includes('BANKING') ||
    nameUpper.includes('REVENUE') ||
    nameUpper.includes('MONEY') ||
    nameUpper.includes('FINANCE')
  ) {
    theme = {
      name: 'FINANCIAL',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 shadow-emerald-500/10',
      glowClass: 'hover:border-emerald-500/50 hover:shadow-emerald-500/15',
      stripeGradient: 'linear-gradient(90deg, #10b981, #059669, #34d399)',
      bgGlow: 'rgba(16, 185, 129, 0.04)',
      iconSvg: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'
    };
  }
  // 4. Constitutional / Governance
  else if (
    cat.includes('CONST') ||
    cat.includes('ADMIN') ||
    shortUpper.includes('CONST') ||
    nameUpper.includes('CONSTITUTION') ||
    nameUpper.includes('CITIZEN') ||
    nameUpper.includes('ELECTION') ||
    nameUpper.includes('PARLIAMENT') ||
    nameUpper.includes('RIGHT')
  ) {
    theme = {
      name: 'CONSTITUTIONAL',
      badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/35 shadow-purple-500/10',
      glowClass: 'hover:border-purple-500/50 hover:shadow-purple-500/15',
      stripeGradient: 'linear-gradient(90deg, #a855f7, #9333ea, #c084fc)',
      bgGlow: 'rgba(168, 85, 247, 0.04)',
      iconSvg: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'
    };
  }
  // 5. IP & Technology / Cyber
  else if (
    cat.includes('IP') ||
    cat.includes('TECH') ||
    cat.includes('CYBER') ||
    shortUpper.includes('IT') ||
    shortUpper.includes('PATENT') ||
    nameUpper.includes('INFORMATION TECHNOLOGY') ||
    nameUpper.includes('PATENT') ||
    nameUpper.includes('COPYRIGHT') ||
    nameUpper.includes('TRADEMARK')
  ) {
    theme = {
      name: 'IP & TECH',
      badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/35 shadow-cyan-500/10',
      glowClass: 'hover:border-cyan-500/50 hover:shadow-cyan-500/15',
      stripeGradient: 'linear-gradient(90deg, #06b6d4, #0891b2, #22d3ee)',
      bgGlow: 'rgba(6, 182, 212, 0.04)',
      iconSvg: 'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 17.93a8 8 0 0 1-7-7.93h7zm0-9.93V4.07a8 8 0 0 1 7 7.93z'
    };
  }
  // 6. Civil & Property / Family
  else if (
    cat.includes('CIVIL') ||
    cat.includes('FAMILY') ||
    cat.includes('PROP') ||
    nameUpper.includes('CIVIL') ||
    nameUpper.includes('MARRIAGE') ||
    nameUpper.includes('SUCCESSION') ||
    nameUpper.includes('PROPERTY') ||
    nameUpper.includes('TRANSFER')
  ) {
    theme = {
      name: 'CIVIL',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/35 shadow-amber-500/10',
      glowClass: 'hover:border-amber-500/50 hover:shadow-amber-500/15',
      stripeGradient: 'linear-gradient(90deg, #f59e0b, #d97706, #fbbf24)',
      bgGlow: 'rgba(245, 158, 11, 0.04)',
      iconSvg: 'M3 6l9-4 9 4v12l-9 4-9-4V6z'
    };
  }
  // 7. Default General Statute
  else {
    theme = {
      name: act.category?.toUpperCase() || 'STATUTE',
      badgeClass: 'bg-slate-800/80 text-indigo-300 border-slate-700/60 shadow-black/10',
      glowClass: 'hover:border-indigo-500/40 hover:shadow-indigo-500/10',
      stripeGradient: 'linear-gradient(90deg, #6366f1, #818cf8, #a5b4fc)',
      bgGlow: 'rgba(99, 102, 241, 0.02)',
      iconSvg: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'
    };
  }

  themeCache.set(cacheKey, theme);
  return theme;
}

/**
 * Classifies an Act into section density tiers for badge visualization.
 */
export function getDensityBadge(sectionsCount: number): DensityBadge {
  if (sectionsCount >= 300) {
    return {
      label: 'Major Code',
      class: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
      tooltip: `High density statutory code (${sectionsCount} sections)`
    };
  } else if (sectionsCount >= 100) {
    return {
      label: 'Comprehensive',
      class: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
      tooltip: `Comprehensive statute (${sectionsCount} sections)`
    };
  } else if (sectionsCount >= 30) {
    return {
      label: 'Standard Act',
      class: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      tooltip: `Standard statutory act (${sectionsCount} sections)`
    };
  } else {
    return {
      label: 'Compact Act',
      class: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      tooltip: `Compact statutory act (${sectionsCount} sections)`
    };
  }
}

/**
 * Returns historical era metadata for an Act based on enactment year.
 */
export function getEraBadgeInfo(year: number): EraBadgeInfo {
  const y = Number(year) || 0;
  if (y && y < 1947) {
    return {
      label: 'Colonial Era Statute',
      tag: 'Pre-1947',
      class: 'bg-amber-500/10 text-amber-300 border-amber-500/25'
    };
  } else if (y && y < 2000) {
    return {
      label: 'Post-Independence Enactment',
      tag: '1947-1999',
      class: 'bg-sky-500/10 text-sky-300 border-sky-500/25'
    };
  } else {
    return {
      label: 'Modern Digital Era Statute',
      tag: '2000+',
      class: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
    };
  }
}

/**
 * Formats a clean legal citation for a BareAct.
 */
export function formatActCitation(act: BareAct): string {
  if (act.actNumber) {
    return `${act.actName} (${act.year}) [Act No. ${act.actNumber}]`;
  }
  return `${act.actName}, ${act.year}`;
}

/**
 * Calculates total sections in a BareAct with in-place memoization.
 * Traverses chapters array AT MOST ONCE, then caches the result on act.cachedSectionCount.
 */
export function getSectionCount(act: BareAct): number {
  if (!act) return 0;
  if (act.cachedSectionCount !== undefined) return act.cachedSectionCount;

  let count = 0;
  if (act.sectionCount !== undefined && act.sectionCount !== null) {
    count = Number(act.sectionCount) || 0;
  } else if (act.chapters && Array.isArray(act.chapters)) {
    count = act.chapters.reduce((acc, ch) => acc + (ch?.sections?.length || 0), 0);
  }

  act.cachedSectionCount = count;
  return count;
}

/**
 * Calculates total chapters in a BareAct with in-place memoization.
 * Caches the result on act.cachedChapterCount for instant O(1) future lookups.
 */
export function getChapterCount(act: BareAct): number {
  if (!act) return 0;
  if (act.cachedChapterCount !== undefined) return act.cachedChapterCount;

  const count = Number(act.chapterCount ?? (act.chapters?.length || 0));

  act.cachedChapterCount = count;
  return count;
}

/** Memoization Cache Map for Label Formatters */
const labelCache = new Map<string, string>();

/**
 * Returns formatted chapter count with singular/plural grammar ('1 Chapter' vs 'N Chapters').
 * Memoized to execute string formatting ONCE per act.
 */
export function getChapterLabel(act: BareAct, count?: number): string {
  if (!act) return '0 Chapters';
  const chCount = count ?? getChapterCount(act);
  const cacheKey = `ch_${act._id || act.shortName}_${chCount}`;

  if (labelCache.has(cacheKey)) {
    return labelCache.get(cacheKey)!;
  }

  const label = `${chCount} ${chCount === 1 ? 'Chapter' : 'Chapters'}`;
  labelCache.set(cacheKey, label);
  return label;
}

/**
 * Returns formatted section count with singular/plural grammar ('1 Section' vs 'N Sections').
 * Memoized to execute string formatting ONCE per act.
 */
export function getSectionLabel(act: BareAct, count?: number): string {
  if (!act) return '0 Sections';
  const secCount = count ?? getSectionCount(act);
  const cacheKey = `sec_${act._id || act.shortName}_${secCount}`;

  if (labelCache.has(cacheKey)) {
    return labelCache.get(cacheKey)!;
  }

  const label = `${secCount} ${secCount === 1 ? 'Section' : 'Sections'}`;
  labelCache.set(cacheKey, label);
  return label;
}