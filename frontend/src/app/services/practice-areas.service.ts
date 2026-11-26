import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap, shareReplay } from 'rxjs/operators';
import { IconName } from '../components/icon/icon.types';

export interface PracticeAreaFeeRange {
  min: number;
  median: number;
  max: number;
}

export interface PracticeAreaTopCity {
  city: string;
  count: number;
}

export interface PracticeAreaFaq {
  q: string;
  a: string;
  q_hi?: string;
  a_hi?: string;
}

export interface ForumJourneyStage {
  stage: string;
  forum: string;
  note: string;
}

export interface ResolvedBareAct {
  name: string;
  shortName: string | null;
  year: number | null;
  sectionCount: number;
  deepLink: string | null;
}

export interface LandmarkJudgmentPreview {
  caseId: string;
  title: string;
  citation: string;
  court: string;
  decisionDate: string;
  holding: string;
  ratioDecidendi: string;
  treatment: string;
  officialDocumentUrl?: string;
  bench?: string;
  issues?: string[];
  connectedSections?: string[];
  summary?: string;
}

export interface LawyerPreview {
  _id: string;
  name: string;
  city: string;
  rating: number;
  experience: number;
  consultationFee: number;
  avatarUrl?: string;
  isVerified: boolean;
  specializations: string[];
  languagesSpoken?: string[];
  isAvailable?: boolean;
}

export interface PracticeArea {
  id: string;
  name: string;
  name_hi?: string;
  icon: IconName;
  category: string;
  description: string;
  description_hi?: string;
  tagline?: string;
  simpleDescription?: string;
  simpleDescription_hi?: string;
  simpleTagline?: string;
  accent?: string;
  subfields: string[];
  relevantActs: string[];
  typicalForums: string[];
  aliases?: string[];
  faqs?: PracticeAreaFaq[];
  forumJourney?: ForumJourneyStage[];
  documentsChecklist?: string[];
  popular?: boolean;
  isFeatured?: boolean;
  isPublished?: boolean;
  sortOrder?: number;
  // Live aggregated stats
  advocateCount: number;
  verifiedAdvocateCount?: number;
  avgExperience?: number;
  avgRating?: number;
  feeRange?: PracticeAreaFeeRange;
  topCities?: PracticeAreaTopCity[];
  availableNow?: number;
  // Detail-only previews
  featuredLawyers?: LawyerPreview[];
  resolvedActs?: ResolvedBareAct[];
  landmarkDecisions?: LandmarkJudgmentPreview[];
}

export interface PracticeCategoryCount {
  name: string;
  count: number;
}

export interface HeroSummary {
  totalAreas: number;
  totalAdvocates: number;
  totalCategories: number;
  totalActsLinked: number;
}

export interface PracticeAreasResponse {
  success: boolean;
  totalCount: number;
  isDatabaseSourced?: boolean;
  summary?: HeroSummary;
  categories: PracticeCategoryCount[];
  data: PracticeArea[];
}

export interface PracticeAreaDetailResponse {
  success: boolean;
  data: PracticeArea;
}

export interface LawyerCompetitorPreview {
  name: string;
  rating: number;
  experience: number;
  fee: number;
}

export interface LawyerPositionIntelligence {
  isPracticingInArea: boolean;
  lawyerName: string;
  city: string;
  rank: number;
  totalInCity: number;
  userFee: number;
  medianFee: number;
  diff: number;
  percentile: string;
  verifiedCompetitors: LawyerCompetitorPreview[];
}

export interface UnderservedCityGap {
  city: string;
  searches: number;
  advocates: number;
  gapRatio: number;
}

export interface PracticeAreaDemandIntelligence {
  areaId: string;
  name: string;
  monthlySearches: number;
  growthPercentage: number;
  demandLevel: 'High' | 'Moderate' | string;
  underservedCities: UnderservedCityGap[];
}

export interface ActiveClientMatter {
  hasActiveMatter: boolean;
  packId?: string;
  title?: string;
  currentStageIndex?: number;
  totalStages?: number;
  stageName?: string;
  location?: string;
  documentsCount?: number;
  savedAt?: string;
}

export interface AvailabilityAlertResponse {
  success: boolean;
  subscribed?: boolean;
  alertType?: 'available_now' | 'free_consult';
  channels?: ('in_app' | 'email' | 'whatsapp')[];
  message?: string;
}

export interface AlertStatusResponse {
  subscribed: boolean;
  alertType?: 'available_now' | 'free_consult';
  city?: string;
  channels?: ('in_app' | 'email' | 'whatsapp')[];
  createdAt?: string;
}

