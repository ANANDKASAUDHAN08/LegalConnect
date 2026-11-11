import { Injectable, inject, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { SnackbarService } from './snackbar.service';
import { UniversalBookmarkService } from './universal-bookmark.service';
import { AuthService } from './auth.service';
import { DatabaseService } from './database.service';
import { IconName } from '../components/icon/icon.types';

export interface StatutoryBasis {
  actName: string;
  shortAct: string;
  sections: string[];
  actUrl: string;
  landmarkCases?: string[];
}

export interface EmergencyHelpline {
  name: string;
  number: string;
  description: string;
  portalUrl?: string;
}

export interface StatutoryRightFAQ {
  question: string;
  answer: string;
}

export interface StatutoryRight {
  id: string;
  slug: string;
  title: string;
  category: string;
  icon: IconName;
  summary: string;
  statutoryBasis: StatutoryBasis;
  keyProtections: string[];
  actionableSteps: string[];
  legalRemedy: string;
  emergencyHelpline?: EmergencyHelpline;
  penaltiesForViolation?: string;
  frequentlyAskedQuestions?: StatutoryRightFAQ[];
  tags?: string[];
  scenarioTag?: string;
  whatToSay?: string;
  dos?: string[];
  donts?: string[];
  title_hi?: string;
  summary_hi?: string;
  whatToSay_hi?: string;
  dos_hi?: string[];
  donts_hi?: string[];
  verifiedDate: string;
  verifiedBy?: string;
  isPopular?: boolean;
  isPublished?: boolean;
  provenance?: {
    sourceAuthority: string;
    sourceUrl: string;
    jurisdiction: string;
    documentType: string;
    contentVersion: string;
    reviewStatus: string;
    lastVerifiedAt?: string;
    license?: string;
  };
  _searchCorpus?: string;
}

export interface RightsCategoryCount {
  name: string;
  count: number;
}

export interface EmergencyScenario {
  tag: string;
  label: string;
  label_hi?: string;
  icon: IconName;
  color: string;
  description: string;
  description_hi?: string;
  subtext?: string;
  subtext_hi?: string;
  badge?: string;
  filterKeywords?: string[];
  sortOrder?: number;
  isActive?: boolean;
}

export interface DiagnosticQuestion {
  id: string;
  question: string;
  question_hi: string;
  hint: string;
  hint_hi: string;
}

export interface DiagnosticCrisis {
  id: string;
  title: string;
  title_hi: string;
  icon: IconName;
  color: string;
  summary: string;
  summary_hi: string;
  questions: DiagnosticQuestion[];
}

export interface DiagnosticEvaluation {
  crisisId?: string;
  status: 'VIOLATION_CONFIRMED' | 'PROCEDURAL_CLEARANCE' | 'REVIEW_REQUIRED';
  confidenceScore: number;
  isUnlawful?: boolean;
  verdictTitle: string;
  verdictTitle_hi: string;
  verdictSubtitle: string;
  verdictSubtitle_hi: string;
  statutoryBasis: string;
  linkedSections?: Array<{ actName: string; shortAct: string; section: string }>;
  whatToSay: string;
  whatToSay_hi: string;
  actionItems: string[];
  actionItems_hi: string[];
  helpline: string;
  helplineName: string;
  relatedRightId?: string;
  ruleVersion?: number;
  provenance?: {
    sourceAuthority: string;
    sourceUrl: string;
    reviewStatus: string;
    lastVerifiedAt?: string | Date;
  };
}

export interface RightsApiResponse {
  success: boolean;
  totalCount: number;
  isDatabaseSourced?: boolean;
  categories: RightsCategoryCount[];
  data: StatutoryRight[];
}

const GUEST_BOOKMARK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days sliding Time-To-Live (Top MNC Standard)

interface GuestBookmarkStorageEnvelope {
  version: number;
  updatedAt: number;
  expiresAt: number;
  ids: string[];
}

@Injectable({ providedIn: 'root' })
export class RightsService {
  private http = inject(HttpClient);
  private snackbar = inject(SnackbarService);
  private universalBookmarks = inject(UniversalBookmarkService, { optional: true });
  private authService = inject(AuthService, { optional: true });
  private db = inject(DatabaseService);
  private apiUrl = '/api/info/rights';
  private readonly bookmarkKey = 'lc_bookmarked_rights';
  private readonly languageKey = 'lc_rights_lang';

  // Signals
  rights = signal<StatutoryRight[]>([]);
  categories = signal<RightsCategoryCount[]>([]);
  scenarios = signal<EmergencyScenario[]>([]);
  diagnosticCrises = signal<DiagnosticCrisis[]>([]);
  currentLanguage = signal<'en' | 'hi'>('en');
  isLoading = signal<boolean>(true);
  isOfflineMode = signal<boolean>(false);
  bookmarkedIds = signal<string[]>([]);
  activeCategory = signal<string>('All');
  activeScenario = signal<string>('');
  searchQuery = signal<string>('');
  activeSort = signal<string>('popular');

  constructor() {
    this.loadBookmarks();
    this.loadOfflineCacheFromIDB();
    this.loadDiagnosticCacheFromIDB();
    this.fetchScenarios();
    this.fetchDiagnostics().subscribe();

    // Hybrid Sync: Merge cloud bookmarks when user is authenticated
    if (this.universalBookmarks) {
      effect(() => {
        const cloudSet = this.universalBookmarks?.savedIds()?.get('StatutoryRight');
        if (cloudSet && cloudSet.size > 0) {
          const local = this.bookmarkedIds();
          const merged = Array.from(new Set([...local, ...cloudSet]));
          if (merged.length !== local.length) {
            this.bookmarkedIds.set(merged);
            this.saveBookmarks();
          }
        }
      }, { allowSignalWrites: true });
    }

    // Session Lifecycle: Guest-to-Cloud Migration on Login & Clean Purge on Logout
    if (this.authService) {
      let wasLoggedIn = this.authService.isLoggedIn;
      this.authService.isLoggedIn$.subscribe(loggedIn => {
        if (!wasLoggedIn && loggedIn) {
          // GUEST -> LOGGED IN: Migrate local guest bookmarks to cloud account
          this.migrateGuestBookmarksToCloud();
        } else if (wasLoggedIn && !loggedIn) {
          // LOGGED IN -> LOGOUT: Clear personal user bookmarks from active state & localStorage
          this.bookmarkedIds.set([]);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(this.bookmarkKey);
          }
        }
        wasLoggedIn = loggedIn;
      });
    }
  }

  /**
   * Loads bookmarks from local storage with 30-day sliding TTL for guest users.
   * Auto-purges stale guest storage if inactive for > 30 days.
   */
  private loadBookmarks(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(this.bookmarkKey);
      if (!raw) {
        this.bookmarkedIds.set([]);
        return;
      }

      const parsed = JSON.parse(raw);

      // Backward compatibility: Legacy raw string[] format
      if (Array.isArray(parsed)) {
        this.bookmarkedIds.set(parsed);
        // Seamlessly upgrade to envelope with fresh 30-day sliding TTL
        this.saveBookmarks();
        return;
      }

      // Modern envelope format with sliding TTL
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.ids)) {
        const now = Date.now();
        const isGuest = !this.authService?.isLoggedIn;

        // Auto-purge guest bookmarks if expired (> 30 days of inactivity)
        if (isGuest && parsed.expiresAt && now > parsed.expiresAt) {
          localStorage.removeItem(this.bookmarkKey);
          this.bookmarkedIds.set([]);
          return;
        }

        this.bookmarkedIds.set(parsed.ids);

        // Sliding window: refresh the 30-day expiration timer on active guest visit
        if (isGuest && parsed.ids.length > 0) {
          this.saveBookmarks();
        }
      }
    } catch {
      this.bookmarkedIds.set([]);
    }
  }

  /**
   * Persists bookmarks with sliding 30-day TTL for guests, or offline mirror for authenticated users.
   */
  private saveBookmarks(): void {
    if (typeof window === 'undefined') return;
    try {
      const now = Date.now();
      const isGuest = !this.authService?.isLoggedIn;
      const envelope: GuestBookmarkStorageEnvelope = {
        version: 1,
        updatedAt: now,
        expiresAt: isGuest ? now + GUEST_BOOKMARK_TTL_MS : 0,
        ids: this.bookmarkedIds()
      };
      localStorage.setItem(this.bookmarkKey, JSON.stringify(envelope));
    } catch {
      // Ignore storage quota errors
    }
  }

  /**
   * Seamlessly uploads any rights saved during guest browsing to the user's permanent cloud profile upon login.
   */
  private migrateGuestBookmarksToCloud(): void {
    if (!this.universalBookmarks) return;
    const localIds = this.bookmarkedIds();
    if (localIds.length === 0) return;

    let migratedCount = 0;
    for (const id of localIds) {
      const alreadySaved = this.universalBookmarks.isSaved('StatutoryRight', id);
      if (!alreadySaved) {
        const right = this.rights().find(r => r.id === id);
        const title = right?.title || 'Citizen Protection';
        this.universalBookmarks.toggleBookmark(
          'StatutoryRight',
          id,
          title,
          'Citizen Statutory Safeguard',
          'Citizen Rights'
        );
        migratedCount++;
      }
    }

    if (migratedCount > 0) {
      this.snackbar.show(
        `Synced ${migratedCount} offline ${migratedCount === 1 ? 'right' : 'rights'} to your account ✓`,
        'success',
        3000
      );
    }
  }

  private indexRights(data: StatutoryRight[]): StatutoryRight[] {
    return data.map(r => ({
      ...r,
      _searchCorpus: `${r.title} ${r.summary} ${r.title_hi || ''} ${r.summary_hi || ''} ${r.category} ${r.statutoryBasis?.actName || ''} ${r.statutoryBasis?.shortAct || ''} ${(r.statutoryBasis?.sections || []).join(' ')} ${(r.keyProtections || []).join(' ')} ${(r.actionableSteps || []).join(' ')} ${(r.tags || []).join(' ')} ${r.penaltiesForViolation || ''} ${r.legalRemedy || ''} ${r.whatToSay || ''}`.toLowerCase()
    }));
  }

  private loadOfflineCacheFromIDB(): void {
    this.db.loadRightsCache().then(cached => {
      if (cached && cached.rights.length > 0) {
        const indexed = this.indexRights(cached.rights);
        // Only set if we don't already have live data
        if (this.rights().length === 0) {
          this.rights.set(indexed);
          this.categories.set(cached.categories || []);
          this.isLoading.set(false);
        }
      }
    }).catch(() => { /* Ignore IDB read failures */ });
  }

  private saveOfflineCacheToIDB(rights: any[], categories: any[]): void {
    this.db.saveRightsCache(rights, categories).catch(() => {
      // Ignore IDB write failures
    });
  }

  isBookmarked(id: string): boolean {
    return this.bookmarkedIds().includes(id);
  }

  toggleBookmark(id: string, title: string) {
    const current = this.bookmarkedIds();
    const isSaved = current.includes(id);

    // Haptic feedback for tactile native feeling
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12);
    }

    // Immediate optimistic local update
    if (isSaved) {
      this.bookmarkedIds.set(current.filter(item => item !== id));
    } else {
      this.bookmarkedIds.set([...current, id]);
    }
    this.saveBookmarks();

    // If authenticated, synchronize with Universal Bookmark cloud store
    if (this.authService?.isLoggedIn && this.universalBookmarks) {
      this.universalBookmarks.toggleBookmark(
        'StatutoryRight',
        id,
        title,
        'Citizen Statutory Safeguard',
        'Citizen Rights'
      );
    } else {
      // Guest offline feedback notification
      if (isSaved) {
        this.snackbar.show(`Removed "${title}" from saved rights.`, 'info');
      } else {
        this.snackbar.show(`Saved "${title}" for offline emergency reference.`, 'success');
      }
    }
  }

  copyCitation(right: StatutoryRight) {
    const sectionsText = right.statutoryBasis.sections?.join(', ') || '';
    const citation = `${sectionsText ? `${sectionsText}, ` : ''}${right.statutoryBasis.actName} — [Verified by LegalConnect Council]`;

    const copyFallback = (text: string) => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          this.snackbar.show(`Statutory citation copied: "${text}"`, 'success');
        } else {
          this.snackbar.show(`Failed to copy citation.`, 'warning');
        }
      } catch {
        this.snackbar.show(`Failed to copy citation.`, 'warning');
      }
    };

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(citation).then(() => {
        this.snackbar.show(`Statutory citation copied: "${citation}"`, 'success');
      }).catch(() => {
        copyFallback(citation);
      });
    } else {
      copyFallback(citation);
    }
  }

  fetchScenarios(): void {
    this.http.get<{ success: boolean; data: EmergencyScenario[] }>(`${this.apiUrl}/scenarios`).pipe(
      tap(res => {
        if (res && res.success && Array.isArray(res.data)) {
          this.scenarios.set(res.data);
          // Cache scenarios to IndexedDB for offline mode
          this.db.saveScenariosCache(res.data).catch(() => { });
        }
      }),
      catchError(() => {
        // Attempt loading from IndexedDB cache
        this.db.loadScenariosCache().then(cached => {
          if (cached && cached.length > 0) {
            this.scenarios.set(cached);
          }
        }).catch(() => { });
        return of({ success: false, data: [] });
      })
    ).subscribe();
  }

  fetchRights(
    category: string = 'All',
    query: string = '',
    sort: string = 'popular',
    scenario: string = ''
  ): Observable<RightsApiResponse> {
    this.isLoading.set(true);

    let url = `${this.apiUrl}?category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sort)}`;
    if (query) {
      url += `&q=${encodeURIComponent(query)}`;
    }
    if (scenario) {
      url += `&scenario=${encodeURIComponent(scenario)}`;
    }

    return this.http.get<RightsApiResponse>(url).pipe(
      tap(res => {
        if (res && res.success && Array.isArray(res.data)) {
          const indexed = this.indexRights(res.data);
          this.rights.set(indexed);
          this.categories.set(res.categories || []);
          this.isOfflineMode.set(false);

          // Save global catalog to device offline cache (IndexedDB)
          if (category === 'All' && !query && !scenario) {
            this.saveOfflineCacheToIDB(indexed, res.categories || []);
          }
        }
        this.isLoading.set(false);
      }),
      catchError(err => {
        console.warn('Unable to load statutory rights from backend; attempting IndexedDB offline cache.', err);
        this.isLoading.set(false);

        // Attempt async IDB load for offline shield mode
        this.db.loadRightsCache().then(cached => {
          if (cached && cached.rights.length > 0) {
            const indexed = this.indexRights(cached.rights);
            this.rights.set(indexed);
            this.categories.set(cached.categories || []);
            this.isOfflineMode.set(true);
            this.snackbar.show('Operating in Offline Shield Mode: Loaded verified rights from device memory.', 'info', 4000);
          }
        }).catch(() => { });
        if (this.rights().length > 0) {
          return of({
            success: true,
            totalCount: this.rights().length,
            isDatabaseSourced: false,
            categories: this.categories(),
            data: this.rights()
          });
        }

        return of({
          success: false,
          totalCount: 0,
          categories: [],
          data: []
        });
      })
    );
  }

  // Language management
  setLanguage(lang: 'en' | 'hi') {
    this.currentLanguage.set(lang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.languageKey, lang);
      } catch { }
    }
  }

  loadLanguage() {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.languageKey);
      if (stored === 'en' || stored === 'hi') {
        this.currentLanguage.set(stored);
      }
    } catch { }
  }

  // Diagnostic Crises & Decision Trees
  fetchDiagnostics(): Observable<DiagnosticCrisis[]> {
    return this.http.get<{ success: boolean; data: any[] }>(`${this.apiUrl}/diagnostics`).pipe(
      tap(res => {
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: DiagnosticCrisis[] = res.data.map(item => ({
            id: item.id || item.crisisId || item._id,
            title: item.title,
            title_hi: item.title_hi || item.title,
            icon: (item.icon as IconName) || 'shield',
            color: item.color || 'blue',
            summary: item.summary,
            summary_hi: item.summary_hi || item.summary,
            questions: (item.questions || []).map((q: any) => ({
              id: q.id,
              question: q.question,
              question_hi: q.question_hi || q.question,
              hint: q.hint,
              hint_hi: q.hint_hi || q.hint
            }))
          }));
          this.diagnosticCrises.set(mapped);
          // Cache diagnostics to IndexedDB for offline mode
          this.db.saveDiagnosticsCache(mapped).catch(() => { });
        }
      }),
      catchError(() => {
        this.loadDiagnosticCacheFromIDB();
        return of({ success: false, data: this.diagnosticCrises() });
      }),
      map(() => this.diagnosticCrises())
    );
  }

  evaluateDiagnostic(crisisId: string, answers: Record<string, boolean>): Observable<DiagnosticEvaluation | null> {
    return this.http.post<{ success: boolean; data: DiagnosticEvaluation }>(
      `${this.apiUrl}/diagnostics/evaluate`,
      { crisisId, answers }
    ).pipe(
      map(res => (res && res.success && res.data) ? res.data : null),
      catchError(() => of(null))
    );
  }

  private loadDiagnosticCacheFromIDB(): void {
    this.db.loadDiagnosticsCache().then(cached => {
      if (cached && cached.length > 0) {
        this.diagnosticCrises.set(cached);
      }
    }).catch(() => { });
  }
}