import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { BareAct, Chapter, Section } from '../../../services/legal.service';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { LaymanScenario, LaymanTopic, LAYMAN_TOPIC_MAP } from '../layman-topics.data';
import { SpeechService } from '../../../services/speech.service';
import { BookmarkService } from '../../../services/bookmark.service';
import { NoteService } from '../../../services/note.service';
import { GLOSSARY_LIST } from '../glossary.data';

@Component({
  selector: 'app-law-viewer-sidebar',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, NgClass, FormsModule, TooltipDirective],
  templateUrl: './law-viewer-sidebar.component.html',
  styleUrls: ['./law-viewer-sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'block w-full'
  }
})
export class LawViewerSidebarComponent implements OnInit, OnDestroy, OnChanges {
  @Input() act: BareAct | null = null;
  @Input() activeSection: Section | null = null;
  @Input() isSidebarCollapsed = false;
  @Input() isScrolled = false;
  @Input() isMobileDrawerOpen = false;
  @Input() recentSections: Section[] = [];

  @Output() sectionSelected = new EventEmitter<Section>();
  @Output() scenarioSelected = new EventEmitter<LaymanScenario>();
  @Output() mobileDrawerClosed = new EventEmitter<void>();
  @Output() searchQueryChanged = new EventEmitter<string>();
  @Output() sidebarToggle = new EventEmitter<void>();
  @Output() sidebarExpand = new EventEmitter<void>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  // Local sidebar-specific state
  sidebarSearchQuery = '';
  sidebarTab: 'chapters' | 'topics' | 'companion' = 'chapters';
  selectedTopic: LaymanTopic | null = null;
  laymanTopics: LaymanTopic[] = [];
  expandedChapter: Chapter | null = null;
  activeChapter: Chapter | null = null;

  get chapterProgress(): { current: number, total: number, percentage: number } {
    if (!this.activeSection || !this.activeChapter || !this.activeChapter.sections) {
      return { current: 0, total: 0, percentage: 0 };
    }
    const total = this.activeChapter.sections.length;
    const current = this.activeChapter.sections.findIndex(s => s.section_number === this.activeSection!.section_number) + 1;
    const percentage = total > 0 ? (current / total) * 100 : 0;
    return { current, total, percentage };
  }

