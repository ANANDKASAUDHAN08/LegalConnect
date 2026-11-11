import {
  Component, ChangeDetectionStrategy, inject, signal, computed, HostListener, OnInit, OnDestroy, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { RightProposalService, ProposalCategory } from '../../../../services/right-proposal.service';
import { AuthService, UserProfile } from '../../../../services/auth.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { IconComponent } from '../../../../components/icon/icon.component';

/**
 * <app-suggest-right-modal> — Citizen Legal Safeguards & New Right Proposition Modal
 *
 * Implements SOLID Single Responsibility Principle:
 * Decoupled from Content Reporting & Dispute Moderation.
 * Purely dedicated to crowdsourced citizen legal defense proposals:
 * - Emerging threat scenarios (e.g., Digital Arrest, AI Voice Clone Extortion)
 * - Obsolete statutory replacements under Bharatiya Nyaya Sanhita (BNS 2023)
 * - Verbal script teleprompter proposals calibrated for high-stress confrontation
 * - 24x7 Emergency helpline submissions
 * - Tier-1 MNC UI: Multi-step wizard, client-side canvas evidence downscaling, 1-click ticket copy
 */

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf'
];

@Component({
  selector: 'app-suggest-right-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './suggest-right-modal.component.html',
  styleUrls: ['./suggest-right-modal.component.scss']
})
export class SuggestRightModalComponent implements OnInit, OnDestroy {
  proposalService = inject(RightProposalService);
  private auth = inject(AuthService);
  private snackbar = inject(SnackbarService);

  private authSub?: Subscription;
  currentUser: UserProfile | null = null;
  isLoggedIn = false;

  // ── Categories & Dynamic Taxonomy ──
  categories = signal<ProposalCategory[]>([]);
  isLoadingCategories = signal(false);

  // ── Wizard State ──
  step = signal(1);
  isSubmitting = signal(false);
  successMessage = signal('');
  referenceId = signal('');
  estimatedTime = signal('');
  isCopiedRef = signal(false);

  // ── Multi-Modal Evidence Attachment ──
  evidencePreview = signal<string | null>(null);
  evidenceFileName = signal<string | null>(null);
  evidenceFileSize = signal<string | null>(null);
  evidenceFileType = signal<string | null>(null);
  isDragging = signal(false);
  isProcessingFile = signal(false);

