import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RightsService } from '../../../../services/rights.service';

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
export class TrafficOffensesWidgetComponent implements OnInit {
  private rightsService = inject(RightsService);
  private cdr = inject(ChangeDetectorRef);

  @Input() loading = false;
  @Output() dismiss = new EventEmitter<void>();

  collapsedTraffic = true;

  trafficOffenses: TrafficOffense[] = [
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

  ngOnInit(): void {
    this.rightsService.fetchRights('Traffic, Vehicles & Transport', '', 'popular', 'traffic-police').subscribe(res => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const dynamicItems = res.data.slice(0, 4).map(r => ({
          offense: r.title,
          section: `(${r.statutoryBasis.shortAct || 'MVA'} ${r.statutoryBasis.sections?.join(', ') || ''})`,
          fine: r.penaltiesForViolation || r.summary,
          isSmallText: (r.penaltiesForViolation || '').length > 25
        }));
        if (dynamicItems.length > 0) {
          this.trafficOffenses = dynamicItems;
          this.cdr.markForCheck();
        }
      }
    });
  }

  toggleTrafficCollapse() {
    this.collapsedTraffic = !this.collapsedTraffic;
  }

  trackByOffense(_index: number, item: TrafficOffense): string {
    return item.offense;
  }
}