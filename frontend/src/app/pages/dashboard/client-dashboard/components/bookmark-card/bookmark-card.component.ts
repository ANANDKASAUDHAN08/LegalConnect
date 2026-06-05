import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Bookmark } from '../../../../../services/bookmark.service';
import { Consultation } from '../../../../../services/lawyer.service';

@Component({
  selector: 'app-bookmark-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bookmark-card.component.html',
  styleUrls: ['./bookmark-card.component.scss']
})
export class BookmarkCardComponent {
  @Input() bookmark!: Bookmark;
  @Input() inquiries: Consultation[] = [];

  @Output() cardClicked = new EventEmitter<Bookmark>();
  @Output() removeClicked = new EventEmitter<{ actShortName: string, sectionNumber: string }>();
  @Output() copyClicked = new EventEmitter<Bookmark>();
  @Output() shareClicked = new EventEmitter<Bookmark>();

  onCardClick() {
    this.cardClicked.emit(this.bookmark);
  }

  onRemove(event: Event) {
    event.stopPropagation();
    this.removeClicked.emit({
      actShortName: this.bookmark.actShortName,
      sectionNumber: this.bookmark.section.section_number
    });
  }

  onCopy(event: Event) {
    event.stopPropagation();
    this.copyClicked.emit(this.bookmark);
  }

  onShare(event: Event) {
    event.stopPropagation();
    this.shareClicked.emit(this.bookmark);
  }
}
