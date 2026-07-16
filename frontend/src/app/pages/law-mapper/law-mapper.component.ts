import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef,
  NgZone, HostListener, ViewChild, ElementRef
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIf, NgFor, NgClass, NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, switchMap, of, catchError } from 'rxjs';
import { LegalService, TransitionMappingResult, MappingSuggestion } from '../../services/legal.service';
import { FormattingService } from '../../services/formatting.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { ShareMenuComponent } from '../../components/share-menu/share-menu.component';
import { PrintContainerComponent } from '../../components/print-container/print-container.component';

interface PopularSection {
  act: string;
  num: string;
  label: string;
  icon: string;
  color: string;
}

interface HistoryEntry {
  act: string;
  section: string;
  label: string;
  timestamp: number;
}

interface ActOption {
  value: string;
  label: string;
  shortLabel: string;
  group: 'old' | 'new';
}

interface PinnedEntry {
  result: TransitionMappingResult;
  similarity: number;
}

@Component({
  selector: 'app-law-mapper',
  standalone: true,
  imports: [
    NgIf, NgFor, NgClass, NgSwitch, NgSwitchCase, NgSwitchDefault, RouterLink,
    FormsModule, TooltipDirective, ShareMenuComponent, PrintContainerComponent
  ],
  templateUrl: './law-mapper.component.html',
  styleUrls: ['./law-mapper.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LawMapperComponent implements OnInit, OnDestroy {
  @ViewChild('sectionInput') sectionInputEl?: ElementRef<HTMLInputElement>;

  selectedAct = 'IPC';
  sectionNumber = '';
  loading = false;
  error = '';
  result: TransitionMappingResult | null = null;

  // Typeahead
  suggestions: MappingSuggestion[] = [];
  showSuggestions = false;
  activeSuggestionIndex = -1;
  private searchInput$ = new Subject<string>();

  // History
  recentSearches: HistoryEntry[] = [];
  private readonly HISTORY_KEY = 'legalconnect_mapper_history';
  private readonly MAX_HISTORY = 8;
  private readonly PINS_KEY = 'legalconnect_mapper_pins';

  // Client-side result cache (LRU capped at MAX_CACHE)
  private resultCache = new Map<string, TransitionMappingResult>();
  private readonly MAX_CACHE = 50;

  // Mobile tab for results (added 'unified' for inline mobile comparison)
  activeResultTab: 'old' | 'unified' | 'new' | 'ai' = 'old';

  // Comparison toggle
  showFullComparison = false;

  popularExpanded = false;
  showActDropdown = false;

  // Tracks when swap was triggered so we can flip the backend's old→new response
  private _expectReversed = false;

  // Diff html
  showDiff = false;
  diffSimilarity = 0;
  oldSectionDiffHtml = '';
  newSectionDiffHtml = '';
  oldTitleDiffHtml = '';
  newTitleDiffHtml = '';
  mergedSectionDiffHtml = '';
  mergedTitleDiffHtml = '';

  // Mobile navigation and gesture state
  showStickyHeader = false;
  showMobileDrawer = false;
  private touchStartX = 0;
  private touchStartY = 0;

  // Popular lookups filter
  popularFilter = 'All';
  readonly popularFilterOptions = ['All', 'IPC', 'CrPC', 'IEA', 'BNS', 'BNSS', 'BSA'];

  // Pinned comparisons (max 4)
  pinnedEntries: PinnedEntry[] = [];
  readonly MAX_PINS = 4;

  // Reading mode
  isReadingMode = false;

  private destroy$ = new Subject<void>();

  // ── Effective dates for new acts ──
  private readonly effectiveDates: Record<string, string> = {
    'BNS': 'July 1, 2024',
    'BNSS': 'July 1, 2024',
    'BSA': 'July 1, 2024',
  };

  // ── Static avg similarity per act-pair (from known data analysis) ──
  private readonly avgSimilarityMap: Record<string, number> = {
    'IPC:BNS': 68, 'BNS:IPC': 68,
    'CrPC:BNSS': 72, 'BNSS:CrPC': 72,
    'IEA:BSA': 74, 'BSA:IEA': 74,
  };

  // ── Pre-built color Maps (memoized — not re-computed on every CD cycle) ──
  private readonly popularCardClassMap: Record<string, string> = {
    'rose': 'hover:border-rose-500/40 hover:bg-rose-500/[0.04] dark:hover:border-rose-500/30 dark:hover:bg-rose-500/[0.04]',
    'blue': 'hover:border-blue-500/40 hover:bg-blue-500/[0.04] dark:hover:border-blue-500/30 dark:hover:bg-blue-500/[0.04]',
    'purple': 'hover:border-purple-500/40 hover:bg-purple-500/[0.04] dark:hover:border-purple-500/30 dark:hover:bg-purple-500/[0.04]',
    'pink': 'hover:border-pink-500/40 hover:bg-pink-500/[0.04] dark:hover:border-pink-500/30 dark:hover:bg-pink-500/[0.04]',
    'amber': 'hover:border-amber-500/40 hover:bg-amber-500/[0.04] dark:hover:border-amber-500/30 dark:hover:bg-amber-500/[0.04]',
    'sky': 'hover:border-sky-500/40 hover:bg-sky-500/[0.04] dark:hover:border-sky-500/30 dark:hover:bg-sky-500/[0.04]',
    'emerald': 'hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/[0.04]',
    'teal': 'hover:border-teal-500/40 hover:bg-teal-500/[0.04] dark:hover:border-teal-500/30 dark:hover:bg-teal-500/[0.04]',
  };

  private readonly popularIconClassMap: Record<string, string> = {
    'rose': 'text-rose-500 dark:text-rose-400',
    'blue': 'text-blue-500 dark:text-blue-400',
    'purple': 'text-purple-500 dark:text-purple-400',
    'pink': 'text-pink-500 dark:text-pink-400',
    'amber': 'text-amber-500 dark:text-amber-400',
    'sky': 'text-sky-500 dark:text-sky-400',
    'emerald': 'text-emerald-500 dark:text-emerald-400',
    'teal': 'text-teal-500 dark:text-teal-400',
  };

  private readonly popularTextClassMap: Record<string, string> = {
    'rose': 'group-hover:text-rose-600 dark:group-hover:text-rose-400',
    'blue': 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
    'purple': 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
    'pink': 'group-hover:text-pink-600 dark:group-hover:text-pink-400',
    'amber': 'group-hover:text-amber-600 dark:group-hover:text-amber-400',
    'sky': 'group-hover:text-sky-600 dark:group-hover:text-sky-400',
    'emerald': 'group-hover:text-emerald-600 dark:group-hover:text-emerald-400',
    'teal': 'group-hover:text-teal-600 dark:group-hover:text-teal-400',
  };

  // All supported acts (bidirectional)
  actOptions: ActOption[] = [
    { value: 'IPC', label: 'Indian Penal Code (IPC)', shortLabel: 'IPC', group: 'old' },
    { value: 'CrPC', label: 'Code of Criminal Procedure (CrPC)', shortLabel: 'CrPC', group: 'old' },
    { value: 'IEA', label: 'Indian Evidence Act (IEA)', shortLabel: 'IEA', group: 'old' },
    { value: 'BNS', label: 'Bharatiya Nyaya Sanhita (BNS)', shortLabel: 'BNS', group: 'new' },
    { value: 'BNSS', label: 'Bharatiya Nagarik Suraksha Sanhita (BNSS)', shortLabel: 'BNSS', group: 'new' },
    { value: 'BSA', label: 'Bharatiya Sakshya Adhiniyam (BSA)', shortLabel: 'BSA', group: 'new' },
  ];

  popularSections: PopularSection[] = [
    { act: 'IPC', num: '302', label: 'Murder', icon: 'scale', color: 'rose' },
    { act: 'IPC', num: '420', label: 'Cheating', icon: 'search', color: 'blue' },
    { act: 'IPC', num: '376', label: 'Rape', icon: 'shield', color: 'purple' },
    { act: 'IPC', num: '498A', label: 'Cruelty by Husband', icon: 'family', color: 'pink' },
    { act: 'IPC', num: '304A', label: 'Negligent Death', icon: 'warning', color: 'amber' },
    { act: 'CrPC', num: '154', label: 'FIR', icon: 'clipboard', color: 'sky' },
    { act: 'CrPC', num: '125', label: 'Maintenance', icon: 'money', color: 'emerald' },
    { act: 'IEA', num: '45', label: 'Expert Opinion', icon: 'expert', color: 'teal' },
    { act: 'BNS', num: '103', label: 'Murder (New)', icon: 'scale', color: 'rose' },
    { act: 'BNS', num: '318', label: 'Cheating (New)', icon: 'search', color: 'blue' },
  ];

  // ── Computed getters ──
  get oldActs(): ActOption[] { return this.actOptions.filter(a => a.group === 'old'); }
  get newActs(): ActOption[] { return this.actOptions.filter(a => a.group === 'new'); }
  get selectedActOption(): ActOption | undefined { return this.actOptions.find(a => a.value === this.selectedAct); }

  get filteredPopularSections(): PopularSection[] {
    if (this.popularFilter === 'All') return this.popularSections;
    return this.popularSections.filter(s => s.act === this.popularFilter);
  }

  get canSwap(): boolean {
    return !!(this.result?.newSection);
  }

  get isPinned(): boolean {
    if (!this.result) return false;
    return this.pinnedEntries.some(p =>
      p.result.oldAct?.shortName === this.result!.oldAct?.shortName &&
      p.result.oldSection?.section_number === this.result!.oldSection?.section_number
    );
  }

  get actAvgSimilarity(): number | null {
    if (!this.result) return null;
    const key = `${this.result.oldAct.shortName}:${this.result.newAct.shortName}`;
    return this.avgSimilarityMap[key] ?? null;
  }

  get newActEffectiveDate(): string | null {
    if (!this.result) return null;
    return this.effectiveDates[this.result.newAct.shortName] ?? null;
  }

  /** SVG similarity ring — r=14, circumference≈87.96 */
  get similarityRingDashoffset(): number {
    const circumference = 2 * Math.PI * 14;
    return circumference * (1 - this.diffSimilarity / 100);
  }

  get similarityRingColor(): string {
    if (this.diffSimilarity >= 60) return '#10b981';
    if (this.diffSimilarity >= 30) return '#f59e0b';
    return '#ef4444';
  }

  get similarityRingCircumference(): number {
    return 2 * Math.PI * 14;
  }

  constructor(
    private legalService: LegalService,
    private snackbar: SnackbarService,
    private route: ActivatedRoute,
    public router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public formatter: FormattingService
  ) { }

  ngOnInit() {
    this.loadHistory();
    this.loadPins();

    // Deep link support
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['act'] && params['section']) {
        this.selectedAct = params['act'];
        this.sectionNumber = params['section'];
        this.getMapping();
      }
    });

    // Typeahead debounce
    this.searchInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 1) return of([]);
        return this.legalService.getMappingSuggestions(query).pipe(
          catchError(() => of({ success: false, data: [] }))
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((res: any) => {
      this.suggestions = Array.isArray(res) ? res : (res.data || []);
      this.showSuggestions = this.suggestions.length > 0;
      this.activeSuggestionIndex = -1;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  // ── Dropdown controls ──
  toggleActDropdown() {
    this.showActDropdown = !this.showActDropdown;
    this.cdr.markForCheck();
  }

  selectActOption(value: string) {
    this.selectedAct = value;
    this.showActDropdown = false;
    this.cdr.markForCheck();
  }

  onSectionInput(value: string) {
    this.sectionNumber = value;
    this.searchInput$.next(value);
  }

  selectSuggestion(suggestion: MappingSuggestion) {
    this.selectedAct = suggestion.act;
    this.sectionNumber = suggestion.section;
    this.showSuggestions = false;
    this.getMapping();
  }

  onInputKeydown(event: KeyboardEvent) {
    if (this.showSuggestions && this.suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.activeSuggestionIndex = Math.min(this.activeSuggestionIndex + 1, this.suggestions.length - 1);
        this.cdr.markForCheck();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.activeSuggestionIndex = Math.max(this.activeSuggestionIndex - 1, -1);
        this.cdr.markForCheck();
        return;
      }
      if (event.key === 'Enter' && this.activeSuggestionIndex >= 0) {
        event.preventDefault();
        this.selectSuggestion(this.suggestions[this.activeSuggestionIndex]);
        return;
      }
    }
    if (event.key === 'Escape') {
      this.showSuggestions = false;
      this.cdr.markForCheck();
    }
  }

  /** Optimized: only triggers cdr if state actually changed */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const inTypeahead = !!target.closest('.typeahead-container');
    const inSelect = !!target.closest('.select-container');

    const newSuggestions = inTypeahead ? this.showSuggestions : false;
    const newDropdown = inSelect ? this.showActDropdown : false;

    if (newSuggestions !== this.showSuggestions || newDropdown !== this.showActDropdown) {
      this.showSuggestions = newSuggestions;
      this.showActDropdown = newDropdown;
      this.cdr.markForCheck();
    }
  }

  // ── Selection helpers ──
  selectPopular(act: string, num: string) {
    this.selectedAct = act;
    this.sectionNumber = num;
    this.getMapping();
  }

  selectHistory(entry: HistoryEntry) {
    this.selectedAct = entry.act;
    this.sectionNumber = entry.section;
    this.getMapping();
  }

  setPopularFilter(filter: string) {
    this.popularFilter = filter;
    this.cdr.markForCheck();
  }

  // ── History controls ──
  clearHistory() {
    this.recentSearches = [];
    localStorage.removeItem(this.HISTORY_KEY);
    this.cdr.markForCheck();
  }

  clearSearchInput() {
    this.sectionNumber = '';
    this.suggestions = [];
    this.showSuggestions = false;
    this.searchInput$.next('');

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });

    this.cdr.markForCheck();
    setTimeout(() => this.sectionInputEl?.nativeElement?.focus(), 0);
  }

  clearAll() {
    this.result = null;
    this.error = '';
    this.isReadingMode = false;
    this.clearSearchInput();
  }

  // ── NEW: Swap direction ──
  swapDirection() {
    if (!this.result?.newSection) return;
    this.selectedAct = this.result.newAct.shortName;
    this.sectionNumber = this.result.newSection.section_number;
    this._expectReversed = true; // backend always returns old→new; we need to flip
    this.getMapping();
  }

  /**
   * If the backend returned old→new but user searched from the new-act side,
   * swap oldAct/oldSection ↔ newAct/newSection so the display matches intent.
   */
  private maybeFlipResult(res: TransitionMappingResult): TransitionMappingResult {
    if (this._expectReversed) {
      this._expectReversed = false;
      if (res.oldAct?.shortName !== this.selectedAct) {
        // Flip in place
        const tmpAct = res.oldAct;
        res.oldAct = res.newAct;
        res.newAct = tmpAct;
        const tmpSection = res.oldSection;
        res.oldSection = res.newSection;
        res.newSection = tmpSection;
      }
    }
    return res;
  }

  // ── NEW: Pin to comparison table ──
  togglePinCurrentResult() {
    if (!this.result) return;

    const pinIndex = this.pinnedEntries.findIndex(p =>
      p.result.oldAct?.shortName === this.result!.oldAct?.shortName &&
      p.result.oldSection?.section_number === this.result!.oldSection?.section_number
    );

    if (pinIndex >= 0) {
      this.unpinResult(pinIndex);
      this.snackbar.show('Unpinned from comparison table');
    } else {
      if (this.pinnedEntries.length >= this.MAX_PINS) {
        this.snackbar.show(`Pin limit reached. Max ${this.MAX_PINS} pins allowed. Unpin one to add more.`);
        return;
      }
      this.pinnedEntries = [...this.pinnedEntries, { result: this.result, similarity: this.diffSimilarity }];
      this.savePins();
      this.snackbar.show('Pinned to comparison table');
      this.cdr.markForCheck();
    }
  }

  unpinResult(index: number) {
    this.pinnedEntries = this.pinnedEntries.filter((_, i) => i !== index);
    this.savePins();
    this.cdr.markForCheck();
  }

  clearPins() {
    this.pinnedEntries = [];
    this.savePins();
    this.cdr.markForCheck();
  }

  private loadPins() {
    try {
      const stored = localStorage.getItem(this.PINS_KEY);
      if (stored) this.pinnedEntries = JSON.parse(stored);
    } catch { this.pinnedEntries = []; }
  }

  private savePins() {
    try {
      localStorage.setItem(this.PINS_KEY, JSON.stringify(this.pinnedEntries));
    } catch { }
  }

  // ── NEW: Copy section text ──
  copySectionText(title: string, content: string, actLabel: string) {
    const text = `${actLabel}\n${title}\n\n${content}`;
    navigator.clipboard.writeText(text).then(() => {
      this.snackbar.show('Section text copied to clipboard');
    }).catch(() => {
      this.snackbar.show('Could not copy — please select text manually');
    });
  }

  getShareSubject(): string {
    const oldAct = this.result?.oldAct?.shortName || '';
    const oldSec = this.result?.oldSection?.section_number || '';
    const newAct = this.result?.newAct?.shortName || '';
    const newSec = this.result?.newSection?.section_number || '';
    return `Legal Mapping: ${oldAct} § ${oldSec} ➔ ${newAct} § ${newSec}`;
  }

  getShareText(): string {
    const oldAct = this.result?.oldAct?.shortName || '';
    const oldSec = this.result?.oldSection?.section_number || '';
    const newAct = this.result?.newAct?.shortName || '';
    const newSec = this.result?.newSection?.section_number || '';
    const similarity = this.diffSimilarity;
    return `Compare ${oldAct} Section ${oldSec} and ${newAct} Section ${newSec} (${similarity}% similarity) on LegalConnect:`;
  }

  getShareUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.origin + this.router.url;
    }
    return 'https://legalconnect-501109.web.app' + this.router.url;
  }

  // ── NEW: Print / Export ──
  triggerPrint() {
    window.print();
  }

  // ── NEW: Reading mode toggle ──
  toggleReadingMode() {
    this.isReadingMode = !this.isReadingMode;
    this.cdr.markForCheck();

    if (this.isReadingMode) {
      // Smooth scroll to the top of the page since the search panel is now hidden
      this.ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 60);
      });
    } else {
      // Scroll back to the result section when exiting focus mode
      this.scrollToResult();
    }
  }

  // ── Scroll helper ──
  private scrollToResult() {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        const el = document.getElementById('result-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    });
  }

  // ── Main fetch ──
  getMapping() {
    if (!this.sectionNumber.trim()) {
      this.error = 'Please enter a section number.';
      this.cdr.markForCheck();
      return;
    }

    this.showSuggestions = false;
    this.popularExpanded = false;

    const cacheKey = `${this.selectedAct}:${this.sectionNumber.trim()}`;
    const cached = this.resultCache.get(cacheKey);
    if (cached) {
      this.result = this.maybeFlipResult({ ...cached }); // flip copy if swap was triggered
      this.error = '';
      this.activeResultTab = 'old';
      this.showFullComparison = false;
      this.addToHistory();
      this.updateUrl();
      this.cdr.markForCheck();
      this.scrollToResult();
      this.scheduleDiff(); // deferred
      return;
    }

    this.loading = true;
    this.error = '';
    this.result = null;
    this.cdr.markForCheck();
    this.scrollToResult();

    this.legalService.getTransitionMapping(this.selectedAct, this.sectionNumber).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          if (res.oldSection) {
            const h = this.formatter.healTitleAndContent(res.oldSection.title, res.oldSection.content);
            res.oldSection.title = h.title;
            res.oldSection.content = this.formatter.cleanSectionContent(h.content);
          }
          if (res.newSection) {
            const h = this.formatter.healTitleAndContent(res.newSection.title, res.newSection.content);
            res.newSection.title = h.title;
            res.newSection.content = this.formatter.cleanSectionContent(h.content);
          }

          // Flip old↔new if user searched from the new-act direction
          res = this.maybeFlipResult(res);
          this.result = res;

          // LRU eviction — remove oldest entry if over limit
          if (this.resultCache.size >= this.MAX_CACHE) {
            const firstKey = this.resultCache.keys().next().value;
            if (firstKey !== undefined) this.resultCache.delete(firstKey);
          }
          this.resultCache.set(cacheKey, res);
          this.activeResultTab = 'old';
          this.showFullComparison = false;
          this.addToHistory();
          this.updateUrl();
          this.scrollToResult();
          this.scheduleDiff(); // defer heavy LCS to next paint frame
        } else {
          this.error = 'Failed to load mapping details.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || 'Section not found or mapping not available.';
        this.cdr.markForCheck();
      }
    });
  }

  retry() {
    this.error = '';
    this.getMapping();
  }

  private updateUrl() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { act: this.selectedAct, section: this.sectionNumber.trim() },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private addToHistory() {
    const entry: HistoryEntry = {
      act: this.selectedAct,
      section: this.sectionNumber.trim(),
      label: `${this.selectedAct} ${this.sectionNumber.trim()}`,
      timestamp: Date.now()
    };
    this.recentSearches = this.recentSearches.filter(h => !(h.act === entry.act && h.section === entry.section));
    this.recentSearches.unshift(entry);
    if (this.recentSearches.length > this.MAX_HISTORY) {
      this.recentSearches = this.recentSearches.slice(0, this.MAX_HISTORY);
    }
    this.saveHistory();
  }

  private loadHistory() {
    try {
      const stored = localStorage.getItem(this.HISTORY_KEY);
      if (stored) this.recentSearches = JSON.parse(stored);
    } catch { this.recentSearches = []; }
  }

  private saveHistory() {
    try { localStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.recentSearches)); } catch { }
  }

  // ── Icon / color helpers (pure lookups — no computation) ──
  getActIcon(shortName: string): string {
    const icons: Record<string, string> = {
      'IPC': 'scale', 'CrPC': 'gavel', 'IEA': 'scroll',
      'BNS': 'scale', 'BNSS': 'gavel', 'BSA': 'scroll'
    };
    return icons[shortName] || 'file';
  }

  truncateText(text: string, maxLen: number): string {
    if (!text || text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '…';
  }

  getPopularCardClass(color: string): string {
    return this.popularCardClassMap[color] || 'hover:border-[hsl(35,92%,47%)]/30 hover:bg-[hsl(35,92%,47%)]/[0.04]';
  }

  getPopularIconClass(color: string): string {
    return this.popularIconClassMap[color] || 'text-slate-400 dark:text-slate-500';
  }

  getPopularTextClass(color: string): string {
    return this.popularTextClassMap[color] || 'group-hover:text-[hsl(35,92%,47%)]';
  }

  // ── Diff ──
  generateDiffs() {
    if (this.result?.oldSection && this.result?.newSection) {
      const contentDiff = this.diffWords(this.result.oldSection.content, this.result.newSection.content);
      this.oldSectionDiffHtml = contentDiff.oldHtml;
      this.newSectionDiffHtml = contentDiff.newHtml;
      this.diffSimilarity = contentDiff.similarity;

      const titleDiff = this.diffWords(this.result.oldSection.title, this.result.newSection.title);
      this.oldTitleDiffHtml = titleDiff.oldHtml;
      this.newTitleDiffHtml = titleDiff.newHtml;

      // Compute Unified Merged Diff
      this.mergedSectionDiffHtml = this.mergedDiffWords(this.result.oldSection.content, this.result.newSection.content);
      this.mergedTitleDiffHtml = this.mergedDiffWords(
        `Section ${this.result.oldSection.section_number}: ${this.result.oldSection.title}`,
        `Section ${this.result.newSection.section_number}: ${this.result.newSection.title}`
      );
    } else {
      this.oldSectionDiffHtml = this.result?.oldSection?.content ? this.formatter.escapeHtml(this.result.oldSection.content) : '';
      this.newSectionDiffHtml = this.result?.newSection?.content ? this.formatter.escapeHtml(this.result.newSection.content) : '';
      this.oldTitleDiffHtml = this.result?.oldSection?.title ? this.formatter.escapeHtml(this.result.oldSection.title) : '';
      this.newTitleDiffHtml = this.result?.newSection?.title ? this.formatter.escapeHtml(this.result.newSection.title) : '';
      this.mergedSectionDiffHtml = '';
      this.mergedTitleDiffHtml = '';
      this.diffSimilarity = 0;
    }
  }

  /** Defer heavy LCS to next animation frame so paint isn't blocked */
  private scheduleDiff() {
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        this.generateDiffs();
        this.ngZone.run(() => this.cdr.markForCheck());
      });
    });
  }

  // ── Scroll monitoring for compact sticky header ──
  @HostListener('window:scroll', [])
  onWindowScroll() {
    if (!this.result) {
      this.showStickyHeader = false;
      return;
    }
    const el = document.getElementById('result-section');
    if (el) {
      const rect = el.getBoundingClientRect();
      const isMobile = window.innerWidth < 768;
      // On mobile, trigger when switcher scrolls under the header (< 50px)
      // On desktop, trigger when the result toolbar scrolls under the header (< 60px)
      this.showStickyHeader = isMobile ? rect.top < 50 : rect.top < 60;
    } else {
      this.showStickyHeader = false;
    }
    this.cdr.markForCheck();
  }

  scrollToSearch() {
    this.showStickyHeader = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      this.sectionInputEl?.nativeElement?.focus();
    }, 300);
  }

  // ── Mobile Bottom Sheet History Drawer toggler ──
  toggleMobileDrawer() {
    this.showMobileDrawer = !this.showMobileDrawer;

    if (typeof document !== 'undefined') {
      if (this.showMobileDrawer) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }

    this.cdr.markForCheck();
  }

  // ── Touch swipe gestures to switch result cards on mobile ──
  onSwipeTouchStart(event: TouchEvent | MouseEvent) {
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    this.touchStartX = clientX;
    this.touchStartY = clientY;
  }

  onSwipeTouchEnd(event: TouchEvent | MouseEvent) {
    const clientX = 'changedTouches' in event ? event.changedTouches[0].clientX : event.clientX;
    const clientY = 'changedTouches' in event ? event.changedTouches[0].clientY : event.clientY;

    const diffX = clientX - this.touchStartX;
    const diffY = clientY - this.touchStartY;

    // Must be primarily horizontal and exceed min threshold (50px)
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
      const tabs: ('old' | 'unified' | 'new' | 'ai')[] = ['old', 'unified', 'new', 'ai'];
      const currentIndex = tabs.indexOf(this.activeResultTab);

      if (diffX < 0) {
        // Swipe Left -> Next tab
        if (currentIndex < tabs.length - 1) {
          this.activeResultTab = tabs[currentIndex + 1];
          this.cdr.markForCheck();
        }
      } else {
        // Swipe Right -> Previous tab
        if (currentIndex > 0) {
          this.activeResultTab = tabs[currentIndex - 1];
          this.cdr.markForCheck();
        }
      }
    }
  }

  private diffWords(oldStr: string, newStr: string): { oldHtml: string; newHtml: string; similarity: number } {
    if (!oldStr) return { oldHtml: '', newHtml: this.formatter.escapeHtml(newStr), similarity: 0 };
    if (!newStr) return { oldHtml: this.formatter.escapeHtml(oldStr), newHtml: '', similarity: 0 };

    const splitPattern = /(\s+)/;
    const tokens1 = oldStr.split(splitPattern).filter(Boolean);
    const tokens2 = newStr.split(splitPattern).filter(Boolean);
    const words1 = tokens1.filter(t => t.trim() !== '');
    const words2 = tokens2.filter(t => t.trim() !== '');

    const n = words1.length;
    const m = words2.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        dp[i][j] = words1[i - 1] === words2[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    const lcsLen = dp[n][m];
    const similarity = Math.round((lcsLen / Math.max(n, m, 1)) * 100);

    let i = n; let j = m;
    const status1: ('matched' | 'removed')[] = new Array(n);
    const status2: ('matched' | 'added')[] = new Array(m);

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && words1[i - 1] === words2[j - 1]) {
        status1[i - 1] = 'matched'; status2[j - 1] = 'matched'; i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        status2[j - 1] = 'added'; j--;
      } else {
        status1[i - 1] = 'removed'; i--;
      }
    }

    let wi1 = 0;
    const oldHtmlParts: string[] = [];
    for (const tok of tokens1) {
      if (tok.trim() === '') { oldHtmlParts.push(tok); } else {
        const esc = this.formatter.escapeHtml(tok);
        oldHtmlParts.push(status1[wi1] === 'removed' ? `<del class="diff-removed">${esc}</del>` : esc);
        wi1++;
      }
    }

    let wi2 = 0;
    const newHtmlParts: string[] = [];
    for (const tok of tokens2) {
      if (tok.trim() === '') { newHtmlParts.push(tok); } else {
        const esc = this.formatter.escapeHtml(tok);
        newHtmlParts.push(status2[wi2] === 'added' ? `<ins class="diff-added">${esc}</ins>` : esc);
        wi2++;
      }
    }

    return { oldHtml: oldHtmlParts.join(''), newHtml: newHtmlParts.join(''), similarity };
  }

  private mergedDiffWords(oldStr: string, newStr: string): string {
    if (!oldStr) return this.formatter.escapeHtml(newStr);
    if (!newStr) return this.formatter.escapeHtml(oldStr);

    const splitPattern = /(\s+)/;
    const tokens1 = oldStr.split(splitPattern).filter(Boolean);
    const tokens2 = newStr.split(splitPattern).filter(Boolean);
    const words1 = tokens1.filter(t => t.trim() !== '');
    const words2 = tokens2.filter(t => t.trim() !== '');

    const n = words1.length;
    const m = words2.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        dp[i][j] = words1[i - 1] === words2[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    let i = n; let j = m;
    const ops: { type: 'matched' | 'added' | 'removed'; w1Idx?: number; w2Idx?: number }[] = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && words1[i - 1] === words2[j - 1]) {
        ops.push({ type: 'matched', w1Idx: i - 1, w2Idx: j - 1 });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.push({ type: 'added', w2Idx: j - 1 });
        j--;
      } else {
        ops.push({ type: 'removed', w1Idx: i - 1 });
        i--;
      }
    }
    ops.reverse();

    const t1Indices: number[] = [];
    for (let t = 0; t < tokens1.length; t++) {
      if (tokens1[t].trim() !== '') t1Indices.push(t);
    }
    const t2Indices: number[] = [];
    for (let t = 0; t < tokens2.length; t++) {
      if (tokens2[t].trim() !== '') t2Indices.push(t);
    }

    const getPrecedingWhitespace = (tokens: string[], tIndices: number[], wi: number, lastTIdx: number): string => {
      const currentTIdx = tIndices[wi];
      let ws = '';
      for (let t = lastTIdx + 1; t < currentTIdx; t++) {
        ws += tokens[t];
      }
      return ws;
    };

    let lastT1 = -1;
    let lastT2 = -1;
    const htmlParts: string[] = [];

    for (const op of ops) {
      if (op.type === 'matched') {
        const w1 = op.w1Idx!;
        const w2 = op.w2Idx!;
        const t1Val = t1Indices[w1];
        const t2Val = t2Indices[w2];

        const ws = getPrecedingWhitespace(tokens2, t2Indices, w2, lastT2);
        htmlParts.push(ws);
        htmlParts.push(this.formatter.escapeHtml(tokens2[t2Val]));

        lastT1 = t1Val;
        lastT2 = t2Val;
      } else if (op.type === 'removed') {
        const w1 = op.w1Idx!;
        const t1Val = t1Indices[w1];

        const ws = getPrecedingWhitespace(tokens1, t1Indices, w1, lastT1);
        htmlParts.push(ws);

        const esc = this.formatter.escapeHtml(tokens1[t1Val]);
        htmlParts.push(`<del class="diff-removed">${esc}</del>`);

        lastT1 = t1Val;
      } else { // added
        const w2 = op.w2Idx!;
        const t2Val = t2Indices[w2];

        const ws = getPrecedingWhitespace(tokens2, t2Indices, w2, lastT2);
        htmlParts.push(ws);

        const esc = this.formatter.escapeHtml(tokens2[t2Val]);
        htmlParts.push(`<ins class="diff-added">${esc}</ins>`);

        lastT2 = t2Val;
      }
    }

    let trailing = '';
    if (lastT2 < tokens2.length - 1) {
      for (let t = lastT2 + 1; t < tokens2.length; t++) {
        trailing += tokens2[t];
      }
    } else if (lastT1 < tokens1.length - 1) {
      for (let t = lastT1 + 1; t < tokens1.length; t++) {
        trailing += tokens1[t];
      }
    }
    htmlParts.push(trailing);

    return htmlParts.join('');
  }
}