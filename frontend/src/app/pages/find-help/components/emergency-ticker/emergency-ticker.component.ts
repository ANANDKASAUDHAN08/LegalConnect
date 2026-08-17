import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EMERGENCY_HELPLINES, EmergencyHelpline } from '../../config/category-data.config';

/**
 * Emergency helpline ticker bar — scrolling marquee on mobile, centered on desktop.
 * Data-driven from EMERGENCY_HELPLINES config. Eliminates 90 lines of duplicated HTML
 * that was previously copy-pasted for the seamless mobile scroll loop.
 */
@Component({
  selector: 'app-emergency-ticker',
  standalone: true,
  imports: [CommonModule],
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