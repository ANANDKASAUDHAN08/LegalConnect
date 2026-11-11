import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  HostListener,
  ViewChild,
  ElementRef
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import {
  RightsService,
  StatutoryRight,
  RightsCategoryCount,
  StatutoryRightFAQ,
  EmergencyScenario,
  DiagnosticCrisis,
  DiagnosticEvaluation
} from '../../services/rights.service';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../../components/icon/icon.component';
import { IconName } from '../../components/icon/icon.types';
import { CustomSelectComponent } from '../../components/custom-select/custom-select.component';
import { SelectOption } from '../../components/custom-select/custom-select.types';
import { DiagnosticWizardModalComponent } from './components/diagnostic-wizard-modal/diagnostic-wizard-modal.component';
import { LegalPassModalComponent } from './components/legal-pass-modal/legal-pass-modal.component';
import { RightDetailDrawerComponent } from './components/right-detail-drawer/right-detail-drawer.component';
import { RightsShowcaseViewComponent } from './components/rights-showcase-view/rights-showcase-view.component';
import { RightsDirectoryViewComponent } from './components/rights-directory-view/rights-directory-view.component';
import { RightsCrisisViewComponent } from './components/rights-crisis-view/rights-crisis-view.component';
import { Subject, Subscription, SubscriptionLike } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { PrintService, KpiCard } from '../../services/print.service';
import { KeyboardShortcutsService } from '../../services/keyboard-shortcuts.service';
import { ModerationReportService } from '../../services/moderation-report.service';
import { RightProposalService } from '../../services/right-proposal.service';
import {
  getRightTitle,
  getRightSummary,
  getRightWhatToSay,
  getRightDosAndDonts,
  getRightDos,
  getRightDonts,
  getRightShareUrl,
  getRightShareSubject,
  getRightShareText,
  getRightCitationText
} from './utils/rights-helpers.util';

