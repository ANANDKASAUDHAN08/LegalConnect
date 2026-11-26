import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  ViewChild,
  ViewChildren,
  QueryList,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  PracticeAreasService,
  PracticeArea
} from '../../services/practice-areas.service';
import { PrintService } from '../../services/print.service';
import { PrintExportService, ExportExecutionParams, ExportScopeOption } from '../../services/print-export.service';
import { DataExportService } from '../../services/data-export.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../../components/icon/icon.component';
import { CustomSelectComponent, SelectOption } from '../../components/custom-select';
import { SpecializationCardComponent } from './components/specialization-card/specialization-card.component';
import { SpecializationDetailDrawerComponent, DrawerTab } from './components/specialization-detail-drawer/specialization-detail-drawer.component';
import { SpecializationCompareModalComponent } from './components/specialization-compare-modal/specialization-compare-modal.component';
import { PaginationComponent } from '../../components/pagination';
import { SpecializationPrintBuilder } from './specialization-print.builder';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { Title, Meta } from '@angular/platform-browser';

/** Category → gradient + icon tint color mapping */
export interface CategoryColorTheme {
  gradientFrom: string;
  gradientTo: string;
  iconTint: string;
  borderAccent: string;
  bgAccent: string;
  topBarGradient: string;
  categoryTagClass: string;
}

export interface ProblemShortcut {
  id: string;
  icon: string;
  label: string;
  label_hi: string;
  targetQuery: string;
  targetCategory?: string;
  badgeText?: string;
}

export const CATEGORY_COLOR_MAP: Record<string, CategoryColorTheme> = {
  'Criminal Justice': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-rose-500/70 via-red-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Real Estate & Property': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-emerald-500/70 via-teal-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Technology & Privacy': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-cyan-500/70 via-blue-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Personal & Family Relations': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-rose-500/70 via-pink-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Corporate & Commercial': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-blue-500/70 via-indigo-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Consumer & Trade': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-amber-500/70 via-yellow-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Commercial & Banking': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-teal-500/70 via-cyan-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Employment & Labor': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-violet-500/70 via-purple-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Constitutional & Writ': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-indigo-500/70 via-blue-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Family & Personal Law': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-rose-500/70 via-pink-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Taxation': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-amber-500/70 via-orange-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Intellectual Property': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-purple-500/70 via-pink-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  },
  'Insurance & Claims': {
    gradientFrom: 'from-blue-500/10',
    gradientTo: 'to-indigo-500/5',
    iconTint: 'text-blue-600 dark:text-blue-400',
    borderAccent: 'border-slate-200/80 dark:border-white/10',
    bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
    topBarGradient: 'from-teal-500/70 via-emerald-500/40 to-transparent',
    categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
  }
};

const DEFAULT_THEME: CategoryColorTheme = {
  gradientFrom: 'from-blue-500/10',
  gradientTo: 'to-indigo-500/5',
  iconTint: 'text-blue-600 dark:text-blue-400',
  borderAccent: 'border-slate-200/80 dark:border-white/10',
  bgAccent: 'bg-slate-100 dark:bg-white/[0.05]',
  topBarGradient: 'from-blue-500/70 via-indigo-500/40 to-transparent',
  categoryTagClass: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border-slate-200/80 dark:border-white/10'
};

