import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { BareAct, Chapter, Section } from '../../../services/legal.service';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { LaymanScenario, LaymanTopic, LAYMAN_TOPIC_MAP } from '../layman-topics.data';
import { SpeechService } from '../../../services/speech.service';

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

  @Output() sectionSelected = new EventEmitter<Section>();
  @Output() scenarioSelected = new EventEmitter<LaymanScenario>();
  @Output() mobileDrawerClosed = new EventEmitter<void>();
  @Output() searchQueryChanged = new EventEmitter<string>();
  @Output() sidebarToggle = new EventEmitter<void>();
  @Output() sidebarExpand = new EventEmitter<void>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  // Local sidebar-specific state
  sidebarSearchQuery = '';
  sidebarTab: 'chapters' | 'topics' = 'chapters';
  selectedTopic: LaymanTopic | null = null;
  laymanTopics: LaymanTopic[] = [];
  expandedChapter: Chapter | null = null;
  activeChapter: Chapter | null = null;

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
  private _filteredResults: { chapter: Chapter, sections: Section[] }[] = [];
  private _filteredResultsKey = '';
  private destroy$ = new Subject<void>();

  get isListening(): boolean {
    return this.speechService.isListening;
  }

  constructor(
    public speechService: SpeechService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.speechService.voiceResult$
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.sidebarSearchQuery = result;
        this.clearTopic();
        this.searchQueryChanged.emit(result);
        this.cdr.markForCheck();
      });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['act']) {
      this.precomputeChapterCleanTitles();
      this.generateDynamicTopics();
      this.expandChapterForActiveSection();
    }
    if (changes['activeSection']) {
      this.expandChapterForActiveSection();
    }
  }

  precomputeChapterCleanTitles() {
    if (!this.act || !this.act.chapters) return;
    for (const ch of this.act.chapters) {
      ch.cleanTitle = this.getCleanChapterTitle(ch.title);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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

  onSearchQueryChange(val: string) {
    this.clearTopic();
    this.searchQueryChanged.emit(val);
  }

  selectSection(sec: Section) {
    this.sectionSelected.emit(sec);
    this.closeMobileDrawer();
  }

  selectTopic(topic: LaymanTopic) {
    this.selectedTopic = topic;
    this.sidebarSearchQuery = '';
    this.searchQueryChanged.emit('');
  }

  clearSearch() {
    this.sidebarSearchQuery = '';
    this.searchQueryChanged.emit('');
  }

  clearTopic() {
    this.selectedTopic = null;
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
        const cleanTitle = ch.title.toLowerCase().replace(/of|and|the|against|relating|to/g, '').trim();
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

  get filteredResults(): { chapter: Chapter, sections: Section[] }[] {
    const key = `${this.sidebarSearchQuery}|${this.selectedTopic?.label || ''}`;
    if (key !== this._filteredResultsKey) {
      this._filteredResultsKey = key;
      this._filteredResults = this.computeFilteredResults();
    }
    return this._filteredResults;
  }

  get filteredSectionsCount(): number {
    return this.filteredResults.reduce((acc, curr) => acc + curr.sections.length, 0);
  }

  private computeFilteredResults(): { chapter: Chapter, sections: Section[] }[] {
    if (!this.act) return [];

    const query = this.sidebarSearchQuery.trim().toLowerCase();
    const topicKeywords = this.selectedTopic ? this.selectedTopic.keywords : [];

    if (!query && !this.selectedTopic) {
      return [];
    }

    const results: { chapter: Chapter, sections: Section[] }[] = [];

    for (const chap of this.act.chapters) {
      const matchingSections: Section[] = [];

      for (const sec of chap.sections) {
        let isMatch = false;

        if (query) {
          const secNum = sec.section_number.toLowerCase();
          const title = sec.title.toLowerCase();
          const content = sec.content.toLowerCase();
          const contentHi = sec.content_hi ? sec.content_hi.toLowerCase() : '';

          if (secNum.includes(query) || title.includes(query) || content.includes(query) || contentHi.includes(query)) {
            isMatch = true;
          }
        } else if (this.selectedTopic) {
          const title = sec.title.toLowerCase();
          const content = sec.content.toLowerCase();

          isMatch = topicKeywords.some(keyword =>
            title.includes(keyword) || content.includes(keyword)
          );
        }

        if (isMatch) {
          matchingSections.push(sec);
        }
      }

      if (query && !this.selectedTopic) {
        const chapTitle = chap.title.toLowerCase();
        const chapNum = chap.chapterNumber.toLowerCase();
        if (chapTitle.includes(query) || chapNum === query) {
          for (const sec of chap.sections) {
            if (!matchingSections.includes(sec)) {
              matchingSections.push(sec);
            }
          }
        }
      }

      if (matchingSections.length > 0) {
        results.push({
          chapter: chap,
          sections: matchingSections
        });
      }
    }

    return results;
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
}