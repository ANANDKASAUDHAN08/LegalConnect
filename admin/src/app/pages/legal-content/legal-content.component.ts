import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { CreateActModalComponent } from './create-act-modal/create-act-modal.component';
import { EditActModalComponent } from './edit-act-modal/edit-act-modal.component';
import { BareAct } from './legal-content.models';
import {
  getCategoryTheme,
  getDensityBadge,
  getEraBadgeInfo,
  getChapterLabel,
  getSectionLabel,
  getSectionCount,
  getChapterCount,
  formatActCitation,
  CategoryTheme,
  DensityBadge,
  EraBadgeInfo
} from './legal-content.utils';

interface IndexedAct {
  act: BareAct;
  cleanShortName: string;
  cleanActName: string;
  cleanDesc: string;
  yearStr: string;
  categoryStr: string;
  aliases: string[];
}

@Component({
  selector: 'admin-legal-content',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SkeletonComponent,
    TooltipDirective,
    SelectComponent,
    CreateActModalComponent,
    EditActModalComponent
  ],
  templateUrl: './legal-content.component.html',
  styleUrl: './legal-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalContentComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInputEl?: ElementRef<HTMLInputElement>;

  private destroy$ = new Subject<void>();

  acts: BareAct[] = [];
  indexedActs: IndexedAct[] = [];

  /** Server-driven dynamic alias lookup map (O(1) resolution populated from backend payload) */
  dynamicAliasMap = new Map<string, string>();

  isLoading = false;
  searchQuery = '';
  yearFilter: 'all' | 'new' | 'historical' = 'all';
  categoryFilter = 'All';
  sortBy: '' | 'relevance' | 'name' | 'year-desc' | 'year-asc' | 'chapters-desc' | 'sections-desc' = '';

  /** Telemetry: search execution time in milliseconds */
  searchLatencyMs = 0;

  /** Cached filtered+sorted array — recomputed via recomputeFilteredActs() */
  _filteredActs: BareAct[] = [];

  // Pre-computed metric counts (calculated once per data load to prevent CD getter thrashing)
  totalActsCount = 0;
  totalChaptersCount = 0;
  totalSectionsCount = 0;
  filteredCount = 0;

  // Pagination
  displayCount = 30;
  readonly PAGE_SIZE = 30;

  // Modal Control States
  isCreateModalOpen = false;
  editingAct: BareAct | null = null;

  sortOptions: SelectOption[] = [
    { label: 'Relevance / Best Match', value: 'relevance' },
    { label: 'Name (A-Z)', value: '' },
    { label: 'Year (Newest First)', value: 'year-desc' },
    { label: 'Year (Oldest First)', value: 'year-asc' },
    { label: 'Most Chapters', value: 'chapters-desc' },
    { label: 'Most Sections', value: 'sections-desc' }
  ];

  categoryOptions: string[] = [
    'All',
    'CRIMINAL',
    'CIVIL',
    'COMMERCIAL',
    'CONSTITUTIONAL',
    'FINANCIAL',
    'LABOUR',
    'ENVIRONMENTAL',
    'FAMILY',
    'PROPERTY',
    'IP',
    'SPECIAL'
  ];

  quickTags: string[] = [
    'AOSAIR2',
    'BNS',
    'IPC',
    'CrPC',
    'Aadhaar',
    'BSA',
    'RTI',
    'GST'
  ];

  /** Dynamic distribution count map per category */
  categoryCountsMap: { [key: string]: number } = {};

  /** Set of favorited act shortNames persisted in localStorage and backend API */
  favoritesSet = new Set<string>();

  /** Whether to show only pinned favorite acts */
  showFavoritesOnly = false;

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialogService: DialogService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.loadFavorites();
    this.fetchActs();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Keyboard Shortcuts: Press '/' to focus search box, 'Esc' to clear search.
   */
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

    if (event.key === '/' && !isInput) {
      event.preventDefault();
      this.searchInputEl?.nativeElement?.focus();
    } else if (event.key === 'Escape' && this.searchQuery) {
      this.clearSearch();
    }
  }

  fetchActs(): void {
    this.isLoading = true;
    this.displayCount = this.PAGE_SIZE;
    this.cdr.markForCheck();

    this.api.getActs()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.isLoading = false;
          const rawActs = Array.isArray(res) ? res : (res?.data || res?.acts || res?.items || []);
          const countsMap: { [key: string]: number } = { All: 0 };
          this.acts = rawActs.map((act: any, idx: number) => {
            const shortName = String(act.shortName || act.short_name || `ACT-${idx + 1}`);
            const actName = String(act.actName || act.name || act.title || 'Untitled Act');
            const year = Number(act.year) || 0;
            const _id = String(act._id || act.id || `${shortName}_${year}_${idx}`);
            const chCount = Number(act.chapterCount ?? (act.chapters?.length || 0));
            const secCount = act.sectionCount !== undefined && act.sectionCount !== null
              ? Number(act.sectionCount) || 0
              : (act.chapters && Array.isArray(act.chapters) ? act.chapters.reduce((acc: number, ch: any) => acc + (ch?.sections?.length || 0), 0) : 0);

            const categoryUpper = act.category ? String(act.category).toUpperCase().trim() : '';
            countsMap['All'] = (countsMap['All'] || 0) + 1;
            if (categoryUpper) {
              countsMap[categoryUpper] = (countsMap[categoryUpper] || 0) + 1;
            }

            return {
              ...act,
              _id,
              actName,
              shortName,
              year,
              cachedChapterCount: chCount,
              cachedSectionCount: secCount
            };
          });

          this.categoryCountsMap = countsMap;

          // Build pre-computed indexed acts using server-driven dynamic aliases
          this.buildSearchIndex();

          // Compute global metrics once on data change
          this.totalActsCount = this.acts.length;
          this.totalChaptersCount = this.acts.reduce((sum, act) => sum + (act.cachedChapterCount || 0), 0);
          this.totalSectionsCount = this.acts.reduce((sum, act) => sum + (act.cachedSectionCount || 0), 0);

          this.recomputeFilteredActs();
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoading = false;
          this.toast.error('Failed to load Bare Acts directory.');
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Pre-compiles search tokens & server-driven aliases into an in-memory index for sub-1ms search.
   */
  private buildSearchIndex(): void {
    this.dynamicAliasMap.clear();

    this.indexedActs = this.acts.map(act => {
      const cleanShort = (act.shortName || '').toUpperCase();
      const aliases = new Set<string>();

      if (cleanShort) aliases.add(cleanShort);

      if (act.act_code) {
        const codeUpper = act.act_code.toUpperCase();
        aliases.add(codeUpper);
        if (codeUpper !== cleanShort) {
          this.dynamicAliasMap.set(codeUpper, cleanShort);
        }
      }

      if (act.legacy_short_names && Array.isArray(act.legacy_short_names)) {
        act.legacy_short_names.forEach(l => {
          const legacyUpper = String(l).toUpperCase().trim();
          if (legacyUpper) {
            aliases.add(legacyUpper);
            if (legacyUpper !== cleanShort) {
              this.dynamicAliasMap.set(legacyUpper, cleanShort);
            }
          }
        });
      }

      return {
        act,
        cleanShortName: cleanShort,
        cleanActName: (act.actName || '').toLowerCase(),
        cleanDesc: (act.description || '').toLowerCase(),
        yearStr: String(act.year || ''),
        categoryStr: (act.category || '').toUpperCase(),
        aliases: Array.from(aliases)
      };
    });
  }

  /** Recompute the cached filtered+sorted list with relevance scoring & latency telemetry */
  recomputeFilteredActs(): void {
    const startMs = performance.now();
    let scoredItems: { act: BareAct; score: number }[] = [];
    const qRaw = (this.searchQuery || '').trim();
    const q = qRaw.toLowerCase();
    const qUpper = qRaw.toUpperCase();

    // Determine target code dynamically if query matches a server-provided legacy alias
    const targetAliasClean = this.dynamicAliasMap.get(qUpper) || null;

    for (const item of this.indexedActs) {
      const { act, cleanShortName, cleanActName, cleanDesc, yearStr, categoryStr, aliases } = item;

      // 1. Category Filter Check
      if (this.categoryFilter !== 'All' && categoryStr !== this.categoryFilter) {
        continue;
      }

      // 2. Year Filter Check
      const y = Number(act.year) || 0;
      if (this.yearFilter === 'new' && y < 2000) continue;
      if (this.yearFilter === 'historical' && y >= 2000) continue;

      // 2.5 Favorites / Pinned Filter Check
      if (this.showFavoritesOnly && !this.isFavorite(act.shortName)) {
        continue;
      }

      // 3. Search Relevance Scoring
      if (!q) {
        scoredItems.push({ act, score: 0 });
        continue;
      }

      let score = 0;

      // Tier 1: Exact alias or shortName match (e.g. AOSAIR2 or ASIR) -> 1000 pts
      if (cleanShortName === qUpper || (targetAliasClean && cleanShortName === targetAliasClean)) {
        score += 1000;
      } else if (aliases.some(a => a === qUpper)) {
        score += 950;
      } else if (cleanShortName.startsWith(qUpper) || aliases.some(a => a.startsWith(qUpper))) {
        score += 800;
      }

      // Tier 2: Act Name matches
      if (cleanActName === q) {
        score += 900;
      } else if (cleanActName.startsWith(q)) {
        score += 600;
      } else if (cleanActName.includes(q)) {
        score += 400;
      }

      // Tier 3: Year match
      if (yearStr === qUpper) {
        score += 300;
      }

      // Tier 4: Category / Tag match
      if (categoryStr && categoryStr.includes(qUpper)) {
        score += 250;
      }

      // Tier 5: Description match
      if (cleanDesc && cleanDesc.includes(q)) {
        score += 100;
      }

      if (score > 0) {
        scoredItems.push({ act, score });
      }
    }

    // 4. Sorting logic
    const activeSort = this.sortBy || (q ? 'relevance' : 'name');

    scoredItems.sort((a, b) => {
      if (activeSort === 'relevance' && a.score !== b.score) {
        return b.score - a.score;
      }
      switch (activeSort) {
        case 'year-desc':
          return (Number(b.act.year) || 0) - (Number(a.act.year) || 0);
        case 'year-asc':
          return (Number(a.act.year) || 0) - (Number(b.act.year) || 0);
        case 'chapters-desc':
          return this.getChapterCount(b.act) - this.getChapterCount(a.act);
        case 'sections-desc':
          return this.getSectionCount(b.act) - this.getSectionCount(a.act);
        case 'name':
        default: {
          const nameA = String(a.act.actName || '');
          const nameB = String(b.act.actName || '');
          return nameA.localeCompare(nameB);
        }
      }
    });

    this._filteredActs = scoredItems.map(item => item.act);
    this.filteredCount = this._filteredActs.length;
    this.searchLatencyMs = Math.round((performance.now() - startMs) * 10) / 10;
  }

  /** Helper to return legacy alias match badge if user searched a legacy code (e.g. AOSAIR2 for ASIR) */
  getMatchedAlias(act: BareAct): string | null {
    if (!this.searchQuery) return null;
    const qUpper = this.searchQuery.trim().toUpperCase();
    if (!qUpper) return null;

    if (act.shortName.toUpperCase() !== qUpper) {
      const mappedClean = this.dynamicAliasMap.get(qUpper);
      if (mappedClean && mappedClean === act.shortName.toUpperCase()) {
        return qUpper;
      }
      if (act.legacy_short_names && act.legacy_short_names.some(l => String(l).toUpperCase() === qUpper)) {
        return qUpper;
      }
    }
    return null;
  }

  get visibleActs(): BareAct[] {
    return this._filteredActs.slice(0, this.displayCount);
  }

  get hasMoreActs(): boolean {
    return this.displayCount < this._filteredActs.length;
  }

  get remainingCount(): number {
    return Math.max(0, this._filteredActs.length - this.displayCount);
  }

  loadMore(): void {
    this.displayCount += this.PAGE_SIZE;
    this.cdr.markForCheck();
  }

  applyQuickTag(tag: string): void {
    this.searchQuery = tag;
    this.displayCount = this.PAGE_SIZE;
    this.recomputeFilteredActs();
    this.toast.info(`Quick filter applied: '${tag}'`);
    this.cdr.markForCheck();
  }

  selectCategory(category: string): void {
    this.categoryFilter = category;
    if (category !== 'All') {
      // Auto-exit Pinned mode when selecting a specific category domain
      this.showFavoritesOnly = false;
    }
    this.displayCount = this.PAGE_SIZE;
    this.recomputeFilteredActs();
    if (category !== 'All') {
      this.toast.info(`Category filter set to: ${category}`);
    } else {
      this.toast.info('Showing all legal categories');
    }
    this.cdr.markForCheck();
  }

  getSectionCount(act: BareAct): number {
    return getSectionCount(act);
  }

  getChapterCount(act: BareAct): number {
    return getChapterCount(act);
  }

  getChapterLabel(act: BareAct): string {
    return getChapterLabel(act, this.getChapterCount(act));
  }

  getSectionLabel(act: BareAct): string {
    return getSectionLabel(act, this.getSectionCount(act));
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.searchQuery ||
      this.yearFilter !== 'all' ||
      this.categoryFilter !== 'All' ||
      this.showFavoritesOnly ||
      (this.sortBy && this.sortBy !== 'name')
    );
  }

  removeSearchQuery(): void {
    this.searchQuery = '';
    this.onSearchChange();
    this.toast.info('Search query cleared.');
  }

  removeYearFilter(): void {
    this.yearFilter = 'all';
    this.onSearchChange();
    this.toast.info('Era filter reset to All.');
  }

  removeCategoryFilter(): void {
    this.categoryFilter = 'All';
    this.onSearchChange();
    this.toast.info('Category filter reset to All.');
  }

  removeSortFilter(): void {
    this.sortBy = 'name';
    this.onSearchChange();
    this.toast.info('Sort order reset to default.');
  }

  removeFavoritesFilter(): void {
    this.showFavoritesOnly = false;
    this.yearFilter = 'all';
    this.categoryFilter = 'All';
    this.onSearchChange();
    this.toast.info('Showing all statutory acts.');
  }

  toggleFavoritesFilter(): void {
    this.showFavoritesOnly = !this.showFavoritesOnly;
    if (this.showFavoritesOnly) {
      // Reset era AND domain category filters so Pinned mode shows ALL pinned acts cleanly!
      this.yearFilter = 'all';
      this.categoryFilter = 'All';
    }
    this.displayCount = this.PAGE_SIZE;
    this.recomputeFilteredActs();
    if (this.showFavoritesOnly) {
      this.toast.info(`Showing ${this.favoritesSet.size} pinned favorite acts`);
    } else {
      this.toast.info('Showing all statutory acts');
    }
    this.cdr.markForCheck();
  }

  getSortOptionLabel(val: string): string {
    const opt = this.sortOptions.find(o => o.value === val);
    return opt ? opt.label : val;
  }

  copyShortCode(shortName: string, event: Event): void {
    event.stopPropagation();
    if (!shortName) return;
    navigator.clipboard.writeText(shortName).then(() => {
      this.toast.success(`Copied short code '${shortName}' to clipboard!`);
    }).catch(() => {
      this.toast.info(`Short code: ${shortName}`);
    });
  }

  trackByAct(index: number, act: BareAct): string {
    return act._id || act.shortName || String(index);
  }

  getEraClass(year: number): string {
    const y = Number(year) || 0;
    if (!y) return 'era-historical';
    if (y >= 2020) return 'era-modern';
    if (y >= 2000) return 'era-recent';
    return 'era-historical';
  }

  getEraLabel(year: number): string {
    const y = Number(year) || 0;
    if (!y) return 'Historical';
    if (y >= 2020) return 'Modern';
    if (y >= 2000) return 'Contemporary';
    if (y >= 1950) return 'Post-Independence';
    return 'Pre-Independence';
  }

  // ═══ Hyper-Premium Card Design Helpers (Delegated to legal-content.utils.ts) ═══

  copyCitation(act: BareAct, event: Event): void {
    event.stopPropagation();
    const citation = formatActCitation(act);
    navigator.clipboard.writeText(citation).then(() => {
      this.toast.success(`Copied citation for '${act.shortName}' to clipboard!`);
    }).catch(() => {
      this.toast.info(`Citation: ${citation}`);
    });
  }

  toggleFavorite(shortName: string, event: Event): void {
    event.stopPropagation();
    if (!shortName) return;
    const isFav = this.favoritesSet.has(shortName);
    if (isFav) {
      this.favoritesSet.delete(shortName);
      this.toast.info(`Unpinned '${shortName}' from favorites.`);
    } else {
      this.favoritesSet.add(shortName);
      this.toast.success(`Pinned '${shortName}' to quick access favorites!`);
    }
    this.saveFavorites();
    if (this.showFavoritesOnly) {
      this.recomputeFilteredActs();
    }
    this.cdr.markForCheck();

    // Async backend API sync
    this.api.toggleFavorite(shortName).subscribe({
      next: (res: any) => {
        if (res && res.favorites && Array.isArray(res.favorites)) {
          this.favoritesSet = new Set(res.favorites);
          // Backend synced: clear local storage cache once server has persisted
          localStorage.removeItem('legalconnect_favorites');
          this.cdr.markForCheck();
        }
      },
      error: (err: any) => console.warn('Failed to sync favorite to backend server:', err)
    });
  }

  isFavorite(shortName: string): boolean {
    return this.favoritesSet.has(shortName);
  }

  private loadFavorites(): void {
    try {
      const stored = localStorage.getItem('legalconnect_favorites');
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          this.favoritesSet = new Set(arr);
        }
      }
    } catch (e) {
      console.error('Failed to load favorites from localStorage', e);
    }

    // Async backend favorites sync (Ground Truth)
    this.api.getFavorites().subscribe({
      next: (res: any) => {
        if (res && res.success && Array.isArray(res.data)) {
          this.favoritesSet = new Set(res.data);
          // Backend synced: clear local storage cache once server has responded
          localStorage.removeItem('legalconnect_favorites');
          this.recomputeFilteredActs();
          this.cdr.markForCheck();
        }
      },
      error: (err: any) => console.warn('Backend favorites sync unavailable:', err)
    });
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem('legalconnect_favorites', JSON.stringify(Array.from(this.favoritesSet)));
    } catch (e) {
      console.error('Failed to save favorites to localStorage', e);
    }
  }

  getCategoryTheme(act: BareAct): CategoryTheme {
    return getCategoryTheme(act);
  }

  getDensityBadge(act: BareAct): DensityBadge {
    return getDensityBadge(this.getSectionCount(act));
  }

  getEraBadgeInfo(year: number): EraBadgeInfo {
    return getEraBadgeInfo(year);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.yearFilter = 'all';
    this.categoryFilter = 'All';
    this.sortBy = 'name';
    this.displayCount = this.PAGE_SIZE;
    this.recomputeFilteredActs();
    this.toast.info('All search, category, and sort filters cleared.');
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.displayCount = this.PAGE_SIZE;
    this.recomputeFilteredActs();
    this.cdr.markForCheck();
  }

  // --- Modal Open/Close Controls ---
  openCreateModal(): void {
    this.isCreateModalOpen = true;
    this.cdr.markForCheck();
  }

  closeCreateModal(): void {
    this.isCreateModalOpen = false;
    this.cdr.markForCheck();
  }

  handleActCreated(): void {
    this.isCreateModalOpen = false;
    this.fetchActs();
  }

  openEditMetaModal(act: BareAct, event: Event): void {
    event.stopPropagation();
    this.editingAct = act;
    this.cdr.markForCheck();
  }

  closeEditMetaModal(): void {
    this.editingAct = null;
    this.cdr.markForCheck();
  }

  handleActUpdated(): void {
    this.editingAct = null;
    this.fetchActs();
  }

  // --- Global Dialog for Deletion ---
  async confirmDeleteAct(act: BareAct, event: Event): Promise<void> {
    event.stopPropagation();
    const shortName = act.shortName;
    const chapters = this.getChapterCount(act);
    const sections = this.getSectionCount(act);

    const confirmed = await this.dialogService.danger(
      'Delete Act Permanently?',
      `Are you sure you want to delete "${act.actName}" (${shortName})? ${chapters} chapters and ${sections} sections will be permanently removed. This action cannot be undone.`
    );

    if (!confirmed) return;

    this.api.deleteAct(shortName)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(`Act '${shortName}' deleted permanently.`);
          this.fetchActs();
        },
        error: (err: any) => {
          this.toast.error(err?.error?.message || 'Failed to delete act.');
          this.cdr.markForCheck();
        }
      });
  }

  openActDetail(shortName: string, inNewTab = true): void {
    if (inNewTab) {
      window.open(`/legal-content/${shortName}`, '_blank');
    } else {
      this.router.navigate(['/legal-content', shortName]);
    }
  }
}