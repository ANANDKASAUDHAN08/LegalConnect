import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { Chapter, Section } from '../../../services/legal.service';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { GLOSSARY_LIST } from '../glossary.data';

@Component({
  selector: 'app-law-viewer-companion',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, TooltipDirective],
  templateUrl: './law-viewer-companion.component.html',
  styleUrls: ['./law-viewer-companion.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LawViewerCompanionComponent {
  @Input() activeSection: Section | null = null;
  @Input() activeChapter: Chapter | null = null;
  @Input() recentSections: Section[] = [];
  @Input() loadingSection = false;

  @Output() sectionSelected = new EventEmitter<Section>();

  // Companion Dashboard widgets expanded/collapsed states (Accordion)
  isReadingProgressExpanded = true;
  isChapterOutlineExpanded = true;
  isJargonDetectorExpanded = true;
  isRecentlyViewedExpanded = true;

  constructor(private cdr: ChangeDetectorRef) {}

  toggleWidget(widget: 'progress' | 'outline' | 'jargon' | 'recent') {
    if (widget === 'progress') this.isReadingProgressExpanded = !this.isReadingProgressExpanded;
    else if (widget === 'outline') this.isChapterOutlineExpanded = !this.isChapterOutlineExpanded;
    else if (widget === 'jargon') this.isJargonDetectorExpanded = !this.isJargonDetectorExpanded;
    else if (widget === 'recent') this.isRecentlyViewedExpanded = !this.isRecentlyViewedExpanded;
    this.cdr.markForCheck();
  }

  selectSection(sec: Section) {
    this.sectionSelected.emit(sec);
  }

  getSectionTitle(sec: Section): string {
    return sec.clean_title || sec.title;
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

  get readingTime(): number {
    if (!this.activeSection || !this.activeSection.content) return 0;
    const words = this.activeSection.content.split(/\s+/).length;
    return Math.max(1, Math.round(words / 225)); // ~225 words per min
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
}
