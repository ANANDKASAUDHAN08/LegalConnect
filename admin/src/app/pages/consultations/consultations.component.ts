import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';

@Component({
  selector: 'admin-consultations',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent],
  templateUrl: './consultations.component.html',
  styleUrl: './consultations.component.scss'
})
export class ConsultationsComponent implements OnInit {
  consultations: any[] = [];
  isLoading = false;
  selectedStatus = '';
  searchQuery = '';
  selectedConsultation: any = null;

  summaryMetrics = {
    total: 0,
    pending: 0,
    contacted: 0,
    closed: 0
  };

  statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Pending Response', value: 'Pending', icon: 'clock' },
    { label: 'Lawyer Contacted', value: 'Contacted', icon: 'mail' },
    { label: 'Closed / Completed', value: 'Closed', icon: 'check' }
  ];

  pagination = {
    page: 1,
    limit: 15,
    total: 0,
    pages: 1
  };

  constructor(private api: AdminApiService, private toast: ToastService) { }

  ngOnInit(): void {
    this.fetchConsultations();
  }

  get pendingCount(): number {
    return this.summaryMetrics.pending ?? this.consultations.filter(c => c.status === 'Pending').length;
  }

  get contactedCount(): number {
    return this.summaryMetrics.contacted ?? this.consultations.filter(c => c.status === 'Contacted').length;
  }

  get closedCount(): number {
    return this.summaryMetrics.closed ?? this.consultations.filter(c => c.status === 'Closed').length;
  }

  get filteredConsultations(): any[] {
    if (!this.searchQuery.trim()) return this.consultations;
    const q = this.searchQuery.toLowerCase().trim();
    return this.consultations.filter(c =>
      (c.clientName || '').toLowerCase().includes(q) ||
      (c.clientEmail || '').toLowerCase().includes(q) ||
      (c.lawyerName || '').toLowerCase().includes(q) ||
      (c.lawyerEmail || '').toLowerCase().includes(q) ||
      (c.message || '').toLowerCase().includes(q)
    );
  }

  fetchConsultations(): void {
    this.isLoading = true;
    this.api.getConsultations({ page: this.pagination.page, limit: this.pagination.limit, status: this.selectedStatus || undefined }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        if (res.metrics) {
          this.summaryMetrics = res.metrics;
        }
        if (res.success) {
          this.consultations = res.data || [];
          this.pagination = res.pagination || this.pagination;
        }
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error(err?.error?.message || 'Failed to fetch consultation records.');
      }
    });
  }

  updateStatus(item: any, status: string): void {
    this.api.updateConsultationStatus(item.id, status).subscribe({
      next: () => {
        item.status = status;
        this.toast.success(`Consultation status updated to ${status}.`);
        this.fetchConsultations();
      },
      error: (err: any) => this.toast.error(err?.error?.message || 'Failed to update status.')
    });
  }
}