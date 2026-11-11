import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { LegalService, BareAct, Section } from './legal.service';
import { DatabaseService } from './database.service';
import { SnackbarService } from './snackbar.service';

export interface ParsedCitation {
  /** The normalized shortName used by /laws/:shortName (e.g. 'BNS', 'BNSS', 'Constitution') */
  actShortName: string | null;
  /** The clean section number (e.g. '127', '35', '41A', '21') */
  sectionNumber: string | null;
  /** Full or clean statute name */
  actDisplayName: string;
  /** Original citation string */
  originalCitation: string;
}

export interface SectionVerificationResult {
  actExists: boolean;
  sectionExists: boolean;
  actShortName: string | null;
  sectionNumber: string | null;
  actTitle?: string;
  sectionTitle?: string;
}

@Injectable({ providedIn: 'root' })
export class StatuteResolverService {
  private legalService = inject(LegalService);
  private db = inject(DatabaseService);
  private snackbar = inject(SnackbarService);
  private router = inject(Router);

  /** Loading indicator signal for asynchronous pre-flight checks */
  isVerifying = signal<boolean>(false);

  /** In-memory cache of acts list for O(1) existence lookup */
  private actsCache: BareAct[] | null = null;

  /** In-memory cache of act outlines: actShortName -> BareAct with chapters & sections */
  private outlineCache = new Map<string, BareAct>();