  // ── Reactive Form ──
  proposalForm = new FormGroup({
    scenarioTitle: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(150)]
    }),
    category: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    description: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(15), Validators.maxLength(3000)]
    }),
    statutoryBasis: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(250)]
    }),
    verbalScript: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(600)]
    }),
    emergencyHelpline: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(120)]
    }),
    contributorType: new FormControl<'citizen' | 'advocate' | 'law_student' | 'anonymous'>('citizen', {
      nonNullable: true
    }),
    contributorName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)]
    }),
    contributorEmail: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(150), Validators.email]
    })
  });

  selectedCategoryObj = computed(() => {
    const catId = this.proposalForm.get('category')?.value;
    if (!catId) return null;
    return this.categories().find(c => c.id === catId || c.name === catId) || null;
  });

  constructor() {
    // Body scroll lock effect and prefill context reaction
    effect(async () => {
      const isOpen = this.proposalService.isOpen();
      const prefill = this.proposalService.prefillContext();

      if (typeof document !== 'undefined') {
        if (isOpen) {
          document.body.classList.add('overflow-hidden');
        } else {
          document.body.classList.remove('overflow-hidden');
        }
      }

      if (isOpen) {
        // Load taxonomy categories
        if (this.categories().length === 0) {
          this.isLoadingCategories.set(true);
          try {
            const data = await this.proposalService.getCategories();
            this.categories.set(data);
          } finally {
            this.isLoadingCategories.set(false);
          }
        }

        // Apply prefill context if provided
        if (prefill) {
          if (prefill.scenarioTitle) {
            this.proposalForm.patchValue({ scenarioTitle: prefill.scenarioTitle });
          }
          if (prefill.category) {
            this.proposalForm.patchValue({ category: prefill.category });
          }
        }
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.authSub = this.auth.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
      if (user) {
        this.proposalForm.patchValue({
          contributorName: user.fullName || '',
          contributorEmail: user.email || '',
          contributorType: user.role === 'lawyer' ? 'advocate' : 'citizen'
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  // ── Form Control Getters ──
  get scenarioTitleControl(): FormControl<string> {
    return this.proposalForm.get('scenarioTitle') as FormControl<string>;
  }

  get categoryControl(): FormControl<string> {
    return this.proposalForm.get('category') as FormControl<string>;
  }

  get descriptionControl(): FormControl<string> {
    return this.proposalForm.get('description') as FormControl<string>;
  }

  get descriptionLength(): number {
    return this.descriptionControl.value?.length || 0;
  }

  selectCategory(cat: ProposalCategory): void {
    this.categoryControl.setValue(cat.id);
  }

  setContributorType(type: 'citizen' | 'advocate' | 'law_student' | 'anonymous'): void {
    this.proposalForm.patchValue({ contributorType: type });
    const emailCtrl = this.proposalForm.get('contributorEmail');
    const nameCtrl = this.proposalForm.get('contributorName');

    if (type === 'anonymous') {
      emailCtrl?.clearValidators();
      nameCtrl?.clearValidators();
    } else {
      emailCtrl?.setValidators([Validators.maxLength(150), Validators.email]);
      nameCtrl?.setValidators([Validators.maxLength(100)]);
    }
    emailCtrl?.updateValueAndValidity();
    nameCtrl?.updateValueAndValidity();
  }

  readonly threatSuggestions: string[] = [
    'Unauthorized Phone Confiscation at Checkpoint',
    'Digital Arrest Video Extortion Scam',
    'Forcible Tenant Lockout Without Notice',
    'Illegal Vehicle Key Snatching by Police',
    'Arrest of Female Citizen After Sunset'
  ];

  readonly statuteSuggestions: string[] = [
    'BNS 2023 Sec 351',
    'BNSS 2023 Sec 105',
    'Motor Vehicles Act Sec 130',
    'Constitution of India Art. 21',
    'Model Tenancy Act Sec 20'
  ];

  nextStep(): void {
    this.step.update(s => Math.min(s + 1, 4));
  }

  prevStep(): void {
    this.step.update(s => Math.max(s - 1, 1));
  }

  goToStep(targetStep: number): void {
    if (this.step() === 4) return;
    if (targetStep === 1) {
      this.step.set(1);
    } else if (targetStep === 2 && this.isStep1Valid()) {
      this.step.set(2);
    } else if (targetStep === 3 && this.isStep1Valid()) {
      this.step.set(3);
    }
  }

  isStep1Valid(): boolean {
    return !this.scenarioTitleControl.invalid && !this.categoryControl.invalid && this.descriptionLength >= 15;
  }

  getStepTitle(step: number): string {
    switch (step) {
      case 1: return 'Scenario & Threat';
      case 2: return 'Statute & Script';
      case 3: return 'Attribution & Audit';
      case 4: return 'Proposal Received';
      default: return '';
    }
  }

  applyTitleSuggestion(title: string): void {
    this.scenarioTitleControl.setValue(title);
    this.scenarioTitleControl.markAsDirty();
    this.scenarioTitleControl.markAsTouched();
  }

  applyStatuteSuggestion(statute: string): void {
    const current = this.proposalForm.get('statutoryBasis')?.value?.trim();
    if (!current) {
      this.proposalForm.patchValue({ statutoryBasis: statute });
    } else if (!current.includes(statute)) {
      this.proposalForm.patchValue({ statutoryBasis: `${current}, ${statute}` });
    }
  }

  proposeAnother(): void {
    this.resetState();
  }

  getCategoryColorClass(catId: string): string {
    switch (catId) {
      case 'Police Encounters': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'Cyber & Online Fraud': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'Housing & Tenancy': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Women & Child Safety': return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      case 'Consumer & Financial': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Workplace & Labor': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Healthcare & Dignity': return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      default: return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    }
  }

  // ── File & Clipboard Evidence Attachment ──

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processFile(input.files[0]);
      input.value = '';
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  @HostListener('paste', ['$event'])
  handlePaste(event: ClipboardEvent): void {
    if (!this.proposalService.isOpen() || this.step() !== 2) return;
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          event.preventDefault();
          this.processFile(file, 'Pasted-Screenshot.png');
          this.snackbar.show('Evidence proof captured from clipboard!', 'success', 3000);
          break;
        }
      }
    }
  }

  private processFile(file: File, customName?: string): void {
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      this.snackbar.show('Unsupported format. Please attach JPEG, PNG, WebP or PDF.', 'warning', 3500);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.snackbar.show('File is too large. Maximum supported attachment is 5 MB.', 'warning', 3500);
      return;
    }

    const fileName = customName || file.name || 'evidence-document';
    const isImage = file.type.startsWith('image/') && file.type !== 'image/gif';
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';

    this.isProcessingFile.set(true);

    if (isImage) {
      this.compressImage(file, (optimizedDataUrl, finalSize) => {
        this.evidencePreview.set(optimizedDataUrl);
        this.evidenceFileName.set(fileName);
        this.evidenceFileSize.set(this.formatFileSize(finalSize));
        this.evidenceFileType.set('image');
        this.isProcessingFile.set(false);
        this.snackbar.show(`Evidence attached: ${fileName}`, 'success', 2500);
      });
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        this.evidencePreview.set(dataUrl);
        this.evidenceFileName.set(fileName);
        this.evidenceFileSize.set(this.formatFileSize(file.size));
        this.evidenceFileType.set(fileType);
        this.isProcessingFile.set(false);
        this.snackbar.show(`Evidence attached: ${fileName}`, 'success', 2500);
      };
      reader.onerror = () => {
        this.isProcessingFile.set(false);
        this.snackbar.show('Failed to read attached file.', 'error', 3000);
      };
      reader.readAsDataURL(file);
    }
  }

  private compressImage(file: File, callback: (dataUrl: string, size: number) => void): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const approxSize = Math.round((dataUrl.length * 3) / 4);
          callback(dataUrl, approxSize);
        } else {
          callback(e.target?.result as string, file.size);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  removeEvidence(): void {
    this.evidencePreview.set(null);
    this.evidenceFileName.set(null);
    this.evidenceFileSize.set(null);
    this.evidenceFileType.set(null);
    this.isProcessingFile.set(false);
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ── Ticket Reference & Copy ──

  copyReferenceId(): void {
    const ref = this.referenceId();
    if (!ref || !navigator.clipboard) return;

    navigator.clipboard.writeText(ref).then(() => {
      this.isCopiedRef.set(true);
      this.snackbar.show(`Proposal ticket ${ref} copied to clipboard!`, 'success', 2500);
      setTimeout(() => this.isCopiedRef.set(false), 3000);
    });
  }

  // ── Submit Proposal ──

  async submitProposal(): Promise<void> {
    if (this.proposalForm.invalid) {
      this.proposalForm.markAllAsTouched();
      return;
    }

    const val = this.proposalForm.getRawValue();
    this.isSubmitting.set(true);

    try {
      const res = await this.proposalService.submitProposal({
        scenarioTitle: val.scenarioTitle.trim(),
        category: val.category.trim(),
        statutoryBasis: val.statutoryBasis.trim() || undefined,
        verbalScript: val.verbalScript.trim() || undefined,
        emergencyHelpline: val.emergencyHelpline.trim() || undefined,
        description: val.description.trim(),
        evidenceUrl: this.evidencePreview() || undefined,
        contributorType: val.contributorType,
        contributorName: val.contributorName.trim() || undefined,
        contributorEmail: val.contributorEmail.trim() || undefined
      });

      this.successMessage.set(res.message);
      this.referenceId.set(res.referenceId);
      this.estimatedTime.set(res.estimatedReviewTime || '3-5 business days');
      this.step.set(4);

      this.snackbar.show(`Legal defense proposal submitted! Ref: ${res.referenceId}`, 'success', 5000);
    } catch (err: any) {
      this.snackbar.show(err?.error?.message || err?.message || 'Failed to submit proposal. Please try again.', 'error', 4000);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // ── Backdrop & Close ──

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    this.proposalService.closeProposal();
    this.resetState();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.proposalService.isOpen()) {
      this.onClose();
    }
  }

  private resetState(): void {
    this.step.set(1);
    this.proposalForm.reset({
      scenarioTitle: '',
      category: '',
      description: '',
      statutoryBasis: '',
      verbalScript: '',
      emergencyHelpline: '',
      contributorType: 'citizen',
      contributorName: this.currentUser?.fullName || '',
      contributorEmail: this.currentUser?.email || ''
    });
    this.removeEvidence();
    this.successMessage.set('');
    this.referenceId.set('');
    this.estimatedTime.set('');
    this.isCopiedRef.set(false);
    this.isSubmitting.set(false);
  }

  /**
   * TrackBy identity functions to prevent redundant DOM re-renders in iteration loops.
   */
  trackByIndex(index: number): number {
    return index;
  }

  trackByString(_index: number, str: string): string {
    return str;
  }

  trackByCategoryId(_index: number, cat: ProposalCategory): string {
    return cat.id;
  }
}