import { Component, Input, Output, EventEmitter, inject, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LegalService } from '../../../../services/legal.service';
import { SpeechService } from '../../../../services/speech.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { Subscription, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FormattingService } from '../../../../services/formatting.service';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';

@Component({
  selector: 'app-law-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, RouterLink, ShareMenuComponent],
  templateUrl: './law-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LawResultCardComponent implements OnDestroy {
  private legalService = inject(LegalService);
  public speechService = inject(SpeechService);
  private snackbar = inject(SnackbarService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);
  public formatter = inject(FormattingService);

  private destroy$ = new Subject<void>();

  constructor() {
    this.speechService.activeSentenceIndex$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.markForCheck();
      });

    this.speechService.activeSpeakerId$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.cdr.markForCheck();
      });
  }

  // Cached and computed variables for template binding (Performance Optimization)
  private _result: any;
  cachedPrecedents: Array<{ caseName: string; citation: string; holding: string }> = [];
  cachedTimeline: Array<{ year: string; title: string; desc: string }> = [];
  cachedProSe: { court: string; fee: string; prep: string } = { court: '', fee: '', prep: '' };
  isCompoundable = false;
  mobileToolTitle = '';

  get isSpeaking(): boolean {
    const speakerId = `${this.result?.shortName}_${this.result?.section_number}`;
    return this.speechService.isSpeaking && this.speechService.activeSpeakerId === speakerId;
  }
  compareDiff: { oldText: string; newText: SafeHtml } = { oldText: '', newText: '' };

  readonly mobileTools = [
    {
      id: 'precedent',
      label: 'Judgments',
      class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
      svgPath: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0l-3-9m3 0h9m0 0l-3 1m0 0l-3 9a5.002 5.002 0 006.001 0l-3-9M12 3v18M12 21h4m-8 0h4'
    },
    {
      id: 'timeline',
      label: 'History',
      class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
      svgPath: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      id: 'proSe',
      label: 'Pro Se Guide',
      class: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
      svgPath: 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'
    },
    {
      id: 'layman',
      label: 'Layman Info',
      class: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
      svgPath: 'M12 18.044l.008-.008.007-.007v-.004m-6.364.364l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
    },
    {
      id: 'citation',
      label: 'Citations',
      class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
      svgPath: 'M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3'
    },
    {
      id: 'notes',
      label: 'Notes',
      class: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20',
      svgPath: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
    }
  ] as const;

  trackByMobileTool(_index: number, item: typeof this.mobileTools[number]) {
    return item.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByString(_index: number, item: string): string {
    return item;
  }

  trackByPrecedent(_index: number, item: any): string {
    return item.citation;
  }

  trackByTimelineItem(_index: number, item: any): string {
    return item.title;
  }

  readingTimeMins = 1;
  complexityRating = 'Simple';
  reformLink: { label: 'replaces' | 'replaced by'; section: string; shortName: string } | null = null;

  // Dynamic Layman Q&A fetching
  laymanExplanation = '';
  laymanLoading = false;

  // Dynamic related elements
  suggestedPrompts: string[] = [];
  citedWithSections: string[] = [];

  // Local sticky notes state
  noteText = '';
  showNotesEditor = false;

  // Inline Comparison state
  showInlineCompare = false;

  isExpandedContent = false;

  toggleContentExpansion() {
    this.isExpandedContent = !this.isExpandedContent;
    this.cdr.markForCheck();
  }

  // Copy micro-interaction triggers
  activeCopiedFormat: string | null = null;
  copiedContent = false;

  @Input() saved = false;
  @Input() loading = false;

  @Output() compare = new EventEmitter<any>();
  @Output() openReader = new EventEmitter<any>();
  @Output() toggleSave = new EventEmitter<any>();
  @Output() citedQuery = new EventEmitter<string>();

  // Accordion drawer states
  expandedPrecedents = false;
  expandedTimeline = false;
  expandedProSe = false;
  expandedCitation = false;
  expandedLayman = false;

  // Mobile Tool Deck states
  activeMobileTool: 'precedent' | 'timeline' | 'proSe' | 'layman' | 'citation' | 'notes' | null = null;
  showMobileToolSheet = false;

  openMobileTool(tool: 'precedent' | 'timeline' | 'proSe' | 'layman' | 'citation' | 'notes') {
    this.activeMobileTool = tool;
    this.mobileToolTitle = this.getMobileToolTitleText(tool);
    this.showMobileToolSheet = true;

    // Proactively trigger layman loading if chosen
    if (tool === 'layman') {
      this.fetchLaymanExplanation();
    }

    document.body.style.overflow = 'hidden';
    this.cdr.markForCheck();
  }

  closeMobileTool() {
    this.showMobileToolSheet = false;
    this.activeMobileTool = null;
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  private getMobileToolTitleText(tool: string): string {
    switch (tool) {
      case 'precedent': return 'Landmark Court Judgments';
      case 'timeline': return 'Statutory Amendment History';
      case 'proSe': return 'Pro Se Litigation Guide';
      case 'layman': return 'Simplified Explanation';
      case 'citation': return 'Professional Citation Exporter';
      case 'notes': return 'Private Observations Pad';
      default: return '';
    }
  }

  // Inline AI Chat Q&A state
  showChat = false;
  chatLoading = false;
  chatHistory: Array<{ sender: 'user' | 'ai'; message: string }> = [];
  chatInput = '';
  private chatSub: Subscription | null = null;

  @Input() set result(val: any) {
    this._result = val;
    if (val) {
      // Pre-compute lists exactly once to prevent change detection CPU bottlenecks
      this.cachedPrecedents = this.legalService.getMockPrecedents(val);
      this.cachedTimeline = this.legalService.getMockTimeline(val);
      this.cachedProSe = this.legalService.getMockProSeGuide(val);

      // Pre-calculate custom reading metrics
      this.readingTimeMins = Math.max(1, Math.ceil((val.snippet || '').replace(/<[^>]*>/g, '').split(/\s+/).length / 130));
      this.complexityRating = this.getComplexity(val);
      this.reformLink = this.getReformLink(val);
      this.suggestedPrompts = this.getSuggestedPrompts(val);
      this.citedWithSections = this.getCitedWith(val);
      this.isCompoundable = val.criminalDetails?.compoundable?.toLowerCase() === 'compoundable';

      const rawCompare = this.legalService.getMockCompareDiff(val);
      this.compareDiff = {
        oldText: rawCompare.oldText,
        newText: this.sanitizer.bypassSecurityTrustHtml(rawCompare.newText)
      };

      // Reset explanation when result changes to reload dynamically
      this.laymanExplanation = '';
      this.expandedLayman = false;

      // Load private sticky note
      this.loadNote();
    }
  }

  get result() {
    return this._result;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.chatSub) {
      this.chatSub.unsubscribe();
    }
    if (this.isSpeaking) {
      this.stopSpeaking();
    }
  }

  togglePrecedent() {
    this.expandedPrecedents = !this.expandedPrecedents;
  }

  areAllDrawersExpanded(): boolean {
    return this.expandedPrecedents &&
      this.expandedTimeline &&
      this.expandedProSe &&
      this.expandedLayman &&
      this.expandedCitation &&
      this.showNotesEditor;
  }

  toggleAllDrawers() {
    const expand = !this.areAllDrawersExpanded();
    this.expandedPrecedents = expand;
    this.expandedTimeline = expand;
    this.expandedProSe = expand;
    this.expandedCitation = expand;
    this.showNotesEditor = expand;

    // For layman explanation, fetch dynamically if expanding
    this.expandedLayman = expand;
    if (expand) {
      this.fetchLaymanExplanation();
    }

    this.cdr.markForCheck();
  }

  toggleTimeline() {
    this.expandedTimeline = !this.expandedTimeline;
  }

  toggleProSe() {
    this.expandedProSe = !this.expandedProSe;
  }

  toggleCitation() {
    this.expandedCitation = !this.expandedCitation;
  }

  toggleLayman() {
    this.expandedLayman = !this.expandedLayman;
    if (this.expandedLayman) {
      this.fetchLaymanExplanation();
    }
  }

  private fetchLaymanExplanation(): void {
    if (this.laymanExplanation || this.laymanLoading) return;

    this.laymanLoading = true;
    this.cdr.markForCheck();

    this.legalService.getSectionSummary(this.result.shortName, this.result.section_number)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res && res.success && res.data) {
            this.laymanExplanation = res.data.summary;
          } else {
            this.laymanExplanation = 'Failed to generate simplified explanation. Standard legal content applies.';
          }
          this.laymanLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.laymanExplanation = 'Error fetching layman explanation. Make sure the backend server is running.';
          this.laymanLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  toggleInlineCompare() {
    this.showInlineCompare = !this.showInlineCompare;
  }

  // --- Inline Q&A Chat ---
  toggleInlineChat() {
    this.showChat = !this.showChat;
    if (this.showChat && this.chatHistory.length === 0) {
      this.chatHistory.push({
        sender: 'ai',
        message: 'Hello! I am your AI assistant for this section. Ask me any clarification about this law.'
      });
    }
  }

  sendSectionMessage(suggestedText?: string) {
    const msg = suggestedText ? suggestedText.trim() : this.chatInput.trim();
    if (!msg) return;

    if (this.chatSub) {
      this.chatSub.unsubscribe();
    }

    this.chatHistory.push({ sender: 'user', message: msg });
    this.chatInput = '';
    this.chatLoading = true;
    this.cdr.markForCheck();

    this.chatSub = this.legalService.chatAboutSection(this.result.shortName, this.result.section_number, msg)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.chatHistory.push({ sender: 'ai', message: res.answer });
          this.chatLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.chatHistory.push({
            sender: 'ai',
            message: 'Sorry, I failed to evaluate your query. Make sure the backend server is running.'
          });
          this.chatLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  // --- Copy citation helper ---
  copyCitation(format: 'bluebook' | 'ili' | 'standard') {
    let citationText = '';
    const act = this.result.actName || this.result.shortName;
    const num = this.result.section_number;
    const year = this.result.year || '1860';

    if (format === 'bluebook') {
      citationText = `§ ${num}, ${act} (${year}).`;
    } else if (format === 'ili') {
      citationText = `${act}, s. ${num} (${year}).`;
    } else {
      citationText = `Section ${num}, ${act}, ${year}.`;
    }

    navigator.clipboard.writeText(citationText);
    this.activeCopiedFormat = format;
    this.snackbar.show(`Copied ${format.toUpperCase()} citation: "${citationText}"`, 'success');

    setTimeout(() => {
      this.activeCopiedFormat = null;
      this.cdr.markForCheck();
    }, 2000);
  }

  // --- Copy content helper ---
  copyContent() {
    const act = this.result.actName || this.result.shortName;
    const cleanSnippet = this.result.snippet.replace(/<[^>]*>/g, '');
    const textToCopy = `Section ${this.result.section_number}: ${this.result.title} [${act}]\n\n${cleanSnippet}`;

    navigator.clipboard.writeText(textToCopy);
    this.copiedContent = true;
    this.snackbar.show('Copied section content to clipboard.', 'success');

    setTimeout(() => {
      this.copiedContent = false;
      this.cdr.markForCheck();
    }, 2000);
  }

  // --- Text-to-Speech audio reader ---
  speakSectionText() {
    const cleanSnippet = this.result.snippet.replace(/<[^>]*>/g, '');
    const textToSpeak = `Section ${this.result.section_number}: ${this.result.title}. ${cleanSnippet}`;
    const speakerId = `${this.result.shortName}_${this.result.section_number}`;

    this.speechService.speak(textToSpeak, false, speakerId);
    this.cdr.markForCheck();
  }

  stopSpeaking() {
    this.speechService.stop();
    this.cdr.markForCheck();
  }

  // --- Sticky notes storage ---
  loadNote() {
    const key = `lc_note_${this.result.shortName}_${this.result.section_number}`;
    this.noteText = localStorage.getItem(key) || '';
  }

  saveNote(text: string) {
    this.noteText = text;
    const key = `lc_note_${this.result.shortName}_${this.result.section_number}`;
    if (text.trim()) {
      localStorage.setItem(key, text);
      this.snackbar.show('Sticky Note Saved.', 'success');
    } else {
      localStorage.removeItem(key);
      this.snackbar.show('Sticky Note Removed.', 'success');
    }
    this.showNotesEditor = false;
  }

  // --- Export to PDF report (Isolated print engine) ---
  exportToPDF() {
    this.snackbar.show('Preparing client report dossier...', 'success');

    // Create a hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      this.snackbar.show('Failed to initialize print engine.', 'error');
      document.body.removeChild(iframe);
      return;
    }

    const act = this.result.actName || this.result.shortName;
    const cleanSnippet = (this.result.snippet || '').replace(/<[^>]*>/g, '');

    let precedentsHtml = '';
    if (this.cachedPrecedents && this.cachedPrecedents.length > 0) {
      this.cachedPrecedents.forEach(p => {
        precedentsHtml += `
          <div style="margin-bottom: 12px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc;">
            <div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 13px; color: #1e293b; margin-bottom: 4px;">
              <span>${p.caseName}</span>
              <span style="font-family: monospace; color: #64748b;">${p.citation}</span>
            </div>
            <p style="font-size: 12px; color: #475569; margin: 0;"><strong>Holding:</strong> ${p.holding}</p>
          </div>`;
      });
    }

    const proSe = this.cachedProSe;

    const content = `
      <html>
        <head>
          <title>LegalConnect Case Pack - Section ${this.result.section_number}</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
              padding: 40px; 
              color: #1e293b; 
              line-height: 1.6; 
              background: #ffffff;
            }
            .header { 
              border-bottom: 2px solid #4f46e5; 
              padding-bottom: 14px; 
              margin-bottom: 24px; 
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title-box h1 { font-size: 22px; font-weight: bold; color: #1e3a8a; margin: 0; }
            .title-box p { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin: 4px 0 0 0; }
            .date-box { font-size: 11px; color: #64748b; font-family: monospace; }
            
            .section-box { 
              background: #f8fafc; 
              border: 1px solid #e2e8f0; 
              border-left: 6px solid #4f46e5; 
              padding: 18px; 
              border-radius: 8px; 
              margin-bottom: 22px; 
            }
            .section-box.high { border-left-color: #ef4444; }
            .section-box.medium { border-left-color: #f59e0b; }
            .section-box.low { border-left-color: #10b981; }
            
            .section-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 10px 0; }
            .section-text { font-family: monospace; font-size: 12.5px; color: #334155; white-space: pre-wrap; margin: 0; }
            
            .subtitle { 
              font-size: 13px; 
              font-weight: 700; 
              text-transform: uppercase; 
              letter-spacing: 0.5px; 
              margin-top: 26px; 
              margin-bottom: 10px; 
              color: #475569; 
              border-bottom: 1px solid #e2e8f0; 
              padding-bottom: 5px; 
            }
            .layman-text { font-size: 13px; color: #334155; margin: 0; }
            
            .guide-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            .guide-table td { padding: 9px; border-bottom: 1px solid #f1f5f9; font-size: 12.5px; }
            .guide-label { font-weight: 600; color: #475569; width: 30%; }
            .guide-value { color: #334155; }
            
            .footer { 
              margin-top: 40px; 
              border-top: 1px solid #e2e8f0; 
              padding-top: 14px; 
              text-align: center; 
              font-size: 10px; 
              color: #94a3b8; 
            }
            @media print {
              body { padding: 10px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-box">
              <h1>${act}</h1>
              <p>LegalConnect Case Pack Report</p>
            </div>
            <div class="date-box">Printed: ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div class="section-box ${this.result.criminalDetails?.severity || 'low'}">
            <h2 class="section-title">Section ${this.result.section_number}: ${this.result.title}</h2>
            <p class="section-text">${cleanSnippet}</p>
          </div>
          
          ${this.laymanExplanation ? `
            <div class="subtitle">Simplified Layman's Explanation</div>
            <p class="layman-text">${this.laymanExplanation}</p>
          ` : ''}
          
          ${precedentsHtml ? `
            <div class="subtitle">Precedents & Landmark Judgments</div>
            ${precedentsHtml}
          ` : ''}
          
          <div class="subtitle">Pro Se Litigation Guide</div>
          <table class="guide-table">
            <tr>
              <td class="guide-label">Judicial Forum</td>
              <td class="guide-value">${proSe.court}</td>
            </tr>
            <tr>
              <td class="guide-label">Court Fees</td>
              <td class="guide-value">${proSe.fee}</td>
            </tr>
            <tr>
              <td class="guide-label">Pre-requisite Rules</td>
              <td class="guide-value">${proSe.prep}</td>
            </tr>
          </table>
          
          ${this.noteText ? `
            <div class="subtitle">Personal Case Notes</div>
            <div style="background: #fffdf5; border: 1px solid #fef08a; padding: 12px; border-radius: 8px; font-style: italic; font-size: 13px; color: #713f12; margin: 0;">
              ${this.noteText}
            </div>
          ` : ''}
          
          <div class="footer">
            Generated automatically by LegalConnect AI Platform. Private Client Dossier. Confidential.
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(content);
    doc.close();

    // Give iframe short delay to mount, then execute print dialog in isolated context
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Remove temporary iframe after printing dialog is closed/canceled
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  }

  private getComplexity(val: any): string {
    if (val.criminalDetails) {
      const sev = val.criminalDetails.severity;
      return sev === 'high' ? 'High' : (sev === 'medium' ? 'Medium' : 'Low');
    }
    return 'Low';
  }

  private getReformLink(val: any): { label: 'replaces' | 'replaced by'; section: string; shortName: string } | null {
    const short = val.shortName ? val.shortName.toUpperCase() : '';
    const num = val.section_number;

    if (short === 'IPC' && num === '302') {
      return { label: 'replaced by', section: '101', shortName: 'BNS' };
    }
    if (short === 'BNS' && num === '101') {
      return { label: 'replaces', section: '302', shortName: 'IPC' };
    }
    if (short === 'IPC' && (num === '378' || num === '379')) {
      return { label: 'replaced by', section: '303', shortName: 'BNS' };
    }
    if (short === 'BNS' && num === '303') {
      return { label: 'replaces', section: '378', shortName: 'IPC' };
    }
    return null;
  }

  private getSuggestedPrompts(val: any): string[] {
    const num = val.section_number;
    if (num === '302' || num === '101') {
      return ['Is this bailable?', 'What is the maximum jail sentence?', 'Is this compounding?'];
    } else if (num === '138') {
      return ['What notice must I send?', 'Can I settle this?', 'How long does a case take?'];
    } else {
      return [`Explain ${val.shortName} Section ${num} simply`, 'What is the penalty limit?', 'Which court hears this?'];
    }
  }

  private getCitedWith(val: any): string[] {
    const num = val.section_number;
    const is302 = num === '302' || num === '101';
    const is378 = num === '378' || num === '379' || num === '303';
    const is138 = num === '138';

    if (is302) {
      return ['120B', '34', '149'];
    } else if (is378) {
      return ['379', '411', '34'];
    } else if (is138) {
      return ['141', '142'];
    } else {
      const parsed = parseInt(num, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return [(parsed + 1).toString(), (parsed + 2).toString()];
      }
      return [];
    }
  }

  private calculateCompareDiff(val: any): { oldText: string; newText: SafeHtml } {
    const num = val.section_number;
    const is302 = num === '302' || num === '101';
    const is378 = num === '378' || num === '379' || num === '303';

    if (is302) {
      return {
        oldText: 'Whoever commits murder shall be punished with death, or imprisonment for life, and shall also be liable to fine.',
        newText: this.sanitizer.bypassSecurityTrustHtml('Whoever commits murder shall be punished with death or imprisonment for life, and shall also be liable to fine. <ins class="text-green-600 bg-green-500/10 font-bold px-1 rounded">Provided that where a group of five or more persons commits murder on the ground of race, caste, sex, place of birth, language, or community, each member shall be punished with death or life imprisonment.</ins>')
      };
    } else if (is378) {
      return {
        oldText: 'Whoever, intending to take dishonestly any moveable property out of the possession of any person without consent, moves that property in order to such taking, is said to commit theft.',
        newText: this.sanitizer.bypassSecurityTrustHtml('Whoever, intending to take dishonestly any movable property <ins class="text-green-600 bg-green-500/10 font-bold px-1 rounded">including digital assets or data</ins> out of the possession of any person without consent... is said to commit theft.')
      };
    } else {
      return {
        oldText: 'Whoever commits the offense specified under this section shall be liable to standard prosecution, fine, or imprisonment.',
        newText: this.sanitizer.bypassSecurityTrustHtml('Whoever commits the offense under this section shall be liable to standard prosecution. <ins class="text-green-600 bg-green-500/10 font-bold px-1 rounded">Fines have been increased by 100% and provisions for community service have been introduced as alternative punishment.</ins>')
      };
    }
  }

  onCompare() {
    this.compare.emit(this.result);
  }

  onOpenReader() {
    this.openReader.emit(this.result);
  }

  onToggleSave() {
    this.toggleSave.emit(this.result);
  }

  onCitedQueryClick(customSection?: string) {
    const targetSection = customSection || (this.result.section_number === '378' ? '379' : (this.result.section_number === '302' ? '120B' : '411'));
    this.citedQuery.emit(`${this.result.shortName} Section ${targetSection}`);
  }

  findExpertsForAct() {
    this.citedQuery.emit(`expert:${this.result.shortName}`);
  }

  getShareUrl(): string {
    if (typeof window !== 'undefined' && this.result) {
      return `${window.location.origin}/laws/${this.result.shortName}#sec-${this.result.section_number}`;
    }
    return '';
  }

  getShareSubject(): string {
    if (!this.result) return 'LegalConnect';
    return `${this.result.shortName} — Sec. ${this.result.section_number}`;
  }

  getShareText(): string {
    if (!this.result) return '';
    const cleanTitle = (this.result.rawTitle || this.result.title || '').replace(/<[^>]*>/g, '');
    return `Read Section ${this.result.section_number} of ${this.result.shortName}: ${cleanTitle}`;
  }
}