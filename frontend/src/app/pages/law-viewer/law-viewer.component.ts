import { Component, OnInit, OnDestroy, HostListener, NgZone, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, takeUntil, debounceTime } from 'rxjs';
import { LegalService, BareAct, Chapter, Section, ContentBlock } from '../../services/legal.service';
import { FormattingService } from '../../services/formatting.service';
import { BookmarkService } from '../../services/bookmark.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { NoteService } from '../../services/note.service';
import { SnackbarService } from '../../services/snackbar.service';
import { BookmarkModalComponent } from '../../components/bookmark-modal/bookmark-modal.component';
import { ShareMenuComponent } from '../../components/share-menu/share-menu.component';
import { DatabaseService } from '../../services/database.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { JargonTooltipDirective } from '../../directives/jargon-tooltip.directive';
import { LaymanScenario } from './layman-topics.data';
import { EXPECTED_CACHE_VERSION } from '../../constants/cache.constant';
import { SpeechService } from '../../services/speech.service';
import { LawViewerSidebarComponent } from './law-viewer-sidebar/law-viewer-sidebar.component';
import { LawViewerChatComponent } from './law-viewer-chat/law-viewer-chat.component';
import { LawViewerCompareComponent } from './law-viewer-compare/law-viewer-compare.component';
import { LawViewerCompanionComponent } from './law-viewer-companion/law-viewer-companion.component';
import { ScrollService } from '../../services/scroll.service';

