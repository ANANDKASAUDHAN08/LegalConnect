import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ElementRef,
  ViewChild,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AdminApiService } from '../../../core/admin-api.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ToastService } from '../../../shared/services/toast.service';
import { HighlightPipe } from '../../../shared/pipes/highlight.pipe';
import { LegalPrintService } from '../../../core/services/legal-print.service';
import { LegalTextParser, ParsedLegalSection, LegalClauseNode } from '../../../core/utils/legal-text-parser';
import { AdminSectionCardComponent } from './components/admin-section-card/admin-section-card.component';
import { AdminSectionEditModalComponent } from './components/admin-section-edit-modal/admin-section-edit-modal.component';
import { BareAct, EditSectionFormData, EditSectionSaveEvent } from '../legal-content.models';

export interface EnrichedClauseNode extends LegalClauseNode {
  levelClass: string;
  markerClass: string;
  isCallout: boolean;
  calloutClass: string;
  calloutLabel: string;
  children: EnrichedClauseNode[];
}

export interface EnrichedParsedLegalSection extends ParsedLegalSection {
  enrichedNodes: EnrichedClauseNode[];
}

export interface EnrichedSection {
  _id?: string;
  id?: string;
  section_number: string;
  sectionNumber: string;
  secId: string;
  cleanTitle: string;
  cleanBody: string;
  rawContent: string;
  title_hi?: string;
  introduction_text_hi?: string;
  content_hi?: string;
  text_hi?: string;
  content_blocks_hi?: any[];
  hasContent: boolean;
  wordCount: number;
  readingTimeMinutes: number;
  parsed: EnrichedParsedLegalSection;
  parsed_hi?: EnrichedParsedLegalSection;
  chapterNumber: string;
  chapterTitle: string;
  chapKey: string;
  index: number;
  searchTokens: string;
  isBookmarked?: boolean;
}

export interface EnrichedChapter {
  chapterNumber: string;
  chapter_number?: string;
  title: string;
  chapKey: string;
  sections: EnrichedSection[];
  totalSections: number;
  digitizedCount: number;
  pendingCount: number;
}

export interface EnrichedAct {
  actName?: string;
  shortName?: string;
  year?: number | string;
  description?: string;
  preamble?: string;
  totalSections: number;
  totalChapters: number;
  chapters: EnrichedChapter[];
  flatSections: EnrichedSection[];
  sectionMap: Map<string, EnrichedSection>;
}

