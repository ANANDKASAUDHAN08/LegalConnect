import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-lawyer-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lawyer-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'block'
  }
})
export class LawyerCardComponent implements OnInit {
  @Input() lawyer: any;
  @Input() viewMode: 'grid' | 'list' = 'grid';
  @Input() showActions = false;

  @Output() avatarClick = new EventEmitter<string>();
  @Output() specializationClick = new EventEmitter<string>();
  @Output() bookmarkClick = new EventEmitter<string>();
  @Output() messageClick = new EventEmitter<string>();
  @Output() bookClick = new EventEmitter<string>();

  isMobile = false;

  ngOnInit() {
    this.checkMobile();
  }

  @HostListener('window:resize', [])
  onResize() {
    this.checkMobile();
  }

  private checkMobile() {
    this.isMobile = window.innerWidth < 768;
  }

  getInitials(name: string): string {
    return name.replace('Adv. ', '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  onAvatarClick(event: Event) {
    event.stopPropagation();
    if (this.lawyer.avatarUrl) {
      this.avatarClick.emit(this.lawyer.avatarUrl);
    }
  }

  onSpecializationClick(spec: string, event: Event) {
    event.stopPropagation();
    this.specializationClick.emit(spec);
  }

  onBookmarkClick(event: Event) {
    event.stopPropagation();
    this.bookmarkClick.emit(this.lawyer._id);
  }

  onMessageClick(event: Event) {
    event.stopPropagation();
    this.messageClick.emit(this.lawyer._id);
  }

  onBookClick(event: Event) {
    event.stopPropagation();
    this.bookClick.emit(this.lawyer._id);
  }
}