import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';

@Component({
  selector: 'app-case-packs-tab',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective],
  templateUrl: './case-packs-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CasePacksTabComponent {
  @Input() savedCasePacks: any[] = [];
  @Input() isTabLoading = false;

  @Output() deletePack = new EventEmitter<any>();
  @Output() viewPack = new EventEmitter<any>();

  trackById(index: number, item: any): string {
    return item._id || index.toString();
  }
}