  /**
   * Fast normalized registry of statutory abbreviations & enactment titles.
   * Maps every variant to LegalConnect's canonical /laws/:shortName route parameter.
   */
  private readonly ACT_ALIASES: Record<string, string> = {
    // 1. Criminal Codes (2023 Sanhitas & Predecessors)
    'BNSS': 'BNSS',
    'BNSS 2023': 'BNSS',
    'BHARATIYA NAGARIK SURAKSHA SANHITA': 'BNSS',
    'BHARATIYA NAGARIK SURAKSHA': 'BNSS',
    'CRPC': 'BNSS',
    'CR.P.C.': 'BNSS',
    'CRIMINAL PROCEDURE': 'BNSS',

    'BNS': 'BNS',
    'BNS 2023': 'BNS',
    'BHARATIYA NYAYA SANHITA': 'BNS',
    'BHARATIYA NYAYA': 'BNS',
    'IPC': 'BNS',
    'I.P.C.': 'BNS',
    'INDIAN PENAL CODE': 'BNS',

    'BSA': 'BSA',
    'BSA 2023': 'BSA',
    'BHARATIYA SAKSHYA ADHINIYAM': 'BSA',
    'BHARATIYA SAKSHYA': 'BSA',
    'IEA': 'BSA',
    'EVIDENCE ACT': 'BSA',
    'INDIAN EVIDENCE ACT': 'BSA',

    // 2. Constitutional Law
    'CONSTITUTION': 'Constitution',
    'CONSTITUTION OF INDIA': 'Constitution',
    'COI': 'Constitution',

    // 3. Civil, Commercial & Motor Codes
    'MVA': 'MVA',
    'MOTOR VEHICLES ACT': 'MVA',
    'MOTOR VEHICLES': 'MVA',
    'MOTOR VEHICLE': 'MVA',
    'CMVR': 'MVA',

    'CPC': 'CPC',
    'C.P.C.': 'CPC',
    'CIVIL PROCEDURE CODE': 'CPC',
    'CODE OF CIVIL PROCEDURE': 'CPC',

    'NIA': 'NIA',
    'NEGOTIABLE INSTRUMENTS ACT': 'NIA',
    'NEGOTIABLE INSTRUMENTS': 'NIA',

    'ICA': 'ICA',
    'INDIAN CONTRACT ACT': 'ICA',
    'CONTRACT ACT': 'ICA',

    'HMA': 'HMA',
    'HINDU MARRIAGE ACT': 'HMA',
    'HINDU MARRIAGE': 'HMA',

    'IDA': 'IDA',
    'INDUSTRIAL DISPUTES ACT': 'IDA',
    'INDUSTRIAL DISPUTES': 'IDA',

    // 4. Information, Cyber, Privacy & Consumer
    'RTI': 'RTI',
    'RIGHT TO INFORMATION ACT': 'RTI',
    'RIGHT TO INFORMATION': 'RTI',

    'CPA': 'CPA',
    'CONSUMER PROTECTION ACT': 'CPA',
    'CONSUMER PROTECTION': 'CPA',

    'IT': 'IT',
    'IT ACT': 'IT',
    'ITA': 'IT',
    'INFORMATION TECHNOLOGY ACT': 'IT',
    'INFORMATION TECHNOLOGY': 'IT',

    'DPDP': 'DPDP',
    'DPDPA': 'DPDP',
    'DIGITAL PERSONAL DATA PROTECTION': 'DPDP',
    'DATA PROTECTION': 'DPDP',

    // 5. Special Protective & Social Legislation
    'POSH': 'POSH',
    'POSH ACT': 'POSH',
    'SEXUAL HARASSMENT OF WOMEN AT WORKPLACE': 'POSH',
    'SEXUAL HARASSMENT': 'POSH',

    'POCSO': 'POCSO',
    'POCSO ACT': 'POCSO',
    'PROTECTION OF CHILDREN FROM SEXUAL OFFENCES': 'POCSO',

    'RERA': 'RERA',
    'REAL ESTATE REGULATION': 'RERA',
    'REAL ESTATE (REGULATION AND DEVELOPMENT)': 'RERA',

    'PWDVA': 'PWDVA',
    'DOMESTIC VIOLENCE ACT': 'PWDVA',
    'PROTECTION OF WOMEN FROM DOMESTIC VIOLENCE': 'PWDVA',

    'RPWD': 'RPwD',
    'RPwD': 'RPwD',
    'RIGHTS OF PERSONS WITH DISABILITIES': 'RPwD',
    'DISABILITIES ACT': 'RPwD',

    'MHCA': 'MHCA',
    'MENTAL HEALTHCARE ACT': 'MHCA',
    'MENTAL HEALTHCARE': 'MHCA',

    'CEA': 'CEA',
    'CLINICAL ESTABLISHMENTS ACT': 'CEA',
    'CLINICAL ESTABLISHMENTS': 'CEA',

    'RTE': 'RTE',
    'RIGHT TO EDUCATION ACT': 'RTE',
    'RIGHT TO EDUCATION': 'RTE',

    'TPA': 'TPA',
    'TRANSFER OF PROPERTY ACT': 'TPA',
    'TRANSFER OF PROPERTY': 'TPA',

    'STREET VENDORS': 'StreetVendors',
    'STREET VENDORS ACT': 'StreetVendors'
  };

  constructor() {
    this.hydrateActsCache();
  }

  /**
   * Pre-loads the acts catalog from database into memory cache
   */
  private hydrateActsCache(): void {
    this.legalService.getActs().pipe(
      catchError(() => of({ data: [] } as any))
    ).subscribe(res => {
      if (res && res.data) {
        this.actsCache = res.data;
        // Dynamically register every act shortName and title into the alias dictionary
        for (const act of res.data) {
          if (act.shortName) {
            this.ACT_ALIASES[act.shortName.toUpperCase()] = act.shortName;
          }
          if (act.actName) {
            this.ACT_ALIASES[act.actName.toUpperCase()] = act.shortName;
          }
        }
      }
    });
  }

