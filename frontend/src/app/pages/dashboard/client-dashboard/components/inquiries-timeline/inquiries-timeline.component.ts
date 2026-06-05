import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Consultation } from '../../../../../services/lawyer.service';

@Component({
  selector: 'app-inquiries-timeline',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './inquiries-timeline.component.html',
  styleUrls: ['./inquiries-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InquiriesTimelineComponent {
  @Input() inquiries: Consultation[] = [];
  @Input() loadingInquiries = false;

  trackByInquiry(index: number, item: Consultation): number {
    return item.id;
  }
}
