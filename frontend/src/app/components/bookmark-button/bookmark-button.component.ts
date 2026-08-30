import {
  Component, Input, ChangeDetectionStrategy, inject, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { UniversalBookmarkService } from '../../services/universal-bookmark.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../icon/icon.component';

/**
 * <app-bookmark-button> — Universal Bookmark/Save Button
 *
 * Zero-configuration: injects UniversalBookmarkService and reads saved state from signal store.
 *
 * Usage:
 *   <app-bookmark-button targetType="Lawyer" [targetId]="lawyer.id" [title]="lawyer.name" />
 *   <app-bookmark-button targetType="LegalResource" [targetId]="resource._id" [title]="resource.title" variant="pill" />
 */
@Component({
  selector: 'app-bookmark-button',
  standalone: true,
  imports: [CommonModule, TooltipDirective, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bookmark-button.component.html',
  styleUrls: ['./bookmark-button.component.scss']
})
export class BookmarkButtonComponent {
  @Input({ required: true }) targetType!: string;
  @Input({ required: true }) targetId!: string;
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() collectionName?: string;
  @Input() metadataJson?: string;
  @Input() variant: 'icon' | 'pill' | 'button-with-text' = 'pill';
  @Input() size: 'sm' | 'md' | 'lg' = 'sm';

  private bookmarkService = inject(UniversalBookmarkService);

  isSaved = computed(() => {
    return this.bookmarkService.isSaved(this.targetType, this.targetId);
  });

  ariaLabel = computed(() => {
    return this.isSaved()
      ? `Remove ${this.title} from bookmarks`
      : `Save ${this.title} to bookmarks`;
  });

  tooltipText = computed(() => {
    return this.isSaved() ? 'Remove from saved' : 'Save to bookmarks';
  });

  buttonClasses = computed(() => {
    return `variant-${this.variant}`;
  });

  get iconPixelSize(): number {
    switch (this.size) {
      case 'sm': return 14;
      case 'md': return 16;
      case 'lg': return 18;
      default: return 14;
    }
  }

  onToggle(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.bookmarkService.toggleBookmark(
      this.targetType, this.targetId, this.title,
      this.subtitle, this.collectionName, this.metadataJson
    );
  }
}