  /**
   * Parses a statutory section pill or citation string.
   * Handles multi-statute cases gracefully where each pill may cite a different act!
   * E.g.: "Section 127 BNS (Old Sec 342 IPC)" -> actShortName: 'BNS', sectionNumber: '127'
   *       "Article 21 Constitution"           -> actShortName: 'Constitution', sectionNumber: '21'
   *       "Section 35" (in BNSS right)        -> actShortName: 'BNSS', sectionNumber: '35'
   */
  parseCitation(
    citation: string,
    fallbackBasis?: { actName?: string; shortAct?: string; actUrl?: string }
  ): ParsedCitation {
    const raw = (citation || '').trim();
    const upper = raw.toUpperCase();

    // 1. Check if the pill itself explicitly mentions an Act abbreviation
    let detectedAct: string | null = null;

    // Check specific high-priority tokens in citation
    const priorityTokens: Array<{ regex: RegExp; act: string }> = [
      { regex: /\bBNS\b/i, act: 'BNS' },
      { regex: /\bBNSS\b/i, act: 'BNSS' },
      { regex: /\bBSA\b/i, act: 'BSA' },
      { regex: /\bCONSTITUTION\b/i, act: 'Constitution' },
      { regex: /\bIPC\b/i, act: 'BNS' },
      { regex: /\bCRPC\b/i, act: 'BNSS' },
      { regex: /\bIEA\b/i, act: 'BSA' },
      { regex: /\bMVA\b/i, act: 'MVA' },
      { regex: /\bCPC\b/i, act: 'CPC' },
      { regex: /\bNIA\b/i, act: 'NIA' },
      { regex: /\bRTI\b/i, act: 'RTI' },
      { regex: /\bCPA\b/i, act: 'CPA' },
      { regex: /\bPOSH\b/i, act: 'POSH' },
      { regex: /\bPOCSO\b/i, act: 'POCSO' },
      { regex: /\bDPDP\b/i, act: 'DPDP' },
      { regex: /\bRERA\b/i, act: 'RERA' },
      { regex: /\bRPWD\b/i, act: 'RPwD' },
      { regex: /\bMHCA\b/i, act: 'MHCA' },
      { regex: /\bCEA\b/i, act: 'CEA' },
      { regex: /\bRTE\b/i, act: 'RTE' },
      { regex: /\bTPA\b/i, act: 'TPA' }
    ];

    for (const item of priorityTokens) {
      if (item.regex.test(upper)) {
        detectedAct = item.act;
        break;
      }
    }

    // 1b. Dynamic dictionary check against all acts loaded into ACT_ALIASES
    if (!detectedAct) {
      for (const [alias, canonical] of Object.entries(this.ACT_ALIASES)) {
        if (alias.length >= 3 && new RegExp(`\\b${alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(upper)) {
          detectedAct = canonical;
          break;
        }
      }
    }

    // 2. If no act detected in the pill string, resolve from parent fallbackBasis
    if (!detectedAct && fallbackBasis) {
      detectedAct = this.resolveActShortName(fallbackBasis.shortAct, fallbackBasis.actName, fallbackBasis.actUrl);
    }

    // 3. Extract the alphanumeric section/article number
    let sectionNumber: string | null = null;
    const secMatch = raw.match(/\b(?:Section|Sec|Article|Art|Rule|Order|Clause)\.?\s*([0-9]+[A-Za-z\-]*)/i);
    if (secMatch && secMatch[1]) {
      sectionNumber = secMatch[1];
    } else {
      const fallbackNumMatch = raw.match(/([0-9]+[A-Za-z\-]*)/);
      if (fallbackNumMatch && fallbackNumMatch[1]) {
        sectionNumber = fallbackNumMatch[1];
      }
    }

    const actDisplayName = detectedAct || fallbackBasis?.shortAct || fallbackBasis?.actName || 'Bare Act';

    return {
      actShortName: detectedAct,
      sectionNumber,
      actDisplayName,
      originalCitation: raw
    };
  }

  /**
   * Resolves an Act shortName from shortAct, actName, or actUrl.
   */
  resolveActShortName(shortAct?: string, actName?: string, actUrl?: string): string | null {
    // If actUrl is already a direct /laws/:shortName link
    if (actUrl && actUrl.startsWith('/laws/')) {
      const candidate = actUrl.replace('/laws/', '').split(/[?#]/)[0].trim();
      if (candidate && candidate !== 'laws' && candidate !== 'mapper') {
        return candidate;
      }
    }

    const s = (shortAct || '').trim();
    const a = (actName || '').trim();

    // Check direct dictionary match on shortAct
    if (s && this.ACT_ALIASES[s.toUpperCase()]) {
      return this.ACT_ALIASES[s.toUpperCase()];
    }

    // Check combined text against alias dictionary keys
    const combined = `${s} ${a}`.toUpperCase();
    for (const [alias, canonical] of Object.entries(this.ACT_ALIASES)) {
      if (combined.includes(alias)) {
        return canonical;
      }
    }

    // Fallback: check clean acronym
    const clean = s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean && this.ACT_ALIASES[clean]) {
      return this.ACT_ALIASES[clean];
    }

    return null;
  }

  /**
   * Safe URL builder for templates (provides fallback for href while click handler performs pre-flight check)
   */
  getSectionUrl(citation: string, fallbackBasis?: { actName?: string; shortAct?: string; actUrl?: string }): string {
    const parsed = this.parseCitation(citation, fallbackBasis);
    if (parsed.actShortName) {
      return parsed.sectionNumber
        ? `/laws/${parsed.actShortName}#sec-${parsed.sectionNumber}`
        : `/laws/${parsed.actShortName}`;
    }
    return '/laws';
  }

  /**
   * Safe URL builder for the entire Bare Act
   */
  getActUrl(basis?: { actName?: string; shortAct?: string; actUrl?: string }): string {
    if (!basis) return '/laws';
    const shortName = this.resolveActShortName(basis.shortAct, basis.actName, basis.actUrl);
    return shortName ? `/laws/${shortName}` : '/laws';
  }

  /**
   * Asynchronously verifies if an act and section exist in our database before redirecting.
   */
  async verifySection(
    citation: string,
    fallbackBasis?: { actName?: string; shortAct?: string; actUrl?: string }
  ): Promise<SectionVerificationResult> {
    const parsed = this.parseCitation(citation, fallbackBasis);

    if (!parsed.actShortName) {
      return {
        actExists: false,
        sectionExists: false,
        actShortName: null,
        sectionNumber: parsed.sectionNumber
      };
    }

    // 1. Check if Act exists in platform library
    const acts = await this.getAvailableActs();
    const matchedAct = acts.find(a => a.shortName.toUpperCase() === parsed.actShortName!.toUpperCase());

    if (!matchedAct) {
      return {
        actExists: false,
        sectionExists: false,
        actShortName: parsed.actShortName,
        sectionNumber: parsed.sectionNumber
      };
    }

    // If no section number was mentioned, act itself exists
    if (!parsed.sectionNumber) {
      return {
        actExists: true,
        sectionExists: true,
        actShortName: matchedAct.shortName,
        sectionNumber: null,
        actTitle: matchedAct.actName
      };
    }

    // 2. Check if section exists in Act outline
    const outline = await this.getActOutline(matchedAct.shortName);
    if (!outline || !outline.chapters) {
      // If outline failed to load, check local Dexie DB
      try {
        const localSec = await this.db.getLocalSection(matchedAct.shortName, parsed.sectionNumber);
        if (localSec) {
          return {
            actExists: true,
            sectionExists: true,
            actShortName: matchedAct.shortName,
            sectionNumber: parsed.sectionNumber,
            actTitle: matchedAct.actName,
            sectionTitle: localSec.title
          };
        }
      } catch { }

      return {
        actExists: true,
        sectionExists: false,
        actShortName: matchedAct.shortName,
        sectionNumber: parsed.sectionNumber,
        actTitle: matchedAct.actName
      };
    }

    // Search chapters for exact section number
    let foundSection: Section | undefined;
    for (const chapter of outline.chapters) {
      if (chapter.sections) {
        foundSection = chapter.sections.find(
          s => s.section_number.toLowerCase() === parsed.sectionNumber!.toLowerCase()
        );
        if (foundSection) break;
      }
    }

    return {
      actExists: true,
      sectionExists: !!foundSection,
      actShortName: matchedAct.shortName,
      sectionNumber: parsed.sectionNumber,
      actTitle: matchedAct.actName,
      sectionTitle: foundSection?.title
    };
  }

  /**
   * Pre-flight Check & Safe Navigation for Section Pills.
   * If verified -> Opens `/laws/:shortName#sec-:sectionNumber` in a new tab.
   * If NOT found in DB -> Displays informative snackbar and prevents broken redirect.
   */
  async navigateToSectionSafely(
    citation: string,
    fallbackBasis?: { actName?: string; shortAct?: string; actUrl?: string }
  ): Promise<boolean> {
    if (this.isVerifying()) return false;
    this.isVerifying.set(true);

    try {
      const result = await this.verifySection(citation, fallbackBasis);
      const parsed = this.parseCitation(citation, fallbackBasis);

      // Case 1: Act does not exist in our Bare Act database
      if (!result.actExists) {
        const displayName = parsed.actDisplayName || 'this statute';
        this.snackbar.show(
          `⚠️ "${displayName}" is not yet available in our Bare Act library.`,
          'info',
          4500,
          'Search',
          () => {
            this.router.navigate(['/search'], { queryParams: { q: citation } });
          }
        );
        return false;
      }

      // Case 2: Act exists, but Section does not exist in our database
      if (result.sectionNumber && !result.sectionExists) {
        this.snackbar.show(
          `ℹ️ Section ${result.sectionNumber} of ${result.actShortName} is not yet codified in the Bare Act reader.`,
          'info',
          5000,
          'Search',
          () => {
            this.router.navigate(['/search'], { queryParams: { q: `${result.actShortName} Section ${result.sectionNumber}` } });
          }
        );
        return false;
      }

      // Case 3: Verified! Safe to navigate
      const targetUrl = result.sectionNumber
        ? `/laws/${result.actShortName}#sec-${result.sectionNumber}`
        : `/laws/${result.actShortName}`;

      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return true;
    } catch {
      this.snackbar.show(`Could not verify citation "${citation}". Please try again.`, 'error');
      return false;
    } finally {
      this.isVerifying.set(false);
    }
  }

  /**
   * Pre-flight Check & Safe Navigation for the whole Bare Act.
   */
  async navigateToActSafely(basis?: { actName?: string; shortAct?: string; actUrl?: string }): Promise<boolean> {
    if (!basis) {
      window.open('/laws', '_blank', 'noopener,noreferrer');
      return true;
    }

    const shortName = this.resolveActShortName(basis.shortAct, basis.actName, basis.actUrl);
    if (!shortName) {
      this.snackbar.show(`⚠️ "${basis.actName || 'This statute'}" is not yet in our Bare Act reader.`, 'info');
      return false;
    }

    const acts = await this.getAvailableActs();
    const matched = acts.find(a => a.shortName.toUpperCase() === shortName.toUpperCase());

    if (!matched) {
      this.snackbar.show(
        `⚠️ The Bare Act for "${basis.actName || shortName}" is not yet published in our library.`,
        'info',
        4500,
        'Browse Laws',
        () => {
          this.router.navigate(['/laws']);
        }
      );
      return false;
    }

    window.open(`/laws/${matched.shortName}`, '_blank', 'noopener,noreferrer');
    return true;
  }

  // --- Helper Methods ---

  private async getAvailableActs(): Promise<BareAct[]> {
    if (this.actsCache && this.actsCache.length > 0) {
      return this.actsCache;
    }
    try {
      const res = await firstValueFrom(this.legalService.getActs());
      if (res && res.data) {
        this.actsCache = res.data;
        return res.data;
      }
    } catch { }
    return [];
  }

  private async getActOutline(shortName: string): Promise<BareAct | null> {
    if (this.outlineCache.has(shortName)) {
      return this.outlineCache.get(shortName)!;
    }
    try {
      const res = await firstValueFrom(this.legalService.getActOutline(shortName));
      if (res && res.data) {
        this.outlineCache.set(shortName, res.data);
        return res.data;
      }
    } catch { }
    return null;
  }
}