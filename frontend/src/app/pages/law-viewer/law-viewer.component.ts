import { Component, OnInit, OnDestroy, HostListener, NgZone, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, takeUntil } from 'rxjs';
import { LegalService, BareAct, Chapter, Section, ContentBlock } from '../../services/legal.service';
import { BookmarkService } from '../../services/bookmark.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { BookmarkModalComponent } from '../../components/bookmark-modal/bookmark-modal.component';
import { DatabaseService } from '../../services/database.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { LaymanScenario } from './layman-topics.data';
import { GLOSSARY_LIST } from './glossary.data';
import { EXPECTED_CACHE_VERSION } from '../../constants/cache.constant';
import { SpeechService } from '../../services/speech.service';
import { LawViewerSidebarComponent } from './law-viewer-sidebar/law-viewer-sidebar.component';
import { LawViewerChatComponent } from './law-viewer-chat/law-viewer-chat.component';
import { LawViewerCompareComponent } from './law-viewer-compare/law-viewer-compare.component';

@Component({
  selector: 'app-law-viewer',
  standalone: true,
  imports: [
    RouterLink,
    NgFor,
    NgIf,
    NgClass,
    BookmarkModalComponent,
    FormsModule,
    TooltipDirective,
    LawViewerSidebarComponent,
    LawViewerChatComponent,
    LawViewerCompareComponent
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
  isMobileDrawerOpen = false;
  loading = true;
  error = '';
  shortName = '';
  isLoggedIn = false;
  currentUser: UserProfile | null = null;

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

  isScrolled = false;

  // Precomputed caches and optimization variables for performance
  hasHindiAct = false;
  isMappingSupportedAct = false;
  equivalentActName = '';
  hasPrev = false;
  hasNext = false;
  isActiveSectionBookmarked = false;

  private flatSections: { sec: Section, ch: Chapter }[] = [];
  private highlightCache = new Map<string, string>();
  private lastSearchQuery = '';
  recentSections: Section[] = [];

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 20;
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
    private legalService: LegalService,
    public bookmarkService: BookmarkService,
    private authService: AuthService,
    private snackbar: SnackbarService,
    private db: DatabaseService,
    public speechService: SpeechService,
    private cdr: ChangeDetectorRef
  ) { }

  adjustFontSize(amount: number) {
    this.fontSize = Math.min(Math.max(12, this.fontSize + amount), 26);
    this.cdr.markForCheck();
  }

  ngOnInit() {
    this.authService.isLoggedIn$.pipe(takeUntil(this.destroy$)).subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      this.cdr.markForCheck();
    });
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUser = user;
      this.cdr.markForCheck();
    });
    this.bookmarkService.bookmarks$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateActiveSectionBookmarkStatus();
      this.cdr.markForCheck();
    });
    this.shortName = this.route.snapshot.paramMap.get('shortName') || '';

    this.checkCacheVersionAndClearIfNeeded().then(() => {
      this.loadActData();
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
      console.log('🔄 App cache version mismatch/upgrade. Clearing local IndexedDB acts cache...');
      try {
        await this.db.acts.clear();
        localStorage.setItem('legalconnect_cache_version', EXPECTED_CACHE_VERSION);
        localStorage.removeItem('legalconnect_refreshed_acts');
        console.log('✅ Local IndexedDB acts cache cleared.');
      } catch (err) {
        console.warn('Failed to clear acts table:', err);
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
      this.legalService.getActByShortName(this.shortName, forceRefresh).subscribe({
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
    this.hasHindiAct = this.act ? this.act.chapters.some(ch => ch.sections.some(s => !!s.content_hi)) : false;
    this.isMappingSupportedAct = this.checkMappingSupported();
    this.equivalentActName = this.checkEquivalentActName();

    if (this.act) {
      for (const ch of this.act.chapters) {
        for (const sec of ch.sections) {
          if (!sec.content_blocks || sec.content_blocks.length === 0) {
            sec.content_blocks = [{ type: 'main', text: sec.content }];
          }
          if (sec.content_hi && (!sec.content_blocks_hi || sec.content_blocks_hi.length === 0)) {
            sec.content_blocks_hi = [{ type: 'main', text: sec.content_hi }];
          }
        }
      }
    }

    this.route.fragment.pipe(takeUntil(this.destroy$)).subscribe(fragment => {
      if (fragment && fragment.startsWith('sec-')) {
        const secNum = fragment.replace('sec-', '');
        this.loadSectionByNumber(secNum);
      } else {
        if (this.act && this.act.chapters && this.act.chapters.length > 0) {
          this.activeChapter = this.act.chapters[0];
          if (this.activeChapter.sections && this.activeChapter.sections.length > 0) {
            this.activeSection = this.activeChapter.sections[0];
            this.loadSectionNotes();
          }
        }
      }
      if (this.activeSection) {
        this.registerSectionView(this.activeSection);
      }
      this.updateActiveSectionBookmarkStatus();
      this.updateNavigationState();
      this.cdr.markForCheck();
    });
  }

  private loadSectionByNumber(secNum: string) {
    const result = this.findSectionAndChapter(secNum);
    if (result) {
      this.activeChapter = result.ch;
      this.activeSection = result.sec;
      this.loadSectionNotes();
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
    this.stopSpeech();
  }

  selectSection(sec: Section) {
    this.activeSection = sec;
    this.registerSectionView(sec);
    this.activeSectionTab = 'text';
    this.isMobileDrawerOpen = false;
    this.activeScenario = null;

    const result = this.findSectionAndChapter(sec.section_number);
    if (result) {
      this.activeChapter = result.ch;
    }

    this.loadSectionNotes();
    this.triggerTranslationIfNeeded();
    this.updateActiveSectionBookmarkStatus();
    this.updateNavigationState();
    this.cdr.markForCheck();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onLanguageChange(lang: 'en' | 'hi' | 'parallel') {
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
    this.legalService.translateSection(this.shortName, this.activeSection.section_number).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success && res.data && this.activeSection) {
          this.activeSection.content_hi = res.data.content_hi;
          this.activeSection.title_hi = res.data.title_hi;
          this.activeSection.content_blocks_hi = [{ type: 'main', text: res.data.content_hi }];
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
    this.legalService.translateSection(this.shortName, this.activeSection.section_number, true).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success && res.data && this.activeSection) {
          this.activeSection.content_hi = res.data.content_hi;
          this.activeSection.title_hi = res.data.title_hi;
          this.activeSection.content_blocks_hi = [{ type: 'main', text: res.data.content_hi }];
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
    const key = `note_${this.shortName}_${this.activeSection.section_number}`;
    this.currentNoteText = localStorage.getItem(key) || '';
  }

  saveSectionNotes(note: string) {
    if (!this.activeSection || !this.act) return;
    this.currentNoteText = note;
    const key = `note_${this.shortName}_${this.activeSection.section_number}`;
    if (note.trim()) {
      localStorage.setItem(key, note);
    } else {
      localStorage.removeItem(key);
    }
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

    // Match common indicators: (16), (i), (a), 1., etc. supporting multiline texts
    const match = text.trim().match(/^\s*(\((?:[a-z0-9\u0900-\u097F]+|i[vx]|v?i{1,3})\)|\d+\.)\s*([\s\S]*)$/i);
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
    const trimmed = text.trim();
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
    if (!text) return '';
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    GLOSSARY_LIST.forEach(item => {
      const regex = new RegExp(`\\b(${item.term})\\b`, 'gi');
      escaped = escaped.replace(regex, (match) => {
        return `<span class="glossary-term group relative cursor-help border-b border-dashed border-accent hover:text-accent transition-colors font-medium">${match}<span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-md text-white text-[11px] leading-relaxed rounded-xl shadow-xl border border-white/10 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-300 z-50 normal-case font-normal text-center">${item.definition}</span></span>`;
      });
    });

    return escaped;
  }

  // --- Search query highlighting with Glossary support ---
  highlightSearchQuery(text: string): string {
    if (!text) return '';

    if (this.lastSearchQuery !== this.sidebarSearchQuery) {
      this.lastSearchQuery = this.sidebarSearchQuery;
      this.highlightCache.clear();
    }

    const cached = this.highlightCache.get(text);
    if (cached !== undefined) {
      return cached;
    }

    const enriched = this.highlightGlossary(text);
    let result = enriched;

    if (this.sidebarSearchQuery && this.sidebarSearchQuery.trim()) {
      const query = this.sidebarSearchQuery.trim();
      // (?![^<>]*>) matches the query only outside of HTML tag definitions
      const tagRegex = new RegExp(`(?![^<>]*>)(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
      result = enriched.replace(tagRegex, '<mark class="bg-accent/20 text-accent dark:bg-accent/30 dark:text-accent-light px-0.5 rounded">$1</mark>');
    }

    this.highlightCache.set(text, result);
    return result;
  }

  parseMarkdown(text: string): string {
    if (!text) return '';

    // Escaped HTML to prevent injection
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold: **text** -> <strong>text</strong>
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-text-primary dark:text-white">$1</strong>');

    // Italics: *text* -> <em>text</em>
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

    const lines = html.split('\n');
    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith('* ')) {
        const itemContent = trimmed.substring(2);
        return `<li class="ml-6 list-disc mb-1.5 text-text-secondary dark:text-slate-350">${itemContent}</li>`;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+)\.\s(.*)$/);
        if (match) {
          return `<div class="font-bold text-sm text-accent mt-4 mb-2 flex items-start gap-1.5"><span>${match[1]}.</span> <span>${match[2]}</span></div>`;
        }
      }
      return trimmed ? `<p class="mb-2 leading-relaxed text-text-secondary dark:text-slate-350">${trimmed}</p>` : '';
    });

    return formattedLines.join('\n');
  }

  registerSectionView(sec: Section) {
    if (!sec) return;
    this.recentSections = this.recentSections.filter(s => s.section_number !== sec.section_number);
    this.recentSections = [sec, ...this.recentSections].slice(0, 4);
  }

  get otherRecents(): Section[] {
    return this.recentSections.filter(s => s.section_number !== this.activeSection?.section_number);
  }

  get detectedGlossaryTerms(): { term: string, definition: string }[] {
    if (!this.activeSection) return [];
    const content = (this.activeSection.content || '').toLowerCase();
    const title = (this.activeSection.title || '').toLowerCase();
    return GLOSSARY_LIST.filter(item => {
      const termLower = item.term.toLowerCase();
      return content.includes(termLower) || title.includes(termLower);
    });
  }

  get chapterProgress(): { current: number, total: number, percentage: number } {
    if (!this.activeSection || !this.activeChapter || !this.activeChapter.sections) {
      return { current: 0, total: 0, percentage: 0 };
    }
    const total = this.activeChapter.sections.length;
    const current = this.activeChapter.sections.findIndex(s => s.section_number === this.activeSection!.section_number) + 1;
    const percentage = total > 0 ? (current / total) * 100 : 0;
    return { current, total, percentage };
  }
}