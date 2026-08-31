import {
  Component, ChangeDetectionStrategy, inject, signal, computed, HostListener, OnInit, OnDestroy, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ModerationReportService, ReportReason } from '../../../services/moderation-report.service';
import { AuthService, UserProfile } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { IconComponent } from '../../icon/icon.component';
import { ConfirmDialogComponent } from '../../confirm-dialog/confirm-dialog.component';

/**
 * <app-report-modal> — Enterprise-Grade Content Report & Dispute Modal
 *
 * Tier-1 MNC Features (Google / Apple / Stripe / Linear standard):
 * - Reactive Form Architecture (`FormGroup`, `FormControl`, `Validators`)
 * - Pure Signal Reactivity (`signal`, `computed`, `effect`) for instantaneous UI updates
 * - Dynamic Backend Taxonomy Single Source of Truth with Skeleton Loading
 * - Client-Side Image Resizing & Compression (HTML5 Canvas downscaling to max 1600px @ 0.85 quality)
 * - Multi-Modal Evidence Ingestion (Click Browse, Drag & Drop, Clipboard Screenshot Paste `Ctrl+V`)
 * - Dynamic Contextual Validation (Zero-PII Anonymous vs Verified Contact Email/Name validation)
 * - Anti-Brigading Duplicate Merge Detection & Severity-Aware Dynamic SLA Estimates
 * - 1-Click Reference Ticket Copy & Process Transparency
 * - Responsive: Centered floating glassmorphic card on Desktop, Native Bottom Sheet on Mobile
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
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent, TooltipDirective, ConfirmDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-modal.component.html',
  styleUrls: ['./report-modal.component.scss']
})
export class ReportModalComponent implements OnInit, OnDestroy {
  reportService = inject(ModerationReportService);
  private auth = inject(AuthService);
  private snackbar = inject(SnackbarService);

  private authSub?: Subscription;
  currentUser: UserProfile | null = null;
  isLoggedIn = false;

  // ── Dynamic Taxonomy Signal (Backend API driven) ──
  dynamicReasons = signal<ReportReason[]>([]);

  // ── Existing Report Status View State ──
  isViewingStatus = signal(false);
  showWithdrawConfirm = signal(false);

  // ── Wizard & Loading State ──
  step = signal(1);
  selectedReason = signal<string | null>(null);
  isLoadingReasons = signal<boolean>(false);
  isProcessingFile = signal<boolean>(false);
  isSubmitting = signal(false);
  successMessage = signal('');
  referenceId = signal('');
  estimatedTime = signal('');
  isCopiedRef = signal(false);

  // ── Evidence Attachment State ──
  evidencePreview = signal<string | null>(null);
  evidenceFileName = signal<string | null>(null);
  evidenceFileSize = signal<string | null>(null);
  evidenceFileType = signal<string | null>(null);
  isDragging = signal<boolean>(false);

  // ── Reactive Form Definition ──
  reportForm = new FormGroup({
    reasonCategory: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required]
    }),
    description: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]
    }),
    adaptiveCorrection: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(250)]
    }),
    adaptiveStatus: new FormControl<string>('', {
      nonNullable: true
    }),
    contactType: new FormControl<'anonymous' | 'contact'>('anonymous', {
      nonNullable: true
    }),
    reporterName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)]
    }),
    reporterEmail: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(150), Validators.email]
    })
  });

  // ── Computed Taxonomy (Backend Dynamic + Resilient Fallback) ──
  reasons = computed(() => {
    const dyn = this.dynamicReasons();
    if (dyn.length > 0) return dyn;
    const target = this.reportService.currentTarget();
    if (!target) return [];
    return this.reportService.getFallbackReasonsForType(target.targetType);
  });

  selectedReasonObj = computed(() => {
    const key = this.selectedReason();
    if (!key) return null;
    return this.reasons().find(r => r.key === key) || null;
  });

  // ── Computed Existing Active Report ──
  existingReport = computed(() => {
    const target = this.reportService.currentTarget();
    if (!target) return null;
    return this.reportService.getReport(target.targetType, target.targetId);
  });

  constructor() {
    // Reactive effect: fetch taxonomy from backend, check existing report state and manage body scroll lock
    effect(async () => {
      const target = this.reportService.currentTarget();
      const isOpen = this.reportService.isModalOpen();

      if (typeof document !== 'undefined') {
        if (isOpen) {
          document.body.classList.add('overflow-hidden');
        } else {
          document.body.classList.remove('overflow-hidden');
        }
      }

      if (isOpen && target) {
        // If user already has an active report, start in Status View
        if (this.reportService.hasReported(target.targetType, target.targetId)) {
          this.isViewingStatus.set(true);
        } else {
          this.isViewingStatus.set(false);
        }

        this.isLoadingReasons.set(true);
        try {
          const reasons = await this.reportService.getReasonsForType(target.targetType);
          this.dynamicReasons.set(reasons);
        } finally {
          this.isLoadingReasons.set(false);
        }
      } else {
        this.dynamicReasons.set([]);
        this.isViewingStatus.set(false);
      }
    }, { allowSignalWrites: true });
  }

  startNewReport(): void {
    this.isViewingStatus.set(false);
    this.step.set(1);
  }

  onWithdrawClick(): void {
    this.showWithdrawConfirm.set(true);
  }

  onConfirmWithdraw(): void {
    this.showWithdrawConfirm.set(false);
    this.withdrawCurrentReport();
  }

  onCancelWithdraw(): void {
    this.showWithdrawConfirm.set(false);
  }

  withdrawCurrentReport(): void {
    const target = this.reportService.currentTarget();
    if (!target) return;
    this.reportService.withdrawReport(target.targetType, target.targetId);
    this.snackbar.show('Report withdrawn from active tracking.', 'info', 3000);
    this.onClose();
  }

  formatReportDate(ms?: number): string {
    if (!ms) return '';
    return new Date(ms).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  // ── Form Control Getters ──
  get reasonCategoryControl(): FormControl<string> {
    return this.reportForm.get('reasonCategory') as FormControl<string>;
  }

  get descriptionControl(): FormControl<string> {
    return this.reportForm.get('description') as FormControl<string>;
  }

  get contactTypeControl(): FormControl<'anonymous' | 'contact'> {
    return this.reportForm.get('contactType') as FormControl<'anonymous' | 'contact'>;
  }

  get reporterNameControl(): FormControl<string> {
    return this.reportForm.get('reporterName') as FormControl<string>;
  }

  get reporterEmailControl(): FormControl<string> {
    return this.reportForm.get('reporterEmail') as FormControl<string>;
  }

  get descriptionLength(): number {
    return this.descriptionControl.value?.length || 0;
  }

  // ── Adaptive Context Evaluators ──
  get isPhoneReason(): boolean {
    return this.selectedReason() === 'WRONG_PHONE';
  }

  get isAddressReason(): boolean {
    return this.selectedReason() === 'WRONG_ADDRESS';
  }

  get isClosureReason(): boolean {
    const r = this.selectedReason();
    return r === 'CLOSED_PERMANENTLY' || r === 'NOT_PRACTICING';
  }

  get isVigilanceReason(): boolean {
    const r = this.selectedReason();
    return r === 'BRIBERY_ALLEGATION' || r === 'PII_LEAK' || r === 'FAKE_REGISTRATION' || r === 'FRAUD';
  }

  contextPlaceholder = computed(() => {
    if (this.isVigilanceReason) {
      return 'Please detail the incident (date, demanded amount, room/desk or officer details). Attach any receipts, slips or recordings if available...';
    }
    if (this.isPhoneReason) {
      return 'Describe the phone issue (e.g. ringing with no answer, number is disconnected, or reached wrong department)...';
    }
    if (this.isAddressReason) {
      return 'Describe the physical location error or how visitors can find the correct office inside the court complex...';
    }
    if (this.isClosureReason) {
      return 'Provide details on whether the center shifted to a new building, merged with DLSA, or is temporarily closed for renovation...';
    }
    return 'Please describe the issue in detail (at least 10 characters)...';
  });

  reasonAdvisoryTitle = computed(() => {
    if (this.isVigilanceReason) return 'Confidential Vigilance & Whistleblower Fast-Track (2h SLA)';
    if (this.isPhoneReason) return 'Public Registry Telephone Verification Desk';
    if (this.isAddressReason) return 'Campus Navigation & Room Locator Desk';
    if (this.isClosureReason) return 'Institutional Relocation & Operations Review';
    return 'Community Moderation Verification';
  });

  reasonAdvisoryText = computed(() => {
    if (this.isVigilanceReason) {
      return 'Reports regarding bribery demands, corruption, or PII leaks are encrypted and routed directly to senior vigilance officers with priority triage. Anonymous submission is enabled on the next step.';
    }
    if (this.isPhoneReason) {
      return 'Our directory operations team directly verifies reported telephone lines with the court desk. Enter active working numbers to expedite live listing updates.';
    }
    if (this.isAddressReason) {
      return 'Help visitors find the exact room or annex inside the judicial complex by specifying floor, room number, or nearest entrance gate.';
    }
    if (this.isClosureReason) {
      return 'Legal aid clinics and ADR centers frequently relocate to new court annexes. Specify if the center shifted or permanently ceased operations.';
    }
    return 'Our compliance desk audits all citizen reports within 24-48 hours. Providing clear evidence accelerates listing corrections.';
  });

  // ── Lifecycle ──
  ngOnInit(): void {
    this.authSub = this.auth.currentUser$.subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
      if (user) {
        this.reportForm.patchValue({
          reporterName: user.fullName || '',
          reporterEmail: user.email || ''
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

  // ── Reason Selection ──
  selectReason(reason: ReportReason): void {
    this.selectedReason.set(reason.key);
    this.reasonCategoryControl.setValue(reason.key);
    this.reportForm.patchValue({
      adaptiveCorrection: '',
      adaptiveStatus: ''
    });
  }

  // ── Contact Mode Toggle ──
  setContactType(type: 'anonymous' | 'contact'): void {
    this.contactTypeControl.setValue(type);
    if (type === 'anonymous') {
      this.reporterNameControl.clearValidators();
      this.reporterEmailControl.clearValidators();
    } else {
      this.reporterEmailControl.setValidators([Validators.required, Validators.email, Validators.maxLength(150)]);
      this.reporterNameControl.setValidators([Validators.maxLength(100)]);
    }
    this.reporterNameControl.updateValueAndValidity();
    this.reporterEmailControl.updateValueAndValidity();
  }

  nextStep(): void {
    this.step.update(s => Math.min(s + 1, 4));
  }

  prevStep(): void {
    this.step.update(s => Math.max(s - 1, 1));
  }

  // ── Multi-Modal Evidence Upload & Client-Side Compression ──

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processFile(input.files[0]);
      input.value = ''; // Reset input to allow re-selection
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    if (event.dataTransfer?.files && event.dataTransfer.files[0]) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  /**
   * Clipboard Screenshot Ingestion (Ctrl+V / Cmd+V anywhere in modal)
   */
  @HostListener('paste', ['$event'])
  handlePaste(event: ClipboardEvent): void {
    if (!this.reportService.isModalOpen() || this.step() !== 2) return;

    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          event.preventDefault();
          this.processFile(file, 'Pasted-Screenshot.png');
          this.snackbar.show('Screenshot captured from clipboard and attached!', 'success', 3000);
          break;
        }
      }
    }
  }

  private processFile(file: File, customName?: string): void {
    // MIME Validation
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
      this.snackbar.show('Unsupported format. Please attach JPEG, PNG, WebP, GIF or PDF.', 'warning', 3500);
      return;
    }

    // Size Validation (5 MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.snackbar.show('File is too large. Maximum supported attachment size is 5 MB.', 'warning', 3500);
      return;
    }

    const fileName = customName || file.name || 'evidence-document';
    const isImage = file.type.startsWith('image/') && file.type !== 'image/gif';
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'image';

    this.isProcessingFile.set(true);

    if (isImage) {
      // Client-side image scaling to optimize database payload and bandwidth
      this.compressImage(file, (optimizedDataUrl, finalSize) => {
        this.evidencePreview.set(optimizedDataUrl);
        this.evidenceFileName.set(fileName);
        this.evidenceFileSize.set(this.formatFileSize(finalSize));
        this.evidenceFileType.set('image');
        this.isProcessingFile.set(false);
        this.snackbar.show(`Evidence proof attached: ${fileName}`, 'success', 2500);
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
        this.snackbar.show(`Evidence proof attached: ${fileName}`, 'success', 2500);
      };

      reader.onerror = () => {
        this.isProcessingFile.set(false);
        this.snackbar.show('Failed to read attached file. Please try again.', 'error', 3000);
      };

      reader.readAsDataURL(file);
    }
  }

  /**
   * High-performance Canvas-based image resizer (MNC Standard)
   */
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
          // Estimate byte size from base64
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
    const hadFile = !!this.evidencePreview();
    this.evidencePreview.set(null);
    this.evidenceFileName.set(null);
    this.evidenceFileSize.set(null);
    this.evidenceFileType.set(null);
    this.isProcessingFile.set(false);
    if (hadFile) {
      this.snackbar.show('Attachment removed.', 'info', 2000);
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ── Ticket Reference & Copy ──

  copyReferenceId(): void {
    const ref = this.referenceId();
    if (!ref) return;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(ref).then(() => {
        this.isCopiedRef.set(true);
        this.snackbar.show(`Reference ticket ${ref} copied to clipboard!`, 'success', 2500);
        setTimeout(() => this.isCopiedRef.set(false), 3000);
      });
    }
  }

  // ── Submit Report ──

  async submitReport(): Promise<void> {
    const target = this.reportService.currentTarget();
    if (!target || this.reportForm.invalid) return;

    const formVal = this.reportForm.getRawValue();
    this.isSubmitting.set(true);

    // Build rich structured description if adaptive inputs were filled
    let finalDescription = formVal.description.trim();
    if (formVal.adaptiveCorrection.trim()) {
      if (this.isPhoneReason) {
        finalDescription = `[Suggested Active Phone: ${formVal.adaptiveCorrection.trim()}]\n\n${finalDescription}`;
      } else if (this.isAddressReason) {
        finalDescription = `[Suggested Address / Landmark: ${formVal.adaptiveCorrection.trim()}]\n\n${finalDescription}`;
      } else {
        finalDescription = `[Suggested Update: ${formVal.adaptiveCorrection.trim()}]\n\n${finalDescription}`;
      }
    }
    if (formVal.adaptiveStatus) {
      finalDescription = `[Operational Status Note: ${formVal.adaptiveStatus}]\n\n${finalDescription}`;
    }

    try {
      const result = await this.reportService.submitReport({
        targetType: target.targetType,
        targetId: target.targetId,
        targetTitle: target.targetTitle,
        reasonCategory: formVal.reasonCategory,
        description: finalDescription,
        evidenceUrl: this.evidencePreview() || undefined,
        reporterName: formVal.contactType === 'contact' ? (formVal.reporterName.trim() || 'Citizen') : undefined,
        reporterEmail: formVal.contactType === 'contact' ? (formVal.reporterEmail.trim() || undefined) : undefined,
        clientFingerprint: this.reportService.generateFingerprint()
      });

      this.successMessage.set(result.message || 'Report submitted successfully.');
      this.referenceId.set(result.referenceId || '');
      this.estimatedTime.set(result.estimatedReviewTime || '');
      this.step.set(4);

      const refText = result.referenceId ? ` (Ref: ${result.referenceId})` : '';
      this.snackbar.show(`Report submitted successfully${refText}. Triage in progress.`, 'success', 5000);
    } catch (err: any) {
      this.snackbar.show(err?.message || 'Failed to submit report. Please try again.', 'error', 4000);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // ── Modal Backdrop & Keyboard Navigation ──

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onClose(): void {
    this.reportService.closeReport();
    this.resetState();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.reportService.isModalOpen()) {
      this.onClose();
    }
  }

  private resetState(): void {
    this.step.set(1);
    this.selectedReason.set(null);
    this.reportForm.reset({
      reasonCategory: '',
      description: '',
      adaptiveCorrection: '',
      adaptiveStatus: '',
      contactType: 'anonymous',
      reporterName: this.currentUser?.fullName || '',
      reporterEmail: this.currentUser?.email || ''
    });
    this.setContactType('anonymous');
    this.removeEvidence();
    this.successMessage.set('');
    this.referenceId.set('');
    this.estimatedTime.set('');
    this.isCopiedRef.set(false);
    this.isSubmitting.set(false);
    this.isProcessingFile.set(false);
  }
}