import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RightsService } from '../../../../services/rights.service';

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
export class EmergencyRightsWidgetComponent implements OnInit {
  private rightsService = inject(RightsService);
  private cdr = inject(ChangeDetectorRef);

  @Input() loading = false;
  @Output() dismiss = new EventEmitter<void>();

  collapsedEmergency = false;

  arrestRights: ArrestRight[] = [
    {
      num: 1,
      title: 'Right to know grounds of arrest',
      desc: 'Police must state why you are arrested and if it is bailable (BNSS Sec 47 & 35).'
    },
    {
      num: 2,
      title: 'Right to consult a lawyer',
      desc: 'You have a constitutional right to contact a legal counsel of your choice (Art 22 & BNSS Sec 38).'
    },
    {
      num: 3,
      title: 'Right to remain silent',
      desc: 'You cannot be forced to confess or make self-incriminating remarks (Constitution Art 20(3)).'
    },
    {
      num: 4,
      title: '24-hour Magistrate limit',
      desc: 'You must be produced before a Judicial Magistrate within 24 hours of arrest (BNSS Sec 58).'
    },
    {
      num: 5,
      title: 'Night arrest protection for women',
      desc: 'Women cannot be arrested between sunset and sunrise without prior Judicial Magistrate sanction (BNSS Sec 46).'
    }
  ];

  ngOnInit(): void {
    // Dynamically query criminal statutory rights from backend
    this.rightsService.fetchRights('Criminal Justice & Arrest', '', 'popular', 'police-stop').subscribe(res => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        this.arrestRights = res.data.slice(0, 5).map((r, idx) => ({
          num: idx + 1,
          title: r.title,
          desc: `${r.summary} (${r.statutoryBasis.shortAct || r.statutoryBasis.actName} ${r.statutoryBasis.sections?.join(', ') || ''})`
        }));
        this.cdr.markForCheck();
      }
    });
  }

  toggleEmergencyCollapse() {
    this.collapsedEmergency = !this.collapsedEmergency;
  }

  trackByArrestRight(_index: number, item: ArrestRight): number {
    return item.num;
  }
}