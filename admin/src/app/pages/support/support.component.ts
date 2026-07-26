import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { ContactSubmissionItem } from '../../core/models/admin.models';
import { ActivatedRoute } from '@angular/router';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { smartLoading } from '../../core/utils/smart-loading.operator';

@Component({
  selector: 'admin-support',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent],
  templateUrl: './support.component.html',
  styleUrl: './support.component.scss'
})
export class SupportComponent implements OnInit {
  contacts: ContactSubmissionItem[] = [];
  isLoading = false;
  isInitialLoad = true;
  search = '';
  private searchSubject$ = new Subject<string>();
  selectedStatus = '';
  selectedTicket: ContactSubmissionItem | null = null;

  statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'New / Unread', value: 'New', icon: 'mail' },
    { label: 'Read', value: 'Read', icon: 'eye' },
    { label: 'Replied / Resolved', value: 'Replied', icon: 'check' },
    { label: 'Archived', value: 'Archived', icon: 'archive' }
  ];

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.searchSubject$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.search = query;
      this.fetchContacts();
    });

    this.route.queryParams.subscribe(params => {
      if (params['status']) {
        this.selectedStatus = params['status'];
      }
      this.fetchContacts();
    });
  }

  onSearchInput(val: string): void {
    this.searchSubject$.next(val);
  }

  fetchContacts(): void {
    const isFirstTime = this.isInitialLoad;
    this.api.getContacts({ search: this.search || undefined, status: this.selectedStatus || undefined })
      .pipe(smartLoading(l => this.isLoading = l, isFirstTime))
      .subscribe({
        next: (res: any) => {
          this.isInitialLoad = false;
          this.contacts = res.data || [];
        },
        error: (err: any) => {
          this.isInitialLoad = false;
          this.toast.error(err?.error?.message || 'Failed to fetch contact submissions.');
        }
      });
  }

  viewTicket(ticket: ContactSubmissionItem): void {
    this.selectedTicket = ticket;
    if (ticket.status === 'New' && typeof ticket.id === 'number') {
      this.api.updateContactStatus(ticket.id, 'Read').subscribe();
    }
  }

  updateStatus(ticket: ContactSubmissionItem, status: string): void {
    if (typeof ticket.id !== 'number') {
      ticket.status = status;
      this.toast.success(`Ticket status updated to ${status}.`);
      return;
    }
    this.api.updateContactStatus(ticket.id, status).subscribe({
      next: () => {
        ticket.status = status;
        this.toast.success(`Ticket status updated to ${status}.`);
      },
      error: (err: any) => this.toast.error(err?.error?.message || 'Failed to update ticket status.')
    });
  }
}