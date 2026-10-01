import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  HostListener,
  DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationStart, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, tap, map, catchError } from 'rxjs/operators';

import { GlobalSearchService, PaletteMetadata, SearchPreviewResults, SearchSuggestion, TrendingTopic } from '../../services/global-search.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { KeyboardShortcutsService } from '../../services/keyboard-shortcuts.service';
import { SnackbarService } from '../../services/snackbar.service';
import { SpeechService } from '../../services/speech.service';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../icon/icon.component';

export type SearchScope = 'all' | 'laws' | 'lawyers' | 'resources' | 'faqs';

export interface ScopeTab {
  id: SearchScope;
  label: string;
  icon: string;
}

interface NavigableItem {
  id: string;
  type: 'recent' | 'suggestion' | 'law' | 'lawyer' | 'resource' | 'faq' | 'trending' | 'popular' | 'quick-access' | 'advanced';
  title: string;
  subtitle?: string;
  action: () => void;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    FocusTrapDirective,
    TooltipDirective,
    IconComponent
  ],
  templateUrl: './command-palette.component.html',
  styleUrls: ['./command-palette.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommandPaletteComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('resultsScrollContainer') resultsContainerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('scopesNav') scopesNavRef?: ElementRef<HTMLElement>;

  private searchService = inject(GlobalSearchService);
  public auth = inject(AuthService);
  public themeService = inject(ThemeService);
  private shortcutsService = inject(KeyboardShortcutsService);
  private snackbar = inject(SnackbarService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  public speechService = inject(SpeechService);

  // Modal State
  isOpen = false;
  query = '';
  activeScope: SearchScope = 'all';
  isTrendingExpanded = false;
  isVoiceListening = false;
  screenReaderAnnouncement = '';

  // Loading States
  isLoadingMeta = false;
  isLoadingResults = false;
  isLoadingSuggestions = false;
  private isUserTyped = false;

  // Metadata & Content (Pre-hydrated with instant static fallback to avoid skeleton flicker)
  paletteMeta: PaletteMetadata = this.searchService.getFallbackMetadata();
  recentSearches: string[] = [];
  suggestions: SearchSuggestion[] = [];
  previewResults: SearchPreviewResults = {
    laws: [],
    lawyers: [],
    resources: [],
    faqs: []
  };

  // Keyboard Navigation
  selectedIndex = -1;
  private navigableItems: NavigableItem[] = [];

  // Scopes Filter Tabs
  readonly scopes: ScopeTab[] = [
    { id: 'all', label: 'All', icon: 'layers' },
    { id: 'laws', label: 'Bare Acts & Laws', icon: 'book-open' },
    { id: 'lawyers', label: 'Advocates', icon: 'users' },
    { id: 'resources', label: 'Legal Aid & Courts', icon: 'landmark' },
    { id: 'faqs', label: 'Platform FAQs', icon: 'help-circle' }
  ];

  get searchPlaceholder(): string {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return 'Search laws, advocates, FAQs...';
    }
    return 'Search laws, sections, advocates, court resources, or ask a question...';
  }

  get activeItemId(): string | null {
    if (this.selectedIndex >= 0 && this.selectedIndex < this.navigableItems.length) {
      return this.navigableItems[this.selectedIndex].id;
    }
    return null;
  }

  // Debounced Query Stream
  private queryDebounce$ = new Subject<string>();

  ngOnInit(): void {
    // 1. Subscribe to palette open/close state
    this.searchService.isOpen$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(open => {
        if (open) {
          this.handleOpen();
        } else {
          this.handleClose();
        }
      });

    // 2. Subscribe to initial query triggers
    this.searchService.initialQuery$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(q => {
        if (q && this.isOpen) {
          this.query = q;
          this.onQueryInput(q);
        }
      });

    // 3. Subscribe to universal recent searches (synced with auth & guests)
    this.searchService.recentSearches$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(recents => {
        this.recentSearches = recents;
        this.rebuildNavigableItems();
        this.cdr.markForCheck();
      });

    // 4. Voice Search Integration
    this.speechService.isListening$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(listening => {
        this.isVoiceListening = listening;
        this.cdr.markForCheck();
      });

    this.speechService.voiceResult$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(transcript => {
        if (transcript && this.isOpen) {
          this.query = transcript;
          this.onQueryInput(transcript);
          this.cdr.markForCheck();
        }
      });

    // 5. Auto-close palette on route navigation
    this.router.events
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(event => {
        if (event instanceof NavigationStart && this.isOpen) {
          this.close();
        }
      });

    // 6. Setup debounced live search stream with parallelized HTTP requests
    this.setupQueryPipeline();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  private handleOpen(): void {
    this.isOpen = true;
    this.selectedIndex = -1;
    this.activeScope = 'all';
    this.screenReaderAnnouncement = 'Legal search command center opened. Type to search or press Tab to cycle scopes.';
    this.cdr.markForCheck();

    // Prevent background page scrolling
    document.body.style.overflow = 'hidden';

    // Autofocus input & ensure scopes navigation starts at leftmost position (scrollLeft: 0)
    setTimeout(() => {
      if (this.scopesNavRef?.nativeElement) {
        this.scopesNavRef.nativeElement.scrollLeft = 0;
      }
      this.searchInputRef?.nativeElement?.focus();
    }, 40);

    // Preload dynamic metadata if not cached
    if (!this.paletteMeta) {
      this.loadPaletteMetadata();
    } else {
      this.rebuildNavigableItems();
    }

    if (this.query.trim()) {
      this.queryDebounce$.next(this.query);
    }
  }

  private handleClose(): void {
    if (this.isVoiceListening) {
      this.speechService.stopVoiceSearch();
    }
    this.isOpen = false;
    this.query = '';
    this.isUserTyped = false;
    this.selectedIndex = -1;
    this.isTrendingExpanded = false;
    this.suggestions = [];
    this.previewResults = { laws: [], lawyers: [], resources: [], faqs: [] };
    this.screenReaderAnnouncement = '';
    if (this.scopesNavRef?.nativeElement) {
      this.scopesNavRef.nativeElement.scrollLeft = 0;
    }
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  close(): void {
    this.searchService.close();
  }

  toggleVoiceSearch(): void {
    if (this.isVoiceListening) {
      this.speechService.stopVoiceSearch();
    } else {
      this.speechService.startVoiceSearch();
    }
  }

  private loadPaletteMetadata(): void {
    if (!this.paletteMeta?.trendingTopics?.length) {
      this.isLoadingMeta = true;
      this.cdr.markForCheck();
    }

    this.searchService.getPaletteMetadata()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: meta => {
          this.paletteMeta = meta;
          this.isLoadingMeta = false;
          this.rebuildNavigableItems();
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingMeta = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Parallelized query execution using forkJoin so both suggestions and preview
   * execute concurrently rather than in a sequential waterfall.
   */
  private setupQueryPipeline(): void {
    this.queryDebounce$.pipe(
      debounceTime(220),
      distinctUntilChanged(),
      tap(query => {
        const q = query.trim();
        if (!q) {
          this.isLoadingResults = false;
          this.isLoadingSuggestions = false;
          this.suggestions = [];
          this.previewResults = { laws: [], lawyers: [], resources: [], faqs: [] };
          this.screenReaderAnnouncement = 'Search input cleared.';
          this.rebuildNavigableItems();
          this.cdr.markForCheck();
        } else {
          this.isLoadingResults = true;
          this.isLoadingSuggestions = true;
          this.cdr.markForCheck();
        }
      }),
      switchMap(query => {
        const q = query.trim();
        if (!q) {
          return of({
            suggestions: [] as SearchSuggestion[],
            preview: { laws: [], lawyers: [], resources: [], faqs: [] } as SearchPreviewResults
          });
        }

        const suggestions$ = this.searchService.getSuggestions(q).pipe(
          catchError(() => of([] as SearchSuggestion[]))
        );
        const preview$ = this.searchService.searchPreview(q, 6).pipe(
          catchError(() => of({ laws: [], lawyers: [], resources: [], faqs: [] } as SearchPreviewResults))
        );

        // Run concurrently without network waterfall
        return forkJoin({
          suggestions: suggestions$,
          preview: preview$
        }).pipe(
          catchError(() => of({
            suggestions: [] as SearchSuggestion[],
            preview: { laws: [], lawyers: [], resources: [], faqs: [] } as SearchPreviewResults
          }))
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: res => {
        if (res) {
          this.suggestions = res.suggestions;
          this.previewResults = res.preview;
          this.isLoadingResults = false;
          this.isLoadingSuggestions = false;
          this.rebuildNavigableItems();
          this.updateScreenReaderAnnouncement();
          this.cdr.markForCheck();
        }
      },
      error: () => {
        this.isLoadingResults = false;
        this.isLoadingSuggestions = false;
        this.cdr.markForCheck();
      }
    });
  }

  private updateScreenReaderAnnouncement(): void {
    if (!this.query.trim()) return;
    const total = this.totalPreviewCount;
    if (total === 0 && this.suggestions.length === 0) {
      this.screenReaderAnnouncement = `No results found for "${this.query}".`;
    } else {
      this.screenReaderAnnouncement = `${total} preview results available across laws, advocates, and resources. Use Up and Down arrow keys to navigate.`;
    }
  }

  onQueryInput(val: string, fromUserTyping = true): void {
    this.query = val;
    this.isUserTyped = fromUserTyping && val.trim().length > 0;
    this.selectedIndex = -1;
    this.queryDebounce$.next(val);
    this.cdr.markForCheck();
  }

  clearQuery(): void {
    this.query = '';
    this.isUserTyped = false;
    this.selectedIndex = -1;
    this.suggestions = [];
    this.previewResults = { laws: [], lawyers: [], resources: [], faqs: [] };
    this.rebuildNavigableItems();
    this.searchInputRef?.nativeElement?.focus();
    this.cdr.markForCheck();
  }

  setScope(scope: SearchScope): void {
    this.activeScope = scope;
    this.selectedIndex = -1;
    this.rebuildNavigableItems();
    if (scope === 'all' && this.scopesNavRef?.nativeElement) {
      this.scopesNavRef.nativeElement.scrollTo({ left: 0, behavior: 'smooth' });
    }
    const currentScope = this.scopes.find(s => s.id === scope);
    this.screenReaderAnnouncement = `Scope filtered to ${currentScope?.label || scope}.`;
    this.cdr.markForCheck();
  }

  // --- Keyboard Shortcuts & Host Listener ---

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (!this.isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.openAdvancedSearch();
      return;
    }

    // Direct Scope Number Shortcuts: Alt+1 ... Alt+5
    if (event.altKey && ['1', '2', '3', '4', '5'].includes(event.key)) {
      event.preventDefault();
      const scopeIdx = parseInt(event.key, 10) - 1;
      if (scopeIdx >= 0 && scopeIdx < this.scopes.length) {
        this.setScope(this.scopes[scopeIdx].id);
        return;
      }
    }

    // Tab key handling:
    // If user is focused in the search input, Tab rotates forward and Shift+Tab rotates backward.
    // If focus is elsewhere in the dialog, allow standard tab traversal.
    if (event.key === 'Tab') {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl === this.searchInputRef?.nativeElement;

      if (isInputFocused) {
        event.preventDefault();
        const currentIdx = this.scopes.findIndex(s => s.id === this.activeScope);
        const nextIdx = event.shiftKey
          ? (currentIdx - 1 + this.scopes.length) % this.scopes.length
          : (currentIdx + 1) % this.scopes.length;
        this.setScope(this.scopes[nextIdx].id);
        return;
      }
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.navigableItems.length > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % this.navigableItems.length;
        this.scrollActiveIntoView();
        this.cdr.markForCheck();
      }
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.navigableItems.length > 0) {
        this.selectedIndex = this.selectedIndex <= 0 ? this.navigableItems.length - 1 : this.selectedIndex - 1;
        this.scrollActiveIntoView();
        this.cdr.markForCheck();
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.selectedIndex >= 0 && this.selectedIndex < this.navigableItems.length) {
        this.navigableItems[this.selectedIndex].action();
      } else {
        this.openAdvancedSearch();
      }
    }
  }

  // --- Complete Navigable Item Construction ---

  private rebuildNavigableItems(): void {
    const items: NavigableItem[] = [];
    const q = this.query.trim();

    if (!q) {
      // 1. Recent Searches (Universal for both guest & authenticated users)
      if (this.recentSearches.length > 0) {
        this.recentSearches.forEach((rec, idx) => {
          items.push({
            id: `recent-${idx}`,
            type: 'recent',
            title: rec,
            subtitle: 'Recent Search',
            action: () => this.applySearchQuery(rec)
          });
        });
      }

      // 2. Trending Topics
      if (this.paletteMeta?.trendingTopics) {
        this.visibleTrendingTopics.forEach((topic, idx) => {
          items.push({
            id: `trending-${idx}`,
            type: 'trending',
            title: topic.name,
            subtitle: topic.description,
            action: () => this.applySearchQuery(topic.sampleQuery || topic.name)
          });
        });
      }

      // 3. Popular Inquiry Chips (Now accessible via keyboard)
      if (this.paletteMeta?.popularSearches?.topics) {
        this.paletteMeta.popularSearches.topics.forEach((topic, idx) => {
          items.push({
            id: `popular-topic-${idx}`,
            type: 'popular',
            title: topic,
            subtitle: 'Popular Search',
            action: () => this.applySearchQuery(topic)
          });
        });
      }

      // 4. Landmark Bare Acts & Codes (Now accessible via keyboard)
      if (this.paletteMeta?.popularSearches?.laws) {
        this.paletteMeta.popularSearches.laws.forEach((law, idx) => {
          items.push({
            id: `popular-law-${idx}`,
            type: 'popular',
            title: law.shortName,
            subtitle: law.actName,
            action: () => this.applySearchQuery(law.shortName)
          });
        });
      }

      // 5. Quick Access Navigation
      if (this.paletteMeta?.quickAccess) {
        this.paletteMeta.quickAccess.forEach((qa, idx) => {
          items.push({
            id: `quick-${idx}`,
            type: 'quick-access',
            title: qa.label,
            subtitle: qa.description,
            action: () => this.navigateToRoute(qa.route)
          });
        });
      }
    } else {
      // 1. Suggestions Chips
      this.suggestions.forEach((sug, idx) => {
        items.push({
          id: `sug-${idx}`,
          type: 'suggestion',
          title: sug.text,
          subtitle: sug.subtitle,
          action: () => {
            if (sug.route) {
              this.navigateToRoute(sug.route, sug.queryParams);
            } else {
              this.applySearchQuery(sug.text);
            }
          }
        });
      });

      // 2. Laws Preview
      if (this.activeScope === 'all' || this.activeScope === 'laws') {
        this.previewResults.laws.forEach((law, idx) => {
          items.push({
            id: `law-${idx}`,
            type: 'law',
            title: `${law.shortName} Section ${law.section_number}: ${law.title}`,
            subtitle: law.actName,
            action: () => this.openLawSection(law)
          });
        });
      }

      // 3. Lawyers Preview
      if (this.activeScope === 'all' || this.activeScope === 'lawyers') {
        this.previewResults.lawyers.forEach((lawyer, idx) => {
          items.push({
            id: `lawyer-${idx}`,
            type: 'lawyer',
            title: lawyer.name,
            subtitle: lawyer.specializations?.join(', ') || lawyer.city,
            action: () => this.openLawyerProfile(lawyer)
          });
        });
      }

      // 4. Resources Preview
      if (this.activeScope === 'all' || this.activeScope === 'resources') {
        this.previewResults.resources.forEach((res, idx) => {
          items.push({
            id: `resource-${idx}`,
            type: 'resource',
            title: res.name,
            subtitle: `${res.city || ''} • ${res.categories?.join(', ') || ''}`,
            action: () => this.openResource(res)
          });
        });
      }

      // 5. FAQs Preview
      if (this.activeScope === 'all' || this.activeScope === 'faqs') {
        this.previewResults.faqs.forEach((faq, idx) => {
          items.push({
            id: `faq-${idx}`,
            type: 'faq',
            title: faq.question,
            subtitle: faq.category,
            action: () => this.openFaq(faq)
          });
        });
      }

      // 6. Advanced Search Trigger
      items.push({
        id: 'advanced-cta',
        type: 'advanced',
        title: `Search everywhere for "${q}"`,
        subtitle: 'Open full search with multi-tier filters',
        action: () => this.openAdvancedSearch()
      });
    }

    this.navigableItems = items;
  }

  isItemSelected(id: string): boolean {
    if (this.selectedIndex < 0 || this.selectedIndex >= this.navigableItems.length) return false;
    return this.navigableItems[this.selectedIndex]?.id === id;
  }

  /**
   * Snappy instant scrolling without smooth scroll animation stutter during rapid keypresses
   */
  private scrollActiveIntoView(): void {
    setTimeout(() => {
      const activeEl = this.resultsContainerRef?.nativeElement?.querySelector('.is-keyboard-active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }, 0);
  }

  // --- User Action Handlers ---

  get visibleTrendingTopics(): TrendingTopic[] {
    const list = this.paletteMeta?.trendingTopics;
    if (!list) return [];
    return this.isTrendingExpanded ? list : list.slice(0, 4);
  }

  get trendingTopicsCount(): number {
    return this.paletteMeta?.trendingTopics?.length || 0;
  }

  toggleTrendingTopics(): void {
    this.isTrendingExpanded = !this.isTrendingExpanded;
    this.rebuildNavigableItems();
    this.cdr.markForCheck();
  }

  applySearchQuery(queryStr: string): void {
    this.query = queryStr;
    // Applied from menu/trending/popular chips - not an explicit typed search until committed
    this.onQueryInput(queryStr, false);
  }

  openAdvancedSearch(): void {
    const q = this.query.trim();
    if (q) {
      this.searchService.logSearchTelemetry(q);
      this.searchService.addRecentSearch(q);
    }
    this.close();

    const queryParams: Record<string, string> = {};
    if (q) queryParams['q'] = q;
    if (this.activeScope !== 'all') {
      queryParams['tab'] = this.activeScope;
    }

    this.router.navigate(['/search'], { queryParams });
  }

  openLawSection(law: any): void {
    if (this.isUserTyped && this.query.trim()) {
      this.searchService.addRecentSearch(this.query.trim());
    }
    this.close();
    if (law.shortName && law.section_number) {
      this.router.navigate(['/laws', law.shortName, law.section_number]);
    } else {
      this.router.navigate(['/search'], {
        queryParams: { q: `${law.shortName || ''} Section ${law.section_number || ''}`.trim() }
      });
    }
  }

  openLawyerProfile(lawyer: any): void {
    if (this.isUserTyped && this.query.trim()) {
      this.searchService.addRecentSearch(this.query.trim());
    }
    this.close();
    if (lawyer._id || lawyer.id) {
      this.router.navigate(['/lawyers', lawyer._id || lawyer.id]);
    } else {
      this.router.navigate(['/lawyers'], {
        queryParams: { search: lawyer.name }
      });
    }
  }

  openResource(resource: any): void {
    if (this.isUserTyped && this.query.trim()) {
      this.searchService.addRecentSearch(this.query.trim());
    }
    this.close();
    this.router.navigate(['/legal-resources'], {
      queryParams: { q: resource.name }
    });
  }

  openFaq(_faq: any): void {
    if (this.isUserTyped && this.query.trim()) {
      this.searchService.addRecentSearch(this.query.trim());
    }
    this.close();
    this.router.navigate(['/help']);
  }

  navigateToRoute(route: string, queryParams?: Record<string, string>): void {
    this.close();
    if (queryParams) {
      this.router.navigate([route], { queryParams });
    } else {
      this.router.navigate([route]);
    }
  }

  // --- Semantic RouterLink Route Builders ---

  getLawLink(law: any): { route: any[]; queryParams?: Record<string, string> } {
    if (law.shortName && law.section_number) {
      return { route: ['/laws', law.shortName, law.section_number] };
    }
    return {
      route: ['/search'],
      queryParams: { q: `${law.shortName || ''} Section ${law.section_number || ''}`.trim() }
    };
  }

  getLawyerLink(lawyer: any): { route: any[]; queryParams?: Record<string, string> } {
    if (lawyer._id || lawyer.id) {
      return { route: ['/lawyers', lawyer._id || lawyer.id] };
    }
    return {
      route: ['/lawyers'],
      queryParams: { search: lawyer.name }
    };
  }

  getResourceLink(resource: any): { route: any[]; queryParams?: Record<string, string> } {
    return {
      route: ['/legal-resources'],
      queryParams: { q: resource.name }
    };
  }

  getFaqLink(_faq: any): { route: any[] } {
    return { route: ['/help'] };
  }

  getAdvancedSearchParams(): Record<string, string> {
    const q = this.query.trim();
    const queryParams: Record<string, string> = {};
    if (q) queryParams['q'] = q;
    if (this.activeScope !== 'all') {
      queryParams['tab'] = this.activeScope;
    }
    return queryParams;
  }

  /**
   * Primary click handler on semantic <a> elements.
   * - Left-click without modifier keys: records search history/telemetry and closes modal.
   * - Middle-click / Cmd-click / Ctrl-click: native browser behavior opens in new tab cleanly.
   */
  onItemClick(event: MouseEvent, recordQuery = false): void {
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      if (recordQuery || (this.isUserTyped && this.query.trim())) {
        const q = this.query.trim();
        if (q) {
          this.searchService.logSearchTelemetry(q);
          this.searchService.addRecentSearch(q);
        }
      }
      this.close();
    }
  }

  // --- Quick Actions ---

  copyCitation(event: Event, law: any): void {
    event.stopPropagation();
    const citation = `${law.shortName || 'Act'} Section ${law.section_number}: ${law.title || ''}`.trim();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(citation).then(() => {
        this.snackbar.show(`Copied citation: ${citation}`, 'success');
      }).catch(() => {
        this.snackbar.show(`Citation: ${citation}`, 'info');
      });
    } else {
      this.snackbar.show(`Citation: ${citation}`, 'info');
    }
  }

  // --- Recent Searches Controls ---

  deleteRecentSearch(event: Event, queryText: string): void {
    event.stopPropagation();
    this.searchService.removeRecentSearch(queryText);
    this.snackbar.show(`Removed "${queryText}" from history.`, 'info');
  }

  clearAllRecents(event: Event): void {
    event.stopPropagation();
    this.searchService.clearRecentSearches();
    this.snackbar.show('Search history cleared.', 'info');
  }

  // --- Substring Query Highlighting ---

  highlightQuery(text: string): string {
    if (!text) return '';
    const q = this.query.trim();
    if (!q || q.length < 2) return text;
    try {
      const escaped = q.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      return text.replace(regex, '<mark class="palette-highlight font-semibold">$1</mark>');
    } catch {
      return text;
    }
  }

  // --- Cross-Scope Result Discovery ---

  get otherScopesWithResults(): { label: string; count: number; id: SearchScope }[] {
    if (this.activeScope === 'all') return [];
    const scopeMap: { id: SearchScope; label: string; count: number }[] = [
      { id: 'laws', label: 'Bare Acts & Laws', count: this.previewResults.laws?.length || 0 },
      { id: 'lawyers', label: 'Advocates', count: this.previewResults.lawyers?.length || 0 },
      { id: 'resources', label: 'Legal Aid Centers', count: this.previewResults.resources?.length || 0 },
      { id: 'faqs', label: 'Platform FAQs', count: this.previewResults.faqs?.length || 0 }
    ];
    return scopeMap.filter(s => s.id !== this.activeScope && s.count > 0);
  }

  // --- Display Helpers ---

  get totalPreviewCount(): number {
    return (
      (this.previewResults.laws?.length || 0) +
      (this.previewResults.lawyers?.length || 0) +
      (this.previewResults.resources?.length || 0) +
      (this.previewResults.faqs?.length || 0)
    );
  }

  hasPreviewForScope(scope: SearchScope): boolean {
    if (scope === 'all') return this.totalPreviewCount > 0;
    if (scope === 'laws') return (this.previewResults.laws?.length || 0) > 0;
    if (scope === 'lawyers') return (this.previewResults.lawyers?.length || 0) > 0;
    if (scope === 'resources') return (this.previewResults.resources?.length || 0) > 0;
    if (scope === 'faqs') return (this.previewResults.faqs?.length || 0) > 0;
    return false;
  }

  getScopeCount(scope: SearchScope): number {
    if (scope === 'all') return this.totalPreviewCount;
    if (scope === 'laws') return this.previewResults.laws?.length || 0;
    if (scope === 'lawyers') return this.previewResults.lawyers?.length || 0;
    if (scope === 'resources') return this.previewResults.resources?.length || 0;
    if (scope === 'faqs') return this.previewResults.faqs?.length || 0;
    return 0;
  }

  getScopeLabel(scope: SearchScope): string {
    return this.scopes.find(s => s.id === scope)?.label || scope;
  }

  trackByIndex(index: number, _item?: any): number {
    return index;
  }
}