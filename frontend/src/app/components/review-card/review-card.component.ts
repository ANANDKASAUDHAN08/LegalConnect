import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export const clientChips = [
  { emoji: '⚖️', text: 'Vetted Professional' },
  { emoji: '⚡', text: 'Fast Response' },
  { emoji: '🧠', text: 'Super Helpful AI' },
  { emoji: '💬', text: 'Clear Communication' },
  { emoji: '🤝', text: 'Highly Recommend' },
  { emoji: '🛡️', text: 'Strong Advocate' },
  { emoji: '⭐', text: 'Outstanding Service' }
];

export const lawyerChips = [
  { emoji: '📊', text: 'Streamlined Inbox' },
  { emoji: '🔎', text: 'Great BNS Search' },
  { emoji: '📁', text: 'Easy Case Manager' },
  { emoji: '💼', text: 'Practice Growth' },
  { emoji: '💻', text: 'Modern Workspace' },
  { emoji: '⚙️', text: 'Highly Efficient' },
  { emoji: '📈', text: 'Network Booster' }
];

export function formatReviewContent(content: string): string {
  if (!content) return '';
  let formatted = content;
  const allChips = [...clientChips, ...lawyerChips];
  for (const chip of allChips) {
    const withEmoji = `${chip.emoji} ${chip.text}`;
    if (formatted.includes(chip.text) && !formatted.includes(withEmoji)) {
      const regex = new RegExp(`(?<!${escapeRegExp(chip.emoji)}\\s*)${escapeRegExp(chip.text)}`, 'g');
      formatted = formatted.replace(regex, withEmoji);
    }
  }
  return formatted;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Component({
  selector: 'app-review-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './review-card.component.html',
  styleUrls: ['./review-card.component.scss']
})
export class ReviewCardComponent implements OnInit {
  @Input() review!: any;
  @Input() currentUser!: any;
  @Input() showReadMore = false;
  @Input() highlightGlow = false;

  @Output() edit = new EventEmitter<any>();
  @Output() delete = new EventEmitter<any>();
  @Output() like = new EventEmitter<any>();
  @Output() readMore = new EventEmitter<any>();

  hasLiked = false;

  ngOnInit() {
    if (this.review?.id) {
      this.hasLiked = localStorage.getItem(`liked_review_${this.review.id}`) === 'true';
    }
  }

  getFormattedContent(content: string): string {
    return formatReviewContent(content);
  }

  onLike() {
    this.like.emit(this.review);
    this.hasLiked = !this.hasLiked;
  }
}
