import { Component, OnInit, OnDestroy, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ReviewService, ReviewItem } from '../../services/review.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { WriteReviewModalComponent } from '../../components/write-review-modal/write-review-modal.component';
import { ReviewCardComponent } from '../../components/review-card/review-card.component';
import { ConfirmDialogComponent } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, WriteReviewModalComponent, ReviewCardComponent, ConfirmDialogComponent],
  templateUrl: './reviews.component.html',
  styleUrls: ['./reviews.component.scss']
})
export class ReviewsComponent implements OnInit, OnDestroy, AfterViewInit {
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

  currentUser: UserProfile | null = null;
  allReviews: ReviewItem[] = [];
  filteredReviews: ReviewItem[] = [];

  // Pagination
  pageSize = 12;
  currentPage = 1;
  totalPages = 1;
  paginatedReviews: ReviewItem[] = [];

  // Filters
  searchText = '';
  roleFilter = 'all'; // 'all', 'Client', 'Lawyer'
  ratingFilter = 'all'; // 'all', '5', '4', '3', '2', '1'

  showRatingDropdown = false;
  ratingOptions = [
    { value: 'all', label: 'All Ratings' },
    { value: '5', label: '5 Stars', stars: '★★★★★' },
    { value: '4', label: '4 Stars', stars: '★★★★' },
    { value: '3', label: '3 Stars', stars: '★★★' },
    { value: '2', label: '2 Stars', stars: '★★' },
    { value: '1', label: '1 Star', stars: '★' }
  ];

  getSelectedRating(): string {
    const opt = this.ratingOptions.find(o => o.value === this.ratingFilter);
    if (!opt) return 'All Ratings';
    return opt.stars ? `${opt.stars} (${opt.value}★)` : opt.label;
  }

  // Modal State for Writing/Editing Review
  showWriteModal = false;
  editModeReview: ReviewItem | null = null;
  navbarHeight = 68;

  highlightedReviewId: number | null = null;

  get isMobile(): boolean {
    return window.innerWidth < 640;
  }

  updatePageSize() {
    const isMobile = window.innerWidth < 640;
    const newPageSize = isMobile ? 10 : 12;
    if (this.pageSize !== newPageSize) {
      this.pageSize = newPageSize;
      this.currentPage = 1;
    }
  }

  updatePaginatedReviews() {
    this.totalPages = Math.ceil(this.filteredReviews.length / this.pageSize) || 1;
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.paginatedReviews = this.filteredReviews.slice(start, end);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedReviews();
      const gridElement = document.querySelector('.reviews-grid-container');
      if (gridElement) {
        gridElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.goToPage(this.currentPage + 1);
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.goToPage(this.currentPage - 1);
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  @HostListener('window:resize')
  onResize() {
    this.updatePageSize();
    this.updatePaginatedReviews();
    if (this.showWriteModal) {
      this.updateNavbarHeight();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.rating-dropdown-container')) {
      this.showRatingDropdown = false;
    }
  }

  constructor(
    private reviewService: ReviewService,
    private auth: AuthService,
    private snackbar: SnackbarService,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.updatePageSize();
    this.auth.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
    this.loadReviews();
  }

  ngAfterViewInit() {
    this.route.fragment.subscribe(frag => {
      if (frag && frag.startsWith('review-')) {
        const id = parseInt(frag.replace('review-', ''), 10);
        if (!isNaN(id)) {
          this.highlightedReviewId = id;
          this.goToReviewPageAndScroll(id, frag);
        }
      }
    });
  }

  goToReviewPageAndScroll(reviewId: number, fragment: string) {
    const checkAndScroll = () => {
      if (this.allReviews.length > 0) {
        const index = this.filteredReviews.findIndex(r => r.id === reviewId);
        if (index !== -1) {
          const page = Math.floor(index / this.pageSize) + 1;
          this.currentPage = page;
          this.updatePaginatedReviews();
          this.scrollToReview(fragment);
        }
      } else {
        setTimeout(checkAndScroll, 100);
      }
    };
    checkAndScroll();
  }

  ngOnDestroy() {
    document.body.classList.remove('overflow-hidden');
  }

  loadReviews() {
    this.reviewService.getReviews().subscribe({
      next: (data) => {
        this.allReviews = data;
        this.applyFilters();
      },
      error: (err) => {
        console.error('Failed to load reviews', err);
        this.snackbar.show('Failed to fetch reviews.', 'error');
      }
    });
  }

  applyFilters() {
    this.filteredReviews = this.allReviews.filter(rev => {
      // Role filter
      if (this.roleFilter !== 'all') {
        if (this.roleFilter === 'Client' && rev.userRole !== 'Client' && rev.userRole !== 'Guest') {
          return false;
        }
        if (this.roleFilter === 'Lawyer' && rev.userRole !== 'Lawyer') {
          return false;
        }
      }

      // Rating filter
      if (this.ratingFilter !== 'all') {
        if (rev.rating.toString() !== this.ratingFilter) {
          return false;
        }
      }

      // Search query
      if (this.searchText.trim()) {
        const query = this.searchText.toLowerCase().trim();
        const contentMatch = rev.content.toLowerCase().includes(query);
        const authorMatch = rev.authorName.toLowerCase().includes(query);
        const targetMatch = rev.targetName.toLowerCase().includes(query);
        const roleMatch = rev.userRole.toLowerCase().includes(query);
        if (!contentMatch && !authorMatch && !targetMatch && !roleMatch) {
          return false;
        }
      }

      return true;
    });

    this.currentPage = 1;
    this.updatePaginatedReviews();
  }

  scrollToReview(elementId: string) {
    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          this.highlightedReviewId = null;
        }, 3500);
      }
    }, 100);
  }

  // Liking Reviews
  hasLiked(reviewId: number): boolean {
    if (!reviewId) return false;
    return localStorage.getItem(`liked_review_${reviewId}`) === 'true';
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

  // Modals / Creating / Editing
  openWriteModal() {
    this.updateNavbarHeight();
    this.editModeReview = null;
    this.showWriteModal = true;
    document.body.classList.add('overflow-hidden');
  }

  openEditModal(review: ReviewItem) {
    this.updateNavbarHeight();
    this.editModeReview = review;
    this.showWriteModal = true;
    document.body.classList.add('overflow-hidden');
  }

  closeWriteModal() {
    this.showWriteModal = false;
    document.body.classList.remove('overflow-hidden');
  }

  onReviewSaved(savedReview: ReviewItem) {
    const idx = this.allReviews.findIndex(r => r.id === savedReview.id);
    if (idx !== -1) {
      this.allReviews[idx] = savedReview;
    } else {
      this.allReviews.unshift(savedReview);
    }
    this.applyFilters();
  }

  private updateNavbarHeight() {
    const nav = document.querySelector('nav');
    if (nav) {
      this.navbarHeight = nav.offsetHeight;
    }
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
            this.applyFilters();
            this.snackbar.show('Review deleted successfully.', 'info');
          },
          error: (err) => {
            console.error('Failed to delete review', err);
            this.snackbar.show('Failed to delete review.', 'error');
          }
        });
      }
    );
  }
}