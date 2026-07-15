import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LegalService } from '../../services/legal.service';
import { DatabaseService } from '../../services/database.service';
import { FormsModule } from '@angular/forms';
import { SnackbarService } from '../../services/snackbar.service';
import { DocumentTemplateService, Template } from '../../services/document-template.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { LocationService } from '../../services/location.service';
import { BookmarkService } from '../../services/bookmark.service';
import { FormattingService } from '../../services/formatting.service';
import { FreeAidService } from '../../services/free-aid.service';

// Standalone sub-components
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { LawResultCardComponent } from './components/law-card/law-card.component';
import { ResourceCardComponent } from '../find-help/components/resource-card/resource-card.component';
import { FreeAidCheckerComponent } from '../find-help/components/free-aid-checker/free-aid-checker.component';
import { ReaderModeModalComponent } from './components/reader-modal/reader-modal.component';
import { LawViewerCompareComponent } from '../law-viewer/law-viewer-compare/law-viewer-compare.component';
import { LawyerCardComponent } from '../../components/lawyer-card/lawyer-card.component';
import { CommonQueriesComponent } from './components/common-queries/common-queries.component';
import { AiRoadmapWidgetComponent } from './components/ai-roadmap-widget/ai-roadmap-widget.component';
import { EmergencyRightsWidgetComponent } from './components/emergency-rights-widget/emergency-rights-widget.component';
import { TrafficOffensesWidgetComponent } from './components/traffic-offenses-widget/traffic-offenses-widget.component';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    TooltipDirective,
    SearchBarComponent,
    LawResultCardComponent,
    ResourceCardComponent,
    FreeAidCheckerComponent,
    ReaderModeModalComponent,
    LawViewerCompareComponent,
    LawyerCardComponent,
    CommonQueriesComponent,
    AiRoadmapWidgetComponent,
    EmergencyRightsWidgetComponent,
    TrafficOffensesWidgetComponent
  ],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchComponent implements OnInit, OnDestroy {
  // Services
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private legalService = inject(LegalService);
  private db = inject(DatabaseService);
  private snackbar = inject(SnackbarService);
  private templateService = inject(DocumentTemplateService);
  private locationService = inject(LocationService);
  private bookmarkService = inject(BookmarkService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);
  private freeAidService = inject(FreeAidService);
  private formatting = inject(FormattingService);

  queryStack: string[] = [];
  private isGoingBack = false;

  resetSearch() {
    this.searchQuery = '';
    this.lastQuery = '';
    this.lastCity = '';
    this.queryStack = [];
    this.isGoingBack = false;
    this.router.navigate(['/search']);
  }

  goBackOrReset() {
    if (this.queryStack.length > 0) {
      this.isGoingBack = true;
      const prevQuery = this.queryStack.pop()!;
      this.searchQuery = prevQuery;
      this.performSearch();
    } else {
      this.resetSearch();
    }
  }

  // Search Input & Query State
  searchQuery = '';
  lastQuery = '';
  lastCity = '';
  previousNormalQuery = '';
  selectedCity = localStorage.getItem('lc_search_city') || 'New Delhi';
  activeTab: 'all' | 'laws' | 'lawyers' | 'resources' | 'templates' = 'all';
  loading = false;
  hasSearched = false;
  isOffline = !navigator.onLine;

  // Pagination & Loading States
  loadingMore = false;
  loadingMoreLawyers = false;
  hasMoreLaws = false;
  hasMoreLawyers = false;
  lawsPage = 1;
  lawyersPage = 1;
  showLawyerLocationFallback = false;
  lawyerLocationFallbackMsg = '';
  activeSectionOrder: string[] = ['laws', 'lawyers', 'resources', 'templates'];

  // Scroll Affordance State
  canScrollLeft = false;
  canScrollRight = false;

  // Search Cache (Optimization #11)
  private searchCache = new Map<string, any>();

  // Search Results State
  results = {
    laws: [] as any[],
    lawyers: [] as any[],
    resources: [] as any[],
    templates: [] as Template[]
  };

  get hasAnyResults(): boolean {
    return this.results.laws.length > 0 ||
      this.results.lawyers.length > 0 ||
      this.results.resources.length > 0 ||
      this.results.templates.length > 0;
  }

  // Search History
  searchHistory: string[] = [];

  // Levenshtein Spellcheck
  suggestedCorrection: string | null = null;
  private legalDictionary = [
    'murder', 'theft', 'kidnapping', 'extortion', 'defamation', 'rape', 'assault',
    'eviction', 'rent', 'agreement', 'notice', 'summons', 'cheque bounce', 'bail',
    'cyber crime', 'forgery', 'cheating', 'trespass', 'adultery', 'maintenance',
    'divorce', 'dowry', 'fundamental rights', 'contract', 'lease', 'fir', 'police'
  ];

  // Old-to-New Penal Law Comparison
  showCompareModal = false;
  comparingActiveSection: any = null;
  comparingShortName = '';

  // Reader Mode Modal
  showReaderModal = false;
  readerSection: any = null;

  // AI Scenario Roadmap
  aiRoadmap: any = null;
  aiRoadmapLoading = false;

  dismissedRoadmap = false;
  dismissedEmergency = false;
  dismissedTraffic = false;

  dismissRoadmap() {
    this.dismissedRoadmap = true;
    this.cdr.markForCheck();
  }

  dismissEmergency() {
    this.dismissedEmergency = true;
    this.cdr.markForCheck();
  }

  dismissTraffic() {
    this.dismissedTraffic = true;
    this.cdr.markForCheck();
  }

  // Free Legal Aid Eligibility getters
  get eligibilityStep(): number {
    return this.freeAidService.eligibilityStep;
  }

  get eligibilityAnswers() {
    return this.freeAidService.eligibilityAnswers;
  }

  get isFreeAidEligible(): boolean {
    return this.freeAidService.isFreeAidEligible;
  }

  // Mobile Filter State
  showMobileFilters = false;
  filterBailable: 'all' | 'bailable' | 'non-bailable' = 'all';
  filterCognizable: 'all' | 'cognizable' | 'non-cognizable' = 'all';
  filterMaxFee = 25000;

  // Skeleton placeholder array
  readonly skeletonItems = [1, 2, 3];

  ngOnInit() {
    // Network listeners
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);

    // Initialize search history
    this.loadSearchHistory();

    // Subscribe to custom and default templates (Optimization #5: takeUntilDestroyed)
    this.templateService.customTemplates$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => { });

    // Subscribe to active location changes from global LocationService (Optimization #5: takeUntilDestroyed)
    this.locationService.activeLocation$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(loc => {
        if (this.selectedCity !== loc) {
          this.selectedCity = loc;
          localStorage.setItem('lc_search_city', loc);
          if (this.hasSearched) {
            this.performSearch();
          }
        }
      });

    // Handle incoming URL queries (Optimization #5: takeUntilDestroyed)
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const q = params['q'];
        const city = params['city'] || this.selectedCity;
        const tab = params['tab'] || 'all';

        // Optimization #9: Avoid duplicate search request on tab navigation (State retention)
        if (q === this.lastQuery && city === this.lastCity) {
          if (this.activeTab !== tab) {
            this.activeTab = tab as any;
            this.cdr.markForCheck();
          }
          return;
        }

        if (city) {
          this.selectedCity = city;
          localStorage.setItem('lc_search_city', city);
          if (this.locationService.getCurrentLocation() !== city) {
            this.locationService.setLocation(city, false);
          }
        }

        this.activeTab = tab as any;

        if (q) {
          if (this.lastQuery && this.lastQuery !== q && !q.startsWith('expert:') && !this.isGoingBack) {
            if (this.queryStack[this.queryStack.length - 1] !== this.lastQuery) {
              this.queryStack.push(this.lastQuery);
            }
          }
          this.isGoingBack = false;

          this.searchQuery = q;
          if (q.toLowerCase().startsWith('expert:') && tab !== 'lawyers') {
            this.activeTab = 'lawyers';
            this.router.navigate(['/search'], {
              queryParams: {
                q: q,
                city: city,
                tab: 'lawyers'
              },
              replaceUrl: true
            });
            return;
          }
          this.executeGlobalSearch(q);
        } else {
          this.hasSearched = false;
          this.lastQuery = '';
          this.lastCity = '';
          this.results = { laws: [], lawyers: [], resources: [], templates: [] };
          this.aiRoadmap = null;
          this.suggestedCorrection = null;
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy() {
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
  }

  // --- Network Status ---
  private onOnline = () => {
    this.isOffline = false;
    this.snackbar.show('Back online!', 'success');
  };

  private onOffline = () => {
    this.isOffline = true;
    this.snackbar.show('You are offline. Searching from local cache.', 'warning');
  };

  // --- Search History ---
  private loadSearchHistory() {
    try {
      const hist = localStorage.getItem('lc_search_history');
      if (hist) {
        this.searchHistory = JSON.parse(hist).slice(0, 5);
      } else {
        this.searchHistory = [];
      }
    } catch {
      this.searchHistory = [];
    }
  }

  private saveSearchHistory(query: string) {
    if (!query.trim()) return;
    this.searchHistory = this.searchHistory.filter(h => h.toLowerCase() !== query.toLowerCase());
    this.searchHistory.unshift(query);
    this.searchHistory = this.searchHistory.slice(0, 5); // Max 5 items
    localStorage.setItem('lc_search_history', JSON.stringify(this.searchHistory));
  }

  clearSearchHistory() {
    this.searchHistory = [];
    localStorage.removeItem('lc_search_history');
    this.snackbar.show('Search history cleared.', 'info');
  }

  trackByQuery(_index: number, query: string): string {
    return query;
  }

  // --- Search Executions ---
  performSearch() {
    if (!this.searchQuery.trim()) return;
    this.router.navigate(['/search'], {
      queryParams: {
        q: this.searchQuery,
        city: this.selectedCity,
        tab: this.activeTab
      }
    });
  }

  setTab(tab: 'all' | 'laws' | 'lawyers' | 'resources' | 'templates') {
    this.activeTab = tab;
    if (tab !== 'lawyers' && this.searchQuery.startsWith('expert:')) {
      this.searchQuery = this.previousNormalQuery || this.searchQuery.replace(/^expert:/i, '');
    }
    this.router.navigate(['/search'], {
      queryParams: {
        q: this.searchQuery,
        city: this.selectedCity,
        tab: tab
      }
    });
  }

  private async executeGlobalSearch(query: string) {
    this.loading = true;
    this.hasSearched = true;
    this.lastQuery = query;
    this.lastCity = this.selectedCity;
    this.saveSearchHistory(query);

    if (!query.toLowerCase().startsWith('expert:')) {
      this.previousNormalQuery = query;
    }

    // Spellcheck matching Levenshtein
    this.suggestedCorrection = this.formatting.checkSpelling(query, this.legalDictionary);

    const cacheKey = `${query.trim().toLowerCase()}:${this.selectedCity.toLowerCase()}`;

    // Optimization #11: In-memory query caching
    if (this.searchCache.has(cacheKey)) {
      const cachedData = this.searchCache.get(cacheKey);
      this.results = cachedData.results;
      this.aiRoadmap = cachedData.aiRoadmap;
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.results = { laws: [], lawyers: [], resources: [], templates: [] };
    this.aiRoadmap = null;

    // Check if query is natural language scenario (> 8 words)
    const wordCount = query.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 8 && navigator.onLine) {
      this.triggerAiRoadmap(query);
    }

    if (this.isOffline) {
      await this.executeOfflineSearch(query);
      return;
    }

    const coords = this.locationService.getCoordinates();
    // Unified endpoint search
    this.legalService.searchHub(query, this.selectedCity, 10, coords?.lat, coords?.lng)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const laws = res.data?.laws || [];
          const lawyers = res.data?.lawyers || [];
          const resources = res.data?.resources || [];
          const matchedTemplates = this.searchTemplatesLocally(query);

          this.results = {
            laws: laws,
            lawyers: lawyers,
            resources: resources,
            templates: matchedTemplates
          };

          // Cache result in frontend memory (Optimization #11) with size-limit eviction
          if (this.searchCache.size >= 20) {
            const oldestKey = this.searchCache.keys().next().value;
            if (oldestKey !== undefined) {
              this.searchCache.delete(oldestKey);
            }
          }
          this.searchCache.set(cacheKey, {
            results: this.results,
            aiRoadmap: this.aiRoadmap
          });

          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.snackbar.show('Failed to fetch search results from server. Using offline cache.', 'warning');
          this.executeOfflineSearch(query);
        }
      });
  }

  private async executeOfflineSearch(query: string) {
    try {
      const localSections = await this.db.searchSections(query);
      const mappedResults: any[] = [];

      for (const sec of localSections) {
        const act = await this.db.getActByShortName(sec.actShortName);
        mappedResults.push({
          _id: sec.id?.toString() || sec.section_number,
          section_number: sec.section_number,
          title: sec.title,
          title_hi: sec.title_hi || sec.title,
          content: sec.content,
          content_hi: sec.content_hi || sec.content,
          actName: act ? act.actName : sec.actShortName,
          shortName: sec.actShortName,
          year: act ? Number(act.year) : undefined,
          chapterNumber: sec.chapterNumber,
          snippet: sec.content ? sec.content.substring(0, 150) + '...' : '',
          criminalDetails: {
            isBailable: true,
            isCognizable: false,
            compoundable: 'Unknown (Offline)',
            punishment: 'Refer online documentation',
            severity: 'low'
          }
        });
      }

      const matchedTemplates = this.searchTemplatesLocally(query);

      this.results = {
        laws: mappedResults,
        lawyers: [],
        resources: [],
        templates: matchedTemplates
      };

      this.loading = false;
      this.snackbar.show(`Offline Search: Loaded ${mappedResults.length} laws, ${matchedTemplates.length} templates.`, 'info');
      this.cdr.markForCheck();
    } catch (e) {
      console.error(e);
      this.results = { laws: [], lawyers: [], resources: [], templates: [] };
      this.loading = false;
      this.snackbar.show('Offline search failed. Cache unavailable.', 'error');
      this.cdr.markForCheck();
    }
  }

  private getLocalCustomTemplates(): Template[] {
    let customTemplates: Template[] = [];
    const localData = localStorage.getItem('lc_custom_templates');
    if (localData) {
      try {
        customTemplates = JSON.parse(localData);
      } catch (e) {
        customTemplates = [];
      }
    }
    return customTemplates;
  }

  private searchTemplatesLocally(query: string): Template[] {
    const list = [
      ...this.getLocalCustomTemplates(),
      {
        id: 'cheque-bounce-notice',
        title: 'Section 138 Cheque Bounce Demand Notice Template',
        actRef: 'Section 138, Negotiable Instruments Act',
        category: 'commercial',
        description: 'Standard legal demand notice sent to a drawer of a bounced cheque, demanding payment within 15 days of notice receipt.',
        fields: [],
        body: ''
      },
      {
        id: 'landlord-eviction-notice',
        title: 'Tenant Eviction Notice (Rent Default)',
        actRef: 'Section 106, Transfer of Property Act',
        category: 'civil',
        description: 'Official notice issued by a landlord to evict a tenant for non-payment of rent, providing a 15-day termination period.',
        fields: [],
        body: ''
      },
      {
        id: 'mutual-divorce-deed',
        title: 'Mutual Consent Divorce Deed Template',
        actRef: 'Section 13B, Hindu Marriage Act, 1955',
        category: 'personal',
        description: 'Pre-drafted deed to detail separation terms, alimony, child custody, and mutual agreement between spouses before filing in court.',
        fields: [],
        body: ''
      },
      {
        id: 'rental-agreement-deed',
        title: 'Residential Lease / Rental Agreement Draft',
        actRef: 'Civil Contract Code & State Rent Acts',
        category: 'civil',
        description: 'Standard tenancy contract defining lease terms, security deposits, monthly rent, and notice durations.',
        fields: [],
        body: ''
      }
    ];

    const qLower = query.toLowerCase();
    return list.filter(t =>
      t.title.toLowerCase().includes(qLower) ||
      t.description.toLowerCase().includes(qLower) ||
      t.actRef.toLowerCase().includes(qLower)
    );
  }

  // --- AI Scenario Solver ---
  private triggerAiRoadmap(query: string) {
    this.aiRoadmapLoading = true;
    this.aiRoadmap = null;

    this.legalService.solveAiScenario(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res && res.success) {
            this.aiRoadmap = res;

            // Update cache with AI roadmap once it arrives (Optimization #11)
            const cacheKey = `${query.trim().toLowerCase()}:${this.selectedCity.toLowerCase()}`;
            if (this.searchCache.has(cacheKey)) {
              const cached = this.searchCache.get(cacheKey);
              cached.aiRoadmap = this.aiRoadmap;
              this.searchCache.set(cacheKey, cached);
            }
          }
          this.aiRoadmapLoading = false;
        },
        error: () => {
          this.aiRoadmapLoading = false;
        }
      });
  }



  applySpellcheck() {
    if (this.suggestedCorrection) {
      this.searchQuery = this.suggestedCorrection;
      this.suggestedCorrection = null;
      this.performSearch();
    }
  }

  // --- Old-to-New Law Transition Mapping ---
  openCompareModal(sec: any) {
    this.comparingActiveSection = sec;
    this.comparingShortName = sec.shortName;
    this.showCompareModal = true;
    this.cdr.markForCheck();
  }

  closeCompareModal() {
    this.showCompareModal = false;
    this.cdr.markForCheck();
  }

  // --- Reader Mode ---
  openReaderMode(sec: any) {
    this.readerSection = sec;
    this.showReaderModal = true;
  }

  closeReaderMode() {
    this.showReaderModal = false;
  }

  // --- Case Pack Saving ---
  toggleSaveItem(item: any, type: 'law' | 'lawyer' | 'resource' | 'template') {
    if (type === 'law') {
      if (this.isSaved(item)) {
        this.bookmarkService.removeBookmark(item.shortName, item.section_number);
      } else {
        const sec = {
          section_number: item.section_number,
          title: item.title,
          content: item.content || item.snippet || ''
        };
        this.bookmarkService.addBookmark(item.shortName, item.chapterNumber || 'I', sec, 'Case Packs');
      }
    }
  }

  isSaved(item: any): boolean {
    if (item.shortName && item.section_number) {
      return this.bookmarkService.isBookmarked(item.shortName, item.section_number);
    }
    return false;
  }

  applyMobileFilters() {
    this.showMobileFilters = false;
    this.snackbar.show('Applied custom filters to active search query results.', 'success');
  }

  resetMobileFilters() {
    this.filterBailable = 'all';
    this.filterCognizable = 'all';
    this.filterMaxFee = 25000;
    this.snackbar.show('Reset search filters.', 'info');
  }

  // --- Free Legal Aid Eligibility Flow Check ---
  showFreeAidModal = false;

  openFreeAidModal() {
    this.showFreeAidModal = true;
    document.body.style.overflow = 'hidden';
    this.startEligibilityCheck();
    this.cdr.markForCheck();
  }

  closeFreeAidModal() {
    this.showFreeAidModal = false;
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  submitEligibilityStepFromModal() {
    this.submitEligibilityStep();
    this.closeFreeAidModal();
  }

  startEligibilityCheck() {
    this.freeAidService.startEligibilityCheck();
    this.cdr.markForCheck();
  }

  submitEligibilityStep() {
    this.freeAidService.submitEligibilityStep(this.eligibilityAnswers);
    this.cdr.markForCheck();
  }

  resetEligibilityCheck() {
    this.freeAidService.resetEligibilityCheck();
    this.cdr.markForCheck();
  }

  setEligibilityStep(step: number) {
    this.freeAidService.setStep(step);
    this.cdr.markForCheck();
  }

  // --- 'Load More' Pagination on Laws ---
  loadMoreLaws() {
    if (this.loadingMore || !this.hasMoreLaws) return;
    this.loadingMore = true;
    this.lawsPage++;
    this.cdr.markForCheck();

    this.legalService.searchLaws(this.lastQuery, this.lawsPage, 20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const newLaws = res.data || [];

          const highlightedNewLaws = newLaws.map((item: any) => ({
            ...item,
            rawTitle: item.title,
            title: this.formatting.highlightKeywords(item.title, this.lastQuery),
            snippet: this.formatting.highlightKeywords(item.snippet || item.content || '', this.lastQuery),
            highlightedContent: this.formatting.highlightKeywords(item.content || '', this.lastQuery),
            criminalDetails: item.criminalDetails || null
          }));

          this.results.laws = [...this.results.laws, ...highlightedNewLaws];
          this.hasMoreLaws = newLaws.length >= 20;
          this.loadingMore = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingMore = false;
          this.snackbar.show('Failed to load more laws.', 'error');
          this.cdr.markForCheck();
        }
      });
  }

  // --- 'Load More' Pagination on Lawyers ---
  loadMoreLawyers() {
    if (this.loadingMoreLawyers || !this.hasMoreLawyers) return;
    this.loadingMoreLawyers = true;
    this.lawyersPage++;
    this.cdr.markForCheck();

    const nextLimit = this.lawyersPage * 10;
    const coords = this.locationService.getCoordinates();

    this.legalService.searchHub(this.lastQuery, this.selectedCity, nextLimit, coords?.lat, coords?.lng)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const newLawyers = res.data?.lawyers || [];

          this.results.lawyers = newLawyers;
          this.hasMoreLawyers = newLawyers.length >= nextLimit;
          this.loadingMoreLawyers = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingMoreLawyers = false;
          this.snackbar.show('Failed to load more advocates.', 'error');
          this.cdr.markForCheck();
        }
      });
  }

  // --- Dynamic Intent-Based Category Sorting ---
  getSortedSectionsBasedOnQueryIntent(query: string): string[] {
    const q = query.toLowerCase();
    const defaults = ['laws', 'lawyers', 'resources', 'templates'];

    if (q.includes('arrest') || q.includes('police') || q.includes('custody') || q.includes('bail') || q.includes('fir') || q.includes('summons')) {
      return ['laws', 'resources', 'lawyers', 'templates'];
    }
    if (q.includes('draft') || q.includes('notice') || q.includes('agreement') || q.includes('will') || q.includes('deed') || q.includes('template')) {
      return ['templates', 'laws', 'lawyers', 'resources'];
    }
    if (q.includes('lawyer') || q.includes('advocate') || q.includes('consult') || q.includes('expert') || q.includes('contact') || q.includes('legal help')) {
      return ['lawyers', 'laws', 'resources', 'templates'];
    }
    return defaults;
  }

  getSectionOrder(sectionId: string): number {
    return this.activeSectionOrder.indexOf(sectionId);
  }

  // --- Regional Location Fallback for Advocates ---
  triggerAdvocateFallback(query: string) {
    let fallbackRegion = 'Delhi NCR';
    const cityLower = this.selectedCity.toLowerCase();
    if (cityLower.includes('mumbai')) fallbackRegion = 'Maharashtra';
    else if (cityLower.includes('bangalore') || cityLower.includes('bengaluru')) fallbackRegion = 'Karnataka';
    else if (cityLower.includes('chennai')) fallbackRegion = 'Tamil Nadu';
    else if (cityLower.includes('gurgaon') || cityLower.includes('gurugram') || cityLower.includes('noida')) fallbackRegion = 'Delhi NCR';
    else fallbackRegion = 'All India';

    this.showLawyerLocationFallback = true;
    this.lawyerLocationFallbackMsg = `No advocates found in ${this.selectedCity}. Showing advocates in ${fallbackRegion} fallback.`;

    const coords = this.locationService.getCoordinates();
    this.legalService.searchHub(query, fallbackRegion, 10, coords?.lat, coords?.lng)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const lawyers = res.data?.lawyers || [];
          this.results.lawyers = lawyers;
          this.cdr.markForCheck();
        }
      });
  }

  // --- DOM Node Recycling trackBy Helpers (Optimization #3) ---
  trackBySection(index: number, item: any): string {
    return item._id || item.section_number;
  }

  trackByLawyer(index: number, item: any): string {
    return item._id;
  }

  trackByResource(index: number, item: any): string {
    return item._id;
  }

  trackByTemplate(index: number, item: any): string {
    return item.id;
  }

  trackByFAQ(_index: number, item: { title: string }): string {
    return item.title;
  }

  trackByRoadmapStep(_index: number, step: any): string {
    return step.title ?? String(_index);
  }

  trackBySkeleton(_index: number, item: number): number {
    return item;
  }

  onQueryChange(query: string) {
    this.searchQuery = query;
    this.cdr.markForCheck();
  }

  removeSearchHistoryItem(query: string) {
    this.searchHistory = this.searchHistory.filter(h => h !== query);
    localStorage.setItem('lc_search_history', JSON.stringify(this.searchHistory));
    this.cdr.markForCheck();
  }

  checkScrollAffordance() {
    const container = document.querySelector('#tabContainer') as HTMLElement;
    if (container) {
      this.canScrollLeft = container.scrollLeft > 0;
      this.canScrollRight = container.scrollLeft < (container.scrollWidth - container.clientWidth - 1);
      this.cdr.markForCheck();
    }
  }

  scrollToActiveTab(smooth = false) {
    const container = document.querySelector('#tabContainer') as HTMLElement;
    const activeEl = document.querySelector('.active-tab-btn') as HTMLElement;
    if (container && activeEl) {
      container.scrollTo({
        left: activeEl.offsetLeft - (container.clientWidth / 2) + (activeEl.clientWidth / 2),
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  }

  // Smart Filter State Getters
  readonly FILTER_THRESHOLD = 15;

  get showLawFilters(): boolean {
    return this.results.laws.length >= this.FILTER_THRESHOLD
      && (this.activeTab === 'laws' || this.activeTab === 'all');
  }

  get hasActiveFilters(): boolean {
    return this.filterBailable !== 'all' || this.filterCognizable !== 'all';
  }

  get filteredLaws(): any[] {
    let laws = this.results.laws;
    if (this.filterBailable !== 'all') {
      const wantBailable = this.filterBailable === 'bailable';
      laws = laws.filter(l => l.criminalDetails?.isBailable === wantBailable);
    }
    if (this.filterCognizable !== 'all') {
      const wantCognizable = this.filterCognizable === 'cognizable';
      laws = laws.filter(l => l.criminalDetails?.isCognizable === wantCognizable);
    }
    return laws;
  }

  clearFilters() {
    this.filterBailable = 'all';
    this.filterCognizable = 'all';
    this.cdr.markForCheck();
  }

  onCitedQueryClick(queryText: string) {
    if (queryText.startsWith('expert:')) {
      this.searchQuery = queryText;
      this.activeTab = 'lawyers';
      this.performSearch();
    } else {
      this.searchQuery = queryText;
      this.performSearch();
    }
  }
}