export interface AvailabilityAlertCancelResponse {
  success: boolean;
  subscribed: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class PracticeAreasService {
  private http = inject(HttpClient);
  private apiUrl = '/api/info/practice-areas';

  // Signals for reactive state
  practiceAreas = signal<PracticeArea[]>([]);
  categories = signal<PracticeCategoryCount[]>([]);
  heroSummary = signal<HeroSummary>({
    totalAreas: 0,
    totalAdvocates: 0,
    totalCategories: 0,
    totalActsLinked: 0
  });
  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);

  private cachedRequest$: Observable<PracticeAreasResponse> | null = null;

  // Client-side fallback seed if backend connection fails
  private readonly fallbackCatalog: PracticeArea[] = [
    {
      id: 'criminal-law',
      name: 'Criminal Law',
      name_hi: 'आपराधिक कानून',
      icon: 'scale',
      category: 'Criminal Justice',
      description: 'Defense against statutory criminal charges under the Bharatiya Nyaya Sanhita (BNS) and legacy IPC, covering bail hearings, trials, and High Court appeals.',
      description_hi: 'भारतीय न्याय संहिता (BNS) और IPC के तहत वैधानिक आपराधिक आरोपों से बचाव, जमानत सुनवाई, मुकदमे और उच्च न्यायालय की अपीलें।',
      tagline: 'Defending liberties across trial and appellate courts under BNS and BNSS.',
      accent: 'red',
      subfields: ['NDPS Cases', 'Bail Matters', 'Criminal Appeals', 'Trials', 'White Collar Defense'],
      relevantActs: ['Bharatiya Nyaya Sanhita (BNS)', 'Bharatiya Nagarik Suraksha Sanhita (BNSS)', 'Arms Act'],
      typicalForums: ['Sessions Court', 'High Court', 'Supreme Court of India'],
      popular: true,
      isFeatured: true,
      advocateCount: 14,
      avgExperience: 11.4,
      avgRating: 4.8,
      feeRange: { min: 1000, median: 2500, max: 7500 },
      topCities: [{ city: 'Delhi', count: 6 }, { city: 'Mumbai', count: 4 }, { city: 'Bengaluru', count: 2 }],
      availableNow: 5
    },
    {
      id: 'bail-matters',
      name: 'Bail Matters & Remand',
      name_hi: 'जमानत मामले और रिमांड',
      icon: 'key',
      category: 'Criminal Justice',
      description: 'Emergency legal representation for securing anticipatory bail, transit bail, regular bail, and statutory default bail under BNSS provisions.',
      description_hi: 'बीएनएसएस प्रावधानों के तहत अग्रिम जमानत, ट्रांजिट जमानत, नियमित जमानत और वैधानिक डिफ़ॉल्ट जमानत के लिए आपातकालीन कानूनी प्रतिनिधित्व।',
      tagline: 'Prompt legal recourse for personal liberty and immediate judicial release.',
      accent: 'amber',
      subfields: ['Anticipatory Bail', 'Regular Bail', 'Transit Bail', 'Default Bail (Sec 479 BNSS)'],
      relevantActs: ['BNSS 2023 Sec 480', 'BNSS 2023 Sec 482', 'Constitution Art 21'],
      typicalForums: ['Magistrate Court', 'Sessions Court', 'High Court'],
      popular: true,
      isFeatured: true,
      advocateCount: 19,
      avgExperience: 10.2,
      avgRating: 4.7,
      feeRange: { min: 1500, median: 3000, max: 8000 },
      topCities: [{ city: 'Delhi', count: 8 }, { city: 'Jaipur', count: 4 }, { city: 'Lucknow', count: 3 }],
      availableNow: 7
    },
    {
      id: 'property-disputes',
      name: 'Property Disputes & Land Law',
      name_hi: 'संपत्ति विवाद और भूमि कानून',
      icon: 'home',
      category: 'Real Estate & Property',
      description: 'Resolution of property conflicts regarding clear titles, partition suits, boundary disputes, unlawful possession, and ancestral estate claims.',
      description_hi: 'स्पष्ट स्वामित्व, विभाजन मुकदमे, सीमा विवाद, अवैध कब्जे और पैतृक संपत्ति के दावों पर संपत्ति विवादों का समाधान।',
      tagline: 'Protecting land titles and real estate inheritance across civil tribunals.',
      accent: 'emerald',
      subfields: ['Title Verification', 'Partition Suits', 'Encroachment Actions', 'Inheritance Disputes'],
      relevantActs: ['Transfer of Property Act 1882', 'Specific Relief Act 1963', 'Registration Act 1908'],
      typicalForums: ['Civil Court (Senior Division)', 'District Court', 'Revenue Tribunal'],
      popular: true,
      isFeatured: true,
      advocateCount: 18,
      avgExperience: 14.5,
      avgRating: 4.9,
      feeRange: { min: 2000, median: 4000, max: 10000 },
      topCities: [{ city: 'Mumbai', count: 7 }, { city: 'Delhi', count: 5 }, { city: 'Pune', count: 3 }],
      availableNow: 6
    },
    {
      id: 'cyber-crime',
      name: 'Cyber Crime & Online Fraud',
      name_hi: 'साइबर अपराध और ऑनलाइन धोखाधड़ी',
      icon: 'lock',
      category: 'Technology & Privacy',
      description: 'Representation in online financial scams, phishing attacks, identity theft, data breach investigations, and IT Act infractions.',
      description_hi: 'ऑनलाइन वित्तीय धोखाधड़ी, फ़िशिंग हमलों, पहचान की चोरी, डेटा उल्लंघन जांच और आईटी अधिनियम उल्लंघनों में प्रतिनिधित्व।',
      tagline: 'Digital defense against cyber fraud, privacy breaches, and online extortion.',
      accent: 'cyan',
      subfields: ['UPI Fraud', 'Phishing & Identity Theft', 'Section 66D IT Act', 'Crypto Scam Inquiries'],
      relevantActs: ['Information Technology Act 2000', 'BNS 2023', 'DPDP Act 2023'],
      typicalForums: ['Cyber Crime Police Stations', 'Adjudicating Officer IT Act', 'Sessions Court'],
      popular: true,
      isFeatured: true,
      advocateCount: 12,
      avgExperience: 8.8,
      avgRating: 4.6,
      feeRange: { min: 1500, median: 3500, max: 9000 },
      topCities: [{ city: 'Bengaluru', count: 5 }, { city: 'Hyderabad', count: 3 }, { city: 'Delhi', count: 2 }],
      availableNow: 4
    },
    {
      id: 'family-law',
      name: 'Family Law & Domestic Relations',
      name_hi: 'पारिवारिक कानून और घरेलू संबंध',
      icon: 'users',
      category: 'Personal & Family Relations',
      description: 'Holistic handling of sensitive matrimonial matters, personal law rights, mutual consent separations, and division of joint matrimonial assets.',
      description_hi: 'संवेदनशील वैवाहिक मामलों, व्यक्तिगत कानून अधिकारों, आपसी सहमति से अलगाव और संयुक्त वैवाहिक संपत्तियों के विभाजन का समग्र समाधान।',
      tagline: 'Compassionate and resolute counsel for matrimonial rights and child welfare.',
      accent: 'pink',
      subfields: ['Mutual Consent Divorce', 'Contested Divorce', 'Alimony & Maintenance', 'Restitution of Conjugal Rights'],
      relevantActs: ['Hindu Marriage Act 1955', 'Special Marriage Act 1954', 'Indian Divorce Act 1869'],
      typicalForums: ['Family Court', 'High Court'],
      popular: true,
      isFeatured: true,
      advocateCount: 16,
      avgExperience: 12.0,
      avgRating: 4.8,
      feeRange: { min: 1000, median: 2500, max: 6000 },
      topCities: [{ city: 'Delhi', count: 5 }, { city: 'Mumbai', count: 4 }, { city: 'Kolkata', count: 3 }],
      availableNow: 6
    },
    {
      id: 'corporate-law',
      name: 'Corporate Law & Governance',
      name_hi: 'कॉर्पोरेट कानून और शासन',
      icon: 'briefcase',
      category: 'Corporate & Commercial',
      description: 'Counseling companies and boards on statutory compliance, shareholder agreements, corporate restructuring, and regulatory disclosures.',
      description_hi: 'वैधानिक अनुपालन, शेयरधारक समझौतों, कॉर्पोरेट पुनर्गठन और विनियामक खुलासे पर कंपनियों और बोर्डों को सलाह।',
      tagline: 'Strategic counsel for businesses, boardrooms, and statutory compliances.',
      accent: 'blue',
      subfields: ['Company Incorporation', 'Shareholder Disputes', 'Director Liabilities', 'Board Governance'],
      relevantActs: ['Companies Act 2013', 'SEBI Regulations', 'FEMA 1999'],
      typicalForums: ['NCLT', 'NCLAT', 'High Court'],
      popular: true,
      isFeatured: true,
      advocateCount: 15,
      avgExperience: 13.2,
      avgRating: 4.9,
      feeRange: { min: 3000, median: 6000, max: 15000 },
      topCities: [{ city: 'Mumbai', count: 8 }, { city: 'Bengaluru', count: 4 }, { city: 'Delhi', count: 3 }],
      availableNow: 5
    }
  ];

