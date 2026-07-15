import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, AfterViewInit, OnChanges, SimpleChanges, ViewChild, ElementRef, inject, ChangeDetectionStrategy, ChangeDetectorRef, ViewEncapsulation, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LegalService } from '../../../../services/legal.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { FormattingService } from '../../../../services/formatting.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { BookmarkService, Bookmark } from '../../../../services/bookmark.service';

@Component({
  selector: 'app-reader-modal',
  standalone: true,
  imports: [CommonModule, TooltipDirective, FormsModule],
  templateUrl: './reader-modal.component.html',
  styleUrls: ['./reader-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReaderModeModalComponent implements OnInit, OnDestroy, AfterViewInit, OnChanges {
  private sanitizer = inject(DomSanitizer);
  private legalService = inject(LegalService);
  private snackbar = inject(SnackbarService);
  private formattingService = inject(FormattingService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private bookmarkService = inject(BookmarkService);

  @ViewChild('contentContainer') contentContainer!: ElementRef<HTMLDivElement>;

  @Input() readerSection: any;
  @Input() lastQuery = '';
  @Input() bookmark: Bookmark | null = null;
  @Input() customCollections: string[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() notesChanged = new EventEmitter<{ bookmark: Bookmark, notes: string }>();
  @Output() folderAssigned = new EventEmitter<{ bookmark: Bookmark, folder: string }>();

  // Workspace Notes State
  showFolderDropdown = false;
  noteText = '';
  notesSaveStatus: 'idle' | 'saving' | 'saved' = 'idle';
  private saveTimeout: any = null;

  // Reader Settings
  readerFontSize: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  readerLineHeight: 'normal' | 'relaxed' | 'loose' = 'relaxed';
  readerContrast: 'default' | 'high' | 'dyslexic' = 'default';
  readerLanguage: 'EN' | 'HI' = 'EN';
  isTranslating = false;

  // Text-To-Speech State
  isPlayingSpeech = false;
  isPausedSpeech = false;
  private currentSpeechUtterance: SpeechSynthesisUtterance | null = null;

  // AI Assistant Chat Panel
  chatOpen = false;
  chatInput = '';
  chatMessages: Array<{ sender: 'user' | 'ai'; text: string }> = [];
  chatLoading = false;

  // Popover States
  jargonPopover: { term: string; definition: string; loading: boolean; top: number; left: number } | null = null;
  explainSelectionBubble: { text: string; top: number; left: number } | null = null;
  explainSelectionResult: { text: string; explanation: string; loading: boolean; top: number; left: number } | null = null;

  // Cached rendered HTML to prevent re-renders that destroy text selection
  cachedReaderHtml: string = '';

  private hoverTimer: any = null;
  private jargonCache = new Map<string, string>();

  actHue = 215;

  ngOnInit() {
    this.readerLanguage = 'EN';
    if (typeof document !== 'undefined') {
      document.body.classList.add('overflow-hidden');
    }
    if (this.readerSection) {
      this.actHue = this.getActHue(this.readerSection.shortName);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['bookmark'] && this.bookmark) {
      this.noteText = this.bookmark.notes || '';
    }
    if (changes['readerSection'] && this.readerSection) {
      this.actHue = this.getActHue(this.readerSection.shortName);
    }
  }

  onNotesInput(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    this.noteText = textarea.value;

    this.notesSaveStatus = 'saving';
    this.cdr.markForCheck();

    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      if (this.bookmark) {
        this.notesChanged.emit({ bookmark: this.bookmark, notes: this.noteText });
        this.notesSaveStatus = 'saved';
        this.cdr.markForCheck();

        setTimeout(() => {
          if (this.notesSaveStatus === 'saved') {
            this.notesSaveStatus = 'idle';
            this.cdr.markForCheck();
          }
        }, 2000);
      }
    }, 800);
  }

  assignFolder(folder: string) {
    if (this.bookmark) {
      this.bookmark.collectionName = folder === 'Unassigned' ? '' : folder;
      this.folderAssigned.emit({ bookmark: this.bookmark, folder });
    }
    this.showFolderDropdown = false;
    this.cdr.markForCheck();
  }

  get readingTime(): string {
    const content = this.readerSection?.content || '';
    const words = content.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.round(words / 200));
    return `${minutes} min read`;
  }

  get formattedSavedDate(): string {
    if (!this.bookmark?.savedAt) return '';
    return new Date(this.bookmark.savedAt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  onRemoveBookmark() {
    if (this.bookmark) {
      this.bookmarkService.removeBookmark(this.bookmark.actShortName, this.bookmark.section.section_number);
      this.closeModal();
    }
  }

  ngAfterViewInit() {
    this.rebuildCachedHtml();
  }

  rebuildCachedHtml() {
    this.cachedReaderHtml = this.getCleanReaderContent();
    if (this.contentContainer) {
      this.contentContainer.nativeElement.innerHTML = this.cachedReaderHtml;
    }
  }

  ngOnDestroy() {
    // Optimization #4: cancel speech synthesis to prevent leaks/overlap
    this.stopTextToSpeech();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  closeModal() {
    this.stopTextToSpeech();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
    this.close.emit();
  }

  onPanelClick(event: MouseEvent) {
    this.showFolderDropdown = false;
    event.stopPropagation();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  setReaderLanguage(lang: 'EN' | 'HI') {
    this.readerLanguage = lang;
    this.stopTextToSpeech();
    this.rebuildCachedHtml();

    if (lang === 'HI' && (!this.readerSection.content_hi || !this.readerSection.title_hi)) {
      this.isTranslating = true;
      this.cdr.markForCheck();

      this.legalService.translateSection(this.readerSection.shortName, this.readerSection.section_number).subscribe({
        next: (res) => {
          if (res && res.success && res.data) {
            // Re-assign immutably to prevent TypeError on frozen/cached objects and trigger CD
            this.readerSection = {
              ...this.readerSection,
              content_hi: res.data.content_hi,
              title_hi: res.data.title_hi
            };
            this.snackbar.show('Translated section content to Hindi successfully.', 'success');
          } else {
            this.snackbar.show('Failed to load Hindi translation. Fallback to English content.', 'warning');
          }
          this.isTranslating = false;
          this.rebuildCachedHtml();
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error(err);
          this.snackbar.show('Translation API error. Make sure the backend server is running.', 'error');
          this.isTranslating = false;
          this.rebuildCachedHtml();
          this.cdr.markForCheck();
        }
      });
    }
  }

  isTranslationFallback(): boolean {
    if (this.readerLanguage !== 'HI' || !this.readerSection) return false;
    const content = this.readerSection.content_hi || '';
    return content.includes('अनुवाद अनुपलब्ध') || content.includes('Mock Translation') || content.includes('GEMINI_API_KEY');
  }

  getReaderTitle(): string {
    if (!this.readerSection) return '';
    const isHindi = this.readerLanguage === 'HI';
    let titleText = isHindi
      ? (this.readerSection.title_hi || this.readerSection.title)
      : (this.readerSection.rawTitle || this.readerSection.title);
    if (isHindi && titleText) {
      titleText = titleText.replace(/^\(हिंदी अनुवाद अनुपलब्ध\)\s*/, '');
      titleText = titleText.replace(/^\(Mock Translation\)\s*/, '');
    }
    return (titleText || '').replace(/<[^>]*>/g, '');
  }

  private getCleanReaderContent(): string {
    if (!this.readerSection) return '';
    const isHindi = this.readerLanguage === 'HI';
    let text = isHindi
      ? (this.readerSection.content_hi || this.readerSection.content)
      : this.readerSection.content;
    const titleText = isHindi
      ? (this.readerSection.title_hi || this.readerSection.title)
      : this.readerSection.title;

    // Clean out translation warning prefix if present in fallback translation content
    if (isHindi && text) {
      text = text.replace(/^\(हिंदी अनुवाद अनुपलब्ध है\)\s*/, '');
      text = text.replace(/^\(Mock Translation\)\s*/, '');
      text = text.replace(/^\(Mock Translation\) GEMINI_API_KEY is not configured\. Please set it in backend\/\.env to enable real translations\.\s*/, '');
    }

    // Heal, Clean, and Format statutory text using the formatting service
    const healed = this.formattingService.healTitleAndContent(titleText || '', text || '');
    const cleaned = this.formattingService.cleanSectionContent(healed.content);
    const formattedHtml = this.formattingService.formatSectionHtml(cleaned);

    // Highlight legal terminology
    let parsedText = formattedHtml;
    const terminology = [
      'bail', 'warrant', 'cognizable', 'non-cognizable', 'compoundable', 'injunction', 'summons', 'affidavit', 'plaintiff', 'defendant',
      'declaration', 'demolish', 'collector', 'emergency', 'contravention', 'publication', 'evidence', 'boundaries', 'excavation', 'accrued'
    ];

    terminology.forEach(term => {
      const reg = new RegExp(`\\b(${term})\\b`, 'gi');
      parsedText = parsedText.replace(reg, `<span class="jargon-word underline decoration-dashed decoration-accent/50 hover:decoration-accent hover:text-accent cursor-help font-semibold font-mono">$1</span>`);
    });

    return parsedText;
  }

  closeAllPopovers(event?: MouseEvent) {
    this.jargonPopover = null;
    this.explainSelectionBubble = null;
    this.explainSelectionResult = null;
    this.cdr.markForCheck();
  }

  closeJargonPopover() {
    this.jargonPopover = null;
    this.cdr.markForCheck();
  }

  handleJargonClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target && target.classList.contains('jargon-word')) {
      event.stopPropagation();
      const term = target.textContent || '';
      const rect = target.getBoundingClientRect();

      // Clear the hover timer since it's an explicit click
      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
        this.hoverTimer = null;
      }

      this.showJargonPopoverAt(term, rect);
    }
  }

  handleJargonMouseOver(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target && target.classList.contains('jargon-word')) {
      const term = target.textContent || '';

      if (this.hoverTimer) {
        clearTimeout(this.hoverTimer);
      }

      this.hoverTimer = setTimeout(() => {
        const rect = target.getBoundingClientRect();
        this.showJargonPopoverAt(term, rect);
      }, 400);
    }
  }

  handleJargonMouseOut(event: MouseEvent) {
    const relatedTarget = event.relatedTarget as HTMLElement;

    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = null;
    }

    // Do not close if mouse moves to the popover itself
    if (relatedTarget && (relatedTarget.closest('.jargon-popover') || relatedTarget.classList.contains('jargon-word'))) {
      return;
    }

    this.closeJargonPopover();
  }

  handlePopoverMouseLeave(event: MouseEvent) {
    const relatedTarget = event.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.classList.contains('jargon-word')) {
      return;
    }
    this.closeJargonPopover();
  }

  private showJargonPopoverAt(term: string, rect: DOMRect) {
    if (this.jargonPopover && this.jargonPopover.term === term) {
      return;
    }

    this.explainSelectionBubble = null;
    this.explainSelectionResult = null;

    if (this.jargonCache.has(term)) {
      this.jargonPopover = {
        term,
        definition: this.jargonCache.get(term)!,
        loading: false,
        top: rect.top - 8,
        left: rect.left + rect.width / 2
      };
      this.cdr.markForCheck();
      return;
    }

    this.jargonPopover = {
      term,
      definition: '',
      loading: true,
      top: rect.top - 8,
      left: rect.left + rect.width / 2
    };
    this.cdr.markForCheck();

    this.legalService.askLegalQuestion(`Explain legal term "${term}" in one simple sentence.`).subscribe({
      next: (res) => {
        if (this.jargonPopover && this.jargonPopover.term === term) {
          const definition = res && res.answer ? res.answer : 'No definition available.';
          this.jargonCache.set(term, definition);
          this.jargonPopover.definition = definition;
          this.jargonPopover.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        if (this.jargonPopover && this.jargonPopover.term === term) {
          this.jargonPopover.definition = 'Failed to fetch definition from AI.';
          this.jargonPopover.loading = false;
          this.cdr.markForCheck();
        }
      }
    });
  }

  // --- Highlight to Explain Selection Methods ---
  checkTextSelection(event: MouseEvent) {
    // If clicking a jargon-word, do not trigger text selection check
    const target = event.target as HTMLElement;
    if (target && target.classList.contains('jargon-word')) {
      return;
    }

    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';

    if (!selectedText || selectedText.length < 3) {
      this.explainSelectionBubble = null;
      this.cdr.markForCheck();
      return;
    }

    const anchorNode = selection?.anchorNode;
    if (!anchorNode || !this.isNodeInModalBody(anchorNode)) {
      this.explainSelectionBubble = null;
      this.cdr.markForCheck();
      return;
    }

    const range = selection?.getRangeAt(0);
    if (range) {
      const rects = range.getClientRects();
      if (rects.length > 0) {
        const lastRect = rects[rects.length - 1];
        this.explainSelectionBubble = {
          text: selectedText,
          top: lastRect.top - 8,
          left: lastRect.left + lastRect.width / 2
        };
        this.cdr.markForCheck();
      }
    }
  }

  private isNodeInModalBody(node: Node): boolean {
    let parent: Node | null = node;
    while (parent) {
      if (parent instanceof HTMLElement && parent.classList.contains('modal-body')) {
        return true;
      }
      parent = parent.parentNode;
    }
    return false;
  }

  triggerExplainSelection(event: MouseEvent) {
    event.stopPropagation();
    if (!this.explainSelectionBubble) return;

    const bubble = this.explainSelectionBubble;
    this.explainSelectionBubble = null;

    this.explainSelectionResult = {
      text: bubble.text,
      explanation: '',
      loading: true,
      top: bubble.top,
      left: bubble.left
    };
    this.cdr.markForCheck();

    this.legalService.askLegalQuestion(`Explain this legal provision or phrase: "${bubble.text}". Keep the explanation simple, in plain language, 1-2 short sentences.`).subscribe({
      next: (res) => {
        if (this.explainSelectionResult && this.explainSelectionResult.text === bubble.text) {
          this.explainSelectionResult.explanation = res && res.answer ? res.answer : 'No explanation available.';
          this.explainSelectionResult.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        if (this.explainSelectionResult && this.explainSelectionResult.text === bubble.text) {
          this.explainSelectionResult.explanation = 'Failed to explain selection from AI.';
          this.explainSelectionResult.loading = false;
          this.cdr.markForCheck();
        }
      }
    });
  }

  closeSelectionResult() {
    this.explainSelectionResult = null;
    this.cdr.markForCheck();
  }

  // --- AI Q&A Chat Panel Methods ---
  submitChat() {
    if (this.chatLoading || !this.chatInput.trim()) return;
    const question = this.chatInput.trim();
    this.chatMessages.push({ sender: 'user', text: question });
    this.chatInput = '';
    this.chatLoading = true;
    this.cdr.markForCheck();

    this.legalService.chatAboutSection(this.readerSection.shortName, this.readerSection.section_number, question).subscribe({
      next: (res) => {
        this.chatMessages.push({ sender: 'ai', text: res && res.answer ? res.answer : 'No answer generated.' });
        this.chatLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error(err);
        this.chatMessages.push({ sender: 'ai', text: 'Error: Failed to connect to AI Assistant. Please check if backend is running.' });
        this.chatLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  // --- Text-To-Speech Controls ---
  toggleTextToSpeech(text: string) {
    if (this.isPlayingSpeech) {
      this.stopTextToSpeech();
      return;
    }

    const synth = window.speechSynthesis;
    if (!synth) {
      this.snackbar.show('Audio speech synthesis is not supported on this browser.', 'error');
      return;
    }

    // Optimize: Set state to playing instantly so visual icons update without waiting for API delay
    this.isPlayingSpeech = true;
    this.isPausedSpeech = false;
    this.cdr.markForCheck();

    // Strip HTML tags for clean text synthesis
    const cleanText = text.replace(/<[^>]*>/g, '');

    this.currentSpeechUtterance = new SpeechSynthesisUtterance(cleanText);

    // Dynamic voice selector
    const voices = synth.getVoices();
    if (this.readerLanguage === 'HI') {
      const hiVoice = voices.find(v => v.lang.includes('hi') || v.name.toLowerCase().includes('hindi'));
      if (hiVoice) this.currentSpeechUtterance.voice = hiVoice;
      this.currentSpeechUtterance.lang = 'hi-IN';
    } else {
      const enVoice = voices.find(v => v.lang.includes('en') || v.name.toLowerCase().includes('english'));
      if (enVoice) this.currentSpeechUtterance.voice = enVoice;
      this.currentSpeechUtterance.lang = 'en-IN';
    }

    // Use Angular NgZone.run to execute browser audio threads within Angular digest loops
    this.currentSpeechUtterance.onstart = () => {
      this.zone.run(() => {
        this.isPlayingSpeech = true;
        this.isPausedSpeech = false;
        this.cdr.markForCheck();
      });
    };

    this.currentSpeechUtterance.onend = () => {
      this.zone.run(() => {
        this.isPlayingSpeech = false;
        this.isPausedSpeech = false;
        this.cdr.markForCheck();
      });
    };

    this.currentSpeechUtterance.onerror = () => {
      this.zone.run(() => {
        this.isPlayingSpeech = false;
        this.isPausedSpeech = false;
        this.cdr.markForCheck();
      });
    };

    synth.speak(this.currentSpeechUtterance);
  }

  pauseTextToSpeech() {
    const synth = window.speechSynthesis;
    if (synth && this.isPlayingSpeech) {
      if (this.isPausedSpeech) {
        synth.resume();
        this.isPausedSpeech = false;
      } else {
        synth.pause();
        this.isPausedSpeech = true;
      }
      this.cdr.markForCheck();
    }
  }

  stopTextToSpeech() {
    const synth = window.speechSynthesis;
    if (synth) {
      synth.cancel();
    }
    this.isPlayingSpeech = false;
    this.isPausedSpeech = false;
    this.cdr.markForCheck();
  }

  getActHue(actShortName: string): number {
    if (!actShortName) return 215;
    let hash = 0;
    for (let i = 0; i < actShortName.length; i++) {
      hash = actShortName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  }
}