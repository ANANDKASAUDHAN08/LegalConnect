import { Component, Input, Output, EventEmitter, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewItem, ReviewService } from '../../../../../services/review.service';
import { UserProfile } from '../../../../../services/auth.service';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { DataExportService } from '../../../../../services/data-export.service';
import { Consultation } from '../../../../../services/lawyer.service';
import { WriteReviewModalComponent, ConsultationOption } from '../../../../../components/write-review-modal/write-review-modal.component';
import { ReviewCardComponent } from '../../../../../components/review-card/review-card.component';
import { ConfirmDialogComponent } from '../../../../../components/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';

export type FeedbackStatusFilter = 'ALL' | 'Approved' | 'Pending' | 'Flagged';

@Component({
  selector: 'app-feedback-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    WriteReviewModalComponent,
    ReviewCardComponent,
    ConfirmDialogComponent,
    IconComponent,
    TooltipDirective
  ],
  templateUrl: './feedback-tab.component.html',
  styleUrls: ['./feedback-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FeedbackTabComponent {
  private reviewService = inject(ReviewService);
  private snackbar = inject(SnackbarService);
  private dataExportService = inject(DataExportService);

  @Input() set reviews(data: ReviewItem[]) {
    this.rawReviews.set(data || []);
  }
  @Input() set inquiries(data: Consultation[]) {
    this.consultations.set(data || []);
  }
  @Input() loading = false;
  @Input() currentUser: UserProfile | null = null;
  @Output() refreshReviews = new EventEmitter<void>();

  // Reactive State
  rawReviews = signal<ReviewItem[]>([]);
  consultations = signal<Consultation[]>([]);
  searchQuery = signal<string>('');
  statusFilter = signal<FeedbackStatusFilter>('ALL');

  // Modal State
  showWriteModal = signal<boolean>(false);
  editingReview = signal<ReviewItem | null>(null);
  initialTargetName = signal<string>('');
  initialConsultationId = signal<number | null>(null);

  // Delete Confirmation Modal State
  confirmDeleteOpen = signal<boolean>(false);
  deletingReviewId = signal<number | null>(null);
  deletingTargetName = signal<string>('');

  // Computed Consultation Options for Review Modal
  consultationOptions = computed<ConsultationOption[]>(() => {
    return this.consultations().map(c => ({
      id: c.id,
      lawyerName: (c as any).lawyer?.fullName || (c as any).lawyerName || 'Advocate',
      status: c.status,
      date: (c as any).createdAt
    }));
  });

  // Consultations that have not yet been reviewed by the client
  unreviewedConsultations = computed(() => {
    const list = this.consultations();
    const existing = this.rawReviews();
    return list.filter(c => {
      const lawyerName = ((c as any).lawyer?.fullName || (c as any).lawyerName || '').toLowerCase().trim();
      if (!lawyerName) return false;
      const alreadyReviewed = existing.some(r =>
        (r.consultationId && r.consultationId === c.id) ||
        (r.targetName && r.targetName.toLowerCase().trim().includes(lawyerName))
      );
      return !alreadyReviewed;
    });
  });

  // Alert Dismissal State
  dismissPendingAlert = signal<boolean>(false);

  firstUnreviewed = computed<ConsultationOption | null>(() => {
    if (this.dismissPendingAlert()) return null;
    const list = this.unreviewedConsultations();
    if (!list.length) return null;
    const c = list[0];
    return {
      id: c.id,
      lawyerName: (c as any).lawyer?.fullName || (c as any).lawyerName || 'Advocate',
      status: c.status,
      date: (c as any).createdAt
    };
  });

  // Computed KPIs
  totalReviews = computed(() => this.rawReviews().length);

  averageRating = computed(() => {
    const list = this.rawReviews();
    if (!list.length) return '0.0';
    const sum = list.reduce((acc, r) => acc + (r.rating || 0), 0);
    return (sum / list.length).toFixed(1);
  });

  approvedCount = computed(() =>
    this.rawReviews().filter(r => r.moderationStatus === 'Approved').length
  );

  pendingCount = computed(() =>
    this.rawReviews().filter(r => !r.moderationStatus || r.moderationStatus === 'Pending' || r.moderationStatus === 'Under Review').length
  );

  flaggedCount = computed(() =>
    this.rawReviews().filter(r => r.moderationStatus === 'Flagged').length
  );

  verifiedCount = computed(() =>
    this.rawReviews().filter(r => r.isVerifiedClient || !!r.consultationId).length
  );

  // Computed Filtered List
  filteredReviews = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();

    return this.rawReviews().filter(rev => {
      // Match query in targetName or content
      const matchesQuery = !query ||
        (rev.targetName && rev.targetName.toLowerCase().includes(query)) ||
        (rev.content && rev.content.toLowerCase().includes(query));

      if (!matchesQuery) return false;

      // Match status
      if (status === 'ALL') return true;
      if (status === 'Approved') return rev.moderationStatus === 'Approved';
      if (status === 'Pending') return !rev.moderationStatus || rev.moderationStatus === 'Pending' || rev.moderationStatus === 'Under Review';
      if (status === 'Flagged') return rev.moderationStatus === 'Flagged';
      return true;
    });
  });

  // Actions
  openNewReviewModal(targetName?: string, consultationId?: number) {
    this.editingReview.set(null);
    this.initialTargetName.set(targetName || '');
    this.initialConsultationId.set(consultationId || null);
    this.showWriteModal.set(true);
  }

  openEditReviewModal(review: ReviewItem) {
    this.editingReview.set(review);
    this.initialTargetName.set(review.targetName || '');
    this.initialConsultationId.set(review.consultationId || null);
    this.showWriteModal.set(true);
  }

  closeWriteModal() {
    this.showWriteModal.set(false);
    this.editingReview.set(null);
    this.initialConsultationId.set(null);
  }

  exportReviews(format: 'csv' | 'json') {
    const list = this.rawReviews();
    if (!list.length) {
      this.snackbar.show('No reviews available to export.', 'info');
      return;
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      const headers = ['ID', 'Target Advocate', 'Rating', 'Content', 'Status', 'Verified Consultation ID', 'Submitted Date'];
      const rows = list.map(r => [
        r.id || '',
        `"${(r.targetName || '').replace(/"/g, '""')}"`,
        r.rating,
        `"${(r.content || '').replace(/"/g, '""')}"`,
        `"${r.moderationStatus || 'Approved'}"`,
        r.consultationId || '',
        `"${r.createdAt || ''}"`
      ]);
      const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      this.dataExportService.downloadBlob(csvContent, 'text/csv;charset=utf-8;', `legalconnect-reviews-${timestamp}.csv`);
      this.snackbar.show('Consultation reviews exported to CSV.', 'success');
    } else {
      const jsonContent = JSON.stringify(list, null, 2);
      this.dataExportService.downloadBlob(jsonContent, 'application/json;charset=utf-8;', `legalconnect-reviews-${timestamp}.json`);
      this.snackbar.show('Consultation reviews exported to JSON.', 'success');
    }
  }

  onReviewSaved(savedReview: ReviewItem) {
    this.closeWriteModal();
    this.refreshReviews.emit();
  }

  requestDeleteReview(review: ReviewItem) {
    if (!review.id) return;
    this.deletingReviewId.set(review.id);
    this.deletingTargetName.set(review.targetName || 'Advocate');
    this.confirmDeleteOpen.set(true);
  }

  executeDelete() {
    const id = this.deletingReviewId();
    if (!id) return;

    this.reviewService.deleteReview(id).subscribe({
      next: () => {
        this.snackbar.show('Review deleted successfully.', 'info');
        this.confirmDeleteOpen.set(false);
        this.deletingReviewId.set(null);
        this.refreshReviews.emit();
      },
      error: (err) => {
        this.snackbar.show(err.error?.message || 'Failed to delete review.', 'error');
        this.confirmDeleteOpen.set(false);
        this.deletingReviewId.set(null);
      }
    });
  }

  cancelDelete() {
    this.confirmDeleteOpen.set(false);
    this.deletingReviewId.set(null);
  }

  skeletonCards = [1, 2, 3, 4];

  trackByReviewId(index: number, item: ReviewItem): number | string {
    return item.id || index;
  }

  trackByNumber(index: number, item: number): number {
    return item || index;
  }

  onRefresh() {
    this.refreshReviews.emit();
    this.snackbar.show('Consultation feedback synchronized.', 'info');
  }

  setFilter(filter: FeedbackStatusFilter) {
    this.statusFilter.set(filter);
  }

  clearSearch() {
    this.searchQuery.set('');
  }
}