  /**
   * Fetches the complete practice areas catalog with live aggregated statistics.
   * Caches results using shareReplay(1) to avoid redundant network round-trips during navigation.
   * Gracefully degrades to a rich client-side fallback catalog if backend connectivity is interrupted.
   *
   * @param forceRefresh Optional flag to bypass cache and fetch fresh catalog from the server.
   * @returns Observable resolving to PracticeAreasResponse.
   */
  fetchPracticeAreas(forceRefresh: boolean = false): Observable<PracticeAreasResponse> {
    if (this.cachedRequest$ && !forceRefresh && this.practiceAreas().length > 0) {
      return this.cachedRequest$;
    }

    this.isLoading.set(true);
    this.hasError.set(false);

    this.cachedRequest$ = this.http.get<PracticeAreasResponse>(this.apiUrl).pipe(
      tap(res => {
        if (res && res.success && Array.isArray(res.data)) {
          this.practiceAreas.set(res.data);
          this.categories.set(res.categories || []);
          if (res.summary) {
            this.heroSummary.set(res.summary);
          } else {
            this.computeSummary(res.data, res.categories || []);
          }
        }
        this.isLoading.set(false);
      }),
      catchError(err => {
        console.warn('Practice Areas API fallback engaged:', err);
        this.hasError.set(true);

        const cats = ['All', ...Array.from(new Set(this.fallbackCatalog.map(p => p.category)))];
        const catsWithCounts: PracticeCategoryCount[] = cats.map(c => ({
          name: c,
          count: c === 'All' ? this.fallbackCatalog.length : this.fallbackCatalog.filter(p => p.category === c).length
        }));

        this.practiceAreas.set(this.fallbackCatalog);
        this.categories.set(catsWithCounts);
        this.computeSummary(this.fallbackCatalog, catsWithCounts);
        this.isLoading.set(false);

        return of({
          success: true,
          totalCount: this.fallbackCatalog.length,
          categories: catsWithCounts,
          data: this.fallbackCatalog
        });
      }),
      shareReplay(1)
    );

    return this.cachedRequest$;
  }

