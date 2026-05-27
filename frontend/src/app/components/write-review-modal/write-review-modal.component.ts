import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewService, ReviewItem } from '../../services/review.service';
import { UserProfile } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';

interface QuickChip {
  emoji: string;
  text: string;
}

@Component({
  selector: 'app-write-review-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './write-review-modal.component.html',
  styleUrls: ['./write-review-modal.component.scss']
})
export class WriteReviewModalComponent implements OnInit {
  @Input() currentUser: UserProfile | null = null;
  @Input() reviewToEdit: ReviewItem | null = null;
  @Input() navbarHeight = 68;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<ReviewItem>();

  rating = 5;
  content = '';
  targetName = 'Platform';
  authorName = '';
  isSubmitting = false;

  get isMobile(): boolean {
    return window.innerWidth < 640;
  }

  clientChips: QuickChip[] = [
    { emoji: '⚖️', text: 'Vetted Professional' },
    { emoji: '⚡', text: 'Fast Response' },
    { emoji: '🧠', text: 'Super Helpful AI' },
    { emoji: '💬', text: 'Clear Communication' },
    { emoji: '🤝', text: 'Highly Recommend' },
    { emoji: '🛡️', text: 'Strong Advocate' },
    { emoji: '⭐', text: 'Outstanding Service' }
  ];

  lawyerChips: QuickChip[] = [
    { emoji: '📊', text: 'Streamlined Inbox' },
    { emoji: '🔎', text: 'Great BNS Search' },
    { emoji: '📁', text: 'Easy Case Manager' },
    { emoji: '💼', text: 'Practice Growth' },
    { emoji: '💻', text: 'Modern Workspace' },
    { emoji: '⚙️', text: 'Highly Efficient' },
    { emoji: '📈', text: 'Network Booster' }
  ];

  constructor(
    private reviewService: ReviewService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit() {
    if (this.reviewToEdit) {
      this.rating = this.reviewToEdit.rating;
      this.content = this.reviewToEdit.content;
      this.targetName = this.reviewToEdit.targetName;
      this.authorName = this.reviewToEdit.authorName;
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
        },
        error: (err) => {
          this.isSubmitting = false;
          this.snackbar.show(err.error || 'Failed to update review. Please try again.', 'error');
        }
      });
    } else {
      this.reviewService.submitReview(payload).subscribe({
        next: (newReview) => {
          this.isSubmitting = false;
          this.saved.emit(newReview);
          this.close.emit();
          this.snackbar.show('Thank you! Your review has been submitted successfully.', 'success');
        },
        error: (err) => {
          this.isSubmitting = false;
          this.snackbar.show(err.error || 'Failed to submit review. Please try again.', 'error');
        }
      });
    }
  }
}
