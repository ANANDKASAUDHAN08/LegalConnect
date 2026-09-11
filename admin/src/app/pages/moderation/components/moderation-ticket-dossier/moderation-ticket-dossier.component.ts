import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject,
  OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  AdminModerationService,
  ModerationReport,
  AuditLogEntry,
  TargetPreviewData,
  ReportNote,
  isValidEvidenceUrl
} from '../../../../core/services/admin-moderation.service';
import { PiiMaskState } from '../../../../core/utils/security-utils';
import { ToastService } from '../../../../shared/services/toast.service';
import { AdminIconComponent } from '../../../../shared/components/icon/icon.component';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';
import {
  getSeverityBadgeClass,
  getTypeBadgeClass,
  formatMaskedIp
} from '../../utils/moderation-format.util';

@Component({
  selector: 'moderation-ticket-dossier',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminIconComponent,
    SkeletonComponent,
    TooltipDirective
  ],
  templateUrl: './moderation-ticket-dossier.component.html',
  styleUrls: ['./moderation-ticket-dossier.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModerationTicketDossierComponent implements OnInit, OnChanges, OnDestroy {
  private moderationService = inject(AdminModerationService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  @Input() report: ModerationReport | null = null;
  @Input() currentAdminEmail = '';
  @Input() isDrawerMode = false;

  @Output() closed = new EventEmitter<void>();
  @Output() claim = new EventEmitter<ModerationReport>();
  @Output() resolve = new EventEmitter<ModerationReport>();
  @Output() dismiss = new EventEmitter<ModerationReport>();
  @Output() reopen = new EventEmitter<ModerationReport>();
  @Output() openLightbox = new EventEmitter<string>();

  activeTab: 'overview' | 'reporter' | 'audit' | 'notes' = 'overview';

  // Notes Thread
  ticketNotes: ReportNote[] = [];
  isLoadingNotes = false;
  isSubmittingNote = false;
  newNoteText = '';

  // Forensic Audit Trail
  auditLogs: AuditLogEntry[] = [];
  isLoadingAuditLogs = false;

  // Live Target Entity Deep Preview
  targetPreviewData: TargetPreviewData | null = null;
  isLoadingTargetPreview = false;

  // PII Masking
  ipMask = new PiiMaskState<number>();

  ngOnInit(): void {
    this.initRealtimeSubscription();
  }

  private initRealtimeSubscription(): void {
    this.moderationService.moderationUpdates$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event) => {
          if (!event || !this.report) return;
          if (event.eventType === 'INTERNAL_NOTE_ADDED' && event.reportId === this.report.id && event.extra) {
            if (!this.ticketNotes.some(n => n.id === event.extra.id)) {
              this.ticketNotes = [...this.ticketNotes, event.extra];
              this.cdr.markForCheck();
            }
          }
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['report'] && this.report) {
      const prev = changes['report'].previousValue as ModerationReport | undefined;
      if (!prev || prev.id !== this.report.id) {
        this.loadCurrentTabContent(this.report.id);
      }
    }
  }

  setTab(tab: 'overview' | 'reporter' | 'audit' | 'notes'): void {
    this.activeTab = tab;
    if (this.report) {
      this.loadCurrentTabContent(this.report.id);
    }
    this.cdr.markForCheck();
  }

  private loadCurrentTabContent(reportId: number): void {
    if (!this.report) return;

    if (this.activeTab === 'overview') {
      this.fetchTargetPreview(this.report);
    } else if (this.activeTab === 'audit') {
      this.fetchAuditLogs(reportId);
    } else if (this.activeTab === 'notes') {
      this.fetchTicketNotes(reportId);
    }
  }

  fetchTargetPreview(report: ModerationReport): void {
    if (!report.targetType || !report.targetId) return;
    this.isLoadingTargetPreview = true;
    this.targetPreviewData = null;
    this.cdr.markForCheck();

    this.moderationService.getTargetPreview(report.targetType, report.targetId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoadingTargetPreview = false;
          if (res?.data) {
            this.targetPreviewData = res.data;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingTargetPreview = false;
          this.cdr.markForCheck();
        }
      });
  }

  fetchAuditLogs(reportId: number): void {
    this.isLoadingAuditLogs = true;
    this.auditLogs = [];
    this.cdr.markForCheck();

    this.moderationService.getAuditTrail(reportId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoadingAuditLogs = false;
          if (res?.data) {
            this.auditLogs = res.data;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingAuditLogs = false;
          this.cdr.markForCheck();
        }
      });
  }

  fetchTicketNotes(reportId: number): void {
    this.isLoadingNotes = true;
    this.ticketNotes = [];
    this.cdr.markForCheck();

    this.moderationService.getReportNotes(reportId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isLoadingNotes = false;
          if (res?.data) {
            this.ticketNotes = res.data;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingNotes = false;
          this.cdr.markForCheck();
        }
      });
  }

  submitNote(): void {
    if (!this.report || !this.newNoteText.trim() || this.isSubmittingNote) return;

    const noteText = this.newNoteText.trim();
    const reportId = this.report.id;
    this.isSubmittingNote = true;
    this.cdr.markForCheck();

    this.moderationService.addReportNote(reportId, noteText)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isSubmittingNote = false;
          this.newNoteText = '';
          if (res?.data && !this.ticketNotes.some(n => n.id === res.data.id)) {
            this.ticketNotes = [...this.ticketNotes, res.data];
          }
          this.toast.success('Internal note added ✓');
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.isSubmittingNote = false;
          this.toast.error(err?.error?.message || 'Failed to add note');
          this.cdr.markForCheck();
        }
      });
  }

  isAssignedToCurrentAdmin(email?: string): boolean {
    if (!email || !this.currentAdminEmail) return false;
    return email.trim().toLowerCase() === this.currentAdminEmail.trim().toLowerCase();
  }

  getDisplayIp(report?: ModerationReport | null): string {
    if (!report?.reporterIp) return 'IP Hidden';
    return formatMaskedIp(report.reporterIp, this.ipMask.isUnmasked(report.id, 'ip'));
  }

  toggleIpMask(reportId: number, event?: Event): void {
    this.ipMask.toggle(reportId, 'ip', event);
    this.cdr.markForCheck();
  }

  isIpUnmasked(reportId: number): boolean {
    return this.ipMask.isUnmasked(reportId, 'ip');
  }

  trackByLogId = (index: number, log: AuditLogEntry): number => log.id;
  trackByNoteId = (index: number, note: ReportNote): number => note.id;
  trackByCategory = (index: number, cat: string): string => cat;
  trackByIndex = (index: number): number => index;

  copyToClipboard(text: string | number | undefined, label: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (text === undefined || text === null) return;
    const str = String(text);
    navigator.clipboard.writeText(str).then(() => {
      this.toast.success(`${label} copied to clipboard`);
    }).catch(() => {
      this.toast.info(`${label}: ${str}`);
    });
  }

  onClaim(): void {
    if (this.report) this.claim.emit(this.report);
  }

  onResolve(): void {
    if (this.report) this.resolve.emit(this.report);
  }

  onDismiss(): void {
    if (this.report) this.dismiss.emit(this.report);
  }

  onReopen(): void {
    if (this.report) this.reopen.emit(this.report);
  }

  onClose(): void {
    this.closed.emit();
  }

  onOpenLightbox(url: string | undefined): void {
    if (url) this.openLightbox.emit(url);
  }

  isValidUrl(url: string | undefined): boolean {
    return isValidEvidenceUrl(url);
  }

  getSeverityBadge(severity: string | undefined): string {
    return getSeverityBadgeClass(severity);
  }

  getTypeBadge(type: string | undefined): string {
    return getTypeBadgeClass(type);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}