@Component({
  selector: 'app-rights',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TooltipDirective,
    IconComponent,
    CustomSelectComponent,
    DiagnosticWizardModalComponent,
    LegalPassModalComponent,
    RightDetailDrawerComponent,
    RightsShowcaseViewComponent,
    RightsDirectoryViewComponent,
    RightsCrisisViewComponent
  ],
  templateUrl: './rights.component.html',
  styleUrls: ['./rights.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RightsComponent implements OnInit, OnDestroy {
  rightsService = inject(RightsService);
  authService = inject(AuthService);
  private snackbar = inject(SnackbarService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private title = inject(Title);
  private meta = inject(Meta);
  private printService = inject(PrintService);
  public keyboardShortcuts = inject(KeyboardShortcutsService);
  private moderationReportService = inject(ModerationReportService);
  public rightProposalService = inject(RightProposalService);
  private locationSub?: SubscriptionLike;

  isPrinting = signal<boolean>(false);

  // Auth & Role-Aware state
  currentUser = toSignal(this.authService.currentUser$, { initialValue: this.authService.currentUser });
  isLoggedIn = toSignal(this.authService.isLoggedIn$, { initialValue: this.authService.isLoggedIn });
  isLawyerUser = computed(() => {
    const role = (this.currentUser()?.role || '').toLowerCase();
    return role === 'lawyer' || role === 'advocate';
  });
  isAdminUser = computed(() => {
    const role = (this.currentUser()?.role || '').toLowerCase();
    return role === 'admin' || role === 'superadmin';
  });

  // Dynamic environment-configured Admin Portal URL
  readonly adminPortalUrl = environment.adminPortalUrl || '';
  readonly adminRightsUrl = computed(() => `${this.adminPortalUrl}/rights`);

  // Futuristic Web Speech API Text-to-Speech State
  isSpeaking = signal<boolean>(false);
  speakingRightId = signal<string | null>(null);
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  // View presentation state
  viewMode = signal<'grid' | 'table' | 'crisis'>('grid');
  isViewSwitching = signal<boolean>(false);
  switchingTargetView = signal<'grid' | 'table' | 'crisis' | null>(null);
  activeTabMode = computed(() => this.switchingTargetView() || this.viewMode());
  private viewSwitchTimer?: ReturnType<typeof setTimeout>;
  globalReadingMode = signal<'citizen' | 'lawyer'>('citizen');
  cardReadingModes = signal<Record<string, 'citizen' | 'lawyer'>>({});
  isLoading = computed(() => this.rightsService.isLoading());

  // Filtering & Search State
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('All');
  selectedAct = signal<string>('All');
  selectedScenario = signal<string>('');
  selectedSort = signal<string>('popular');
  readonly sortOptions: SelectOption<string>[] = [
    { value: 'popular', label: 'Priority First', icon: 'star' },
    { value: 'alpha-asc', label: 'Alphabetical (A–Z)', icon: 'sort' },
    { value: 'alpha-desc', label: 'Alphabetical (Z–A)', icon: 'sort' },
    { value: 'newest', label: 'Recent Reforms (2026)', icon: 'clock' }
  ];
  showOnlyBookmarked = signal<boolean>(false);
  showHighImportanceOnly = signal<boolean>(false);
  expandedRightId = signal<string | null>(null);
  isScrolledPastHero = signal<boolean>(false);
  isNearFooter = signal<boolean>(false);

  // Active Modals & Dialogs
  activeLegalPassRight = signal<StatutoryRight | null>(null);
  activeDossierRight = signal<StatutoryRight | null>(null);
  isMobileFilterOpen = signal<boolean>(false);
  isMobileView = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

  // Feedback states
  copiedRightId = signal<string | null>(null);
  copiedScriptId = signal<string | null>(null);

  // Bilingual Language State
  currentLanguage = computed(() => this.rightsService.currentLanguage());

  // Diagnostic Wizard State
  isDiagnosticOpen = signal<boolean>(false);
  selectedCrisisId = signal<string>('police');

  // Centralized Modal/Drawer scroll-lock watcher
  isAnyModalOrDrawerOpen = computed(() => {
    return !!(
      this.activeLegalPassRight() ||
      this.activeDossierRight() ||
      this.isMobileFilterOpen() ||
      this.isDiagnosticOpen() ||
      this.keyboardShortcuts.isOpen()
    );
  });

  // Floating Action Menu visibility: past hero, not in any modal/drawer, and not colliding with footer
  isFloatingDockVisible = computed(() => {
    return this.isScrolledPastHero() && !this.isAnyModalOrDrawerOpen() && !this.isNearFooter();
  });

  constructor() {
    effect(() => {
      const isOpen = this.isAnyModalOrDrawerOpen();
      if (typeof document !== 'undefined') {
        if (isOpen) {
          document.body.classList.add('overflow-hidden');
        } else {
          document.body.classList.remove('overflow-hidden');
        }
      }
    });
  }

  get diagnosticCrises(): DiagnosticCrisis[] {
    return this.rightsService.diagnosticCrises();
  }

  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;
  private routeSub!: Subscription;

  // Total priority rights count
  priorityCount = computed(() => this.rightsService.rights().filter(r => r.isPopular).length);

  // Available unique statutory acts with item counts
  availableActs = computed<{ name: string; count: number }[]>(() => {
    const counts: Record<string, number> = {};
    for (const r of this.rightsService.rights()) {
      const act = r.statutoryBasis?.shortAct;
      if (act) {
        counts[act] = (counts[act] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  });

  // Formatted options for Statutory Acts custom select dropdown
  actSelectOptions = computed<SelectOption<string>[]>(() => {
    const total = this.totalCodifiedCount();
    const options: SelectOption<string>[] = [
      {
        value: 'All',
        label: 'All Codified Acts',
        count: total,
        icon: 'layers'
      }
    ];

    for (const act of this.availableActs()) {
      options.push({
        value: act.name,
        label: act.name,
        count: act.count,
        icon: 'shield-check'
      });
    }

    return options;
  });
  /**
   * Total number of non-default filters actively applied across the catalog.
   * Drives the filter badge counters in both desktop header and mobile trigger.
   */
  activeFiltersCount = computed<number>(() => {
    let count = 0;
    if (this.selectedCategory() !== 'All') count++;
    if (this.selectedAct() !== 'All') count++;
    if (this.selectedScenario()) count++;
    if (this.showOnlyBookmarked()) count++;
    if (this.showHighImportanceOnly()) count++;
    if (this.searchQuery().trim()) count++;
    return count;
  });

  /**
   * Dedicated filter count for the mobile drawer bottom-sheet view.
   */
  sheetFiltersCount = computed<number>(() => {
    let count = 0;
    if (this.selectedCategory() !== 'All') count++;
    if (this.selectedAct() !== 'All') count++;
    if (this.selectedScenario()) count++;
    return count;
  });

  /**
   * High-performance reactive Signal pipeline for multi-dimensional filtering,
   * search matching against pre-indexed search corpus, and deterministic sorting.
   */
  filteredRights = computed(() => {
    let list = this.rightsService.rights();
    const cat = this.selectedCategory();
    const act = this.selectedAct();
    const scenario = this.selectedScenario();
    const query = this.searchQuery().toLowerCase().trim();
    const bookmarksOnly = this.showOnlyBookmarked();
    const highImportanceOnly = this.showHighImportanceOnly();
    const sort = this.selectedSort();
    const bookmarkedIds = this.rightsService.bookmarkedIds();

    if (bookmarksOnly) {
      list = list.filter(r => bookmarkedIds.includes(r.id));
    }

    if (highImportanceOnly) {
      list = list.filter(r => r.isPopular === true);
    }

    if (cat !== 'All') {
      list = list.filter(r => r.category.toLowerCase() === cat.toLowerCase());
    }

    if (act !== 'All') {
      list = list.filter(r => r.statutoryBasis?.shortAct?.toLowerCase() === act.toLowerCase());
    }

    if (scenario) {
      list = list.filter(r => r.scenarioTag && r.scenarioTag.toLowerCase() === scenario.toLowerCase());
    }

    if (query) {
      list = list.filter(r =>
        r._searchCorpus
          ? r._searchCorpus.includes(query)
          : (
            r.title.toLowerCase().includes(query) ||
            r.summary.toLowerCase().includes(query) ||
            r.category.toLowerCase().includes(query) ||
            r.statutoryBasis.actName.toLowerCase().includes(query) ||
            r.statutoryBasis.shortAct.toLowerCase().includes(query) ||
            r.statutoryBasis.sections.some(s => s.toLowerCase().includes(query)) ||
            (r.statutoryBasis.landmarkCases && r.statutoryBasis.landmarkCases.some(c => c.toLowerCase().includes(query))) ||
            r.keyProtections.some(p => p.toLowerCase().includes(query)) ||
            r.actionableSteps.some(a => a.toLowerCase().includes(query)) ||
            (r.tags && r.tags.some(t => t.toLowerCase().includes(query))) ||
            (r.penaltiesForViolation && r.penaltiesForViolation.toLowerCase().includes(query)) ||
            (r.legalRemedy && r.legalRemedy.toLowerCase().includes(query))
          )
      );
    }

    // Apply sorting in client signal for immediate reactivity
    const sorted = [...list];
    if (sort === 'alpha-asc') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === 'alpha-desc') {
      sorted.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sort === 'newest') {
      sorted.sort((a, b) => (b.verifiedDate || '').localeCompare(a.verifiedDate || ''));
    } else {
      // Default: Priority / High Importance first, then title
      sorted.sort((a, b) => {
        if (a.isPopular && !b.isPopular) return -1;
        if (!a.isPopular && b.isPopular) return 1;
        return a.title.localeCompare(b.title);
      });
    }

    return sorted;
  });

  /**
   * Real-time total count of verified statutory rights codified in the catalog.
   */
  totalCodifiedCount = computed(() => this.rightsService.rights().length);

  /**
   * Count of distinct legal practice domains excluding the global 'All' meta-filter.
   */
  categoriesCount = computed(() => {
    const cats = this.rightsService.categories().filter(c => c.name !== 'All');
    return cats.length;
  });

  /**
   * Active domain categories list excluding the 'All' meta-filter.
   */
  domainCategories = computed(() => this.rightsService.categories().filter(c => c.name !== 'All'));

  /**
   * Count of distinct emergency and high-stress scenarios codified in the catalog.
   */
  scenariosCount = computed(() => this.rightsService.scenarios().length);

  /**
   * Emergency / Crisis Mode projection: filters down to statutory rights that contain
   * active scenario tags, verbal confrontation directives, emergency helplines, or high priority badges.
   */
  crisisRights = computed(() => {
    const list = this.rightsService.rights();
    const emergencyList = list.filter(r =>
      !!r.scenarioTag ||
      !!r.whatToSay ||
      !!r.emergencyHelpline ||
      r.isPopular
    );

    const baseList = emergencyList.length > 0 ? emergencyList : list;
    const query = this.searchQuery().toLowerCase().trim();
    if (!query) {
      return baseList;
    }

    return baseList.filter(r =>
      r._searchCorpus
        ? r._searchCorpus.includes(query)
        : (
          r.title.toLowerCase().includes(query) ||
          r.summary.toLowerCase().includes(query) ||
          r.category.toLowerCase().includes(query) ||
          (r.scenarioTag && r.scenarioTag.toLowerCase().includes(query)) ||
          r.statutoryBasis.actName.toLowerCase().includes(query) ||
          r.statutoryBasis.shortAct.toLowerCase().includes(query) ||
          (r.whatToSay && r.whatToSay.toLowerCase().includes(query))
        )
    );
  });

  crisisCount = computed(() => {
    return this.crisisRights().length;
  });

  @HostListener('document:keydown.escape')
  onEscapePressed() {
    if (this.isDiagnosticOpen()) {
      this.closeDiagnostic();
      return;
    }
    if (this.activeLegalPassRight()) {
      this.closeLegalPassModal();
      return;
    }
    if (this.activeDossierRight()) {
      this.closeRightDetail();
      return;
    }
    if (this.isMobileFilterOpen()) {
      this.closeMobileFilter();
      return;
    }
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (typeof window !== 'undefined') {
      const scrollY = window.scrollY;
      this.isScrolledPastHero.set(scrollY > 280);

      // Footer proximity detection: prevent dock from overlapping copyright and footer links
      const scrollPosition = scrollY + window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const nearBottom = (documentHeight - scrollPosition) < 160;
      this.isNearFooter.set(nearBottom);
    }
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 1024;
      if (this.isMobileView() !== isMobile) {
        this.isMobileView.set(isMobile);
      }
      if (window.innerWidth < 768 && this.viewMode() === 'table') {
        this.setViewMode('grid');
      }
    }
  }

  scrollToTop() {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent) {
    if (
      document.activeElement?.tagName === 'INPUT' ||
      document.activeElement?.tagName === 'TEXTAREA'
    ) {
      return;
    }

    if (event.key === '/') {
      event.preventDefault();
      if (this.searchInputRef) {
        this.searchInputRef.nativeElement.focus();
        this.searchInputRef.nativeElement.select();
      }
      return;
    }

    if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      this.keyboardShortcuts.open();
      return;
    }

    // Alt + 1/2/3 or Ctrl/Cmd + 1/2/3: Instant Mode Switching
    const isCmdOrAlt = event.altKey || event.ctrlKey || event.metaKey;
    if (isCmdOrAlt && event.key === '1') {
      event.preventDefault();
      this.setViewMode('grid');
      return;
    }
    if (isCmdOrAlt && event.key === '2') {
      event.preventDefault();
      this.setViewMode('table');
      return;
    }
    if (isCmdOrAlt && event.key === '3') {
      event.preventDefault();
      this.setViewMode('crisis');
      return;
    }

    // Keys 1 to 8: instant jump to corresponding emergency scenario
    const num = parseInt(event.key, 10);
    if (!isNaN(num) && num >= 1 && num <= 8) {
      const scenarios = this.rightsService.scenarios();
      if (scenarios[num - 1]) {
        event.preventDefault();
        this.setScenario(scenarios[num - 1].tag);
        this.snackbar.show(`Emergency Scenario activated: ${scenarios[num - 1].label}`, 'info');
      }
    }
  }

  ngOnInit() {
    this.title.setTitle('Citizen Rights & Statutory Safeguards Library | LegalConnect');
    this.meta.updateTag({
      name: 'description',
      content: 'Authoritative Indian citizen statutory rights library, BNSS 2023 police arrest rules, tenant protections, consumer rights, hospital emergency charters, and DPDP digital privacy laws.'
    });

    // Auto-set lawyer reading mode if logged in as an advocate
    if (this.isLawyerUser()) {
      this.globalReadingMode.set('lawyer');
    }

    // Hydrate language preference
    this.rightsService.loadLanguage();

    this.searchSub = this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(val => {
      this.searchQuery.set(val);
    });

    this.loadData();

    this.routeSub = this.route.fragment.subscribe(fragment => {
      if (fragment) {
        this.expandedRightId.set(fragment);
        setTimeout(() => {
          const el = document.getElementById(fragment);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }
    });

    this.route.queryParams.subscribe(params => {
      if (params['scenario']) {
        this.selectedScenario.set(params['scenario']);
      }
      if (params['category']) {
        this.selectedCategory.set(params['category']);
      }
      if (params['act']) {
        this.selectedAct.set(params['act']);
      }
      if (params['priority'] === 'true' || params['priority'] === true) {
        this.showHighImportanceOnly.set(true);
      }
      if (params['saved'] === 'true' || params['saved'] === true) {
        this.showOnlyBookmarked.set(true);
      }
      if (params['q']) {
        this.searchQuery.set(params['q']);
      }
      if (params['view'] && ['grid', 'table', 'crisis'].includes(params['view'])) {
        let targetView = params['view'] as 'grid' | 'table' | 'crisis';
        if (targetView === 'table' && typeof window !== 'undefined' && window.innerWidth < 768) {
          targetView = 'grid';
        }
        if (this.viewMode() !== targetView) {
          this.viewMode.set(targetView);
        }
      }
      const detailParam = params['detail'] || params['id'];
      if (detailParam) {
        this.expandedRightId.set(detailParam);
        const right = this.rightsService.rights().find(r => r.id === detailParam);
        if (right) {
          this.activeDossierRight.set(right);
          this.updateBodySheetLock();
        }
      } else if (this.activeDossierRight() && !params['detail']) {
        if (this.isSpeaking()) {
          this.stopSpeaking();
        }
        this.activeDossierRight.set(null);
        this.updateBodySheetLock();
      }
      if (params['diagnostic']) {
        this.openDiagnostic(params['diagnostic']);
      }
      if (params['notice']) {
        this.openTemplateStudio(params['notice']);
      }
    });

    // Sync browser back/forward buttons with side drawer without router-induced scroll jumps
    this.locationSub = this.location.subscribe(() => {
      if (typeof window === 'undefined') return;
      const urlParams = new URLSearchParams(window.location.search);
      const detailId = urlParams.get('detail') || urlParams.get('id');
      if (detailId) {
        const right = this.rightsService.rights().find(r => r.id === detailId);
        if (right) {
          this.activeDossierRight.set(right);
          this.updateBodySheetLock();
        }
      } else if (this.activeDossierRight()) {
        if (this.isSpeaking()) {
          this.stopSpeaking();
        }
        this.activeDossierRight.set(null);
        this.updateBodySheetLock();
      }
    });
  }

  ngOnDestroy() {
    this.stopSpeaking();
    if (this.viewSwitchTimer) {
      clearTimeout(this.viewSwitchTimer);
    }
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
    if (this.routeSub) {
      this.routeSub.unsubscribe();
    }
    if (this.locationSub) {
      this.locationSub.unsubscribe();
    }
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden', 'sheet-open');
      document.documentElement.classList.remove('overflow-hidden', 'sheet-open');
    }
  }

  loadData() {
    this.rightsService.fetchRights(
      this.selectedCategory(),
      this.searchQuery(),
      this.selectedSort(),
      this.selectedScenario()
    ).subscribe(() => {
      this.injectSchemaOrgJsonLd();
      const currentDetail = this.route.snapshot.queryParams['detail'] || this.route.snapshot.queryParams['id'];
      if (currentDetail && !this.activeDossierRight()) {
        const found = this.rightsService.rights().find(r => r.id === currentDetail);
        if (found) {
          this.activeDossierRight.set(found);
        }
      }
    });
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchSubject.next('');
    if (this.searchInputRef) {
      this.searchInputRef.nativeElement.value = '';
    }
  }

  /**
   * Switches the active library view format between Showcase, Directory, and Crisis mode.
   * Renders an institutional-grade, perfectly blended skeleton shimmer loader on both mobile & desktop.
   */
  setViewMode(mode: 'grid' | 'table' | 'crisis', smoothScrollToWorkspace = false) {
    if (mode === 'table' && typeof window !== 'undefined' && window.innerWidth < 768) {
      mode = 'grid';
    }
    if (this.viewMode() === mode && !this.isViewSwitching()) {
      if (smoothScrollToWorkspace && typeof window !== 'undefined') {
        this.scrollToWorkspace();
      }
      return;
    }

    if (this.viewSwitchTimer) {
      clearTimeout(this.viewSwitchTimer);
    }

    // Immediately synchronize view mode to establish proper workspace & sidebar layout in lockstep
    this.viewMode.set(mode);
    this.isViewSwitching.set(true);
    this.switchingTargetView.set(mode);

    // Synchronize view query param in URL without page reload
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: mode },
      queryParamsHandling: 'merge'
    });

    if (mode === 'crisis') {
      this.snackbar.show('Entered Crisis Mode: Showing immediate verbal scripts & emergency contacts.', 'warning');
    } else if (mode === 'table') {
      this.snackbar.show('Switched to Compact Statutory Directory Table view.', 'info');
    } else {
      this.snackbar.show('Switched to Visual Showcase Cards view.', 'info');
    }

    // Perfectly timed transition: smooth shimmer wave across desktop and mobile, then seamlessly reveals destination view
    this.viewSwitchTimer = setTimeout(() => {
      this.isViewSwitching.set(false);
      this.switchingTargetView.set(null);

      if (smoothScrollToWorkspace && typeof window !== 'undefined') {
        this.scrollToWorkspace();
      }
    }, 200);
  }

  private scrollToWorkspace() {
    if (typeof window !== 'undefined') {
      const workspaceEl = document.querySelector('main');
      if (workspaceEl) {
        const topOffset = workspaceEl.getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
      }
    }
  }

  getCardReadingMode(id: string): 'citizen' | 'lawyer' {
    if (this.isLoggedIn()) {
      return this.isLawyerUser() ? 'lawyer' : 'citizen';
    }
    return this.cardReadingModes()[id] || this.globalReadingMode();
  }

  setCardReadingMode(id: string, mode: 'citizen' | 'lawyer', event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const current = { ...this.cardReadingModes() };
    current[id] = mode;
    this.cardReadingModes.set(current);
  }

  setGlobalReadingMode(mode: 'citizen' | 'lawyer') {
    this.globalReadingMode.set(mode);
    this.cardReadingModes.set({});
    this.snackbar.show(
      mode === 'citizen'
        ? 'Switched to Citizen Mode (Plain English & What to Say)'
        : 'Switched to Lawyer Mode (Bare Act Sections & Precedents)',
      'info'
    );
  }

  setCategory(category: string) {
    if (this.selectedCategory() === category && category !== 'All') {
      this.selectedCategory.set('All');
    } else {
      this.selectedCategory.set(category);
      this.selectedScenario.set('');
      this.showOnlyBookmarked.set(false);
    }
  }

  setAct(act: string) {
    if (this.selectedAct() === act && act !== 'All') {
      this.selectedAct.set('All');
    } else {
      this.selectedAct.set(act);
    }
  }

  clearAct() {
    this.selectedAct.set('All');
  }

  setScenario(tag: string) {
    if (this.selectedScenario() === tag) {
      this.selectedScenario.set('');
    } else {
      this.selectedScenario.set(tag);
      this.selectedCategory.set('All');
      this.showOnlyBookmarked.set(false);

      // Auto-expand matching right if found
      const matching = this.rightsService.rights().find(r => r.scenarioTag === tag);
      if (matching) {
        this.expandedRightId.set(matching.id);
        setTimeout(() => {
          const el = document.getElementById(matching.id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      }
    }
  }

  clearScenario() {
    this.selectedScenario.set('');
  }

  setSort(sort: string) {
    this.selectedSort.set(sort);
  }

  toggleBookmarksOnly() {
    this.showOnlyBookmarked.set(!this.showOnlyBookmarked());
    if (this.showOnlyBookmarked()) {
      this.selectedCategory.set('All');
      this.selectedAct.set('All');
      this.selectedScenario.set('');
      this.showHighImportanceOnly.set(false);
    }
  }

  toggleHighImportanceOnly() {
    this.showHighImportanceOnly.set(!this.showHighImportanceOnly());
    if (this.showHighImportanceOnly()) {
      this.showOnlyBookmarked.set(false);
    }
  }

  navigateToTemplate(right: StatutoryRight, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    let templateId = 'cheque-bounce-notice';
    const cat = (right.category || '').toLowerCase();
    const id = (right.id || '').toLowerCase();
    const title = (right.title || '').toLowerCase();

    if (id.includes('utility') || id.includes('rent') || id.includes('tenant') || cat.includes('tenant') || cat.includes('housing') || title.includes('tenant') || title.includes('utility')) {
      templateId = 'tenant-utility-cut-contest';
    } else if (id.includes('consumer') || cat.includes('consumer') || title.includes('consumer') || title.includes('refund')) {
      templateId = 'consumer-deficiency-refund';
    } else if (id.includes('police') || id.includes('arrest') || id.includes('fir') || cat.includes('police') || cat.includes('criminal') || title.includes('police') || title.includes('arrest')) {
      templateId = 'police-misconduct-representation';
    } else if (id.includes('rti') || cat.includes('civil') || title.includes('information')) {
      templateId = 'rti-application';
    } else if (id.includes('maintenance') || cat.includes('family') || cat.includes('women')) {
      templateId = 'maintenance-petition';
    }
    this.router.navigate(['/laws/templates'], { queryParams: { open: templateId } });
  }

  toggleAccordion(id: string) {
    if (this.expandedRightId() === id) {
      this.expandedRightId.set(null);
    } else {
      this.expandedRightId.set(id);
    }
  }

  toggleBookmark(right: StatutoryRight, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.rightsService.toggleBookmark(right.id, right.title);
  }

  isBookmarked(id: string): boolean {
    return this.rightsService.isBookmarked(id);
  }

  copyCitation(right: StatutoryRight, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    this.rightsService.copyCitation(right);
    this.copiedRightId.set(right.id);
    setTimeout(() => {
      this.copiedRightId.set(null);
    }, 2500);
  }

  copyScript(right: StatutoryRight, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    const script = this.getWhatToSay(right);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(script).then(() => {
        this.copiedScriptId.set(right.id);
        this.snackbar.show('Verbal script copied to clipboard!', 'success');
        setTimeout(() => {
          this.copiedScriptId.set(null);
        }, 2500);
      }).catch(() => {
        this.snackbar.show('Failed to copy script.', 'warning');
      });
    }
  }

  shareRight(right: StatutoryRight, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    const shareUrl = `${window.location.origin}/rights#${right.id}`;
    if (navigator.share) {
      navigator.share({
        title: right.title,
        text: `${right.title} — Statutory Citizen Right: ${right.summary}`,
        url: shareUrl
      }).catch(() => { });
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        this.snackbar.show(`Share link copied to clipboard for "${right.title}".`, 'success');
      }).catch(() => {
        this.snackbar.show('Failed to copy link.', 'warning');
      });
    }
  }

  // ── Overlay & Sheet Body Scroll Locking ───────────────────────────────────
  /**
   * Synchronizes viewport scroll locking whenever an overlay, bottom sheet, or modal is active.
   */
  private updateBodySheetLock(): void {
    if (typeof document === 'undefined') return;
    const hasOverlay =
      !!this.activeLegalPassRight() ||
      !!this.activeDossierRight() ||
      this.isDiagnosticOpen() ||
      this.isMobileFilterOpen();

    if (hasOverlay) {
      document.body.classList.add('sheet-open');
    } else {
      document.body.classList.remove('sheet-open');
    }
  }

  // ── Modal Handlers ─────────────────────────────────────────────────────────

  /**
   * Launches the Digital Legal Defense Pass modal (optimized for on-screen confrontation display).
   */
  openLegalPassModal(right: StatutoryRight, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.activeLegalPassRight.set(right);
    this.updateBodySheetLock();
  }

  closeLegalPassModal(): void {
    this.activeLegalPassRight.set(null);
    this.updateBodySheetLock();
  }

  /**
   * Synchronizes URL query parameters (?detail=id) without triggering Angular Router navigation.
   * Completely avoids Angular's scrollPositionRestoration viewport resets, keeping the background
   * catalog pinned at the user's exact scroll position on both desktop and mobile.
   */
  private updateUrlDetailParam(rightId: string | null, replace: boolean = false): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (rightId) {
      url.searchParams.set('detail', rightId);
    } else {
      url.searchParams.delete('detail');
    }
    const query = url.search ? url.search.substring(1) : '';
    if (replace) {
      this.location.replaceState(url.pathname, query);
    } else {
      this.location.go(url.pathname, query);
    }
  }

  /**
   * Opens authoritative statutory detail drawer / mobile full-page view.
   * Syncs URL query parameter (?detail=id) for deep-linking and browser back navigation
   * without triggering router navigation or any viewport scroll reset.
   */
  openRightDetail(right: StatutoryRight, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.activeDossierRight.set(right);
    this.updateUrlDetailParam(right.id, false);
    this.updateBodySheetLock();
  }

  openRightDetailById(rightId: string, event?: Event): void {
    const right = this.rightsService.rights().find(r => r.id === rightId);
    if (right) {
      this.openRightDetail(right, event);
    }
  }

  closeRightDetail(): void {
    if (this.isSpeaking()) {
      this.stopSpeaking();
    }
    this.activeDossierRight.set(null);
    this.updateUrlDetailParam(null, true);
    this.updateBodySheetLock();
  }

  selectRightDetail(right: StatutoryRight): void {
    if (this.isSpeaking()) {
      this.stopSpeaking();
    }
    this.activeDossierRight.set(right);
    this.updateUrlDetailParam(right.id, true);
  }

  /**
   * Generates and triggers an institutional-grade Citizen Rights PDF dossier
   * using the centralized LegalConnect PrintService.
   */
  printCurrent(): void {
    const singleRight = this.activeDossierRight() || this.activeLegalPassRight();
    if (singleRight) {
      this.printSingleRightDossier(singleRight);
      return;
    }

    const rights = this.filteredRights();
    if (rights.length === 0) {
      this.snackbar.show('No statutory protections found matching current filters to print.', 'warning');
      return;
    }

    this.isPrinting.set(true);
    this.snackbar.show('Generating official Citizen Rights Dossier...', 'info', 2500);

    try {
      const e = this.printService.escapeHtml.bind(this.printService);
      const activeCategory = this.selectedCategory();
      const activeAct = this.selectedAct();
      const totalCount = rights.length;

      // 1. Subject Strip
      const subjectStrip = this.printService.buildSubjectStrip({
        name: activeCategory === 'All'
          ? 'Charter of Citizen Fundamental & Statutory Safeguards'
          : `Statutory Legal Protections: ${activeCategory}`,
        subtitle: `Republic of India Statutory Framework · ${totalCount} Codified Provisions · LegalConnect Research Directorate`,
        badge: 'Binding Supreme Court Precedents Verified'
      });

      // 2. Executive KPI Grid
      const kpis: KpiCard[] = [
        { label: 'Codified Safeguards', value: `${totalCount} Rights`, sub: 'Verified in Library', accent: 'blue' },
        { label: 'Legislative Code', value: activeAct !== 'All' ? activeAct : 'BNSS 2023 Enacted', sub: 'Post-2024 Reform Regime', accent: 'indigo' },
        { label: 'Judicial Enforcement', value: 'Art. 21 / 32 / 226', sub: 'High Court & SC Writ Jurisdiction', accent: 'emerald' },
        { label: 'Legal Aid Representation', value: '₹0.00 Statutory', sub: 'Sec. 12 NALSA Free Aid', accent: 'amber' }
      ];
      const kpiGrid = this.printService.buildKpiGrid(kpis);

      // 3. Executive Index Table
      const tableRows = rights.map((r, idx) => ({
        index: (idx + 1).toString(),
        title: `<strong>${e(this.getTitle(r))}</strong><div style="font-size:9px;color:#64748b;margin-top:2px;">${e(this.getSummary(r))}</div>`,
        category: `<span style="font-weight:700;color:#1e40af;">${e(r.category)}</span>`,
        statutoryBasis: `<span style="font-family:monospace;font-weight:700;">${e(r.statutoryBasis.shortAct)}</span><div style="font-size:8.5px;color:#475569;">${e((r.statutoryBasis.sections || []).join(', '))}</div>`,
        remedy: `<span style="font-weight:600;color:#047857;">${e(r.legalRemedy || 'Magistrate Court')}</span>`
      }));

      const tableHtml = this.printService.buildTable({
        title: 'Statutory Protections Master Index',
        badge: `${totalCount} Legal Safeguards`,
        columns: [
          { key: 'index', label: '#', align: 'center' },
          { key: 'title', label: 'Statutory Protection & Plain Guarantee' },
          { key: 'category', label: 'Practice Domain' },
          { key: 'statutoryBasis', label: 'Governing Statute & Sections' },
          { key: 'remedy', label: 'Enforcing Authority / Forum' }
        ],
        rows: tableRows
      });

      // 4. Detailed Protection Dossiers
      const checkSvg = this.printService.getSvg('check', { size: 10, color: '#059669', style: 'margin-right:4px;' });
      const scaleSvg = this.printService.getSvg('scale', { size: 11, color: '#2563eb', style: 'margin-right:4px;' });
      const messageSvg = this.printService.getSvg('message-square', { size: 11, color: '#1e40af', style: 'margin-right:4px;' });

      const detailedCardsHtml = rights.slice(0, 50).map((r, idx) => {
        const title = e(this.getTitle(r));
        const summary = e(this.getSummary(r));
        const whatToSay = this.getWhatToSay(r);
        const sections = (r.statutoryBasis.sections || []).join(', ');
        const actName = e(r.statutoryBasis.actName);

        const protectionsList = (r.keyProtections || []).map((p: string) =>
          `<div style="font-size:9.5px;color:#334155;margin-bottom:3px;display:flex;align-items:flex-start;">
            ${checkSvg} <span>${e(p)}</span>
          </div>`
        ).join('');

        const scriptHtml = whatToSay ? `
          <div style="background:#eff6ff;border-left:3px solid #2563eb;padding:6px 10px;border-radius:4px;margin:8px 0;font-size:9.5px;color:#1e3a8a;line-height:1.5;">
            <div style="font-weight:800;text-transform:uppercase;font-size:8px;letter-spacing:0.05em;color:#1e40af;margin-bottom:2px;display:flex;align-items:center;">
              ${messageSvg} Verbal Confrontation Script to Authorities
            </div>
            <em>"${e(whatToSay)}"</em>
          </div>
        ` : '';

        const remediesHtml = r.legalRemedy ? `
          <div style="margin-top:6px;font-size:9.5px;color:#475569;">
            <strong style="color:#0f172a;">Statutory Forum / Remedy:</strong> ${e(r.legalRemedy)}
          </div>
        ` : '';

        const penaltiesHtml = r.penaltiesForViolation ? `
          <div style="margin-top:4px;font-size:9px;color:#991b1b;background:#fee2e2;padding:3px 7px;border-radius:4px;">
            <strong style="color:#7f1d1d;">Penalties for Violation:</strong> ${e(r.penaltiesForViolation)}
          </div>
        ` : '';

        const helplineHtml = r.emergencyHelpline ? `
          <div style="margin-top:4px;font-size:9px;color:#1e40af;background:#eff6ff;padding:3px 7px;border-radius:4px;">
            <strong style="color:#1e3a8a;">Emergency Redressal Helpline:</strong> ${e(r.emergencyHelpline.name)} (${e(r.emergencyHelpline.number)})
          </div>
        ` : '';

        const precedentsHtml = (r.statutoryBasis?.landmarkCases && r.statutoryBasis.landmarkCases.length > 0) ? `
          <div style="margin-top:4px;font-size:8.5px;color:#475569;">
            <strong style="color:#0f172a;">Supreme Court Precedents:</strong> ${e(r.statutoryBasis.landmarkCases.join('; '))}
          </div>
        ` : '';

        return `
          <div style="border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:6px;padding:10px 12px;margin-bottom:12px;page-break-inside:avoid;break-inside:avoid;background:#fff;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
              <div style="font-size:12px;font-weight:700;color:#0f172a;">${idx + 1}. ${title}</div>
              <span style="font-size:8px;font-weight:800;text-transform:uppercase;padding:2px 6px;border-radius:4px;background:#f1f5f9;color:#334155;">${e(r.category)}</span>
            </div>
            <div style="font-size:9px;color:#2563eb;font-weight:700;margin-bottom:6px;display:flex;align-items:center;">
              ${scaleSvg} ${actName} &bull; ${e(sections)}
            </div>
            <div style="font-size:10px;color:#334155;line-height:1.5;margin-bottom:6px;">${summary}</div>
            ${scriptHtml}
            ${protectionsList ? `<div style="margin-top:6px;">${protectionsList}</div>` : ''}
            ${remediesHtml}
            ${penaltiesHtml}
            ${helplineHtml}
            ${precedentsHtml}
          </div>
        `;
      }).join('');

      const detailedSection = detailedCardsHtml ? this.printService.buildSection(
        'Codified Safeguards & Immediate Confrontation Scripts',
        detailedCardsHtml,
        rights.length > 50 ? `First 50 of ${rights.length} Playbooks Compiled` : 'Actionable Citizen Playbooks'
      ) : '';

      // Assemble content
      const contentHtml = `
        <div style="margin-bottom:16px;">
          ${subjectStrip}
          ${kpiGrid}
          ${tableHtml}
          <div style="margin-top:16px;">
            ${detailedSection}
          </div>
        </div>
      `;

      this.printService.print({
        title: 'Citizen Rights & Statutory Protections Dossier',
        subtitle: `Codified Safeguards Guaranteed under the Constitution of India & BNSS 2023 · ${totalCount} Legal Protections`,
        classification: 'OFFICIAL CITIZEN CHARTER',
        accentColor: '#2563eb',
        watermark: 'LEGALCONNECT CITIZEN CHARTER',
        content: contentHtml,
        extraMeta: [
          { label: 'Active Category', value: activeCategory },
          { label: 'Statutory Scope', value: activeAct !== 'All' ? activeAct : 'Pan-India Central & State Codes' },
          { label: 'Total Rights', value: `${totalCount} Codified Safeguards` },
          { label: 'Audit Timestamp', value: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
        ]
      });
    } catch (err) {
      console.error('[RightsComponent] PDF Export error:', err);
      this.snackbar.show('Failed to compile printable PDF dossier.', 'error');
    } finally {
      this.isPrinting.set(false);
    }
  }

  /**
   * Prints an individual statutory right dossier with complete provenance & remedies.
   */
  printSingleRightDossier(r: StatutoryRight): void {
    this.isPrinting.set(true);
    this.snackbar.show(`Exporting dossier for ${r.title}...`, 'info', 2000);

    try {
      const e = this.printService.escapeHtml.bind(this.printService);
      const title = e(this.getTitle(r));
      const summary = e(this.getSummary(r));
      const whatToSay = this.getWhatToSay(r);
      const actName = e(r.statutoryBasis.actName);
      const sections = e((r.statutoryBasis.sections || []).join(', '));

      const subjectStrip = this.printService.buildSubjectStrip({
        name: title,
        subtitle: `${r.category} • ${actName} • LegalConnect Official Statutory Registry`,
        badge: 'Statutory Defense Guarantee'
      });

      const kpis: KpiCard[] = [
        { label: 'Statute & Code', value: r.statutoryBasis.shortAct, sub: sections, accent: 'indigo' },
        { label: 'Practice Domain', value: r.category, sub: 'National Legal Framework', accent: 'blue' },
        { label: 'Citizen Legal Fee', value: '₹0.00 Statutory', sub: 'Section 12 NALSA representation', accent: 'emerald' },
        { label: 'Review Status', value: '100% Verified', sub: 'Supreme Court Precedent', accent: 'amber' }
      ];
      const kpiGrid = this.printService.buildKpiGrid(kpis);

      const checkSvg = this.printService.getSvg('check', { size: 10, color: '#059669', style: 'margin-right:4px;' });
      const protectionsList = (r.keyProtections || []).map(p =>
        `<div style="font-size:10px;color:#334155;margin-bottom:4px;display:flex;align-items:flex-start;">
          ${checkSvg} <span>${e(p)}</span>
        </div>`
      ).join('');

      const scriptHtml = whatToSay ? `
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:10px 14px;border-radius:6px;margin:12px 0;">
          <div style="font-weight:800;text-transform:uppercase;font-size:9px;letter-spacing:0.05em;color:#1e40af;margin-bottom:4px;">
            Official Directive to Law Enforcement &amp; Authorities (Say this out loud):
          </div>
          <p style="font-size:11px;color:#1e3a8a;font-style:italic;line-height:1.6;margin:0;">
            "${e(whatToSay)}"
          </p>
        </div>
      ` : '';

      const xRedSvg = this.printService.getSvg('x', { size: 10, color: '#dc2626', style: 'margin-right:4px;' });
      const { dos: effectiveDos, donts: effectiveDonts } = this.getDosAndDonts(r);

      const dosHtml = (effectiveDos && effectiveDos.length > 0) ? `
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:8px 10px;">
          <div style="font-weight:700;font-size:9.5px;color:#166534;margin-bottom:4px;text-transform:uppercase;">Statutory Do's:</div>
          ${effectiveDos.map(d => `<div style="font-size:9px;color:#14532d;margin-bottom:3px;display:flex;align-items:flex-start;">${checkSvg}<span>${e(d)}</span></div>`).join('')}
        </div>
      ` : '';

      const dontsHtml = (effectiveDonts && effectiveDonts.length > 0) ? `
        <div style="flex:1;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:8px 10px;">
          <div style="font-weight:700;font-size:9.5px;color:#991b1b;margin-bottom:4px;text-transform:uppercase;">Statutory Don'ts:</div>
          ${effectiveDonts.map(d => `<div style="font-size:9px;color:#7f1d1d;margin-bottom:3px;display:flex;align-items:flex-start;">${xRedSvg}<span>${e(d)}</span></div>`).join('')}
        </div>
      ` : '';

      const matrixHtml = (dosHtml || dontsHtml) ? `
        <div style="display:flex;gap:10px;margin-top:10px;">
          ${dosHtml}
          ${dontsHtml}
        </div>
      ` : '';

      const helplineHtml = r.emergencyHelpline ? `
        <div style="margin-top:8px;font-size:9.5px;color:#1e40af;background:#eff6ff;border:1px solid #bfdbfe;padding:6px 10px;border-radius:6px;">
          <strong>24x7 Statutory Redressal Helpline:</strong> ${e(r.emergencyHelpline.name)} &mdash; <strong>${e(r.emergencyHelpline.number)}</strong>
          ${r.emergencyHelpline.description ? `<div style="font-size:8.5px;color:#1e3a8a;margin-top:2px;">${e(r.emergencyHelpline.description)}</div>` : ''}
        </div>
      ` : '';

      const precedentsHtml = (r.statutoryBasis?.landmarkCases && r.statutoryBasis.landmarkCases.length > 0) ? `
        <div style="margin-top:8px;padding:6px 10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:6px;">
          <strong style="font-size:10px;color:#0f172a;">Landmark Judicial Precedents:</strong>
          <ul style="margin:4px 0 0 16px;padding:0;font-size:9px;color:#475569;line-height:1.5;">
            ${r.statutoryBasis.landmarkCases.map((c: string) => `<li>${e(c)}</li>`).join('')}
          </ul>
        </div>
      ` : '';

      const actionableStepsHtml = (r.actionableSteps && r.actionableSteps.length > 0) ? `
        <ol style="margin:4px 0 0 16px;padding:0;font-size:9.5px;color:#334155;line-height:1.6;">
          ${r.actionableSteps.map((step: string) => `<li>${e(step)}</li>`).join('')}
        </ol>
      ` : '';

      const remediesContent = `
        <div style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;margin-bottom:8px;">
          <div style="font-weight:700;font-size:11px;color:#0f172a;margin-bottom:4px;">Statutory Legal Remedy</div>
          <div style="font-size:10px;color:#334155;line-height:1.5;">${e(r.legalRemedy || 'Direct Petition to High Court / Jurisdiction Magistrate')}</div>
          ${r.penaltiesForViolation ? `
            <div style="margin-top:6px;font-size:9.5px;color:#991b1b;background:#fee2e2;padding:4px 8px;border-radius:4px;">
              <strong>Penalties for Violation:</strong> ${e(r.penaltiesForViolation)}
            </div>
          ` : ''}
          ${actionableStepsHtml ? `
            <div style="margin-top:8px;">
              <strong style="font-size:10px;color:#0f172a;">Concrete Actionable Steps:</strong>
              ${actionableStepsHtml}
            </div>
          ` : ''}
          ${helplineHtml}
          ${precedentsHtml}
        </div>
      `;

      const faqHtml = (r.frequentlyAskedQuestions && r.frequentlyAskedQuestions.length > 0) ? this.printService.buildSection(
        'Frequently Addressed Legal Questions',
        r.frequentlyAskedQuestions.map(f => `
          <div style="margin-bottom:8px;border-bottom:1px solid #f1f5f9;padding-bottom:6px;">
            <div style="font-weight:700;font-size:10px;color:#0f172a;margin-bottom:2px;">Q: ${e(f.question)}</div>
            <div style="font-size:9.5px;color:#334155;line-height:1.5;">A: ${e(f.answer)}</div>
          </div>
        `).join('')
      ) : '';

      const contentHtml = `
        <div style="margin-bottom:16px;">
          ${subjectStrip}
          ${kpiGrid}
          ${this.printService.buildSection('Statutory Guarantee & Authority Directive', `
            <div style="font-size:11.5px;color:#1e293b;line-height:1.6;margin-bottom:10px;">${summary}</div>
            ${scriptHtml}
            ${matrixHtml}
          `)}
          ${protectionsList ? this.printService.buildSection('Binding Statutory Safeguards', protectionsList, 'Guaranteed by Law') : ''}
          ${this.printService.buildSection('Statutory Redressal Forum & Remedial Playbook', remediesContent)}
          ${faqHtml}
          <div style="margin-top:14px;padding:8px 12px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;font-size:8.5px;color:#64748b;line-height:1.5;">
            <strong>Verification Provenance:</strong> ${e(r.provenance?.sourceAuthority || r.statutoryBasis.actName)} &bull;
            Government Open Data License (GODL-India) &bull; Verified against binding Supreme Court precedents.
          </div>
        </div>
      `;

      this.printService.print({
        title: `${r.title} — Statutory Dossier`,
        subtitle: `${actName} (${sections}) · Republic of India Legal Safeguard`,
        classification: 'OFFICIAL LEGAL DOSSIER',
        accentColor: '#2563eb',
        watermark: 'LEGALCONNECT DOSSIER',
        content: contentHtml,
        extraMeta: [
          { label: 'Document Type', value: 'Statutory Rights Dossier' },
          { label: 'Enacting Statute', value: r.statutoryBasis.shortAct },
          { label: 'Citizen Right ID', value: r.id },
          { label: 'Audit Timestamp', value: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
        ]
      });
    } catch (err) {
      console.error('[RightsComponent] Single Dossier PDF Export error:', err);
      this.snackbar.show('Failed to compile dossier PDF.', 'error');
    } finally {
      this.isPrinting.set(false);
    }
  }

  /**
   * Opens mobile category and domain filter bottom sheet.
   */
  openMobileFilter(): void {
    this.isMobileFilterOpen.set(true);
    this.updateBodySheetLock();
  }

  closeMobileFilter(): void {
    this.isMobileFilterOpen.set(false);
    this.updateBodySheetLock();
  }

  getScenarioLabel(tag: string): string {
    const sc = this.rightsService.scenarios().find(s => s.tag === tag);
    return sc ? sc.label : tag;
  }

  // ── High-Performance TrackBy Methods for *ngFor Directives ─────────────────

  trackByRightId(_index: number, right: StatutoryRight): string {
    return right.id;
  }

  trackByScenarioTag(_index: number, scenario: EmergencyScenario): string {
    return scenario.tag;
  }

  trackByCategoryName(_index: number, cat: RightsCategoryCount): string {
    return cat.name;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByString(_index: number, item: string): string {
    return item;
  }

  trackByFaq(_index: number, faq: StatutoryRightFAQ): string {
    return faq.question;
  }

  trackByActName(_index: number, act: { name: string; count: number }): string {
    return act.name;
  }

  resetAllFilters() {
    this.clearSearch();
    this.selectedCategory.set('All');
    this.selectedAct.set('All');
    this.selectedScenario.set('');
    this.selectedSort.set('popular');
    this.showOnlyBookmarked.set(false);
    this.showHighImportanceOnly.set(false);
    this.loadData();
    this.snackbar.show('All catalog filters reset.', 'info');
  }

  findAdvocatesForRight(category: string) {
    this.router.navigate(['/lawyers'], {
      queryParams: { specialization: category }
    });
  }

  formatDate(dateStr: string | Date): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  // --- BILINGUAL MULTI-LINGUAL SUPPORT HELPERS ---
  toggleLanguage() {
    const next = this.currentLanguage() === 'en' ? 'hi' : 'en';
    this.rightsService.setLanguage(next);
    this.snackbar.show(
      next === 'hi' ? 'भाषा बदलकर हिन्दी कर दी गई है।' : 'Language switched to English.',
      'info'
    );
  }

  getTitle(right: StatutoryRight): string {
    return getRightTitle(right, this.currentLanguage());
  }

  getSummary(right: StatutoryRight): string {
    return getRightSummary(right, this.currentLanguage());
  }

  // --- TAILORED REAL-WORLD LEGAL SCRIPTS ("WHAT TO SAY") ---
  getWhatToSay(right: StatutoryRight): string {
    return getRightWhatToSay(right, this.currentLanguage());
  }

  // --- TAILORED DO'S & DON'TS MATRIX ---
  getDosAndDonts(right: StatutoryRight): { dos: string[]; donts: string[] } {
    return getRightDosAndDonts(right, this.currentLanguage());
  }

  getScenarioIcon(tag?: string): IconName {
    if (!tag) return 'shield';
    if (tag.includes('police')) return 'shield';
    if (tag.includes('cyber')) return 'lock';
    if (tag.includes('tenant')) return 'home';
    if (tag.includes('medical')) return 'heart';
    if (tag.includes('flight')) return 'globe';
    if (tag.includes('consumer') || tag.includes('ecommerce')) return 'shield-check';
    if (tag.includes('workplace') || tag.includes('posh')) return 'briefcase';
    if (tag.includes('traffic')) return 'zap';
    return 'shield';
  }

  // --- AI TEXT-TO-SPEECH VERBAL REHEARSAL ---
  speakWhatToSay(right: StatutoryRight, event: Event) {
    event.stopPropagation();
    event.preventDefault();

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.snackbar.show('Speech synthesis is not supported on this browser device.', 'warning');
      return;
    }

    if (this.isSpeaking() && this.speakingRightId() === right.id) {
      this.stopSpeaking();
      return;
    }

    this.stopSpeaking();

    const isHi = this.currentLanguage() === 'hi';
    const script = this.getWhatToSay(right);
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = isHi ? 0.9 : 0.95; // Calm, clear, assertive cadence
    utterance.pitch = 1.0;
    utterance.lang = isHi ? 'hi-IN' : 'en-IN';

    const voices = window.speechSynthesis.getVoices();
    let preferredVoice = null;
    if (isHi) {
      preferredVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('Hindi'));
    }
    if (!preferredVoice) {
      preferredVoice = voices.find(v => v.lang.includes('en-IN')) || voices.find(v => v.lang.startsWith('en'));
    }
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking.set(true);
      this.speakingRightId.set(right.id);
      this.snackbar.show('Speaking authoritative verbal confrontation script aloud...', 'info', 3000);
    };

    utterance.onend = () => {
      this.isSpeaking.set(false);
      this.speakingRightId.set(null);
      this.activeUtterance = null;
    };

    utterance.onerror = () => {
      this.isSpeaking.set(false);
      this.speakingRightId.set(null);
      this.activeUtterance = null;
    };

    this.activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking.set(false);
    this.speakingRightId.set(null);
    this.activeUtterance = null;
  }

  // --- DIRECT ADMIN EDIT NAVIGATION ---
  navigateToAdminEdit(rightId: string, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    const targetUrl = `${this.adminPortalUrl}/rights?edit=${encodeURIComponent(rightId)}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }

  onProposeNewRight(suggestedQuery?: string): void {
    const title = (suggestedQuery || '').trim();
    this.rightProposalService.openProposal(title ? { scenarioTitle: title } : undefined);
  }

  // --- WHATSAPP RIGHT SHARE ---
  shareViaWhatsApp(right: StatutoryRight, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    const shareUrl = `${window.location.origin}/rights#${right.id}`;
    const text = `*${right.title}*\n\n${right.summary}\n\nStatute: ${right.statutoryBasis.actName} (${right.statutoryBasis.sections.join(', ')})\nLegal Remedy: ${right.legalRemedy}\n\nVerified by LegalConnect Council\n${shareUrl}`;
    const encodedText = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encodedText}`, '_blank', 'noopener,noreferrer');
    this.snackbar.show('Opening WhatsApp to share statutory right...', 'success', 3000);
  }

  // ── "AM I PROTECTED?" RAPID DIAGNOSTIC WIZARD METHODS ────────────────────
  openDiagnostic(crisisId?: string): void {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.app-tooltip-instance').forEach(el => el.remove());
    }
    const crises = this.rightsService.diagnosticCrises();
    if (crisisId && crises.some(c => c.id === crisisId || (c as any).crisisId === crisisId)) {
      this.selectedCrisisId.set(crisisId);
    } else {
      const defaultId = crises[0]?.id || (crises[0] as any)?.crisisId || 'police';
      this.selectedCrisisId.set(defaultId);
    }
    this.isDiagnosticOpen.set(true);
    this.updateBodySheetLock();
  }

  closeDiagnostic(): void {
    this.isDiagnosticOpen.set(false);
    this.updateBodySheetLock();
  }

  // ── STATUTORY DOCUMENT STUDIO DEEP-LINKING ───────────────────────
  getTemplateIdForRight(right: StatutoryRight | null): string {
    if (!right) return 'tenant-utility-cut-contest';
    const slug = (right.slug || '').toLowerCase();
    const act = (right.statutoryBasis?.actName || '').toLowerCase();
    const cat = (right.category || '').toLowerCase();

    if (slug.includes('tenant') || cat.includes('tenancy') || act.includes('tenancy') || act.includes('transfer of property')) {
      return 'tenant-utility-cut-contest';
    }
    if (slug.includes('consumer') || cat.includes('consumer') || act.includes('consumer protection')) {
      return 'consumer-deficiency-refund';
    }
    if (slug.includes('police') || slug.includes('arrest') || slug.includes('custody') || cat.includes('criminal') || act.includes('bnss')) {
      return 'police-misconduct-representation';
    }
    if (slug.includes('cheque') || act.includes('negotiable instruments') || cat.includes('bank')) {
      return 'cheque-bounce-notice';
    }
    if (slug.includes('rti') || act.includes('right to information')) {
      return 'rti-application';
    }
    if (slug.includes('maintenance') || act.includes('maintenance')) {
      return 'maintenance-petition';
    }
    if (slug.includes('divorce') || act.includes('marriage')) {
      return 'mutual-divorce-deed';
    }
    if (slug.includes('accident') || act.includes('motor vehicles')) {
      return 'mact-claim-petition';
    }
    if (slug.includes('evidence') || act.includes('sakshya') || act.includes('evidence act')) {
      return 'section-63-bsa-certificate';
    }
    return 'tenant-utility-cut-contest';
  }

  getTemplateIdForCrisis(crisisId: string): string {
    switch (crisisId) {
      case 'police':
        return 'police-misconduct-representation';
      case 'landlord':
        return 'tenant-utility-cut-contest';
      case 'consumer':
        return 'consumer-deficiency-refund';
      case 'cyber':
      case 'cheque':
        return 'cheque-bounce-notice';
      case 'rti':
        return 'rti-application';
      default:
        return 'tenant-utility-cut-contest';
    }
  }

  openTemplateStudio(templateId?: string): void {
    const target = templateId || 'tenant-utility-cut-contest';
    this.router.navigate(['/laws/templates'], { queryParams: { open: target } });
  }

  // Alias for backward compatibility if invoked
  openNoticeGenerator(templateId?: string): void {
    this.openTemplateStudio(templateId);
  }

  // --- SCHEMA.ORG JSON-LD STRUCTURED DATA INJECTION ---
  private injectSchemaOrgJsonLd(): void {
    if (typeof document === 'undefined') return;
    try {
      const scriptId = 'legalconnect-rights-schema-jsonld';
      let script = document.getElementById(scriptId) as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }

      const topRights = this.rightsService.rights().slice(0, 10);
      const schema = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebPage',
            '@id': 'https://legalconnect.in/rights',
            'url': 'https://legalconnect.in/rights',
            'name': 'Citizen Rights & Statutory Safeguards Library | LegalConnect',
            'description': 'Authoritative Indian citizen statutory rights library, BNSS 2023 police arrest rules, tenant protections, consumer rights, hospital emergency charters, and DPDP digital privacy laws.',
            'publisher': {
              '@type': 'Organization',
              'name': 'LegalConnect Directorate',
              'url': 'https://legalconnect.in'
            }
          },
          {
            '@type': 'FAQPage',
            'mainEntity': topRights.map(r => ({
              '@type': 'Question',
              'name': `What are citizen legal rights regarding ${r.title}?`,
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': `${r.summary} Grounded under ${r.statutoryBasis.actName} (${(r.statutoryBasis.sections || []).join(', ')}). Legal remedy: ${r.legalRemedy}.`
              }
            }))
          }
        ]
      };

      script.text = JSON.stringify(schema);
    } catch {
      // Non-blocking SEO injection
    }
  }
}