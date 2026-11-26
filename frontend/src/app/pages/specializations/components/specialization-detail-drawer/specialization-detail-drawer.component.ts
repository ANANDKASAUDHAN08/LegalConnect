import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
  inject,
  ChangeDetectorRef,
  HostListener,
  ViewChild,
  ElementRef,
  forwardRef
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import {
  PracticeArea,
  LawyerPreview,
  ResolvedBareAct,
  LandmarkJudgmentPreview,
  PracticeAreasService
} from '../../../../services/practice-areas.service';
import { CategoryColorTheme } from '../../specializations.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { IconComponent } from '../../../../components/icon/icon.component';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';
import { BookmarkButtonComponent } from '../../../../components/bookmark-button/bookmark-button.component';
import { AuthService } from '../../../../services/auth.service';
import { TokenStorageService } from '../../../../services/token-storage.service';
import { LocationService } from '../../../../services/location.service';
import { SpeechService } from '../../../../services/speech.service';
import { NoteService } from '../../../../services/note.service';
import { ModerationReportService } from '../../../../services/moderation-report.service';
import { FreeAidService } from '../../../../services/free-aid.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { PrintService } from '../../../../services/print.service';
import { StatuteResolverService } from '../../../../services/statute-resolver.service';
import { Subscription, Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { DRAWER_CONTEXT, IDrawerContext } from './drawer-context';
import {
  DrawerOverviewTabComponent,
  DrawerActsTabComponent,
  DrawerLandmarksTabComponent,
  DrawerAdvocatesTabComponent,
  DrawerProcedureTabComponent
} from './tabs';

export type DrawerTab = 'overview' | 'acts' | 'cases' | 'lawyers' | 'journey';

export interface JargonLabels {
  scopeHeading: string;
  forumsHeading: string;
  casesHeading: string;
  journeyHeading: string;
  ratioLabel: string;
  lawyersHeading: string;
  checklistHeading: string;
}

@Component({
  selector: 'app-specialization-detail-drawer',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TooltipDirective,
    IconComponent,
    ShareMenuComponent,
    BookmarkButtonComponent,
    DrawerOverviewTabComponent,
    DrawerActsTabComponent,
    DrawerLandmarksTabComponent,
    DrawerAdvocatesTabComponent,
    DrawerProcedureTabComponent
  ],
  providers: [
    { provide: DRAWER_CONTEXT, useExisting: forwardRef(() => SpecializationDetailDrawerComponent) }
  ],
  templateUrl: './specialization-detail-drawer.component.html',
  styleUrls: ['./specialization-detail-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpecializationDetailDrawerComponent implements OnInit, OnDestroy, OnChanges, IDrawerContext {
  @Input({ required: true }) isOpen = false;
  @Input({ required: true }) theme!: CategoryColorTheme;
  @Input() isLoading = false;
  @Input() isPinned = false;

  // Signal-backed inputs: computed() values read these, so they must be reactive
  // (plain @Input fields are invisible to the signal graph and leave computeds stale).
  private readonly _spec = signal<PracticeArea | null>(null);
  @Input({ required: true })
  set spec(value: PracticeArea | null) { this._spec.set(value); }
  get spec(): PracticeArea | null { return this._spec(); }

  private readonly _activeTab = signal<DrawerTab>('overview');
  @Input()
  set activeTab(value: DrawerTab) { this._activeTab.set(value); }
  get activeTab(): DrawerTab { return this._activeTab(); }

  private readonly _isHindi = signal(false);
  @Input()
  set isHindi(value: boolean) { this._isHindi.set(value); }
  get isHindi(): boolean { return this._isHindi(); }

  @Output() close = new EventEmitter<void>();
  @Output() tabChange = new EventEmitter<DrawerTab>();
  @Output() pinToggle = new EventEmitter<PracticeArea>();
  @Output() printClick = new EventEmitter<PracticeArea>();
  @Output() findAdvocatesClick = new EventEmitter<PracticeArea>();
  @Output() areaSelect = new EventEmitter<PracticeArea>();

  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>;

  // Injected services
  private authService = inject(AuthService);
  private tokenStorage = inject(TokenStorageService);
  private locationService = inject(LocationService);
  public speechService = inject(SpeechService);
  private noteService = inject(NoteService);
  private reportService = inject(ModerationReportService);
  public freeAidService = inject(FreeAidService);
  private snackbar = inject(SnackbarService);
  private printService = inject(PrintService);
  private practiceService = inject(PracticeAreasService);
  private router = inject(Router);
  public statuteResolver = inject(StatuteResolverService);
  private cdr = inject(ChangeDetectorRef);

  private subs: Subscription[] = [];
  private pendingTimeouts: ReturnType<typeof setTimeout>[] = [];
  private dragStartY = 0;

  // Role signal: 'lawyer' | 'client' | 'guest'
  viewerRole = signal<'lawyer' | 'client' | 'guest'>('guest');

  // Jargon mode: 'simple' vs 'legal' (persisted in localStorage)
  jargonMode = signal<'simple' | 'legal'>(
    (typeof window !== 'undefined' && localStorage.getItem('lc_jargon_mode') === 'legal') ? 'legal' : 'simple'
  );

  // First-timer guide dismissal state
  isFirstTimerDismissed = signal<boolean>(false);

  // Discreet mode
  isDiscreetMode = signal<boolean>(false);

  // Discreet mode is only available for sensitive legal categories
  isSensitiveCategory = computed(() => {
    if (!this.spec) return false;
    const text = [this.spec.id || '', this.spec.name || '', this.spec.category || ''].join(' ').toLowerCase();
    const keywords = ['domestic violence', 'domestic-violence', 'posh', 'sexual harassment',
      'sexual-harassment', 'stalking', 'dowry', 'molestation', 'assault', 'abuse',
      'trafficking', 'juvenile', 'pocso', 'cruelty', 'women', 'child'];
    return keywords.some(kw => text.includes(kw));
  });

  // Document checklist checked items (set of document names)
  checkedDocuments = signal<Set<string>>(new Set<string>());

  // Compare advocates inside drawer
  selectedAdvocatesForCompare = signal<LawyerPreview[]>([]);
  isCompareSheetOpen = signal<boolean>(false);

  // Soft-gate modal for guests
  showSoftGateModal = signal<boolean>(false);
  softGateTargetAdvocate = signal<LawyerPreview | null>(null);

  // Advocate availability alert state
  showAlertModal = signal<boolean>(false);
  isSubscribingAlert = signal<boolean>(false);
  isUnsubscribingAlert = signal<boolean>(false);
  alertSubscribed = signal<boolean>(false);
  selectedAlertType = signal<'available_now' | 'free_consult'>('available_now');
  alertChannels = signal<Set<'in_app' | 'email'>>(new Set(['in_app', 'email']));

  // Backend intelligence signals (L2, L3, C1)
  serverLawyerPosition = signal<any>(null);
  demandIntelligence = signal<any>(null);
  activeMatter = signal<any>(null);

  // Advocate sorting & filtering in drawer
  advocateSort = signal<'rating' | 'experience' | 'fee'>('rating');
  advocateFilter = signal<'all' | 'local' | 'free'>('all');

  // Description read-more
  readMoreDesc = signal<boolean>(false);

  // Hindi description toggle
  showHindiDesc = signal<boolean>(false);

  // FAQ accordion open index
  activeFaqIndex = signal<number | null>(null);

  // Note editor for landmark/act with real-time auto-save & telemetry
  activeNoteKey = signal<string | null>(null);
  activeNoteTitle = signal<string>('');
  currentNoteInput = signal<string>('');
  noteSaveStatus = signal<'saved' | 'saving' | 'unsaved' | 'idle'>('saved');
  noteLastSavedTime = signal<string | null>(null);
  noteCategory = signal<'statute' | 'case' | 'general'>('statute');
  isNoteCopied = signal<boolean>(false);

  // Computeds for note metrics
  noteCharCount = computed(() => this.currentNoteInput().length);
  noteWordCount = computed(() => {
    const text = this.currentNoteInput().trim();
    return text ? text.split(/\s+/).length : 0;
  });

  // Debounced pipeline for auto-save
  private noteDebounceSubject = new Subject<string>();

  // Cost breakdown modal
  showCostBreakdown = signal<boolean>(false);

  // Citation copied feedback
  copiedCitationId = signal<string | null>(null);

  // Expanded landmark holdings set
  expandedHoldings = signal<Set<string>>(new Set<string>());

  // Computed properties
  isLawyer = computed(() => this.viewerRole() === 'lawyer');
  isClient = computed(() => this.viewerRole() === 'client');
  isGuest = computed(() => this.viewerRole() === 'guest');

  private readonly activeLocation = toSignal(this.locationService.activeLocation$, {
    initialValue: this.locationService.getCurrentLocation()
  });

  userCity = computed(() => {
    const raw = this.activeLocation() || '';
    const cleaned = this.locationService.cleanAddress(raw);
    return cleaned || raw || '';
  });

  userCityClean = computed(() => {
    return this.userCity();
  });

  userCityShort = computed(() => {
    const city = this.userCity();
    if (!city) return '';
    const firstPart = city.split(',')[0].trim();
    return firstPart.length > 20 ? firstPart.slice(0, 18) + '...' : firstPart;
  });

  freeConsultLawyers = computed(() => {
    if (!this.spec?.featuredLawyers) return [];
    return this.spec.featuredLawyers.filter(l => (l.consultationFee || 0) === 0);
  });

  availableAdvocatesCount = computed(() => {
    return this.spec?.availableNow || this.spec?.advocateCount || 0;
  });

  languagesList = computed(() => {
    if (!this.spec?.featuredLawyers) return ['English', 'Hindi'];
    const langs = new Set<string>();
    for (const lawyer of this.spec.featuredLawyers) {
      if (lawyer.languagesSpoken && Array.isArray(lawyer.languagesSpoken)) {
        lawyer.languagesSpoken.forEach(l => langs.add(l));
      }
    }
    if (langs.size === 0) {
      return ['English', 'Hindi'];
    }
    return Array.from(langs);
  });

  relatedPracticeAreas = computed(() => {
    if (!this.spec) return [];
    const all = this.practiceService.practiceAreas();
    const currentId = this.spec.id;
    const currentCategory = this.spec.category;

    // First try matching by same category
    const sameCategory = all.filter(p => p.id !== currentId && p.category === currentCategory);
    if (sameCategory.length >= 3) {
      return sameCategory.slice(0, 4);
    }

    // Otherwise combine same category and popular
    const others = all.filter(p => p.id !== currentId && !sameCategory.some(s => s.id === p.id));
    return [...sameCategory, ...others].slice(0, 4);
  });

  totalAdvocateCount = computed(() => this.spec?.featuredLawyers?.length || 0);

  localAdvocateCount = computed(() => {
    if (!this.spec?.featuredLawyers) return 0;
    return this.spec.featuredLawyers.filter(a => this.isAdvocateInUserCity(a)).length;
  });

  freeAdvocateCount = computed(() => {
    if (!this.spec?.featuredLawyers) return 0;
    return this.spec.featuredLawyers.filter(a => (a.consultationFee || 0) === 0).length;
  });

  sortedAdvocates = computed(() => {
    if (!this.spec?.featuredLawyers) return [];
    let list = [...this.spec.featuredLawyers];
    const filter = this.advocateFilter();
    const sort = this.advocateSort();

    // 1. Quick filter
    if (filter === 'local') {
      list = list.filter(a => this.isAdvocateInUserCity(a));
    } else if (filter === 'free') {
      list = list.filter(a => (a.consultationFee || 0) === 0);
    }

    // 2. Sort
    return list.sort((a, b) => {
      // In 'all' view, give a slight edge to local practitioners if ratings are within 0.2
      if (filter === 'all' && sort === 'rating') {
        const aLocal = this.isAdvocateInUserCity(a);
        const bLocal = this.isAdvocateInUserCity(b);
        if (aLocal && !bLocal && Math.abs((b.rating || 0) - (a.rating || 0)) <= 0.2) {
          return -1;
        }
        if (!aLocal && bLocal && Math.abs((b.rating || 0) - (a.rating || 0)) <= 0.2) {
          return 1;
        }
      }

      if (sort === 'rating') {
        return (b.rating || 0) - (a.rating || 0);
      }
      if (sort === 'experience') {
        return (b.experience || 0) - (a.experience || 0);
      }
      if (sort === 'fee') {
        return (a.consultationFee || 0) - (b.consultationFee || 0);
      }
      return 0;
    });
  });

  // Advocate list pagination (prevents DOM bloat for high-density practice areas)
  advocatePage = signal<number>(1);
  readonly advocatePageSize = 6;

  pagedAdvocates = computed(() => {
    return this.sortedAdvocates().slice(0, this.advocatePage() * this.advocatePageSize);
  });

  hasMoreAdvocates = computed(() => {
    return this.pagedAdvocates().length < this.sortedAdvocates().length;
  });

  loadMoreAdvocates(): void {
    this.advocatePage.update(p => p + 1);
  }

  setAdvocateFilter(filter: 'all' | 'local' | 'free'): void {
    this.advocateFilter.set(filter);
    this.advocatePage.set(1);
  }

  setAdvocateSort(sort: 'rating' | 'experience' | 'fee'): void {
    this.advocateSort.set(sort);
    this.advocatePage.set(1);
  }

  checklistProgress = computed(() => {
    const total = this.spec?.documentsChecklist?.length || 0;
    if (total === 0) return { checked: 0, total: 0, percent: 0 };
    const checked = this.checkedDocuments().size;
    const percent = Math.min(100, Math.round((checked / total) * 100));
    return { checked, total, percent };
  });

  currentShareUrl = computed(() => {
    if (typeof window !== 'undefined' && this.spec) {
      const origin = window.location.origin;
      return `${origin}/specializations?area=${encodeURIComponent(this.spec.id)}&tab=${this.activeTab}`;
    }
    return '';
  });

  headings = computed<JargonLabels>(() => {
    if (this.jargonMode() === 'simple') {
      return {
        scopeHeading: 'What This Legal Area Covers',
        forumsHeading: 'Where Your Case Will Be Heard',
        casesHeading: 'Important Court Decisions & Precedents',
        journeyHeading: 'Step-by-Step Legal Process',
        ratioLabel: 'Key Court Rule',
        lawyersHeading: 'Verified Advocates For This Area',
        checklistHeading: 'Documents You Should Keep Ready'
      };
    }
    return {
      scopeHeading: 'Statutory Scope & Practice Description',
      forumsHeading: 'Applicable Courts & Judicial Forums',
      casesHeading: 'Connected Landmark Judicial Precedents',
      journeyHeading: 'Procedural Escalation Ladder',
      ratioLabel: 'Ratio Decidendi',
      lawyersHeading: 'Empanelled Advocates & Counsel',
      checklistHeading: 'Statutory Document Checklist'
    };
  });

  lawyersHeadingShort = computed(() => {
    return this.jargonMode() === 'simple' ? 'Verified Advocates' : 'Empanelled Counsel';
  });

  displayDescription = computed(() => {
    if (!this.spec) return '';
    if (this.jargonMode() === 'simple') {
      return this.getSimpleDescription(this.spec);
    }
    return this.spec.description;
  });

  displayTagline = computed(() => {
    if (!this.spec) return '';
    if (this.jargonMode() === 'simple') {
      return this.getSimpleTagline(this.spec);
    }
    return this.spec.tagline || '';
  });

  displayHindiDescription = computed(() => {
    if (!this.spec) return '';
    if (this.jargonMode() === 'simple') {
      return this.getSimpleHindiDescription(this.spec);
    }
    return this.spec.description_hi || '';
  });

  // Advocate competitive intelligence metrics
  lawyerPosition = computed(() => {
    if (!this.isLawyer() || !this.spec) return null;
    const srv = this.serverLawyerPosition();
    const user = this.tokenStorage.getCachedUser();
    const median = this.spec.feeRange?.median || 2500;
    const userFee = srv?.userFee || 2000;
    const diff = srv ? srv.diff : (userFee - median);
    return {
      name: srv?.lawyerName || user?.fullName || 'Advocate',
      city: srv?.city || this.userCity(),
      userFee,
      median: srv?.medianFee || median,
      diff,
      rank: srv?.rank || null,
      totalInCity: srv?.totalInCity || null,
      percentile: srv?.percentile || (diff > 0 ? 'Top 30% Premium' : 'Competitive Fee Tier'),
      isPracticingInArea: srv ? srv.isPracticingInArea : true,
      verifiedCompetitors: srv?.verifiedCompetitors || []
    };
  });

  // Data coverage — percentage of real data categories populated for this practice area
  confidenceScore = computed(() => {
    if (!this.spec) return 0;
    let filled = 0;
    const total = 6; // acts, cases, forums, advocates, faqs, subfields
    if ((this.spec.resolvedActs?.length || this.spec.relevantActs?.length || 0) > 0) filled++;
    if ((this.spec.landmarkDecisions?.length || 0) > 0) filled++;
    if ((this.spec.typicalForums?.length || 0) > 0) filled++;
    if ((this.spec.featuredLawyers?.length || this.spec.advocateCount || 0) > 0) filled++;
    if ((this.spec.faqs?.length || 0) > 0) filled++;
    if ((this.spec.subfields?.length || 0) > 0) filled++;
    return Math.round((filled / total) * 100);
  });

  // Data completeness detail — real counts of verified data sources
  dataCompleteness = computed(() => {
    if (!this.spec) return { actsCount: 0, casesCount: 0, advocateCount: 0, forumsCount: 0 };
    return {
      actsCount: this.spec.resolvedActs?.length || this.spec.relevantActs?.length || 0,
      casesCount: this.spec.landmarkDecisions?.length || 0,
      advocateCount: this.spec.featuredLawyers?.length || this.spec.advocateCount || 0,
      forumsCount: this.spec.typicalForums?.length || 0
    };
  });

  // Quick glance feature tags — derived from actual spec data (subfields, forums, acts)
  quickGlanceChips = computed(() => {
    if (!this.spec) return [];
    const chips: string[] = [];
    // Pull from real subfields first
    if (this.spec.subfields?.length) {
      chips.push(...this.spec.subfields.slice(0, 2));
    }
    // Add forum count if available
    if (this.spec.typicalForums?.length) {
      chips.push(`${this.spec.typicalForums.length} Judicial Forum${this.spec.typicalForums.length > 1 ? 's' : ''}`);
    }
    // Add acts count if available
    const actsCount = this.spec.resolvedActs?.length || this.spec.relevantActs?.length || 0;
    if (actsCount > 0) {
      chips.push(`${actsCount} Governing Statute${actsCount > 1 ? 's' : ''}`);
    }
    return chips.slice(0, 4);
  });

  // Estimated court escalation timeline stages — derived from forumJourney where available
  expectedTimelines = computed(() => {
    if (!this.spec) return [];
    if (this.spec.forumJourney && this.spec.forumJourney.length > 0) {
      return this.spec.forumJourney.map(f => {
        const durationMatch = f.note ? f.note.match(/(\d+\s*[-–to]+\s*\d+\s*(?:days?|weeks?|months?|years?)|(?:within\s+)?\d+\s+(?:days?|weeks?|months?|years?))/i) : null;
        return {
          court: f.forum ? `${f.stage} — ${f.forum}` : f.stage,
          duration: durationMatch ? durationMatch[0] : 'Statutory timeline',
          note: f.note || ''
        };
      });
    }
    const cat = (this.spec.category || '').toLowerCase();
    if (cat.includes('criminal') || this.spec.id.includes('bail')) {
      return [
        { court: 'Magistrate Court (Bail / Remand Hearing)', duration: '1 – 7 Days', note: 'Emergency personal liberty applications' },
        { court: 'Sessions Court (Regular Criminal Trial)', duration: '6 – 18 Months', note: 'Charge framing, prosecution evidence & judgment' },
        { court: 'High Court (Criminal Appeal / Quashing Section 528 BNSS)', duration: '1 – 3 Years', note: 'Statutory appellate examination' }
      ];
    }
    if (cat.includes('property')) {
      return [
        { court: 'Civil Court (Interim Injunction / Status Quo)', duration: '2 – 6 Weeks', note: 'Urgent stay and preservation of property' },
        { court: 'District Civil Judge (Full Evidence & Title Trial)', duration: '18 – 36 Months', note: 'Documentary evidence, cross-examination & decree' },
        { court: 'High Court (First Civil Appellate Bench)', duration: '2 – 4 Years', note: 'Appellate adjudication on questions of law' }
      ];
    }
    return [
      { court: 'Trial Court / Competent Judicial Tribunal', duration: '6 – 12 Months', note: 'Initial petition, reply & framing of issues' },
      { court: 'State High Court (Appellate Jurisdiction)', duration: '1 – 3 Years', note: 'Statutory appeal or Article 226 Writ Petition' },
      { court: 'Supreme Court of India (Special Leave Petition / Article 136)', duration: '2 – 4 Years', note: 'Apex constitutional and precedent review' }
    ];
  });

  isStrongMatch(advocate: LawyerPreview): boolean {
    if (!this.spec) return false;
    const currentName = this.spec.name.toLowerCase();
    const currentCat = this.spec.category.toLowerCase();
    const specs = advocate.specializations || [];
    return specs.some(s => {
      const lower = s.toLowerCase();
      return lower.includes(currentName) || currentName.includes(lower) || lower.includes(currentCat);
    });
  }

  isAdvocateInUserCity(advocate: LawyerPreview): boolean {
    if (!advocate?.city) return false;
    const aCity = advocate.city.toLowerCase().trim();
    const raw = (this.activeLocation() || '').toLowerCase();
    const full = this.userCity().toLowerCase();
    const short = this.userCityShort().toLowerCase();
    return raw.includes(aCity) || full.includes(aCity) || short.includes(aCity) || aCity.includes(short);
  }

  formatLanguagesShort(langs?: string[]): string {
    if (!langs || !langs.length) return '';
    const map: Record<string, string> = {
      English: 'En',
      Hindi: 'Hi',
      Bengali: 'Bn',
      Marathi: 'Mr',
      Telugu: 'Te',
      Tamil: 'Ta',
      Gujarati: 'Gu',
      Urdu: 'Ur',
      Kannada: 'Kn',
      Odia: 'Or',
      Malayalam: 'Ml',
      Punjabi: 'Pa',
      Assamese: 'As',
      Sanskrit: 'Sa'
    };
    return langs.map(l => map[l] || (l.length <= 3 ? l : l.slice(0, 2))).join(', ');
  }

  getCourtTier(forum: string): { label: string; tier: string; badgeClass: string } {
    const f = forum.toLowerCase();
    if (f.includes('supreme')) {
      return { label: 'Apex Judiciary', tier: 'Tier 1', badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' };
    }
    if (f.includes('high court') || f.includes('appellate') || f.includes('nclat')) {
      return { label: 'Appellate Forum', tier: 'Tier 2', badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' };
    }
    return { label: 'Trial & Tribunal', tier: 'Tier 3', badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30' };
  }

  ngOnInit() {
    this.hydrateRole();
    this.loadChecklistState();
    this.checkFirstTimerDismissal();
    this.loadBackendIntelligence();
    this.loadAlertStatus();

    // Listen to auth changes
    this.subs.push(
      this.authService.isLoggedIn$.subscribe(() => {
        this.hydrateRole();
        this.loadBackendIntelligence();
        this.loadAlertStatus();
        this.cdr.markForCheck();
      })
    );

    // Real-world debounced auto-save pipeline (800ms quiet period)
    this.subs.push(
      this.noteDebounceSubject.pipe(
        debounceTime(800),
        distinctUntilChanged()
      ).subscribe(text => {
        this.executeAutoSave(text);
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['spec'] && this.spec) {
      this.advocatePage.set(1);
      this.loadChecklistState();
      this.readMoreDesc.set(false);
      this.activeNoteKey.set(null);
      this.selectedAdvocatesForCompare.set([]);
      this.isCompareSheetOpen.set(false);
      this.activeFaqIndex.set(null);
      this.serverLawyerPosition.set(null);
      this.demandIntelligence.set(null);
      this.activeMatter.set(null);
      this.loadAlertStatus();
      this.loadBackendIntelligence();
    }
    if (changes['activeTab'] && !changes['activeTab'].firstChange) {
      if (this.scrollContainer?.nativeElement) {
        this.scrollContainer.nativeElement.scrollTop = 0;
      }
    }
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    this.pendingTimeouts.forEach(t => clearTimeout(t));
    this.pendingTimeouts.length = 0;
    if (this.speechService.isSpeaking) {
      this.speechService.stop();
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    if (!this.isOpen) return;

    if (event.key === 'Escape') {
      if (this.showAlertModal()) {
        this.showAlertModal.set(false);
        event.stopPropagation();
      } else if (this.isCompareSheetOpen()) {
        this.isCompareSheetOpen.set(false);
        event.stopPropagation();
      } else if (this.showSoftGateModal()) {
        this.showSoftGateModal.set(false);
        event.stopPropagation();
      } else if (this.showCostBreakdown()) {
        this.showCostBreakdown.set(false);
        event.stopPropagation();
      } else if (this.activeNoteKey()) {
        this.closeNoteEditor();
        event.stopPropagation();
      } else {
        this.onClose();
        event.stopPropagation();
      }
    }
  }

  /**
   * Load asynchronous intelligence signals from backend (L2, L3, C1)
   */
  loadBackendIntelligence() {
    if (!this.spec) return;
    const areaId = this.spec.id;

    if (this.isLawyer()) {
      const currentFee = this.lawyerPosition()?.userFee || 2000;
      this.practiceService.getLawyerPosition(areaId, this.userCity(), currentFee).subscribe({
        next: (data) => {
          if (data) {
            this.serverLawyerPosition.set(data);
            this.cdr.markForCheck();
          }
        }
      });

      this.practiceService.getDemandIntelligence(areaId).subscribe({
        next: (data) => {
          if (data) {
            this.demandIntelligence.set(data);
            this.cdr.markForCheck();
          }
        }
      });
    } else if (this.isClient()) {
      this.practiceService.getMyActiveMatter(areaId).subscribe({
        next: (data) => {
          if (data) {
            this.activeMatter.set(data);
            this.cdr.markForCheck();
          }
        }
      });
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ADVOCATE AVAILABILITY ALERT (FEATURE C6) LIFECYCLE HANDLERS
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Toggles an alert notification delivery channel (in-app or email).
   * Enforces a business invariant requiring at least one channel to stay active.
   *
   * @param channel The delivery mechanism to toggle
   */
  toggleAlertChannel(channel: 'in_app' | 'email'): void {
    const current = new Set(this.alertChannels());
    if (current.has(channel)) {
      if (current.size > 1) {
        current.delete(channel);
      } else {
        this.snackbar.show('Select at least one delivery channel for your alert', 'warning', 2200);
        return;
      }
    } else {
      current.add(channel);
    }
    this.alertChannels.set(current);
  }

  /**
   * Queries whether a specific notification channel is currently active.
   *
   * @param channel The notification delivery channel
   * @returns boolean true if selected
   */
  isChannelSelected(channel: 'in_app' | 'email'): boolean {
    return this.alertChannels().has(channel);
  }

  /**
   * Synchronizes alert subscription state from the backend DB (for authenticated users)
   * or the local browser storage (for guest sessions).
   */
  loadAlertStatus(): void {
    if (!this.spec) return;
    const localKey = `lc_subscribed_alert_${this.spec.id}`;
    if (typeof window !== 'undefined' && localStorage.getItem(localKey) === '1') {
      this.alertSubscribed.set(true);
    } else {
      this.alertSubscribed.set(false);
    }

    if (this.viewerRole() !== 'guest') {
      this.practiceService.getAlertStatus(this.spec.id).subscribe({
        next: (res) => {
          if (res && res.subscribed) {
            this.alertSubscribed.set(true);
            if (res.alertType === 'available_now' || res.alertType === 'free_consult') {
              this.selectedAlertType.set(res.alertType);
            }
            if (Array.isArray(res.channels) && res.channels.length > 0) {
              const validChannels = res.channels.filter((c): c is 'in_app' | 'email' =>
                c === 'in_app' || c === 'email'
              );
              if (validChannels.length > 0) {
                this.alertChannels.set(new Set(validChannels));
              }
            }
            if (typeof window !== 'undefined' && this.spec) {
              localStorage.setItem(localKey, '1');
            }
            this.cdr.markForCheck();
          }
        },
        error: () => { }
      });
    }
  }

  /**
   * Registers or updates an advocate availability alert for the active practice area.
   * Dispatches chosen alert trigger ('available_now' or 'free_consult') and delivery channels.
   */
  subscribeAlert(): void {
    if (!this.spec) return;
    const specId = this.spec.id;
    this.isSubscribingAlert.set(true);
    const alertType = this.selectedAlertType();
    const channels = Array.from(this.alertChannels());
    const city = this.userCity();

    this.practiceService.subscribeAvailabilityAlert(specId, city, alertType, channels).subscribe({
      next: (res) => {
        this.isSubscribingAlert.set(false);
        this.alertSubscribed.set(true);
        this.showAlertModal.set(false);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`lc_subscribed_alert_${specId}`, '1');
        }
        const msg = res?.message || `Alert radar active for ${city || 'your area'}. We will notify you promptly!`;
        this.snackbar.show(msg, 'success', 3500);
        this.cdr.markForCheck();
      },
      error: () => {
        this.isSubscribingAlert.set(false);
        this.snackbar.show('Could not register alert at this time', 'warning', 3000);
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Unsubscribes from advocate availability notifications and clears both cloud and local records.
   */
  unsubscribeAlert(): void {
    if (!this.spec) return;
    const specId = this.spec.id;
    const specName = this.spec.name;
    this.isUnsubscribingAlert.set(true);
    this.practiceService.unsubscribeAvailabilityAlert(specId).subscribe({
      next: () => {
        this.isUnsubscribingAlert.set(false);
        this.alertSubscribed.set(false);
        this.showAlertModal.set(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`lc_subscribed_alert_${specId}`);
        }
        this.snackbar.show(`Alert cancelled for ${specName}`, 'info', 2500);
        this.cdr.markForCheck();
      },
      error: () => {
        this.isUnsubscribingAlert.set(false);
        this.alertSubscribed.set(false);
        this.showAlertModal.set(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`lc_subscribed_alert_${specId}`);
        }
        this.snackbar.show('Alert cancelled', 'info', 2000);
        this.cdr.markForCheck();
      }
    });
  }

  // Hydrate viewer role synchronously
  private hydrateRole() {
    const cached = this.tokenStorage.getCachedUser();
    const token = this.tokenStorage.getToken();
    if (token && cached) {
      const roleStr = String(cached.role || cached.Role || '').toLowerCase();
      if (roleStr === 'lawyer' || roleStr === 'advocate') {
        this.viewerRole.set('lawyer');
        this.jargonMode.set('legal');
      } else {
        this.viewerRole.set('client');
        this.jargonMode.set('simple');
      }
    } else {
      this.viewerRole.set('guest');
      this.jargonMode.set('simple');
    }
  }

  // Load persisted document checklist
  private loadChecklistState() {
    if (!this.spec || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(`lc_checklist_${this.spec.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.checkedDocuments.set(new Set(parsed));
        }
      } else {
        this.checkedDocuments.set(new Set());
      }
    } catch {
      this.checkedDocuments.set(new Set());
    }
  }

  private saveChecklistState() {
    if (!this.spec || typeof window === 'undefined') return;
    try {
      const arr = Array.from(this.checkedDocuments());
      localStorage.setItem(`lc_checklist_${this.spec.id}`, JSON.stringify(arr));
    } catch { }
  }

  private checkFirstTimerDismissal() {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem('lc_drawer_first_timer_dismissed') === '1';
      this.isFirstTimerDismissed.set(dismissed);
    }
  }

  dismissFirstTimerCard() {
    this.isFirstTimerDismissed.set(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lc_drawer_first_timer_dismissed', '1');
    }
  }

  setJargonMode(mode: 'simple' | 'legal') {
    this.jargonMode.set(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lc_jargon_mode', mode);
    }
    if (mode === 'simple') {
      this.snackbar.show('Switched to Plain English (Jargon-free explanation)', 'info', 2500);
    } else {
      this.snackbar.show('Switched to Statutory Legal Terminology', 'info', 2500);
    }
    this.cdr.markForCheck();
  }

  toggleJargonMode() {
    this.setJargonMode(this.jargonMode() === 'simple' ? 'legal' : 'simple');
  }

  getSimpleTagline(spec: PracticeArea): string {
    // 1. If backend database contains a real simpleTagline, prioritize it dynamically
    if ((spec as any).simpleTagline) {
      return (spec as any).simpleTagline;
    }

    const id = (spec.id || '').toLowerCase();
    const cat = (spec.category || '').toLowerCase();

    const taglines: Record<string, string> = {
      'bail-matters': 'Fast emergency legal help to keep you or your family member out of police custody.',
      'criminal-law': 'Dedicated legal defense to protect your freedom, rights, and reputation against criminal charges.',
      'ndps-cases': 'Urgent legal defense for narcotics allegations, unlawful searches, and NDPS bail hearings.',
      'cyber-crime': 'Help recover stolen money from online frauds and protect yourself from digital harassment.',
      'property-disputes': 'Safeguard your family land, flats, and home inheritance from illegal possession or partition fights.',
      'rera-compliance': 'Hold builders accountable for delayed flat delivery, construction defects, and refund claims.',
      'civil-litigation': 'Recover unpaid money, enforce contracts, and get court injunctions to protect your rights.',
      'arbitration-adr': 'Resolve business and contractual disputes quickly outside court through professional mediation.',
      'consumer-protection': 'Get full refunds and compensation for defective products, bad service, and rejected insurance claims.',
      'family-matrimonial': 'Compassionate, confidential support for mutual divorce, fair alimony, and child custody.',
      'family-law': 'Compassionate legal guidance for divorce, child custody, and family property settlement.',
      'labour-employment': 'Stand up against illegal termination, unpaid salary/gratuity, and workplace harassment.',
      'intellectual-property': 'Register and protect your brand name, logo, software copyright, and creative inventions.',
      'cheque-bounce-ni-act': 'Swift legal notices and court filings to recover money from bounced cheques.',
      'motor-accident-claims': 'Claim maximum fair compensation from insurance companies for road accident injuries and vehicle damage.',
      'immigration-law': 'Hassle-free legal assistance for visa rejections, OCI cards, deportations, and citizenship issues.',
      'insolvency-bankruptcy': 'Recover dues from defaulting companies or restructure business debt through NCLT.',
      'public-interest-litigation': 'Fight against unfair government actions and protect public welfare through High Court or Supreme Court writs.'
    };

    if (taglines[id]) {
      return taglines[id];
    }

    if (cat.includes('criminal')) return 'Protecting your personal liberty, rights, and fair treatment in court.';
    if (cat.includes('property') || cat.includes('real estate')) return 'Protecting your land, home ownership, and property investments.';
    if (cat.includes('family')) return 'Compassionate legal support for your family, marriage, and children.';
    if (cat.includes('corporate') || cat.includes('commercial')) return 'Practical legal guidance for running, funding, and protecting your business.';
    if (cat.includes('consumer')) return 'Defending your rights against unfair business practices and bad service.';

    return spec.tagline || 'Clear, straightforward legal assistance without confusing legal jargon.';
  }

  getSimpleDescription(spec: PracticeArea): string {
    // 1. If backend database contains a real simpleDescription, prioritize it dynamically
    if ((spec as any).simpleDescription) {
      return (spec as any).simpleDescription;
    }

    const id = (spec.id || '').toLowerCase();

    const descriptions: Record<string, string> = {
      'bail-matters': `If you or a loved one is facing arrest, has been detained by police, or received an urgent summons, a bail lawyer steps in immediately to safeguard your personal liberty.

• Anticipatory Bail: Applied before arrest if you fear false implication or imminent police action, preventing the police from taking you into custody.
• Regular Bail: Applied after arrest to secure immediate release from judicial or police custody on personal surety.
• Interim & Transit Bail: Temporary emergency protection allowing safe travel across state borders to appear before the appropriate court.

Your lawyer appears before the Magistrate or Sessions Court within hours to ensure constitutional protections (Article 21) are enforced.`,

      'criminal-law': `When accused of a criminal offense under the new criminal codes (Bharatiya Nyaya Sanhita - BNS) or IPC, a criminal defense lawyer represents your side, challenges false allegations, and ensures fair treatment.

• Immediate Rights Protection: Preventing unlawful police harassment, custodial torture, and ensuring proper procedure during arrest.
• Courtroom Defense: Cross-examining witnesses, challenging questionable evidence, and presenting your defense during trial.
• Appeals & Quashing: Approaching the High Court to quash bogus FIRs or appeal unfair convictions.`,

      'ndps-cases': `Offenses involving narcotics and psychotropic substances carry strict bail conditions under Section 37 of the NDPS Act. An experienced NDPS advocate is crucial from the moment of seizure.

• Search & Seizure Compliance: Checking whether police followed mandatory protocols (Section 42 & 50) during searches.
• Chemical Analysis Verification: Challenging drug quantity categorizations (small vs commercial quantity) to enable bail.
• Emergency High Court Bail: Filing for statutory release where mandatory timelines or procedural safeguards were breached.`,

      'cyber-crime': `If you lost money to an online scam, had your identity stolen, or face cyber harassment, specialized cyber lawyers help you take fast action with police and banks.

• Financial Fraud Recovery: Freezing fraudulent beneficiary bank accounts quickly (golden hour action) and coordinating with cyber cells.
• Online Blackmail & Harassment: Filing emergency takedown complaints and securing protective orders against digital threats.
• Defense in IT Act Allegations: Protecting individuals wrongfully accused in corporate data leaks or online transactions.`,

      'property-disputes': `Property disputes often involve high stakes and family tensions. A property advocate helps secure your legal ownership and protects against encroachment.

• Title Verification: Deep inspection of 30-year deed records, encumbrances, and municipal clearances before you buy.
• Partition & Inheritance: Legally dividing ancestral agricultural land, residential plots, or commercial buildings among rightful heirs.
• Urgent Stay Orders (Injunctions): Stopping illegal construction, unauthorized selling, or forceful eviction through fast court orders.`,

      'rera-compliance': `If a real estate builder delays handing over your flat, demands illegal extra charges, or changes floor plans without permission, RERA empowers homebuyers.

• Delay Interest Compensation: Claiming monthly interest for every month of construction delay.
• Full Refund with Interest: Demanding your entire invested amount back if the project is stalled.
• Fast Execution Orders: Attaching builder bank accounts and assets if court compensation orders are ignored.`,

      'civil-litigation': `Civil law resolves non-criminal disputes where one party owes money, broke a contract, or damaged your property or business.

• Money Recovery Suits: Fast-track recovery suits (Order 37 CPC) for unpaid bills, dishonored commitments, or business dues.
• Contract Enforcement: Forcing contracting parties to perform agreed duties or pay damages for breach of contract.
• Injunctions & Declarations: Obtaining urgent court orders to preserve the status quo and declare legal ownership.`,

      'arbitration-adr': `Instead of spending years in court, commercial parties can resolve disagreements through private arbitration or certified mediation.

• Interim Protection (Section 9): Getting court orders to freeze disputed assets before arbitration starts.
• Arbitrator Appointment: Appointing neutral, certified arbitrators through High Court petitions.
• Fast-Track Enforcement: Enforcing arbitral awards with the same power as a civil court decree.`,

      'consumer-protection': `If a company sells you a defective product, an airline or hospital provides deficient service, or an insurance company unfairly rejects your claim, you have strong consumer rights.

• Direct Legal Notice: Putting the company on notice for refund, replacement, and damage costs.
• Consumer Commission Filing: Inexpensive, fast-track court proceedings without complex procedural delays.
• Compensation for Mental Agony: Seeking financial relief for stress, financial losses, and harassment.`,

      'family-matrimonial': `Navigating matrimonial strain requires emotional sensitivity and firm legal guidance to protect your rights and future.

• Mutual Consent Divorce: The quickest, least stressful route to separation where both partners mutually agree on terms.
• Child Custody & Visitation: Ensuring the best welfare, education, and living conditions for children with fair parental access.
• Maintenance & Alimony: Securing fair living expenses and emergency financial protection under domestic relations law.`,

      'family-law': `Navigating matrimonial strain requires emotional sensitivity and firm legal guidance to protect your rights and future.

• Mutual Consent Divorce: The quickest, least stressful route to separation where both partners mutually agree on terms.
• Child Custody & Visitation: Ensuring the best welfare, education, and living conditions for children with fair parental access.
• Maintenance & Alimony: Securing fair living expenses and emergency financial protection under domestic relations law.`,

      'labour-employment': `Protecting your livelihood and workplace dignity against unlawful corporate practices.

• Unlawful Termination: Challenging sudden firings, retaliatory actions, or denial of contractual notice pay.
• Unpaid Dues & Severance: Recovering pending salaries, gratuity, provident fund, and accrued bonuses.
• Workplace Harassment (POSH): Ensuring fair, unbiased Internal Committee inquiries for dignified workplaces.`,

      'intellectual-property': `Protecting your ideas, creative works, and brand identity from being copied or stolen.

• Trademark Filing & Defense: Registering brand names/logos and sending Cease & Desist notices to infringers.
• Copyright Protection: Safeguarding software code, artistic works, music, and literary content.
• Commercial Licensing: Drafting royalty, assignment, and franchise agreements.`,

      'cheque-bounce-ni-act': `If someone issued you a cheque that bounced due to insufficient funds, the law gives you a powerful legal remedy under Section 138 of the Negotiable Instruments Act.

• Statutory 15-Day Demand Notice: Formal legal warning requiring the payer to clear dues within 15 days of notice receipt.
• Fast Magistrate Court Filing: Filing a criminal complaint if payment is ignored, carrying potential 2x compensation and jail terms.
• Interim Settlement: Negotiating out-of-court recovery or securing 20% interim compensation ordered by the court.`,

      'motor-accident-claims': `Road accidents cause medical emergencies, financial loss, and emotional distress. An accident claims advocate ensures insurance companies pay what you deserve.

• Full Medical Expense Recovery: Reimbursing hospitalization, surgeries, and future medical treatment.
• Loss of Earning Capacity: Calculating lifetime income loss in cases of permanent disability or fatal accidents.
• Fast Tribunal Adjudication: Filing claims before MACT tribunals without paying upfront heavy court fees.`,

      'immigration-law': `Cross-border legal matters require strict adherence to passport, visa, and citizenship rules.

• Visa Denials & Appeals: Overturning arbitrary visa rejections and travel bans.
• OCI Card Assistance: Restoring cancelled OCI cards and resolving foreign spouse eligibility.
• Police Verification & FRRO: Representing non-residents in registration, overstay penalties, and clearance certificates.`,

      'insolvency-bankruptcy': `When a company or borrower fails to pay significant debts, the Insolvency and Bankruptcy Code (IBC) provides rapid corporate recovery.

• Recovery for Creditors: Filing Section 7 or Section 9 petitions before NCLT to recover unpaid invoices or loan defaults.
• Corporate Restructuring: Formulating and submitting resolution plans to revive stressed businesses.
• Protection of Directors: Defending against personal insolvency claims and director disqualifications.`,

      'public-interest-litigation': `When public authorities act arbitrarily or violate fundamental constitutional rights, constitutional writs hold them accountable.

• Writ Petitions: Approaching the High Court (Article 226) or Supreme Court (Article 32) for Habeas Corpus, Mandamus, or Certiorari.
• Environmental & Consumer PILs: Filing public interest litigation to halt unlawful pollution or systemic negligence.
• Protection of Civil Liberties: Enforcing rights to clean air, water, education, and equality before the law.`
    };

    if (descriptions[id]) {
      return descriptions[id];
    }

    // Generic intelligent breakdown for any other practice area
    return `Plain English summary for ${spec.name}:

• Practical Help: An advocate specializing in ${spec.name} helps you navigate complicated regulations, draft legally binding documents, and represent you before judicial authorities.
• Dispute Prevention: Getting advice early prevents expensive court battles and protects your financial and personal rights.
• Court Representation: If disputes arise, your lawyer prepares petitions, handles evidence, and represents you before the appropriate courts or tribunals.`;
  }

  getSimpleHindiDescription(spec: PracticeArea): string {
    // 1. If backend database contains a real simpleDescription_hi, prioritize it dynamically
    if (spec.simpleDescription_hi) {
      return spec.simpleDescription_hi;
    }

    const id = (spec.id || '').toLowerCase();

    const hindiDescriptions: Record<string, string> = {
      'bail-matters': `अगर आप या आपके किसी परिजन को पुलिस द्वारा गिरफ़्तार किए जाने का डर है, या हिरासत में लिया गया है, तो एक ज़मानत (Bail) वकील तुरंत मदद करता है ताकि आपको जेल न जाना पड़े।

• अग्रिम ज़मानत (Anticipatory Bail): गिरफ़्तारी से पहले ली जाती है ताकि झूठी शिकायत पर पुलिस आपको हिरासत में न ले सके।
• नियमित ज़मानत (Regular Bail): अगर गिरफ़्तारी हो चुकी है, तो तुरंत कोर्ट से रिहाई कराने के लिए लगाई जाती है।
• ट्रांजिट ज़मानत (Transit Bail): दूसरे राज्य में जाने और संबंधित कोर्ट में पेश होने के लिए अंतरिम सुरक्षा देती है।

वकील कुछ ही घंटों में मजिस्ट्रेट या सेशंस कोर्ट में अर्जी लगाकर आपकी स्वतंत्रता की रक्षा करता है।`,

      'criminal-law': `जब किसी पर नए आपराधिक क़ानून (BNS) या IPC के तहत आरोप लगते हैं, तो क्रिमिनल वकील आपकी तरफ़ से कोर्ट में लड़ता है और निष्पक्ष न्याय सुनिश्चित करता है।

• अधिकारों की सुरक्षा: पुलिस द्वारा अवैध प्रताड़ना रोकना और गिरफ़्तारी के नियमों का पालन कराना।
• कोर्ट में बचाव: गवाहों से सवाल-जवाब करना और झूठे सबूतों को खारिज कराना।
• FIR रद्द कराना: फर्जी मुकदमों को हाई कोर्ट में चुनौती देकर खारिज (Quash) कराना।`,

      'ndps-cases': `नशीले पदार्थों और दवाओं से जुड़े मामलों (NDPS Act) में ज़मानत के बहुत सख्त नियम होते हैं। ऐसे में अनुभवी वकील की तुरंत सहायता आवश्यक होती है।

• तलाशी प्रक्रिया की पड़ताल: पुलिस ने तलाशी लेते समय धारा 50 व अन्य क़ानूनी नियमों का सही पालन किया या नहीं।
• मात्रा की जाँच: कम मात्रा (Small) और व्यावसायिक मात्रा (Commercial) की सटीक क़ानूनी जाँच ताकि ज़मानत का रास्ता खुले।
• हाई कोर्ट में ज़मानत: प्रक्रियागत चूक के आधार पर तुरंत ज़मानत याचिका दाखिल करना।`,

      'cyber-crime': `यदि आपके साथ ऑनलाइन फ्रॉड, बैंक खाता हैक, यूपीआई ठगी या सोशल मीडिया पर ब्लैकमेलिंग हुई है, तो साइबर वकील पुलिस और बैंकों से मिलकर त्वरित कार्रवाई कराते हैं।

• डूबे पैसे को फ्रीज कराना: फ्रॉड के तुरंत बाद (गोल्डन ऑवर) ठगों के बैंक खातों को होल्ड कराना।
• ऑनलाइन ब्लैकमेलिंग से राहत: साइबर सेल में तुरंत शिकायत दर्ज कर आपत्तिजनक सामग्री हटवाना।
• आईटी एक्ट से सुरक्षा: अनजाने में ऑनलाइन विवादों में फंसे लोगों का कोर्ट में बचाव करना।`,

      'property-disputes': `ज़मीन या मकान के विवादों में परिवार की संपत्ति सुरक्षित रखने और अवैध क़ब्ज़े से बचाने के लिए प्रॉपर्टी वकील सहायता करते हैं।

• मालिकाना हक़ की जाँच (Title Check): प्रॉपर्टी खरीदने से पहले पिछले 30 सालों के कागज़ात और रिकॉर्ड्स की पड़ताल।
• पैतृक संपत्ति का बँटवारा (Partition): पुश्तैनी ज़मीन या मकान का भाइयों व उत्तराधिकारियों में क़ानूनी बँटवारा।
• स्टे ऑर्डर (Injunction): अवैध निर्माण या ज़बरन क़ब्ज़ा रोकने के लिए कोर्ट से तुरंत रोक आदेश प्राप्त करना।`,

      'rera-compliance': `अगर बिल्डर ने फ्लैट देने में देरी की है, अतिरिक्त पैसों की अनुचित मांग की है, या वादे पूरे नहीं किए, तो रेरा (RERA) कानून ग्राहकों को मजबूत अधिकार देता है।

• देरी का ब्याज: हर महीने की देरी के लिए बिल्डर से मासिक ब्याज मुआवज़ा दिलाना।
• पूरा पैसा वापस (Refund): प्रोजेक्ट रुकने पर ब्याज सहित पूरी राशि वापस मांगना।
• आदेश का पालन (Execution): कोर्ट के आदेश के बाद भी बिल्डर पैसा न दे तो उसके बैंक खाते सीज़ कराना।`,

      'civil-litigation': `दीवानी कानून (Civil Law) गैर-आपराधिक मामलों को सुलझाता है, जैसे बकाया पैसे की वसूली, अनुबंध (कॉन्ट्रैक्ट) का उल्लंघन या संपत्ति विवाद।

• पैसे की वसूली का मुकदमा (Order 37): बिना किसी देरी के बकाया बिल या लेन-देन का पैसा कोर्ट से वापस पाना।
• अनुबंध लागू कराना: समझौते के अनुसार सामने वाले पक्ष से काम कराना या हर्जाना वसूलना।
• कोर्ट से स्टे (Injunction): किसी भी पक्ष को संपत्ति बेचने या नुकसान पहुंचाने से रोकने का तुरंत आदेश।`,

      'arbitration-adr': `सालों-साल कोर्ट के चक्कर लगाने के बजाय आपसी सहमति या मध्यस्थता (Arbitration) से विवाद को जल्द सुलझाना।

• संपत्ति की सुरक्षा (Section 9): मध्यस्थता शुरू होने से पहले विवादित संपत्ति को सुरक्षित कराने का कोर्ट आदेश।
• निष्पक्ष मध्यस्थ की नियुक्ति: हाई कोर्ट के जरिए निष्पक्ष जज या मध्यस्थ तय कराना।
• त्वरित फैसला: मध्यस्थ के फैसले को कोर्ट की डिक्री जितनी क़ानूनी मान्यता मिलना।`,

      'consumer-protection': `यदि किसी कंपनी ने ख़राब सामान बेचा, अस्पताल या एयरलाइंस ने घटिया सेवा दी, या बीमा कंपनी ने क्लेम खारिज किया, तो उपभोक्ता अदालत आपकी मदद करती है।

• कंपनी को लीगल नोटिस: पूरे रिफंड, नए सामान और हर्जाने की सीधी मांग।
• उपभोक्ता आयोग में शिकायत: बिना भारी कोर्ट फीस और वकीलों के झंझट के तेज़ न्याय।
• मानसिक प्रताड़ना का हर्जाना: तनाव और वित्तीय नुकसान की भरपाई।`,

      'family-matrimonial': `पारिवारिक और वैवाहिक तनाव के समय एक फैमिली वकील संवेदनशील और निष्पक्ष क़ानूनी मार्गदर्शन प्रदान करता है।

• आपसी सहमति से तलाक़ (Mutual Consent): दोनों पक्षों की रज़ामंदी से सबसे त्वरित और कम तनावपूर्ण अलगाव।
• बच्चों की कस्टडी (Child Custody): बच्चों की पढ़ाई, परवरिश और भविष्य को ध्यान में रखकर निष्पक्ष अधिकार तय कराना।
• गुज़ारा भत्ता (Maintenance): महिलाओं और बच्चों के लिए सम्मानजनक मासिक खर्च और वित्तीय सुरक्षा सुनिश्चित करना।`,

      'family-law': `पारिवारिक और वैवाहिक तनाव के समय एक फैमिली वकील संवेदनशील और निष्पक्ष क़ानूनी मार्गदर्शन प्रदान करता है।

• आपसी सहमति से तलाक़ (Mutual Consent): दोनों पक्षों की रज़ामंदी से सबसे त्वरित और कम तनावपूर्ण अलगाव।
• बच्चों की कस्टडी (Child Custody): बच्चों की पढ़ाई, परवरिश और भविष्य को ध्यान में रखकर निष्पक्ष अधिकार तय कराना।
• गुज़ारा भत्ता (Maintenance): महिलाओं और बच्चों के लिए सम्मानजनक मासिक खर्च और वित्तीय सुरक्षा सुनिश्चित करना।`,

      'labour-employment': `नौकरी में अवैध बर्ख़ास्तगी, बकाया वेतन, ग्रेच्युटी न मिलना या कार्यस्थल पर उत्पीड़न के ख़िलाफ़ आपके अधिकारों की रक्षा।

• बिना नोटिस निकालना: अचानक या अवैध रूप से नौकरी से निकालने को लेबर कोर्ट में चुनौती।
• बकाया वेतन व ग्रेच्युटी: महीनों से रुका हुआ वेतन, पीएफ और ग्रेच्युटी का क़ानूनी भुगतान दिलाना।
• कार्यस्थल पर सुरक्षा (POSH): सम्मानजनक काम के माहौल के लिए आंतरिक जाँच समिति में निष्पक्ष प्रतिनिधित्व।`,

      'intellectual-property': `अपने ब्रांड, लोगो, सॉफ्टवेयर या नई खोज (Invention) को चोरी होने या नकल होने से बचाना।

• ट्रेडमार्क व कॉपीराइट: कंपनी का नाम और लोगो रजिस्टर कराना ताकि कोई और इस्तेमाल न कर सके।
• लीगल नोटिस (Cease & Desist): नकल करने वाली कंपनियों को तुरंत काम रोकने का क़ानूनी नोटिस भेजना।
• रॉयल्टी व लाइसेंसिंग: अपने उत्पाद का लाइसेंस देकर सुरक्षित कमाई के क़ानूनी अनुबंध बनाना।`,

      'cheque-bounce-ni-act': `यदि किसी ने आपको चेक दिया और वह खाते में पैसे न होने के कारण बाउंस हो गया, तो धारा 138 NI Act के तहत सख्त क़ानूनी अधिकार मिलते हैं।

• 15 दिन का लीगल नोटिस: चेक बाउंस होने के बाद देनदार को 15 दिन में पैसे चुकाने की अंतिम क़ानूनी चेतावनी।
• मजिस्ट्रेट कोर्ट में केस: पैसे न देने पर क्रिमिनल केस, जिसमें 2 गुना मुआवज़ा या 2 साल तक की जेल हो सकती है।
• अंतरिम मुआवज़ा: केस चलते हुए भी कोर्ट से 20% तक अंतरिम राशि तुरंत दिलाने का प्रावधान।`,

      'motor-accident-claims': `सड़क दुर्घटना में घायल होने या नुकसान होने पर बीमा कंपनी से पूरा और उचित मुआवज़ा दिलाना।

• इलाज के पूरे खर्च की वसूली: अस्पताल, दवाइयों और भविष्य के इलाज का पूरा क्लेम।
• आमदनी के नुकसान की भरपाई: स्थायी चोट या अक्षमता की स्थिति में जीवनभर की आय का मुआवज़ा।
• MACT ट्रिब्यूनल में तेज़ सुनवाई: भारी अदालती खर्च के बिना दुर्घटना ट्रिब्यूनल में केस लड़ना।`,

      'immigration-law': `पासपोर्ट, वीज़ा, विदेश यात्रा और नागरिकता से जुड़े मामलों में क़ानूनी सहायता।

• वीज़ा रिजेक्शन की अपील: गलत तरीक़े से खारिज किए गए वीज़ा के ख़िलाफ़ अपील दायर करना।
• OCI कार्ड व नागरिकता: भारतीय मूल के विदेशी नागरिकों के लिए ओसीआई कार्ड सहायता।
• FRRO व विदेशी पंजीकरण: भारत में प्रवास, पेनल्टी और क्लीयरेंस संबंधी कानूनी प्रक्रियाएं।`,

      'insolvency-bankruptcy': `जब कोई कंपनी या व्यापारी करोड़ों का कर्ज़ या बिल नहीं चुकाता, तो दिवालिया कानून (IBC) के तहत रिकवरी।

• लेनदारों के पैसे की वसूली: NCLT में केस दायर कर बकाए पैसे की त्वरित रिकवरी।
• समाधान योजना: तनावग्रस्त व्यापार को दोबारा खड़ा करने के लिए क़ानूनी पुनर्गठन।
• निदेशकों का बचाव: व्यक्तिगत दिवालियापन के दावों से कंपनी डायरेक्टर्स का बचाव।`,

      'public-interest-litigation': `जब सरकारी अधिकारी मनमानी करें या जनता के बुनियादी अधिकारों का हनन हो, तो कोर्ट से न्याय मांगना।

• रिट याचिका (Writ Petition): हाई कोर्ट या सुप्रीम कोर्ट में मौलिक अधिकारों की रक्षा के लिए याचिका।
• जनहित याचिका (PIL): प्रदूषण, पर्यावरण या सार्वजनिक सेवाओं की बदहाली के ख़िलाफ़ कोर्ट में आवाज़ उठाना।
• निष्पक्षता का अधिकार: स्वच्छ हवा, पानी और क़ानून के सामने बराबरी के अधिकार की रक्षा।`
    };

    if (hindiDescriptions[id]) {
      return hindiDescriptions[id];
    }

    return `${spec.name_hi || spec.name} के लिए सरल हिंदी विवरण:

• क़ानूनी सलाह: इस क्षेत्र के विशेषज्ञ वकील जटिल नियमों को आसान भाषा में समझाते हैं और सही दस्तावेज़ तैयार करते हैं।
• विवादों से बचाव: समय पर क़ानूनी सलाह लेने से कोर्ट-कचहरी के लंबे और महंगे विवादों से बचा जा सकता है।
• कोर्ट में पक्ष रखना: ज़रूरत पड़ने पर संबंधित कोर्ट या ट्रिब्यूनल में आपकी तरफ़ से मज़बूती से पक्ष रखते हैं।`;
  }

  toggleDiscreetMode() {
    this.isDiscreetMode.set(!this.isDiscreetMode());
    if (this.isDiscreetMode()) {
      this.snackbar.show('Discreet browsing mode active. Search history paused.', 'info', 3000);
    }
  }

  quickExit() {
    if (typeof window !== 'undefined') {
      // Rapid escape to innocent educational portal
      window.location.replace('https://www.google.com');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MOBILE DRAG HANDLE TOUCH GESTURE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════

  onDragStart(event: TouchEvent): void {
    this.dragStartY = event.touches[0].clientY;
  }

  onDragMove(event: TouchEvent): void {
    if (this.dragStartY > 0) {
      event.preventDefault();
    }
  }

  onDragEnd(event: TouchEvent): void {
    if (this.dragStartY === 0) return;
    const endY = event.changedTouches[0].clientY;
    const delta = endY - this.dragStartY;
    this.dragStartY = 0;
    // If swiped down more than 80px, close the drawer
    if (delta > 80) {
      this.close.emit();
    }
  }

  getDisplayName(): string {
    if (!this.spec) return '';
    if (this.isHindi && this.spec.name_hi) return this.spec.name_hi;
    return this.spec.name;
  }

  setTab(tab: DrawerTab) {
    this.activeTab = tab;
    this.tabChange.emit(tab);
    if (this.scrollContainer?.nativeElement) {
      this.scrollContainer.nativeElement.scrollTop = 0;
    }
    this.cdr.markForCheck();
  }

  onClose() {
    if (this.speechService.isSpeaking) {
      this.speechService.stop();
    }
    this.close.emit();
  }

  /**
   * Toggles drawer pinning for side-by-side comparison tray.
   * Emits pinToggle event to parent component and displays snackbar feedback.
   */
  onPinToggle() {
    if (this.spec) {
      this.pinToggle.emit(this.spec);
      this.snackbar.show(
        this.isPinned ? `Removed "${this.spec.name}" from compare tray` : `Pinned "${this.spec.name}" to compare tray`,
        'info',
        2500
      );
    }
  }

  /**
   * Emits print briefing action to parent handler.
   */
  onPrint() {
    if (this.spec) {
      this.printClick.emit(this.spec);
    }
  }

  /**
   * Emits consultation roster navigation to parent handler.
   */
  onFindAdvocates() {
    if (this.spec) {
      this.findAdvocatesClick.emit(this.spec);
    }
  }

  /**
   * Handles selection of cross-referenced related practice area.
   */
  handleSelectRelated(area: PracticeArea) {
    this.areaSelect.emit(area);
    if (this.scrollContainer?.nativeElement) {
      this.scrollContainer.nativeElement.scrollTop = 0;
    }
  }

  /**
   * Toggles document preparation checklist item with persistent storage.
   * Displays milestone snackbar celebration when all documents are checked.
   */
  toggleDocumentCheck(doc: string) {
    const current = new Set(this.checkedDocuments());
    const isAdding = !current.has(doc);
    if (isAdding) {
      current.add(doc);
    } else {
      current.delete(doc);
    }
    this.checkedDocuments.set(current);
    this.saveChecklistState();

    const total = this.spec?.documentsChecklist?.length || 0;
    if (isAdding && current.size === total && total > 0) {
      this.snackbar.show('All required documents checked and ready for consultation!', 'success', 3000);
    }
  }

  printChecklist() {
    if (!this.spec) return;
    const items = this.spec.documentsChecklist || [];
    const checked = this.checkedDocuments();
    // Sanitize text to prevent XSS in generated print HTML
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const content = `
      <html>
        <head>
          <title>${esc(this.spec.name)} - Document Checklist</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 32px; color: #1e293b; }
            h1 { font-size: 20px; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
            .subtitle { color: #64748b; font-size: 13px; margin-bottom: 24px; }
            ul { list-style: none; padding: 0; }
            li { padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; display: flex; align-items: center; gap: 12px; }
            .box { width: 18px; height: 18px; border: 2px solid #94a3b8; border-radius: 4px; display: inline-block; }
            .box.checked { background: #3b82f6; border-color: #3b82f6; }
            .footer { margin-top: 36px; font-size: 11px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <h1>LegalConnect: ${esc(this.spec.name)} Document Checklist</h1>
          <div class="subtitle">Jurisdiction: All India &bull; Category: ${esc(this.spec.category)}</div>
          <ul>
            ${items
        .map(
          doc =>
            `<li><span class="box ${checked.has(doc) ? 'checked' : ''}"></span> ${esc(doc)}</li>`
        )
        .join('')}
          </ul>
          <div class="footer">Generated on ${new Date().toLocaleDateString()} from LegalConnect Practice Atlas.</div>
        </body>
      </html>
    `;
    // Use hidden iframe to avoid popup blockers on mobile and modern browsers
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (iframeDoc) {
      iframeDoc.open();
      iframeDoc.write(content);
      iframeDoc.close();
      const printTimeout = setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => { try { document.body.removeChild(iframe); } catch { } }, 1000);
      }, 300);
      this.pendingTimeouts.push(printTimeout);
    } else {
      document.body.removeChild(iframe);
      this.snackbar.show('Could not open print dialog', 'warning', 2500);
    }
  }

  /**
   * Toggles browser speech synthesis for audio accessibility.
   * Supports multilingual narration (Hindi / English) with contextual snackbar feedback.
   */
  toggleSpeech(text: string, id: string) {
    if (this.speechService.isSpeaking && this.speechService.activeSpeakerId === id) {
      this.speechService.stop();
      this.snackbar.show('Audio narration paused', 'info', 1800);
    } else {
      this.speechService.speak(text, this.isHindi, id);
      this.snackbar.show(this.isHindi ? 'विवरण सुनाया जा रहा है...' : 'Narrating statutory overview...', 'info', 2200);
    }
  }

  /**
   * Evaluates if a specific block identifier is currently being read aloud.
   */
  isSpeakingItem(id: string): boolean {
    return this.speechService.isSpeaking && this.speechService.activeSpeakerId === id;
  }

  // Compare advocates in drawer
  toggleAdvocateCompare(advocate: LawyerPreview) {
    const list = [...this.selectedAdvocatesForCompare()];
    const idx = list.findIndex(l => l._id === advocate._id);
    if (idx >= 0) {
      list.splice(idx, 1);
      this.selectedAdvocatesForCompare.set(list);
    } else {
      if (list.length >= 3) {
        this.snackbar.show('You can compare up to 3 advocates simultaneously', 'warning', 3000);
        return;
      }
      list.push(advocate);
      this.selectedAdvocatesForCompare.set(list);
      this.isCompareSheetOpen.set(true);
    }
  }

  isAdvocateSelectedForCompare(advocate: LawyerPreview): boolean {
    return this.selectedAdvocatesForCompare().some(l => l._id === advocate._id);
  }

  removeAdvocateFromCompare(advocateId: string) {
    this.selectedAdvocatesForCompare.set(
      this.selectedAdvocatesForCompare().filter(l => l._id !== advocateId)
    );
  }

  // Handle consult button (soft-gate for guests)
  handleConsult(advocate: LawyerPreview) {
    if (this.viewerRole() === 'guest') {
      this.softGateTargetAdvocate.set(advocate);
      this.showSoftGateModal.set(true);
    } else {
      this.router.navigate(['/lawyers', advocate._id]);
    }
  }

  // Pre-composed WhatsApp referral for lawyers
  referLawyerViaWhatsApp(advocate: LawyerPreview) {
    if (typeof window === 'undefined') return;
    const link = `${window.location.origin}/lawyers/${advocate._id}`;
    const text = `Hello, I recommend consulting Adv. ${advocate.name} (${advocate.city}), specialist in ${this.spec?.name || 'this practice area'}. You can view verified credentials here: ${link}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }

  // Copy citation with format options
  copyCitation(item: LandmarkJudgmentPreview, format: 'standard' | 'formal' = 'standard') {
    let text = `${item.title}, ${item.citation} (${item.court})`;
    if (format === 'formal') {
      text = `[${item.court}] ${item.title} — ${item.citation} (Decided: ${item.decisionDate || 'N/A'})\nRatio: ${item.ratioDecidendi || item.holding}`;
    }
    this.copyToClipboard(text, 'Precedent citation copied to clipboard');
    this.copiedCitationId.set(item.caseId || item.citation);
    const citationTimeout = setTimeout(() => {
      this.copiedCitationId.set(null);
      this.cdr.markForCheck();
    }, 2000);
    this.pendingTimeouts.push(citationTimeout);
  }

  /**
   * Toggles the expanded view for a landmark precedent holding text.
   * Enables users to read the full ruling holding or collapse to 2 lines.
   *
   * @param caseId Unique identifier or citation key of the judicial decision.
   */
  toggleHolding(caseId: string): void {
    if (!caseId) return;
    const current = new Set(this.expandedHoldings());
    if (current.has(caseId)) {
      current.delete(caseId);
    } else {
      current.add(caseId);
    }
    this.expandedHoldings.set(current);
    this.cdr.markForCheck();
  }

  /**
   * Checks whether a specific landmark precedent holding is currently expanded.
   *
   * @param caseId Unique identifier or citation key of the judicial decision.
   * @returns boolean true if the holding is expanded.
   */
  isHoldingExpanded(caseId: string): boolean {
    return this.expandedHoldings().has(caseId);
  }

  copySectionRef(act: ResolvedBareAct) {
    const text = `${act.name} (${act.year || ''}) - Governed under Indian Statutory Code`;
    this.copyToClipboard(text, 'Statute reference copied to clipboard');
  }

  copyToClipboard(text: string, successMsg = 'Copied to clipboard') {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.snackbar.show(successMsg, 'success', 2500);
      }).catch(() => {
        this.fallbackCopy(text, successMsg);
      });
    } else {
      this.fallbackCopy(text, successMsg);
    }
  }

  private fallbackCopy(text: string, msg: string) {
    try {
      if (typeof document !== 'undefined' && typeof document.execCommand === 'function') {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        const success = document.execCommand('copy');
        document.body.removeChild(el);
        if (success) {
          this.snackbar.show(msg, 'success', 2500);
          return;
        }
      }
      this.snackbar.show('Clipboard unavailable. Please copy manually.', 'info', 3000);
    } catch {
      this.snackbar.show('Could not access clipboard', 'warning', 2500);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // RESEARCH NOTE SYSTEM WITH DEBOUNCED AUTO-SAVE & TELEMETRY
  // ═════════════════════════════════════════════════════════════════════════

  /**
   * Opens the responsive research note editor (bottom-sheet on mobile, glass dialog on desktop).
   *
   * @param key Unique compound key identifying the note context (e.g. 'act_IC' or 'case_123')
   * @param title User-facing title for the annotated statute or precedent
   * @param category Note classification ('statute' | 'case' | 'general')
   */
  openNoteEditor(key: string, title: string, category: 'statute' | 'case' | 'general' = 'statute'): void {
    this.activeNoteKey.set(key);
    this.activeNoteTitle.set(title);
    this.noteCategory.set(category);
    const existing = this.noteService.getNoteText('spec_atlas', key);
    this.currentNoteInput.set(existing);
    this.noteSaveStatus.set('saved');
    this.noteLastSavedTime.set(existing ? 'Saved' : null);
    this.isNoteCopied.set(false);
  }

  /**
   * Handles user keystroke input into the research note editor.
   * Updates reactive state and feeds the RxJS 800ms debounce pipeline.
   *
   * @param value The updated raw note text
   */
  onNoteInput(value: string): void {
    this.currentNoteInput.set(value);
    this.noteSaveStatus.set('unsaved');
    this.noteDebounceSubject.next(value);
  }

  /**
   * Executes background persistence without blocking the user or displaying noisy toasts.
   * Updates local telemetry and timestamp indicators.
   *
   * @param text Note content to persist
   */
  private executeAutoSave(text: string): void {
    const key = this.activeNoteKey();
    if (!key) return;
    this.noteSaveStatus.set('saving');
    this.noteService.saveNote('spec_atlas', key, text.trim(), true);
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.noteLastSavedTime.set(timeStr);
    this.noteSaveStatus.set('saved');
  }

  /**
   * Closes the note editor, flushing any pending uncommitted debounced edits before dismissal.
   */
  closeNoteEditor(): void {
    const key = this.activeNoteKey();
    if (key && this.noteSaveStatus() === 'unsaved') {
      this.executeAutoSave(this.currentNoteInput());
    }
    this.activeNoteKey.set(null);
  }

  /**
   * Empties the current note content and synchronously removes it from storage/DB.
   */
  clearNote(): void {
    const key = this.activeNoteKey();
    if (!key) return;
    this.currentNoteInput.set('');
    this.noteService.saveNote('spec_atlas', key, '', true);
    this.noteSaveStatus.set('saved');
    this.noteLastSavedTime.set('Cleared');
    this.snackbar.show('Research note cleared', 'info', 1800);
  }

  /**
   * Copies the note content to the system clipboard with tactile UI state feedback.
   */
  copyNoteText(): void {
    const text = this.currentNoteInput().trim();
    if (!text) return;
    try {
      navigator.clipboard.writeText(text).then(() => {
        this.isNoteCopied.set(true);
        const noteTimeout = setTimeout(() => this.isNoteCopied.set(false), 2000);
        this.pendingTimeouts.push(noteTimeout);
        this.snackbar.show('Note copied to clipboard', 'success', 2000);
      });
    } catch {
      this.snackbar.show('Could not copy note', 'warning', 2000);
    }
  }

  saveNote(): void {
    const key = this.activeNoteKey();
    if (!key) return;
    this.executeAutoSave(this.currentNoteInput());
    this.activeNoteKey.set(null);
    this.snackbar.show('Research note saved securely', 'success', 2000);
  }

  hasNote(key: string): boolean {
    return !!this.noteService.getNoteText('spec_atlas', key);
  }

  getNote(key: string): string {
    return this.noteService.getNoteText('spec_atlas', key);
  }

  // Report inaccurate data
  openReportModal() {
    if (!this.spec) return;
    this.reportService.openReport('LegalResource', this.spec.id, `Practice Area: ${this.spec.name}`);
  }

  // FAQ toggle
  toggleFaq(index: number) {
    if (this.activeFaqIndex() === index) {
      this.activeFaqIndex.set(null);
    } else {
      this.activeFaqIndex.set(index);
    }
  }

  // TrackBy functions for performant OnPush rendering
  trackByCity(_index: number, item: any): string {
    return item.city || String(_index);
  }

  trackByString(_index: number, item: string): string {
    return item;
  }

  trackByNumber(_index: number, item: number): number {
    return item;
  }

  trackByIndex(_index: number): number {
    return _index;
  }

  trackByActName(_index: number, item: any): string {
    return item.name || item;
  }

  trackByCaseId(_index: number, item: any): string {
    return item.caseId || item.citation || String(_index);
  }

  trackByAdvocateId(_index: number, item: any): string {
    return item._id || item.id || String(_index);
  }

  trackByStepStage(_index: number, item: any): string {
    return item.stage || String(_index);
  }

  trackByFaq(_index: number, item: any): string {
    return item.q || String(_index);
  }

  trackByTimeline(_index: number, item: any): string {
    return item.court || String(_index);
  }

  trackByPracticeArea(_index: number, item: PracticeArea): string {
    return item.id;
  }

  /**
   * Safe URL builder for Bare Acts, delegating to the platform StatuteResolverService
   */
  getActUrl(act: ResolvedBareAct | string): string {
    const actName = typeof act === 'string' ? act : act.name;
    const shortAct = typeof act === 'string' ? undefined : (act.shortName || undefined);
    const actUrl = typeof act === 'string' ? undefined : (act.deepLink || undefined);
    return this.statuteResolver.getActUrl({ actName, shortAct, actUrl });
  }

  /**
   * Pre-flight Check & Safe Navigation for Bare Acts.
   * Checks existence in statutory library, opens safely in a new tab, or displays an informative snackbar.
   */
  openBareAct(act: ResolvedBareAct | string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const actName = typeof act === 'string' ? act : act.name;
    const shortAct = typeof act === 'string' ? undefined : (act.shortName || undefined);
    const actUrl = typeof act === 'string' ? undefined : (act.deepLink || undefined);
    this.statuteResolver.navigateToActSafely({ actName, shortAct, actUrl });
  }

  /**
   * Safe URL for Browse Laws library with query search prefilled
   */
  getBrowseLawsUrl(): string {
    if (this.spec?.name) {
      return `/laws?search=${encodeURIComponent(this.spec.name)}`;
    }
    return '/laws';
  }

  /**
   * Browse Laws action handler: opens library in a new tab without interrupting drawer
   */
  onBrowseLaws(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const url = this.getBrowseLawsUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * Formats enactment badge (e.g. "Act 2023" instead of always "Central Act" if year is known)
   */
  getActYear(act: ResolvedBareAct | string): string {
    if (typeof act !== 'string' && act.year) {
      return 'Act ' + act.year;
    }
    const name = typeof act === 'string' ? act : act.name;
    const match = name.match(/\b(18|19|20)\d{2}\b/);
    if (match) {
      return 'Act ' + match[0];
    }
    return 'Central Act';
  }
}