@Component({
  selector: 'app-specializations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TooltipDirective,
    IconComponent,
    CustomSelectComponent,
    SpecializationCardComponent,
    SpecializationDetailDrawerComponent,
    SpecializationCompareModalComponent,
    PaginationComponent
  ],
  templateUrl: './specializations.component.html',
  styleUrls: ['./specializations.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpecializationsComponent implements OnInit, OnDestroy, AfterViewInit {
  practiceService = inject(PracticeAreasService);
  private printService = inject(PrintService);
  private printExportService = inject(PrintExportService);
  private dataExportService = inject(DataExportService);
  private snackbar = inject(SnackbarService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private title = inject(Title);
  private meta = inject(Meta);
  private destroyRef = inject(DestroyRef);

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('stickySentinel') sentinelRef?: ElementRef<HTMLDivElement>;
  @ViewChild('moreFilterContainerRef') moreFilterContainerRef?: ElementRef<HTMLDivElement>;
  @ViewChildren(CustomSelectComponent) customSelectComponents?: QueryList<CustomSelectComponent>;

  private sentinelObserver?: IntersectionObserver;

  // ── Problem-to-Discipline Quick Matchers (MNC Standard) ──
  readonly problemShortcuts: ProblemShortcut[] = [
    {
      id: 'bail',
      icon: 'key',
      label: 'Arrest & Immediate Bail',
      label_hi: 'गिरफ्तारी व तत्काल जमानत',
      targetQuery: 'Bail Matters',
      targetCategory: 'Criminal Justice',
      badgeText: 'Emergency'
    },
    {
      id: 'property',
      icon: 'home',
      label: 'Property & Land Dispute',
      label_hi: 'भूमि व संपत्ति विवाद',
      targetQuery: 'Property Disputes',
      targetCategory: 'Real Estate & Property'
    },
    {
      id: 'divorce',
      icon: 'users',
      label: 'Divorce & Child Custody',
      label_hi: 'तलाक व संतान अभिरक्षा',
      targetQuery: 'Family Law',
      targetCategory: 'Personal & Family Relations'
    },
    {
      id: 'cyber',
      icon: 'shield',
      label: 'Cyber Crime & Online Scam',
      label_hi: 'साइबर अपराध व वित्तीय धोखाधड़ी',
      targetQuery: 'Cyber Crime',
      targetCategory: 'Technology & Privacy',
      badgeText: 'High Demand'
    },
    {
      id: 'corporate',
      icon: 'briefcase',
      label: 'Startup & Company Setup',
      label_hi: 'कंपनी पंजीकरण व कॉर्पोरेट अनुपालन',
      targetQuery: 'Corporate Law',
      targetCategory: 'Corporate & Commercial'
    },
    {
      id: 'banking',
      icon: 'zap',
      label: 'Cheque Bounce & Debt Recovery',
      label_hi: 'चेक बाउंस व ऋण वसूली',
      targetQuery: 'Banking',
      targetCategory: 'Commercial & Banking'
    }
  ];

  // ── Custom Select Options ──
  readonly sortOptions: SelectOption<'popular' | 'alpha-asc' | 'alpha-desc' | 'advocates' | 'experience' | 'rating'>[] = [
    { value: 'popular', label: 'Popular', icon: 'star' },
    { value: 'advocates', label: 'Most Advocates', icon: 'users' },
    { value: 'experience', label: 'Highest Experience', icon: 'briefcase' },
    { value: 'rating', label: 'Highest Rating', icon: 'award' },
    { value: 'alpha-asc', label: 'A to Z', icon: 'sort-asc' },
    { value: 'alpha-desc', label: 'Z to A', icon: 'sort-desc' }
  ];

  readonly pageSizeOptions: SelectOption<number>[] = [
    { value: 12, label: '12 / page' },
    { value: 24, label: '24 / page' },
    { value: 999, label: 'All areas' }
  ];

  readonly ratingOptions: SelectOption<number | null>[] = [
    { value: null, label: 'Any Rating' },
    { value: 4, label: '4.0+ Stars' },
    { value: 4.5, label: '4.5+ Stars' }
  ];

  readonly feeOptions: SelectOption<string>[] = [
    { value: 'all', label: 'All Fees' },
    { value: '0-2000', label: '₹0 – ₹2,000' },
    { value: '2000-5000', label: '₹2,000 – ₹5,000' },
    { value: '5000+', label: '₹5,000+' }
  ];

  readonly experienceOptions: SelectOption<number | null>[] = [
    { value: null, label: 'Any Experience' },
    { value: 5, label: '5+ Years' },
    { value: 10, label: '10+ Years' },
    { value: 15, label: '15+ Years' }
  ];

  // ── Dynamic City Options Computed from Practice Areas ──
  availableCities = computed(() => {
    const areas = this.practiceService.practiceAreas();
    const citySet = new Set<string>();
    areas.forEach(a => {
      (a.topCities || []).forEach(tc => {
        if (tc.city) citySet.add(tc.city.trim());
      });
    });
    const list = Array.from(citySet).sort();
    const options: SelectOption<string>[] = [
      { value: 'all', label: 'All Jurisdictions', icon: 'map-pin' },
      ...list.map(c => ({ value: c, label: c + ' Jurisdiction', icon: 'map-pin' }))
    ];
    return options;
  });

  // ── Practice Area / Category Select Options for Command Deck Dropdown ──
  categorySelectOptions = computed<SelectOption<string>[]>(() => {
    const cats = this.practiceService.categories();
    if (!cats || cats.length === 0) {
      return [{ value: 'All', label: 'All Areas', icon: 'briefcase' }];
    }
    return cats.map(c => ({
      value: c.name,
      label: c.name === 'All' ? 'All Areas' : c.name,
      count: c.count,
      icon: 'briefcase'
    }));
  });

  // ── Search & Filter State ──
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('All');
  selectedSort = signal<'popular' | 'alpha-asc' | 'alpha-desc' | 'advocates' | 'experience' | 'rating'>('popular');
  viewMode = signal<'grid' | 'grouped' | 'compact'>('grid');
  targetCardHighlight = signal<string>('');

  // ── Advanced Filters (Including City & Available Now) ──
  minRating = signal<number | null>(null);         // null = any, 4, 4.5
  feeRangeFilter = signal<string>('all');           // 'all', '0-2000', '2000-5000', '5000+'
  minExperience = signal<number | null>(null);      // null, 5, 10, 15
  selectedCity = signal<string>('all');             // 'all' or city name
  onlyAvailableNow = signal<boolean>(false);       // true = only with on-call lawyers
  activeProblemShortcut = signal<string | null>(null);

  // ── Pagination ──
  currentPage = signal(1);
  pageSize = signal(12);

  // ── Hindi toggle ──
  isHindi = signal<boolean>(false);

  // ── Detail Drawer state ──
  drawerOpen = signal<boolean>(false);
  selectedSpec = signal<PracticeArea | null>(null);
  drawerLoading = signal<boolean>(false);
  activeDrawerTab = signal<DrawerTab>('overview');

  // ── Compare Tray (pin up to 3) ──
  pinnedSpecs = signal<PracticeArea[]>([]);
  isCompareOpen = signal<boolean>(false);

  // ── Mobile Filter Drawer ──
  isMobileFilterOpen = signal<boolean>(false);

  // ── Desktop Filter Shelf (Integrated in sticky deck for big screens) ──
  isFilterShelfOpen = signal<boolean>(false);

  // ── Desktop Filter Popover (Floating card on desktop >= lg) ──
  isDesktopFilterOpen = signal<boolean>(false);

  // ── Filter Bar Sticky (Calculated via 0-CPU IntersectionObserver) ──
  isFilterBarSticky = signal<boolean>(false);

  // ── Search & Zero-result subjects ──
  private searchSubject = new Subject<string>();
  private detailSubject = new Subject<string>();
  private zeroResultSubject = new Subject<string>();

  // ── Active filter count (Total) ──
  activeFilterCount = computed(() => {
    let count = 0;
    if (this.selectedCategory() !== 'All') count++;
    if (this.searchQuery().trim()) count++;
    if (this.selectedSort() !== 'popular') count++;
    if (this.minRating() !== null) count++;
    if (this.feeRangeFilter() !== 'all') count++;
    if (this.minExperience() !== null) count++;
    if (this.selectedCity() !== 'all') count++;
    if (this.onlyAvailableNow()) count++;
    return count;
  });

  // ── Secondary granular filters count (for the consolidated "Filters" button badge) ──
  activeSecondaryFilterCount = computed(() => {
    let count = 0;
    if (this.selectedCity() !== 'all') count++;
    if (this.minRating() !== null) count++;
    if (this.feeRangeFilter() !== 'all') count++;
    if (this.minExperience() !== null) count++;
    return count;
  });

  // ── Has active non-search faceted filters ──
  hasActiveFacetedFilters = computed(() => {
    return this.selectedCategory() !== 'All' ||
      this.selectedCity() !== 'all' ||
      this.onlyAvailableNow() ||
      this.minRating() !== null ||
      this.feeRangeFilter() !== 'all' ||
      this.minExperience() !== null ||
      this.activeProblemShortcut() !== null;
  });

  // ── Computed filtered list (Optimized with City & Emergency Filters) ──
  filteredPracticeAreas = computed(() => {
    let list = this.practiceService.practiceAreas();
    const cat = this.selectedCategory();
    const query = this.searchQuery().toLowerCase().trim();
    const sort = this.selectedSort();
    const minRat = this.minRating();
    const feeRange = this.feeRangeFilter();
    const minExp = this.minExperience();
    const city = this.selectedCity();
    const availableOnly = this.onlyAvailableNow();

    // 1. Category filter
    if (cat !== 'All') {
      list = list.filter(p => p.category.toLowerCase() === cat.toLowerCase());
    }

    // 2. City / Jurisdiction filter
    if (city !== 'all') {
      const cityLower = city.toLowerCase();
      list = list.filter(p => p.topCities?.some(c => c.city.toLowerCase() === cityLower));
    }

    // 3. Emergency / Available Now filter
    if (availableOnly) {
      list = list.filter(p => (p.availableNow || 0) > 0);
    }

    // 4. Text search
    if (query) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.name_hi && p.name_hi.includes(query)) ||
        p.description.toLowerCase().includes(query) ||
        (p.tagline && p.tagline.toLowerCase().includes(query)) ||
        p.category.toLowerCase().includes(query) ||
        p.subfields.some(s => s.toLowerCase().includes(query)) ||
        p.relevantActs?.some(a => a.toLowerCase().includes(query)) ||
        p.typicalForums?.some(f => f.toLowerCase().includes(query)) ||
        p.aliases?.some(a => a.toLowerCase().includes(query))
      );
    }

    // 5. Rating filter
    if (minRat !== null) {
      list = list.filter(p => (p.avgRating || 0) >= minRat);
    }

    // 6. Fee range filter
    if (feeRange !== 'all') {
      list = list.filter(p => {
        const median = p.feeRange?.median || 0;
        if (feeRange === '0-2000') return median <= 2000;
        if (feeRange === '2000-5000') return median > 2000 && median <= 5000;
        if (feeRange === '5000+') return median > 5000;
        return true;
      });
    }

    // 7. Experience filter
    if (minExp !== null) {
      list = list.filter(p => (p.avgExperience || 0) >= minExp);
    }

    // 8. Sorting
    const sorted = [...list];
    if (sort === 'alpha-asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'alpha-desc') {
      sorted.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sort === 'advocates') {
      sorted.sort((a, b) => (b.advocateCount || 0) - (a.advocateCount || 0));
    } else if (sort === 'experience') {
      sorted.sort((a, b) => (b.avgExperience || 0) - (a.avgExperience || 0));
    } else if (sort === 'rating') {
      sorted.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
    } else {
      // Default: Popular first, then advocate count
      sorted.sort((a, b) => {
        if (a.popular && !b.popular) return -1;
        if (!a.popular && b.popular) return 1;
        return (b.advocateCount || 0) - (a.advocateCount || 0);
      });
    }

    return sorted;
  });

  // ── Paginated list ──
  paginatedAreas = computed(() => {
    const filtered = this.filteredPracticeAreas();
    const start = (this.currentPage() - 1) * this.pageSize();
    return filtered.slice(start, start + this.pageSize());
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredPracticeAreas().length / this.pageSize()))
  );

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | '...')[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');

      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });

  paginationStart = computed(() => {
    const filtered = this.filteredPracticeAreas().length;
    if (filtered === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  paginationEnd = computed(() => {
    const filtered = this.filteredPracticeAreas().length;
    return Math.min(this.currentPage() * this.pageSize(), filtered);
  });

  // ── Grouped by Category computed signal ──
  groupedPracticeAreas = computed(() => {
    const list = this.filteredPracticeAreas();
    const map = new Map<string, PracticeArea[]>();

    list.forEach(item => {
      const existing = map.get(item.category) || [];
      existing.push(item);
      map.set(item.category, existing);
    });

    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      items
    }));
  });

  getGroupAdvocatesCount(items: PracticeArea[]): number {
    return items.reduce((sum, item) => sum + (item.advocateCount || 0), 0);
  }

  // ── Summary stats for the hero ribbon ──
  totalAreas = computed(() => this.practiceService.heroSummary().totalAreas || this.practiceService.practiceAreas().length);
  totalAdvocates = computed(() => this.practiceService.heroSummary().totalAdvocates || this.practiceService.practiceAreas().reduce((sum, a) => sum + (a.advocateCount || 0), 0));
  totalCategories = computed(() => this.practiceService.heroSummary().totalCategories || Math.max(0, this.practiceService.categories().length - 1));
  totalActsLinked = computed(() => this.practiceService.heroSummary().totalActsLinked || 0);

  // ── Keyboard shortcut '/' to focus search ──
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) {
      event.preventDefault();
      this.searchInputRef?.nativeElement.focus();
    } else if (event.key === 'Escape') {
      if (this.drawerOpen()) {
        this.closeDrawer();
      } else if (this.isCompareOpen()) {
        this.closeCompare();
      } else if (this.isFilterShelfOpen()) {
        this.closeFilterShelf();
      } else if (this.isDesktopFilterOpen()) {
        this.closeDesktopFilter();
      } else if (this.isMobileFilterOpen()) {
        this.closeMobileFilter();
      }
    }
  }

  // ── Dismiss desktop More Filters popover when clicking outside ──
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isFilterShelfOpen()) return;

    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Do not dismiss if clicking inside the More Filters popover card or trigger
    if (this.moreFilterContainerRef?.nativeElement?.contains(target)) {
      return;
    }

    // Do not dismiss if clicking inside portaled dropdown menu belonging to More Filters (Jurisdiction / City)
    if (target.closest('.more-filter-city-menu')) {
      return;
    }

    // Any other click (e.g. All Areas dropdown, Sort dropdown, search, background) dismisses More Filters
    this.closeFilterShelf();
  }

  ngOnInit() {
    this.title.setTitle('Legal Practice Areas & Specializations Atlas | LegalConnect');
    this.meta.updateTag({
      name: 'description',
      content: 'Explore India\'s comprehensive Legal Practice Atlas covering criminal justice, property disputes, constitutional writs, tax, cybercrime, and find verified advocates.'
    });

    this.injectSeoJsonLd();

    // Debounced search with URL sync
    this.searchSubject.pipe(
      takeUntilDestroyed(this.destroyRef),
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(val => {
      this.searchQuery.set(val);
      this.currentPage.set(1);
      this.syncUrlParams();
      if (val.trim().length >= 3 && this.filteredPracticeAreas().length === 0) {
        this.zeroResultSubject.next(val.trim());
      }
    });

    // Zero-result search logging for admin demand gaps (Guardrail 4)
    this.zeroResultSubject.pipe(
      takeUntilDestroyed(this.destroyRef),
      debounceTime(1500),
      distinctUntilChanged()
    ).subscribe(missQuery => {
      this.practiceService.logSearchMiss(missQuery);
    });

    // Detail dossier loader using switchMap
    this.detailSubject.pipe(
      takeUntilDestroyed(this.destroyRef),
      switchMap(id => {
        this.drawerLoading.set(true);
        return this.practiceService.fetchPracticeAreaDetail(id).pipe(
          catchError(() => of({ success: false, data: null as any }))
        );
      })
    ).subscribe(res => {
      this.drawerLoading.set(false);
      if (res && res.success && res.data) {
        this.selectedSpec.set(res.data);
      }
    });

    // Initial fetch
    this.practiceService.fetchPracticeAreas().subscribe({
      next: () => {
        this.injectSeoJsonLd();
        this.handleInitialQueryParams();
      }
    });
  }

  ngAfterViewInit() {
    // 0-CPU Sticky Header Sentinel using IntersectionObserver
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window && this.sentinelRef?.nativeElement) {
      this.sentinelObserver = new IntersectionObserver(([entry]) => {
        this.isFilterBarSticky.set(!entry.isIntersecting);
      }, { threshold: [0], rootMargin: '-64px 0px 0px 0px' });
      this.sentinelObserver.observe(this.sentinelRef.nativeElement);
    }
  }

  ngOnDestroy() {
    this.sentinelObserver?.disconnect();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('sheet-open');
    }
  }

  private updateBodyScrollLock(): void {
    if (typeof document !== 'undefined') {
      const isAnyOpen = this.drawerOpen() || this.isCompareOpen() || this.isMobileFilterOpen();
      document.body.classList.toggle('sheet-open', isAnyOpen);
    }
  }

  private injectSeoJsonLd() {
    if (typeof document === 'undefined') return;
    try {
      const existing = document.getElementById('specializations-jsonld');
      if (existing) existing.remove();

      const areas = this.practiceService.practiceAreas();
      const itemListElement = areas.slice(0, 30).map((area, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: area.name,
        description: area.description,
        url: `https://legalconnect.in/specializations?area=${encodeURIComponent(area.id)}`
      }));

      const script = document.createElement('script');
      script.id = 'specializations-jsonld';
      script.type = 'application/ld+json';
      script.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'Legal Practice Areas & Specializations Atlas | LegalConnect',
        description: 'Comprehensive taxonomy of Indian legal practice areas, bare acts, and verified advocates.',
        url: 'https://legalconnect.in/specializations',
        about: {
          '@type': 'LegalService',
          name: 'LegalConnect India Legal Network',
          areaServed: 'IN'
        },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: areas.length,
          itemListElement: itemListElement.length > 0 ? itemListElement : undefined
        }
      });
      document.head.appendChild(script);
    } catch { }
  }

  // ── Bug Fix: Robust Deep-Link Resolution with Pagination Page Detection ──
  private handleInitialQueryParams() {
    const params = this.route.snapshot.queryParams;
    if (params['q']) {
      this.searchQuery.set(params['q']);
    }
    if (params['category']) {
      this.selectedCategory.set(params['category']);
    }
    if (params['sort']) {
      this.selectedSort.set(params['sort'] as any);
    }
    if (params['view'] && ['grid', 'grouped', 'compact'].includes(params['view'])) {
      this.viewMode.set(params['view'] as any);
    }
    if (params['page']) {
      const p = parseInt(params['page'], 10);
      if (!isNaN(p) && p > 0) this.currentPage.set(p);
    }
    if (params['rating']) {
      const r = parseFloat(params['rating']);
      if (!isNaN(r)) this.minRating.set(r);
    }
    if (params['fee']) {
      this.feeRangeFilter.set(params['fee']);
    }
    if (params['exp']) {
      const e = parseInt(params['exp'], 10);
      if (!isNaN(e)) this.minExperience.set(e);
    }
    if (params['city']) {
      this.selectedCity.set(params['city']);
    }
    if (params['available'] === 'true') {
      this.onlyAvailableNow.set(true);
    }

    // Area or Name parameter
    const areaParam = params['area'] || params['name'];
    if (areaParam) {
      const cleanParam = String(areaParam).toLowerCase().trim();
      const match = this.practiceService.practiceAreas().find(p =>
        p.id.toLowerCase() === cleanParam || p.name.toLowerCase() === cleanParam
      );

      if (match) {
        if (params['area']) {
          this.openDetail(match);
          if (params['tab'] && ['overview', 'acts', 'cases', 'lawyers', 'journey'].includes(params['tab'])) {
            this.activeDrawerTab.set(params['tab'] as DrawerTab);
          }
        } else {
          this.targetCardHighlight.set(match.name);
          // Calculate page index where card is located
          const idx = this.filteredPracticeAreas().findIndex(p => p.id === match.id);
          if (idx >= 0) {
            const targetPage = Math.floor(idx / this.pageSize()) + 1;
            this.currentPage.set(targetPage);
          }
          setTimeout(() => {
            const el = document.getElementById('spec-card-' + match.id) || document.getElementById(match.id);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 350);
        }
      } else if (params['area']) {
        this.detailSubject.next(params['area']);
        this.drawerOpen.set(true);
        this.updateBodyScrollLock();
      }
    }
  }

  private syncUrlParams() {
    const queryParams: Record<string, string | null> = {
      q: this.searchQuery() || null,
      category: this.selectedCategory() !== 'All' ? this.selectedCategory() : null,
      sort: this.selectedSort() !== 'popular' ? this.selectedSort() : null,
      view: this.viewMode() !== 'grid' ? this.viewMode() : null,
      page: this.currentPage() > 1 ? String(this.currentPage()) : null,
      rating: this.minRating() !== null ? String(this.minRating()) : null,
      fee: this.feeRangeFilter() !== 'all' ? this.feeRangeFilter() : null,
      exp: this.minExperience() !== null ? String(this.minExperience()) : null,
      city: this.selectedCity() !== 'all' ? this.selectedCity() : null,
      available: this.onlyAvailableNow() ? 'true' : null,
      area: this.selectedSpec()?.id || null
    };

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  // ── Search & Filter Methods ──

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchSubject.next('');
    if (this.searchInputRef?.nativeElement) {
      this.searchInputRef.nativeElement.value = '';
    }
    this.syncUrlParams();
  }

  setCategory(category: string) {
    this.selectedCategory.set(category);
    this.currentPage.set(1);
    this.syncUrlParams();
  }

  setSort(sort: 'popular' | 'alpha-asc' | 'alpha-desc' | 'advocates' | 'experience' | 'rating') {
    this.selectedSort.set(sort);
    this.currentPage.set(1);
    this.syncUrlParams();
  }

  setViewMode(mode: 'grid' | 'grouped' | 'compact') {
    this.viewMode.set(mode);
    this.syncUrlParams();
  }

  setMinRating(rating: number | null) {
    this.minRating.set(rating);
    this.currentPage.set(1);
    this.syncUrlParams();
  }

  setFeeRange(range: string) {
    this.feeRangeFilter.set(range);
    this.currentPage.set(1);
    this.syncUrlParams();
  }

  setMinExperience(exp: number | null) {
    this.minExperience.set(exp);
    this.currentPage.set(1);
    this.syncUrlParams();
  }

  setSelectedCity(city: string) {
    this.selectedCity.set(city);
    this.currentPage.set(1);
    this.syncUrlParams();
  }

  toggleAvailableNow() {
    this.onlyAvailableNow.set(!this.onlyAvailableNow());
    this.currentPage.set(1);
    this.syncUrlParams();
  }

  // ── Problem Matcher Pill Click ──
  applyProblemShortcut(shortcut: ProblemShortcut) {
    if (this.activeProblemShortcut() === shortcut.id) {
      // Toggle off
      this.activeProblemShortcut.set(null);
      this.searchQuery.set('');
      this.searchSubject.next('');
    } else {
      this.activeProblemShortcut.set(shortcut.id);
      this.searchQuery.set(shortcut.targetQuery);
      this.searchSubject.next(shortcut.targetQuery);
      if (shortcut.targetCategory && this.selectedCategory() !== 'All' && this.selectedCategory() !== shortcut.targetCategory) {
        this.selectedCategory.set(shortcut.targetCategory);
      }
    }
    this.currentPage.set(1);
    this.syncUrlParams();
  }

  clearAllFilters() {
    this.searchQuery.set('');
    this.searchSubject.next('');
    if (this.searchInputRef?.nativeElement) {
      this.searchInputRef.nativeElement.value = '';
    }
    this.selectedCategory.set('All');
    this.selectedSort.set('popular');
    this.minRating.set(null);
    this.feeRangeFilter.set('all');
    this.minExperience.set(null);
    this.selectedCity.set('all');
    this.onlyAvailableNow.set(false);
    this.activeProblemShortcut.set(null);
    this.currentPage.set(1);
    this.isFilterShelfOpen.set(false);
    this.isDesktopFilterOpen.set(false);
    this.closeMobileFilter();
    this.syncUrlParams();
  }

  clearSecondaryFilters() {
    this.selectedCity.set('all');
    this.minRating.set(null);
    this.feeRangeFilter.set('all');
    this.minExperience.set(null);
    this.currentPage.set(1);
    this.syncUrlParams();
  }

  toggleFilterShelf(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    // Close any open select dropdown menus so only More Filters is open
    this.customSelectComponents?.forEach(select => select.close());

    if (typeof window !== 'undefined' && window.innerWidth >= 640) {
      this.isFilterShelfOpen.update(v => !v);
    } else {
      this.openMobileFilter();
    }
  }

  closeFilterShelf() {
    this.isFilterShelfOpen.set(false);
  }

  toggleFilterPopover() {
    this.toggleFilterShelf();
  }

  closeDesktopFilter() {
    this.closeFilterShelf();
    this.isDesktopFilterOpen.set(false);
  }

  clearFacetedFilters() {
    this.selectedCategory.set('All');
    this.minRating.set(null);
    this.feeRangeFilter.set('all');
    this.minExperience.set(null);
    this.selectedCity.set('all');
    this.onlyAvailableNow.set(false);
    this.activeProblemShortcut.set(null);
    this.currentPage.set(1);
    this.syncUrlParams();
  }

  toggleHindi() {
    this.isHindi.set(!this.isHindi());
  }

  retryLoad() {
    this.practiceService.fetchPracticeAreas(true).subscribe();
  }

  // ── Pagination ──

  goToPage(page: number | '...') {
    if (page === '...') return;
    const p = page as number;
    if (p < 1 || p > this.totalPages()) return;
    this.currentPage.set(p);
    this.syncUrlParams();
    if (typeof window !== 'undefined') {
      const el = document.getElementById('results-anchor');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.goToPage(this.currentPage() + 1);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.goToPage(this.currentPage() - 1);
    }
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.syncUrlParams();
  }

  // ── Category Color Theming ──

  getCategoryTheme(category: string): CategoryColorTheme {
    return CATEGORY_COLOR_MAP[category] || DEFAULT_THEME;
  }

  getDisplayName(spec: PracticeArea): string {
    if (this.isHindi() && spec.name_hi) return spec.name_hi;
    return spec.name;
  }

  // ── Detail Drawer ──
  openDetail(spec: PracticeArea) {
    this.selectedSpec.set(spec);
    this.drawerOpen.set(true);
    this.activeDrawerTab.set('overview');
    this.updateBodyScrollLock();

    // Track view event (Guardrail 4)
    this.practiceService.trackEvent(spec.id, 'view');
    this.detailSubject.next(spec.id);
    this.syncUrlParams();
  }

  closeDrawer() {
    this.drawerOpen.set(false);
    this.selectedSpec.set(null);
    this.updateBodyScrollLock();
    this.syncUrlParams();
  }

  setDrawerTab(tab: DrawerTab) {
    this.activeDrawerTab.set(tab);
  }

  // ── Compare Tray ──
  togglePin(spec: PracticeArea, event?: Event) {
    if (event) event.stopPropagation();

    const current = this.pinnedSpecs();
    const idx = current.findIndex(p => p.id === spec.id);

    if (idx >= 0) {
      this.pinnedSpecs.set(current.filter(p => p.id !== spec.id));
      this.snackbar.show(`Removed "${spec.name}" from comparison tray`, 'info', 2000);
    } else {
      if (current.length >= 3) {
        this.snackbar.show('You can compare up to 3 practice areas simultaneously. Unpin one to add another.', 'warning', 3500);
        return;
      }
      this.pinnedSpecs.set([...current, spec]);
      this.snackbar.show(`Added "${spec.name}" to comparison tray (${current.length + 1}/3)`, 'success', 2500);
    }
  }

  isPinned(spec: PracticeArea): boolean {
    return this.pinnedSpecs().some(p => p.id === spec.id);
  }

  openCompare() {
    if (this.pinnedSpecs().length > 0) {
      this.isCompareOpen.set(true);
      this.updateBodyScrollLock();
    }
  }

  closeCompare() {
    this.isCompareOpen.set(false);
    this.updateBodyScrollLock();
  }

  clearCompare() {
    this.pinnedSpecs.set([]);
    this.closeCompare();
    this.snackbar.show('Comparison tray cleared', 'info', 2000);
  }

  // ── CTA: Find Advocates (Tracked event - Guardrail 4) ──
  findAdvocates(spec: PracticeArea, event?: Event) {
    if (event) event.stopPropagation();

    this.practiceService.trackEvent(spec.id, 'cta');

    this.router.navigate(['/lawyers'], {
      queryParams: {
        practiceArea: spec.id,
        specialization: spec.name
      }
    });
  }

  // ── Print Brief via Centralized Extracted Builder ──
  printAreaBrief(spec: PracticeArea, event?: Event) {
    if (event) event.stopPropagation();
    const target = this.selectedSpec()?.id === spec.id ? this.selectedSpec()! : spec;
    this.snackbar.show(`Preparing official statutory brief for "${target.name}"...`, 'info', 2000);
    SpecializationPrintBuilder.printAreaBrief(target, this.printService, event);
  }

  // ── Universal Practice Areas Print & Export Modal (§6 Catalog Export) ──
  openExportModal(): void {
    const filteredAreas = this.filteredPracticeAreas();
    const allAreas = this.practiceService.practiceAreas();
    const filteredCount = filteredAreas.length;
    const totalCount = allAreas.length;
    const hasFilter = filteredCount !== totalCount;

    const scopes: ExportScopeOption[] = [];
    if (hasFilter) {
      scopes.push({
        id: 'filtered',
        label: `Filtered Disciplines (${filteredCount} Areas)`,
        count: filteredCount,
        description: `Practice areas matching current search, category & filters`
      });
    }

    scopes.push({
      id: 'all',
      label: `Complete Atlas (${totalCount} Areas)`,
      count: totalCount,
      description: `All Indian legal practice areas, statutory frameworks & court forums`
    });

    const defaultScope = hasFilter ? 'filtered' : 'all';

    this.printExportService.open({
      title: 'Practice Areas & Statutory Atlas',
      subtitle: 'Export statutory bare act taxonomies, court forums, and verified advocate statistics.',
      formats: ['pdf', 'csv', 'json', 'txt'],
      scopes,
      defaultScope,
      scopeTitle: 'Atlas Scope',
      scopeUnit: 'discipline',
      allowWatermark: true,
      defaultWatermark: 'OFFICIAL COPY',
      allowQrToggle: false,
      allowChartsToggle: false,
      previewConfig: (params) => {
        const targetAreas = params.scope === 'filtered' ? this.filteredPracticeAreas() : this.practiceService.practiceAreas();
        const scopeLabel = params.scope === 'filtered' ? `Filtered (${targetAreas.length} Areas)` : `Complete Atlas (${targetAreas.length} Areas)`;
        return SpecializationPrintBuilder.buildCatalogPrintConfig(targetAreas, this.printService, scopeLabel, this.isHindi());
      },
      onExport: async (params: ExportExecutionParams) => {
        const targetAreas = params.scope === 'filtered' ? this.filteredPracticeAreas() : this.practiceService.practiceAreas();
        const scopeLabel = params.scope === 'filtered' ? `Filtered-${targetAreas.length}-Areas` : `Complete-Atlas-${targetAreas.length}-Areas`;
        const dateStr = new Date().toISOString().slice(0, 10);

        // 1. PDF
        if (params.format === 'pdf') {
          const displayScope = params.scope === 'filtered' ? `Filtered (${targetAreas.length} Areas)` : `Complete Atlas (${targetAreas.length} Areas)`;
          const printConfig = SpecializationPrintBuilder.buildCatalogPrintConfig(targetAreas, this.printService, displayScope, this.isHindi());
          this.printService.print({
            ...printConfig,
            watermark: params.watermark !== 'NONE' ? params.watermark : undefined,
            classification: params.watermark !== 'NONE' ? params.watermark : 'OFFICIAL COPY',
            paperSize: params.paperSize,
            orientation: params.orientation,
            margins: params.margins,
            customMargins: params.customMargins,
            scale: params.scale,
            colorMode: params.colorMode,
            printQuality: params.printQuality,
            showHeaderFooter: params.showHeaderFooter,
            showBackgroundGraphics: params.showBackgroundGraphics,
            copies: params.copies,
            collate: params.collate,
            duplexPrint: params.duplexPrint,
            tableDensity: params.tableDensity
          });
        }
        // 2. CSV
        else if (params.format === 'csv') {
          const csvRows = targetAreas.map(a => ({
            id: a.id,
            name: a.name,
            name_hi: a.name_hi || '',
            category: a.category,
            tagline: a.tagline || '',
            description: a.description || '',
            subfields: (a.subfields || []).join('; '),
            relevantActs: (a.relevantActs || []).join('; '),
            typicalForums: (a.typicalForums || []).join('; '),
            advocateCount: a.advocateCount || 0,
            avgExperience: a.avgExperience || 0,
            avgRating: a.avgRating || 0,
            minFee: a.feeRange?.min || 0,
            medianFee: a.feeRange?.median || 0,
            maxFee: a.feeRange?.max || 0,
            topCities: (a.topCities || []).map(c => `${c.city} (${c.count})`).join('; ')
          }));

          const headers = [
            { key: 'name', label: 'Practice Area Name' },
            { key: 'name_hi', label: 'Hindi Name' },
            { key: 'category', label: 'Category Domain' },
            { key: 'tagline', label: 'Tagline' },
            { key: 'description', label: 'Statutory Description' },
            { key: 'subfields', label: 'Core Subfields' },
            { key: 'relevantActs', label: 'Governing Bare Acts' },
            { key: 'typicalForums', label: 'Adjudicatory Forums' },
            { key: 'advocateCount', label: 'Verified Counsel' },
            { key: 'avgExperience', label: 'Average Experience (Years)' },
            { key: 'avgRating', label: 'Average Rating' },
            { key: 'minFee', label: 'Min Consultation Fee (INR)' },
            { key: 'medianFee', label: 'Median Fee (INR)' },
            { key: 'maxFee', label: 'Max Fee (INR)' },
            { key: 'topCities', label: 'Top Practice Cities' }
          ];

          const csvContent = this.printExportService.convertToCsv(csvRows, headers);
          this.dataExportService.downloadBlob(
            csvContent,
            'text/csv;charset=utf-8;',
            `LegalConnect-PracticeAreas-${scopeLabel}-${dateStr}.csv`
          );
        }
        // 3. JSON
        else if (params.format === 'json') {
          const payload = {
            registry: 'LegalConnect Indian Practice Areas & Specializations Atlas',
            scope: params.scope === 'filtered' ? 'Filtered Results' : 'Complete Catalog',
            exportedAt: new Date().toISOString(),
            totalRecords: targetAreas.length,
            practiceAreas: targetAreas
          };

          this.dataExportService.downloadBlob(
            JSON.stringify(payload, null, 2),
            'application/json;charset=utf-8;',
            `LegalConnect-PracticeAreas-${scopeLabel}-${dateStr}.json`
          );
        }
        // 4. TXT
        else if (params.format === 'txt') {
          let txt = `========================================================================\n`;
          txt += `        LEGALCONNECT INDIAN PRACTICE AREAS & STATUTORY ATLAS\n`;
          txt += `========================================================================\n`;
          txt += `Scope: ${params.scope === 'filtered' ? 'Filtered Search Results' : 'Complete Taxonomy Catalog'}\n`;
          txt += `Generated On: ${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
          txt += `Total Disciplines: ${targetAreas.length}\n\n`;

          targetAreas.forEach((a, idx) => {
            txt += `[${idx + 1}] ${a.name.toUpperCase()}${a.name_hi ? ` (${a.name_hi})` : ''}\n`;
            txt += `    Category: ${a.category}\n`;
            if (a.tagline) txt += `    Tagline: ${a.tagline}\n`;
            txt += `    Description: ${a.description}\n`;
            if (a.subfields?.length) txt += `    Subfields: ${a.subfields.join(', ')}\n`;
            if (a.relevantActs?.length) txt += `    Governing Acts: ${a.relevantActs.join(', ')}\n`;
            if (a.typicalForums?.length) txt += `    Forums: ${a.typicalForums.join(', ')}\n`;
            txt += `    Advocates: ${a.advocateCount || 0} verified | Avg Exp: ${a.avgExperience || 10}+ yrs | Rating: ${a.avgRating || 4.8}/5\n`;
            if (a.feeRange) txt += `    Consultation Fee: ₹${a.feeRange.median} (Range: ₹${a.feeRange.min} - ₹${a.feeRange.max})\n`;
            txt += `------------------------------------------------------------------------\n`;
          });

          this.dataExportService.downloadBlob(
            txt,
            'text/plain;charset=utf-8;',
            `LegalConnect-PracticeAreas-${scopeLabel}-${dateStr}.txt`
          );
        }
      }
    });
  }

  // Alias for backward compatibility
  exportCatalogJson(): void {
    this.openExportModal();
  }

  // Keyboard shortcut Ctrl+P / Cmd+P trigger hook (via app.component)
  triggerPrint(): void {
    this.openExportModal();
  }

  printDirectory(): void {
    this.openExportModal();
  }

  // Mobile Filter Drawer (Guardrail 1: Parity with Desktop)
  openMobileFilter() {
    this.isMobileFilterOpen.set(true);
    this.updateBodyScrollLock();
  }

  closeMobileFilter() {
    this.isMobileFilterOpen.set(false);
    this.updateBodyScrollLock();
  }

  applyMobileFilter(cat: string, sort: any, city: string) {
    this.selectedCategory.set(cat);
    this.selectedSort.set(sort);
    this.selectedCity.set(city);
    this.closeMobileFilter();
    this.syncUrlParams();
  }

  trackBySpecId(_index: number, spec: PracticeArea): string {
    return spec.id;
  }

  trackByCatName(_index: number, cat: { name: string; count: number }): string {
    return cat.name;
  }

  trackByPageNumber(_index: number, page: number | '...'): string {
    return String(page);
  }

  trackByGroupCategory(_index: number, group: { category: string; items: PracticeArea[] }): string {
    return group.category;
  }

  trackByShortcut(_index: number, prob: ProblemShortcut): string {
    return prob.id;
  }

  trackByValue(_index: number, item: any): any {
    return item?.value ?? item;
  }

  trackByString(_index: number, item: string): string {
    return item;
  }
}