import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { EnrichedSection, EnrichedParsedLegalSection } from '../../act-detail.component';
import {
  EditSectionFormData,
  EditSectionSaveEvent,
  AiTranslateSectionResponse,
  AiEnhanceSectionResponse
} from '../../../legal-content.models';
import { TooltipDirective } from '../../../../../shared/directives/tooltip.directive';
import { AdminApiService } from '../../../../../core/admin-api.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { LegalTextParser } from '../../../../../core/utils/legal-text-parser';

/** Minimum seconds between consecutive AI calls (translate or enhance) */
const AI_COOLDOWN_SECONDS = 10;

@Component({
  selector: 'admin-section-edit-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './admin-section-edit-modal.component.html',
  styleUrl: './admin-section-edit-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSectionEditModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) section!: EnrichedSection;
  @Input() shortName = '';
  @Input() actName = '';
  @Input() isSaving = false;

  @Output() save = new EventEmitter<EditSectionSaveEvent>();
  @Output() close = new EventEmitter<void>();

  editTab: 'en' | 'hi' | 'preview' = 'en';
  editForm: EditSectionFormData = {
    section_number: '',
    title: '',
    title_hi: '',
    introduction_text: '',
    introduction_text_hi: ''
  };

  isTranslating = false;
  isEnhancing = false;

  // AI cooldown: prevents spamming expensive LLM calls
  aiCooldownRemaining = 0;
  private aiCooldownTimer: ReturnType<typeof setInterval> | null = null;

  // Debounced preview parsing: avoids re-parsing on every keystroke
  editPreviewParsed: EnrichedParsedLegalSection | null = null;
  private previewSubject = new Subject<void>();
  private subscriptions = new Subscription();

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.syncFormFromSection();

    // Debounce preview re-parsing: only re-parse 300ms after user stops typing
    this.subscriptions.add(
      this.previewSubject.pipe(debounceTime(300)).subscribe(() => {
        this.recomputePreview();
        this.cdr.markForCheck();
      })
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['section'] && this.section) {
      this.syncFormFromSection();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.aiCooldownTimer) {
      clearInterval(this.aiCooldownTimer);
      this.aiCooldownTimer = null;
    }
  }

  private syncFormFromSection(): void {
    if (!this.section) return;
    this.editTab = 'en';
    this.editForm = {
      section_number: this.section.secId,
      title: this.section.cleanTitle,
      title_hi: this.section.title_hi || '',
      introduction_text: this.section.rawContent || this.section.cleanBody,
      introduction_text_hi: this.section.introduction_text_hi || this.section.content_hi || ''
    };
    // Compute initial preview
    this.recomputePreview();
    this.cdr.markForCheck();
  }

  /** Called from template on textarea ngModelChange to trigger debounced re-parse */
  onContentChange(): void {
    this.previewSubject.next();
  }

  private recomputePreview(): void {
    if (!this.editForm.introduction_text) {
      this.editPreviewParsed = null;
      return;
    }
    const parsedBase = LegalTextParser.parse(this.editForm.introduction_text, this.editForm.title || '');
    this.editPreviewParsed = {
      ...parsedBase,
      enrichedNodes: (parsedBase.nodes || []).map(n => ({
        ...n,
        levelClass: `level-${n.level}`,
        markerClass: `marker-l${n.level}`,
        isCallout: n.type === 'proviso' || n.type === 'explanation' || n.type === 'illustration',
        calloutClass: n.type === 'proviso' ? 'callout-proviso' : n.type === 'explanation' ? 'callout-explanation' : n.type === 'illustration' ? 'callout-illustration' : '',
        calloutLabel: n.type === 'proviso' ? 'Proviso' : n.type === 'explanation' ? 'Explanation' : n.type === 'illustration' ? 'Illustration' : '',
        children: []
      }))
    };
  }

  get editWordCount(): number {
    const text = this.editTab === 'hi' ? this.editForm.introduction_text_hi : this.editForm.introduction_text;
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  get editCharCount(): number {
    const text = this.editTab === 'hi' ? this.editForm.introduction_text_hi : this.editForm.introduction_text;
    return text ? text.length : 0;
  }

  get editReadingTime(): number {
    return Math.max(1, Math.ceil(this.editWordCount / 200));
  }

  get isAiOnCooldown(): boolean {
    return this.aiCooldownRemaining > 0;
  }

  get hasHindiContent(): boolean {
    return Boolean(this.editForm.title_hi?.trim() || this.editForm.introduction_text_hi?.trim());
  }

  /** Start the AI cooldown countdown after a successful or failed AI call */
  private startAiCooldown(): void {
    this.aiCooldownRemaining = AI_COOLDOWN_SECONDS;
    if (this.aiCooldownTimer) clearInterval(this.aiCooldownTimer);

    this.aiCooldownTimer = setInterval(() => {
      this.aiCooldownRemaining--;
      if (this.aiCooldownRemaining <= 0) {
        this.aiCooldownRemaining = 0;
        if (this.aiCooldownTimer) {
          clearInterval(this.aiCooldownTimer);
          this.aiCooldownTimer = null;
        }
      }
      this.cdr.markForCheck();
    }, 1000);
  }

  formatEditClauses(): void {
    const field = this.editTab === 'hi' ? 'introduction_text_hi' : 'introduction_text';
    let text = this.editForm[field] || '';
    if (!text.trim()) return;

    text = text
      .replace(/\r\n/g, '\n')
      .replace(/([^\n])\s*(\(\d+[a-zA-Z]?\))\s*/g, '$1\n\n$2 ')
      .replace(/([^\n])\s*(\([a-z]\))\s*/g, '$1\n  $2 ')
      .replace(/([^\n])\s*(\([ivxlcdm]+\))\s*/g, '$1\n    $2 ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    this.editForm[field] = text;
    this.toast.info('Clauses auto-formatted.');
    this.onContentChange();
    this.cdr.markForCheck();
  }

  translateToHindiWithAi(): void {
    if (this.isAiOnCooldown) {
      this.toast.warning(`Please wait ${this.aiCooldownRemaining}s before sending another AI request.`);
      return;
    }
    if (!this.editForm.introduction_text?.trim() && !this.editForm.title?.trim()) {
      this.toast.warning('Please enter English title or text first to translate.');
      return;
    }

    this.isTranslating = true;
    this.cdr.markForCheck();

    this.api.translateSectionWithAi({
      actName: this.actName || this.shortName,
      shortName: this.shortName,
      section_number: this.editForm.section_number,
      title: this.editForm.title,
      introduction_text: this.editForm.introduction_text
    }).subscribe({
      next: (res: AiTranslateSectionResponse) => {
        this.isTranslating = false;
        this.startAiCooldown();
        if (res.data) {
          if (res.data.title_hi) this.editForm.title_hi = res.data.title_hi;
          if (res.data.introduction_text_hi) this.editForm.introduction_text_hi = res.data.introduction_text_hi;
          this.editTab = 'hi';

          if (res.fromCache) {
            this.toast.success('⚡ Instant Cache: Translation loaded in 0ms (0 tokens used).');
          } else {
            this.toast.success('Official Hindi translation generated.');
          }
        }
        this.cdr.markForCheck();
      },
      error: (err: { error?: { error?: { message?: string }; message?: string } }) => {
        this.isTranslating = false;
        this.startAiCooldown();
        const msg = err.error?.error?.message || err.error?.message || 'Failed to translate with AI.';
        this.toast.error(msg);
        this.cdr.markForCheck();
      }
    });
  }

  enhanceEnglishWithAi(): void {
    if (this.isAiOnCooldown) {
      this.toast.warning(`Please wait ${this.aiCooldownRemaining}s before sending another AI request.`);
      return;
    }
    if (!this.editForm.introduction_text?.trim() && !this.editForm.title?.trim()) {
      this.toast.warning('Please enter text first to format.');
      return;
    }

    this.isEnhancing = true;
    this.cdr.markForCheck();

    this.api.enhanceSectionWithAi({
      actName: this.actName || this.shortName,
      shortName: this.shortName,
      section_number: this.editForm.section_number,
      title: this.editForm.title,
      introduction_text: this.editForm.introduction_text
    }).subscribe({
      next: (res: AiEnhanceSectionResponse) => {
        this.isEnhancing = false;
        this.startAiCooldown();
        if (res.data) {
          if (res.data.title) this.editForm.title = res.data.title;
          if (res.data.introduction_text) this.editForm.introduction_text = res.data.introduction_text;

          if (res.fromCache) {
            this.toast.success('⚡ Instant Cache: Proofread text loaded in 0ms.');
          } else {
            this.toast.success('Section text proofread & formatted.');
          }
        }
        this.onContentChange();
        this.cdr.markForCheck();
      },
      error: (err: { error?: { error?: { message?: string }; message?: string } }) => {
        this.isEnhancing = false;
        this.startAiCooldown();
        const msg = err.error?.error?.message || err.error?.message || 'Failed to enhance with AI.';
        this.toast.error(msg);
        this.cdr.markForCheck();
      }
    });
  }

  onSave(): void {
    this.save.emit({
      section: this.section,
      formData: this.editForm
    });
  }

  onClose(): void {
    this.close.emit();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.onClose();
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.onSave();
    }
  }
}