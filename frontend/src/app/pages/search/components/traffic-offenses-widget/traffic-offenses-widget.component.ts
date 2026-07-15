import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TrafficOffense {
  readonly offense: string;
  readonly section: string;
  readonly fine: string;
  readonly isSmallText: boolean;
}

@Component({
  selector: 'app-traffic-offenses-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './traffic-offenses-widget.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrafficOffensesWidgetComponent {
  @Input() loading = false;

  @Output() dismiss = new EventEmitter<void>();

  collapsedTraffic = true;

  readonly trafficOffenses: TrafficOffense[] = [
    {
      offense: 'Drunk Driving',
      section: '(MV Act Sec 185)',
      fine: 'Rs. 10,000 / 6m Jail',
      isSmallText: false
    },
    {
      offense: 'No License',
      section: '(Sec 181)',
      fine: 'Rs. 5,000',
      isSmallText: false
    },
    {
      offense: 'Overspeeding',
      section: '(Sec 183)',
      fine: 'Rs. 1,000 - 2,000',
      isSmallText: false
    },
    {
      offense: 'No Helmet/Seatbelt',
      section: '(Sec 194B/D)',
      fine: 'Rs. 1,000 / 3m Suspend',
      isSmallText: true
    }
  ];

  toggleTrafficCollapse() {
    this.collapsedTraffic = !this.collapsedTraffic;
  }

  trackByOffense(_index: number, item: TrafficOffense): string {
    return item.offense;
  }
}