import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TooltipDirective } from '../../directives/tooltip.directive';
import { SavedItemsService } from '../../services/saved-items.service';

@Component({
  selector: 'app-lawyer-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './lawyer-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'block',
    'style': 'height: 100%'
  }
})
export class LawyerCardComponent implements OnInit {
  @Input() lawyer: any;
  @Input() viewMode: 'grid' | 'list' = 'grid';
  @Input() showActions = true; // default true — always show actions bar
  @Input() loading = false;

  @Output() cardClick = new EventEmitter<string>();
  @Output() avatarClick = new EventEmitter<string>();
  @Output() specializationClick = new EventEmitter<string>();
  @Output() bookmarkClick = new EventEmitter<string>(); // kept for backwards compat
  @Output() messageClick = new EventEmitter<string>();
  @Output() bookClick = new EventEmitter<string>();

  isMobile = false;

  // Reactive saved state — auto-updates across the page
  isSaved = computed(() => this.savedItems.isSavedLawyer(this.lawyer?._id));

  constructor(private savedItems: SavedItemsService) {}

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
    this.savedItems.toggleLawyer(this.lawyer._id, this.lawyer.name);
    this.bookmarkClick.emit(this.lawyer._id); // backwards compat
  }

  onMessageClick(event: Event) {
    event.stopPropagation();
    this.messageClick.emit(this.lawyer._id);
  }

  onBookClick(event: Event) {
    event.stopPropagation();
    this.bookClick.emit(this.lawyer._id);
  }

  onCardClick(event: Event) {
    // Navigate to details only if click was not on a button, tag, or avatar which already handle their clicks and stopPropagation
    this.cardClick.emit(this.lawyer._id);
  }
}