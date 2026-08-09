import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewService, ReviewItem } from '../../services/review.service';
import { UserProfile } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';

interface QuickChip {
  text: string;
}

@Component({
  selector: 'app-write-review-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './write-review-modal.component.html',
  styleUrls: ['./write-review-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WriteReviewModalComponent implements OnInit, OnDestroy {
  @Input() currentUser: UserProfile | null = null;
  @Input() reviewToEdit: ReviewItem | null = null;
  @Input() navbarHeight = 68;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<ReviewItem>();

  readonly starArray = [1, 2, 3, 4, 5];

  trackByNumber(index: number, item: number): number {
    return item || index;
  }

  trackByChipText(index: number, item: any): string {
    return item?.text || index.toString();
  }

  rating = 5;
  hoverRating = 0;
  content = '';
  targetName = 'Platform';
  authorName = '';
  isSubmitting = false;

  get currentDisplayRating(): number {
    return this.hoverRating > 0 ? this.hoverRating : this.rating;
  }

  get isMobile(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 640;
  }

  clientChips: QuickChip[] = [
    { text: 'Vetted Professional' },
    { text: 'Fast Response' },
    { text: 'Clear Communication' },
    { text: 'Highly Recommend' },
    { text: 'Strong Advocate' },
    { text: 'Outstanding Service' }
  ];

  lawyerChips: QuickChip[] = [
    { text: 'Streamlined Inbox' },
    { text: 'Great BNS Search' },
    { text: 'Easy Case Manager' },
    { text: 'Practice Growth' },
    { text: 'Modern Workspace' },
    { text: 'Highly Efficient' }
  ];

  constructor(
    private reviewService: ReviewService,
    private snackbar: SnackbarService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    if (typeof document !== 'undefined') {
      document.body.classList.add('overflow-hidden', 'mobile-drawer-open');
    }
    if (this.reviewToEdit) {
      this.rating = this.reviewToEdit.rating;
      this.content = this.reviewToEdit.content;
      this.targetName = this.reviewToEdit.targetName;
      this.authorName = this.reviewToEdit.authorName;
    }
  }

  ngOnDestroy() {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden', 'mobile-drawer-open');
    }
  }

  get modalTitle(): string {
    return this.reviewToEdit !== null ? 'Update Your Review' : 'Write a Review';
  }

  get currentChips(): QuickChip[] {
    if (this.currentUser && this.currentUser.role === 'Lawyer') {
      return this.lawyerChips;
    }
    return this.clientChips;
  }

  setRating(stars: number) {
    if (!this.isSubmitting) {
      this.rating = stars;
      this.cdr.markForCheck();
    }
  }

  toggleChip(chip: QuickChip) {
    if (this.isSubmitting) return;

    if (this.content.includes(chip.text)) {
      const regex = new RegExp(this.escapeRegExp(chip.text) + '[,\\s]*', 'g');
      this.content = this.content.replace(regex, '').trim();
      if (this.content.endsWith(',')) {
        this.content = this.content.slice(0, -1).trim();
      }
    } else {
      if (this.content.trim()) {
        const endsWithWord = /[a-zA-Z0-9]$/.test(this.content.trim());
        this.content = this.content.trim() + (endsWithWord ? ', ' : ' ') + chip.text;
      } else {
        this.content = chip.text;
      }
    }
    this.cdr.markForCheck();
  }

  isChipActive(chip: QuickChip): boolean {
    return this.content.includes(chip.text);
  }

  private escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  onCancel() {
    this.close.emit();
  }

  onSubmit() {
    if (this.isSubmitting) return;

    if (this.rating < 1 || this.rating > 5) {
      this.snackbar.show('Please choose a rating between 1 and 5 stars.', 'warning');
      return;
    }

    const commentText = this.content.trim();
    if (commentText.length < 10) {
      this.snackbar.show('Please enter a review comment of at least 10 characters.', 'warning');
      return;
    }

    this.isSubmitting = true;
    this.cdr.markForCheck();

    const payload: any = {
      rating: this.rating,
      content: this.content.trim(),
      targetName: this.targetName.trim()
    };

    if (!this.currentUser) {
      payload.authorName = this.authorName.trim() || 'Anonymous Guest';
    }

    if (this.reviewToEdit && this.reviewToEdit.id) {
      this.reviewService.updateReview(this.reviewToEdit.id, payload).subscribe({
        next: (updatedReview) => {
          this.isSubmitting = false;
          this.saved.emit(updatedReview);
          this.close.emit();
          this.snackbar.show('Your review has been updated successfully.', 'success');
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.snackbar.show(err.error?.message || err.error || 'Failed to update review. Please try again.', 'error');
          this.cdr.markForCheck();
        }
      });
    } else {
      this.reviewService.submitReview(payload).subscribe({
        next: (newReview) => {
          this.isSubmitting = false;
          this.saved.emit(newReview);
          this.close.emit();
          this.snackbar.show('Thank you! Your review has been submitted successfully.', 'success');
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.snackbar.show(err.error?.message || err.error || 'Failed to submit review. Please try again.', 'error');
          this.cdr.markForCheck();
        }
      });
    }
  }
}
