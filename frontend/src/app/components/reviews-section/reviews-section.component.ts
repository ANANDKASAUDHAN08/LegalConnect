import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReviewService, ReviewItem } from '../../services/review.service';
import { UserProfile } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { WriteReviewModalComponent } from '../write-review-modal/write-review-modal.component';
import { ReviewCardComponent, formatReviewContent } from '../review-card/review-card.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

interface QuickChip {
  emoji: string;
  text: string;
}

@Component({
  selector: 'app-reviews-section',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, WriteReviewModalComponent, ReviewCardComponent, ConfirmDialogComponent],
  templateUrl: './reviews-section.component.html',
  styleUrls: ['./reviews-section.component.scss']
})
export class ReviewsSectionComponent implements OnInit, OnDestroy {
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

  @Input() currentUser: UserProfile | null = null;

  @ViewChild('carouselTrack') carouselTrack!: ElementRef<HTMLDivElement>;

  activeTab: 'client' | 'lawyer' = 'client';
  allReviews: ReviewItem[] = [];
  filteredReviews: ReviewItem[] = [];

  // Submission Form & Modal State
  private _showWriteModal = false;
  get showWriteModal(): boolean {
    return this._showWriteModal;
  }

  set showWriteModal(value: boolean) {
    this._showWriteModal = value;
    if (value) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }

  editModeReview: ReviewItem | null = null;
  navbarHeight = 68;

  showReadMoreModal = false;
  selectedReview: ReviewItem | null = null;

  get isMobile(): boolean {
    return window.innerWidth < 640;
  }

  @HostListener('window:resize')
  onResize() {
    if (this.showWriteModal || this.showReadMoreModal) {
      this.updateNavbarHeight();
    }
  }

  constructor(
    private reviewService: ReviewService,
    private snackbar: SnackbarService
  ) { }

  ngOnInit() {
    this.loadReviews();
  }

  ngOnDestroy() {
    document.body.classList.remove('overflow-hidden');
  }

  scrollCarousel(direction: number) {
    if (this.carouselTrack) {
      const track = this.carouselTrack.nativeElement;
      const scrollAmount = track.clientWidth * 0.8 * direction;
      track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  }

  loadReviews() {
    this.reviewService.getReviews().subscribe({
      next: (data) => {
        this.allReviews = data;
        this.filterReviews();
      },
      error: (err) => {
        console.error('Failed to load reviews', err);
      }
    });
  }

  filterReviews() {
    if (this.activeTab === 'client') {
      // Clients see client/guest reviews about matched lawyers or the platform
      this.filteredReviews = this.allReviews.filter(
        r => r.userRole === 'Client' || r.userRole === 'Guest'
      );
    } else {
      // Lawyers see lawyer reviews about the platform/workstation
      this.filteredReviews = this.allReviews.filter(
        r => r.userRole === 'Lawyer'
      );
    }
  }

  switchTab(tab: 'client' | 'lawyer') {
    this.activeTab = tab;
    this.filterReviews();
  }

  openWriteModal() {
    this.updateNavbarHeight();
    this.editModeReview = null;
    this.showWriteModal = true;
  }

  openEditModal(review: ReviewItem) {
    this.updateNavbarHeight();
    this.editModeReview = review;
    this.showWriteModal = true;
  }

  openReadMoreModal(review: ReviewItem) {
    this.updateNavbarHeight();
    this.selectedReview = review;
    this.showReadMoreModal = true;
    document.body.classList.add('overflow-hidden');
  }

  closeReadMoreModal() {
    this.selectedReview = null;
    this.showReadMoreModal = false;
    document.body.classList.remove('overflow-hidden');
  }

  onReviewSaved(savedReview: ReviewItem) {
    const idx = this.allReviews.findIndex(r => r.id === savedReview.id);
    if (idx !== -1) {
      this.allReviews[idx] = savedReview;
    } else {
      this.allReviews.unshift(savedReview);
    }
    this.filterReviews();
  }

  onDeleteReview(review: ReviewItem) {
    if (!review.id) return;
    this.triggerConfirm(
      'Delete Review',
      'Are you sure you want to delete this review? This action cannot be undone and will permanently remove your feedback.',
      'danger',
      () => {
        this.reviewService.deleteReview(review.id!).subscribe({
          next: () => {
            this.allReviews = this.allReviews.filter(r => r.id !== review.id);
            this.filterReviews();
            this.snackbar.show('Review deleted successfully.', 'info');
          },
          error: (err) => {
            console.error('Failed to delete review', err);
            this.snackbar.show(err.error || 'Failed to delete review. Please try again.', 'error');
          }
        });
      }
    );
  }

  private updateNavbarHeight() {
    const nav = document.querySelector('nav');
    if (nav) {
      this.navbarHeight = nav.offsetHeight;
    }
  }

  hasLiked(reviewId: number): boolean {
    if (!reviewId) return false;
    const liked = localStorage.getItem(`liked_review_${reviewId}`);
    return liked === 'true';
  }

  likeReview(review: ReviewItem) {
    if (!review.id) return;

    if (this.hasLiked(review.id)) {
      this.reviewService.unlikeReview(review.id).subscribe({
        next: (updatedReview) => {
          review.likes = updatedReview.likes;
          localStorage.removeItem(`liked_review_${review.id}`);
        },
        error: (err) => {
          console.error('Failed to unlike review', err);
        }
      });
    } else {
      this.reviewService.likeReview(review.id).subscribe({
        next: (updatedReview) => {
          review.likes = updatedReview.likes;
          localStorage.setItem(`liked_review_${review.id}`, 'true');
        },
        error: (err) => {
          console.error('Failed to like review', err);
        }
      });
    }
  }

  getFormattedContent(content: string): string {
    return formatReviewContent(content);
  }
}