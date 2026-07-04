import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TooltipDirective } from '../../../../directives/tooltip.directive';

/**
 * Results navigation header bar — breadcrumb trail + view mode switcher.
 * Extracted from the results split view for clarity.
 */
@Component({
  selector: 'app-results-header',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './results-header.component.html',
  styleUrls: ['./results-header.component.scss']
})
export class ResultsHeaderComponent {
  @Input() activeCategory = '';
  @Input() locationQuery = '';
  @Input() radius = 5;
  @Input() activeViewMode: 'split' | 'list' | 'map' = 'split';
  @Input() activeFiltersCount = 0;
  @Input() freeAidEligible: boolean | null = null;

  @Output() back = new EventEmitter<void>();
  @Output() viewModeChange = new EventEmitter<'split' | 'list' | 'map'>();
  @Output() changeLocation = new EventEmitter<void>();
  @Output() toggleFilters = new EventEmitter<void>();
  @Output() openFreeAid = new EventEmitter<void>();
}