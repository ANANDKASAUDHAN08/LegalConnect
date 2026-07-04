import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { SavedItemsService } from '../../../../services/saved-items.service';

@Component({
  selector: 'app-helpline-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './helpline-card.component.html',
  styles: [`:host { display: block; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HelplineCardComponent {
  @Input() helpline: any;

  @Output() share = new EventEmitter<any>();
  @Output() showQr = new EventEmitter<any>();

  // Reactive saved state — uses MongoDB _id string
  isSaved = computed(() => this.helpline?._id ? this.savedItems.isSavedHelpline(this.helpline._id) : false);

  constructor(private savedItems: SavedItemsService) {}

  onSaveClick(event: Event) {
    event.stopPropagation();
    if (this.helpline?._id) {
      this.savedItems.toggleHelpline(this.helpline._id, this.helpline.name);
    }
  }
}