  get readingTime(): number {
    if (!this.activeSection || !this.activeSection.content) return 0;
    const words = this.activeSection.content.split(/\s+/).length;
    return Math.max(1, Math.round(words / 225));
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

  get otherRecents(): Section[] {
    return this.recentSections.filter(s => s.section_number !== this.activeSection?.section_number);
  }

  // Optimized Search state & properties
  private searchSubject = new Subject<string>();
  filteredResults: { chapter: Chapter, sections: Section[] }[] = [];
  filteredSectionsCount = 0;
  totalFilteredResultsCount = 0;
  searchLimit = 25;
  hasMoreResults = false;

  // Flat Search Index for O(1) matching checks
  private searchIndex: {
    sec: Section;
    chap: Chapter;
    secNumLower: string;
    titleLower: string;
    contentLower: string;
    contentHiLower: string;
  }[] = [];

  expandSidebar() {
    if (this.isSidebarCollapsed) {
      this.sidebarExpand.emit();
    }
  }

  onSearchClick() {
    this.expandSidebar();
    setTimeout(() => {
      if (this.searchInput) {
        this.searchInput.nativeElement.focus();
      }
    }, 150);
  }

  onTabClick(tab: 'chapters' | 'topics') {
    this.sidebarTab = tab;
    this.expandSidebar();
  }

  onChapterClick(ch: Chapter) {
    this.expandedChapter = ch;
    if (ch.sections && ch.sections.length > 0) {
      this.selectSection(ch.sections[0]);
    }
    this.expandSidebar();
  }

  onTopicClick(topic: LaymanTopic) {
    this.selectTopic(topic);
    this.expandSidebar();
  }

  private cleanChapterTitleCache = new Map<string, string>();
  private destroy$ = new Subject<void>();

  get isListening(): boolean {
    return this.speechService.isListening;
  }

  get isOnline(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  constructor(
    public speechService: SpeechService,
    public bookmarkService: BookmarkService,
    public noteService: NoteService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // Setup debounced search typing
    this.searchSubject.pipe(
      debounceTime(250),
      takeUntil(this.destroy$)
    ).subscribe(val => {
      this.searchQueryChanged.emit(val);
      this.updateFilteredResults();
    });

    this.speechService.voiceResult$
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.setSearchQuery(result, false);
      });

    this.speechService.isListening$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.markForCheck();
      });

    // Make sidebar react dynamically when bookmarks are updated in parent/service
    this.bookmarkService.bookmarks$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.markForCheck();
      });
  }

  isSectionBookmarked(secNumber: string): boolean {
    if (!this.act) return false;
    return this.bookmarkService.isBookmarked(this.act.shortName, secNumber);
  }

  hasSectionNotes(secNumber: string): boolean {
    if (!this.act) return false;
    const val = this.noteService.getNoteText(this.act.shortName, secNumber);
    return !!(val && val.trim());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['act']) {
      this.precomputeChapterCleanTitles();
      this.buildSearchIndex();
      this.generateDynamicTopics();
      this.expandChapterForActiveSection();
      this.updateFilteredResults();
    }

    if (changes['activeSection']) {
      this.expandChapterForActiveSection();
    }

    if (changes['isMobileDrawerOpen']) {
      if (this.isMobileDrawerOpen) {
        document.body.classList.add('overflow-hidden');
      } else {
        document.body.classList.remove('overflow-hidden');
      }
    }
  }

  precomputeChapterCleanTitles() {
    if (!this.act || !this.act.chapters) return;
    for (const ch of this.act.chapters) {
      ch.cleanTitle = this.getCleanChapterTitle(ch.title);
    }
  }

  buildSearchIndex() {
    this.searchIndex = [];
    if (!this.act || !this.act.chapters) return;
    for (const chap of this.act.chapters) {
      for (const sec of chap.sections) {
        this.searchIndex.push({
          sec,
          chap,
          secNumLower: (sec.section_number || '').toLowerCase(),
          titleLower: (sec.title || '').toLowerCase(),
          contentLower: sec.content ? sec.content.toLowerCase() : '',
          contentHiLower: sec.content_hi ? sec.content_hi.toLowerCase() : ''
        });
      }
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    document.body.classList.remove('overflow-hidden');
  }

  expandChapterForActiveSection() {
    if (!this.activeSection || !this.act) return;
    for (const ch of this.act.chapters) {
      const hasSec = ch.sections.some(s => s.section_number === this.activeSection!.section_number);
      if (hasSec) {
        this.activeChapter = ch;
        this.expandedChapter = ch;
        this.cdr.markForCheck();
        break;
      }
    }
  }

  setChapter(ch: Chapter) {
    this.expandedChapter = this.expandedChapter === ch ? null : ch;
  }

  closeMobileDrawer() {
    this.mobileDrawerClosed.emit();
  }

  setSearchQuery(val: string, debounce = false) {
    this.searchLimit = 25; // Reset limit on new query
    this.sidebarSearchQuery = val;
    this.clearTopic();
    if (debounce) {
      this.searchSubject.next(val);
    } else {
      this.searchQueryChanged.emit(val);
      this.updateFilteredResults();
    }
  }

  onSearchQueryChange(val: string) {
    this.setSearchQuery(val, true);
  }

  selectSection(sec: Section) {
    this.sectionSelected.emit(sec);
    this.closeMobileDrawer();
  }

  selectTopic(topic: LaymanTopic) {
    this.selectedTopic = topic;
    this.sidebarSearchQuery = '';
    this.searchLimit = 25; // Reset limit
    this.searchQueryChanged.emit('');
    this.updateFilteredResults();
  }

  clearSearch() {
    this.setSearchQuery('', false);
  }

  clearTopic() {
    this.selectedTopic = null;
    this.updateFilteredResults();
  }

  showMoreResults() {
    this.searchLimit += 25;
    this.updateFilteredResults();
  }

  selectScenario(scenario: LaymanScenario) {
    this.scenarioSelected.emit(scenario);
    this.closeMobileDrawer();
  }

  startVoiceSearch() {
    this.speechService.startVoiceSearch();
  }

  generateDynamicTopics() {
    if (!this.act || !this.act.chapters) return;
    const short = this.act.shortName.toUpperCase();

    if (LAYMAN_TOPIC_MAP[short]) {
      this.laymanTopics = LAYMAN_TOPIC_MAP[short];
    } else {
      this.laymanTopics = this.act.chapters.slice(0, 5).map(ch => {
        const cleanTitle = ch.title.toLowerCase().replace(/\b(of|and|the|against|relating|to)\b/g, '').trim();
        const keywords = cleanTitle.split(/\s+/).filter(w => w.length > 3);
        const scenarios = ch.sections.slice(0, 3).map(sec => ({
          title: `How does "${sec.title}" apply?`,
          section_number: sec.section_number
        }));
        const cleanChTitle = this.getCleanChapterTitle(ch.title);
        return {
          label: cleanChTitle.length > 30 ? cleanChTitle.slice(0, 28) + '...' : cleanChTitle,
          icon: 'book',
          description: `Sections and provisions under Chapter ${ch.chapterNumber}: ${cleanChTitle}`,
          keywords: keywords.length > 0 ? keywords : [cleanChTitle.toLowerCase()],
          scenarios: scenarios
        };
      });
    }
  }

  updateFilteredResults() {
    const rawResults = this.computeFilteredResults();
    this.totalFilteredResultsCount = rawResults.reduce((acc, curr) => acc + curr.sections.length, 0);

    let currentCount = 0;
    const paginated: { chapter: Chapter, sections: Section[] }[] = [];

    for (const res of rawResults) {
      if (currentCount >= this.searchLimit) break;
      const remainingLimit = this.searchLimit - currentCount;
      if (res.sections.length <= remainingLimit) {
        paginated.push(res);
        currentCount += res.sections.length;
      } else {
        paginated.push({
          chapter: res.chapter,
          sections: res.sections.slice(0, remainingLimit)
        });
        currentCount += remainingLimit;
      }
    }

    this.filteredResults = paginated;
    this.filteredSectionsCount = currentCount;
    this.hasMoreResults = this.totalFilteredResultsCount > this.searchLimit;
    this.cdr.markForCheck();
  }

  private computeFilteredResults(): { chapter: Chapter, sections: Section[] }[] {
    if (!this.act) return [];

    const query = this.sidebarSearchQuery.trim().toLowerCase();
    const topicKeywords = this.selectedTopic ? this.selectedTopic.keywords : [];

    if (!query && !this.selectedTopic) {
      return [];
    }

    const resultsMap = new Map<Chapter, Section[]>();

    for (const item of this.searchIndex) {
      let isMatch = false;

      if (query) {
        if (item.secNumLower.includes(query) ||
          item.titleLower.includes(query) ||
          item.contentLower.includes(query) ||
          item.contentHiLower.includes(query)) {
          isMatch = true;
        }
      } else if (this.selectedTopic) {
        isMatch = topicKeywords.some(keyword =>
          item.titleLower.includes(keyword) || item.contentLower.includes(keyword)
        );
      }

      if (isMatch) {
        if (!resultsMap.has(item.chap)) {
          resultsMap.set(item.chap, []);
        }
        resultsMap.get(item.chap)!.push(item.sec);
      }
    }

    if (query && !this.selectedTopic) {
      for (const chap of this.act.chapters) {
        const chapTitle = chap.title.toLowerCase();
        const chapNum = chap.chapterNumber.toLowerCase();
        if (chapTitle.includes(query) || chapNum === query) {
          if (!resultsMap.has(chap)) {
            resultsMap.set(chap, []);
          }
          const existingSecs = resultsMap.get(chap)!;
          for (const sec of chap.sections) {
            if (!existingSecs.includes(sec)) {
              existingSecs.push(sec);
            }
          }
        }
      }
    }

    const results: { chapter: Chapter, sections: Section[] }[] = [];
    for (const chap of this.act.chapters) {
      if (resultsMap.has(chap)) {
        results.push({
          chapter: chap,
          sections: resultsMap.get(chap)!
        });
      }
    }

    return results;
  }

  trackByChapter(index: number, ch: Chapter): string {
    return ch.chapterNumber;
  }

  trackBySection(index: number, sec: Section): string {
    return sec.section_number;
  }

  trackBySearchResult(index: number, item: { chapter: Chapter, sections: Section[] }): string {
    return item.chapter.chapterNumber;
  }

  trackByTopic(index: number, topic: LaymanTopic): string {
    return topic.label;
  }

  trackByScenario(index: number, sc: any): string {
    return sc.title + '_' + sc.section_number;
  }

  getCleanChapterTitle(title: string): string {
    if (!title) return '';
    const cached = this.cleanChapterTitleCache.get(title);
    if (cached) return cached;

    let clean = title.trim().toLowerCase();
    if (clean.startsWith('of the ')) {
      clean = clean.substring(7);
    } else if (clean.startsWith('of ')) {
      clean = clean.substring(3);
    }

    const minorWords = ['and', 'or', 'but', 'for', 'of', 'in', 'on', 'at', 'to', 'by', 'the', 'a', 'an', 'its', 'with', 'from', 'as'];
    const words = clean.split(/\s+/);
    const result = words.map((word, idx) => {
      if (idx === 0 || !minorWords.includes(word)) {
        return word.replace(/[a-z]/i, (char) => char.toUpperCase());
      }
      return word;
    }).join(' ');

    this.cleanChapterTitleCache.set(title, result);
    return result;
  }

  getSectionTitle(sec: Section, useHindi: boolean = false): string {
    if (useHindi && sec.title_hi) {
      return sec.clean_title_hi || sec.title_hi;
    }
    return sec.clean_title || sec.title;
  }

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

  highlightSearchQuery(text: string): string {
    if (!text) return '';
    const query = (this.sidebarSearchQuery || '').trim();
    if (!query) return text;
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    return escaped.replace(regex, '<mark class="bg-accent/20 text-accent dark:bg-accent/30 dark:text-accent-light px-0.5 rounded">$1</mark>');
  }
}