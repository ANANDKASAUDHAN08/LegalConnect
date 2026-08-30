import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminModerationService, ModerationReport, ModerationStats, ModerationFilterParams } from '../../core/services/admin-moderation.service';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { AdminSearchInputComponent, AdminEmptyStateComponent, AdminSortHeaderComponent } from '../../shared/components/data-table/data-table-helpers.component';

@Component({
  selector: 'admin-moderation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TooltipDirective,
    PaginationComponent,
    AdminSearchInputComponent,
    AdminEmptyStateComponent,
    AdminSortHeaderComponent
  ],
  templateUrl: './moderation.component.html',
  styleUrls: ['./moderation.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModerationComponent implements OnInit {
  private moderationService = inject(AdminModerationService);
  private toast = inject(ToastService);
  private dialog = inject(DialogService);
  private cdr = inject(ChangeDetectorRef);

  reports: ModerationReport[] = [];
  stats: ModerationStats | null = null;
  isLoading = false;

  // Filters & State
  selectedStatus = 'Pending';
  selectedType = '';
  selectedSeverity = '';
  searchQuery = '';
  sortBy = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Pagination
  pagination = { page: 1, limit: 15, total: 0, pages: 1 };

  // Selection for bulk actions
  selectedReportIds = new Set<number>();

  // Single report action modal
  activeReport: ModerationReport | null = null;
  showActionModal = false;
  actionModalMode: 'resolve' | 'dismiss' = 'resolve';
  resolutionAction = 'ContentRemoved';
  moderatorNotes = '';
  isProcessingAction = false;

  // Detail drawer
  drawerReport: ModerationReport | null = null;

  readonly resolutionActions = [
    { value: 'ContentRemoved', label: 'Remove / Hide Content' },
    { value: 'WarningIssued', label: 'Issue Formal Warning' },
    { value: 'InformationCorrected', label: 'Correct Information / Update Record' },
    { value: 'UserSuspended', label: 'Suspend User Account' },
    { value: 'NoActionRequired', label: 'Dismiss / No Action Required' }
  ];

  ngOnInit(): void {
    this.loadStats();
    this.loadQueue();
  }

  loadStats(): void {
    this.moderationService.getStats().subscribe({
      next: (res) => {
        if (res?.data) {
          this.stats = res.data;
          this.cdr.markForCheck();
        }
      },
      error: () => { }
    });
  }

  loadQueue(): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    const params: ModerationFilterParams = {
      status: this.selectedStatus || undefined,
      targetType: this.selectedType || undefined,
      severity: this.selectedSeverity || undefined,
      search: this.searchQuery.trim() || undefined,
      page: this.pagination.page,
      pageSize: this.pagination.limit,
      sortBy: `${this.sortBy}_${this.sortOrder}`
    };

    this.moderationService.getQueue(params).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res?.data) {
          this.reports = res.data;
          if (res.pagination) {
            this.pagination.total = res.pagination.totalItems;
            this.pagination.pages = res.pagination.totalPages;
          }
        }
        this.selectedReportIds.clear();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isLoading = false;
        this.toast.error('Failed to load moderation queue');
        this.cdr.markForCheck();
      }
    });
  }

  onFilterChange(): void {
    this.pagination.page = 1;
    this.loadQueue();
  }

  onSearch(query: string): void {
    this.searchQuery = query;
    this.pagination.page = 1;
    this.loadQueue();
  }

  onSort(field: string): void {
    if (this.sortBy === field) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortOrder = 'desc';
    }
    this.loadQueue();
  }

  onSortHeader(event: { key: string; order: 'asc' | 'desc' }): void {
    this.sortBy = event.key;
    this.sortOrder = event.order;
    this.loadQueue();
  }

  onPageChange(page: number): void {
    this.pagination.page = page;
    this.loadQueue();
  }

  // Selection helpers
  toggleSelectAll(): void {
    if (this.selectedReportIds.size === this.reports.length) {
      this.selectedReportIds.clear();
    } else {
      this.selectedReportIds = new Set(this.reports.map(r => r.id));
    }
  }

  toggleSelect(id: number, event: Event): void {
    event.stopPropagation();
    if (this.selectedReportIds.has(id)) {
      this.selectedReportIds.delete(id);
    } else {
      this.selectedReportIds.add(id);
    }
  }

  isAllSelected(): boolean {
    return this.reports.length > 0 && this.selectedReportIds.size === this.reports.length;
  }

  // Single Action Modal
  openResolveModal(report: ModerationReport, event?: Event): void {
    if (event) event.stopPropagation();
    this.activeReport = report;
    this.actionModalMode = 'resolve';
    this.resolutionAction = 'ContentRemoved';
    this.moderatorNotes = '';
    this.showActionModal = true;
  }

  openDismissModal(report: ModerationReport, event?: Event): void {
    if (event) event.stopPropagation();
    this.activeReport = report;
    this.actionModalMode = 'dismiss';
    this.moderatorNotes = '';
    this.showActionModal = true;
  }

  closeActionModal(): void {
    this.showActionModal = false;
    this.activeReport = null;
    this.isProcessingAction = false;
  }

  submitAction(): void {
    if (!this.activeReport) return;
    this.isProcessingAction = true;

    if (this.actionModalMode === 'resolve') {
      this.moderationService.resolveReport(this.activeReport.id, this.resolutionAction, this.moderatorNotes).subscribe({
        next: () => {
          this.toast.success(`Report #${this.activeReport?.reportRef} marked as resolved ✓`);
          this.closeActionModal();
          this.loadQueue();
          this.loadStats();
        },
        error: () => {
          this.toast.error('Failed to resolve report');
          this.isProcessingAction = false;
          this.cdr.markForCheck();
        }
      });
    } else {
      this.moderationService.dismissReport(this.activeReport.id, this.moderatorNotes).subscribe({
        next: () => {
          this.toast.success(`Report #${this.activeReport?.reportRef} dismissed`);
          this.closeActionModal();
          this.loadQueue();
          this.loadStats();
        },
        error: () => {
          this.toast.error('Failed to dismiss report');
          this.isProcessingAction = false;
          this.cdr.markForCheck();
        }
      });
    }
  }

  // Bulk Actions
  bulkResolve(): void {
    const ids = Array.from(this.selectedReportIds);
    if (!ids.length) return;

    this.dialog.confirm({
      title: `Resolve ${ids.length} Selected Reports?`,
      message: 'All selected reports will be marked as resolved with Content Removed action.',
      confirmText: 'Resolve All',
      cancelText: 'Cancel'
    }).then(confirmed => {
      if (!confirmed) return;
      this.moderationService.bulkResolve(ids, 'ContentRemoved', 'Bulk resolved by administrator').subscribe({
        next: () => {
          this.toast.success(`${ids.length} reports resolved successfully ✓`);
          this.loadQueue();
          this.loadStats();
        },
        error: () => {
          this.toast.error('Bulk resolve failed');
        }
      });
    });
  }

  bulkDismiss(): void {
    const ids = Array.from(this.selectedReportIds);
    if (!ids.length) return;

    this.dialog.confirm({
      title: `Dismiss ${ids.length} Selected Reports?`,
      message: 'All selected reports will be dismissed as false alarms or duplicate flags.',
      confirmText: 'Dismiss All',
      cancelText: 'Cancel'
    }).then(confirmed => {
      if (!confirmed) return;
      this.moderationService.bulkDismiss(ids, 'Bulk dismissed by administrator').subscribe({
        next: () => {
          this.toast.success(`${ids.length} reports dismissed`);
          this.loadQueue();
          this.loadStats();
        },
        error: () => {
          this.toast.error('Bulk dismiss failed');
        }
      });
    });
  }

  // Drawer
  openDrawer(report: ModerationReport): void {
    this.drawerReport = report;
  }

  closeDrawer(): void {
    this.drawerReport = null;
  }

  // Helpers
  getSeverityClass(severity: string): string {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'high': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'medium': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  }

  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pending': return 'bg-amber-500/15 text-amber-300 border-amber-500/30 animate-pulse';
      case 'underreview': return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
      case 'resolved': return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'dismissed': return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  }
}