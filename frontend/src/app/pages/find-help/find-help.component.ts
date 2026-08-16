import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  isDevMode
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

// Injected Services
import { LegalService, Category } from '../../services/legal.service';
import { LocationService } from '../../services/location.service';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';

// Dialog / Helper Components
import { SosDrawerComponent } from './components/sos-drawer/sos-drawer.component';
import { LocationMapModalComponent } from '../../components/location-map-modal/location-map-modal.component';
import { SuggestResourceModalComponent } from './components/suggest-resource-modal/suggest-resource-modal.component';
import { TriageWizardModalComponent, TriageResult } from './components/triage-wizard-modal/triage-wizard-modal.component';
import { PocketRightsModalComponent } from './components/pocket-rights-modal/pocket-rights-modal.component';

// Directives
import { JargonTooltipDirective } from '../../directives/jargon-tooltip.directive';
import { TooltipDirective } from '../../directives/tooltip.directive';

// Sub-components
import { EmergencyTickerComponent } from './components/emergency-ticker/emergency-ticker.component';
import { SearchBarComponent } from './components/search-bar/search-bar.component';
import { HeroHeaderComponent } from './components/hero-header/hero-header.component';
import { CategoryGridComponent } from './components/category-grid/category-grid.component';
import { ResultsViewComponent } from './components/results-view/results-view.component';

// Pipes
import { CategoryClassesPipe } from './pipes/category-classes.pipe';
import { CategoryDescriptionPipe } from './pipes/category-description.pipe';

// Config
import { CITY_COORDINATES, INDIAN_STATES, AI_KEYWORD_CATEGORY_MAP } from './config/category-data.config';

export interface RecentSearch {
  query: string;
  category: string;
  location: string;
  isAi: boolean;
  timestamp: number;
}

