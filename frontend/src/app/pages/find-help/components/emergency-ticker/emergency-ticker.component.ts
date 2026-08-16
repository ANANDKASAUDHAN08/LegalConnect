import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EMERGENCY_HELPLINES, EmergencyHelpline } from '../../config/category-data.config';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { DiscreetExitBarComponent } from '../discreet-exit-bar/discreet-exit-bar.component';

/**
 * Emergency helpline ticker bar with live 24/7 helplines marquee and Discreet Quick Exit safety bar.
 */
@Component({
  selector: 'app-emergency-ticker',
  standalone: true,
  imports: [CommonModule, TooltipDirective, DiscreetExitBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './emergency-ticker.component.html',
  styleUrls: ['./emergency-ticker.component.scss']
})
export class EmergencyTickerComponent {
  @Input() isScrolled = false;

  readonly helplines: EmergencyHelpline[] = EMERGENCY_HELPLINES;

  trackByIndex(index: number): number {
    return index;
  }

  trackByNumber(_: number, item: EmergencyHelpline): string {
    return item.number;
  }
}