@Component({
  selector: 'admin-act-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SkeletonComponent,
    TooltipDirective,
    HighlightPipe,
    AdminSectionCardComponent,
    AdminSectionEditModalComponent
  ],
  templateUrl: './act-detail.component.html',
  styleUrl: './act-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('searchInput') searchInputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('jumpSearchInput') jumpSearchInputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('tocScrollContainer') tocScrollContainerEl?: ElementRef<HTMLElement>;

  shortName = '';
  actRaw: BareAct | null = null;
  enrichedAct: EnrichedAct | null = null;
  isLoading = false;

  // Search & Filter State (Debounced)
  searchQuery = '';
  tocSearchQuery = '';
  jumpSearchQuery = '';
  digitizationFilter: 'all' | 'digitized' | 'pending' = 'all';
  showBookmarkedOnly = false;
  private searchSubject = new Subject<string>();
  private tocSearchSubject = new Subject<string>();
  private jumpSearchSubject = new Subject<string>();

  // Filtered / Displayed ViewModels
  displayedChapters: EnrichedChapter[] = [];
  filteredJumpSections: Array<{ section: EnrichedSection; chapterTitle: string }> = [];
  matchingSectionsCount = 0;
  totalDigitizedCount = 0;
  totalPendingCount = 0;

  // Reader Preferences (Persisted)
  readerTheme: 'slate' | 'light' = 'slate';
  fontScale = 100; // 85 to 140
  fontFamily: 'sans' | 'serif' = 'sans';
  viewMode: 'structured' | 'raw' = 'structured';
  activeLanguage: 'en' | 'hi' | 'both' = 'en';
  splitViewMode: 'stacked' | 'split' = 'stacked';
  isTocCollapsed = false;

  // Interactive State
  activeSectionId = '';
  activeSection: EnrichedSection | null = null;
  readingProgress = 0;
  collapsedChapters: Record<string, boolean> = {};
  tocCollapsedChapters: Record<string, boolean> = {};
  collapsedSections: Record<string, boolean> = {};
  showLaymanSummary: Record<string, boolean> = {};
  showDefinedTerms: Record<string, boolean> = {};
  bookmarkedSectionIds = new Set<string>();

  // Modals & Panels
  showReaderSettings = false;
  showBackToTop = false;
  showJumpToSection = false;
  showShortcutsModal = false;
  activeFootnote: { id: string; number: string; text: string } | null = null;

  // Editing Mode
  isEditMode = false;
  editingSection: EnrichedSection | null = null;
  editForm: EditSectionFormData = { section_number: '', title: '', title_hi: '', introduction_text: '', introduction_text_hi: '' };
  editTab: 'en' | 'hi' | 'preview' = 'en';
  isSaving = false;
  isTranslating = false;
  isEnhancing = false;

  // Scrollspy & Interaction Locks
  isUserHoveringToc = false;
  isProgrammaticScrolling = false;
  private isManualScrolling = false;
  private programmaticScrollTimer: ReturnType<typeof setTimeout> | undefined;
  private tocAutoScrollTimeout: ReturnType<typeof setTimeout> | undefined;
  private hoverCooldownTimer: ReturnType<typeof setTimeout> | undefined;
  private scrollSpyDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  private manualScrollIdleTimer: ReturnType<typeof setTimeout> | undefined;
  private sectionObserver: IntersectionObserver | null = null;
  private sectionMutationObserver: MutationObserver | null = null;
  private scrollContainer: HTMLElement | null = null;
  private boundScrollHandler = this.handleContainerScroll.bind(this);
  private subscriptions = new Subscription();

  constructor(
    private route: ActivatedRoute,
    private api: AdminApiService,
    private toast: ToastService,
    private printService: LegalPrintService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private elRef: ElementRef
  ) { }

  ngOnInit(): void {
    this.loadPersistedPreferences();

    // Debounced search streams
    this.subscriptions.add(
      this.searchSubject.pipe(debounceTime(150), distinctUntilChanged()).subscribe(q => {
        this.searchQuery = q;
        this.recalculateDisplayedChapters();
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.tocSearchSubject.pipe(debounceTime(120), distinctUntilChanged()).subscribe(q => {
        this.tocSearchQuery = q;
        this.recalculateDisplayedChapters();
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.jumpSearchSubject.pipe(debounceTime(80), distinctUntilChanged()).subscribe(q => {
        this.jumpSearchQuery = q;
        this.recalculateJumpSections();
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.route.params.subscribe(params => {
        const nextShortName = params['shortName'];
        if (nextShortName && nextShortName !== this.shortName) {
          this.shortName = nextShortName;
          this.fetchActDetail();
        }
      })
    );
  }

  ngAfterViewInit(): void {
    this.scrollContainer = document.querySelector('main.content-body') || document.documentElement;
    if (this.scrollContainer) {
      this.ngZone.runOutsideAngular(() => {
        this.scrollContainer!.addEventListener('scroll', this.boundScrollHandler, { passive: true });
      });
      this.setupScrollspyObserver();
      this.setupSectionMutationObserver();
    }

    // Register document-level event listeners outside Angular zone to avoid CD triggers on every click/keypress
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('click', this.boundDocClickHandler);
      document.addEventListener('keydown', this.boundDocKeydownHandler);
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.boundScrollHandler);
    }
    document.removeEventListener('click', this.boundDocClickHandler);
    document.removeEventListener('keydown', this.boundDocKeydownHandler);
    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
      this.sectionObserver = null;
    }
    if (this.sectionMutationObserver) {
      this.sectionMutationObserver.disconnect();
      this.sectionMutationObserver = null;
    }
    if (this.programmaticScrollTimer) clearTimeout(this.programmaticScrollTimer);
    if (this.tocAutoScrollTimeout) clearTimeout(this.tocAutoScrollTimeout);
    if (this.hoverCooldownTimer) clearTimeout(this.hoverCooldownTimer);
    if (this.scrollSpyDebounceTimer) clearTimeout(this.scrollSpyDebounceTimer);
    if (this.manualScrollIdleTimer) clearTimeout(this.manualScrollIdleTimer);
  }

  /* ═══════════════════════════════════════════════════════
     DATA INGESTION & VIEWMODEL TRANSFORMATION ENGINE
     ═══════════════════════════════════════════════════════ */

  fetchActDetail(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.api.getActDetail(this.shortName).subscribe({
      next: (res: BareAct | { data?: BareAct }) => {
        this.isLoading = false;
        this.actRaw = (res as any).data || (res as BareAct);
        this.enrichActPayload();
        this.actRaw = null; // Release raw payload to GC — enrichedAct holds all needed data

        if (this.enrichedAct?.flatSections?.length) {
          this.activeSection = this.enrichedAct.flatSections[0];
          this.activeSectionId = this.activeSection.secId;
        }

        this.loadBookmarks();
        this.recalculateDisplayedChapters();
        this.recalculateJumpSections();
        this.refreshScrollspyObserver();
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.toast.error('Failed to load Act details.');
        this.cdr.markForCheck();
      }
    });
  }

  private enrichActPayload(): void {
    if (!this.actRaw || !this.actRaw.chapters) {
      this.enrichedAct = null;
      return;
    }

    const flatSections: EnrichedSection[] = [];
    const sectionMap = new Map<string, EnrichedSection>();
    const enrichedChapters: EnrichedChapter[] = [];

    let globalIndex = 0;
    let totalDig = 0;
    let totalPend = 0;

    for (const rawChap of this.actRaw.chapters || []) {
      const chapKey = String(rawChap.chapterNumber || rawChap.chapter_number || rawChap.title || '');
      const chapTitle = String(rawChap.title || '');
      const chapNumber = String(rawChap.chapterNumber || rawChap.chapter_number || '');

      const enrichedSections: EnrichedSection[] = [];
      let chapDig = 0;
      let chapPend = 0;

      for (const rawSec of rawChap.sections || []) {
        const secNum = String(rawSec.section_number || rawSec.sectionNumber || '');
        const cleanTitle = this.computeCleanTitle(rawSec);
        const cleanBody = this.computeCleanBody(rawSec);
        const rawContent = this.safeStringify(rawSec.content || rawSec.introduction_text || rawSec.text || '');
        const hasContent = (rawSec.content_blocks && rawSec.content_blocks.length > 0) || (cleanBody && cleanBody.length > 10);

        if (hasContent) {
          totalDig++;
          chapDig++;
        } else {
          totalPend++;
          chapPend++;
        }

        const wordCount = cleanBody ? cleanBody.trim().split(/\s+/).filter(Boolean).length : 0;
        const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

        // Parse legal AST structure (memoized internally by LegalTextParser)
        const parsedBase = LegalTextParser.parse(cleanBody, cleanTitle);
        const enrichedParsed: EnrichedParsedLegalSection = {
          ...parsedBase,
          enrichedNodes: this.enrichClauseNodes(parsedBase.nodes)
        };

        // Parse Hindi legal AST structure if Hindi content exists
        const cleanBodyHi = this.safeStringify(rawSec.introduction_text_hi || rawSec.content_hi || rawSec.text_hi || '');
        const cleanTitleHi = this.safeStringify(rawSec.title_hi || '');
        let enrichedParsedHi: EnrichedParsedLegalSection | undefined;
        if (cleanBodyHi.trim()) {
          const parsedHiBase = LegalTextParser.parse(cleanBodyHi, cleanTitleHi);
          enrichedParsedHi = {
            ...parsedHiBase,
            enrichedNodes: this.enrichClauseNodes(parsedHiBase.nodes)
          };
        }

        // Lightweight search tokens: only section number + titles (not full body text)
        // Body text is searched on-demand in recalculateDisplayedChapters() to avoid ~1.6MB duplication
        const searchTokens = `${secNum} ${cleanTitle} ${rawSec.title_hi || ''}`.toLowerCase();

        const enrichedSec: EnrichedSection = {
          _id: rawSec._id,
          id: rawSec.id,
          section_number: secNum,
          sectionNumber: secNum,
          secId: secNum,
          cleanTitle,
          cleanBody,
          rawContent,
          title_hi: rawSec.title_hi || '',
          introduction_text_hi: rawSec.introduction_text_hi || '',
          content_hi: rawSec.content_hi || '',
          text_hi: rawSec.text_hi || '',
          content_blocks_hi: rawSec.content_blocks_hi || [],
          hasContent: Boolean(hasContent),
          wordCount,
          readingTimeMinutes,
          parsed: enrichedParsed,
          parsed_hi: enrichedParsedHi,
          chapterNumber: chapNumber,
          chapterTitle: chapTitle,
          chapKey,
          index: globalIndex++,
          searchTokens,
          isBookmarked: this.bookmarkedSectionIds.has(secNum)
        };

        enrichedSections.push(enrichedSec);
        flatSections.push(enrichedSec);
        sectionMap.set(secNum, enrichedSec);
      }

      enrichedChapters.push({
        chapterNumber: chapNumber,
        chapter_number: chapNumber,
        title: chapTitle,
        chapKey,
        sections: enrichedSections,
        totalSections: enrichedSections.length,
        digitizedCount: chapDig,
        pendingCount: chapPend
      });
    }

    this.totalDigitizedCount = totalDig;
    this.totalPendingCount = totalPend;

    this.enrichedAct = {
      actName: this.actRaw.actName || this.shortName,
      shortName: this.shortName,
      year: this.actRaw.year || '',
      description: this.actRaw.description || this.actRaw.preamble || '',
      preamble: this.actRaw.preamble || '',
      totalSections: flatSections.length,
      totalChapters: enrichedChapters.length,
      chapters: enrichedChapters,
      flatSections,
      sectionMap
    };
  }

  private enrichClauseNodes(nodes: LegalClauseNode[]): EnrichedClauseNode[] {
    return (nodes || []).map(node => ({
      ...node,
      levelClass: this.computeNodeLevelClass(node.level),
      markerClass: this.computeMarkerClass(node.level),
      isCallout: node.type === 'proviso' || node.type === 'explanation' || node.type === 'illustration',
      calloutClass: this.computeCalloutClass(node.type),
      calloutLabel: this.computeCalloutLabel(node.type),
      children: this.enrichClauseNodes(node.children)
    }));
  }

  /* ═══════════════════════════════════════════════════════
     SEARCH & FILTER COMPUTATION (REACTIVE)
     ═══════════════════════════════════════════════════════ */

  onSearchInput(val: string): void {
    this.searchSubject.next(val);
  }

  onTocSearchInput(val: string): void {
    this.tocSearchSubject.next(val);
  }

  onJumpSearchInput(val: string): void {
    this.jumpSearchSubject.next(val);
  }

  clearMainSearch(): void {
    this.searchQuery = '';
    this.searchSubject.next('');
  }

  clearTocSearch(): void {
    this.tocSearchQuery = '';
    this.tocSearchSubject.next('');
  }

  setDigitizationFilter(filter: 'all' | 'digitized' | 'pending'): void {
    this.digitizationFilter = filter;
    this.recalculateDisplayedChapters();
    this.cdr.markForCheck();
  }

  toggleBookmarkedOnly(): void {
    this.showBookmarkedOnly = !this.showBookmarkedOnly;
    this.recalculateDisplayedChapters();
    this.cdr.markForCheck();
  }

  private recalculateDisplayedChapters(): void {
    if (!this.enrichedAct) {
      this.displayedChapters = [];
      this.matchingSectionsCount = 0;
      return;
    }

    const mainQ = this.searchQuery.toLowerCase().trim();
    const tocQ = this.tocSearchQuery.toLowerCase().trim();
    const activeQuery = tocQ || mainQ;

    let totalMatches = 0;

    const filtered = this.enrichedAct.chapters.map(chap => {
      const matching = chap.sections.filter(sec => {
        // 1. Text Search Filter (lazy: check lightweight tokens first, then body on-demand)
        if (activeQuery && !sec.searchTokens.includes(activeQuery)
          && !sec.cleanBody.toLowerCase().includes(activeQuery)) {
          return false;
        }

        // 2. Digitization Status Filter
        if (this.digitizationFilter === 'digitized' && !sec.hasContent) return false;
        if (this.digitizationFilter === 'pending' && sec.hasContent) return false;

        // 3. Bookmarked Only Filter
        if (this.showBookmarkedOnly && !this.bookmarkedSectionIds.has(sec.secId)) return false;

        return true;
      });

      totalMatches += matching.length;
      return { ...chap, sections: matching };
    }).filter(chap => chap.sections.length > 0);

    this.displayedChapters = filtered;
    this.matchingSectionsCount = totalMatches;

    // If searching, auto-expand all TOC chapters containing matches
    if (activeQuery) {
      this.tocCollapsedChapters = {};
    }

    this.refreshScrollspyObserver();
  }

  private recalculateJumpSections(): void {
    if (!this.enrichedAct) {
      this.filteredJumpSections = [];
      return;
    }

    const q = this.jumpSearchQuery.toLowerCase().trim();
    if (!q) {
      this.filteredJumpSections = this.enrichedAct.flatSections.map(s => ({
        section: s,
        chapterTitle: s.chapterTitle
      }));
      return;
    }

    this.filteredJumpSections = this.enrichedAct.flatSections
      .filter(s => s.secId.toLowerCase().includes(q) || s.cleanTitle.toLowerCase().includes(q))
      .map(s => ({ section: s, chapterTitle: s.chapterTitle }));
  }

  /* ═══════════════════════════════════════════════════════
     ZERO-REFLOW SCROLLSPY & TOC SYNCHRONIZATION ENGINE
     ═══════════════════════════════════════════════════════ */

  private scrollRafPending = false;

  private setupScrollspyObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    if (this.sectionObserver) {
      this.sectionObserver.disconnect();
    }

    const options: IntersectionObserverInit = {
      root: this.scrollContainer && this.scrollContainer !== document.documentElement ? this.scrollContainer : null,
      rootMargin: '-110px 0px -65% 0px',
      threshold: [0, 0.1]
    };

    this.sectionObserver = new IntersectionObserver((entries) => {
      // Skip IO callbacks entirely during manual or programmatic scrolling
      // to prevent fighting with the scroll-position-based detector
      if (this.isProgrammaticScrolling || this.isManualScrolling) return;

      for (const entry of entries) {
        if (entry.isIntersecting) {
          const secId = entry.target.getAttribute('data-section-id');
          if (secId && secId !== this.activeSectionId) {
            this.ngZone.run(() => {
              this.activeSectionId = secId;
              this.activeSection = this.enrichedAct?.sectionMap.get(secId) || null;
              this.scrollTocToActiveSection(secId, false);
              this.cdr.markForCheck();
            });
            break;
          }
        }
      }
    }, options);

    this.refreshScrollspyObserver();
  }

  /**
   * MutationObserver watches for newly hydrated section-card elements from @defer.
   * When new cards appear in the DOM, they get observed by the IntersectionObserver.
   */
  private setupSectionMutationObserver(): void {
    const hostEl = this.elRef.nativeElement as HTMLElement;
    this.sectionMutationObserver = new MutationObserver((mutations) => {
      let hasNewCards = false;
      for (const mutation of mutations) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          if (node instanceof HTMLElement) {
            if (node.classList?.contains('section-card') || node.querySelector?.('.section-card')) {
              hasNewCards = true;
              break;
            }
          }
        }
        if (hasNewCards) break;
      }
      if (hasNewCards && this.sectionObserver) {
        // Re-observe all section cards including newly hydrated ones
        const cards = hostEl.querySelectorAll('.section-card');
        cards.forEach(card => {
          this.sectionObserver!.observe(card);
        });
      }
    });

    this.sectionMutationObserver.observe(hostEl, {
      childList: true,
      subtree: true
    });
  }

  private refreshScrollspyObserver(): void {
    if (!this.sectionObserver) return;
    this.sectionObserver.disconnect();

    requestAnimationFrame(() => {
      if (!this.sectionObserver) return;
      const hostEl = this.elRef.nativeElement as HTMLElement;
      const cards = hostEl.querySelectorAll('.section-card');
      cards.forEach(card => this.sectionObserver!.observe(card));
    });
  }

  /**
   * Scroll-position-based active section detection — the PRIMARY authority during
   * manual scrolling. Scans all rendered section-card elements and picks the one
   * whose top edge is closest to, and at or above, the detection line (top of
   * viewport + header offset). Falls through to the card that occupies the most
   * visible area if none has its top at/above the detection line.
   */
  private detectActiveSectionByScrollPosition(): void {
    if (this.isProgrammaticScrolling || !this.scrollContainer || !this.enrichedAct) return;

    const hostEl = this.elRef.nativeElement as HTMLElement;
    const cards = hostEl.querySelectorAll('.section-card[data-section-id]');
    if (!cards.length) return;

    const containerRect = this.scrollContainer.getBoundingClientRect();
    // Detection line: top of scroll container + 80px (accounting for sticky header/breadcrumb)
    const detectionLine = containerRect.top + 80;
    const viewportBottom = containerRect.bottom;

    let bestCard: Element | null = null;
    let bestScore = -Infinity;

    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      // Skip cards completely outside the visible area
      if (rect.bottom < containerRect.top + 10 || rect.top > viewportBottom) return;

      // Calculate how much of the card is visible in the viewport
      const visibleTop = Math.max(rect.top, containerRect.top);
      const visibleBottom = Math.min(rect.bottom, viewportBottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      // Score: cards whose top is at or above the detection line get a large bonus.
      // Among those, prefer the one closest to (but not far above) the detection line.
      // Cards below the detection line get scored by their visible area as fallback.
      let score: number;
      if (rect.top <= detectionLine) {
        // Card's top is above or at the detection line — this is ideal.
        // Higher score for cards closer to the detection line (less negative distance).
        score = 10000 - (detectionLine - rect.top);
      } else {
        // Card's top is below the detection line — only if no above-line card exists.
        score = visibleHeight - (rect.top - detectionLine);
      }

      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
      }
    });

    if (bestCard) {
      const secId = (bestCard as HTMLElement).getAttribute('data-section-id');
      if (secId && secId !== this.activeSectionId) {
        this.ngZone.run(() => {
          this.activeSectionId = secId;
          this.activeSection = this.enrichedAct?.sectionMap.get(secId) || null;
          this.scrollTocToActiveSection(secId, false);
          this.cdr.markForCheck();
        });
      }
    }
  }

  private handleContainerScroll(): void {
    if (!this.scrollContainer || !this.enrichedAct) return;

    const scrollTop = this.scrollContainer.scrollTop;
    const scrollHeight = this.scrollContainer.scrollHeight;
    const clientHeight = this.scrollContainer.clientHeight;
    const docHeight = scrollHeight - clientHeight;
    const newProgress = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0;
    const shouldShow = scrollTop > 250;

    let dropdownClosed = false;
    if (this.showReaderSettings) {
      this.showReaderSettings = false;
      dropdownClosed = true;
    }

    // Set manual scrolling flag to suppress IntersectionObserver during scroll
    if (!this.isProgrammaticScrolling) {
      this.isManualScrolling = true;
      clearTimeout(this.manualScrollIdleTimer);
      // Clear the flag after 200ms of scroll idle — IO can resume then
      this.manualScrollIdleTimer = setTimeout(() => {
        this.isManualScrolling = false;
      }, 200);

      // Debounced scroll-position-based section detection (every ~60ms during scroll)
      clearTimeout(this.scrollSpyDebounceTimer);
      this.scrollSpyDebounceTimer = setTimeout(() => {
        this.detectActiveSectionByScrollPosition();
      }, 60);
    }

    if (this.scrollRafPending) return;
    this.scrollRafPending = true;

    requestAnimationFrame(() => {
      this.scrollRafPending = false;
      if (!this.scrollContainer || !this.enrichedAct) return;

      // Handle bottom edge case
      if (!this.isProgrammaticScrolling) {
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 35;
        if (isAtBottom && this.enrichedAct.flatSections.length > 0) {
          const lastSec = this.enrichedAct.flatSections[this.enrichedAct.flatSections.length - 1];
          if (lastSec && lastSec.secId !== this.activeSectionId) {
            this.ngZone.run(() => {
              this.activeSectionId = lastSec.secId;
              this.activeSection = lastSec;
              this.scrollTocToActiveSection(lastSec.secId, false);
              this.cdr.markForCheck();
            });
          }
        }
      }

      const isProgressChanged = Math.abs(newProgress - this.readingProgress) >= 1;
      const isShowBackToTopChanged = shouldShow !== this.showBackToTop;

      if (isProgressChanged || isShowBackToTopChanged || dropdownClosed) {
        this.ngZone.run(() => {
          this.readingProgress = newProgress;
          this.showBackToTop = shouldShow;
          this.cdr.markForCheck();
        });
      }
    });
  }

  private setActiveSection(secId: string, forceTocScroll = false): void {
    this.activeSectionId = secId;
    this.activeSection = this.enrichedAct?.sectionMap.get(secId) || null;

    // Auto-scroll TOC sidebar to keep active section centered in view
    this.scrollTocToActiveSection(secId, forceTocScroll);
    this.cdr.markForCheck();
  }

  scrollTocToActiveSection(secId: string, force = false): void {
    if (this.isUserHoveringToc && !force) return;

    const sec = this.enrichedAct?.sectionMap.get(secId);
    if (sec && this.tocCollapsedChapters[sec.chapKey]) {
      // Auto-expand chapter in TOC so the provision is visible
      this.tocCollapsedChapters[sec.chapKey] = false;
      this.cdr.markForCheck();
    }

    clearTimeout(this.tocAutoScrollTimeout);
    this.tocAutoScrollTimeout = setTimeout(() => {
      if (!this.tocScrollContainerEl?.nativeElement) return;

      const container = this.tocScrollContainerEl.nativeElement;
      const targetItem = container.querySelector(`[data-toc-sec-id="${secId}"]`) as HTMLElement;

      if (!targetItem) return;

      const containerRect = container.getBoundingClientRect();
      const itemRect = targetItem.getBoundingClientRect();

      const itemTopRelativeToContainer = itemRect.top - containerRect.top + container.scrollTop;
      const targetScrollTop = itemTopRelativeToContainer - (container.clientHeight / 2) + (itemRect.height / 2);

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    }, 20);
  }

  onTocMouseEnter(): void {
    this.isUserHoveringToc = true;
    clearTimeout(this.hoverCooldownTimer);
  }

  onTocMouseLeave(): void {
    clearTimeout(this.hoverCooldownTimer);
    this.hoverCooldownTimer = setTimeout(() => {
      this.isUserHoveringToc = false;
    }, 300);
  }

  /* ═══════════════════════════════════════════════════════
     INTERACTIVE NAVIGATION & BOOKMARKING
     ═══════════════════════════════════════════════════════ */

  scrollToSection(secNum: string): void {
    const secStr = String(secNum);
    this.isProgrammaticScrolling = true;
    this.setActiveSection(secStr, true);

    this.showJumpToSection = false;
    this.jumpSearchQuery = '';

    const sec = this.enrichedAct?.sectionMap.get(secStr);
    let needCdr = false;
    if (sec) {
      // If chapter is collapsed in main reading view, expand it
      if (this.collapsedChapters[sec.chapKey]) {
        this.collapsedChapters[sec.chapKey] = false;
        needCdr = true;
      }
      // If section card itself is collapsed, expand it
      if (this.collapsedSections[secStr]) {
        this.collapsedSections[secStr] = false;
        needCdr = true;
      }
    }
    if (needCdr) {
      this.refreshScrollspyObserver();
      this.cdr.detectChanges();
    }

    requestAnimationFrame(() => {
      const el = document.getElementById(`section-${secStr}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    // Release programmatic scroll lock after smooth scrolling completes
    clearTimeout(this.programmaticScrollTimer);
    this.programmaticScrollTimer = setTimeout(() => {
      this.isProgrammaticScrolling = false;
    }, 700);
  }

  navigateSection(direction: 1 | -1): void {
    if (!this.enrichedAct || this.enrichedAct.flatSections.length === 0) return;

    const flat = this.enrichedAct.flatSections;
    const currentIdx = flat.findIndex(s => s.secId === this.activeSectionId);

    let nextIdx = currentIdx === -1 ? 0 : currentIdx + direction;
    if (nextIdx < 0 || nextIdx >= flat.length) return;

    this.scrollToSection(flat[nextIdx].secId);
  }

  scrollToTop(): void {
    if (this.scrollContainer) {
      this.scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  toggleBookmark(secId: string, event?: Event): void {
    event?.stopPropagation();
    const isAdding = !this.bookmarkedSectionIds.has(secId);

    // 1. Optimistic instant UI update
    if (isAdding) {
      this.bookmarkedSectionIds.add(secId);
    } else {
      this.bookmarkedSectionIds.delete(secId);
    }

    const sec = this.enrichedAct?.sectionMap.get(secId);
    if (sec) sec.isBookmarked = isAdding;

    this.recalculateDisplayedChapters();
    this.cdr.markForCheck();

    // 2. Sync with Backend API
    this.api.togglePinnedSection(this.shortName, secId).subscribe({
      next: (res: any) => {
        if (res?.pinnedSections) {
          this.bookmarkedSectionIds = new Set(res.pinnedSections);
          this.applyBookmarksToViewModel();
        }
        // Cloud synced successfully — clear local cache
        localStorage.removeItem(`lc_bookmarks_${this.shortName}`);

        if (isAdding) {
          this.toast.success(`Pinned Section § ${secId} to cloud dossier`);
        } else {
          this.toast.info(`Unpinned Section § ${secId}`);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        // Fallback to local storage if offline or request fails
        this.saveBookmarks();
        this.toast.warning(`Section § ${secId} saved locally (offline).`);
      }
    });
  }

  private loadBookmarks(): void {
    // 1. Read existing local storage if any (to handle offline or pending unsynced pins)
    let localPending: string[] = [];
    try {
      const stored = localStorage.getItem(`lc_bookmarks_${this.shortName}`);
      if (stored) {
        localPending = JSON.parse(stored);
      }
    } catch { }

    if (localPending.length > 0) {
      this.bookmarkedSectionIds = new Set(localPending);
      this.applyBookmarksToViewModel();
    }

    // 2. Fetch ground truth from backend API
    this.api.getPinnedSections(this.shortName).subscribe({
      next: (res: any) => {
        const backendPins: string[] = res?.data || res || [];

        // If we had local pending pins not yet on backend, sync them to cloud
        if (localPending.length > 0) {
          const combined = Array.from(new Set([...backendPins, ...localPending]));
          this.api.syncPinnedSections(this.shortName, combined).subscribe({
            next: (syncRes: any) => {
              const finalPins: string[] = syncRes?.pinnedSections || syncRes?.data || combined;
              this.bookmarkedSectionIds = new Set(finalPins);
              this.applyBookmarksToViewModel();
              // Clear local cache once synced
              localStorage.removeItem(`lc_bookmarks_${this.shortName}`);
              this.cdr.markForCheck();
            },
            error: () => {
              this.bookmarkedSectionIds = new Set([...backendPins, ...localPending]);
              this.applyBookmarksToViewModel();
              this.cdr.markForCheck();
            }
          });
        } else {
          // Direct backend load — apply and ensure local cache is cleared
          this.bookmarkedSectionIds = new Set(backendPins);
          this.applyBookmarksToViewModel();
          localStorage.removeItem(`lc_bookmarks_${this.shortName}`);
          this.cdr.markForCheck();
        }
      },
      error: () => {
        // Offline / backend unavailable — retain local cache
        this.cdr.markForCheck();
      }
    });
  }

  private applyBookmarksToViewModel(): void {
    if (!this.enrichedAct?.flatSections) return;
    this.enrichedAct.flatSections.forEach(sec => {
      sec.isBookmarked = this.bookmarkedSectionIds.has(sec.secId);
    });
    this.recalculateDisplayedChapters();
    this.cdr.markForCheck();
  }

  private saveBookmarks(): void {
    try {
      localStorage.setItem(
        `lc_bookmarks_${this.shortName}`,
        JSON.stringify(Array.from(this.bookmarkedSectionIds))
      );
    } catch { }
  }

  /* ═══════════════════════════════════════════════════════
     COLLAPSE & ACCORDION STATE CONTROLS
     ═══════════════════════════════════════════════════════ */

  get areAllChaptersCollapsed(): boolean {
    if (!this.enrichedAct?.chapters?.length) return false;
    return this.enrichedAct.chapters.every(c => this.collapsedChapters[c.chapKey]);
  }

  get areAllTocChaptersCollapsed(): boolean {
    if (!this.displayedChapters?.length) return false;
    return this.displayedChapters.every(c => this.tocCollapsedChapters[c.chapKey]);
  }

  toggleChapterCollapse(chapKey: string, event?: Event): void {
    event?.stopPropagation();
    this.collapsedChapters[chapKey] = !this.collapsedChapters[chapKey];
    this.refreshScrollspyObserver();
    this.cdr.markForCheck();
  }

  toggleTocChapterCollapse(chapKey: string, event?: Event): void {
    event?.stopPropagation();
    this.tocCollapsedChapters[chapKey] = !this.tocCollapsedChapters[chapKey];
    this.cdr.markForCheck();
  }

  toggleAllChapters(event?: Event): void {
    event?.stopPropagation();
    const shouldCollapse = !this.areAllChaptersCollapsed;
    if (this.enrichedAct) {
      for (const chap of this.enrichedAct.chapters) {
        this.collapsedChapters[chap.chapKey] = shouldCollapse;
      }
    }
    this.refreshScrollspyObserver();
    this.cdr.markForCheck();
  }

  toggleAllTocChapters(event?: Event): void {
    event?.stopPropagation();
    const shouldCollapse = !this.areAllTocChaptersCollapsed;
    if (this.enrichedAct) {
      for (const chap of this.enrichedAct.chapters) {
        this.tocCollapsedChapters[chap.chapKey] = shouldCollapse;
      }
    }
    this.cdr.markForCheck();
  }

  toggleSectionCollapse(secId: string, event?: Event): void {
    event?.stopPropagation();
    this.collapsedSections[secId] = !this.collapsedSections[secId];
    this.refreshScrollspyObserver();
    this.cdr.markForCheck();
  }

  toggleAllSectionsCollapse(collapse: boolean): void {
    if (!this.enrichedAct) return;
    for (const sec of this.enrichedAct.flatSections) {
      this.collapsedSections[sec.secId] = collapse;
    }
    this.refreshScrollspyObserver();
    this.cdr.markForCheck();
  }

  toggleLaymanSummary(secId: string): void {
    this.showLaymanSummary[secId] = !this.showLaymanSummary[secId];
    this.cdr.markForCheck();
  }

  toggleDefinedTerms(secId: string): void {
    const isCurrentlyShown = this.showDefinedTerms[secId] !== false;
    this.showDefinedTerms[secId] = !isCurrentlyShown;
    this.cdr.markForCheck();
  }

  /* ═══════════════════════════════════════════════════════
     READER CUSTOMIZATION & PERSISTENCE
     ═══════════════════════════════════════════════════════ */

  setFontScale(delta: number): void {
    // Clean 10% steps bounded between 80% and 140%
    const nextScale = Math.round((this.fontScale + delta) / 10) * 10;
    this.fontScale = Math.min(140, Math.max(80, nextScale));
    this.savePersistedPreferences();
    this.cdr.markForCheck();
  }

  resetFontScale(): void {
    this.fontScale = 100;
    this.savePersistedPreferences();
    this.cdr.markForCheck();
  }

  setFontFamily(family: 'sans' | 'serif'): void {
    this.fontFamily = family;
    this.savePersistedPreferences();
    this.cdr.markForCheck();
  }

  setViewMode(mode: 'structured' | 'raw'): void {
    this.viewMode = mode;
    this.savePersistedPreferences();
    this.cdr.markForCheck();
  }

  setActiveLanguage(lang: 'en' | 'hi' | 'both'): void {
    this.activeLanguage = lang;
    this.savePersistedPreferences();
    this.cdr.markForCheck();
  }

  setSplitViewMode(mode: 'stacked' | 'split'): void {
    this.splitViewMode = mode;
    this.savePersistedPreferences();
    this.cdr.markForCheck();
  }

  toggleToc(): void {
    this.isTocCollapsed = !this.isTocCollapsed;
    this.savePersistedPreferences();
    this.cdr.markForCheck();
  }

  toggleReaderSettings(event?: Event): void {
    event?.stopPropagation();
    this.showReaderSettings = !this.showReaderSettings;
    if (this.showReaderSettings) {
      this.showShortcutsModal = false;
    }
    this.cdr.markForCheck();
  }

  closeReaderSettings(): void {
    this.showReaderSettings = false;
    this.cdr.markForCheck();
  }

  toggleJumpToSection(): void {
    this.showJumpToSection = !this.showJumpToSection;
    this.jumpSearchQuery = '';
    this.recalculateJumpSections();
    this.cdr.markForCheck();
    if (this.showJumpToSection) {
      setTimeout(() => this.jumpSearchInputEl?.nativeElement?.focus(), 100);
    }
  }

  toggleShortcutsModal(event?: Event): void {
    event?.stopPropagation();
    this.showShortcutsModal = !this.showShortcutsModal;
    if (this.showShortcutsModal) {
      this.showReaderSettings = false;
    }
    this.cdr.markForCheck();
  }

  // Document-level click handler — runs outside Angular zone to avoid CD on every click
  private boundDocClickHandler = this.onDocumentClick.bind(this);
  private boundDocKeydownHandler = this.onDocumentKeydown.bind(this);

  private onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) return;

    // Check if user clicked an amendment footnote badge anywhere in the reader
    const fnBadge = target.closest('.fn-badge') as HTMLElement;
    if (fnBadge) {
      event.preventDefault();
      event.stopPropagation();
      const fnNum = fnBadge.getAttribute('data-fn') || fnBadge.textContent?.replace(/\D/g, '') || '1';
      this.ngZone.run(() => this.showFootnoteDetails(fnNum));
      return;
    }

    let changed = false;
    if (this.showReaderSettings && !target.closest('.reader-settings-dropdown') && !target.closest('.reader-settings-toggle')) {
      this.showReaderSettings = false;
      changed = true;
    }

    if (this.showShortcutsModal && !target.closest('.shortcuts-dropdown') && !target.closest('.shortcuts-toggle')) {
      this.showShortcutsModal = false;
      changed = true;
    }

    if (changed) {
      this.ngZone.run(() => this.cdr.markForCheck());
    }
  }

  private onDocumentKeydown(event: KeyboardEvent): void {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName || '');

    if (event.key === 'Escape') {
      if (this.showReaderSettings || this.showShortcutsModal || this.showJumpToSection || this.editingSection || this.activeFootnote) {
        this.ngZone.run(() => {
          this.showReaderSettings = false;
          this.showShortcutsModal = false;
          this.showJumpToSection = false;
          this.editingSection = null;
          this.activeFootnote = null;
          this.cdr.markForCheck();
        });
        return;
      }
      if (this.searchQuery) {
        this.ngZone.run(() => this.clearMainSearch());
        return;
      }
    }

    if (isInput) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.searchInputEl?.nativeElement?.focus();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      this.ngZone.run(() => this.toggleJumpToSection());
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      this.ngZone.run(() => this.toggleToc());
    } else if (event.key === '?') {
      event.preventDefault();
      this.ngZone.run(() => this.toggleShortcutsModal());
    } else if (event.key.toLowerCase() === 'j' || event.key === 'ArrowDown') {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.ngZone.run(() => this.navigateSection(1));
      }
    } else if (event.key.toLowerCase() === 'k' || event.key === 'ArrowUp') {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.ngZone.run(() => this.navigateSection(-1));
      }
    } else if (event.key.toLowerCase() === 'b' && !event.ctrlKey && !event.metaKey) {
      if (this.activeSectionId) {
        event.preventDefault();
        this.ngZone.run(() => this.toggleBookmark(this.activeSectionId));
      }
    } else if (event.key.toLowerCase() === 'e' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.ngZone.run(() => {
        this.toggleEditMode();
      });
    }
  }

  private loadPersistedPreferences(): void {
    try {
      const prefs = localStorage.getItem('lc_reader_preferences');
      if (prefs) {
        const parsed = JSON.parse(prefs);
        if (parsed.readerTheme) this.readerTheme = parsed.readerTheme;
        if (parsed.fontScale) this.fontScale = parsed.fontScale;
        if (parsed.fontFamily) this.fontFamily = parsed.fontFamily;
        if (parsed.viewMode) this.viewMode = parsed.viewMode;
        if (parsed.activeLanguage) this.activeLanguage = parsed.activeLanguage;
        if (parsed.splitViewMode) this.splitViewMode = parsed.splitViewMode;
        if (typeof parsed.isTocCollapsed === 'boolean') this.isTocCollapsed = parsed.isTocCollapsed;
      }
    } catch { }
  }

  private savePersistedPreferences(): void {
    try {
      localStorage.setItem('lc_reader_preferences', JSON.stringify({
        readerTheme: this.readerTheme,
        fontScale: this.fontScale,
        fontFamily: this.fontFamily,
        viewMode: this.viewMode,
        activeLanguage: this.activeLanguage,
        splitViewMode: this.splitViewMode,
        isTocCollapsed: this.isTocCollapsed
      }));
    } catch { }
  }

  /* ═══════════════════════════════════════════════════════
     LEGAL CITATIONS, PRINT & EXPORTS
     ═══════════════════════════════════════════════════════ */

  copySectionCitation(sec: EnrichedSection, event?: Event): void {
    event?.stopPropagation();
    const citation = `Section ${sec.secId}, ${this.enrichedAct?.actName || this.shortName} (${this.enrichedAct?.year || ''}): "${sec.cleanTitle}"`;
    navigator.clipboard.writeText(citation).then(
      () => this.toast.success(`Citation copied for Section ${sec.secId}`),
      () => this.toast.error('Failed to copy citation to clipboard')
    );
  }

  copySectionLink(sec: EnrichedSection, event?: Event): void {
    event?.stopPropagation();
    const url = `${window.location.origin}/legal-content/${this.shortName}#section-${sec.secId}`;
    navigator.clipboard.writeText(url).then(
      () => this.toast.success(`Section ${sec.secId} link copied to clipboard`),
      () => this.toast.error('Failed to copy link to clipboard')
    );
  }

  copyCleanSectionText(sec: EnrichedSection, event?: Event): void {
    event?.stopPropagation();
    const title = sec.cleanTitle || `Section ${sec.secId}`;
    const body = sec.cleanBody || sec.rawContent || '';
    const textToCopy = `§ ${sec.secId}. ${title}\n\n${body}`;
    navigator.clipboard.writeText(textToCopy).then(
      () => this.toast.success(`Copied clean text for Section § ${sec.secId}`),
      () => this.toast.error('Failed to copy text to clipboard')
    );
  }

  showFootnoteDetails(fnNumber: string): void {
    this.activeFootnote = {
      id: `fn-${fnNumber}`,
      number: fnNumber,
      text: `Statutory Amendment Footnote [${fnNumber}]: Substituted/Inserted by legislative amendment as published in the Official Gazette.`
    };
    this.cdr.markForCheck();
  }

  closeFootnoteModal(): void {
    this.activeFootnote = null;
    this.cdr.markForCheck();
  }

  printSection(sec: EnrichedSection, event?: Event): void {
    event?.stopPropagation();
    this.toast.info(`Preparing print document for Section ${sec.secId}...`);
    this.printService.printLegalSection({
      actOrDocTitle: this.enrichedAct?.actName || this.shortName,
      shortCode: this.shortName,
      year: this.enrichedAct?.year || '',
      sectionNumber: sec.secId,
      sectionTitle: sec.cleanTitle,
      chapterNumber: sec.chapterNumber,
      chapterTitle: sec.chapterTitle,
      bodyTextOrHtml: sec.cleanBody,
      hindiTitle: sec.title_hi,
      hindiBody: sec.introduction_text_hi || sec.content_hi,
      metadata: [
        { label: 'Act Short Code', value: this.shortName },
        { label: 'Jurisdiction', value: 'Republic of India' },
        { label: 'Word Count', value: `${sec.wordCount} words` },
        { label: 'Digitized', value: sec.hasContent ? 'Yes' : 'Pending' }
      ]
    });
  }

  exportFullActPDF(): void {
    if (!this.enrichedAct) {
      this.toast.warning('No act data available to export.');
      return;
    }
    this.toast.info(`Generating full PDF for ${this.enrichedAct.actName || this.shortName}...`);
    this.printService.printCompleteAct({
      actName: this.enrichedAct.actName || this.shortName,
      shortName: this.shortName,
      year: this.enrichedAct.year,
      description: this.enrichedAct.description,
      totalSections: this.enrichedAct.totalSections,
      totalChapters: this.enrichedAct.totalChapters,
      chapters: this.displayedChapters.map(chap => ({
        chapterNumber: chap.chapterNumber,
        title: chap.title,
        sections: chap.sections.map(sec => ({
          secId: sec.secId,
          cleanTitle: sec.cleanTitle,
          cleanBody: sec.cleanBody,
          title_hi: sec.title_hi,
          introduction_text_hi: sec.introduction_text_hi,
          content_hi: sec.content_hi
        }))
      }))
    });
  }

  /* ═══════════════════════════════════════════════════════
     ADMIN INLINE EDITING (MODAL COORDINATION)
     ═══════════════════════════════════════════════════════ */

  toggleEditMode(event?: Event): void {
    event?.stopPropagation();
    this.isEditMode = !this.isEditMode;
    if (this.isEditMode) {
      this.toast.info('Edit Mode activated — click "Edit" on any provision to modify legal text or translations.');
    } else {
      this.toast.info('Edit Mode exited.');
    }
    this.cdr.markForCheck();
  }

  openEditSection(sec: EnrichedSection, event?: Event): void {
    event?.stopPropagation();
    this.editingSection = sec;
    this.cdr.markForCheck();
  }

  saveSectionEdit(payload: EditSectionSaveEvent): void {
    const { section, formData } = payload;
    this.isSaving = true;
    this.cdr.markForCheck();

    const secId = section._id || section.id || formData.section_number;

    this.api.updateSection(this.shortName, secId, formData).subscribe({
      next: () => {
        this.isSaving = false;
        section.cleanTitle = formData.title;
        section.title_hi = formData.title_hi;
        section.rawContent = formData.introduction_text;
        section.cleanBody = formData.introduction_text;
        section.introduction_text_hi = formData.introduction_text_hi;
        section.hasContent = (formData.introduction_text || '').trim().length > 10;

        // Re-parse AST on demand
        const parsedBase = LegalTextParser.parse(section.cleanBody, section.cleanTitle);
        section.parsed = {
          ...parsedBase,
          enrichedNodes: this.enrichClauseNodes(parsedBase.nodes)
        };

        if (formData.introduction_text_hi?.trim()) {
          const parsedHiBase = LegalTextParser.parse(formData.introduction_text_hi, formData.title_hi || '');
          section.parsed_hi = {
            ...parsedHiBase,
            enrichedNodes: this.enrichClauseNodes(parsedHiBase.nodes)
          };
        }

        this.editingSection = null;
        this.toast.success(`Section § ${formData.section_number} updated successfully.`);
        this.recalculateDisplayedChapters();
        this.cdr.markForCheck();
      },
      error: () => {
        this.isSaving = false;
        this.toast.error('Failed to save section edits.');
        this.cdr.markForCheck();
      }
    });
  }

  /* ═══════════════════════════════════════════════════════
     INTERNAL HELPERS & STRING CONVERTERS
     ═══════════════════════════════════════════════════════ */

  private safeStringify(val: any): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) {
      return val.map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && item.text) return item.text;
        return '';
      }).filter(Boolean).join('\n');
    }
    if (typeof val === 'object' && val.text) return String(val.text);
    try { return JSON.stringify(val); } catch { return ''; }
  }

  private computeCleanTitle(sec: any): string {
    const raw = sec.clean_title || sec.title || '';
    if (!raw) return `Section ${sec.section_number || sec.sectionNumber || ''}`;
    const cleaned = typeof raw === 'string' ? raw : this.safeStringify(raw);
    const titlePart = cleaned.includes('.-') ? cleaned.split('.-')[0] : cleaned;
    return titlePart.replace(/^Sec(tion)?\s*\d+[\s:.\-]*/i, '').trim();
  }

  private computeCleanBody(sec: any): string {
    let fullContent = sec.content || sec.introduction_text || sec.text || '';
    fullContent = this.safeStringify(fullContent);

    if (fullContent && fullContent.trim().length > 5) {
      const cleaned = fullContent
        .replace(/^(February|January|March|April|May|June|July|August|September|October|November|December),\s*\d{4},?\s*see Gazette of India.*?\.\s*/i, '')
        .replace(/\[object\s+Object\]/gi, '')
        .replace(/\{"[^"]*":\s*"[^"]*"\}/g, '')
        .trim();
      return cleaned || fullContent.trim();
    }
    const raw = sec.title || '';
    const rawStr = this.safeStringify(raw);
    if (rawStr.includes('.-')) {
      const parts = rawStr.split('.-');
      if (parts.length > 1) {
        return parts.slice(1).join('.-').trim();
      }
    }
    return fullContent || rawStr || '';
  }

  private computeMarkerClass(level: number): string {
    switch (level) {
      case 1: return 'marker-l1';
      case 2: return 'marker-l2';
      case 3: return 'marker-l3';
      case 4: return 'marker-l4';
      default: return 'marker-l1';
    }
  }

  private computeNodeLevelClass(level: number): string {
    switch (level) {
      case 1: return 'level-1';
      case 2: return 'level-2';
      case 3: return 'level-3';
      case 4: return 'level-4';
      default: return 'level-1';
    }
  }

  private computeCalloutClass(type: string): string {
    switch (type) {
      case 'proviso': return 'callout-proviso';
      case 'explanation': return 'callout-explanation';
      case 'illustration': return 'callout-illustration';
      default: return '';
    }
  }

  private computeCalloutLabel(type: string): string {
    switch (type) {
      case 'proviso': return 'Proviso';
      case 'explanation': return 'Explanation';
      case 'illustration': return 'Illustration';
      default: return '';
    }
  }

  getCleanBlockText(text: any): string {
    const str = this.safeStringify(text);
    return str.replace(/\[object\s+Object\]/gi, '').replace(/\{"[^"]*":\s*"[^"]*"\}/g, '').trim();
  }

  getClauseStyle(text: string, type?: string): any {
    if (type === 'explanation') {
      return { 'border-left': '3px solid #0ea5e9', 'background-color': 'rgba(14, 165, 233, 0.05)', 'margin-left': '0' };
    }
    if (type === 'illustration') {
      return { 'border-left': '3px solid #10b981', 'background-color': 'rgba(16, 185, 129, 0.05)', 'margin-left': '0' };
    }
    return {};
  }
}