import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { SnackbarService } from '../../services/snackbar.service';
import { ShareMenuComponent } from '../share-menu/share-menu.component';

export interface QuickChip {
  text: string;
  category: 'client' | 'lawyer';
}

export const clientChips: QuickChip[] = [
  { text: 'Vetted Professional', category: 'client' },
  { text: 'Fast Response', category: 'client' },
  { text: 'Clear Communication', category: 'client' },
  { text: 'Highly Recommend', category: 'client' },
  { text: 'Strong Advocate', category: 'client' },
  { text: 'Outstanding Service', category: 'client' }
];

export const lawyerChips: QuickChip[] = [
  { text: 'Streamlined Inbox', category: 'lawyer' },
  { text: 'Great BNS Search', category: 'lawyer' },
  { text: 'Easy Case Manager', category: 'lawyer' },
  { text: 'Practice Growth', category: 'lawyer' },
  { text: 'Modern Workspace', category: 'lawyer' },
  { text: 'Highly Efficient', category: 'lawyer' }
];

export function formatReviewContent(content: string): string {
  return content || '';
}

@Component({
  selector: 'app-review-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective, ShareMenuComponent],
  templateUrl: './review-card.component.html',
  styleUrls: ['./review-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReviewCardComponent implements OnInit, OnChanges {
  @Input() review!: any;
  @Input() currentUser!: any;
  @Input() showReadMore = false;
  @Input() highlightGlow = false;

  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();
  @Output() like = new EventEmitter<any>();
  @Output() readMore = new EventEmitter<any>();
  @Output() report = new EventEmitter<any>();
  @Output() dispute = new EventEmitter<any>();
  @Output() share = new EventEmitter<any>();

  readonly starArray = [1, 2, 3, 4, 5];

  trackByNumber(index: number, item: number): number {
    return item || index;
  }

  hasLiked = false;
  formattedContent = '';
  isTargetLawyer = false;
  formattedEditDate = '';
  reviewShareUrl = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private snackbar: SnackbarService
  ) { }

  ngOnInit() {
    if (this.review?.id) {
      this.hasLiked = localStorage.getItem(`liked_review_${this.review.id}`) === 'true';
    }
    this.updateFormattedContent();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['review'] || changes['currentUser']) {
      this.updateFormattedContent();
      this.cdr.markForCheck();
    }
  }

  private updateFormattedContent() {
    if (this.review) {
      let text = this.review.redactedContent || this.review.content || '';
      // Strip any [REDACTED ...] tags seamlessly for clean display
      text = text.replace(/\[REDACTED[^\]]*\]/gi, '').replace(/\s+/g, ' ').replace(/\s+([,\.\?!])/g, '$1').trim();
      this.formattedContent = text;

      const normalize = (s?: string) => (s || '').replace(/^adv\.?\s+/i, '').trim().toLowerCase();
      const uNorm = normalize(this.currentUser?.fullName);
      const tNorm = normalize(this.review?.targetName);
      const lNorm = normalize(this.review?.lawyerName);

      this.isTargetLawyer = !!(
        this.currentUser &&
        this.currentUser.role === 'Lawyer' &&
        uNorm &&
        (uNorm === tNorm || uNorm === lNorm)
      );

      const isAuthorEdit = !!(this.review.lastEditedAt && this.review.originalContent && !this.review.redactedContent);
      this.formattedEditDate = isAuthorEdit ? 'Edited on ' + new Date(this.review.lastEditedAt).toLocaleDateString() : '';
      this.reviewShareUrl = (typeof window !== 'undefined' && this.review.id) ? `${window.location.origin}${window.location.pathname}#review-${this.review.id}` : '';
    }
  }

  onLike() {
    this.like.emit(this.review);
    this.hasLiked = !this.hasLiked;
    this.cdr.markForCheck();
  }

  onShare(event: MouseEvent) {
    event.stopPropagation();
    if (!this.review?.id) return;
    const url = this.reviewShareUrl;
    navigator.clipboard.writeText(url).then(() => {
      this.snackbar.show('Review link copied to clipboard!', 'info');
    }).catch(() => {
      this.snackbar.show('Failed to copy link.', 'error');
    });
    this.share.emit(this.review);
  }
}