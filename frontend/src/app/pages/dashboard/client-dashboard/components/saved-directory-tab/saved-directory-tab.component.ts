import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';
import { SavedItemsService } from '../../../../../services/saved-items.service';

@Component({
  selector: 'app-saved-directory-tab',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective],
  templateUrl: './saved-directory-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SavedDirectoryTabComponent {
  @Input() savedLawyersDetails: any[] = [];
  @Input() savedResourcesDetails: any[] = [];
  @Input() savedHelplinesDetails: any[] = [];

  @Output() openDrawer = new EventEmitter<{ type: 'lawyer' | 'resource' | 'helpline'; data: any }>();

  constructor(public savedItemsService: SavedItemsService) { }

  trackById(index: number, item: any): string {
    return item._id || index.toString();
  }
}