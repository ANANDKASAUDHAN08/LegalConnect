import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

@Component({
  selector: 'app-hero-header',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hero-header.component.html',
  styleUrls: ['./hero-header.component.scss']
})
export class HeroHeaderComponent {
  @Input() locationQuery = '';
  @Input() isLocationEstimated = true;
  @Input() isStatsLoading = true;
  @Input() animatedStats = {
    legalClinics: 0,
    distCourts: 0,
    verifiedLawyers: 0
  };

  @Output() locationClicked = new EventEmitter<void>();
  @Output() suggestClicked = new EventEmitter<void>();

  trackByIndex(index: number): number {
    return index;
  }
}