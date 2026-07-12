import { Component, Input, Output, EventEmitter, inject, ChangeDetectionStrategy, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LegalService } from '../../../../services/legal.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-law-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, RouterLink],
  templateUrl: './law-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LawResultCardComponent implements OnDestroy {
  private legalService = inject(LegalService);
  private snackbar = inject(SnackbarService);
  private cdr = inject(ChangeDetectorRef);

  // Cached and computed variables for template binding (Performance Optimization)
  private _result: any;
  cachedPrecedents: Array<{ caseName: string; citation: string; holding: string }> = [];
  cachedTimeline: Array<{ year: string; title: string; desc: string }> = [];
  cachedProSe: { court: string; fee: string; prep: string } = { court: '', fee: '', prep: '' };

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

  // Text-To-Speech state
  isSpeaking = false;

  // Inline Comparison state
  showInlineCompare = false;

  // Copy micro-interaction triggers
  activeCopiedFormat: string | null = null;
  copiedContent = false;

  @Input() saved = false;

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
      this.cachedPrecedents = this.calculatePrecedents(val);
      this.cachedTimeline = this.calculateTimeline(val);
      this.cachedProSe = this.calculateProSeGuide(val);
      
      // Pre-calculate custom reading metrics
      this.readingTimeMins = Math.max(1, Math.ceil((val.snippet || '').replace(/<[^>]*>/g, '').split(/\s+/).length / 130));
      this.complexityRating = this.getComplexity(val);
      this.reformLink = this.getReformLink(val);
      this.suggestedPrompts = this.getSuggestedPrompts(val);
      this.citedWithSections = this.getCitedWith(val);

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
    if (this.chatSub) {
      this.chatSub.unsubscribe();
    }
    this.stopSpeaking();
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
    if (expand && !this.laymanExplanation) {
      this.laymanLoading = true;
      this.cdr.markForCheck();
      this.legalService.getSectionSummary(this.result.shortName, this.result.section_number).subscribe({
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
    if (this.expandedLayman && !this.laymanExplanation) {
      this.laymanLoading = true;
      this.cdr.markForCheck();

      // Dynamically fetch AI simplified summary from backend API
      this.legalService.getSectionSummary(this.result.shortName, this.result.section_number).subscribe({
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

    this.chatHistory.push({ sender: 'user', message: msg });
    this.chatInput = '';
    this.chatLoading = true;
    this.cdr.markForCheck();

    this.chatSub = this.legalService.chatAboutSection(this.result.shortName, this.result.section_number, msg).subscribe({
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
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // cancel any ongoing speech
      const cleanSnippet = this.result.snippet.replace(/<[^>]*>/g, '');
      const textToSpeak = `Section ${this.result.section_number}: ${this.result.title}. ${cleanSnippet}`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      utterance.onend = () => {
        this.isSpeaking = false;
        this.cdr.markForCheck();
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
        this.cdr.markForCheck();
      };
      
      this.isSpeaking = true;
      this.cdr.markForCheck();
      window.speechSynthesis.speak(utterance);
    } else {
      this.snackbar.show('Text-to-Speech is not supported in this browser.', 'error');
    }
  }

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
      this.cdr.markForCheck();
    }
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

  // --- Export to PDF report ---
  exportToPDF() {
    const act = this.result.actName || this.result.shortName;
    const cleanSnippet = this.result.snippet.replace(/<[^>]*>/g, '');
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.snackbar.show('Failed to open print window. Please allow popups.', 'error');
      return;
    }
    
    let precedentsHtml = '';
    this.cachedPrecedents.forEach(p => {
      precedentsHtml += `
        <div style="margin-bottom: 12px; padding: 10px; border: 1px solid #ddd; border-radius: 6px;">
          <strong>${p.caseName}</strong> (${p.citation})<br/>
          <span style="font-size: 13px; color: #555;">Holding: ${p.holding}</span>
        </div>`;
    });

    const proSe = this.cachedProSe;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>LegalConnect Report - Sec ${this.result.section_number}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.5; }
            .header { border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; color: #4f46e5; }
            .meta { font-size: 12px; color: #666; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.5px; }
            .section-box { background: #f7fafc; border: 1px solid #e2e8f0; border-left: 5px solid #3182ce; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
            .section-box.high { border-left-color: #ef4444; }
            .section-box.medium { border-left-color: #f59e0b; }
            .section-box.low { border-left-color: #10b981; }
            .subtitle { font-size: 18px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
            .note { background: #fffaf0; border: 1px solid #feebc8; padding: 10px; border-radius: 6px; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${act}</div>
            <div class="meta">LegalConnect Case Pack Report &bull; Printed on ${new Date().toLocaleDateString()}</div>
          </div>
          
          <div class="section-box ${this.result.criminalDetails?.severity || 'low'}">
            <h2 style="margin: 0 0 10px 0; font-size: 20px;">Section ${this.result.section_number}: ${this.result.title}</h2>
            <p style="margin: 0; font-family: monospace; font-size: 13px; white-space: pre-wrap;">${cleanSnippet}</p>
          </div>
          
          <div class="subtitle">Simplified Layman's Explanation</div>
          <p>${this.laymanExplanation || 'No summary fetched.'}</p>
          
          <div class="subtitle">Precedents & Landmark Judgments</div>
          ${precedentsHtml || '<p>No specific landmark precedents loaded for this section.</p>'}
          
          <div class="subtitle">Pro Se Litigation Guide</div>
          <ul>
            <li><strong>Judicial Forum:</strong> ${proSe.court}</li>
            <li><strong>Court Fees:</strong> ${proSe.fee}</li>
            <li><strong>Pre-requisite notice rules:</strong> ${proSe.prep}</li>
          </ul>
          
          ${this.noteText ? `
            <div class="subtitle">Personal Case Notes</div>
            <div class="note">${this.noteText}</div>
          ` : ''}
          
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    this.snackbar.show('Sent report to print window.', 'success');
  }

  // --- Mock calculations (Run once per result update) ---
  private calculatePrecedents(val: any): Array<{ caseName: string; citation: string; holding: string }> {
    const num = val.section_number;
    const is302 = num === '302' || num === '101';
    const is138 = num === '138';

    if (is302) {
      return [
        { caseName: 'Bachchan Singh v. State of Punjab', citation: 'AIR 1980 SC 898', holding: 'Established the "rarest of rare cases" doctrine for death penalty sentencing.' },
        { caseName: 'Machhi Singh v. State of Punjab', citation: '(1983) 3 SCC 470', holding: 'Outlined standard guidelines for capital sentencing indicators.' }
      ];
    } else if (is138) {
      return [
        { caseName: 'Dalmia Cement Ltd. v. Galaxy Traders', citation: 'AIR 2001 SC 676', holding: 'Held that NI Act provisions must be construed to enforce commercial integrity.' },
        { caseName: 'Kaushalya Devi Massand v. Roopkishore', citation: '(2011) 4 SCC 593', holding: 'Held that compounding is encouraged but criminal fines are compensatory.' }
      ];
    } else {
      return [
        { caseName: 'Hari Prasad v. State of UP', citation: '2021 SC 109', holding: 'Strict interpretation of statutory intent of section clauses.' }
      ];
    }
  }

  private calculateTimeline(val: any): Array<{ year: string; title: string; desc: string }> {
    const num = val.section_number;
    const is302 = num === '302' || num === '101';
    if (is302) {
      return [
        { year: '1860', title: 'Original Enactment', desc: 'Introduced in Macaulay\'s Indian Penal Code.' },
        { year: '1973', title: 'CrPC Amendment', desc: 'Shifted judicial priority away from capital punishment as default sentence.' },
        { year: '2023', title: 'BNS Reform Integration', desc: 'Replaced by BNS Section 101 detailing updated murder classification.' }
      ];
    } else {
      return [
        { year: '1988', title: 'Act Revision', desc: 'Amended criminal penalty liabilities.' },
        { year: '2002', title: 'Fines Doubled', desc: 'Penalty limit increased to twice the cheque amount.' },
        { year: '2018', title: 'Interim Compensation', desc: 'Courts empowered to order 20% interim deposit.' }
      ];
    }
  }

  private calculateProSeGuide(val: any): { court: string; fee: string; prep: string } {
    const is138 = val.section_number === '138';
    return {
      court: val.shortName === 'Rent Control Act' ? 'Rent Tribunal' : (val.shortName === 'IPC' || val.shortName === 'BNS' ? 'Judicial Magistrate Court' : 'Civil Court (Senior Division)'),
      fee: is138 ? '10% of bounced cheque value (max 10,000)' : 'Flat Rs. 200 standard judicial filing stamps',
      prep: is138 ? '30-day statutory legal notice served to drawer; 15 days wait period.' : 'Serve 15-day prior written notice of termination under Section 106.'
    };
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

  getCompareDiff(): { oldText: string; newText: string } {
    const num = this.result.section_number;
    const is302 = num === '302' || num === '101';
    const is378 = num === '378' || num === '379' || num === '303';
    
    if (is302) {
      return {
        oldText: 'Whoever commits murder shall be punished with death, or imprisonment for life, and shall also be liable to fine.',
        newText: 'Whoever commits murder shall be punished with death or imprisonment for life, and shall also be liable to fine. <ins class="text-green-600 bg-green-500/10 font-bold px-1 rounded">Provided that where a group of five or more persons commits murder on the ground of race, caste, sex, place of birth, language, or community, each member shall be punished with death or life imprisonment.</ins>'
      };
    } else if (is378) {
      return {
        oldText: 'Whoever, intending to take dishonestly any moveable property out of the possession of any person without consent, moves that property in order to such taking, is said to commit theft.',
        newText: 'Whoever, intending to take dishonestly any movable property <ins class="text-green-600 bg-green-500/10 font-bold px-1 rounded">including digital assets or data</ins> out of the possession of any person without consent... is said to commit theft.'
      };
    } else {
      return {
        oldText: 'Whoever commits the offense specified under this section shall be liable to standard prosecution, fine, or imprisonment.',
        newText: 'Whoever commits the offense under this section shall be liable to standard prosecution. <ins class="text-green-600 bg-green-500/10 font-bold px-1 rounded">Fines have been increased by 100% and provisions for community service have been introduced as alternative punishment.</ins>'
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
}