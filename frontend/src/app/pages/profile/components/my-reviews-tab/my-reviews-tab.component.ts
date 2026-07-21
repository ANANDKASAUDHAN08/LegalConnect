import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LawyerService } from '../../../../services/lawyer.service';
import { ReviewService } from '../../../../services/review.service';
import { UserProfile } from '../../../../services/auth.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { ConfirmDialogComponent } from '../../../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-my-reviews-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  templateUrl: './my-reviews-tab.component.html'
})
export class MyReviewsTabComponent implements OnInit, OnDestroy {
  // Modal Dialog variables
  isConfirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'warning' | 'info' = 'warning';
  onConfirmAction: (() => void) | null = null;

  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.onConfirmAction = action;
    this.isConfirmOpen = true;
  }

  onConfirmDialog() {
    this.isConfirmOpen = false;
    if (this.onConfirmAction) {
      this.onConfirmAction();
    }
  }

  onCancelDialog() {
    this.isConfirmOpen = false;
    this.onConfirmAction = null;
  }

  @Input() profile!: UserProfile;
  @Output() reviewUpdated = new EventEmitter<void>();

  reviews: any[] = [];
  loading = true;

  // Edit Review Modal state
  editingReview: any = null;
  editRating = 5;
  editContent = '';
  savingEdit = false;
  deletingReview = false;

  constructor(
    private lawyerService: LawyerService,
    private reviewService: ReviewService,
    private snackbar: SnackbarService
  ) { }

  ngOnInit() {
    this.loadReviews();
  }

  ngOnDestroy() {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  loadReviews() {
    this.loading = true;
    this.lawyerService.getMyReviews().subscribe({
      next: (res) => {
        this.reviews = res;
        this.loading = false;
      },
      error: () => {
        this.snackbar.show('Failed to fetch reviews.', 'error');
        this.loading = false;
      }
    });
  }

  openEditModal(review: any) {
    this.editingReview = { ...review };
    this.editRating = review.rating;
    this.editContent = review.content;
    if (typeof document !== 'undefined') {
      document.body.classList.add('overflow-hidden');
    }
  }

  closeEditModal() {
    this.editingReview = null;
    this.editContent = '';
    this.editRating = 5;
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  saveReview() {
    if (!this.editingReview) return;
    if (!this.editContent.trim()) {
      this.snackbar.show('Please enter your review text.', 'warning');
      return;
    }

    this.savingEdit = true;
    this.reviewService.updateReview(this.editingReview.id, {
      rating: this.editRating,
      content: this.editContent.trim(),
      targetName: this.editingReview.targetName
    }).subscribe({
      next: () => {
        this.snackbar.show('Review updated successfully!', 'success');
        this.loadReviews();
        this.closeEditModal();
        this.reviewUpdated.emit();
        this.savingEdit = false;
      },
      error: (err) => {
        this.snackbar.show(err.error || 'Failed to update review.', 'error');
        this.savingEdit = false;
      }
    });
  }

  deleteReview(id: number) {
    this.triggerConfirm(
      'Delete Review Feedback',
      'Are you sure you want to delete this review? This action cannot be undone and will permanently remove your feedback.',
      'danger',
      () => {
        this.deletingReview = true;
        this.reviewService.deleteReview(id).subscribe({
          next: () => {
            this.snackbar.show('Review deleted successfully.', 'success');
            this.loadReviews();
            this.closeEditModal();
            this.reviewUpdated.emit();
            this.deletingReview = false;
          },
          error: (err) => {
            this.snackbar.show(err.error || 'Failed to delete review.', 'error');
            this.deletingReview = false;
          }
        });
      }
    );
  }

  getStars(rating: number): number[] {
    return Array(rating).fill(0);
  }

  getEmptyStars(rating: number): number[] {
    return Array(5 - rating).fill(0);
  }
}