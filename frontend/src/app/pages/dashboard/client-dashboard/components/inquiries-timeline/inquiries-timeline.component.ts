import { Component, Input, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Consultation } from '../../../../../services/lawyer.service';
import { IconComponent } from '../../../../../components/icon/icon.component';
import { LogoComponent } from '../../../../../components/logo/logo.component';

export type InquiryFilter = 'all' | 'consultations' | 'tickets';

@Component({
  selector: 'app-inquiries-timeline',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent, LogoComponent],
  templateUrl: './inquiries-timeline.component.html',
  styleUrls: ['./inquiries-timeline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InquiriesTimelineComponent {
  @Input() inquiries: Consultation[] = [];
  @Input() loadingInquiries = false;

  activeFilter = signal<InquiryFilter>('all');

  isTicket(inq: Consultation): boolean {
    return !!(inq.lawyerName?.startsWith('Support Desk:') || inq.lawyerEmail === 'support@legalconnect.com');
  }

  get advocateConsultations(): Consultation[] {
    return this.inquiries.filter(i => !this.isTicket(i));
  }

  get supportDeskTickets(): Consultation[] {
    return this.inquiries.filter(i => this.isTicket(i));
  }

  get filteredInquiries(): Consultation[] {
    const f = this.activeFilter();
    if (f === 'consultations') return this.advocateConsultations;
    if (f === 'tickets') return this.supportDeskTickets;
    return this.inquiries;
  }

  setFilter(f: InquiryFilter): void {
    this.activeFilter.set(f);
  }

  trackByInquiry(index: number, item: Consultation): number {
    return item.id;
  }

  getDisplayInquiryId(inq: Consultation): string {
    if (inq.publicId) {
      return inq.publicId.toUpperCase();
    }
    if (this.isTicket(inq)) {
      const match = inq.lawyerName?.match(/LC-[A-Z0-9-]+/i) || inq.message?.match(/\[TICKET-([A-Z0-9]+)\]/i);
      if (match) return match[0].toUpperCase();
      return `LC-TKT-${String(inq.id).padStart(6, '0')}`;
    }
    // Enterprise masking: convert sequential integer into deterministic non-sequential code
    const hash = ((inq.id * 1664525 + 1013904223) >>> 0).toString(16).toUpperCase().padStart(6, '0').slice(-6);
    return `LC-INQ-${hash}`;
  }
}