import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError, shareReplay, tap } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { LocationService } from './location.service';

export interface TrendingTopic {
  id: string;
  name: string;
  icon: string;
  description: string;
  subcategories: string[];
  sampleQuery: string;
}

export interface PopularBareAct {
  shortName: string;
  actName: string;
  year: number;
  category: string;
}

export interface PopularCategory {
  id: string;
  name: string;
  icon: string;
}

export interface QuickAccessAction {
  id: string;
  label: string;
  route: string;
  icon: string;
  description: string;
}

export interface PaletteMetadata {
  trendingTopics: TrendingTopic[];
  popularSearches: {
    topics: string[];
    laws: PopularBareAct[];
    categories: PopularCategory[];
  };
  quickAccess: QuickAccessAction[];
}

export interface SearchSuggestion {
  text: string;
  type: 'law' | 'section' | 'category' | 'topic';
  subtitle?: string;
  route?: string;
  queryParams?: Record<string, string>;
}

export interface SearchPreviewResults {
  laws: any[];
  lawyers: any[];
  resources: any[];
  faqs: any[];
}

const RECENT_SEARCHES_STORAGE_KEY = 'lc_auth_search_history';

@Injectable({
  providedIn: 'root'
})
export class GlobalSearchService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private locationService = inject(LocationService);

  private readonly baseUrl = '/api/legal';

  // Modal Open/Close State
  private _isOpen = new BehaviorSubject<boolean>(false);
  isOpen$ = this._isOpen.asObservable();

  // Active initial query when opened via external trigger
  private _initialQuery = new BehaviorSubject<string>('');
  initialQuery$ = this._initialQuery.asObservable();

  // Recent Searches State (Auth-gated)
  private _recentSearches = new BehaviorSubject<string[]>([]);
  recentSearches$ = this._recentSearches.asObservable();

  // In-memory cache for palette metadata & search previews
  private metadataCache$: Observable<PaletteMetadata> | null = null;
  private previewCache = new Map<string, { data: SearchPreviewResults; timestamp: number }>();
  private readonly CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

  constructor() {
    // Hydrate recent searches from local storage for both guests and authenticated users
    this.loadRecentSearches();
    this.auth.isLoggedIn$.subscribe(() => {
      this.loadRecentSearches();
    });
  }

  // --- Palette Visibility Controls ---

  open(query = '') {
    if (query) {
      this._initialQuery.next(query);
    }
    this.loadRecentSearches();
    this._isOpen.next(true);
  }

  close() {
    this._isOpen.next(false);
  }

  toggle() {
    if (this._isOpen.value) {
      this.close();
    } else {
      this.open();
    }
  }

  get isOpen(): boolean {
    return this._isOpen.value;
  }

  // --- Metadata & Telemetry API Calls ---

  getPaletteMetadata(): Observable<PaletteMetadata> {
    if (!this.metadataCache$) {
      this.metadataCache$ = this.http.get<{ success: boolean; data: PaletteMetadata }>(`${this.baseUrl}/search/palette-meta`).pipe(
        map(res => res.data),
        catchError(err => {
          console.error('[GlobalSearchService] Failed to load palette metadata:', err);
          return of(this.getFallbackMetadata());
        }),
        shareReplay(1)
      );
    }
    return this.metadataCache$;
  }

  getSuggestions(query: string): Observable<SearchSuggestion[]> {
    const q = query.trim();
    if (!q || q.length < 2) {
      return of([]);
    }

    return this.http.get<{ success: boolean; data: SearchSuggestion[] }>(
      `${this.baseUrl}/search/suggestions?q=${encodeURIComponent(q)}`
    ).pipe(
      map(res => res.data || []),
      catchError(() => of([]))
    );
  }

  searchPreview(query: string, limit = 4): Observable<SearchPreviewResults> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return of({ laws: [], lawyers: [], resources: [], faqs: [] });
    }

    const city = this.locationService.getCurrentLocation() || '';
    const coords = this.locationService.getCoordinates();
    const cacheKey = `${trimmed}:${city}:${limit}`;

    const cached = this.previewCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL_MS)) {
      return of(cached.data);
    }

    let url = `${this.baseUrl}/search-hub?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
    if (city) {
      url += `&city=${encodeURIComponent(city)}`;
    }
    if (coords?.lat && coords?.lng) {
      url += `&lat=${coords.lat}&lng=${coords.lng}`;
    }

    return this.http.get<{ success: boolean; data: SearchPreviewResults }>(url).pipe(
      map(res => {
        const results: SearchPreviewResults = {
          laws: res.data?.laws || [],
          lawyers: res.data?.lawyers || [],
          resources: res.data?.resources || [],
          faqs: res.data?.faqs || []
        };
        this.previewCache.set(cacheKey, { data: results, timestamp: Date.now() });
        return results;
      }),
      catchError(err => {
        console.error('[GlobalSearchService] Live search preview error:', err);
        return of({ laws: [], lawyers: [], resources: [], faqs: [] });
      })
    );
  }

  logSearchTelemetry(query: string): void {
    const q = query.trim();
    if (!q || q.length < 2) return;
    this.http.post('/api/info/analytics/search', { query: q }).subscribe({
      error: () => { } // silent telemetry failure
    });
  }

  // --- Recent Searches Management (Universal for all citizens & synced with auth) ---

  private loadRecentSearches(): void {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this._recentSearches.next(parsed.slice(0, 6));
          return;
        }
      }
    } catch {
      // ignore JSON parse error
    }
    this._recentSearches.next([]);
  }

  addRecentSearch(query: string): void {
    const q = query.trim();
    if (!q) return;

    const current = this._recentSearches.value.filter(item => item.toLowerCase() !== q.toLowerCase());
    const updated = [q, ...current].slice(0, 6);

    this._recentSearches.next(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // storage unavailable
    }
  }

  removeRecentSearch(query: string): void {
    const updated = this._recentSearches.value.filter(item => item !== query);
    this._recentSearches.next(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
  }

  clearRecentSearches(): void {
    this._recentSearches.next([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  // --- Instant Hydration Fallback Metadata ---
  public getFallbackMetadata(): PaletteMetadata {
    return {
      trendingTopics: [
        {
          id: 'Property Dispute',
          name: 'Property Dispute',
          icon: 'home',
          description: 'Land, Rent, Inheritance, Housing',
          subcategories: ['Tenant Eviction & Rent', 'Land Partition & Boundary', 'RERA & Builder Delays'],
          sampleQuery: 'Tenant Eviction & Rent'
        },
        {
          id: 'Family Law',
          name: 'Family Law',
          icon: 'users',
          description: 'Divorce, Custody, Maintenance',
          subcategories: ['Mutual & Contested Divorce', 'Child Custody', 'Alimony & Maintenance'],
          sampleQuery: 'Mutual & Contested Divorce'
        },
        {
          id: 'Criminal Matter',
          name: 'Criminal Matter',
          icon: 'shield',
          description: 'Theft, Assault, Police Reports',
          subcategories: ['Anticipatory Bail', 'FIR Quashing', 'Cheating & Fraud (420)'],
          sampleQuery: 'Anticipatory & Regular Bail'
        },
        {
          id: 'Cyber Crime',
          name: 'Cyber Crime',
          icon: 'shield',
          description: 'Hacking, Online Scam, Phishing',
          subcategories: ['UPI & Bank Fraud Helpline', 'Identity Theft', 'Cyber Harassment'],
          sampleQuery: 'UPI & Bank Fraud Helpline'
        }
      ],
      popularSearches: {
        topics: [
          'Anticipatory Bail Application',
          'Cheque Bounce Notice Sec 138',
          'Consumer Dispute Complaint',
          'RERA Delayed Possession Refund',
          'Mutual Consent Divorce Procedure',
          'Cyber Crime Bank Fraud FIR'
        ],
        laws: [
          { shortName: 'BNS', actName: 'Bharatiya Nyaya Sanhita, 2023', year: 2023, category: 'CRIMINAL' },
          { shortName: 'BNSS', actName: 'Bharatiya Nagarik Suraksha Sanhita, 2023', year: 2023, category: 'CRIMINAL' },
          { shortName: 'BSA', actName: 'Bharatiya Sakshya Adhiniyam, 2023', year: 2023, category: 'CRIMINAL' },
          { shortName: 'IPC', actName: 'Indian Penal Code, 1860', year: 1860, category: 'CRIMINAL' }
        ],
        categories: [
          { id: 'Property Dispute', name: 'Property Dispute', icon: 'home' },
          { id: 'Criminal Matter', name: 'Criminal Matter', icon: 'shield' },
          { id: 'Family Law', name: 'Family Law', icon: 'users' },
          { id: 'Cyber Crime', name: 'Cyber Crime', icon: 'shield' }
        ]
      },
      quickAccess: [
        { id: 'find-lawyer', label: 'Find Verified Lawyers', route: '/lawyers', icon: 'briefcase', description: 'Consult licensed advocates across high courts & district benches' },
        { id: 'legal-resources', label: 'Legal Aid & DLSA Clinics', route: '/legal-resources', icon: 'landmark', description: 'Free legal aid, Lok Adalats & government legal aid clinics' },
        { id: 'browse-laws', label: 'Browse Bare Acts & Codes', route: '/laws', icon: 'book-open', description: 'Search 1,200+ Indian Acts, sections, penalties & BNS cross-references' },
        { id: 'faqs', label: 'Frequently Asked Questions', route: '/help', icon: 'help-circle', description: 'LegalConnect zero-commission rules, DPDP rights & user guides' },
        { id: 'support', label: 'Contact Support & Help Desk', route: '/contact', icon: 'phone', description: '24/7 citizen support, statutory DPO officer & grievance redressal' }
      ]
    };
  }
}