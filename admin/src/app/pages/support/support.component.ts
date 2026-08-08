import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { ContactSubmissionItem } from '../../core/models/admin.models';
import { ActivatedRoute, Router } from '@angular/router';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { Subscription } from 'rxjs';
import { smartLoading } from '../../core/utils/smart-loading.operator';
import { ExportModalComponent, ExportConfig } from '../../shared/components/export-modal/export-modal.component';
import { ActionMenuComponent } from '../../shared/components/action-menu/action-menu.component';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { ColumnCustomizerComponent, ColumnDef } from '../../shared/components/column-customizer/column-customizer.component';
import { AdminSearchInputComponent, AdminEmptyStateComponent, AdminSortHeaderComponent } from '../../shared/components/data-table/data-table-helpers.component';
import { DateRangePickerComponent, DateRangeEvent } from '../../shared/components/date-range-picker/date-range-picker.component';
import { TableSelection, sortByField, handleTableKeyboardNav } from '../../core/utils/table.utils';
import { SwrCacheService } from '../../core/services/admin-swr-cache.service';
import { maskPhone, maskEmail, PiiMaskState } from '../../core/utils/security-utils';

interface CannedMacro {
  title: string;
  category: string;
  content: string;
}

import { AdminSavedViewsComponent } from '../../shared/components/saved-views/saved-views.component';

