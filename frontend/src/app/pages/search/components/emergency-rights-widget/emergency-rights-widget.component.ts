import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ArrestRight {
  readonly num: number;
  readonly title: string;
  readonly desc: string;
}

@Component({
  selector: 'app-emergency-rights-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './emergency-rights-widget.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmergencyRightsWidgetComponent {
  @Input() loading = false;

  @Output() dismiss = new EventEmitter<void>();

  collapsedEmergency = false;

  readonly arrestRights: ArrestRight[] = [
    {
      num: 1,
      title: 'Right to know grounds of arrest',
      desc: 'Police must state why you are arrested and if it is bailable (CrPC Sec 50).'
    },
    {
      num: 2,
      title: 'Right to consult a lawyer',
      desc: 'You have a constitutional right to contact a legal counsel of your choice.'
    },
    {
      num: 3,
      title: 'Right to remain silent',
      desc: 'You cannot be forced to confess or make self-incriminating remarks.'
    },
    {
      num: 4,
      title: '24-hour Magistrate limit',
      desc: 'You must be produced before a Magistrate within 24 hours of arrest (CrPC Sec 57).'
    },
    {
      num: 5,
      title: 'Women rights',
      desc: 'Women can only be arrested by female officers and only between sunrise and sunset (CrPC Sec 46).'
    }
  ];

  toggleEmergencyCollapse() {
    this.collapsedEmergency = !this.collapsedEmergency;
  }

  trackByArrestRight(_index: number, item: ArrestRight): number {
    return item.num;
  }
}