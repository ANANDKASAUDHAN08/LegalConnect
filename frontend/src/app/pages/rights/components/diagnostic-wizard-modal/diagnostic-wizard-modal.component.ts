import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { RightsService, DiagnosticCrisis, DiagnosticEvaluation } from '../../../../services/rights.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { PrintService, KpiCard } from '../../../../services/print.service';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';

export interface DomainCategoryFilter {
  id: string;
  label: string;
  label_hi: string;
}

@Component({
  selector: 'app-diagnostic-wizard-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TooltipDirective, ShareMenuComponent],
  templateUrl: './diagnostic-wizard-modal.component.html',
  styleUrls: ['./diagnostic-wizard-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DiagnosticWizardModalComponent implements OnInit, OnDestroy {
  protected rightsService = inject(RightsService);
  private snackbar = inject(SnackbarService);
  private printService = inject(PrintService);

  @Input() initialCrisisId?: string;
  @Output() closed = new EventEmitter<void>();
  @Output() openTemplate = new EventEmitter<string>();

  // Diagnostic State Signals
  diagnosticStep = signal<number>(1);
  selectedCrisisId = signal<string>('police');
  diagnosticAnswers = signal<Record<string, boolean>>({});
  diagnosticResult = signal<DiagnosticEvaluation | null>(null);
  isEvaluating = signal<boolean>(false);
  isSpeaking = signal<boolean>(false);
  isScriptCopied = signal<boolean>(false);

  // Search & Filter State with Debounce
  searchQuery = signal<string>('');
  debouncedSearchQuery = signal<string>('');
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  selectedDomainFilter = signal<string>('all');

  // Adaptive Thresholds: Mobile >10, Desktop >15
  readonly mobileSearchThreshold = 10;
  readonly desktopSearchThreshold = 15;

  shouldShowSearchMobile = computed(() => this.diagnosticCrises.length > this.mobileSearchThreshold);
  shouldShowSearchDesktop = computed(() => this.diagnosticCrises.length > this.desktopSearchThreshold);
  shouldRenderSearch = computed(() => this.diagnosticCrises.length > this.mobileSearchThreshold);

  readonly domainFilters: DomainCategoryFilter[] = [
    { id: 'all', label: 'All Crises', label_hi: 'सभी संकट' },
    { id: 'police', label: 'Police & Traffic', label_hi: 'पुलिस व ट्रैफिक' },
    { id: 'tenancy', label: 'Housing & Tenancy', label_hi: 'मकान व किराया' },
    { id: 'finance', label: 'Cyber & Cheque', label_hi: 'साइबर व चेक' },
    { id: 'consumer', label: 'Consumer & POSH', label_hi: 'उपभोक्ता व महिला' }
  ];

  get diagnosticCrises(): DiagnosticCrisis[] {
    return this.rightsService.diagnosticCrises();
  }

  get currentLanguage(): 'en' | 'hi' {
    return this.rightsService.currentLanguage();
  }

  // Filtered Crises based on debounced search and category
  filteredCrises = computed(() => {
    let list = this.diagnosticCrises;

    // If below threshold, no search filter applied
    if (!this.shouldRenderSearch()) {
      return list;
    }

    const query = this.debouncedSearchQuery().toLowerCase().trim();
    const filter = this.selectedDomainFilter();

    if (filter !== 'all') {
      if (filter === 'police') {
        list = list.filter(c => c.id === 'police' || c.id === 'traffic');
      } else if (filter === 'tenancy') {
        list = list.filter(c => c.id === 'landlord');
      } else if (filter === 'finance') {
        list = list.filter(c => c.id === 'banking' || c.id === 'cheque');
      } else if (filter === 'consumer') {
        list = list.filter(c => c.id === 'consumer' || c.id === 'workplace' || c.id === 'hospital');
      }
    }

    if (query) {
      list = list.filter(c =>
        c.title.toLowerCase().includes(query) ||
        (c.title_hi && c.title_hi.toLowerCase().includes(query)) ||
        c.summary.toLowerCase().includes(query) ||
        (c.summary_hi && c.summary_hi.toLowerCase().includes(query))
      );
    }

    return list;
  });

  // Current selected crisis
  selectedCrisis = computed(() => {
    const id = this.selectedCrisisId();
    return this.diagnosticCrises.find(c => c.id === id || (c as any).crisisId === id) || this.diagnosticCrises[0];
  });

  // Checklist counts
  totalQuestionsCount = computed(() => {
    const crisis = this.selectedCrisis();
    return crisis?.questions?.length || 0;
  });

  answeredCount = computed(() => {
    const answers = this.diagnosticAnswers();
    return Object.keys(answers).length;
  });

  isStep2Complete = computed(() => {
    const total = this.totalQuestionsCount();
    return total > 0 && this.answeredCount() >= total;
  });

  ngOnInit(): void {
    // Wire up RxJS debounce for search input
    this.searchSub = this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(query => {
      this.debouncedSearchQuery.set(query);
    });

    const crises = this.diagnosticCrises;
    if (this.initialCrisisId && crises.some(c => c.id === this.initialCrisisId || (c as any).crisisId === this.initialCrisisId)) {
      this.selectedCrisisId.set(this.initialCrisisId);
    } else if (crises.length > 0) {
      const defaultId = crises[0].id || (crises[0] as any).crisisId || 'police';
      this.selectedCrisisId.set(defaultId);
    }
  }

  ngOnDestroy(): void {
    this.stopSpeaking();
    this.searchSub?.unsubscribe();
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value || '';
    this.searchQuery.set(value);
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.debouncedSearchQuery.set('');
    this.searchSubject.next('');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.stopSpeaking();
    this.closed.emit();
  }

  jumpToStep(step: number): void {
    if (step === 1) {
      this.stopSpeaking();
      this.diagnosticStep.set(1);
    } else if (step === 2 && (this.diagnosticStep() === 3 || this.answeredCount() > 0)) {
      this.stopSpeaking();
      this.diagnosticStep.set(2);
    }
  }

  selectCrisis(crisis: DiagnosticCrisis): void {
    const id = crisis.id || (crisis as any).crisisId || 'police';
    this.selectedCrisisId.set(id);
    this.diagnosticAnswers.set({});
    this.diagnosticResult.set(null);
    this.diagnosticStep.set(2);
  }

  getSelectedCrisis(): DiagnosticCrisis | undefined {
    return this.selectedCrisis();
  }

  answerQuestion(questionId: string, answer: boolean): void {
    const current = { ...this.diagnosticAnswers() };
    current[questionId] = answer;
    this.diagnosticAnswers.set(current);

    const crisis = this.selectedCrisis();
    if (!crisis) return;

    const answered = Object.keys(current).length;
    const total = crisis.questions?.length || 0;

    // Smooth auto-evaluate when user completes all answers
    if (answered >= total && total > 0) {
      setTimeout(() => {
        this.evaluateDiagnostic();
      }, 250);
    }
  }

  evaluateDiagnostic(): void {
    const crisis = this.selectedCrisis();
    if (!crisis) return;

    const crisisId = crisis.id || (crisis as any).crisisId || this.selectedCrisisId();
    const answers = this.diagnosticAnswers();
    this.isEvaluating.set(true);

    this.rightsService.evaluateDiagnostic(crisisId, answers).subscribe({
      next: evaluation => {
        this.isEvaluating.set(false);
        if (evaluation) {
          this.diagnosticResult.set(evaluation);
          this.diagnosticStep.set(3);
        }
      },
      error: () => {
        this.isEvaluating.set(false);
        this.snackbar.show('Unable to process statutory diagnosis. Please try again.', 'warning');
      }
    });
  }

  resetDiagnostic(): void {
    this.diagnosticAnswers.set({});
    this.diagnosticResult.set(null);
    this.diagnosticStep.set(1);
    this.stopSpeaking();
  }

  // --- AUDIO VERBAL REHEARSAL ---
  speakDiagnosticScript(): void {
    const result = this.diagnosticResult();
    if (!result) return;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.snackbar.show('Speech synthesis is not supported on this device.', 'warning');
      return;
    }

    if (this.isSpeaking()) {
      this.stopSpeaking();
      return;
    }

    const isHi = this.currentLanguage === 'hi';
    const script = isHi && result.whatToSay_hi ? result.whatToSay_hi : result.whatToSay;
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = isHi ? 0.9 : 0.95;
    utterance.lang = isHi ? 'hi-IN' : 'en-IN';

    const voices = window.speechSynthesis.getVoices();
    let preferredVoice = null;
    if (isHi) {
      preferredVoice = voices.find(v => v.lang.includes('hi') || v.lang.includes('Hindi'));
    }
    if (!preferredVoice) {
      preferredVoice = voices.find(v => v.lang.includes('en-IN')) || voices.find(v => v.lang.startsWith('en'));
    }
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking.set(true);
    };

    utterance.onend = () => {
      this.isSpeaking.set(false);
    };

    utterance.onerror = () => {
      this.isSpeaking.set(false);
    };

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking.set(false);
    }
  }

  // --- COPY VERBAL SCRIPT TO CLIPBOARD ---
  copyVerbalScript(): void {
    const res = this.diagnosticResult();
    if (!res) return;

    const isHi = this.currentLanguage === 'hi';
    const script = isHi && res.whatToSay_hi ? res.whatToSay_hi : res.whatToSay;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(script).then(() => {
        this.isScriptCopied.set(true);
        this.snackbar.show('Verbal script copied to clipboard!', 'success', 2500);
        setTimeout(() => this.isScriptCopied.set(false), 2500);
      }).catch(() => {
        this.snackbar.show('Unable to copy script to clipboard.', 'warning');
      });
    }
  }

  // --- CUSTOM SHARE MENU INTEGRATION ---
  getShareSubject(): string {
    const res = this.diagnosticResult();
    if (!res) return 'LegalConnect Statutory Crisis Diagnostic';
    const isHi = this.currentLanguage === 'hi';
    const title = isHi && res.verdictTitle_hi ? res.verdictTitle_hi : res.verdictTitle;
    return `LegalConnect Statutory Crisis Diagnostic: ${title}`;
  }

  getShareText(): string {
    const res = this.diagnosticResult();
    if (!res) return '';

    const isHi = this.currentLanguage === 'hi';
    const title = isHi && res.verdictTitle_hi ? res.verdictTitle_hi : res.verdictTitle;
    const script = isHi && res.whatToSay_hi ? res.whatToSay_hi : res.whatToSay;
    const status = res.status === 'VIOLATION_CONFIRMED'
      ? '[OFFICIAL] STATUTORY BREACH CONFIRMED'
      : '[VERIFIED] PROCEDURAL STANDARDS CHECK';

    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://legalconnect.in';

    return `*LEGALCONNECT STATUTORY CRISIS DIAGNOSIS*\n${status}\n\n*Verdict:* ${title}\n*Grounds:* ${res.statutoryBasis}\n*Helpline:* ${res.helplineName} (${res.helpline})\n\n*What to Say (Authoritative Script):*\n"${script}"\n\nVerified via LegalConnect Statutory Diagnostic Engine\n${origin}/rights?crisis=${this.selectedCrisisId()}`;
  }

  getShareUrl(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/rights?crisis=${this.selectedCrisisId()}`;
    }
    return 'https://legalconnect.in/rights';
  }

  getVerbatimScript(): string {
    const res = this.diagnosticResult();
    if (!res) return '';
    return this.currentLanguage === 'hi' && res.whatToSay_hi ? res.whatToSay_hi : res.whatToSay;
  }

  // --- 1-TAP WHATSAPP DISPATCH TO ADVOCATE / FAMILY ---
  shareViaWhatsApp(): void {
    const res = this.diagnosticResult();
    if (!res) return;

    const isHi = this.currentLanguage === 'hi';
    const title = isHi && res.verdictTitle_hi ? res.verdictTitle_hi : res.verdictTitle;
    const script = isHi && res.whatToSay_hi ? res.whatToSay_hi : res.whatToSay;
    const status = res.status === 'VIOLATION_CONFIRMED' ? '[OFFICIAL] STATUTORY BREACH CONFIRMED' : '[VERIFIED] PROCEDURAL STANDARDS CHECK';

    const text = `*LEGALCONNECT STATUTORY CRISIS DIAGNOSIS*\n${status}\n\n*Verdict:* ${title}\n*Grounds:* ${res.statutoryBasis}\n*Helpline:* ${res.helplineName} (${res.helpline})\n\n*What to Say (Authoritative Script):*\n"${script}"\n\nVerified via LegalConnect Statutory Diagnostic Engine\n${window.location.origin}/rights`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');
    this.snackbar.show('Opening WhatsApp to dispatch diagnosis...', 'success', 2500);
  }

  // --- PRINT / SAVE POCKET SUMMARY CARD ---
  printPocketSummary(): void {
    const res = this.diagnosticResult();
    if (!res) return;

    this.snackbar.show('Generating official Statutory Diagnostic Brief...', 'info', 2000);

    try {
      const e = this.printService.escapeHtml.bind(this.printService);
      const isHi = this.currentLanguage === 'hi';
      const title = isHi && res.verdictTitle_hi ? res.verdictTitle_hi : res.verdictTitle;
      const subtitle = isHi && res.verdictSubtitle_hi ? res.verdictSubtitle_hi : res.verdictSubtitle;
      const script = isHi && res.whatToSay_hi ? res.whatToSay_hi : res.whatToSay;
      const actionItems = (isHi && res.actionItems_hi && res.actionItems_hi.length > 0)
        ? res.actionItems_hi
        : (res.actionItems || []);

      const checkSvg = this.printService.getSvg('check', { size: 10, color: '#059669', style: 'margin-right:4px;' });

      const subjectStrip = this.printService.buildSubjectStrip({
        name: title,
        subtitle: `${subtitle} · Statutory Triage Classification`,
        badge: res.status === 'VIOLATION_CONFIRMED' ? 'Statutory Violation Confirmed' : 'Procedural Standards Verified'
      });

      const kpis: KpiCard[] = [
        { label: 'Evaluation Status', value: res.status === 'VIOLATION_CONFIRMED' ? 'Violation Detected' : 'Procedural Compliance', sub: 'Algorithmic Legal Rule Match', accent: res.status === 'VIOLATION_CONFIRMED' ? 'red' : 'emerald' },
        { label: 'Statutory Authority', value: res.statutoryBasis || 'Constitution / BNSS', sub: 'Governing National Code', accent: 'blue' },
        { label: 'Confidence Score', value: `${res.confidenceScore}%`, sub: 'Factual Criteria Verified', accent: 'indigo' },
        { label: 'Emergency Redressal', value: res.helpline || '112 / 1930', sub: res.helplineName || 'National Helpline', accent: 'amber' }
      ];
      const kpiGrid = this.printService.buildKpiGrid(kpis);

      const scriptHtml = script ? `
        <div style="background:#eff6ff;border-left:4px solid #2563eb;padding:10px 14px;border-radius:6px;margin:12px 0;">
          <div style="font-weight:800;text-transform:uppercase;font-size:9px;letter-spacing:0.05em;color:#1e40af;margin-bottom:4px;">
            Immediate Authority Confrontation Script (Read Aloud Verbatim):
          </div>
          <p style="font-size:11px;color:#1e3a8a;font-style:italic;line-height:1.6;margin:0;">
            "${e(script)}"
          </p>
        </div>
      ` : '';

      const actionListHtml = actionItems.map((item: string) =>
        `<div style="font-size:10px;color:#334155;margin-bottom:5px;display:flex;align-items:flex-start;">
          ${checkSvg} <span>${e(item)}</span>
        </div>`
      ).join('');

      const helplineHtml = `
        <div style="padding:10px 12px;border:1px solid #bfdbfe;border-radius:6px;background:#f0f9ff;margin-top:12px;">
          <div>
            <strong style="color:#1e40af;font-size:11px;">Official Emergency Redressal Helpline:</strong>
            <span style="font-size:10.5px;color:#1e3a8a;margin-left:6px;">${e(res.helplineName)} (${e(res.helpline)})</span>
          </div>
        </div>
      `;

      const contentHtml = `
        <div style="margin-bottom:16px;">
          ${subjectStrip}
          ${kpiGrid}
          ${this.printService.buildSection('Authoritative Confrontation Directive', `
            <div style="font-size:11px;color:#1e293b;line-height:1.6;margin-bottom:8px;">${e(subtitle)}</div>
            ${scriptHtml}
          `)}
          ${actionListHtml ? this.printService.buildSection('Mandatory Citizen Remedial Actions', actionListHtml, 'Step-by-Step Defense Protocol') : ''}
          ${helplineHtml}
          <div style="margin-top:14px;padding:8px 12px;border:1px solid #cbd5e1;background:#f8fafc;border-radius:6px;font-size:8.5px;color:#64748b;line-height:1.5;">
            <strong>Provenance:</strong> LegalConnect Statutory Rule Engine &bull; Verified against binding Supreme Court precedents.
          </div>
        </div>
      `;

      this.printService.print({
        title: 'Statutory Crisis Diagnostic Brief',
        subtitle: `${title} · LegalConnect Triage Directorate`,
        classification: res.status === 'VIOLATION_CONFIRMED' ? 'OFFICIAL LEGAL ALERT' : 'LEGAL BRIEF',
        accentColor: res.status === 'VIOLATION_CONFIRMED' ? '#dc2626' : '#2563eb',
        watermark: 'LEGALCONNECT TRIAGE',
        content: contentHtml,
        extraMeta: [
          { label: 'Evaluation Status', value: res.status },
          { label: 'Legal Basis', value: res.statutoryBasis },
          { label: 'Confidence Score', value: `${res.confidenceScore}%` },
          { label: 'Issued At', value: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
        ]
      });
    } catch (err) {
      console.error('[DiagnosticWizardModal] Print error:', err);
      this.snackbar.show('Failed to compile printable diagnostic brief.', 'error');
    }
  }

  triggerTemplate(crisisId?: string): void {
    const targetCrisisId = crisisId || this.selectedCrisisId();
    const templateId = this.getTemplateIdForCrisis(targetCrisisId);
    this.openTemplate.emit(templateId);
  }

  getTemplateIdForCrisis(crisisId: string): string {
    switch (crisisId) {
      case 'police':
        return 'police-misconduct-representation';
      case 'landlord':
        return 'tenant-utility-cut-contest';
      case 'consumer':
        return 'consumer-deficiency-refund';
      case 'cyber':
      case 'cheque':
      case 'banking':
        return 'cheque-bounce-notice';
      case 'rti':
        return 'rti-application';
      default:
        return 'tenant-utility-cut-contest';
    }
  }

  trackByDiagnosticCrisis(_index: number, crisis: DiagnosticCrisis): string {
    return crisis.id || (crisis as any).crisisId || (crisis as any)._id || String(_index);
  }

  trackByDomainFilter(_index: number, cat: DomainCategoryFilter): string {
    return cat.id;
  }

  trackByIndex(index: number): number {
    return index;
  }
}