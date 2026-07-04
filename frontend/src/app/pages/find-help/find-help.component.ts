import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone
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

// Dialog / Helper Components
import { SosDrawerComponent } from './components/sos-drawer/sos-drawer.component';
import { LocationMapModalComponent } from '../../components/location-map-modal/location-map-modal.component';
import { SuggestResourceModalComponent } from './components/suggest-resource-modal/suggest-resource-modal.component';

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

declare var google: any;

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
    JargonTooltipDirective,
    SuggestResourceModalComponent,
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
  filteredSuggestions: Array<{ category: string, subcategory?: string, displayName: string, isHeader?: boolean }> = [];
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
    private authService: AuthService
  ) {
    // Set debouncer for quick category suggestions autocomplete
    this.searchInput$.pipe(
      debounceTime(200),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this._executeSearchInput();
    });
  }

  @HostListener('window:resize', [])
  onResize() {
    this.checkMobile();
  }

  @HostListener('window:keydown.escape', ['$event'])
  onEscapeKey(event: KeyboardEvent) {
    this.quickExit();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-container-wrapper')) {
      this.filteredSuggestions = [];
      this.cdr.markForCheck();
    }
  }

  private checkMobile() {
    const mobile = window.innerWidth < 768;
    if (this.isMobile !== mobile) {
      this.isMobile = mobile;
      this.cdr.markForCheck();
    }
  }

  openSuggestionModal() {
    this.isSuggestModalOpen = true;
    this.cdr.markForCheck();
  }

  closeSuggestionModal() {
    this.isSuggestModalOpen = false;
    this.cdr.markForCheck();
  }

  onSuggestionSubmitted(resource: any) {
    console.log('User suggested new resource:', resource);
  }

  ngOnInit() {
    this.checkMobile();
    this.loadRecentSearches();
    this.initVoiceSearch();
    this.loadTrustStats();

    // Restore search keywords on page refreshes
    const savedNormal = sessionStorage.getItem('lc_search_normal');
    const savedSituation = sessionStorage.getItem('lc_search_situation');
    const savedAiMode = sessionStorage.getItem('lc_search_aimode');
    if (savedNormal) this.normalSearchQuery = savedNormal;
    if (savedSituation) this.situationQuery = savedSituation;
    if (savedAiMode) this.isAiMode = savedAiMode === 'true';

    // Watch global location selections
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

    // Watch route inputs
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

    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngAfterViewInit() {
    if (!this.isResultsMode) {
      this.initMainLocationAutocomplete();
    }
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroy$.next();
    this.destroy$.complete();
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.locationSub) this.locationSub.unsubscribe();
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) { }
    }
    window.removeEventListener('scroll', this.onScroll);
  }

  loadCategories() {
    this.legalService.getHelpCategories(this.locationService.cleanAddress(this.locationQuery)).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.categories = res.data || [];
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('Failed to load help categories dynamically', err);
      }
    });
  }

  animateCountUp(targetKey: 'legalClinics' | 'distCourts' | 'verifiedLawyers', targetValue: number) {
    const duration = 1200;
    const startTime = performance.now();
    const startValue = 0;

    const step = (currentTime: number) => {
      if (this.isDestroyed) return;
      const elapsedTime = currentTime - startTime;
      if (elapsedTime >= duration) {
        this.animatedStats = {
          ...this.animatedStats,
          [targetKey]: targetValue
        };
        this.cdr.markForCheck();
      } else {
        const progress = elapsedTime / duration;
        const easeProgress = progress * (2 - progress); // easeOutQuad
        this.animatedStats = {
          ...this.animatedStats,
          [targetKey]: Math.floor(startValue + easeProgress * (targetValue - startValue))
        };
        this.cdr.markForCheck();
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }

  loadTrustStats() {
    this.isStatsLoading = true;
    this.legalService.getHelpStats().subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          this.stats = res.data;
          this.animateCountUp('legalClinics', this.stats.legalClinics);
          this.animateCountUp('distCourts', this.stats.distCourts);
          this.animateCountUp('verifiedLawyers', this.stats.verifiedLawyers);
        } else {
          this.animateCountUp('legalClinics', 25000);
          this.animateCountUp('distCourts', 1200);
          this.animateCountUp('verifiedLawyers', 8500);
        }
        this.isStatsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load trust statistics dynamically', err);
        this.animateCountUp('legalClinics', 25000);
        this.animateCountUp('distCourts', 1200);
        this.animateCountUp('verifiedLawyers', 8500);
        this.isStatsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  initMainLocationAutocomplete() {
    // Deprecated in favor of the clean modular search bar locations confirmation, no-op
  }

  triggerSearch() {
    const query = this.locationQuery.trim();
    if (!query) {
      this.locationQuery = 'New Delhi';
      this.executeSearch();
      return;
    }

    if (query.includes(',')) {
      this.executeSearch();
      return;
    }

    if ((window as any).google?.maps?.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: query, componentRestrictions: { country: 'IN' } }, (results: any[], status: string) => {
        this.zone.run(() => {
          if (status === 'OK' && results[0]) {
            this.locationQuery = results[0].formatted_address;
            this.locationService.setLocation(this.locationQuery, false);
          }
          this.executeSearch();
        });
      });
    } else {
      this.locationService.setLocation(this.locationQuery, false);
      this.executeSearch();
    }
  }

  private executeSearch() {
    this.isResultsMode = true;

    // Save search inputs
    const queryVal = this.isAiMode ? this.situationQuery : this.normalSearchQuery;
    this.addRecentSearch(queryVal, this.activeCategory, this.locationQuery, this.isAiMode);

    this.cdr.markForCheck();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: this.activeCategory,
        location: this.locationQuery
      },
      queryParamsHandling: 'merge'
    });
  }

  clickTrySuggestion(query: string) {
    this.isAiMode = true;
    this.situationQuery = query;
    this.normalSearchQuery = '';
    this.handleAiSearchInput();
    this.cdr.markForCheck();

    setTimeout(() => {
      const searchEl = document.querySelector('.search-container-wrapper');
      if (searchEl) {
        searchEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  }

  goBackToCategories() {
    this.clearSearchQuery();
    this.saveSearchState();
    this.isResultsMode = false;
    this.transitionComplete = false;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: null,
        location: null,
        radius: null,
        types: null,
        openNow: null,
        langs: null,
        verified: null
      }
    });
  }

  detectLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.zone.run(() => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            if ((window as any).google?.maps?.Geocoder) {
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
                this.zone.run(() => {
                  if (status === 'OK' && results[0]) {
                    this.locationQuery = results[0].formatted_address;
                  } else {
                    this.locationQuery = 'New Delhi';
                  }
                  this.locationService.setLocation(this.locationQuery, false);
                  this.triggerSearch();
                  this.cdr.markForCheck();
                });
              });
            } else {
              this.locationQuery = 'New Delhi';
              this.locationService.setLocation(this.locationQuery, false);
              this.triggerSearch();
              this.cdr.markForCheck();
            }
          });
        },
        (err) => {
          console.warn('Geolocation failed, falling back to manual entry', err);
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  }

  openMapModal() {
    this.showMapModal = true;
    this.cdr.markForCheck();
  }

  closeMapModal() {
    this.showMapModal = false;
    this.cdr.markForCheck();
  }

  onMapLocationConfirmed(address: string) {
    this.showMapModal = false;
    this.locationService.setLocation(address, false);
    this.cdr.markForCheck();
  }

  toggleSearchMode() {
    this.isAiMode = !this.isAiMode;
    this.cdr.markForCheck();
  }

  handleNormalSearchInput() {
    this.isSearchingSuggestions = true;
    this.searchInput$.next();
  }

  private _executeSearchInput() {
    const query = this.normalSearchQuery.trim().toLowerCase();
    if (!query) {
      this.filteredSuggestions = [];
      this.isSearchingSuggestions = false;
      this.cdr.markForCheck();
      return;
    }

    const groupedMatches: { [category: string]: string[] } = {};

    this.categories.forEach(cat => {
      const catNameLower = cat.name.toLowerCase();
      const isStrongCatMatch = catNameLower.startsWith(query) && query.length >= 3;

      const matchedSubs: string[] = [];
      cat.subcategories.forEach(sub => {
        const subLower = sub.toLowerCase();
        if (subLower.includes(query) || isStrongCatMatch) {
          matchedSubs.push(sub);
        }
      });

      if (matchedSubs.length > 0) {
        groupedMatches[cat.name] = matchedSubs;
      }
    });

    const suggestions: Array<{ category: string, subcategory?: string, displayName: string, isHeader?: boolean }> = [];
    const catNames = Object.keys(groupedMatches).slice(0, 3);

    catNames.forEach(catName => {
      suggestions.push({
        category: catName,
        isHeader: true,
        displayName: catName
      });

      const subs = groupedMatches[catName].slice(0, 3);
      subs.forEach(sub => {
        suggestions.push({
          category: catName,
          subcategory: sub,
          displayName: sub
        });
      });
    });

    this.filteredSuggestions = suggestions;
    this.isSearchingSuggestions = false;
    this.cdr.markForCheck();
  }

  selectSuggestion(suggestion: { category: string, subcategory?: string, displayName: string, isHeader?: boolean }) {
    if (suggestion.isHeader) return;

    this.activeCategory = suggestion.category;
    if (suggestion.subcategory) {
      this.selectedSubcategories = [suggestion.subcategory];
      this.normalSearchQuery = `${suggestion.subcategory} in ${suggestion.category}`;
    } else {
      this.selectedSubcategories = [];
      this.normalSearchQuery = suggestion.category;
    }
    this.filteredSuggestions = [];

    this.triggerSearch();
    this.cdr.markForCheck();
  }

  toggleAiMode(isAi: boolean) {
    this.isAiMode = isAi;
    if (isAi) {
      this.normalSearchQuery = '';
    } else {
      this.situationQuery = '';
    }
    this.saveSearchState();
    this.cdr.markForCheck();
  }

  clearSearchQuery() {
    this.normalSearchQuery = '';
    this.situationQuery = '';
    this.filteredSuggestions = [];
    this.cdr.markForCheck();
  }

  saveSearchState() {
    sessionStorage.setItem('lc_search_normal', this.normalSearchQuery);
    sessionStorage.setItem('lc_search_situation', this.situationQuery);
    sessionStorage.setItem('lc_search_aimode', String(this.isAiMode));
  }

  triggerNormalSearch() {
    const query = this.normalSearchQuery.trim().toLowerCase();
    if (!query) return;

    let bestMatch: { category: string, subcategory?: string } | null = null;

    for (const cat of this.categories) {
      if (cat.name.toLowerCase() === query) {
        bestMatch = { category: cat.name };
        break;
      }
      for (const sub of cat.subcategories) {
        if (sub.toLowerCase() === query) {
          bestMatch = { category: cat.name, subcategory: sub };
          break;
        }
      }
      if (bestMatch) break;
    }

    if (!bestMatch) {
      for (const cat of this.categories) {
        if (cat.name.toLowerCase().includes(query)) {
          bestMatch = { category: cat.name };
          break;
        }
        for (const sub of cat.subcategories) {
          if (sub.toLowerCase().includes(query)) {
            bestMatch = { category: cat.name, subcategory: sub };
            break;
          }
        }
        if (bestMatch) break;
      }
    }

    if (bestMatch) {
      this.activeCategory = bestMatch.category;
      if (bestMatch.subcategory) {
        this.selectedSubcategories = [bestMatch.subcategory];
      } else {
        this.selectedSubcategories = [];
      }
      this.filteredSuggestions = [];
      this.triggerSearch();
    } else {
      this.triggerSearch();
    }
    this.cdr.markForCheck();
  }

  selectCategory(catName: string) {
    this.activeCategory = catName;
    this.selectedSubcategories = [];
  }

  toggleSubcategory(subName: string) {
    const idx = this.selectedSubcategories.indexOf(subName);
    if (idx > -1) {
      this.selectedSubcategories.splice(idx, 1);
    } else {
      this.selectedSubcategories.push(subName);
    }
    this.triggerSearch();
  }

  handleAiSearchInput() {
    if (!this.situationQuery.trim() || this.isAiSolving) return;

    this.isAiSolving = true;
    this.aiSummary = '';
    this.aiRoadmapSteps = [];
    this.cdr.markForCheck();

    this.legalService.solveAiScenario(this.situationQuery.trim()).subscribe({
      next: (res) => {
        this.zone.run(() => {
          this.isAiSolving = false;
          if (res && res.success) {
            this.activeCategory = res.category || this.activeCategory;
            this.selectedSubcategories = res.subcategories || [];
            this.aiSummary = res.caseSummary || '';
            this.aiRoadmapSteps = res.roadmapSteps || [];
            this.triggerSearch();
          }
          this.cdr.markForCheck();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          console.error('AI solve failed, falling back to keyword match:', err);
          this.isAiSolving = false;
          const query = this.situationQuery.toLowerCase();
          for (const mapping of AI_KEYWORD_CATEGORY_MAP) {
            if (mapping.keywords.some(kw => query.includes(kw))) {
              this.activeCategory = mapping.category;
              break;
            }
          }
          this.triggerSearch();
          this.cdr.markForCheck();
        });
      }
    });
  }

  initVoiceSearch() {
    const windowObj = window as any;
    const SpeechRecognition = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.lang = this.voiceLanguage;
      this.recognition.interimResults = false;

      this.recognition.onstart = () => {
        this.zone.run(() => {
          this.isRecording = true;
          this.cdr.markForCheck();
        });
      };

      this.recognition.onresult = (event: any) => {
        this.zone.run(() => {
          const text = event.results[0][0].transcript;
          this.situationQuery = text;
          this.handleAiSearchInput();
          this.isRecording = false;

          if (this.activeCategory) {
            this.triggerSearch();
          }
          this.cdr.markForCheck();
        });
      };

      this.recognition.onerror = (event: any) => {
        this.zone.run(() => {
          console.error('Speech recognition error', event.error);
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

  toggleVoiceRecording() {
    if (!this.recognition) {
      alert('Voice speech recognition is not supported in this browser. Try Chrome or Safari.');
      return;
    }

    if (this.isRecording) {
      this.recognition.stop();
    } else {
      this.recognition.lang = this.voiceLanguage;
      this.recognition.start();
    }
  }

  setVoiceLanguage(lang: 'en-IN' | 'hi-IN') {
    this.voiceLanguage = lang;
    if (this.recognition) {
      const wasRecording = this.isRecording;
      if (wasRecording) {
        this.recognition.stop();
      }
      this.recognition.lang = lang;
      if (wasRecording) {
        setTimeout(() => {
          try {
            this.recognition.start();
          } catch (e) {
            console.error('Error restarting speech recognition with new language:', e);
          }
        }, 300);
      }
    }
    this.cdr.markForCheck();
  }

  loadRecentSearches() {
    const data = localStorage.getItem('lc_recent_searches');
    if (data) {
      try {
        this.recentSearches = JSON.parse(data);
      } catch (e) {
        this.recentSearches = [];
      }
    }
  }

  addRecentSearch(query: string, category: string, location: string, isAi: boolean) {
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

  selectRecentSearch(search: RecentSearch) {
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

  removeRecentSearch(index: number, event: MouseEvent) {
    event.stopPropagation();
    this.recentSearches.splice(index, 1);
    localStorage.setItem('lc_recent_searches', JSON.stringify(this.recentSearches));
    this.cdr.markForCheck();
  }

  clearRecentSearches() {
    this.recentSearches = [];
    localStorage.removeItem('lc_recent_searches');
    this.cdr.markForCheck();
  }

  quickExit() {
    window.location.href = 'https://www.google.com';
  }

  trackByIndex(index: number): number { return index; }
  trackByCategory(_: number, cat: Category): string { return cat.id; }
  trackBySubcategory(_: number, sub: string): string { return sub; }
  trackByRecentSearch(_: number, s: RecentSearch): number { return s.timestamp; }
}