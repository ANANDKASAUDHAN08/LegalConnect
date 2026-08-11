import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { AdminApiService } from '../../../core/admin-api.service';
import { SkeletonComponent } from '../../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ToastService } from '../../../shared/services/toast.service';
import { LegalTextParser, ParsedLegalSection, LegalClauseNode } from '../../../core/utils/legal-text-parser';
import { Subscription } from 'rxjs';

@Component({
  selector: 'admin-act-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SkeletonComponent, TooltipDirective, ScrollingModule],
  templateUrl: './act-detail.component.html',
  styleUrl: './act-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActDetailComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('searchInput') searchInputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('jumpSearchInput') jumpSearchInputEl?: ElementRef<HTMLInputElement>;
  @ViewChild('virtualViewport') virtualViewport?: CdkVirtualScrollViewport;

  shortName = '';
  act: any = null;
  isLoading = false;
  searchQuery = '';
  activeLanguage: 'en' | 'hi' | 'both' = 'en';
  isEditMode = false;
  editingSection: any = null;
  editForm: any = { section_number: '', title: '', title_hi: '', introduction_text: '', introduction_text_hi: '' };
  editTab: 'en' | 'hi' = 'en';
  isSaving = false;
  activeSectionId = '';
  collapsedChapters: { [key: string]: boolean } = {};
  tocCollapsedChapters: { [key: string]: boolean } = {};
  readingProgress = 0;

  // Reader Customization
  readerTheme: 'slate' | 'light' = 'slate';
  fontScale: number = 100; // 85 to 140
  fontFamily: 'sans' | 'serif' = 'sans';
  viewMode: 'structured' | 'raw' = 'structured';
  showLaymanSummary: { [secId: string]: boolean } = {};
  activeFootnote: { id: string; number: string; text: string } | null = null;
  private parsedSectionsCache = new Map<string, ParsedLegalSection>();

  // UI State — Progressive Disclosure
  showReaderSettings = false;
  showBackToTop = false;
  showJumpToSection = false;
  jumpSearchQuery = '';
  tocSearchQuery = '';
  showDefinedTerms: { [secId: string]: boolean } = {};
  isTocCollapsed = false;
  collapsedSections: { [secId: string]: boolean } = {};

  private paramSub?: Subscription;
  private scrollContainer: HTMLElement | null = null;
  private boundScrollHandler = this.handleContainerScroll.bind(this);

  constructor(
    private route: ActivatedRoute,
    private api: AdminApiService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private elRef: ElementRef
  ) { }

  ngOnInit(): void {
    this.paramSub = this.route.params.subscribe(params => {
      this.shortName = params['shortName'];
      if (this.shortName) {
        this.fetchActDetail();
      }
    });
  }

  ngAfterViewInit(): void {
    // Find the .content-body scroll container from the layout
    this.scrollContainer = document.querySelector('main.content-body');
    if (this.scrollContainer) {
      this.ngZone.runOutsideAngular(() => {
        this.scrollContainer!.addEventListener('scroll', this.boundScrollHandler, { passive: true });
      });
    }
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
    if (this.scrollContainer) {
      this.scrollContainer.removeEventListener('scroll', this.boundScrollHandler);
    }
  }

  /** Auto-enable virtual scroll for acts with many sections */
  get useVirtualScroll(): boolean {
    return this.totalSectionsInActCount > 100;
  }

  private handleContainerScroll(): void {
    this.ngZone.run(() => {
      // Close reader settings dropdown on scroll
      if (this.showReaderSettings) {
        this.showReaderSettings = false;
        this.cdr.markForCheck();
      }

      if (!this.act || !this.act.chapters || !this.scrollContainer) return;

      // Update reading progress
      const scrollTop = this.scrollContainer.scrollTop;
      const docHeight = this.scrollContainer.scrollHeight - this.scrollContainer.clientHeight;
      this.readingProgress = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0;

      // Show/hide back-to-top
      const shouldShow = scrollTop > 300;
      if (this.showBackToTop !== shouldShow) {
        this.showBackToTop = shouldShow;
        this.cdr.markForCheck();
      }

      // Update active section
      const scrollPos = scrollTop + 180;
      for (const chap of this.act.chapters) {
        for (const sec of chap.sections || []) {
          const secNum = String(sec.section_number || sec.sectionNumber || '');
          const el = document.getElementById(`section-${secNum}`);
          if (el) {
            const top = el.offsetTop;
            const height = el.offsetHeight;
            if (scrollPos >= top && scrollPos < top + height) {
              if (this.activeSectionId !== secNum) {
                this.activeSectionId = secNum;
                this.cdr.markForCheck();
              }
              return;
            }
          }
        }
      }
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    // Ignore keypresses when typing in input/textarea
    const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea';

    // Ctrl+F → focus search
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.searchInputEl?.nativeElement?.focus();
    }

    // Escape handling
    if (event.key === 'Escape') {
      if (this.showJumpToSection) {
        this.showJumpToSection = false;
        this.jumpSearchQuery = '';
        this.cdr.markForCheck();
        return;
      }
      if (this.showReaderSettings) {
        this.showReaderSettings = false;
        this.cdr.markForCheck();
        return;
      }
      if (this.editingSection) {
        this.editingSection = null;
        this.cdr.markForCheck();
      } else if (this.searchQuery) {
        this.searchQuery = '';
        this.cdr.markForCheck();
      }
    }

    // Ctrl+G → Jump to section
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      this.toggleJumpToSection();
    }

    // Ctrl+B → Toggle TOC Sidebar (Focus Mode)
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      this.toggleToc();
    }

    // Skip keyboard navigation if typing in an input
    if (isTyping) return;

    // J/K or ↓/↑ — Navigate between sections
    if (event.key === 'j' || event.key === 'ArrowDown') {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.navigateSection(1);
      }
    }
    if (event.key === 'k' || event.key === 'ArrowUp') {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.navigateSection(-1);
      }
    }
  }

  /**
   * Navigate to next/previous section
   */
  navigateSection(direction: 1 | -1): void {
    const flat = this.allFlatSections;
    if (flat.length === 0) return;

    const currentIdx = flat.findIndex(
      item => String(item.section.section_number || item.section.sectionNumber) === this.activeSectionId
    );

    let nextIdx: number;
    if (currentIdx === -1) {
      nextIdx = 0;
    } else {
      nextIdx = currentIdx + direction;
    }

    if (nextIdx < 0 || nextIdx >= flat.length) return;

    const nextSec = flat[nextIdx].section;
    const secNum = String(nextSec.section_number || nextSec.sectionNumber);
    this.scrollToSection(secNum);
  }

  scrollToTop(): void {
    if (this.scrollContainer) {
      this.scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showReaderSettings) return;
    // Check if click is inside the reader settings dropdown or its toggle button
    const target = event.target as HTMLElement;
    const dropdownEl = this.elRef.nativeElement.querySelector('.reader-settings-dropdown');
    const toggleBtn = this.elRef.nativeElement.querySelector('.reader-settings-toggle');
    if (dropdownEl?.contains(target) || toggleBtn?.contains(target)) return;
    this.showReaderSettings = false;
    this.cdr.markForCheck();
  }

  toggleReaderSettings(): void {
    this.showReaderSettings = !this.showReaderSettings;
    this.cdr.markForCheck();
  }

  closeReaderSettings(): void {
    this.showReaderSettings = false;
    this.cdr.markForCheck();
  }

  toggleJumpToSection(): void {
    this.showJumpToSection = !this.showJumpToSection;
    this.jumpSearchQuery = '';
    this.cdr.markForCheck();
    if (this.showJumpToSection) {
      setTimeout(() => this.jumpSearchInputEl?.nativeElement?.focus(), 100);
    }
  }

  toggleToc(): void {
    this.isTocCollapsed = !this.isTocCollapsed;
    this.cdr.markForCheck();
  }

  toggleSectionCollapse(secId: string, event?: Event): void {
    event?.stopPropagation();
    this.collapsedSections[secId] = !this.collapsedSections[secId];
    this.cdr.markForCheck();
  }

  toggleDefinedTerms(secId: string): void {
    this.showDefinedTerms[secId] = !this.showDefinedTerms[secId];
    this.cdr.markForCheck();
  }

  get jumpFilteredSections(): Array<{ section: any; chapterTitle: string }> {
    const flat = this.allFlatSections;
    if (!this.jumpSearchQuery.trim()) return flat.map(f => ({ section: f.section, chapterTitle: f.chapterTitle }));

    const q = this.jumpSearchQuery.toLowerCase().trim();
    return flat
      .filter(f => {
        const secNum = String(f.section.section_number || f.section.sectionNumber || '').toLowerCase();
        const title = this.getCleanTitle(f.section).toLowerCase();
        return secNum.includes(q) || title.includes(q);
      })
      .map(f => ({ section: f.section, chapterTitle: f.chapterTitle }));
  }

  getSecId(sec: any): string {
    return String(sec.section_number || sec.sectionNumber || '');
  }

  getChapKey(chap: any): string {
    return String(chap.chapterNumber || chap.chapter_number || chap.title || '');
  }

  fetchActDetail(): void {
    this.isLoading = true;
    this.cdr.markForCheck();
    this.api.getActDetail(this.shortName).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.act = res.data || res;
        if (this.act && this.act.chapters && this.act.chapters.length > 0) {
          const firstSec = this.act.chapters[0].sections?.[0];
          if (firstSec) {
            this.activeSectionId = String(firstSec.section_number || firstSec.sectionNumber);
          }
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.toast.error('Failed to load Act details.');
        this.cdr.markForCheck();
      }
    });
  }

  get totalSectionsInActCount(): number {
    if (!this.act || !this.act.chapters) return 0;
    return this.act.chapters.reduce((sum: number, chap: any) => sum + (chap.sections?.length || 0), 0);
  }

  get totalMatchingSectionsCount(): number {
    const chapters = this.filteredChapters;
    return chapters.reduce((sum: number, chap: any) => sum + (chap.sections?.length || 0), 0);
  }

  get filteredChapters(): any[] {
    if (!this.act || !this.act.chapters) return [];
    const mainQ = this.searchQuery.toLowerCase().trim();
    const tocQ = this.tocSearchQuery.toLowerCase().trim();
    const q = tocQ || mainQ;
    if (!q) return this.act.chapters;

    return this.act.chapters.map((chap: any) => {
      const matchingSections = (chap.sections || []).filter((sec: any) => {
        const secNum = String(sec.section_number || sec.sectionNumber || '').toLowerCase();
        const title = String(sec.title || '').toLowerCase();
        const titleHi = String(sec.title_hi || '').toLowerCase();
        const content = this.safeStringify(sec.content || sec.introduction_text || '').toLowerCase();
        return secNum.includes(q) || title.includes(q) || titleHi.includes(q) || content.includes(q);
      });
      return { ...chap, sections: matchingSections };
    }).filter((chap: any) => chap.sections.length > 0);
  }

  toggleChapterCollapse(chapKey: string, event?: Event): void {
    event?.stopPropagation();
    this.collapsedChapters[chapKey] = !this.collapsedChapters[chapKey];
    this.cdr.markForCheck();
  }

  expandAllChapters(event?: Event): void {
    event?.stopPropagation();
    this.collapsedChapters = {};
    this.cdr.markForCheck();
  }

  collapseAllChapters(event?: Event): void {
    event?.stopPropagation();
    if (!this.act || !this.act.chapters) return;
    for (const chap of this.act.chapters) {
      const key = String(chap.chapterNumber || chap.chapter_number || chap.title);
      this.collapsedChapters[key] = true;
    }
    this.cdr.markForCheck();
  }

  toggleTocChapterCollapse(chapKey: string, event?: Event): void {
    event?.stopPropagation();
    this.tocCollapsedChapters[chapKey] = !this.tocCollapsedChapters[chapKey];
    this.cdr.markForCheck();
  }

  get areAllTocChaptersCollapsed(): boolean {
    if (!this.act || !this.act.chapters || this.act.chapters.length === 0) return false;
    return this.act.chapters.every((chap: any) => {
      const key = String(chap.chapterNumber || chap.chapter_number || chap.title);
      return !!this.tocCollapsedChapters[key];
    });
  }

  toggleAllTocChapters(event?: Event): void {
    event?.stopPropagation();
    if (this.areAllTocChaptersCollapsed) {
      this.expandAllTocChapters(event);
    } else {
      this.collapseAllTocChapters(event);
    }
  }

  expandAllTocChapters(event?: Event): void {
    event?.stopPropagation();
    this.tocCollapsedChapters = {};
    this.cdr.markForCheck();
  }

  collapseAllTocChapters(event?: Event): void {
    event?.stopPropagation();
    if (!this.act || !this.act.chapters) return;
    for (const chap of this.act.chapters) {
      const key = String(chap.chapterNumber || chap.chapter_number || chap.title);
      this.tocCollapsedChapters[key] = true;
    }
    this.cdr.markForCheck();
  }

  /**
   * Safely converts any value to a string.
   * Prevents [object Object] from rendering when MongoDB returns nested documents.
   */
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

  getCleanTitle(sec: any): string {
    const raw = sec.clean_title || sec.title || '';
    if (!raw) return 'Section ' + (sec.section_number || sec.sectionNumber || '');
    const cleaned = typeof raw === 'string' ? raw : this.safeStringify(raw);
    if (cleaned.includes('.-')) {
      const titlePart = cleaned.split('.-')[0];
      return titlePart.replace(/^Sec(tion)?\s*\d+[\s:.\-]*/i, '').trim();
    }
    return cleaned.replace(/^Sec(tion)?\s*\d+[\s:.\-]*/i, '').trim();
  }

  getCleanBody(sec: any): string {
    let fullContent = sec.content || sec.introduction_text || sec.text || '';

    // Safety: if content is not a string, convert it
    fullContent = this.safeStringify(fullContent);

    if (fullContent && fullContent.trim().length > 5) {
      let cleaned = fullContent
        .replace(/^(February|January|March|April|May|June|July|August|September|October|November|December),\s*\d{4},?\s*see Gazette of India.*?\.\s*/i, '')
        // Strip literal [object Object] artifacts from bad serialization
        .replace(/\[object\s+Object\]/gi, '')
        .replace(/\{"[^"]*":\s*"[^"]*"\}/g, '') // Strip stray JSON fragments
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

  getCleanBlockText(text: any): string {
    const str = this.safeStringify(text);
    return str
      .replace(/\[object\s+Object\]/gi, '')
      .replace(/\{"[^"]*":\s*"[^"]*"\}/g, '')
      .trim();
  }

  /**
   * Returns a cached ParsedLegalSection model generated by LegalTextParser
   */
  getParsedSection(sec: any): ParsedLegalSection {
    const secId = this.getSecId(sec);
    if (this.parsedSectionsCache.has(secId)) {
      return this.parsedSectionsCache.get(secId)!;
    }

    const rawBody = this.getCleanBody(sec);
    const title = this.getCleanTitle(sec);
    const parsed = LegalTextParser.parse(rawBody, title);
    this.parsedSectionsCache.set(secId, parsed);
    return parsed;
  }

  toggleLaymanSummary(secId: string): void {
    this.showLaymanSummary[secId] = !this.showLaymanSummary[secId];
    this.cdr.markForCheck();
  }

  setReaderTheme(theme: 'slate' | 'light'): void {
    this.readerTheme = theme;
    this.cdr.markForCheck();
  }

  setFontScale(delta: number): void {
    this.fontScale = Math.min(140, Math.max(85, this.fontScale + delta));
    this.cdr.markForCheck();
  }

  toggleFontFamily(): void {
    this.fontFamily = this.fontFamily === 'sans' ? 'serif' : 'sans';
    this.cdr.markForCheck();
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

  /** Get the level-specific marker CSS class */
  getMarkerClass(level: number): string {
    switch (level) {
      case 1: return 'marker-l1';
      case 2: return 'marker-l2';
      case 3: return 'marker-l3';
      case 4: return 'marker-l4';
      default: return 'marker-l1';
    }
  }

  /** Get the level-specific node CSS class */
  getNodeLevelClass(level: number): string {
    switch (level) {
      case 1: return 'level-1';
      case 2: return 'level-2';
      case 3: return 'level-3';
      case 4: return 'level-4';
      default: return 'level-1';
    }
  }

  /** Check if a node is a callout type (proviso/explanation/illustration) */
  isCalloutNode(node: LegalClauseNode): boolean {
    return node.type === 'proviso' || node.type === 'explanation' || node.type === 'illustration';
  }

  /** Get callout CSS class */
  getCalloutClass(type: string): string {
    switch (type) {
      case 'proviso': return 'callout-proviso';
      case 'explanation': return 'callout-explanation';
      case 'illustration': return 'callout-illustration';
      default: return '';
    }
  }

  /** Get callout label text */
  getCalloutLabel(type: string): string {
    switch (type) {
      case 'proviso': return 'Proviso';
      case 'explanation': return 'Explanation';
      case 'illustration': return 'Illustration';
      default: return '';
    }
  }

  hasContent(sec: any): boolean {
    const body = this.getCleanBody(sec);
    const blocks = sec.content_blocks;
    return (blocks && blocks.length > 0) || (body && body.length > 10);
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

  get allFlatSections(): Array<{ section: any; chapterNumber: string; chapterTitle: string; index: number }> {
    if (!this.act || !this.act.chapters) return [];
    const flat: Array<{ section: any; chapterNumber: string; chapterTitle: string; index: number }> = [];
    let idx = 0;
    for (const chap of this.filteredChapters) {
      for (const sec of chap.sections || []) {
        flat.push({
          section: sec,
          chapterNumber: String(chap.chapterNumber || chap.chapter_number || ''),
          chapterTitle: String(chap.title || ''),
          index: idx++
        });
      }
    }
    return flat;
  }

  scrollToSection(secNum: string): void {
    const secStr = String(secNum);
    this.activeSectionId = secStr;
    this.showJumpToSection = false;
    this.jumpSearchQuery = '';
    this.cdr.markForCheck();

    if (this.useVirtualScroll && this.virtualViewport) {
      const targetIndex = this.allFlatSections.findIndex(
        item => String(item.section.section_number || item.section.sectionNumber) === secStr
      );
      if (targetIndex >= 0) {
        this.virtualViewport.scrollToIndex(targetIndex, 'smooth');
      }
    } else {
      const el = document.getElementById(`section-${secStr}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  copySectionCitation(sec: any): void {
    const secNum = sec.section_number || sec.sectionNumber;
    const title = this.getCleanTitle(sec);
    const citation = `Section ${secNum}, ${this.act?.actName || this.shortName} (${this.act?.year || ''}): "${title}"`;
    navigator.clipboard.writeText(citation).then(() => {
      this.toast.success(`Citation copied for Section ${secNum}`);
    });
  }

  copySectionLink(sec: any): void {
    const secNum = sec.section_number || sec.sectionNumber;
    const url = `${window.location.origin}/legal-content/${this.shortName}#section-${secNum}`;
    navigator.clipboard.writeText(url).then(() => {
      this.toast.success('Section link copied to clipboard');
    });
  }

  printSection(sec: any): void {
    const secNum = sec.section_number || sec.sectionNumber;
    const title = this.getCleanTitle(sec);
    const body = this.getCleanBody(sec);
    const actTitle = this.act?.actName || this.shortName;
    const year = this.act?.year || '';
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const printWin = window.open('', '_blank', 'width=900,height=750');
    if (!printWin) {
      this.toast.error('Pop-up blocked. Please allow pop-ups for print.');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Section ${secNum} — ${actTitle} (${year})</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');
          @page { size: A4; margin: 20mm 15mm; }
          body { font-family: 'Lora', Georgia, serif; color: #0f172a; background: #ffffff; line-height: 1.7; padding: 30px 40px; margin: 0; }
          .brand-header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px double #1e3a8a; padding-bottom: 16px; margin-bottom: 24px; }
          .brand-logo { font-family: 'Cinzel', serif; font-size: 22px; font-weight: 700; color: #1e3a8a; letter-spacing: 1.5px; }
          .brand-tag { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #475569; background: #f1f5f9; padding: 4px 10px; border-radius: 4px; border: 1px solid #cbd5e1; }
          .act-banner { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px; }
          .act-title { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #3b82f6; margin-bottom: 4px; }
          .sec-header { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0; }
          .sec-subtitle { font-size: 16px; font-style: italic; color: #475569; margin-top: 6px; }
          .body-content { font-size: 15px; color: #1e293b; text-align: justify; white-space: pre-wrap; margin-top: 20px; }
          .citation-box { font-family: 'Inter', sans-serif; font-size: 11px; color: #334155; background: #f1f5f9; border: 1px dashed #cbd5e1; padding: 10px 14px; border-radius: 6px; margin-top: 30px; }
          .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; font-family: 'Inter', sans-serif; font-size: 11px; color: #64748b; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="brand-header">
          <div>
            <div class="brand-logo">LEGALCONNECT</div>
            <div style="font-family: 'Inter', sans-serif; font-size: 10px; color: #64748b; margin-top: 2px;">OFFICIAL DIGITAL STATUTORY RECORD</div>
          </div>
          <div class="brand-tag">Certified Record</div>
        </div>
        <div class="act-banner">
          <div class="act-title">${actTitle} (${year})</div>
          <div class="sec-header">Section ${secNum}</div>
          <div class="sec-subtitle">${title}</div>
        </div>
        <div class="body-content">${body}</div>
        <div class="citation-box"><strong>Citation:</strong> Section ${secNum}, ${actTitle} (${year}) — LegalConnect</div>
        <div class="footer">
          <div>Generated on ${dateStr} • LegalConnect</div>
          <div>Page 1 of 1</div>
        </div>
      </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 300);
  }

  exportFullActPDF(): void {
    if (!this.act) return;
    const actTitle = this.act.actName || this.shortName;
    const year = this.act.year || '';
    const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const printWin = window.open('', '_blank', 'width=1000,height=800');
    if (!printWin) {
      this.toast.error('Pop-up blocked. Please allow pop-ups to export.');
      return;
    }

    let fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${actTitle} (${year}) — Complete Act</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap');
          @page { size: A4; margin: 20mm 15mm; }
          body { font-family: 'Lora', Georgia, serif; color: #0f172a; line-height: 1.7; padding: 40px; margin: 0; }
          .header { border-bottom: 3px double #1e3a8a; padding-bottom: 16px; margin-bottom: 24px; text-align: center; }
          .brand { font-family: 'Cinzel', serif; font-size: 24px; font-weight: 700; color: #1e3a8a; }
          .act-title { font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 10px; }
          .act-meta { font-family: 'Inter', sans-serif; font-size: 12px; color: #475569; margin-top: 4px; }
          .chap-title { font-family: 'Inter', sans-serif; font-size: 15px; font-weight: 700; text-transform: uppercase; color: #1e40af; border-bottom: 2px solid #93c5fd; padding-bottom: 6px; margin-top: 30px; margin-bottom: 16px; page-break-after: avoid; }
          .sec-card { margin-bottom: 20px; page-break-inside: avoid; }
          .sec-num { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 700; color: #0f172a; }
          .sec-body { font-size: 13.5px; color: #1e293b; text-align: justify; white-space: pre-wrap; }
          .footer { margin-top: 50px; border-top: 1px solid #cbd5e1; padding-top: 12px; font-family: 'Inter', sans-serif; font-size: 10px; color: #94a3b8; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">LEGALCONNECT STATUTORY REPOSITORY</div>
          <div class="act-title">${actTitle}</div>
          <div class="act-meta">Year ${year} • Exported ${dateStr}</div>
        </div>
    `;

    for (const chap of this.filteredChapters) {
      fullHtml += `<div class="chap-title">Chapter ${chap.chapterNumber || chap.chapter_number}: ${chap.title}</div>`;
      for (const sec of chap.sections || []) {
        const secNum = sec.section_number || sec.sectionNumber;
        const title = this.getCleanTitle(sec);
        const body = this.getCleanBody(sec);
        fullHtml += `<div class="sec-card"><div class="sec-num">Section ${secNum}. ${title}</div><div class="sec-body">${body}</div></div>`;
      }
    }

    fullHtml += `<div class="footer">LegalConnect Statutory Repository — Official Digital Archive</div></body></html>`;
    printWin.document.write(fullHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => { printWin.print(); }, 400);
  }

  openEditSection(sec: any): void {
    this.editingSection = sec;
    this.editTab = 'en';
    this.editForm = {
      section_number: sec.section_number || sec.sectionNumber || '',
      title: this.getCleanTitle(sec),
      title_hi: sec.title_hi || '',
      introduction_text: this.safeStringify(sec.content || sec.introduction_text || sec.text || ''),
      introduction_text_hi: this.safeStringify(sec.content_hi || sec.introduction_text_hi || sec.text_hi || '')
    };
    this.cdr.markForCheck();
  }

  saveSectionEdit(): void {
    if (!this.editingSection) return;
    this.isSaving = true;
    this.cdr.markForCheck();

    const secId = this.editingSection._id || this.editingSection.id || this.editForm.section_number;

    this.api.updateSection(this.shortName, secId, this.editForm).subscribe({
      next: () => {
        this.isSaving = false;
        this.editingSection.clean_title = this.editForm.title;
        this.editingSection.title = this.editForm.title;
        this.editingSection.title_hi = this.editForm.title_hi;
        this.editingSection.content = this.editForm.introduction_text;
        this.editingSection.introduction_text = this.editForm.introduction_text;
        this.editingSection.introduction_text_hi = this.editForm.introduction_text_hi;
        this.editingSection = null;
        this.toast.success(`Section ${this.editForm.section_number} updated successfully.`);
        this.cdr.markForCheck();
      },
      error: () => {
        this.isSaving = false;
        this.toast.error('Failed to save section edits.');
        this.cdr.markForCheck();
      }
    });
  }

  /** Word count for edit form */
  get editWordCount(): number {
    const text = this.editTab === 'en' ? this.editForm.introduction_text : this.editForm.introduction_text_hi;
    return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  }
}