@Component({
  selector: 'app-find-help',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SosDrawerComponent,
    LocationMapModalComponent,
    SuggestResourceModalComponent,
    TriageWizardModalComponent,
    PocketRightsModalComponent,
    JargonTooltipDirective,
    TooltipDirective,
    EmergencyTickerComponent,
    SearchBarComponent,
    HeroHeaderComponent,
    CategoryGridComponent,
    ResultsViewComponent,
    CategoryClassesPipe,
    CategoryDescriptionPipe
  ],
  templateUrl: './find-help.component.html',
  styleUrls: ['./find-help.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FindHelpComponent implements OnInit, OnDestroy, AfterViewInit {
  isScrolled = false;
  isMobile = false;
  isSuggestModalOpen = false;
  isTriageModalOpen = false;
  isPocketRightsModalOpen = false;

  // Screen States
  isResultsMode = false;
  transitionComplete = false;
  activeCategory = '';
  selectedSubcategories: string[] = [];

  // Search Inputs
  locationQuery = 'New Delhi';
  isLocationEstimated = true;
  isAiMode = false;
  showMapModal = false;
  normalSearchQuery = '';
  filteredSuggestions: Array<{ category: string; subcategory?: string; displayName: string; isHeader?: boolean }> = [];
  situationQuery = '';
  isRecording = false;
  recognition: any = null;
  voiceLanguage: 'en-IN' | 'hi-IN' = 'en-IN';
  recentSearches: RecentSearch[] = [];

  // Auto-complete Debouncers
  isSearchingSuggestions = false;
  private searchInput$ = new Subject<void>();
  private destroy$ = new Subject<void>();
  private isDestroyed = false;

  // AI Solver State
  isAiSolving = false;
  aiSummary = '';
  aiRoadmapSteps: { title: string; detail: string }[] = [];

  // Trust Statistics & Categories lists
  categories: Category[] = [];
  stats = { legalClinics: 25000, distCourts: 1200, verifiedLawyers: 8500 };
  isStatsLoading = false;
  animatedStats = { legalClinics: 0, distCourts: 0, verifiedLawyers: 0 };

  // Emergency Toggles
  showSosDrawer = false;

  // Subscriptions
  private locationSub!: Subscription;
  private routeSub!: Subscription;

  private onScroll = () => {
    const scrolled = window.scrollY > 20;
    if (scrolled !== this.isScrolled) {
      this.zone.run(() => {
        this.isScrolled = scrolled;
        this.cdr.markForCheck();
      });
    }
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private legalService: LegalService,
    private locationService: LocationService,
    private authService: AuthService,
    private snackbarService: SnackbarService
  ) {
    this.searchInput$.pipe(
      debounceTime(200),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this._executeSearchInput();
    });
  }

  @HostListener('window:resize', [])
  onResize(): void {
    this.checkMobile();
  }

  @HostListener('window:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent): void {
    this.quickExit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-container-wrapper')) {
      this.filteredSuggestions = [];
      this.cdr.markForCheck();
    }
  }

  private checkMobile(): void {
    const mobile = window.innerWidth < 768;
    if (this.isMobile !== mobile) {
      this.isMobile = mobile;
      this.cdr.markForCheck();
    }
  }

  openTriageModal(): void {
    this.isTriageModalOpen = true;
    this.cdr.markForCheck();
  }

  closeTriageModal(): void {
    this.isTriageModalOpen = false;
    this.cdr.markForCheck();
  }

  onTriageCompleted(result: TriageResult): void {
    this.activeCategory = result.category;
    this.isAiMode = false;
    this.normalSearchQuery = result.summary;
    this.snackbarService.show(`Triage Applied: ${result.category}`, 'success');
    this.triggerSearch();
  }

  openPocketRightsModal(): void {
    this.isPocketRightsModalOpen = true;
    this.cdr.markForCheck();
  }

  closePocketRightsModal(): void {
    this.isPocketRightsModalOpen = false;
    this.cdr.markForCheck();
  }

  openSuggestionModal(): void {
    this.isSuggestModalOpen = true;
    this.cdr.markForCheck();
  }

  closeSuggestionModal(): void {
    this.isSuggestModalOpen = false;
    this.cdr.markForCheck();
  }

  onSuggestionSubmitted(resource: any): void {
    if (isDevMode()) console.log('User suggested new resource:', resource);
  }

  ngOnInit(): void {
    this.checkMobile();
    this.loadRecentSearches();
    this.initVoiceSearch();
    this.loadTrustStats();

    const savedNormal = sessionStorage.getItem('lc_search_normal');
    const savedSituation = sessionStorage.getItem('lc_search_situation');
    const savedAiMode = sessionStorage.getItem('lc_search_aimode');
    if (savedNormal) this.normalSearchQuery = savedNormal;
    if (savedSituation) this.situationQuery = savedSituation;
    if (savedAiMode) this.isAiMode = savedAiMode === 'true';

    this.locationSub = this.locationService.activeLocation$.subscribe(loc => {
      if (loc && loc !== this.locationQuery) {
        this.locationQuery = loc;
        if (this.isResultsMode) {
          this.triggerSearch();
        } else {
          this.loadCategories();
        }
        this.cdr.markForCheck();
      }
    });
    this.locationSub.add(
      this.locationService.isEstimated$.subscribe(est => {
        this.isLocationEstimated = est;
        this.cdr.markForCheck();
      })
    );

    this.routeSub = this.route.queryParams.subscribe(params => {
      const cat = params['category'];
      const loc = params['location'];

      if (cat && loc) {
        this.activeCategory = cat;
        this.locationQuery = loc;
        this.isResultsMode = true;
        this.loadCategories();
        window.scrollTo({ top: 0, behavior: 'instant' });

        setTimeout(() => {
          this.transitionComplete = true;
          this.cdr.markForCheck();
        }, 600);
      } else {
        this.isResultsMode = false;
        this.transitionComplete = false;
        this.loadCategories();
      }
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  private counterTimer: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.destroy$.next();
    this.destroy$.complete();
    if (this.counterTimer) {
      clearInterval(this.counterTimer);
      this.counterTimer = null;
    }
    if (this.locationSub) this.locationSub.unsubscribe();
    if (this.routeSub) this.routeSub.unsubscribe();
    window.removeEventListener('scroll', this.onScroll);
    this.stopVoiceRecording();
  }

  private loadTrustStats(): void {
    this.isStatsLoading = true;
    this.legalService.getHelpStats().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res?.data) {
          this.stats = res.data;
        }
        this.isStatsLoading = false;
        this.animateCounters();
        this.cdr.markForCheck();
      },
      error: () => {
        this.isStatsLoading = false;
        this.animateCounters();
        this.cdr.markForCheck();
      }
    });
  }

  private animateCounters(): void {
    if (this.counterTimer) {
      clearInterval(this.counterTimer);
      this.counterTimer = null;
    }

    const duration = 1500;
    const steps = 30;
    const stepTime = duration / steps;
    let step = 0;

    this.counterTimer = setInterval(() => {
      if (this.isDestroyed) {
        if (this.counterTimer) clearInterval(this.counterTimer);
        return;
      }
      step++;
      const progress = step / steps;
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      this.animatedStats = {
        legalClinics: Math.round(this.stats.legalClinics * easeProgress),
        distCourts: Math.round(this.stats.distCourts * easeProgress),
        verifiedLawyers: Math.round(this.stats.verifiedLawyers * easeProgress)
      };
      this.cdr.markForCheck();

      if (step >= steps) {
        if (this.counterTimer) {
          clearInterval(this.counterTimer);
          this.counterTimer = null;
        }
        this.animatedStats = { ...this.stats };
        this.cdr.markForCheck();
      }
    }, stepTime);
  }

  loadCategories(): void {
    this.legalService.getHelpCategories(this.locationQuery).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.categories = res?.data || [];
        this.cdr.markForCheck();
      },
      error: () => {
        this.categories = [];
        this.cdr.markForCheck();
      }
    });
  }

  selectCategory(catId: string): void {
    this.activeCategory = catId;
    this.selectedSubcategories = [];
    this.cdr.markForCheck();
  }

  toggleSubcategory(sub: string): void {
    const idx = this.selectedSubcategories.indexOf(sub);
    if (idx > -1) {
      this.selectedSubcategories.splice(idx, 1);
    } else {
      this.selectedSubcategories.push(sub);
    }
    if (this.isResultsMode) {
      this.triggerSearch();
    }
    this.cdr.markForCheck();
  }

  triggerSearch(): void {
    if (!this.activeCategory && !this.normalSearchQuery && !this.situationQuery) {
      this.activeCategory = 'Property Dispute';
    }

    const query = this.isAiMode ? this.situationQuery : this.normalSearchQuery;
    if (query || this.activeCategory) {
      this.addRecentSearch(query, this.activeCategory, this.locationQuery, this.isAiMode);
    }

    this.saveSearchState();

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: this.activeCategory || 'Property Dispute',
        location: this.locationQuery
      },
      queryParamsHandling: 'merge'
    });
  }

  triggerNormalSearch(): void {
    const query = this.normalSearchQuery.trim().toLowerCase();
    if (!query) return;

    let bestMatch: { category: string; subcategory?: string } | null = null;

    // 1. Exact match against category names and subcategories
    for (const cat of this.categories) {
      if (cat.name.toLowerCase() === query || cat.id.toLowerCase() === query) {
        bestMatch = { category: cat.id || cat.name };
        break;
      }
      if (cat.subcategories) {
        for (const sub of cat.subcategories) {
          if (sub.toLowerCase() === query) {
            bestMatch = { category: cat.id || cat.name, subcategory: sub };
            break;
          }
        }
      }
      if (bestMatch) break;
    }

    // 2. Partial substring match against category and subcategory names
    if (!bestMatch) {
      for (const cat of this.categories) {
        if (cat.name.toLowerCase().includes(query) || cat.id.toLowerCase().includes(query)) {
          bestMatch = { category: cat.id || cat.name };
          break;
        }
        if (cat.subcategories) {
          for (const sub of cat.subcategories) {
            if (sub.toLowerCase().includes(query)) {
              bestMatch = { category: cat.id || cat.name, subcategory: sub };
              break;
            }
          }
        }
        if (bestMatch) break;
      }
    }

    // 3. Fallback to AI legal keyword mapping
    if (!bestMatch) {
      const detected = this.detectCategoryFromQuery(this.normalSearchQuery);
      if (detected) {
        bestMatch = { category: detected };
      }
    }

    if (bestMatch) {
      this.activeCategory = bestMatch.category;
      if (bestMatch.subcategory) {
        this.selectedSubcategories = [bestMatch.subcategory];
      } else {
        this.selectedSubcategories = [];
      }
    } else if (!this.activeCategory) {
      this.activeCategory = 'Other / Not Sure';
    }

    this.filteredSuggestions = [];
    this.triggerSearch();
    this.cdr.markForCheck();
  }

  private detectCategoryFromQuery(q: string): string | null {
    const lower = q.toLowerCase();
    for (const item of AI_KEYWORD_CATEGORY_MAP) {
      for (const kw of item.keywords) {
        if (lower.includes(kw)) {
          return item.category;
        }
      }
    }
    return null;
  }

  handleNormalSearchInput(): void {
    this.filteredSuggestions = [];
    this.searchInput$.next();
  }

  private _executeSearchInput(): void {
    const q = this.normalSearchQuery.trim().toLowerCase();
    if (!q || q.length < 2) {
      this.filteredSuggestions = [];
      this.isSearchingSuggestions = false;
      this.cdr.markForCheck();
      return;
    }

    this.isSearchingSuggestions = true;
    this.cdr.markForCheck();

    const results: Array<{ category: string; subcategory?: string; displayName: string; isHeader?: boolean }> = [];

    for (const cat of this.categories) {
      if (cat.name.toLowerCase().includes(q)) {
        results.push({
          category: cat.id,
          displayName: cat.name
        });
      }
      if (cat.subcategories) {
        for (const sub of cat.subcategories) {
          if (sub.toLowerCase().includes(q)) {
            results.push({
              category: cat.id,
              subcategory: sub,
              displayName: `${sub} (${cat.name})`
            });
          }
        }
      }
    }

    this.filteredSuggestions = results.slice(0, 6);
    this.isSearchingSuggestions = false;
    this.cdr.markForCheck();
  }

  selectSuggestion(suggestion: { category: string; subcategory?: string; displayName: string }): void {
    this.activeCategory = suggestion.category;
    if (suggestion.subcategory) {
      this.selectedSubcategories = [suggestion.subcategory];
    }
    this.normalSearchQuery = suggestion.displayName;
    this.filteredSuggestions = [];
    this.saveSearchState();
    this.triggerSearch();
  }

  clearSearchQuery(): void {
    this.normalSearchQuery = '';
    this.situationQuery = '';
    this.filteredSuggestions = [];
    this.saveSearchState();
    this.cdr.markForCheck();
  }

  toggleAiMode(enabled: boolean): void {
    this.isAiMode = enabled;
    this.saveSearchState();
    this.cdr.markForCheck();
  }

  toggleSearchMode(): void {
    this.isAiMode = !this.isAiMode;
    this.saveSearchState();
    this.cdr.markForCheck();
  }

  saveSearchState(): void {
    sessionStorage.setItem('lc_search_normal', this.normalSearchQuery || '');
    sessionStorage.setItem('lc_search_situation', this.situationQuery || '');
    sessionStorage.setItem('lc_search_aimode', String(this.isAiMode));
  }

  handleAiSearchInput(): void {
    const text = this.situationQuery.trim();
    if (!text || text.length < 5) return;

    this.isAiSolving = true;
    this.cdr.markForCheck();

    this.legalService.solveAiScenario(text).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.isAiSolving = false;
        if (res.category) {
          this.activeCategory = res.category;
        }
        if (res.caseSummary) {
          this.aiSummary = res.caseSummary;
        }
        if (res.roadmapSteps) {
          this.aiRoadmapSteps = res.roadmapSteps;
        }
        this.triggerSearch();
        this.cdr.markForCheck();
      },
      error: () => {
        this.isAiSolving = false;
        const detected = this.detectCategoryFromQuery(text) || 'Other / Not Sure';
        this.activeCategory = detected;
        this.aiSummary = `Initial diagnostic for "${text.slice(0, 60)}...". Proceeding with relevant procedures and legal resources.`;
        this.triggerSearch();
        this.cdr.markForCheck();
      }
    });
  }

  clickTrySuggestion(prompt: string): void {
    this.isAiMode = true;
    this.situationQuery = prompt;
    this.saveSearchState();
    this.handleAiSearchInput();
  }

  goBackToCategories(): void {
    this.isResultsMode = false;
    this.transitionComplete = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category: null },
      queryParamsHandling: 'merge'
    });
    this.cdr.markForCheck();
  }

  openMapModal(): void {
    this.showMapModal = true;
    this.cdr.markForCheck();
  }

  closeMapModal(): void {
    this.showMapModal = false;
    this.cdr.markForCheck();
  }

  onMapLocationConfirmed(location: { address: string; lat: number; lng: number }): void {
    this.locationService.setLocation(location.address, false, { lat: location.lat, lng: location.lng });
    this.closeMapModal();
  }

  initVoiceSearch(): void {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = this.voiceLanguage;

      this.recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        this.zone.run(() => {
          if (this.isAiMode) {
            this.situationQuery = transcript;
            this.saveSearchState();
            this.handleAiSearchInput();
          } else {
            this.normalSearchQuery = transcript;
            this.saveSearchState();
            this.triggerNormalSearch();
          }
          this.isRecording = false;
          this.cdr.markForCheck();
        });
      };

      this.recognition.onerror = () => {
        this.zone.run(() => {
          this.isRecording = false;
          this.cdr.markForCheck();
        });
      };

      this.recognition.onend = () => {
        this.zone.run(() => {
          this.isRecording = false;
          this.cdr.markForCheck();
        });
      };
    }
  }

  toggleVoiceRecording(): void {
    if (!this.recognition) {
      this.snackbarService.show('Voice input is not supported in this browser.', 'error');
      return;
    }
    if (this.isRecording) {
      this.stopVoiceRecording();
    } else {
      this.startVoiceRecording();
    }
  }

  startVoiceRecording(): void {
    try {
      this.recognition.lang = this.voiceLanguage;
      this.recognition.start();
      this.isRecording = true;
      this.cdr.markForCheck();
    } catch {
      this.isRecording = false;
    }
  }

  stopVoiceRecording(): void {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
      this.isRecording = false;
      this.cdr.markForCheck();
    }
  }

  setVoiceLanguage(lang: 'en-IN' | 'hi-IN'): void {
    if (this.voiceLanguage === lang) return;
    this.voiceLanguage = lang;

    if (this.recognition) {
      const wasRecording = this.isRecording;

      if (wasRecording) {
        try {
          this.recognition.stop();
        } catch {
          // Ignored if already stopping
        }
      }

      this.recognition.lang = lang;

      if (wasRecording) {
        setTimeout(() => {
          if (!this.isDestroyed && this.recognition) {
            try {
              this.recognition.start();
              this.isRecording = true;
            } catch {
              this.isRecording = false;
            }
            this.cdr.markForCheck();
          }
        }, 250);
      }
    }

    this.snackbarService.show(
      lang === 'hi-IN' ? 'आवाज़ खोज हिंदी में सेट की गई' : 'Voice search set to English (India)',
      'info'
    );
    this.cdr.markForCheck();
  }

  loadRecentSearches(): void {
    const data = localStorage.getItem('lc_recent_searches');
    if (data) {
      try {
        this.recentSearches = JSON.parse(data);
      } catch {
        this.recentSearches = [];
      }
    }
  }

  addRecentSearch(query: string, category: string, location: string, isAi: boolean): void {
    const trimmed = (query || '').trim();
    const displayName = trimmed || category;

    let list = this.recentSearches.filter(
      s => !(s.query.toLowerCase() === displayName.toLowerCase() && s.category === category)
    );

    list.unshift({
      query: displayName,
      category,
      location,
      isAi,
      timestamp: Date.now()
    });

    this.recentSearches = list.slice(0, 5);
    localStorage.setItem('lc_recent_searches', JSON.stringify(this.recentSearches));
    this.cdr.markForCheck();
  }

  selectRecentSearch(search: RecentSearch): void {
    this.locationQuery = search.location;
    this.activeCategory = search.category;
    this.isAiMode = search.isAi;
    if (search.isAi) {
      this.situationQuery = search.query;
      this.normalSearchQuery = '';
    } else {
      this.normalSearchQuery = search.query;
      this.situationQuery = '';
    }
    this.triggerSearch();
  }

  removeRecentSearch(index: number, event: MouseEvent): void {
    event.stopPropagation();
    this.recentSearches.splice(index, 1);
    localStorage.setItem('lc_recent_searches', JSON.stringify(this.recentSearches));
    this.cdr.markForCheck();
  }

  clearRecentSearches(): void {
    this.recentSearches = [];
    localStorage.removeItem('lc_recent_searches');
    this.cdr.markForCheck();
  }

  quickExit(): void {
    try {
      sessionStorage.clear();
      localStorage.removeItem('lc_recent_searches');
      localStorage.removeItem('lc_saved_case_packs');
    } catch {
      // Storage error
    }
    window.location.replace('https://www.google.com/search?q=weather+today');
  }

  trackByIndex(index: number): number { return index; }
  trackByCategory(_: number, cat: Category): string { return cat.id; }
  trackBySubcategory(_: number, sub: string): string { return sub; }
  trackByRecentSearch(_: number, s: RecentSearch): number { return s.timestamp; }
}