import {
  Component, ChangeDetectionStrategy, inject, signal, computed, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModerationReportService, ReportReason } from '../../../services/moderation-report.service';
import { SnackbarService } from '../../../services/snackbar.service';

import { TooltipDirective } from '../../../directives/tooltip.directive';
import { IconComponent } from '../../icon/icon.component';

/**
 * <app-report-modal> — Responsive Content Report Modal
 *
 * Renders as:
 * - Desktop (≥ 768px): Centered glassmorphic modal with backdrop blur
 * - Mobile (< 768px): Bottom sheet drawer (swipe-down to dismiss)
 *
 * Multi-step wizard:
 * 1. Select reason (pill selectors)
 * 2. Add description & evidence
 * 3. Contact / anonymous confirmation
 * 4. Success with reference ticket
 *
 * Place once in app.component.html — it reads modal state from ModerationReportService signals.
 */
@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-modal.component.html',
  styleUrls: ['./report-modal.component.scss']
})
export class ReportModalComponent {
  reportService = inject(ModerationReportService);
  private snackbar = inject(SnackbarService);

  step = signal(1);
  selectedReason = signal<string | null>(null);
  isSubmitting = signal(false);
  successMessage = signal('');
  referenceId = signal('');
  estimatedTime = signal('');

  description = '';
  contactType: 'anonymous' | 'contact' = 'anonymous';
  reporterName = '';
  reporterEmail = '';

  reasons = computed(() => {
    const target = this.reportService.currentTarget();
    if (!target) return [];
    return this.reportService.getReasonsForType(target.targetType);
  });

  selectReason(reason: ReportReason): void {
    this.selectedReason.set(reason.key);
  }

  nextStep(): void {
    this.step.update(s => Math.min(s + 1, 4));
  }

  prevStep(): void {
    this.step.update(s => Math.max(s - 1, 1));
  }

  async submitReport(): Promise<void> {
    const target = this.reportService.currentTarget();
    if (!target || !this.selectedReason()) return;

    this.isSubmitting.set(true);

    try {
      const result = await this.reportService.submitReport({
        targetType: target.targetType,
        targetId: target.targetId,
        targetTitle: target.targetTitle,
        reasonCategory: this.selectedReason()!,
        description: this.description.trim(),
        reporterName: this.contactType === 'contact' ? this.reporterName : undefined,
        reporterEmail: this.contactType === 'contact' ? this.reporterEmail : undefined,
        clientFingerprint: this.reportService.generateFingerprint()
      });

      this.successMessage.set(result.message || 'Report submitted successfully.');
      this.referenceId.set(result.referenceId || '');
      this.estimatedTime.set(result.estimatedReviewTime || '');
      this.step.set(4);

      const refText = result.referenceId ? ` (Ref: ${result.referenceId})` : '';
      this.snackbar.show(`Report submitted successfully${refText}. Our team is reviewing this item.`, 'success', 6000);
    } catch (err: any) {
      this.snackbar.show(err?.message || 'Failed to submit report.', 'error');
    } finally {
      this.isSubmitting.set(false);
    }
  }

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
    this.description = '';
    this.contactType = 'anonymous';
    this.reporterName = '';
    this.reporterEmail = '';
    this.successMessage.set('');
    this.referenceId.set('');
    this.estimatedTime.set('');
    this.isSubmitting.set(false);
  }
}