  /**
   * Fetches the complete dossier for an individual practice area, including empanelled advocates,
   * mapped bare acts, landmark precedent judgments, and court escalation stages.
   *
   * @param id Unique identifier or slug of the practice area.
   * @returns Observable resolving to PracticeAreaDetailResponse.
   */
  fetchPracticeAreaDetail(id: string): Observable<PracticeAreaDetailResponse> {
    return this.http.get<PracticeAreaDetailResponse>(`${this.apiUrl}/${encodeURIComponent(id)}`).pipe(
      catchError(err => {
        console.warn(`Detail fetch failed for ${id}, falling back to local item`, err);
        const match = this.practiceAreas().find(p => p.id === id || p.name.toLowerCase() === id.toLowerCase());
        if (match) {
          return of({ success: true, data: match });
        }
        return of({ success: false, data: null as any });
      })
    );
  }

  /**
   * Dispatches anonymous usage telemetry (page view or consultation CTA click)
   * to train platform recommendation rankings. Operates with fire-and-forget semantics.
   *
   * @param id Unique identifier or slug of the practice area.
   * @param event Interaction event classification ('view' | 'cta').
   */
  trackEvent(id: string, event: 'view' | 'cta'): void {
    if (!id) return;
    this.http.post(`${this.apiUrl}/${encodeURIComponent(id)}/track`, { event }).subscribe({
      error: () => { } // Fire-and-forget telemetry
    });
  }

  /**
   * Records zero-result search terms to help administrators detect jurisdictional or statutory demand gaps.
   *
   * @param query The raw query string submitted by the user.
   */
  logSearchMiss(query: string): void {
    if (!query || query.trim().length < 3) return;
    this.http.post(`${this.apiUrl}/search-miss`, { query: query.trim() }).subscribe({
      error: () => { } // Fire-and-forget telemetry
    });
  }

  /**
   * Retrieves competitive positioning intelligence and fee percentile ranking for an advocate
   * practicing within a given municipal jurisdiction and practice area.
   *
   * @param id Unique identifier or slug of the practice area.
   * @param city Optional target municipal city jurisdiction.
   * @param fee Optional consultation fee quote for percentile comparison.
   * @returns Observable resolving to LawyerPositionIntelligence or null on failure.
   */
  getLawyerPosition(id: string, city?: string, fee?: number): Observable<LawyerPositionIntelligence | null> {
    let params = new HttpParams();
    if (city) {
      params = params.set('city', city);
    }
    if (fee !== undefined && fee !== null) {
      params = params.set('fee', fee.toString());
    }

    return this.http.get<{ success: boolean; data: LawyerPositionIntelligence }>(
      `${this.apiUrl}/${encodeURIComponent(id)}/lawyer-position`,
      { params }
    ).pipe(
      map(res => res?.data || null),
      catchError(() => of(null))
    );
  }