@Component({
  selector: 'admin-support',
  standalone: true,
  imports: [
    CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent,
    ExportModalComponent, ActionMenuComponent, PaginationComponent, ColumnCustomizerComponent,
    AdminSearchInputComponent, AdminEmptyStateComponent, AdminSortHeaderComponent, DateRangePickerComponent,
    AdminSavedViewsComponent
  ],
  templateUrl: './support.component.html',
  styleUrl: './support.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SupportComponent implements OnInit, OnDestroy {
  maskPhone = maskPhone;
  maskEmail = maskEmail;
  piiState = new PiiMaskState();

  toggleUnmaskPii(id: string | number, field: string = 'email', event?: Event): void {
    this.piiState.toggle(id, field, event);
  }

  isPiiUnmasked(id: string | number, field: string = 'email'): boolean {
    return this.piiState.isUnmasked(id, field);
  }

  toggleAllPii(event?: Event): void {
    this.piiState.toggleAll(event);
  }

  contacts: ContactSubmissionItem[] = [];
  isLoading = false;
  isInitialLoad = true;
  search = '';
  private routeSub?: Subscription;

  // Sorting state matching Users/Lawyers page
  sortBy = 'createdAt';
  sortOrder: 'asc' | 'desc' = 'desc';

  // Pagination matching Users/Lawyers page
  pagination = { page: 1, limit: 10, total: 0, pages: 1 };

  // Filter selections & date range
  selectedStatus = '';
  selectedPriority = '';
  selectedCategory = '';
  startDate = '';
  endDate = '';

  // Column Customizer setup matching Users/Lawyers page
  columnDefs: ColumnDef[] = [
    { key: 'applicant', label: 'Applicant Details' },
    { key: 'subject', label: 'Subject Line & Topic' },
    { key: 'priority', label: 'Priority SLA' },
    { key: 'status', label: 'Workflow Status' },
    { key: 'submitted', label: 'Submitted Date' }
  ];

  columnVisibility: Record<string, boolean> = {
    applicant: true,
    subject: true,
    priority: true,
    status: true,
    submitted: true
  };

  get isPiiColumnVisible(): boolean {
    return !!(this.columnVisibility['applicant']);
  }

  get isNoColumnsVisible(): boolean {
    return Object.values(this.columnVisibility).every(v => !v);
  }

  get isAnyColumnHidden(): boolean {
    return Object.values(this.columnVisibility).some(v => !v);
  }

  get hasQueryFilter(): boolean {
    return !!(this.search || this.selectedStatus || this.selectedPriority || this.selectedCategory || this.startDate || this.endDate || this.isAnyColumnHidden);
  }

  resetColumnVisibility(): void {
    const keys = Object.keys(this.columnVisibility);
    const reset: Record<string, boolean> = {};
    keys.forEach(k => reset[k] = true);
    this.columnVisibility = reset;
    this.cdr.markForCheck();
  }

  // Selected Ticket for Drawer
  selectedTicket: ContactSubmissionItem | null = null;
  newInternalNote = '';

  // Resolution Modal
  showResolutionModal = false;
  resolutionTicket: ContactSubmissionItem | null = null;
  resolutionNote = '';
  resolutionTargetStatus = 'Resolved';

  // Selection for bulk actions
  selectedTicketIds = new Set<string | number>();

  // Floating Action Menu ViewChild
  @ViewChild('actionMenu') actionMenuRef!: ActionMenuComponent;
  openActionMenuId: string | number | null = null;

  // Custom Export Modal state
  isExportModalOpen = false;
  isExporting = false;

  exportColumns = [
    { key: 'id', label: 'Ticket ID' },
    { key: 'fullName', label: 'Applicant Name' },
    { key: 'email', label: 'Email Address' },
    { key: 'subject', label: 'Subject Line' },
    { key: 'category', label: 'Category' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Submitted Date' }
  ];

  // Select Options with Vibrant Colors
  statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '', icon: 'info', color: '#38bdf8' },
    { label: 'New', value: 'New', icon: 'clock', color: '#38bdf8' },
    { label: 'In Progress', value: 'In Progress', icon: 'refresh', color: '#a855f7' },
    { label: 'Escalated to DPO', value: 'Escalated to DPO', icon: 'shield', color: '#f43f5e' },
    { label: 'Resolved', value: 'Resolved', icon: 'check', color: '#10b981' }
  ];

  priorityOptions: SelectOption[] = [
    { label: 'All Priorities', value: '', icon: 'info', color: '#38bdf8' },
    { label: 'Urgent Priority', value: 'Urgent', icon: 'shield', color: '#f43f5e' },
    { label: 'High Priority', value: 'High', icon: 'clock', color: '#f59e0b' },
    { label: 'Normal Priority', value: 'Normal', icon: 'check', color: '#10b981' },
    { label: 'Low Priority', value: 'Low', icon: 'archive', color: '#64748b' }
  ];

  categoryOptions: SelectOption[] = [
    { label: 'All Categories', value: '', icon: 'info', color: '#38bdf8' },
    { label: 'General Inquiry', value: 'General', icon: 'mail', color: '#38bdf8' },
    { label: 'Lawyer Verification', value: 'Verification', icon: 'award', color: '#a855f7' },
    { label: 'Billing & Subscriptions', value: 'Billing', icon: 'briefcase', color: '#14b8a6' },
    { label: 'Technical Bug Report', value: 'Bug', icon: 'bug', color: '#f43f5e' },
    { label: 'DPDP Privacy Grievance', value: 'DPDP', icon: 'shield', color: '#8b5cf6' }
  ];

  macros: CannedMacro[] = [
    {
      title: 'Lawyer Account Verification Checklist',
      category: 'Verification',
      content: 'Hello,\n\nWe have received your verification request. Please provide the following documents:\n1. State Bar Council Enrollment Certificate\n2. Government Issued ID (Aadhaar / PAN)\n3. Office Address Verification Proof\n\nOnce received, our compliance desk will verify your credentials within 24 business hours.\n\nRegards,\nLegalConnect Admin Desk'
    },
    {
      title: 'DPDP Privacy Data Access Confirmation',
      category: 'DPDP',
      content: 'Dear Citizen,\n\nIn accordance with Section 11 of the Digital Personal Data Protection (DPDP) Act, 2023, your data access query has been logged. Our Data Protection Officer (DPO) has reviewed your file.\n\nYour request has been processed successfully.\n\nSincerely,\nData Protection Officer, LegalConnect'
    },
    {
      title: 'General Support Inquiry Resolution',
      category: 'General',
      content: 'Dear User,\n\nWe have reviewed your inquiry and resolved the issue described. If you require further legal assistance, please reply directly to this thread.\n\nThank you,\nLegalConnect Support Desk'
    }
  ];

  selection = new TableSelection<string | number>();

  get ticketIds(): (string | number)[] {
    return this.contacts.map(c => c.id);
  }

  get isAllPageSelected(): boolean {
    return this.contacts.length > 0 && this.contacts.every(c => this.selection.isSelected(c.id));
  }

  isAllSelected(): boolean {
    return this.isAllPageSelected;
  }

  toggleSelectAll(event?: Event): void {
    if (this.isAllPageSelected) {
      this.selection.clear();
    } else {
      this.contacts.forEach(c => this.selection.selectedIds.add(c.id));
    }
    this.cdr.markForCheck();
  }

  toggleSelectRow(id: string | number, event?: Event): void {
    if (event) event.stopPropagation();
    this.selection.toggle(id);
  }

  toggleTicketSelection(id: string | number, event?: Event): void {
    this.toggleSelectRow(id, event);
  }

  isTicketSelected(id: string | number): boolean {
    return this.selection.isSelected(id);
  }

  get activeMetricCard(): 'all' | 'pending' | 'urgent' | 'dpdp' | 'resolved' {
    if (this.selectedPriority === 'Urgent') return 'urgent';
    if (this.selectedStatus === 'New' || this.selectedStatus === 'In Progress') return 'pending';
    if (this.selectedCategory === 'DPDP' || this.selectedStatus === 'Escalated to DPO') return 'dpdp';
    if (this.selectedStatus === 'Resolved') return 'resolved';
    return 'all';
  }

  get isFilterActive(): boolean {
    return this.hasQueryFilter;
  }

  toggleMetricFilter(type: 'all' | 'pending' | 'urgent' | 'dpdp' | 'resolved'): void {
    if (this.activeMetricCard === type && type !== 'all') {
      this.selectedStatus = '';
      this.selectedPriority = '';
      this.selectedCategory = '';
    } else {
      this.selectedStatus = '';
      this.selectedPriority = '';
      this.selectedCategory = '';

      if (type === 'pending') {
        this.selectedStatus = 'New';
      } else if (type === 'urgent') {
        this.selectedPriority = 'Urgent';
      } else if (type === 'dpdp') {
        this.selectedCategory = 'DPDP';
      } else if (type === 'resolved') {
        this.selectedStatus = 'Resolved';
      }
    }
    this.onFilterChange();
  }

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router,
    public swrCache: SwrCacheService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.routeSub = this.route.queryParams.subscribe((params: any) => {
      this.selectedPriority = params['priority'] || (params['card'] === 'urgent' ? 'Urgent' : '');
      this.selectedStatus = params['status'] || (params['card'] === 'pending' ? 'New' : params['card'] === 'resolved' ? 'Resolved' : '');
      this.selectedCategory = params['category'] || (params['card'] === 'dpdp' ? 'DPDP' : '');
      this.search = params['search'] || '';
      this.startDate = params['startDate'] || '';
      this.endDate = params['endDate'] || '';
      this.sortBy = params['sort'] || 'createdAt';
      this.sortOrder = params['sortOrder'] || 'desc';
      this.pagination.page = parseInt(params['page'], 10) || 1;
      this.cdr.markForCheck();
      this.fetchContacts();
    });
  }

  ngOnDestroy(): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
    }
    this.routeSub?.unsubscribe();
  }

  private updateUrlParams(): void {
    const queryParams: any = {};
    if (this.search) queryParams.search = this.search;
    if (this.selectedStatus) queryParams.status = this.selectedStatus;
    if (this.selectedPriority) queryParams.priority = this.selectedPriority;
    if (this.selectedCategory) queryParams.category = this.selectedCategory;
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

  focusedRowIndex = -1;

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    handleTableKeyboardNav(event, {
      getListLength: () => this.contacts.length,
      getFocusedIndex: () => this.focusedRowIndex,
      setFocusedIndex: (idx) => { this.focusedRowIndex = idx; this.cdr.markForCheck(); },
      onEnter: (idx) => { if (this.contacts[idx]) this.openTicketDrawer(this.contacts[idx]); },
      onEscape: () => { this.selectedTicket = null; this.openActionMenuId = null; this.cdr.markForCheck(); }
    });
  }

  openTicketDrawer(ticket: ContactSubmissionItem): void {
    this.selectedTicket = ticket;
    this.cdr.markForCheck();
  }

  onDateRangeChange(event: DateRangeEvent): void {
    this.startDate = event.startDate || '';
    this.endDate = event.endDate || '';
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  refreshData(): void {
    this.swrCache.invalidate('support');
    this.fetchContacts();
  }

  onSearchInput(val: string): void {
    this.search = val;
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  onSearchChange(query: string): void {
    this.search = query;
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  removeFilter(type: 'search' | 'status' | 'priority' | 'category' | 'dateRange'): void {
    if (type === 'search') this.search = '';
    if (type === 'status') this.selectedStatus = '';
    if (type === 'priority') this.selectedPriority = '';
    if (type === 'category') this.selectedCategory = '';
    if (type === 'dateRange') { this.startDate = ''; this.endDate = ''; }
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  get activeFilterPills(): { key: 'search' | 'status' | 'priority' | 'category' | 'dateRange'; label: string }[] {
    const pills: { key: 'search' | 'status' | 'priority' | 'category' | 'dateRange'; label: string }[] = [];
    if (this.search) pills.push({ key: 'search', label: `Search: "${this.search}"` });
    if (this.selectedStatus) pills.push({ key: 'status', label: `Status: ${this.selectedStatus}` });
    if (this.selectedPriority) pills.push({ key: 'priority', label: `Priority: ${this.selectedPriority}` });
    if (this.selectedCategory) pills.push({ key: 'category', label: `Category: ${this.selectedCategory}` });
    if (this.startDate || this.endDate) pills.push({ key: 'dateRange', label: `Date: ${this.startDate || '...'} to ${this.endDate || '...'}` });
    return pills;
  }

  onFilterChange(): void {
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  private updateDropdownCounts(): void {
    const total = this.pagination.total || this.contacts.length;
    const newCount = this.contacts.filter(c => c.status === 'New').length;
    const inProgress = this.contacts.filter(c => c.status === 'In Progress').length;
    const dpoEscalated = this.contacts.filter(c => c.status === 'Escalated to DPO').length;
    const resolved = this.contacts.filter(c => c.status === 'Resolved').length;

    this.statusOptions = [
      { label: 'All Statuses', value: '', icon: 'info', color: '#38bdf8', count: total },
      { label: 'New', value: 'New', icon: 'clock', color: '#38bdf8', count: newCount },
      { label: 'In Progress', value: 'In Progress', icon: 'refresh', color: '#a855f7', count: inProgress },
      { label: 'Escalated to DPO', value: 'Escalated to DPO', icon: 'shield', color: '#f43f5e', count: dpoEscalated },
      { label: 'Resolved', value: 'Resolved', icon: 'check', color: '#10b981', count: resolved }
    ];
  }

  get activeQueryParamsObj(): Record<string, any> {
    const obj: Record<string, any> = {};
    if (this.selectedStatus) obj['status'] = this.selectedStatus;
    if (this.selectedPriority) obj['priority'] = this.selectedPriority;
    if (this.selectedCategory) obj['category'] = this.selectedCategory;
    if (this.search) obj['search'] = this.search;
    if (this.startDate) obj['startDate'] = this.startDate;
    if (this.endDate) obj['endDate'] = this.endDate;
    if (this.sortBy && this.sortBy !== 'createdAt') obj['sort'] = this.sortBy;
    if (this.sortOrder && this.sortOrder !== 'desc') obj['sortOrder'] = this.sortOrder;
    return obj;
  }

  onSavedViewApply(savedParams: any): void {
    this.selectedStatus = savedParams?.['status'] || '';
    this.selectedPriority = savedParams?.['priority'] || '';
    this.selectedCategory = savedParams?.['category'] || '';
    this.search = savedParams?.['search'] || '';
    this.startDate = savedParams?.['startDate'] || '';
    this.endDate = savedParams?.['endDate'] || '';
    this.sortBy = savedParams?.['sort'] || 'createdAt';
    this.sortOrder = savedParams?.['sortOrder'] || 'desc';
    this.pagination.page = 1;
    this.updateUrlParams();
    this.cdr.markForCheck();
  }

  resetFilters(): void {
    this.search = '';
    this.selectedStatus = '';
    this.selectedPriority = '';
    this.selectedCategory = '';
    this.startDate = '';
    this.endDate = '';
    this.sortBy = 'createdAt';
    this.sortOrder = 'desc';
    this.pagination.page = 1;
    this.resetColumnVisibility();
    this.selection.clear();
    this.updateUrlParams();
  }

  onColumnVisibilityChange(visibility: Record<string, boolean>): void {
    this.columnVisibility = visibility;
    this.cdr.markForCheck();
  }

  onSortChange(event: { key: string; order: 'asc' | 'desc' }): void {
    this.sortBy = event.key;
    this.sortOrder = event.order;
    this.pagination.page = 1;
    this.swrCache.invalidate('support');
    this.updateUrlParams();
  }

  sortData(list: ContactSubmissionItem[]): ContactSubmissionItem[] {
    return sortByField(list, this.sortBy, this.sortOrder);
  }

  fetchContacts(): void {
    const params = {
      status: this.selectedStatus || undefined,
      priority: this.selectedPriority || undefined,
      category: this.selectedCategory || undefined,
      search: this.search || undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      sort: this.sortBy,
      sortOrder: this.sortOrder,
      page: this.pagination.page,
      limit: this.pagination.limit
    };

    // 0ms Instant SWR Cache Hydration
    const cached = this.swrCache.get<any>('support', params);
    if (cached) {
      this.contacts = this.sortData(cached.data || []);
      if (cached.pagination) this.pagination = cached.pagination;
      this.isInitialLoad = false;
      this.isLoading = false;
      this.cdr.markForCheck();
    }

    const showLoader = this.isInitialLoad && !cached;

    this.api.getContacts(params).pipe(
      smartLoading((val: boolean) => { this.isLoading = val; this.cdr.markForCheck(); }, showLoader)
    ).subscribe({
      next: (res: any) => {
        const rawItems = res.data || res.items || res || [];
        this.contacts = this.sortData(rawItems);
        const p = res.pagination || {};
        const total = p.total ?? p.totalItems ?? this.contacts.length;
        const limit = p.limit || this.pagination.limit || 10;
        const pages = p.pages ?? p.totalPages ?? (Math.ceil(total / limit) || 1);
        const pageMeta = {
          page: p.page || this.pagination.page || 1,
          limit,
          total,
          pages
        };
        this.pagination = pageMeta;
        this.updateDropdownCounts();
        this.swrCache.set('support', params, { data: rawItems, pagination: pageMeta });
        this.isInitialLoad = false;
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        if (!cached) {
          this.toast.error(err?.error?.message || 'Failed to load support inquiries.');
        }
        this.isInitialLoad = false;
        this.cdr.markForCheck();
      }
    });
  }

  onPageChange(page: number): void {
    this.pagination.page = page;
    this.updateUrlParams();
  }

  onLimitChange(limit: number): void {
    this.pagination.limit = limit;
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  get totalTicketsCount(): number {
    return this.pagination.total || this.contacts.length;
  }

  get openTicketsCount(): number {
    return this.contacts.filter(c => c.status === 'New' || c.status === 'In Progress').length;
  }

  get urgentCount(): number {
    return this.contacts.filter(c => c.priority === 'Urgent').length;
  }

  get dpoEscalationsCount(): number {
    return this.contacts.filter(c => c.status === 'Escalated to DPO' || c.category === 'DPDP').length;
  }

  get resolvedCount(): number {
    return this.contacts.filter(c => c.status === 'Resolved' || c.status === 'Replied').length;
  }

  getContactInitial(contact: ContactSubmissionItem): string {
    const name = contact.fullName || contact.email || 'A';
    return name.trim().charAt(0).toUpperCase();
  }

  getContactName(contact: ContactSubmissionItem): string {
    if (contact.fullName && contact.fullName.trim()) {
      return contact.fullName;
    }
    if (contact.email) {
      const parts = contact.email.split('@');
      return parts[0];
    }
    return 'Anonymous';
  }

  private rowClickTimeout: any = null;

  onRowClick(id: any): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
    }
    this.rowClickTimeout = setTimeout(() => {
      this.toggleTicketSelection(id);
      this.rowClickTimeout = null;
      this.cdr.markForCheck();
    }, 250);
  }

  onRowDblClick(contact: ContactSubmissionItem): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
      this.rowClickTimeout = null;
    }
    this.viewTicket(contact);
  }

  viewTicket(contact: ContactSubmissionItem): void {
    this.selectedTicket = { ...contact };
    if (!this.selectedTicket.internalNotes) {
      this.selectedTicket.internalNotes = [];
    }
    this.closeActionMenu();
  }

  closeDrawer(): void {
    this.selectedTicket = null;
    this.newInternalNote = '';
  }

  updateTicketPriority(ticket: ContactSubmissionItem, priority: string): void {
    ticket.priority = priority;
    if (typeof ticket.id === 'number') {
      this.api.updateContactStatus(ticket.id, ticket.status).subscribe({
        next: () => { this.toast.success(`Priority updated to ${priority}`); this.cdr.markForCheck(); },
        error: () => this.toast.error('Failed to update priority')
      });
    }
  }

  addInternalNote(): void {
    if (!this.selectedTicket || !this.newInternalNote.trim()) return;
    if (!this.selectedTicket.internalNotes) {
      this.selectedTicket.internalNotes = [];
    }
    const note = {
      author: 'Admin Agent',
      text: this.newInternalNote.trim(),
      date: new Date().toISOString()
    };
    this.selectedTicket.internalNotes.push(note);

    if (typeof this.selectedTicket.id === 'number') {
      this.api.updateContactStatus(
        this.selectedTicket.id,
        this.selectedTicket.status
      ).subscribe({
        next: () => {
          this.toast.success('Internal note added');
          this.newInternalNote = '';
          this.cdr.markForCheck();
        }
      });
    }
  }

  openResolutionModal(ticket: ContactSubmissionItem, targetStatus: string = 'Resolved'): void {
    this.resolutionTicket = ticket;
    this.resolutionTargetStatus = targetStatus;
    this.resolutionNote = ticket.resolutionNote || '';
    this.showResolutionModal = true;
    this.closeActionMenu();
  }

  closeResolutionModal(): void {
    this.showResolutionModal = false;
    this.resolutionTicket = null;
    this.resolutionNote = '';
  }

  applyMacro(event: Event): void {
    const idx = (event.target as HTMLSelectElement).value;
    if (idx !== '-1' && this.macros[+idx]) {
      this.resolutionNote = this.macros[+idx].content;
    }
  }

  submitResolution(): void {
    if (!this.resolutionTicket) return;
    const ticketId = this.resolutionTicket.id;
    const newStatus = this.resolutionTargetStatus;

    if (typeof ticketId === 'number') {
      this.api.updateContactStatus(ticketId, newStatus).subscribe({
        next: () => {
          this.toast.success(`Ticket #${ticketId} status updated to ${newStatus}`);
          this.fetchContacts();
          this.closeResolutionModal();
        },
        error: () => this.toast.error('Failed to resolve ticket')
      });
    }
  }

  bulkUpdateStatus(status: string): void {
    if (this.selection.isEmpty) return;
    const ids = this.selection.toArray();
    let count = 0;
    this.contacts.forEach(ticket => {
      if (this.selection.isSelected(ticket.id)) {
        ticket.status = status;
        count++;
        if (typeof ticket.id === 'number') {
          this.api.updateContactStatus(ticket.id, status).subscribe();
        }
      }
    });
    this.swrCache.invalidate('support');
    this.toast.success(`Bulk updated ${count} ticket(s) to ${status}.`);
    this.selection.clear();
  }

  // Floating Action Menu matching Users/Lawyers page
  getOpenActionTicket(): ContactSubmissionItem | null {
    if (!this.openActionMenuId) return null;
    return this.contacts.find(c => c.id === this.openActionMenuId) || null;
  }

  getOpenActionItem(): ContactSubmissionItem | null {
    return this.getOpenActionTicket();
  }

  toggleActionMenu(id: string | number, buttonEl: HTMLElement, event: Event): void {
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

  // Custom Export Modal logic
  openExportModal(): void {
    this.isExportModalOpen = true;
  }

  closeExportModal(): void {
    this.isExportModalOpen = false;
  }

  handleExport(config: ExportConfig): void {
    if (this.isExporting) return;
    this.isExporting = true;

    let targetTickets = this.contacts;
    if (config.scope === 'selected' && this.selectedTicketIds.size > 0) {
      targetTickets = this.contacts.filter(c => this.selectedTicketIds.has(c.id));
    }

    if (targetTickets.length === 0) {
      this.isExporting = false;
      this.toast.warning('No support tickets available to export.');
      this.isExportModalOpen = false;
      return;
    }

    const selectedCols = config.columns || this.exportColumns.map(c => c.key);
    const headerLabelsMap: Record<string, string> = {
      id: 'Ticket ID',
      fullName: 'Applicant Name',
      email: 'Email Address',
      subject: 'Subject Line',
      category: 'Category',
      priority: 'Priority',
      status: 'Status',
      createdAt: 'Submitted Date'
    };

    const headers = selectedCols.map(key => headerLabelsMap[key] || key);
    const rows = targetTickets.map(ticket => {
      return selectedCols.map(key => {
        let val = (ticket as any)[key] ?? '';
        if (key === 'fullName') val = this.getContactName(ticket);
        if (typeof val === 'string') val = `"${val.replace(/"/g, '""')}"`;
        return val;
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `support_tickets_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.isExporting = false;
    this.isExportModalOpen = false;
    this.toast.success(`Exported ${targetTickets.length} support ticket(s) to CSV.`);
  }
}