import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, ElementRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu.component';
import { ColumnCustomizerComponent, ColumnDef } from '../../shared/components/column-customizer/column-customizer.component';
import { AdminSearchInputComponent, AdminEmptyStateComponent, AdminSortHeaderComponent } from '../../shared/components/data-table/data-table-helpers.component';
import { ExportModalComponent, ExportConfig } from '../../shared/components/export-modal/export-modal.component';
import { DateRangePickerComponent, DateRangeEvent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { TableSelection, sortByField, handleTableKeyboardNav } from '../../core/utils/table.utils';
import { SwrCacheService } from '../../core/services/admin-swr-cache.service';
import { maskPhone, maskEmail, PiiMaskState } from '../../core/utils/security-utils';

import { AdminSavedViewsComponent } from '../../shared/components/saved-views/saved-views.component';

@Component({
  selector: 'admin-consultations',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent, PaginationComponent, ActionMenuComponent, ColumnCustomizerComponent, AdminSearchInputComponent, AdminSortHeaderComponent, AdminEmptyStateComponent, ExportModalComponent, DateRangePickerComponent, AdminSavedViewsComponent],
  templateUrl: './consultations.component.html',
  styleUrl: './consultations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConsultationsComponent implements OnInit, OnDestroy, AfterViewInit {
  maskPhone = maskPhone;
  maskEmail = maskEmail;
  piiState = new PiiMaskState();

  toggleUnmaskPii(id: string | number, field: string = 'default', event?: Event): void {
    this.piiState.toggle(id, field, event);
  }

  isPiiUnmasked(id: string | number, field: string = 'default'): boolean {
    return this.piiState.isUnmasked(id, field);
  }

  toggleAllPii(event?: Event): void {
    this.piiState.toggleAll(event);
  }

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

  columnDefs: ColumnDef[] = [
    { key: 'id', label: '#' },
    { key: 'client', label: 'Client' },
    { key: 'phone', label: 'Phone' },
    { key: 'lawyer', label: 'Advocate' },
    { key: 'sla', label: 'SLA' },
    { key: 'message', label: 'Inquiry' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Requested' }
  ];

  columnVisibility: any = {
    id: true,
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
  selection = new TableSelection<number>();

  get consultationIds(): number[] {
    return this.consultations.map(c => c.id);
  }

  get isAllPageSelected(): boolean {
    return this.consultations.length > 0 && this.consultations.every(c => this.selection.isSelected(c.id));
  }

  isAllSelected(): boolean {
    return this.isAllPageSelected;
  }

  toggleSelectAll(): void {
    if (this.isAllPageSelected) {
      this.selection.clear();
    } else {
      this.consultations.forEach(c => this.selection.selectedIds.add(c.id));
    }
    this.cdr.markForCheck();
  }

  get isPiiColumnVisible(): boolean {
    return !!(this.columnVisibility['client'] || this.columnVisibility['phone'] || this.columnVisibility['lawyer']);
  }

  get isAnyColumnHidden(): boolean {
    return Object.values(this.columnVisibility).some(v => !v);
  }

  resetColumnVisibility(): void {
    const keys = Object.keys(this.columnVisibility);
    const reset: Record<string, boolean> = {};
    keys.forEach(k => reset[k] = true);
    this.columnVisibility = reset;
    this.cdr.markForCheck();
  }

  get visibleColumnKeys(): string[] {
    return Object.entries(this.columnVisibility).filter(([, v]) => v).map(([k]) => k);
  }

  get isNoColumnsVisible(): boolean {
    return Object.values(this.columnVisibility).every(v => !v);
  }

  onColumnVisibilityChange(updated: Record<string, boolean>): void {
    this.columnVisibility = updated;
  }

  // Export Modal State
  isExportModalOpen = false;
  exportColumns = [
    { key: 'id', label: 'ID' },
    { key: 'clientName', label: 'Client Name' },
    { key: 'clientEmail', label: 'Client Email' },
    { key: 'clientPhone', label: 'Client Phone' },
    { key: 'lawyerName', label: 'Target Lawyer' },
    { key: 'lawyerEmail', label: 'Lawyer Email' },
    { key: 'status', label: 'Status' },
    { key: 'adminRemark', label: 'Admin Note' },
    { key: 'message', label: 'Message' },
    { key: 'createdAt', label: 'Requested Date' }
  ];

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
  @ViewChild('actionMenu') actionMenuRef!: ActionMenuComponent;

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  summaryMetrics = {
    total: 0,
    pending: 0,
    contacted: 0,
    closed: 0
  };

  statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '', icon: 'info', color: '#38bdf8' },
    { label: 'Pending Response', value: 'Pending', icon: 'clock', color: '#f59e0b' },
    { label: 'Lawyer Contacted', value: 'Contacted', icon: 'mail', color: '#38bdf8' },
    { label: 'Closed / Completed', value: 'Closed', icon: 'check', color: '#10b981' }
  ];

  slaOptions: SelectOption[] = [
    { label: 'All Urgency SLA', value: '', icon: 'info', color: '#38bdf8' },
    { label: 'Overdue (3d+)', value: 'overdue', icon: 'warning', color: '#f43f5e' },
    { label: 'Pending (1d-3d)', value: 'pending', icon: 'clock', color: '#f59e0b' },
    { label: 'Notice (6h-24h)', value: 'notice', icon: 'info', color: '#38bdf8' },
    { label: 'Recent (<6h)', value: 'recent', icon: 'zap', color: '#10b981' }
  ];

  sortOptions: SelectOption[] = [
    { label: 'Newest First', value: 'createdAt', icon: 'clock', color: '#38bdf8' },
    { label: 'Oldest First', value: 'oldest', icon: 'clock', color: '#f59e0b' },
    { label: 'Client Name (A-Z)', value: 'clientName', icon: 'user', color: '#10b981' },
    { label: 'Status Order', value: 'status', icon: 'shield', color: '#a855f7' }
  ];

  onSortChange(event: { key: string; order: 'asc' | 'desc' }): void {
    this.sortBy = event.key;
    this.sortOrder = event.order;
    this.pagination.page = 1;
    this.swrCache.invalidate('consultations');
    this.updateUrlParams();
    this.fetchConsultations();
  }

  sortData(list: any[]): any[] {
    return sortByField(list, this.sortBy, this.sortOrder, {
      client: (c: any) => c.clientName || '',
      lawyer: (c: any) => c.lawyerName || ''
    });
  }

  onSortDropdownChange(val: string): void {
    if (val === 'clientName') {
      this.onSortChange({ key: 'clientName', order: 'asc' });
    } else if (val === 'status') {
      this.onSortChange({ key: 'status', order: 'asc' });
    } else if (val === 'oldest') {
      this.onSortChange({ key: 'createdAt', order: 'asc' });
    } else {
      this.onSortChange({ key: 'createdAt', order: 'desc' });
    }
  }

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

  startDate = '';
  endDate = '';
  Math = Math;

  pagination = {
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  };

  onLimitChange(limitVal: number | string): void {
    this.pagination.limit = typeof limitVal === 'number' ? limitVal : (parseInt(limitVal, 10) || 10);
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
    private router: Router,
    public swrCache: SwrCacheService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.routeSubscription = this.route.queryParams.subscribe((params: any) => {
      this.selectedStatus = params['status'] || '';
      this.slaFilter = params['sla'] || '';
      this.dateRangeFilter = params['dateRange'] || '';
      this.searchQuery = params['search'] || '';
      this.startDate = params['startDate'] || '';
      this.endDate = params['endDate'] || '';
      this.sortBy = params['sort'] || 'createdAt';
      this.sortOrder = params['sortOrder'] || 'desc';
      this.pagination.page = parseInt(params['page'], 10) || 1;
      this.cdr.markForCheck();
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
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
    }
    this.routeSubscription?.unsubscribe();
    if (this.scrollListener) {
      const tableWrapper = this.elRef.nativeElement.querySelector('.data-table-wrapper');
      tableWrapper?.removeEventListener('scroll', this.scrollListener);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    handleTableKeyboardNav(event, {
      getListLength: () => this.consultations.length,
      getFocusedIndex: () => this.focusedRowIndex,
      setFocusedIndex: (idx) => { this.focusedRowIndex = idx; this.cdr.markForCheck(); },
      onEnter: (idx) => { if (this.consultations[idx]) this.openDetailModal(this.consultations[idx]); },
      onEscape: () => { this.selectedConsultation = null; this.openActionMenuId = null; this.cdr.markForCheck(); }
    });
  }

  onDateRangeChange(event: DateRangeEvent): void {
    this.startDate = event.startDate;
    this.endDate = event.endDate;
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  onSearchChange(query: string): void {
    this.searchQuery = query;
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  removeFilter(type: 'search' | 'status' | 'sla' | 'dateRange'): void {
    if (type === 'search') this.searchQuery = '';
    if (type === 'status') this.selectedStatus = '';
    if (type === 'sla') this.slaFilter = '';
    if (type === 'dateRange') { this.startDate = ''; this.endDate = ''; this.dateRangeFilter = ''; }
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  get activeFilterPills(): { key: 'search' | 'status' | 'sla' | 'dateRange'; label: string }[] {
    const pills: { key: 'search' | 'status' | 'sla' | 'dateRange'; label: string }[] = [];
    if (this.searchQuery) pills.push({ key: 'search', label: `Search: "${this.searchQuery}"` });
    if (this.selectedStatus) pills.push({ key: 'status', label: `Status: ${this.selectedStatus}` });
    if (this.slaFilter) pills.push({ key: 'sla', label: `SLA: ${this.slaFilter}` });
    if (this.startDate || this.endDate) pills.push({ key: 'dateRange', label: `Date: ${this.startDate || '...'} to ${this.endDate || '...'}` });
    return pills;
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
  }

  get totalCount(): number {
    return this.summaryMetrics.total ?? 0;
  }

  get hasQueryFilter(): boolean {
    return !!(this.searchQuery || this.selectedStatus || this.slaFilter || this.dateRangeFilter || this.startDate || this.endDate || this.isAnyColumnHidden);
  }

  get isFilterActive(): boolean {
    return this.hasQueryFilter || !this.selection.isEmpty;
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

  private updateDropdownCounts(): void {
    if (!this.summaryMetrics) return;
    this.statusOptions = [
      { label: 'All Statuses', value: '', icon: 'info', color: '#818cf8', count: this.summaryMetrics.total },
      { label: 'Pending Response Queue', value: 'Pending', icon: 'clock', color: '#f59e0b', count: this.summaryMetrics.pending },
      { label: 'Advocate Contacted', value: 'Contacted', icon: 'check', color: '#38bdf8', count: this.summaryMetrics.contacted },
      { label: 'Closed & Resolved', value: 'Closed', icon: 'archive', color: '#10b981', count: this.summaryMetrics.closed }
    ];
  }

  get activeQueryParamsObj(): Record<string, any> {
    const obj: Record<string, any> = {};
    if (this.selectedStatus) obj['status'] = this.selectedStatus;
    if (this.searchQuery) obj['search'] = this.searchQuery;
    if (this.slaFilter) obj['sla'] = this.slaFilter;
    if (this.dateRangeFilter) obj['dateRange'] = this.dateRangeFilter;
    if (this.startDate) obj['startDate'] = this.startDate;
    if (this.endDate) obj['endDate'] = this.endDate;
    if (this.sortBy && this.sortBy !== 'createdAt') obj['sortBy'] = this.sortBy;
    if (this.sortOrder && this.sortOrder !== 'desc') obj['sortOrder'] = this.sortOrder;
    return obj;
  }

  onSavedViewApply(savedParams: any): void {
    this.selectedStatus = savedParams?.['status'] || '';
    this.searchQuery = savedParams?.['search'] || '';
    this.slaFilter = savedParams?.['sla'] || '';
    this.dateRangeFilter = savedParams?.['dateRange'] || '';
    this.startDate = savedParams?.['startDate'] || '';
    this.endDate = savedParams?.['endDate'] || '';
    this.sortBy = savedParams?.['sortBy'] || 'createdAt';
    this.sortOrder = savedParams?.['sortOrder'] || 'desc';
    this.pagination.page = 1;
    this.updateUrlParams();
    this.cdr.markForCheck();
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
    this.resetColumnVisibility();
    this.selection.clear();
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  onPresetTabChange(tab: 'all' | 'overdue' | 'pending' | 'contacted' | 'closed'): void {
    this.presetTab = tab;
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  refreshData(): void {
    this.toast.info('Refreshing consultation directory...');
    this.api.user.clearConsultationsCache();
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
        this.updateDropdownCounts();
      }
      const totalRecs = cached.pagination?.total ?? this.consultations.length;
      this.pagination.pages = Math.max(1, Math.ceil(totalRecs / this.pagination.limit));
      this.isLoading = false;
      this.isInitialLoad = false;
      this.cdr.markForCheck();
    }

    const showLoader = this.isInitialLoad && !cached;

    this.api.getConsultations(params).pipe(smartLoading(l => { this.isLoading = l; this.cdr.markForCheck(); }, showLoader)).subscribe({
      next: (res: any) => {
        this.isInitialLoad = false;
        if (res.metrics) {
          this.summaryMetrics = res.metrics;
          this.updateDropdownCounts();
        }
        if (res.success) {
          this.consultations = res.data || [];
          this.pagination = res.pagination || this.pagination;
          const totalRecs = res.pagination?.total ?? this.consultations.length;
          this.pagination.pages = Math.max(1, Math.ceil(totalRecs / this.pagination.limit));
        }
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        this.isInitialLoad = false;
        if (!cached) {
          this.toast.error(err?.error?.message || 'Failed to fetch consultation records.');
        }
        this.cdr.markForCheck();
      }
    });
  }

  isSomeSelected(): boolean {
    if (!this.consultations || this.consultations.length === 0) return false;
    return this.consultations.some(item => this.selection.isSelected(item.id)) && !this.isAllSelected();
  }

  toggleSelectRow(id: number | string, event?: Event): void {
    if (event) event.stopPropagation();
    this.selection.toggle(Number(id));
  }

  clearSelection(): void {
    this.selection.clear();
  }

  async bulkUpdateStatus(newStatus: string): Promise<void> {
    if (this.selection.isEmpty) return;
    const ids = this.selection.toArray();
    const confirmed = await this.dialog.confirm({
      title: `Bulk Update to ${newStatus}`,
      message: `Are you sure you want to mark ${ids.length} selected consultation(s) as "${newStatus}"?`,
      type: newStatus === 'Closed' ? 'warning' : 'info',
      confirmText: `Bulk ${newStatus}`
    });

    if (!confirmed) return;

    this.isLoading = true;
    this.cdr.markForCheck();
    this.api.bulkUpdateConsultationStatus(ids, newStatus).subscribe({
      next: () => {
        this.isLoading = false;
        this.selection.clear();
        this.toast.success(`${ids.length} consultation(s) updated to "${newStatus}".`);
        this.cdr.markForCheck();
        this.fetchConsultations();
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error(err?.error?.message || 'Failed to bulk update consultations.');
        this.cdr.markForCheck();
      }
    });
  }

  // -- Interactive Header Sorting --
  toggleSort(column: string): void {
    if (this.sortBy === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortOrder = 'asc';
    }
    this.updateUrlParams();
  }

  onPageChange(newPage: number): void {
    if (newPage < 1 || newPage > this.pagination.pages || newPage === this.pagination.page) return;
    this.pagination.page = newPage;
    this.updateUrlParams();
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
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        item.status = previousStatus;
        this.toast.error(err?.error?.message || 'Failed to update status.');
        this.cdr.markForCheck();
      }
    });
  }

  private revertStatus(itemId: number, previousStatus: string): void {
    this.api.updateConsultationStatus(itemId, previousStatus).subscribe({
      next: () => {
        this.toast.success(`Status reverted to ${previousStatus}.`);
        this.cdr.markForCheck();
        this.fetchConsultations();
      },
      error: (err: any) => { this.toast.error(err?.error?.message || 'Failed to revert status.'); this.cdr.markForCheck(); }
    });
  }

  private rowClickTimeout: any = null;

  onRowClick(id: number): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
    }
    this.rowClickTimeout = setTimeout(() => {
      this.selection.toggle(id);
      this.rowClickTimeout = null;
      this.cdr.markForCheck();
    }, 250);
  }

  onRowDblClick(item: any): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
      this.rowClickTimeout = null;
    }
    this.openDetailModal(item);
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
    this.cdr.markForCheck();
    this.api.updateConsultationNotes(this.selectedConsultation.id, this.adminRemarkInput).subscribe({
      next: (res: any) => {
        this.isSavingNotes = false;
        this.selectedConsultation.adminRemark = this.adminRemarkInput;
        this.toast.success('Internal admin notes saved successfully.');
        this.cdr.markForCheck();
        this.fetchConsultations();
      },
      error: (err: any) => {
        this.isSavingNotes = false;
        this.toast.error(err?.error?.message || 'Failed to save admin notes.');
        this.cdr.markForCheck();
      }
    });
  }

  dispatchQuickEmail(): void {
    if (!this.selectedConsultation) return;
    this.isDispatchingEmail = true;
    this.cdr.markForCheck();
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
        this.cdr.markForCheck();
        this.fetchConsultations();
      },
      error: (err: any) => {
        this.isDispatchingEmail = false;
        this.toast.error(err?.error?.message || 'Failed to dispatch email.');
        this.cdr.markForCheck();
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
    event.stopPropagation();
    if (this.openActionMenuId === id) {
      this.openActionMenuId = null;
      return;
    }
    this.openActionMenuId = id;
    if (this.actionMenuRef) {
      this.actionMenuRef.openAt(buttonEl);
    }
  }

  closeActionMenu(): void {
    this.openActionMenuId = null;
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

  // -- Unified Export Handler --
  openExportModal(): void {
    this.isExportModalOpen = true;
  }

  closeExportModal(): void {
    this.isExportModalOpen = false;
  }

  handleExport(config: ExportConfig): void {
    if (this.isExporting) return;
    this.isExporting = true;

    if (config.scope === 'selected') {
      const selectedItems = this.consultations.filter(c => this.selection.isSelected(c.id));
      this.exportConsultationData(selectedItems, config.columns);
      return;
    }

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

    this.api.getConsultations(params).subscribe({
      next: (res: any) => {
        const dataset = (res.success && res.data) ? res.data : (Array.isArray(res) ? res : this.consultations);
        if (!dataset || dataset.length === 0) {
          this.isExporting = false;
          this.toast.warning('No consultation records to export.');
          this.cdr.markForCheck();
          return;
        }
        this.exportConsultationData(dataset, config.columns);
      },
      error: () => {
        this.isExporting = false;
        this.toast.error('Failed to export dataset.');
        this.cdr.markForCheck();
      }
    });
  }

  private exportConsultationData(dataset: any[], columnKeys: string[]): void {
    const columnMap: Record<string, { header: string; extract: (c: any) => any }> = {
      id: { header: 'ID', extract: c => c.id },
      clientName: { header: 'Client Name', extract: c => c.clientName || c.clientUser || '' },
      clientEmail: { header: 'Client Email', extract: c => c.clientEmail || '' },
      clientPhone: { header: 'Client Phone', extract: c => c.clientPhone || '' },
      lawyerName: { header: 'Target Lawyer', extract: c => c.lawyerName || '' },
      lawyerEmail: { header: 'Lawyer Email', extract: c => c.lawyerEmail || '' },
      status: { header: 'Status', extract: c => c.status || '' },
      adminRemark: { header: 'Admin Note', extract: c => c.adminRemark || '' },
      message: { header: 'Message', extract: c => c.message || '' },
      createdAt: { header: 'Requested Date', extract: c => c.createdAt ? new Date(c.createdAt).toLocaleString() : '' }
    };

    const activeCols = columnKeys.map(k => columnMap[k]).filter(Boolean);
    const headers = activeCols.map(c => c.header);
    const rows = dataset.map(c => activeCols.map(col => col.extract(c)));

    try {
      CsvExporter.export('legal_consultations_roster', headers, rows);
      this.toast.success(`Exported ${dataset.length} consultation records (${headers.length} columns) to CSV.`);
    } catch (err: any) {
      this.toast.error(err.message || 'Export failed.');
    }
    this.isExporting = false;
    this.isExportModalOpen = false;
    this.cdr.markForCheck();
  }
}