  /**
   * Retrieves regional demand signals, search velocity, and underserved city gaps for a practice area.
   * Enables advocates to identify geographic regions experiencing high demand with scarce legal representation.
   *
   * @param id Unique identifier or slug of the practice area.
   * @returns Observable resolving to PracticeAreaDemandIntelligence or null on failure.
   */
  getDemandIntelligence(id: string): Observable<PracticeAreaDemandIntelligence | null> {
    return this.http.get<{ success: boolean; data: PracticeAreaDemandIntelligence }>(
      `${this.apiUrl}/${encodeURIComponent(id)}/demand`
    ).pipe(
      map(res => res?.data || null),
      catchError(() => of(null))
    );
  }

  /**
   * Fetches active client case packs or legal roadmaps linked to this practice area for the authenticated user.
   * Allows the practice area drawer to show relevant ongoing matter progress and step guidance.
   *
   * @param id Unique identifier or slug of the practice area.
   * @returns Observable resolving to ActiveClientMatter or null on failure.
   */
  getMyActiveMatter(id: string): Observable<ActiveClientMatter | null> {
    return this.http.get<{ success: boolean; data: ActiveClientMatter }>(
      `${this.apiUrl}/${encodeURIComponent(id)}/my-matter`
    ).pipe(
      map(res => res?.data || null),
      catchError(() => of(null))
    );
  }

  /**
   * Registers or updates an advocate availability alert radar for a specific practice area and city.
   * Dispatches trigger type and delivery channel selections to the notification dispatch pipeline.
   *
   * @param id Unique identifier or slug of the practice area.
   * @param city Target municipal city jurisdiction.
   * @param alertType Alert trigger ('available_now' | 'free_consult').
   * @param channels Selected delivery channels (['in_app', 'email']).
   * @returns Observable resolving to AvailabilityAlertResponse.
   */
  subscribeAvailabilityAlert(
    id: string,
    city: string,
    alertType: 'available_now' | 'free_consult' | string = 'available_now',
    channels: string[] = ['in_app', 'email']
  ): Observable<AvailabilityAlertResponse> {
    return this.http.post<AvailabilityAlertResponse>(
      `${this.apiUrl}/${encodeURIComponent(id)}/alert`,
      { city, alertType, channels }
    ).pipe(
      catchError(err => of({ success: false, message: err?.message || 'Failed to register alert' }))
    );
  }

  /**
   * Queries whether the authenticated user has an active alert subscription registered for the designated practice area.
   *
   * @param id Unique identifier or slug of the practice area.
   * @returns Observable resolving to AlertStatusResponse.
   */
  getAlertStatus(id: string): Observable<AlertStatusResponse> {
    return this.http.get<AlertStatusResponse>(
      `${this.apiUrl}/${encodeURIComponent(id)}/alert-status`
    ).pipe(
      catchError(() => of({ subscribed: false }))
    );
  }

  /**
   * Unsubscribes the current user from availability alerts for the designated practice area.
   *
   * @param id Unique identifier or slug of the practice area.
   * @returns Observable resolving to AvailabilityAlertCancelResponse.
   */
  unsubscribeAvailabilityAlert(id: string): Observable<AvailabilityAlertCancelResponse> {
    return this.http.delete<AvailabilityAlertCancelResponse>(
      `${this.apiUrl}/${encodeURIComponent(id)}/alert`
    ).pipe(
      catchError(err => of({ success: false, subscribed: false, message: err?.message || 'Failed to cancel alert' }))
    );
  }

  /**
   * Computes reactive aggregate metrics (total areas, advocates, categories, linked statutes)
   * for the hero banner when summary metadata is absent in server response.
   *
   * @param areas Array of practice areas.
   * @param categories Category count breakdown.
   */
  private computeSummary(areas: PracticeArea[], categories: PracticeCategoryCount[]): void {
    const totalAdvocates = areas.reduce((sum, a) => sum + (a.advocateCount || 0), 0);
    const acts = new Set<string>();
    areas.forEach(a => (a.relevantActs || []).forEach(act => acts.add(act)));

    this.heroSummary.set({
      totalAreas: areas.length,
      totalAdvocates,
      totalCategories: Math.max(0, categories.length - 1),
      totalActsLinked: acts.size
    });
  }
}