const FULL_CITATION_REGEX = /\b(Section\s+(\d+[A-Z\-\d]*)\s+of\s+the\s+([A-Za-z\s’'\",\-]+Act(?:,\s+\d{4})?))/gi;
const LOCAL_CITATION_REGEX = /\b(Section\s+(\d+[A-Z\-\d]*))\b(?!(\s+of\s+the))/gi;

@Component({
  selector: 'app-law-viewer',
  standalone: true,
  imports: [
    RouterLink,
    NgFor,
    NgIf,
    NgClass,
    BookmarkModalComponent,
    ShareMenuComponent,
    FormsModule,
    TooltipDirective,
    JargonTooltipDirective,
    LawViewerSidebarComponent,
    LawViewerChatComponent,
    LawViewerCompareComponent,
    LawViewerCompanionComponent
  ],
  templateUrl: './law-viewer.component.html',
  styleUrls: ['./law-viewer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LawViewerComponent implements OnInit, OnDestroy {
  act: BareAct | null = null;
  activeChapter: Chapter | null = null;
  activeSection: Section | null = null;
  activeSectionTab: 'text' | 'ai' | 'actions' = 'text';

  private _isMobileDrawerOpen = false;

  get isMobileDrawerOpen(): boolean {
    return this._isMobileDrawerOpen;
  }
  set isMobileDrawerOpen(val: boolean) {
    this._isMobileDrawerOpen = val;
    if (val) {
      document.body.classList.add('mobile-drawer-open');
    } else {
      document.body.classList.remove('mobile-drawer-open');
    }
  }

  isDescExpanded = false;
  isTitleExpanded = false;
  loading = true;
  error = '';
  shortName = '';
  isLoggedIn = false;
  currentUser: UserProfile | null = null;
  todayDate = new Date();

  // Research Binders Dropdown & Creation State
  showBinderDropdown = false;
  binderSearchQuery = '';
  showNewBinderInput = false;
  newBinderName = '';
  isLimitationExpanded = false;

  // Reusable Bookmark Modal State
  isBookmarkModalOpen = false;
  modalActShortName = '';
  modalChapterNumber = '';
  modalSection: Section | null = null;

  summaries: { [key: string]: { loading: boolean, text: string | null, error: string | null } } = {};
  private streamSubs = new Map<string, Subscription>();
  private destroy$ = new Subject<void>();

  // Reader preferences
  fontSize = 16;
  selectedLanguage: 'en' | 'hi' | 'parallel' = 'en';
  translatingSection = false;

  // Notes state
  currentNoteText = '';
  loadingSection = false;
  activeSpeechSentenceIndex = -1;
  private notesSync$ = new Subject<{ note: string, sectionNum: string }>();
  private glossaryTooltipTimer: any;
  private activeHoveredTerm: HTMLElement | null = null;
  private fragmentSub: Subscription | null = null;
  private actsList: { actName: string; shortName: string }[] = [];
  private normalizedActsList: { normName: string; shortName: string }[] = [];

  // Speech (TTS) Getters delegation
  get isSpeaking(): boolean {
    return this.speechService.isSpeaking;
  }
  get isPaused(): boolean {
    return this.speechService.isPaused;
  }

  // Premium UX States
  activeScenario: LaymanScenario | null = null;
  isCrossRefModalOpen = false;
  sidebarSearchQuery = '';
  isMobilePrefMenuOpen = false;

  isScrolled = false;
  isBottomNavVisible = true;
  isKeyboardVisible = false;
  initialHeight = window.innerHeight;
  scrollDirection: 'up' | 'down' = 'up';
  private scrollSub!: Subscription;

  // Companion Dashboard states managed locally in LawViewerCompanionComponent

  // Precomputed caches and optimization variables for performance
  hasHindiAct = false;
  isMappingSupportedAct = false;
  equivalentActName = '';
  hasPrev = false;
  hasNext = false;
  isActiveSectionBookmarked = false;
  isXlViewport = false;
  glossaryMap = new Map<string, string>();
  glossaryRegex: RegExp | null = null;

  private flatSections: { sec: Section, ch: Chapter }[] = [];
  private highlightCache = new Map<string, string>();
  private lastSearchQuery = '';
  private searchQueryRegex: RegExp | null = null;
  recentSections: Section[] = [];
  private onScroll = () => {
    const scrolled = window.scrollY > 20;
    if (scrolled !== this.isScrolled) {
      this.ngZone.run(() => {
        this.isScrolled = scrolled;
        this.cdr.markForCheck();
      });
    }
  };

  @HostListener('window:resize', [])
  onWindowResize() {
    this.isXlViewport = window.innerWidth >= 1280;
    if (window.innerWidth < 768 && this.selectedLanguage === 'parallel') {
      this.onLanguageChange('en');
    }
    this.isKeyboardVisible = window.innerHeight < this.initialHeight - 150;
    this.updateBottomNavVisibility();
    this.cdr.markForCheck();
  }

  updateBottomNavVisibility() {
    this.isBottomNavVisible = this.scrollDirection === 'up' && !this.isKeyboardVisible;
    this.cdr.markForCheck();
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.cdr.markForCheck();
  }

  expandSidebar() {
    if (this.isSidebarCollapsed) {
      this.isSidebarCollapsed = false;
      this.cdr.markForCheck();
    }
  }

  isSidebarCollapsed = false;

  hasHindi(): boolean {
    return this.hasHindiAct;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private legalService: LegalService,
    public bookmarkService: BookmarkService,
    public noteService: NoteService,
    private authService: AuthService,
    private snackbar: SnackbarService,
    private db: DatabaseService,
    public speechService: SpeechService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public formatter: FormattingService,
    private scrollService: ScrollService,
    private sanitizer: DomSanitizer
  ) { }

  adjustFontSize(amount: number) {
    this.fontSize = Math.min(Math.max(12, this.fontSize + amount), 26);
    this.cdr.markForCheck();
  }

  ngOnInit() {
    this.isXlViewport = window.innerWidth >= 1280;
    import('./glossary.data').then(m => {
      const sortedGlossary = [...m.GLOSSARY_LIST].sort((a, b) => b.term.length - a.term.length);
      this.glossaryMap = new Map<string, string>(
        sortedGlossary.map(item => [item.term.toLowerCase(), item.definition])
      );
      this.glossaryRegex = new RegExp(
        `(?![^<>]*>)\\b(${sortedGlossary.map(item => item.term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|')})\\b`,
        'gi'
      );
      this.cdr.markForCheck();
    });

    this.authService.isLoggedIn$.pipe(takeUntil(this.destroy$)).subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      this.cdr.markForCheck();
    });
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUser = user;
      this.loadCustomBinders();
      this.cdr.markForCheck();
    });
    this.bookmarkService.bookmarks$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateActiveSectionBookmarkStatus();
      this.updateSelectedBinderFolder();
      this.loadCustomBinders();
      this.cdr.markForCheck();
    });
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const newShortName = params.get('shortName') || '';
      if (newShortName) {
        this.shortName = newShortName;
        this.resetComponentState();
        this.checkCacheVersionAndClearIfNeeded().then(() => {
          this.loadActData();
        });
      }
    });

    this.notesSync$.pipe(
      debounceTime(1000),
      takeUntil(this.destroy$)
    ).subscribe(({ note, sectionNum }) => {
      this.noteService.saveNote(this.shortName, sectionNum, note, true);
    });

    this.speechService.activeSentenceIndex$.pipe(takeUntil(this.destroy$)).subscribe(idx => {
      this.activeSpeechSentenceIndex = idx;
      this.cdr.markForCheck();
    });

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });

    this.scrollSub = this.scrollService.scrollDirection$.subscribe(dir => {
      this.scrollDirection = dir;
      this.updateBottomNavVisibility();
    });

    this.legalService.getActs().pipe(takeUntil(this.destroy$)).subscribe(res => {
      if (res && res.data) {
        this.actsList = res.data;
        this.normalizedActsList = res.data.map(a => ({
          normName: this.normalizeTitle(a.actName),
          shortName: a.shortName
        }));
        this.cdr.markForCheck();
      }
    });
  }

  private loadOfflineAct() {
    this.db.getActByShortName(this.shortName).then(cachedAct => {
      if (cachedAct) {
        this.act = {
          actName: cachedAct.actName,
          shortName: cachedAct.shortName,
          year: Number(cachedAct.year),
          description: cachedAct.description,
          chapters: cachedAct.chapters || []
        } as any;
        this.loading = false;
        this.snackbar.show('Loaded from offline cached data', 'warning');
        this.initActState();
      } else {
        this.error = 'This act is not cached. Please connect online to download.';
        this.loading = false;
      }
      this.cdr.markForCheck();
    }).catch(() => {
      this.error = 'Failed to load offline data.';
      this.loading = false;
      this.cdr.markForCheck();
    });
  }

  private async checkCacheVersionAndClearIfNeeded(): Promise<void> {
    const currentVersion = localStorage.getItem('legalconnect_cache_version');
    if (currentVersion !== EXPECTED_CACHE_VERSION) {
      console.log('🔄 App cache version mismatch/upgrade. Clearing local IndexedDB acts and sections cache...');
      try {
        await this.db.acts.clear();
        await this.db.sections.clear();
        localStorage.setItem('legalconnect_cache_version', EXPECTED_CACHE_VERSION);
        localStorage.removeItem('legalconnect_refreshed_acts');
        console.log('✅ Local IndexedDB acts and sections cache cleared.');
      } catch (err) {
        console.warn('Failed to clear acts/sections tables:', err);
      }
    }
  }

  private loadActData() {
    const refreshedActsStr = localStorage.getItem('legalconnect_refreshed_acts') || '';
    const refreshedActs = refreshedActsStr.split(',').filter(Boolean);
    const hasBeenRefreshed = refreshedActs.includes(this.shortName);
    const forceRefresh = !hasBeenRefreshed && navigator.onLine;

    if (forceRefresh) {
      refreshedActs.push(this.shortName);
      localStorage.setItem('legalconnect_refreshed_acts', refreshedActs.join(','));
      console.log(`🔄 First load of ${this.shortName} since cache clear. Force-refreshing from backend API...`);
    }

    if (navigator.onLine) {
      this.loading = true;
      this.legalService.getActOutline(this.shortName, forceRefresh).subscribe({
        next: res => {
          this.act = res.data;
          this.loading = false;
          this.db.syncActs([res.data]).catch(() => { });
          this.initActState();
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadOfflineAct();
          this.cdr.markForCheck();
        }
      });
    } else {
      this.loadOfflineAct();
    }
  }

  private initActState() {
    this.buildFlatSections();
    this.hasHindiAct = this.act ? this.act.chapters.some(ch => ch.sections.some(s => !!s.title_hi)) : false;
    this.isMappingSupportedAct = this.checkMappingSupported();
    this.equivalentActName = this.checkEquivalentActName();

    if (this.fragmentSub) {
      this.fragmentSub.unsubscribe();
    }
    this.fragmentSub = this.route.fragment.subscribe(fragment => {
      if (fragment && fragment.startsWith('sec-')) {
        const secNum = fragment.replace('sec-', '');
        this.loadSectionByNumber(secNum);
      } else {
        if (this.act && this.act.chapters && this.act.chapters.length > 0) {
          this.activeChapter = this.act.chapters[0];
          if (this.activeChapter.sections && this.activeChapter.sections.length > 0) {
            this.loadSectionDetails(this.activeChapter.sections[0]);
          }
        }
      }
    });
  }

  private loadSectionByNumber(secNum: string) {
    const result = this.findSectionAndChapter(secNum);
    if (result) {
      this.activeChapter = result.ch;
      this.loadSectionDetails(result.sec);
      // Scroll to top so the user sees the section from the beginning
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /** Finds a section and its parent chapter by section number. Deduplicates 3 call sites. */
  private findSectionAndChapter(secNum: string): { sec: Section, ch: Chapter } | null {
    if (!this.act) return null;
    for (const ch of this.act.chapters) {
      const sec = ch.sections.find(s => s.section_number === secNum);
      if (sec) return { sec, ch };
    }
    return null;
  }

  /** Precomputes a flat ordered list of all sections for O(1) next/prev navigation. */
  private buildFlatSections() {
    this.flatSections = [];
    if (!this.act) return;
    this.act.chapters.forEach(ch => ch.sections.forEach(s => this.flatSections.push({ sec: s, ch })));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.streamSubs.forEach(sub => sub.unsubscribe());
    this.streamSubs.clear();
    if (this.fragmentSub) {
      this.fragmentSub.unsubscribe();
    }
    if (this.scrollSub) {
      this.scrollSub.unsubscribe();
    }
    this.stopSpeech();
    this.clearGlossaryAutoCloseTimer();
    window.removeEventListener('scroll', this.onScroll);

    document.body.classList.remove('mobile-drawer-open');
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true')) {
      return;
    }

    if (event.key === 'ArrowLeft') {
      if (this.hasPrev) {
        event.preventDefault();
        this.goToPrevSection();
      }
    } else if (event.key === 'ArrowRight') {
      if (this.hasNext) {
        event.preventDefault();
        this.goToNextSection();
      }
    } else if (event.key === 't' || event.key === 'T') {
      event.preventDefault();
      const langs: ('en' | 'hi' | 'parallel')[] = ['en', 'hi', 'parallel'];
      const currentIdx = langs.indexOf(this.selectedLanguage);
      const nextLang = langs[(currentIdx + 1) % langs.length];
      this.onLanguageChange(nextLang);
      this.snackbar.show(`Language switched to ${nextLang === 'en' ? 'English' : nextLang === 'hi' ? 'Hindi' : 'Parallel View'}`, 'info');
    } else if (event.key === 'l' || event.key === 'L') {
      event.preventDefault();
      this.speakActiveContent();
    } else if (event.key === '/') {
      event.preventDefault();
      const searchInput = document.querySelector('input[placeholder*="Search sections"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  }

  @HostListener('mouseover', ['$event'])
  onMouseOver(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const glossaryTerm = target.closest('.glossary-term') as HTMLElement;

    // Performance Optimization: Only check/reposition if we moved to a different glossary term
    if (glossaryTerm === this.activeHoveredTerm) {
      return;
    }

    this.activeHoveredTerm = glossaryTerm;

    if (glossaryTerm) {
      const tooltip = glossaryTerm.querySelector('.glossary-tooltip') as HTMLElement;
      if (tooltip) {
        this.adjustTooltipPosition(tooltip, glossaryTerm);
      }
    }
  }

  adjustTooltipPosition(tooltip: HTMLElement, term: HTMLElement) {
    // Reset to default centered position to measure correctly
    tooltip.style.removeProperty('--tooltip-left');
    tooltip.style.removeProperty('--tooltip-translate-x');
    tooltip.style.removeProperty('max-width');

    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const padding = 12; // safety margin from screen edges

    if (rect.width > viewportWidth - padding * 2) {
      const termRect = term.getBoundingClientRect();
      const newLeft = padding - termRect.left;
      tooltip.style.setProperty('--tooltip-left', `${newLeft}px`);
      tooltip.style.setProperty('--tooltip-translate-x', '0%');
      tooltip.style.setProperty('max-width', `${viewportWidth - padding * 2}px`);
    } else if (rect.left < padding) {
      const termRect = term.getBoundingClientRect();
      const newLeft = padding - termRect.left;
      tooltip.style.setProperty('--tooltip-left', `${newLeft}px`);
      tooltip.style.setProperty('--tooltip-translate-x', '0%');
    } else if (rect.right > viewportWidth - padding) {
      const termRect = term.getBoundingClientRect();
      const newLeft = viewportWidth - padding - termRect.left - rect.width;
      tooltip.style.setProperty('--tooltip-left', `${newLeft}px`);
      tooltip.style.setProperty('--tooltip-translate-x', '0%');
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // Handle citation link clicks
    const citationLink = target.closest('.legal-citation-link') as HTMLElement;
    if (citationLink) {
      event.preventDefault();
      event.stopPropagation();
      const url = citationLink.getAttribute('href');
      if (url) {
        this.handleCitationClick(url);
      }
      return;
    }

    const glossaryTerm = target.closest('.glossary-term') as HTMLElement;
    const isMobile = window.innerWidth <= 768;

    if (glossaryTerm && isMobile) {
      event.preventDefault();
      event.stopPropagation();

      const tooltip = glossaryTerm.querySelector('.glossary-tooltip') as HTMLElement;
      if (!tooltip) return;

      const isActive = glossaryTerm.classList.contains('active');

      // Close all other glossary terms
      this.closeAllGlossaryTooltips();

      if (!isActive) {
        // Open this tooltip
        glossaryTerm.classList.add('active');
        this.adjustTooltipPosition(tooltip, glossaryTerm);

        // Start auto-close timer (4 seconds)
        this.resetGlossaryAutoCloseTimer(glossaryTerm);
      } else {
        // Clicking active term again closes it
        this.clearGlossaryAutoCloseTimer();
      }
    } else {
      // Clicked outside, close all active tooltips on mobile
      if (isMobile) {
        this.closeAllGlossaryTooltips();
      }
    }
    this.showBinderDropdown = false;
  }

  private closeAllGlossaryTooltips() {
    this.clearGlossaryAutoCloseTimer();
    const activeTerms = document.querySelectorAll('.glossary-term.active');
    activeTerms.forEach(term => term.classList.remove('active'));
  }

  private resetGlossaryAutoCloseTimer(term: HTMLElement) {
    this.clearGlossaryAutoCloseTimer();
    this.glossaryTooltipTimer = setTimeout(() => {
      term.classList.remove('active');
    }, 4000); // 4 seconds auto-close
  }

  private clearGlossaryAutoCloseTimer() {
    if (this.glossaryTooltipTimer) {
      clearTimeout(this.glossaryTooltipTimer);
      this.glossaryTooltipTimer = null;
    }
  }

  selectSection(sec: Section) {
    this.registerSectionView(sec);
    this.activeSectionTab = 'text';
    this.isMobileDrawerOpen = false;
    this.activeScenario = null;

    const result = this.findSectionAndChapter(sec.section_number);
    if (result) {
      this.activeChapter = result.ch;
    }

    this.router.navigate([], { fragment: 'sec-' + sec.section_number, replaceUrl: true });

    this.loadSectionDetails(sec);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private async loadSectionDetails(sec: Section): Promise<void> {
    this.isLimitationExpanded = false;
    if (sec.content) {
      this.activeSection = sec;
      this.activeSectionTimeline = this.getAmendmentTimeline();
      this.loadSectionNotes();
      this.triggerTranslationIfNeeded();
      this.updateActiveSectionBookmarkStatus();
      this.updateSelectedBinderFolder();
      this.updateNavigationState();
      this.cdr.markForCheck();
      return;
    }

    this.loadingSection = true;
    this.cdr.markForCheck();

    try {
      const cachedSec = await this.db.getLocalSection(this.shortName, sec.section_number);
      if (cachedSec && cachedSec.content) {
        sec.content = cachedSec.content;
        sec.content_hi = cachedSec.content_hi;
        sec.aiSummary = cachedSec.aiSummary;
        sec.content_blocks = cachedSec.content_blocks;
        sec.content_blocks_hi = cachedSec.content_blocks_hi;
        sec.introduction_text = cachedSec.introduction_text;
        sec.introduction_text_hi = cachedSec.introduction_text_hi;

        this.prepareSectionSentences(sec);

        this.activeSection = sec;
        this.activeSectionTimeline = this.getAmendmentTimeline();
        this.loadingSection = false;
        this.loadSectionNotes();
        this.triggerTranslationIfNeeded();
        this.updateActiveSectionBookmarkStatus();
        this.updateSelectedBinderFolder();
        this.updateNavigationState();
        this.cdr.markForCheck();

        this.prefetchAdjacentSections(sec);
        return;
      }
    } catch (err) {
      console.warn('Failed to get section from offline cache:', err);
    }

    if (navigator.onLine) {
      this.legalService.getSection(this.shortName, sec.section_number).subscribe({
        next: (res) => {
          const s = res.data;
          sec.content = s.content;
          sec.content_hi = s.content_hi;
          sec.aiSummary = s.aiSummary;
          sec.content_blocks = s.content_blocks;
          sec.content_blocks_hi = s.content_blocks_hi;
          sec.introduction_text = s.introduction_text;
          sec.introduction_text_hi = s.introduction_text_hi;

          if (!sec.content_blocks || sec.content_blocks.length === 0) {
            sec.content_blocks = [{ type: 'main', text: s.content }];
          }
          if (sec.content_hi && (!sec.content_blocks_hi || sec.content_blocks_hi.length === 0)) {
            sec.content_blocks_hi = [{ type: 'main', text: s.content_hi }];
          }

          this.prepareSectionSentences(sec);

          this.activeSection = sec;
          this.activeSectionTimeline = this.getAmendmentTimeline();
          this.loadingSection = false;

          this.db.saveLocalSection({
            actShortName: this.shortName,
            chapterNumber: this.activeChapter?.chapterNumber || '',
            section_number: sec.section_number,
            title: sec.title,
            title_hi: sec.title_hi,
            content: sec.content,
            content_hi: sec.content_hi,
            aiSummary: sec.aiSummary,
            content_blocks: sec.content_blocks,
            content_blocks_hi: sec.content_blocks_hi,
            introduction_text: sec.introduction_text,
            introduction_text_hi: sec.introduction_text_hi
          }).catch(() => { });

          this.loadSectionNotes();
          this.triggerTranslationIfNeeded();
          this.updateActiveSectionBookmarkStatus();
          this.updateSelectedBinderFolder();
          this.updateNavigationState();

          this.prefetchAdjacentSections(sec);
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingSection = false;
          this.snackbar.show('Failed to fetch section content. Check your network.', 'error');
          this.cdr.markForCheck();
        }
      });
    } else {
      this.loadingSection = false;
      this.snackbar.show('You are offline and this section is not cached.', 'error');
      this.cdr.markForCheck();
    }
  }

  private prefetchAdjacentSections(sec: Section) {
    if (!navigator.onLine) return;
    const idx = this.flatSections.findIndex(x => x.sec.section_number === sec.section_number);
    if (idx === -1) return;

    const adjacentIndices = [idx - 1, idx + 1];
    adjacentIndices.forEach(adjIdx => {
      if (adjIdx >= 0 && adjIdx < this.flatSections.length) {
        const adjSec = this.flatSections[adjIdx].sec;
        if (!adjSec.content) {
          this.db.getLocalSection(this.shortName, adjSec.section_number).then(cachedSec => {
            if (!cachedSec || !cachedSec.content) {
              this.legalService.getSection(this.shortName, adjSec.section_number).subscribe({
                next: (res) => {
                  const s = res.data;
                  adjSec.content = s.content;
                  adjSec.content_hi = s.content_hi;
                  adjSec.aiSummary = s.aiSummary;
                  adjSec.content_blocks = s.content_blocks;
                  adjSec.content_blocks_hi = s.content_blocks_hi;
                  adjSec.introduction_text = s.introduction_text;
                  adjSec.introduction_text_hi = s.introduction_text_hi;

                  if (!adjSec.content_blocks || adjSec.content_blocks.length === 0) {
                    adjSec.content_blocks = [{ type: 'main', text: s.content }];
                  }
                  if (adjSec.content_hi && (!adjSec.content_blocks_hi || adjSec.content_blocks_hi.length === 0)) {
                    adjSec.content_blocks_hi = [{ type: 'main', text: s.content_hi }];
                  }

                  this.prepareSectionSentences(adjSec);

                  this.db.saveLocalSection({
                    actShortName: this.shortName,
                    chapterNumber: this.flatSections[adjIdx].ch.chapterNumber || '',
                    section_number: adjSec.section_number,
                    title: adjSec.title,
                    title_hi: adjSec.title_hi,
                    content: adjSec.content,
                    content_hi: adjSec.content_hi,
                    aiSummary: adjSec.aiSummary,
                    content_blocks: adjSec.content_blocks,
                    content_blocks_hi: adjSec.content_blocks_hi,
                    introduction_text: adjSec.introduction_text,
                    introduction_text_hi: adjSec.introduction_text_hi
                  }).catch(() => { });
                }
              });
            } else {
              adjSec.content = cachedSec.content;
              adjSec.content_hi = cachedSec.content_hi;
              adjSec.aiSummary = cachedSec.aiSummary;
              adjSec.content_blocks = cachedSec.content_blocks;
              adjSec.content_blocks_hi = cachedSec.content_blocks_hi;
              adjSec.introduction_text = cachedSec.introduction_text;
              adjSec.introduction_text_hi = cachedSec.introduction_text_hi;
              this.prepareSectionSentences(adjSec);
            }
          });
        }
      }
    });
  }

  private prepareSectionSentences(section: Section) {
    if (!section) return;

    if (section.content_blocks) {
      let idx = 0;
      for (const block of section.content_blocks) {
        if (block.type === 'clause') {
          const parts = this.extractClauseParts(block.text);
          const regex = /(?<=[.!?])\s+/;
          const sentencesText = parts.content.split(regex).filter(s => s.trim().length > 0);
          (block as any).sentences = sentencesText.map(text => ({
            text,
            globalIndex: idx++
          }));
          (block as any).clauseIndicator = parts.indicator;
        } else {
          const regex = /(?<=[.!?])\s+/;
          const sentencesText = block.text.split(regex).filter(s => s.trim().length > 0);
          (block as any).sentences = sentencesText.map(text => ({
            text,
            globalIndex: idx++
          }));
        }
      }
    }

    if (section.content_blocks_hi) {
      let idx = 0;
      for (const block of section.content_blocks_hi) {
        if (block.type === 'clause') {
          const parts = this.extractClauseParts(block.text);
          const regex = /(?<=[।!?\.])\s+/;
          const sentencesText = parts.content.split(regex).filter(s => s.trim().length > 0);
          (block as any).sentences = sentencesText.map(text => ({
            text,
            globalIndex: idx++
          }));
          (block as any).clauseIndicator = parts.indicator;
        } else {
          const regex = /(?<=[।!?\.])\s+/;
          const sentencesText = block.text.split(regex).filter(s => s.trim().length > 0);
          (block as any).sentences = sentencesText.map(text => ({
            text,
            globalIndex: idx++
          }));
        }
      }
    }
  }

  isSentenceActive(globalIndex: number): boolean {
    return this.speechService.isSpeaking && this.activeSpeechSentenceIndex === globalIndex;
  }

  onLanguageChange(lang: 'en' | 'hi' | 'parallel') {
    if (window.innerWidth < 768 && lang === 'parallel') {
      lang = 'en';
    }
    this.selectedLanguage = lang;
    this.triggerTranslationIfNeeded();
    this.cdr.markForCheck();
  }

  triggerTranslationIfNeeded() {
    if (!this.activeSection || !this.act) return;
    // Only translate if user is viewing Hindi or parallel, and content_hi is missing
    if (this.selectedLanguage === 'en') return;
    if (this.activeSection.content_hi && this.activeSection.content_hi.trim().length > 10) return;

    this.translatingSection = true;
    this.cdr.markForCheck();
    this.legalService.translateSection(this.shortName, this.activeSection.section_number)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data && this.activeSection) {
            this.activeSection.content_hi = res.data.content_hi;
            this.activeSection.title_hi = res.data.title_hi;
            this.activeSection.clean_title_hi = res.data.clean_title_hi;
            this.activeSection.introduction_text_hi = res.data.introduction_text_hi;
            this.activeSection.content_blocks_hi = res.data.content_blocks_hi || [{ type: 'main', text: res.data.content_hi }];
            this.hasHindiAct = true;
          }
          this.translatingSection = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Translation failed:', err);
          this.translatingSection = false;
          this.cdr.markForCheck();
        }
      });
  }

  regenerateTranslation() {
    if (!this.activeSection || !this.act) return;
    this.translatingSection = true;
    this.cdr.markForCheck();
    this.legalService.translateSection(this.shortName, this.activeSection.section_number, true)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data && this.activeSection) {
            this.activeSection.content_hi = res.data.content_hi;
            this.activeSection.title_hi = res.data.title_hi;
            this.activeSection.clean_title_hi = res.data.clean_title_hi;
            this.activeSection.introduction_text_hi = res.data.introduction_text_hi;
            this.activeSection.content_blocks_hi = res.data.content_blocks_hi || [{ type: 'main', text: res.data.content_hi }];
            this.hasHindiAct = true;
            this.snackbar.show('Hindi translation regenerated successfully!', 'success');
          }
          this.translatingSection = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Translation regeneration failed:', err);
          this.snackbar.show('Translation regeneration failed.', 'warning');
          this.translatingSection = false;
          this.cdr.markForCheck();
        }
      });
  }

  openBookmarkModal(section: Section) {
    if (!this.isLoggedIn) {
      this.snackbar.show('Please log in to save this section to your library.', 'warning');
      return;
    }
    this.modalActShortName = this.shortName;
    if (this.activeChapter) {
      this.modalChapterNumber = this.activeChapter.chapterNumber;
    }
    this.modalSection = section;
    this.isBookmarkModalOpen = true;
    this.cdr.markForCheck();
  }

  shareSection(section: Section) {
    const url = `${window.location.origin}/laws/${this.shortName}#sec-${section.section_number}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackbar.show('Section link copied to clipboard!', 'success');
    });
  }

  summarizeSection(section: Section) {
    const secKey = section.section_number;
    const cacheKey = `summary:${this.shortName.toLowerCase()}:${secKey.toLowerCase()}`;

    // 1. Check if we already have it in component state
    if (this.summaries[secKey] && this.summaries[secKey].text) {
      return;
    }

    // 2. Check if we have it in localStorage (with 30-day TTL)
    const cachedSummary = localStorage.getItem(cacheKey);
    if (cachedSummary) {
      try {
        const cacheObj = JSON.parse(cachedSummary);
        if (cacheObj && cacheObj.text && cacheObj.timestamp) {
          const ageInMs = Date.now() - cacheObj.timestamp;
          const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
          if (ageInMs < thirtyDaysInMs) {
            this.summaries[secKey] = { loading: false, text: cacheObj.text, error: null };
            this.cdr.markForCheck();
            return;
          } else {
            console.log('Cache expired for summary:', cacheKey);
          }
        } else {
          // Fallback for unexpected structured format
          this.summaries[secKey] = { loading: false, text: cacheObj.text || null, error: null };
          this.cdr.markForCheck();
          if (cacheObj.text) return;
        }
      } catch (e) {
        // Fallback for legacy raw string cache format
        this.summaries[secKey] = { loading: false, text: cachedSummary, error: null };
        this.cdr.markForCheck();
        return;
      }
    }

    if (this.streamSubs.has(secKey)) {
      this.streamSubs.get(secKey)?.unsubscribe();
      this.streamSubs.delete(secKey);
    }

    this.summaries[secKey] = { loading: true, text: '', error: null };
    this.cdr.markForCheck();

    const sub = this.legalService.getSectionSummaryStream(this.shortName, secKey).subscribe({
      next: (chunk) => {
        this.summaries[secKey].loading = false;
        if (this.summaries[secKey].text === null) {
          this.summaries[secKey].text = '';
        }
        this.summaries[secKey].text += chunk;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Streaming summary error:', err);
        if (!this.summaries[secKey].text) {
          this.summaries[secKey] = { loading: false, text: null, error: 'Failed to generate AI summary.' };
        } else {
          this.summaries[secKey].loading = false;
          // Save whatever was loaded successfully with timestamp
          const cacheData = {
            text: this.summaries[secKey].text || '',
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        }
        this.streamSubs.delete(secKey);
        this.cdr.markForCheck();
      },
      complete: () => {
        this.summaries[secKey].loading = false;
        if (this.summaries[secKey].text) {
          // Save successfully completed summary with timestamp
          const cacheData = {
            text: this.summaries[secKey].text || '',
            timestamp: Date.now()
          };
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        }
        this.streamSubs.delete(secKey);
        this.cdr.markForCheck();
      }
    });

    this.streamSubs.set(secKey, sub);
  }

  regenerateSummary(section: Section) {
    const secKey = section.section_number;
    const cacheKey = `summary:${this.shortName.toLowerCase()}:${secKey.toLowerCase()}`;

    // Clear cache
    localStorage.removeItem(cacheKey);
    delete this.summaries[secKey];

    // Force summary generation
    this.summarizeSection(section);
  }



  selectScenario(scenario: LaymanScenario) {
    const result = this.findSectionAndChapter(scenario.section_number);
    if (result) {
      this.selectSection(result.sec);
      this.activeScenario = scenario;
    }
  }

  speakActiveContent() {
    if (this.speechService.isSpeaking) {
      this.speechService.stop();
      return;
    }

    if (!this.activeSection) return;

    let textToSpeak = '';

    if (this.activeSectionTab === 'text') {
      if (this.selectedLanguage === 'hi') {
        textToSpeak = this.activeSection.content_hi || this.activeSection.content;
      } else {
        textToSpeak = this.activeSection.content;
      }
    } else if (this.activeSectionTab === 'ai') {
      const sum = this.summaries[this.activeSection.section_number];
      textToSpeak = sum && sum.text ? sum.text : 'AI Simplification summary is loading or not available.';
    } else {
      textToSpeak = `Section ${this.activeSection.section_number}: ${this.activeSection.title}.`;
    }

    if (!textToSpeak) return;

    const isHindi = this.selectedLanguage === 'hi' && this.activeSectionTab === 'text';
    this.speechService.speak(textToSpeak, isHindi);
  }

  pauseSpeech() {
    this.speechService.pause();
  }

  resumeSpeech() {
    this.speechService.resume();
  }

  stopSpeech() {
    this.speechService.stop();
  }

  updateActiveSectionBookmarkStatus() {
    if (!this.activeSection || !this.act) {
      this.isActiveSectionBookmarked = false;
      return;
    }
    this.isActiveSectionBookmarked = this.bookmarkService.isBookmarked(this.shortName, this.activeSection.section_number);
  }

  updateNavigationState() {
    this.hasPrev = this.hasPrevSection();
    this.hasNext = this.hasNextSection();
  }

  // --- Next/Prev Section Navigation (uses precomputed flatSections) ---
  private get activeSectionIndex(): number {
    if (!this.activeSection) return -1;
    return this.flatSections.findIndex(x => x.sec.section_number === this.activeSection!.section_number);
  }

  goToNextSection() {
    const idx = this.activeSectionIndex;
    if (idx !== -1 && idx < this.flatSections.length - 1) {
      this.selectSection(this.flatSections[idx + 1].sec);
    }
  }

  goToPrevSection() {
    const idx = this.activeSectionIndex;
    if (idx > 0) {
      this.selectSection(this.flatSections[idx - 1].sec);
    }
  }

  hasNextSection(): boolean {
    const idx = this.activeSectionIndex;
    return idx !== -1 && idx < this.flatSections.length - 1;
  }

  hasPrevSection(): boolean {
    return this.activeSectionIndex > 0;
  }

  // --- Annotations & Notes Helpers ---
  loadSectionNotes() {
    if (!this.activeSection || !this.act) return;
    this.currentNoteText = this.noteService.getNoteText(this.shortName, this.activeSection.section_number);
  }

  saveSectionNotes(note: string) {
    if (!this.activeSection || !this.act) return;
    this.currentNoteText = note;
    this.noteService.setSyncStatus('saving');
    this.notesSync$.next({ note, sectionNum: this.activeSection.section_number });
  }

  capitalizeText(text: string): string {
    if (!text) return '';
    const trimmed = text.trim();
    const match = trimmed.match(/([a-zA-Z\u0900-\u097F])/);
    if (match && match.index !== undefined) {
      const idx = match.index;
      return trimmed.slice(0, idx) + trimmed[idx].toUpperCase() + trimmed.slice(idx + 1);
    }
    return trimmed;
  }

  extractClauseParts(text: string): { indicator: string, content: string } {
    if (!text) return { indicator: '', content: '' };

    // Match common indicators: (16), (i), (a), 1., etc. supporting multiline texts, with optional footnote prefix like 1[
    const match = text.trim().match(/^\s*(?:\d+\[)?(\((?:[a-z0-9\u0900-\u097F]+|i[vx]|v?i{1,3})\)|\d+\.)\s*([\s\S]*)$/i);
    if (match) {
      const indicator = match[1];
      const content = match[2];
      return {
        indicator,
        content: this.capitalizeText(content)
      };
    }
    return { indicator: '', content: this.capitalizeText(text) };
  }

  isSubClause(text: string): 'none' | 'sub' | 'deep' {
    if (!text) return 'none';
    let trimmed = text.trim();
    // Strip optional footnote prefix like 1[ so it doesn't affect indentation checks
    trimmed = trimmed.replace(/^\d+\[/, '');
    // 1. Deep sub-clause: roman numerals like (i), (ii), (iii), (iv), (v)
    if (/^\((?=[ivx])(?:x{0,3}(?:ix|iv|v?i{0,3}))\)(?:\s|$)/i.test(trimmed)) {
      return 'deep';
    }
    // 2. Sub-clause: parenthesized letters (a), (b), (c) or Hindi (क), (ख)
    const innerMatch = trimmed.match(/^\(([^)]+)\)/);
    if (innerMatch) {
      const inner = innerMatch[1].trim();
      // If numeric (1), (2), it is a main clause, not a sub-clause
      if (/^\d+$/.test(inner)) {
        return 'none';
      }
      return 'sub';
    }
    return 'none';
  }

  getSectionTitle(sec: Section, useHindi: boolean = false): string {
    if (useHindi && sec.title_hi) {
      return sec.clean_title_hi || sec.title_hi;
    }
    return sec.clean_title || sec.title;
  }

  getEnglishBlocks(sec: Section): ContentBlock[] {
    if (sec.content_blocks && sec.content_blocks.length > 0) {
      return sec.content_blocks;
    }
    return [{ type: 'main', text: sec.content }];
  }

  getHindiBlocks(sec: Section): ContentBlock[] {
    if (sec.content_blocks_hi && sec.content_blocks_hi.length > 0) {
      return sec.content_blocks_hi;
    }
    return sec.content_hi ? [{ type: 'main', text: sec.content_hi }] : [];
  }

  // --- Search Snippet Highlighter ---
  getSearchSnippet(content: string, query: string): string {
    if (!content || !query) return '';
    const idx = content.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) {
      return content.length > 80 ? content.slice(0, 80) + '...' : content;
    }
    const start = Math.max(0, idx - 30);
    const end = Math.min(content.length, idx + query.length + 50);
    let snippet = content.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    const escaped = snippet
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark class="bg-accent/20 text-accent dark:bg-accent/30 dark:text-accent-light px-0.5 rounded">$1</mark>');
  }

  // --- Transition Mapping ---
  isMappingSupported(): boolean {
    return this.isMappingSupportedAct;
  }

  getEquivalentActName(): string {
    return this.equivalentActName;
  }

  private checkMappingSupported(): boolean {
    if (!this.shortName) return false;
    const name = this.shortName.toUpperCase();
    return ['IPC', 'CRPC', 'IEA', 'BNS', 'BNSS', 'BSA'].includes(name);
  }

  private checkEquivalentActName(): string {
    if (!this.shortName) return '';
    const name = this.shortName.toUpperCase();
    switch (name) {
      case 'IPC': return 'BNS';
      case 'BNS': return 'IPC';
      case 'CRPC': return 'BNSS';
      case 'BNSS': return 'CrPC';
      case 'IEA': return 'BSA';
      case 'BSA': return 'IEA';
      default: return '';
    }
  }

  loadCrossReference() {
    this.isCrossRefModalOpen = true;
    this.cdr.markForCheck();
  }

  // --- Glossary Jargon Terms ---
  highlightGlossary(text: string): string {
    if (!text || !this.glossaryRegex) return text || '';

    return text.replace(this.glossaryRegex, (match) => {
      const key = match.toLowerCase();
      const definition = this.glossaryMap.get(key) || '';
      return `<span class="glossary-term group relative cursor-help border-b border-dashed border-accent hover:text-accent transition-colors font-medium">${match}<span class="glossary-tooltip">${definition}</span></span>`;
    });
  }

  // --- Wikipedia-Style Citation Parsing ---
  normalizeTitle(title: string): string {
    return title.toUpperCase()
      .replace(/\bTHE\b/g, '')
      .replace(/\bACT\b/g, '')
      .replace(/\bAND\b/g, '')
      .replace(/\bOF\b/g, '')
      .replace(/[^A-Z]/g, '')
      .trim();
  }

  highlightCitations(text: string): string {
    if (!text) return '';

    let result = text;

    // 1. Match full citations: "Section 4 of the Indian Trusts Act, 1882"
    result = result.replace(FULL_CITATION_REGEX, (match: string, fullText: string, secNum: string, actTitle: string) => {
      const normTitle = this.normalizeTitle(actTitle);
      const matchedAct = this.normalizedActsList.find(a => a.normName === normTitle);
      if (matchedAct) {
        return `<a href="/laws/${matchedAct.shortName}#sec-${secNum}" class="legal-citation-link text-accent underline font-bold cursor-pointer" data-url="/laws/${matchedAct.shortName}#sec-${secNum}">${fullText}</a>`;
      }
      return match;
    });

    // 2. Match local citations: "Section 4"
    if (this.shortName) {
      result = result.replace(LOCAL_CITATION_REGEX, (match: string, fullText: string, secNum: string) => {
        return `<a href="/laws/${this.shortName}#sec-${secNum}" class="legal-citation-link text-accent underline font-bold cursor-pointer" data-url="/laws/${this.shortName}#sec-${secNum}">${fullText}</a>`;
      });
    }

    return result;
  }

  handleCitationClick(url: string) {
    let path = url;
    let fragment = '';

    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      path = url.substring(0, hashIndex);
      fragment = url.substring(hashIndex + 1);
    }

    // Extract act name from path
    // Remove protocol and host if it is an absolute URL resolved by the browser
    let cleanPath = path;
    if (path.includes('://')) {
      try {
        const urlObj = new URL(path);
        cleanPath = urlObj.pathname;
      } catch (e) {
        console.warn('Failed to parse absolute URL:', path, e);
      }
    } else if (path.startsWith('//')) {
      try {
        const urlObj = new URL('http:' + path);
        cleanPath = urlObj.pathname;
      } catch (e) {
        console.warn('Failed to parse protocol-relative URL:', path, e);
      }
    }

    const pathSegments = cleanPath.split('/').filter(Boolean);
    const targetAct = pathSegments.length > 1 ? pathSegments[1] : '';

    if (targetAct && targetAct.toLowerCase() === this.shortName.toLowerCase()) {
      if (fragment.startsWith('sec-')) {
        const secNum = fragment.replace('sec-', '');
        this.loadSectionByNumber(secNum);
        this.router.navigate([], { fragment, replaceUrl: true });
      }
    } else {
      // For different act, do a full navigation
      this.router.navigate([cleanPath], { fragment });
    }
  }

  // --- Search query highlighting with Glossary support ---
  highlightSearchQuery(text: string): string {
    if (!text) return '';

    if (this.lastSearchQuery !== this.sidebarSearchQuery) {
      this.lastSearchQuery = this.sidebarSearchQuery;
      this.highlightCache.clear();

      const query = (this.sidebarSearchQuery || '').trim();
      if (query) {
        // Precompile query regex once when query changes, (?![^<>]*>) matches only outside of HTML tag definitions
        this.searchQueryRegex = new RegExp(`(?![^<>]*>)(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
      } else {
        this.searchQueryRegex = null;
      }
    }

    const cached = this.highlightCache.get(text);
    if (cached !== undefined) {
      return cached;
    }

    // 1. Escape HTML first
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Add citation links
    const withCitations = this.highlightCitations(escaped);

    // 3. Highlight glossary terms (avoiding tag attributes)
    const enriched = this.highlightGlossary(withCitations);

    let result = enriched;

    if (this.searchQueryRegex) {
      result = enriched.replace(this.searchQueryRegex, '<mark class="bg-accent/20 text-accent dark:bg-accent/30 dark:text-accent-light px-0.5 rounded">$1</mark>');
    }

    this.highlightCache.set(text, result);
    return result;
  }

  customBinders: string[] = [];
  selectedBinderFolder = 'none';
  activeSectionTimeline: { label: string; details: string; year?: number }[] = [];

  getAmendmentTimeline(): { label: string; details: string; year?: number }[] {
    if (!this.activeSection || !this.activeSection.content) return [];
    return this.formatter.getAmendmentTimeline(
      this.activeSection.content,
      this.act?.actName || '',
      this.act?.year
    );
  }

  getLimitationWarning(): { title: string; period: string; description: string; urgency: 'info' | 'warning' | 'critical' } | null {
    if (!this.activeSection || !this.activeSection.content) return null;

    const content = this.activeSection.content.toLowerCase();
    const shortNameUpper = this.shortName.toUpperCase();

    // 1. Hardcoded major legal limitation deadlines
    if (shortNameUpper === 'NIA') {
      if (this.activeSection.section_number === '138') {
        return {
          title: 'Statutory Limitation Notice',
          period: '30 Days',
          description: 'A formal notice must be sent to the drawer of the cheque within 30 days of receiving information of its bounce from the bank.',
          urgency: 'critical'
        };
      }
      if (this.activeSection.section_number === '142') {
        return {
          title: 'Limitation to File Complaint',
          period: '1 Month',
          description: 'A formal written complaint must be filed in court within 1 month from the date the cause of action arises (i.e. after 15 days of notice period).',
          urgency: 'critical'
        };
      }
    }

    if (shortNameUpper === 'CPC') {
      if (this.activeSection.section_number === '96' || this.activeSection.section_number === '100') {
        return {
          title: 'Appellate Limitation Period',
          period: '30 to 90 Days',
          description: 'Appeals to High Court or District Court must be preferred within 90 days or 30 days respectively from the date of the decree.',
          urgency: 'warning'
        };
      }
    }

    if (shortNameUpper === 'MVA') {
      if (this.activeSection.section_number === '166') {
        return {
          title: 'Accident Claim Limitation',
          period: '6 Months',
          description: 'No application for compensation shall be entertained unless it is made within six months of the occurrence of the accident.',
          urgency: 'critical'
        };
      }
    }

    // 2. Generic Regex Matcher to scan for text matches
    const thirtyDaysRegex = /within\s+(thirty\s+days|30\s+days)/i;
    const sixtyDaysRegex = /within\s+(sixty\s+days|60\s+days)/i;
    const ninetyDaysRegex = /within\s+(ninety\s+days|90\s+days)/i;
    const oneYearRegex = /within\s+(one\s+year|1\s+year)/i;
    const threeYearsRegex = /within\s+(three\s+years|3\s+years)/i;

    if (thirtyDaysRegex.test(content)) {
      return {
        title: 'Statutory Action Deadline',
        period: '30 Days',
        description: 'This section specifies a response, notice, or filing deadline of 30 days. Action should be taken promptly.',
        urgency: 'warning'
      };
    }
    if (sixtyDaysRegex.test(content)) {
      return {
        title: 'Statutory Action Deadline',
        period: '60 Days',
        description: 'This section specifies a timeline of 60 days for compliance or filing an appeal/notice.',
        urgency: 'warning'
      };
    }
    if (ninetyDaysRegex.test(content)) {
      return {
        title: 'Statutory Action Deadline',
        period: '90 Days',
        description: 'This section specifies a timeline of 90 days for filing appeals, reports, or legal claims.',
        urgency: 'warning'
      };
    }
    if (oneYearRegex.test(content)) {
      return {
        title: 'Limitation Window',
        period: '1 Year',
        description: 'A 1-year limitation or notice window is prescribed under this section for instituting proceedings.',
        urgency: 'info'
      };
    }
    if (threeYearsRegex.test(content)) {
      return {
        title: 'Limitation Window',
        period: '3 Years',
        description: 'A standard 3-year limitation window is specified under this section for filing suits or claims.',
        urgency: 'info'
      };
    }

    return null;
  }

  copyCitation() {
    if (!this.activeSection || !this.act) return;
    const citation = `Section ${this.activeSection.section_number}, ${this.act.actName}, ${this.act.year}`;
    navigator.clipboard.writeText(citation).then(() => {
      this.snackbar.show('Citation copied: ' + citation, 'success');
    }).catch(err => {
      console.error('Failed to copy citation:', err);
      this.snackbar.show('Failed to copy citation.', 'error');
    });
  }

  printPage() {
    window.print();
  }

  shareLink() {
    if (!this.activeSection || !this.act) return;
    const shareUrl = `${window.location.origin}/laws/${this.shortName}#sec-${this.activeSection.section_number}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      this.snackbar.show('Link copied to clipboard!', 'success');
    }).catch(err => {
      console.error('Failed to copy link:', err);
      this.snackbar.show('Failed to copy link.', 'error');
    });
  }

  getShareUrl(): string {
    if (!this.activeSection || !this.act) return '';
    return `${window.location.origin}/laws/${this.shortName}#sec-${this.activeSection.section_number}`;
  }

  getShareText(): string {
    if (!this.activeSection || !this.act) return '';
    return `Read Section ${this.activeSection.section_number} of the ${this.act.actName} (${this.act.year}) on LegalConnect:`;
  }

  getShareSubject(): string {
    if (!this.activeSection || !this.act) return '';
    return `LegalConnect - ${this.act.actName} Section ${this.activeSection.section_number}`;
  }

  loadCustomBinders() {
    const email = this.currentUser ? this.currentUser.email : 'guest';
    const key = `legalconnect_custom_folders_${email}`;
    const saved = localStorage.getItem(key);
    const localFolders = saved ? JSON.parse(saved) : [];

    const activeFolders = this.bookmarkService.bookmarks()
      .map(b => b.collectionName)
      .filter((name): name is string => !!name && name.trim().length > 0);

    this.customBinders = Array.from(new Set([...localFolders, ...activeFolders])).sort();
    localStorage.setItem(key, JSON.stringify(this.customBinders));
  }

  updateSelectedBinderFolder() {
    if (!this.activeSection || !this.act) {
      this.selectedBinderFolder = 'none';
      return;
    }
    const bookmark = this.bookmarkService.bookmarks().find(
      b => b.actShortName === this.shortName && b.section.section_number === this.activeSection!.section_number
    );
    if (bookmark) {
      this.selectedBinderFolder = bookmark.collectionName || 'unassigned';
    } else {
      this.selectedBinderFolder = 'none';
    }
  }

  onBinderChange(folder: string) {
    if (!this.activeSection || !this.act) return;

    if (!this.isLoggedIn && folder !== 'none') {
      this.snackbar.show('Please log in to save sections and organize Research Binders. Local guest bookmarks are not backed up.', 'warning');
    }

    if (folder === 'none') {
      this.bookmarkService.removeBookmark(this.shortName, this.activeSection.section_number);
      this.snackbar.show('Section removed from Research Binders.', 'info');
    } else {
      const collectionName = folder === 'unassigned' ? undefined : folder;
      const isBookmarked = this.bookmarkService.isBookmarked(this.shortName, this.activeSection.section_number);
      if (isBookmarked) {
        this.bookmarkService.updateBookmarkMetadata(
          this.shortName,
          this.activeSection.section_number,
          this.noteService.getNoteText(this.shortName, this.activeSection.section_number),
          collectionName
        );
        this.snackbar.show(`Section moved to binder: ${folder === 'unassigned' ? 'Unassigned' : folder}`, 'success');
      } else {
        this.bookmarkService.addBookmark(
          this.shortName,
          this.activeChapter?.chapterNumber || '1',
          this.activeSection,
          collectionName
        );
        this.snackbar.show(`Section added to binder: ${folder === 'unassigned' ? 'Unassigned' : folder}`, 'success');
      }
    }
    this.updateActiveSectionBookmarkStatus();
    this.cdr.markForCheck();
  }

  toggleLibraryAction() {
    if (!this.activeSection || !this.act) return;
    if (!this.isLoggedIn && !this.isActiveSectionBookmarked) {
      this.snackbar.show('Please log in to save sections and organize Research Binders. Local guest bookmarks are not backed up.', 'warning');
    }
    if (this.isActiveSectionBookmarked) {
      this.onBinderChange('none');
    } else {
      this.onBinderChange('unassigned');
    }
  }

  onBinderFolderChange(folder: string) {
    this.onBinderChange(folder);
  }

  toggleBinderDropdown(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.showBinderDropdown = !this.showBinderDropdown;
    if (this.showBinderDropdown) {
      this.binderSearchQuery = '';
    }
    this.cdr.markForCheck();
  }

  getFilteredBinders(): string[] {
    if (!this.binderSearchQuery || !this.binderSearchQuery.trim()) {
      return this.customBinders;
    }
    const query = this.binderSearchQuery.toLowerCase().trim();
    return this.customBinders.filter(f => f.toLowerCase().includes(query));
  }

  createCustomBinder() {
    const binder = this.newBinderName.trim();
    if (!binder) return;

    if (!this.isLoggedIn) {
      this.snackbar.show('Authentication required: Please log in to create custom Research Binders.', 'warning');
      return;
    }

    if (this.customBinders.includes(binder)) {
      this.snackbar.show('Research binder folder already exists.', 'warning');
      return;
    }

    this.customBinders.push(binder);
    this.customBinders.sort();

    const email = this.currentUser ? this.currentUser.email : 'guest';
    const key = `legalconnect_custom_folders_${email}`;
    localStorage.setItem(key, JSON.stringify(this.customBinders));

    this.newBinderName = '';
    this.showNewBinderInput = false;
    this.snackbar.show(`Research binder "${binder}" created successfully.`, 'success');

    // Auto assign current section to the newly created binder if already bookmarked
    if (this.isActiveSectionBookmarked) {
      this.onBinderChange(binder);
    }

    this.cdr.markForCheck();
  }

  resetComponentState() {
    this.act = null;
    this.activeChapter = null;
    this.activeSection = null;
    this.activeSectionTimeline = [];
    this.summaries = {};
    this.currentNoteText = '';
    this.loading = true;
    this.loadingSection = false;
    this.error = '';
    this.activeScenario = null;
    this.isMobileDrawerOpen = false;
    this.isCrossRefModalOpen = false;
    this.selectedBinderFolder = 'none';
    this.hasHindiAct = false;
    this.isMappingSupportedAct = false;
    this.equivalentActName = '';
    this.hasPrev = false;
    this.hasNext = false;
    this.isActiveSectionBookmarked = false;
    this.showBinderDropdown = false;
    this.binderSearchQuery = '';
    this.showNewBinderInput = false;
    this.newBinderName = '';
    this.isLimitationExpanded = false;
    this.recentSections = [];
    this.highlightCache.clear();
    this.stopSpeech();
    this.cdr.markForCheck();
  }

  registerSectionView(sec: Section) {
    if (!sec) return;
    this.recentSections = this.recentSections.filter(s => s.section_number !== sec.section_number);
    this.recentSections = [sec, ...this.recentSections].slice(0, 4);
  }

  getFormattedContent(section: Section | null): SafeHtml {
    if (!section || !section.content) return '';
    const healed = this.formatter.healTitleAndContent(section.title, section.content);
    const cleaned = this.formatter.cleanSectionContent(healed.content);
    let html = this.formatter.formatSectionHtml(cleaned);

    const query = (this.sidebarSearchQuery || '').trim();
    if (query) {
      const regex = new RegExp(`(?![^<>]*>)(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
      html = html.replace(regex, '<mark class="bg-accent/20 text-accent dark:bg-accent/30 dark:text-accent-light px-0.5 rounded">$1</mark>');
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  getFormattedContentHi(section: Section | null): SafeHtml {
    if (!section || !section.content_hi) return '';
    const healed = this.formatter.healTitleAndContent(section.title_hi || '', section.content_hi);
    const cleaned = this.formatter.cleanSectionContent(healed.content);
    let html = this.formatter.formatSectionHtml(cleaned);

    const query = (this.sidebarSearchQuery || '').trim();
    if (query) {
      const regex = new RegExp(`(?![^<>]*>)(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
      html = html.replace(regex, '<mark class="bg-accent/20 text-accent dark:bg-accent/30 dark:text-accent-light px-0.5 rounded">$1</mark>');
    }

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

}