import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { AdminThemeService } from '../../core/services/admin-theme.service';
import { ActivatedRoute, Router } from '@angular/router';
import { smartLoading } from '../../core/utils/smart-loading.operator';
import { CsvExporter } from '../../core/utils/csv-exporter';

@Component({
  selector: 'admin-consultations',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent],
  templateUrl: './consultations.component.html',
  styleUrl: './consultations.component.scss'
})
export class ConsultationsComponent implements OnInit, OnDestroy, AfterViewInit {
  consultations: any[] = [];
  isLoading = false;
  isInitialLoad = true;
  isExporting = false;
  selectedStatus = '';
  searchQuery = '';
  slaFilter = '';
  dateRangeFilter = '';
  sortBy = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';
  presetTab: 'all' | 'overdue' | 'pending' | 'contacted' | 'closed' = 'all';
  focusedRowIndex = -1;
  isColumnMenuOpen = false;
  columnVisibility = {
    client: true,
    phone: true,
    lawyer: true,
    sla: true,
    message: true,
    status: true,
    createdAt: true
  };
  private routeSubscription?: Subscription;

  // Multi-select state
  selectedIds = new Set<number>();

  selectedConsultation: any = null;
  adminRemarkInput = '';
  isSavingNotes = false;

  // Drawer tabs: 'details' | 'audit' | 'dispatch'
  activeDrawerTab: 'details' | 'audit' | 'dispatch' = 'details';

  // Email dispatch state
  emailTemplate = 'acknowledgement';
  recipientTarget = 'client'; // 'client' | 'lawyer'
  customEmailMessage = '';
  isDispatchingEmail = false;

  openActionMenuId: string | null = null;
  actionMenuPosition = { top: 0, left: 0 };

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

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

  slaOptions: SelectOption[] = [
    { label: 'All Urgency SLA', value: '' },
    { label: 'Overdue (3d+)', value: 'overdue', icon: 'warning' },
    { label: 'Pending (1d-3d)', value: 'pending', icon: 'clock' },
    { label: 'Notice (6h-24h)', value: 'notice', icon: 'info' },
    { label: 'Recent (<6h)', value: 'recent', icon: 'zap' }
  ];

  dateRangeOptions: SelectOption[] = [
    { label: 'All Time', value: '' },
    { label: 'Today', value: 'today', icon: 'clock' },
    { label: 'Last 7 Days', value: '7days', icon: 'clock' },
    { label: 'Last 30 Days', value: '30days', icon: 'clock' }
  ];

  templateOptions: SelectOption[] = [
    { label: 'Acknowledgment & Legal Desk Review', value: 'acknowledgement', icon: 'check' },
    { label: 'Advocate Direct Contact Introduction', value: 'introduction', icon: 'user' },
    { label: 'Follow-up & Case Document Request', value: 'followup', icon: 'mail' }
  ];

  pageLimitOptions: SelectOption[] = [
    { label: '10 per page', value: '10' },
    { label: '25 per page', value: '25' },
    { label: '50 per page', value: '50' },
    { label: '100 per page', value: '100' }
  ];

  startDate = '';
  endDate = '';
  isCustomDateModalOpen = false;

  Math = Math;

  pagination = {
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  };

  get startRecord(): number {
    if (this.pagination.total === 0) return 0;
    return (this.pagination.page - 1) * this.pagination.limit + 1;
  }

  get endRecord(): number {
    return Math.min(this.pagination.page * this.pagination.limit, this.pagination.total);
  }

  onLimitChange(limitStr: string): void {
    this.pagination.limit = parseInt(limitStr, 10) || 10;
    this.pagination.page = 1;
    this.fetchConsultations();
  }

  private scrollListener: (() => void) | null = null;

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService,
    public themeService: AdminThemeService,
    private elRef: ElementRef,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.pagination.page = 1;
      this.updateUrlParams();
      this.fetchConsultations();
    });

    this.routeSubscription = this.route.queryParams.subscribe(params => {
      this.selectedStatus = params['status'] || '';
      this.slaFilter = params['sla'] || '';
      this.dateRangeFilter = params['dateRange'] || '';
      this.searchQuery = params['search'] || '';
      this.startDate = params['startDate'] || '';
      this.endDate = params['endDate'] || '';
      this.sortBy = params['sort'] || 'createdAt';
      this.sortOrder = params['sortOrder'] || 'desc';
      this.pagination.page = parseInt(params['page'], 10) || 1;
      this.fetchConsultations();
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      const tableWrapper = this.elRef.nativeElement.querySelector('.data-table-wrapper');
      if (tableWrapper) {
        this.scrollListener = () => { this.openActionMenuId = null; };
        tableWrapper.addEventListener('scroll', this.scrollListener, { passive: true });
      }
    });
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    if (this.scrollListener) {
      const tableWrapper = this.elRef.nativeElement.querySelector('.data-table-wrapper');
      tableWrapper?.removeEventListener('scroll', this.scrollListener);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }

    if (event.key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.consultations.length > 0) {
        this.focusedRowIndex = Math.min(this.focusedRowIndex + 1, this.consultations.length - 1);
      }
    } else if (event.key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.consultations.length > 0) {
        this.focusedRowIndex = Math.max(this.focusedRowIndex - 1, 0);
      }
    } else if (event.key === 'Enter') {
      if (this.focusedRowIndex >= 0 && this.focusedRowIndex < this.consultations.length) {
        event.preventDefault();
        this.openDetailModal(this.consultations[this.focusedRowIndex]);
      }
    } else if (event.key === 'Escape') {
      this.selectedConsultation = null;
      this.openActionMenuId = null;
      this.isColumnMenuOpen = false;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.column-customizer-container')) {
      this.isColumnMenuOpen = false;
    }
    if (this.isCustomDateModalOpen && !target.closest('.date-picker-container')) {
      this.isCustomDateModalOpen = false;
    }
  }

  toggleColumnVisibility(columnKey: 'client' | 'phone' | 'lawyer' | 'sla' | 'message' | 'status' | 'createdAt'): void {
    this.columnVisibility[columnKey] = !this.columnVisibility[columnKey];
  }

  get areAllColumnsVisible(): boolean {
    return Object.values(this.columnVisibility).every(v => v);
  }

  get isNoColumnsVisible(): boolean {
    return Object.values(this.columnVisibility).every(v => !v);
  }

  toggleAllColumns(forceState?: boolean): void {
    const targetState = forceState !== undefined ? forceState : !this.areAllColumnsVisible;
    this.columnVisibility = {
      client: targetState,
      phone: targetState,
      lawyer: targetState,
      sla: targetState,
      message: targetState,
      status: targetState,
      createdAt: targetState
    };
  }

  selectDatePreset(preset: 'today' | '7days' | '30days' | 'thisMonth'): void {
    const today = new Date();
    const endDateStr = today.toISOString().split('T')[0];
    let startDateStr = '';

    if (preset === 'today') {
      startDateStr = endDateStr;
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      startDateStr = d.toISOString().split('T')[0];
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startDateStr = d.toISOString().split('T')[0];
    } else if (preset === 'thisMonth') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      startDateStr = d.toISOString().split('T')[0];
    }

    this.applyCustomDateRange(startDateStr, endDateStr);
  }

  applyCustomDateRange(start: string, end: string): void {
    this.startDate = start;
    this.endDate = end;
    this.isCustomDateModalOpen = false;
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchConsultations();
  }

  clearCustomDateRange(): void {
    this.startDate = '';
    this.endDate = '';
    this.isCustomDateModalOpen = false;
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchConsultations();
  }

  onSearchChange(query: string): void {
    this.searchSubject.next(query);
  }

  get pendingCount(): number {
    return this.summaryMetrics.pending ?? 0;
  }

  get contactedCount(): number {
    return this.summaryMetrics.contacted ?? 0;
  }

  get closedCount(): number {
    return this.summaryMetrics.closed ?? 0;
  }

  onFilterChange(): void {
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchConsultations();
  }

  get totalCount(): number {
    return this.summaryMetrics.total ?? 0;
  }

  get hasQueryFilter(): boolean {
    return !!(this.searchQuery || this.selectedStatus || this.slaFilter || this.dateRangeFilter || this.startDate || this.endDate);
  }

  get isFilterActive(): boolean {
    return this.hasQueryFilter || this.selectedIds.size > 0;
  }

  private updateUrlParams(): void {
    const queryParams: any = {};
    if (this.searchQuery) queryParams.search = this.searchQuery;
    if (this.selectedStatus) queryParams.status = this.selectedStatus;
    if (this.slaFilter) queryParams.sla = this.slaFilter;
    if (this.dateRangeFilter) queryParams.dateRange = this.dateRangeFilter;
    if (this.startDate) queryParams.startDate = this.startDate;
    if (this.endDate) queryParams.endDate = this.endDate;
    if (this.sortBy && this.sortBy !== 'createdAt') queryParams.sort = this.sortBy;
    if (this.sortOrder && this.sortOrder !== 'desc') queryParams.sortOrder = this.sortOrder;
    if (this.pagination.page > 1) queryParams.page = this.pagination.page;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true
    });
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.slaFilter = '';
    this.dateRangeFilter = '';
    this.startDate = '';
    this.endDate = '';
    this.sortBy = 'createdAt';
    this.sortOrder = 'desc';
    this.selectedIds.clear();
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchConsultations();
  }

  refreshData(): void {
    this.toast.info('Refreshing consultation directory...');
    this.fetchConsultations();
  }

  toggleStatusFilter(status: string): void {
    if (this.selectedStatus === status) {
      this.selectedStatus = '';
    } else {
      this.selectedStatus = status;
    }
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchConsultations();
  }

  fetchConsultations(): void {
    const params: any = {
      page: this.pagination.page,
      limit: this.pagination.limit,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
    };
    if (this.selectedStatus) params.status = this.selectedStatus;
    if (this.searchQuery && this.searchQuery.trim()) params.search = this.searchQuery.trim();
    if (this.slaFilter) params.sla = this.slaFilter;
    if (this.dateRangeFilter) params.dateRange = this.dateRangeFilter;
    if (this.startDate) params.startDate = this.startDate;
    if (this.endDate) params.endDate = this.endDate;

    const cached = this.api.user.getCachedConsultations(params);
    if (cached && cached.success) {
      this.consultations = cached.data || [];
      this.pagination = cached.pagination || this.pagination;
      if (cached.metrics) {
        this.summaryMetrics = cached.metrics;
      }
      const totalRecs = cached.pagination?.total ?? this.consultations.length;
      this.pagination.pages = Math.max(1, Math.ceil(totalRecs / this.pagination.limit));
      this.isLoading = false;
      this.isInitialLoad = false;
    }

    const showLoader = this.isInitialLoad && !cached;

    this.api.getConsultations(params).pipe(smartLoading(l => this.isLoading = l, showLoader)).subscribe({
      next: (res: any) => {
        this.isInitialLoad = false;
        if (res.metrics) {
          this.summaryMetrics = res.metrics;
        }
        if (res.success) {
          this.consultations = res.data || [];
          this.pagination = res.pagination || this.pagination;
          const totalRecs = res.pagination?.total ?? this.consultations.length;
          this.pagination.pages = Math.max(1, Math.ceil(totalRecs / this.pagination.limit));
        }
      },
      error: (err: any) => {
        this.isInitialLoad = false;
        if (!cached) {
          this.toast.error(err?.error?.message || 'Failed to fetch consultation records.');
        }
      }
    });
  }

  // ── Multi-Select Checkboxes ──
  isAllSelected(): boolean {
    if (!this.consultations || this.consultations.length === 0) return false;
    return this.consultations.every(item => this.selectedIds.has(item.id));
  }

  isSomeSelected(): boolean {
    if (!this.consultations || this.consultations.length === 0) return false;
    return this.consultations.some(item => this.selectedIds.has(item.id)) && !this.isAllSelected();
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedIds.clear();
    } else {
      this.consultations.forEach(item => this.selectedIds.add(item.id));
    }
  }

  toggleSelectRow(id: number, event: Event): void {
    event.stopPropagation();
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  clearSelection(): void {
    this.selectedIds.clear();
  }

  async bulkUpdateStatus(newStatus: string): Promise<void> {
    if (this.selectedIds.size === 0) return;
    const idsArray = Array.from(this.selectedIds);

    const confirmed = await this.dialog.confirm({
      title: `Bulk ${newStatus === 'Closed' ? 'Close & Resolve' : 'Status Update'}`,
      message: `Are you sure you want to mark ${idsArray.length} consultation(s) as "${newStatus}"?${newStatus === 'Closed' ? ' Closed consultations are considered resolved.' : ''}`,
      type: newStatus === 'Closed' ? 'danger' : 'warning',
      confirmText: `Mark ${idsArray.length} as ${newStatus}`
    });

    if (!confirmed) return;
    this.isLoading = true;

    this.api.bulkUpdateConsultationStatus(idsArray, newStatus).subscribe({
      next: (res: any) => {
        this.toast.success(res.message || `Bulk updated ${idsArray.length} consultation(s) to ${newStatus}.`);
        this.selectedIds.clear();
        this.fetchConsultations();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error(err?.error?.message || 'Failed to bulk update consultations.');
      }
    });
  }

  // ── Interactive Header Sorting ──
  toggleSort(column: string): void {
    if (this.sortBy === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortOrder = 'asc';
    }
    this.updateUrlParams();
    this.fetchConsultations();
  }

  changePage(newPage: number): void {
    if (newPage < 1 || newPage > this.pagination.pages || newPage === this.pagination.page) return;
    this.pagination.page = newPage;
    this.updateUrlParams();
    this.fetchConsultations();
  }

  async updateStatus(item: any, newStatus: string): Promise<void> {
    // Terminal "Closed" state requires confirmation
    if (newStatus === 'Closed') {
      const confirmed = await this.dialog.confirm({
        title: 'Close & Resolve Consultation',
        message: `Mark consultation #${item.id} from "${item.clientName || item.clientUser || 'Client'}" as Closed & Resolved?`,
        type: 'warning',
        confirmText: 'Close & Resolve'
      });
      if (!confirmed) return;
    }

    const previousStatus = item.status;
    item.status = newStatus;

    this.api.updateConsultationStatus(item.id, newStatus).subscribe({
      next: () => {
        this.fetchConsultations();
        this.toast.show({
          type: 'success',
          message: `Status changed to ${newStatus}.`,
          duration: 6000,
          actionText: 'Undo',
          onAction: () => this.revertStatus(item.id, previousStatus)
        });
      },
      error: (err: any) => {
        item.status = previousStatus;
        this.toast.error(err?.error?.message || 'Failed to update status.');
      }
    });
  }

  private revertStatus(itemId: number, previousStatus: string): void {
    this.api.updateConsultationStatus(itemId, previousStatus).subscribe({
      next: () => {
        this.toast.success(`Status reverted to ${previousStatus}.`);
        this.fetchConsultations();
      },
      error: (err: any) => this.toast.error(err?.error?.message || 'Failed to revert status.')
    });
  }

  openDetailModal(item: any): void {
    this.selectedConsultation = { ...item };
    this.adminRemarkInput = item.adminRemark || '';
    this.activeDrawerTab = 'details';
    this.emailTemplate = 'acknowledgement';
    this.customEmailMessage = '';
    this.openActionMenuId = null;
  }

  saveAdminRemark(): void {
    if (!this.selectedConsultation) return;
    this.isSavingNotes = true;
    this.api.updateConsultationNotes(this.selectedConsultation.id, this.adminRemarkInput).subscribe({
      next: (res: any) => {
        this.isSavingNotes = false;
        this.selectedConsultation.adminRemark = this.adminRemarkInput;
        this.toast.success('Internal admin notes saved successfully.');
        this.fetchConsultations();
      },
      error: (err: any) => {
        this.isSavingNotes = false;
        this.toast.error(err?.error?.message || 'Failed to save admin notes.');
      }
    });
  }

  dispatchQuickEmail(): void {
    if (!this.selectedConsultation) return;
    this.isDispatchingEmail = true;
    const recipient = this.recipientTarget === 'client' ? this.selectedConsultation.clientEmail : this.selectedConsultation.lawyerEmail;

    this.api.dispatchConsultationEmail(this.selectedConsultation.id, {
      template: this.emailTemplate,
      recipient,
      customMessage: this.customEmailMessage
    }).subscribe({
      next: (res: any) => {
        this.isDispatchingEmail = false;
        this.toast.success(`Quick response dispatched to ${recipient}.`);
        this.customEmailMessage = '';
        this.fetchConsultations();
      },
      error: (err: any) => {
        this.isDispatchingEmail = false;
        this.toast.error(err?.error?.message || 'Failed to dispatch email.');
      }
    });
  }

  getAuditTrail(item: any): Array<{ timestamp: string; action: string }> {
    if (!item || !item.auditLogJson) {
      return item ? [{ timestamp: item.createdAt, action: 'Inquiry submitted by client.' }] : [];
    }
    try {
      return JSON.parse(item.auditLogJson);
    } catch {
      return [{ timestamp: item.createdAt, action: 'Inquiry submitted by client.' }];
    }
  }

  getOpenActionItem(): any | null {
    if (!this.openActionMenuId) return null;
    return this.consultations.find(c => c.id === this.openActionMenuId) || null;
  }

  toggleActionMenu(id: string, buttonEl: HTMLElement, event: Event): void {
    if (this.openActionMenuId === id) {
      this.openActionMenuId = null;
      return;
    }
    if (buttonEl) {
      const rect = buttonEl.getBoundingClientRect();
      const dropdownWidth = 185;
      const dropdownHeight = 130;
      let top = rect.bottom + 6;
      let left = rect.left + (rect.width / 2) - (dropdownWidth / 2);

      if (top + dropdownHeight > window.innerHeight - 16) {
        top = Math.max(10, rect.top - dropdownHeight - 6);
      }
      if (left + dropdownWidth > window.innerWidth - 16) {
        left = window.innerWidth - dropdownWidth - 16;
      }
      if (left < 16) {
        left = 16;
      }
      this.actionMenuPosition = { top, left };
    }
    this.openActionMenuId = id;
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    this.openActionMenuId = null;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.openActionMenuId = null;
  }

  copyToClipboard(text: string, label: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.toast.success(`${label} copied to clipboard!`);
    }).catch(() => {
      this.toast.error('Failed to copy text.');
    });
  }

  getSlaStatus(createdAt: string): { label: string; class: string; urgent: boolean } {
    if (!createdAt) return { label: 'Standard', class: 'bg-slate-500/10 text-slate-400 border-slate-500/20', urgent: false };
    const createdDate = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - createdDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays >= 3) {
      return { label: `Overdue (${diffDays}d ago)`, class: 'bg-rose-500/10 text-rose-400 border-rose-500/30', urgent: true };
    } else if (diffDays >= 1) {
      return { label: `Pending (${diffDays}d ago)`, class: 'bg-amber-500/10 text-amber-400 border-amber-500/30', urgent: true };
    } else if (diffHours >= 6) {
      return { label: `Notice (${diffHours}h ago)`, class: 'bg-sky-500/10 text-sky-400 border-sky-500/30', urgent: false };
    } else {
      return { label: `Recent (${diffHours}h ago)`, class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', urgent: false };
    }
  }

  // ── Full Dataset Server-Side Export ──
  exportToCsv(): void {
    if (this.isExporting) return;
    this.isExporting = true;
    const params: any = {
      exportAll: true,
      limit: 5000,
      sortBy: this.sortBy,
      sortOrder: this.sortOrder
    };
    if (this.selectedStatus) params.status = this.selectedStatus;
    if (this.searchQuery && this.searchQuery.trim()) params.search = this.searchQuery.trim();
    if (this.slaFilter) params.sla = this.slaFilter;
    if (this.dateRangeFilter) params.dateRange = this.dateRangeFilter;

    this.toast.info('Fetching consultation records for CSV export...');

    this.api.getConsultations(params).subscribe({
      next: (res: any) => {
        this.isExporting = false;
        const dataset = (res.success && res.data) ? res.data : (Array.isArray(res) ? res : this.consultations);
        if (!dataset || dataset.length === 0) {
          this.toast.warning('No consultation records to export.');
          return;
        }

        const headers = ['ID', 'Client Name', 'Client Email', 'Client Phone', 'Target Lawyer', 'Lawyer Email', 'Status', 'Admin Note', 'Message', 'Requested Date'];
        const rows = dataset.map((c: any) => [
          c.id,
          c.clientName || c.clientUser || '',
          c.clientEmail || '',
          c.clientPhone || '',
          c.lawyerName || '',
          c.lawyerEmail || '',
          c.status || '',
          c.adminRemark || '',
          c.message || '',
          c.createdAt ? new Date(c.createdAt).toLocaleString() : ''
        ]);

        try {
          CsvExporter.export('legal_consultations_roster', headers, rows);
          this.toast.success(`Exported complete dataset (${dataset.length} records) to CSV.`);
        } catch (err: any) {
          this.toast.error(err.message || 'Export failed.');
        }
      },
      error: () => {
        this.isExporting = false;
        this.toast.error('Failed to export dataset.');
      }
    });
  }

  exportSelectedToCsv(): void {
    if (this.selectedIds.size === 0) return;
    const selectedItems = this.consultations.filter(c => this.selectedIds.has(c.id));
    if (selectedItems.length === 0) return;

    const headers = ['ID', 'Client Name', 'Client Email', 'Client Phone', 'Target Lawyer', 'Lawyer Email', 'Status', 'Admin Note', 'Message', 'Requested Date'];
    const rows = selectedItems.map(c => [
      c.id,
      c.clientName || c.clientUser || '',
      c.clientEmail || '',
      c.clientPhone || '',
      c.lawyerName || '',
      c.lawyerEmail || '',
      c.status || '',
      c.adminRemark || '',
      c.message || '',
      c.createdAt ? new Date(c.createdAt).toLocaleString() : ''
    ]);

    try {
      CsvExporter.export(`legal_consultations_selected_${this.selectedIds.size}_records`, headers, rows);
      this.toast.success(`Exported ${selectedItems.length} selected records to CSV.`);
    } catch (err: any) {
      this.toast.error(err.message || 'Export failed.');
    }
  }
}