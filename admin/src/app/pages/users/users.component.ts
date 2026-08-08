import { Component, OnInit, OnDestroy, HostListener, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { smartLoading } from '../../core/utils/smart-loading.operator';
import { Subject, Subscription } from 'rxjs';
import { CsvExporter } from '../../core/utils/csv-exporter';
import { AvatarService } from '../../shared/services/avatar.service';
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
  selector: 'admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent, PaginationComponent, ActionMenuComponent, ColumnCustomizerComponent, AdminSearchInputComponent, AdminSortHeaderComponent, AdminEmptyStateComponent, ExportModalComponent, DateRangePickerComponent, AdminSavedViewsComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent implements OnInit, OnDestroy {
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

  users: any[] = [];
  isLoading = false;
  isInitialLoad = true;
  search = '';
  private searchSubject$ = new Subject<string>();
  private searchSub?: Subscription;
  private routeSub?: Subscription;
  private fetchSub?: Subscription;

  selectedRole = '';
  selectedStatus = '';
  sortBy = 'newest';
  sortOrder: 'asc' | 'desc' = 'desc';
  activeDrawerTab: 'profile' | 'security' | 'audit' = 'profile';

  roleOptions: SelectOption[] = [
    { label: 'All User Roles', value: '', icon: 'info', color: '#818cf8' },
    { label: 'Client Accounts', value: 'Client', icon: 'user', color: '#38bdf8' },
    { label: 'Lawyer Accounts', value: 'Lawyer', icon: 'award', color: '#818cf8' },
    { label: 'Administrator Accounts', value: 'Admin', icon: 'key', color: '#c084fc' }
  ];

  statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '', icon: 'info', color: '#818cf8' },
    { label: 'Active Accounts', value: 'true', icon: 'check', color: '#10b981' },
    { label: 'Suspended Accounts', value: 'false', icon: 'shield', color: '#f43f5e' }
  ];

  sortOptions: SelectOption[] = [
    { label: 'Newest First', value: 'newest', icon: 'clock', color: '#38bdf8' },
    { label: 'Oldest First', value: 'oldest', icon: 'clock', color: '#f59e0b' },
    { label: 'Name (A-Z)', value: 'name', icon: 'user', color: '#10b981' },
    { label: 'Name (Z-A)', value: 'name_desc', icon: 'user', color: '#a855f7' }
  ];

  pagination = {
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  };

  // -- Superpower Security & IAM State --
  openActionMenuId: string | number | null = null;
  @ViewChild('actionMenu') actionMenuRef!: ActionMenuComponent;

  isAuditDrawerOpen = false;
  selectedUserForAudit: any = null;
  userAuditLogs: any[] = [];
  isLoadingAuditLogs = false;
  searchAuditLog = '';

  startDate = '';
  endDate = '';

  focusedRowIndex = -1;
  columnDefs: ColumnDef[] = [
    { key: 'profile', label: 'User Profile' },
    { key: 'role', label: 'Role & Permissions' },
    { key: 'security', label: 'Security' },
    { key: 'auth', label: 'Auth Details' },
    { key: 'lastActive', label: 'Last Active' },
    { key: 'status', label: 'Account Status' }
  ];
  columnVisibility: any = {
    profile: true,
    role: true,
    security: true,
    auth: true,
    lastActive: true,
    status: true
  };

  get isPiiColumnVisible(): boolean {
    return !!(this.columnVisibility['profile'] || this.columnVisibility['email'] || this.columnVisibility['phone']);
  }

  get isNoColumnsVisible(): boolean {
    return Object.values(this.columnVisibility).every(v => !v);
  }

  get isAnyColumnHidden(): boolean {
    return Object.values(this.columnVisibility).some(v => !v);
  }

  get hasQueryFilter(): boolean {
    return !!(this.search || this.selectedRole || this.selectedStatus || this.startDate || this.endDate || this.isAnyColumnHidden);
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

  onColumnVisibilityChange(updated: Record<string, boolean>): void {
    this.columnVisibility = updated;
  }

  // Export Modal State
  isExportModalOpen = false;
  exportColumns = [
    { key: 'id', label: 'ID' },
    { key: 'fullName', label: 'Full Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'city', label: 'City' },
    { key: 'phone', label: 'Phone' },
    { key: 'emailVerified', label: 'Email Verified' },
    { key: 'activeStatus', label: 'Active Status' },
    { key: 'createdAt', label: 'Created At' }
  ];

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService,
    private route: ActivatedRoute,
    private router: Router,
    public avatar: AvatarService,
    public swrCache: SwrCacheService,
    private cdr: ChangeDetectorRef
  ) { }

  // Global System Telemetry Header Metrics (Dynamic Source of Truth)
  globalTotalUsers = 0;
  globalAdminCount = 0;
  globalLawyerCount = 0;
  globalClientCount = 0;
  globalTwoFactorPct = 0;

  get isFilterActive(): boolean {
    return this.hasQueryFilter || this.selection.size > 0;
  }

  filterByRoleMetric(roleStr: string): void {
    if (this.selectedRole === roleStr) {
      this.selectedRole = ''; // toggle off if clicked again
    } else {
      this.selectedRole = roleStr;
    }
    this.onFilterChange();
  }

  sortData(list: any[]): any[] {
    return sortByField(list, this.sortBy, this.sortOrder, {
      name: (u: any) => u.fullName || u.name || '',
      fullName: (u: any) => u.fullName || u.name || '',
      status: (u: any) => u.isActive ? 1 : 0
    });
  }

  onSortChange(event: { key: string; order: 'asc' | 'desc' }): void {
    this.sortBy = event.key;
    this.sortOrder = event.order;
    this.pagination.page = 1;
    this.swrCache.invalidate('users');
    this.updateUrlParams();
  }

  toggleSort(column: string): void {
    const newOrder = this.sortBy === column ? (this.sortOrder === 'asc' ? 'desc' : 'asc') : 'asc';
    this.onSortChange({ key: column, order: newOrder });
  }

  onSortDropdownChange(val: string): void {
    if (val === 'name') {
      this.onSortChange({ key: 'name', order: 'asc' });
    } else if (val === 'name_desc') {
      this.onSortChange({ key: 'name', order: 'desc' });
    } else if (val === 'oldest') {
      this.onSortChange({ key: 'createdAt', order: 'asc' });
    } else {
      this.onSortChange({ key: 'createdAt', order: 'desc' });
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    const activeEl = event.target as HTMLElement;
    const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT';

    if (event.key === '/' && !isInput) {
      event.preventDefault();
      const searchInput = document.querySelector('.page-filters input') as HTMLInputElement;
      if (searchInput) searchInput.focus();
    } else if (event.key === 'Escape') {
      this.closeAuditDrawer();
    }
  }

  private rowClickTimeout: any = null;

  onRowClick(id: any): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
    }
    this.rowClickTimeout = setTimeout(() => {
      this.selection.toggle(id);
      this.rowClickTimeout = null;
      this.cdr.markForCheck();
    }, 250);
  }

  onRowDblClick(user: any): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
      this.rowClickTimeout = null;
    }
    this.openAuditDrawer(user);
  }

  // -- Security Drawer & Quick Actions --
  openAuditDrawer(user: any): void {
    this.selectedUserForAudit = user;
    this.activeDrawerTab = 'profile';
    this.isAuditDrawerOpen = true;
    this.openActionMenuId = null;
    document.body.style.overflow = 'hidden';
    this.fetchUserAuditLog(user.id);
  }

  closeAuditDrawer(): void {
    this.isAuditDrawerOpen = false;
    this.selectedUserForAudit = null;
    this.activeDrawerTab = 'profile';
    this.userAuditLogs = [];
    document.body.style.overflow = '';
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    handleTableKeyboardNav(event, {
      getListLength: () => this.users.length,
      getFocusedIndex: () => this.focusedRowIndex,
      setFocusedIndex: (idx) => { this.focusedRowIndex = idx; this.cdr.markForCheck(); },
      onEnter: (idx) => { if (this.users[idx]) this.openAuditDrawer(this.users[idx]); },
      onEscape: () => { this.closeAuditDrawer(); this.openActionMenuId = null; this.cdr.markForCheck(); },
      scrollToRow: () => this.scrollToFocusedRow()
    });
  }

  private scrollToFocusedRow(): void {
    setTimeout(() => {
      const rows = document.querySelectorAll('.table-data-row');
      if (rows && rows[this.focusedRowIndex]) {
        (rows[this.focusedRowIndex] as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
  }

  onDateRangeChange(event: DateRangeEvent): void {
    this.startDate = event.startDate;
    this.endDate = event.endDate;
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchUsers();
  }

  get filteredUserAuditLogs(): any[] {
    if (!this.searchAuditLog || !this.searchAuditLog.trim()) {
      return this.userAuditLogs;
    }
    const q = this.searchAuditLog.toLowerCase().trim();
    return this.userAuditLogs.filter(item =>
      (item.action && item.action.toLowerCase().includes(q)) ||
      (item.detail && item.detail.toLowerCase().includes(q))
    );
  }

  exportUserAuditLogs(): void {
    if (!this.userAuditLogs || this.userAuditLogs.length === 0) {
      this.toast.warning('No audit logs available to export.');
      return;
    }
    const headers = ['Action Event', 'Details', 'Timestamp'];
    const rows = this.userAuditLogs.map(item => [
      item.action || '',
      item.detail || '',
      item.timestamp ? new Date(item.timestamp).toLocaleString() : ''
    ]);
    try {
      CsvExporter.export(`user_${this.selectedUserForAudit?.id}_audit_log`, headers, rows);
      this.toast.success('Exported user audit log entries to CSV.');
    } catch (err: any) {
      this.toast.error('Failed to export audit logs.');
    }
  }

  async impersonateUser(user: any): Promise<void> {
    this.openActionMenuId = null;
    const confirmed = await this.dialog.confirm({
      title: 'Initiate User Impersonation',
      message: `Launch read-only troubleshooting session as user "${user.fullName}" (${user.email})? An audit log entry will be permanently recorded.`,
      type: 'warning',
      confirmText: 'Launch Session'
    });
    if (!confirmed) return;

    // Open blank tab synchronously to prevent browser popup blockers
    const redirectWin = window.open('about:blank', '_blank');

    this.api.impersonateUser(user.id).subscribe({
      next: (res: any) => {
        this.toast.success(`Impersonation session initialized for ${user.fullName}.`);
        if (res.redirectUrl) {
          if (redirectWin) redirectWin.location.href = res.redirectUrl;
        } else if (redirectWin) {
          redirectWin.close();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        if (redirectWin) redirectWin.close();
        this.toast.error(err?.error?.message || 'Failed to initiate impersonation session.');
        this.cdr.markForCheck();
      }
    });
  }

  fetchUserAuditLog(userId: number): void {
    this.isLoadingAuditLogs = true;
    this.cdr.markForCheck();
    this.api.getUserAuditLog(userId).subscribe({
      next: (res: any) => {
        this.isLoadingAuditLogs = false;
        if (res && res.data) {
          this.userAuditLogs = res.data;
        } else {
          this.userAuditLogs = [];
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingAuditLogs = false;
        this.userAuditLogs = [];
        this.cdr.markForCheck();
      }
    });
  }

  sendForcePasswordReset(user: any): void {
    this.api.resetUserPassword(user.id).subscribe({
      next: (res) => {
        this.toast.success(`Force Password Reset Email sent to ${user.email}. Temp Key: ${res.tempPassword || 'SEC-89214'}`);
        this.cdr.markForCheck();
      },
      error: () => { this.toast.error('Password reset dispatch failed.'); this.cdr.markForCheck(); }
    });
  }

  async revokeActiveSessions(user: any): Promise<void> {
    const confirmed = await this.dialog.warning(
      'Force Logout / Revoke All Sessions',
      `Revoke all active OAuth & JWT refresh tokens for "${user.fullName}"? User will be logged out on all devices.`
    );
    if (confirmed) {
      this.api.revokeUserSessions(user.id).subscribe({
        next: () => { this.toast.success(`All active authentication tokens for "${user.fullName}" revoked.`); this.cdr.markForCheck(); },
        error: (err) => { this.toast.error(err?.error?.message || 'Failed to revoke active sessions.'); this.cdr.markForCheck(); }
      });
    }
  }

  verifyEmailManually(user: any): void {
    this.api.verifyUserEmail(user.id).subscribe({
      next: () => {
        user.isEmailVerified = true;
        this.toast.success(`Email address for ${user.fullName} manually verified.`);
        this.cdr.markForCheck();
      },
      error: (err) => { this.toast.error(err?.error?.message || 'Failed to verify email.'); this.cdr.markForCheck(); }
    });
  }

  async changeUserRole(user: any, newRole: string): Promise<void> {
    if (user.role === newRole) return;
    const confirmed = await this.dialog.confirm({
      title: 'Confirm Role Change',
      message: `Change role for "${user.fullName}" from ${user.role} to ${newRole}? This will immediately affect their system access and permissions.`,
      type: newRole === 'Admin' ? 'danger' : 'warning',
      confirmText: `Change to ${newRole}`
    });

    if (!confirmed) return;

    const oldRole = user.role;
    user.role = newRole;
    this.api.updateUserRole(user.id, newRole).subscribe({
      next: () => { this.toast.success(`Role for ${user.fullName} changed to ${newRole}.`); this.cdr.markForCheck(); },
      error: (err) => {
        user.role = oldRole;
        this.toast.error(err?.error?.message || 'Failed to update user role.');
        this.cdr.markForCheck();
      }
    });
  }

  ngOnInit(): void {
    this.routeSub = this.route.queryParams.subscribe((params: any) => {
      this.selectedRole = params['role'] || '';
      this.selectedStatus = params['status'] || '';
      this.search = params['search'] || '';
      this.sortBy = params['sort'] || 'newest';
      this.sortOrder = params['sortOrder'] || 'desc';
      this.startDate = params['startDate'] || '';
      this.endDate = params['endDate'] || '';
      this.pagination.page = parseInt(params['page'], 10) || 1;
      this.cdr.markForCheck();
      this.fetchUsers();
    });
  }

  private updateUrlParams(): void {
    const queryParams: any = {};
    if (this.search) queryParams.search = this.search;
    if (this.selectedRole) queryParams.role = this.selectedRole;
    if (this.selectedStatus) queryParams.status = this.selectedStatus;
    if (this.startDate) queryParams.startDate = this.startDate;
    if (this.endDate) queryParams.endDate = this.endDate;
    if (this.sortBy && this.sortBy !== 'createdAt' && this.sortBy !== 'newest') queryParams.sort = this.sortBy;
    if (this.sortOrder && this.sortOrder !== 'desc') queryParams.sortOrder = this.sortOrder;
    if (this.pagination.page > 1) queryParams.page = this.pagination.page;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true
    });
  }

  ngOnDestroy(): void {
    if (this.rowClickTimeout) {
      clearTimeout(this.rowClickTimeout);
    }
    document.body.style.overflow = '';
    this.searchSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.fetchSub?.unsubscribe();
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

  removeFilter(type: 'search' | 'role' | 'status' | 'dateRange'): void {
    if (type === 'search') this.search = '';
    if (type === 'role') this.selectedRole = '';
    if (type === 'status') this.selectedStatus = '';
    if (type === 'dateRange') { this.startDate = ''; this.endDate = ''; }
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  get activeFilterPills(): { key: 'search' | 'role' | 'status' | 'dateRange'; label: string }[] {
    const pills: { key: 'search' | 'role' | 'status' | 'dateRange'; label: string }[] = [];
    if (this.search) pills.push({ key: 'search', label: `Search: "${this.search}"` });
    if (this.selectedRole) pills.push({ key: 'role', label: `Role: ${this.selectedRole}` });
    if (this.selectedStatus) pills.push({ key: 'status', label: `Status: ${this.selectedStatus === 'true' ? 'Active' : 'Suspended'}` });
    if (this.startDate || this.endDate) pills.push({ key: 'dateRange', label: `Date: ${this.startDate || '...'} to ${this.endDate || '...'}` });
    return pills;
  }

  fetchUsers(): void {
    const params: any = {
      page: this.pagination.page,
      limit: this.pagination.limit,
      role: this.selectedRole || undefined,
      isActive: this.selectedStatus ? this.selectedStatus === 'true' : undefined,
      search: this.search || undefined,
      sort: this.sortBy,
      sortOrder: this.sortOrder
    };
    if (this.startDate) params.startDate = this.startDate;
    if (this.endDate) params.endDate = this.endDate;

    const cached = this.swrCache.get<any>('users', params);
    if (cached && cached.success) {
      this.users = cached.data || [];
      this.selection.retainOnly(this.users.map(u => u.id));
      this.pagination = cached.pagination || this.pagination;
      if (cached.summary) {
        this.globalTotalUsers = cached.summary.totalUsers;
        this.globalAdminCount = cached.summary.totalAdmins;
        this.globalLawyerCount = cached.summary.totalLawyers;
        this.globalClientCount = cached.summary.totalClients;
        this.globalTwoFactorPct = cached.summary.twoFactorPct;
        this.updateDropdownCounts();
      }
      this.isLoading = false;
      this.isInitialLoad = false;
      this.cdr.markForCheck();
    }

    const showLoader = this.isInitialLoad && !cached;

    this.fetchSub?.unsubscribe();

    this.fetchSub = this.api.getUsers(params).pipe(smartLoading(l => { this.isLoading = l; this.cdr.markForCheck(); }, showLoader)).subscribe({
      next: (res) => {
        this.isInitialLoad = false;
        if (res.success) {
          this.users = this.sortData(res.data || []);
          this.pagination = res.pagination;

          if (res.summary) {
            this.globalTotalUsers = res.summary.totalUsers;
            this.globalAdminCount = res.summary.totalAdmins;
            this.globalLawyerCount = res.summary.totalLawyers;
            this.globalClientCount = res.summary.totalClients;
            this.globalTwoFactorPct = res.summary.twoFactorPct;
            this.updateDropdownCounts();
          }

          this.swrCache.set('users', params, res);
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isInitialLoad = false;
        if (!cached) {
          this.toast.error(err?.error?.message || 'Failed to load users.');
        }
        this.cdr.markForCheck();
      }
    });
  }

  onSearch(): void {
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  onFilterChange(): void {
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  refreshData(): void {
    this.toast.info('Refreshing user directory records...');
    this.swrCache.invalidate('users');
    this.fetchUsers();
  }

  private updateDropdownCounts(): void {
    this.roleOptions = [
      { label: 'All User Roles', value: '', icon: 'info', color: '#818cf8', count: this.globalTotalUsers },
      { label: 'Client Accounts', value: 'Client', icon: 'user', color: '#38bdf8', count: this.globalClientCount },
      { label: 'Lawyer Accounts', value: 'Lawyer', icon: 'award', color: '#818cf8', count: this.globalLawyerCount },
      { label: 'Administrator Accounts', value: 'Admin', icon: 'key', color: '#c084fc', count: this.globalAdminCount }
    ];
    this.statusOptions = [
      { label: 'All Statuses', value: '', icon: 'info', color: '#818cf8', count: this.globalTotalUsers },
      { label: 'Active Accounts', value: 'true', icon: 'check', color: '#10b981' },
      { label: 'Suspended Accounts', value: 'false', icon: 'shield', color: '#f43f5e' }
    ];
  }

  get activeQueryParamsObj(): Record<string, any> {
    const obj: Record<string, any> = {};
    if (this.search) obj['search'] = this.search;
    if (this.selectedRole) obj['role'] = this.selectedRole;
    if (this.selectedStatus) obj['status'] = this.selectedStatus;
    if (this.startDate) obj['startDate'] = this.startDate;
    if (this.endDate) obj['endDate'] = this.endDate;
    if (this.sortBy && this.sortBy !== 'newest') obj['sort'] = this.sortBy;
    if (this.sortOrder && this.sortOrder !== 'desc') obj['sortOrder'] = this.sortOrder;
    return obj;
  }

  onSavedViewApply(savedParams: any): void {
    this.search = savedParams?.['search'] || '';
    this.selectedRole = savedParams?.['role'] || '';
    this.selectedStatus = savedParams?.['status'] || '';
    this.startDate = savedParams?.['startDate'] || '';
    this.endDate = savedParams?.['endDate'] || '';
    this.sortBy = savedParams?.['sort'] || 'newest';
    this.sortOrder = savedParams?.['sortOrder'] || 'desc';
    this.pagination.page = 1;
    this.updateUrlParams();
    this.cdr.markForCheck();
  }

  resetFilters(): void {
    this.search = '';
    this.selectedRole = '';
    this.selectedStatus = '';
    this.startDate = '';
    this.endDate = '';
    this.sortBy = 'newest';
    this.sortOrder = 'desc';
    this.resetColumnVisibility();
    this.selection.clear();
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  onPageChange(newPage: number): void {
    if (newPage >= 1 && newPage <= this.pagination.pages) {
      this.pagination.page = newPage;
      this.updateUrlParams();
    }
  }

  onLimitChange(newLimit: number | any): void {
    this.pagination.limit = Number(newLimit) || 10;
    this.pagination.page = 1;
    this.updateUrlParams();
  }

  async toggleActive(user: any): Promise<void> {
    const isDeactivating = user.isActive;
    const action = isDeactivating ? 'deactivate' : 'activate';
    const confirmed = await this.dialog.confirm({
      title: `Confirm Account ${isDeactivating ? 'Deactivation' : 'Activation'}`,
      message: `Are you sure you want to ${action} user "${user.fullName}"?`,
      type: isDeactivating ? 'danger' : 'success',
      confirmText: isDeactivating ? 'Deactivate Account' : 'Activate Account'
    });

    if (confirmed) {
      const prevStatus = user.isActive;
      user.isActive = !prevStatus;

      this.api.updateUser(user.id, { isActive: user.isActive }).subscribe({
        next: () => {
          this.toast.success(`Account for ${user.fullName} is now ${user.isActive ? 'Active' : 'Deactivated'}.`);
          this.cdr.markForCheck();
        },
        error: (err) => {
          user.isActive = prevStatus;
          this.toast.error(err?.error?.message || 'Status update failed on server.');
          this.cdr.markForCheck();
        }
      });
    }
  }

  // -- Bulk Actions & CSV Export --
  selection = new TableSelection<number>();

  get userIds(): number[] {
    return this.users.map(u => u.id);
  }

  get isAllPageSelected(): boolean {
    return this.users.length > 0 && this.users.every(u => this.selection.isSelected(u.id));
  }

  isAllSelected(): boolean {
    return this.isAllPageSelected;
  }

  toggleSelectAll(): void {
    if (this.isAllPageSelected) {
      this.selection.clear();
    } else {
      this.users.forEach(u => this.selection.selectedIds.add(u.id));
    }
    this.cdr.markForCheck();
  }

  async bulkUpdateStatus(active: boolean): Promise<void> {
    if (this.selection.isEmpty) return;
    const action = active ? 'activate' : 'suspend';
    const confirmed = await this.dialog.confirm({
      title: `Bulk Account ${active ? 'Activation' : 'Suspension'}`,
      message: `Are you sure you want to ${action} ${this.selection.size} selected user account(s)?`,
      type: active ? 'success' : 'danger',
      confirmText: active ? 'Bulk Activate' : 'Bulk Suspend'
    });

    if (confirmed) {
      const ids = this.selection.toArray();
      this.users.forEach(u => {
        if (this.selection.isSelected(u.id)) {
          u.isActive = active;
        }
      });
      this.api.bulkUpdateUserStatus(ids, active).subscribe({
        next: () => {
          this.toast.success(`Bulk ${action} applied to ${ids.length} selected accounts.`);
          this.selection.clear();
          this.cdr.markForCheck();
          this.fetchUsers();
        },
        error: (err) => {
          this.toast.error(err?.error?.message || 'Bulk status update failed.');
          this.cdr.markForCheck();
          this.fetchUsers();
        }
      });
    }
  }

  isExporting = false;

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
      const selectedUsers = this.users.filter(u => this.selection.isSelected(u.id));
      this.exportUserData(selectedUsers, config.columns);
      return;
    }

    this.api.getUsers({
      search: this.search || undefined,
      role: this.selectedRole || undefined,
      status: this.selectedStatus || undefined,
      page: 1,
      limit: 5000
    }).subscribe({
      next: (res: any) => {
        const fullList = res.data || res.users || res || [];
        if (!fullList.length) {
          this.isExporting = false;
          this.toast.warning('No user records available to export.');
          this.cdr.markForCheck();
          return;
        }
        this.exportUserData(fullList, config.columns);
      },
      error: () => {
        this.isExporting = false;
        this.toast.error('Failed to fetch complete user records for export.');
        this.cdr.markForCheck();
      }
    });
  }

  private exportUserData(data: any[], columnKeys: string[]): void {
    const columnMap: Record<string, { header: string; extract: (u: any) => any }> = {
      id: { header: 'ID', extract: u => u.id },
      fullName: { header: 'Full Name', extract: u => u.fullName || '' },
      email: { header: 'Email', extract: u => u.email || '' },
      role: { header: 'Role', extract: u => u.role || '' },
      city: { header: 'City', extract: u => u.clientCity || '' },
      phone: { header: 'Phone', extract: u => u.phone || '' },
      emailVerified: { header: 'Email Verified', extract: u => u.isEmailVerified ? 'Yes' : 'No' },
      activeStatus: { header: 'Active Status', extract: u => u.isActive ? 'Active' : 'Suspended' },
      createdAt: { header: 'Created At', extract: u => u.createdAt || '' }
    };

    const activeCols = columnKeys.map(k => columnMap[k]).filter(Boolean);
    const headers = activeCols.map(c => c.header);
    const rows = data.map(u => activeCols.map(c => c.extract(u)));

    try {
      CsvExporter.export('legalconnect_user_directory_audit', headers, rows);
      this.toast.success(`Exported ${data.length} user records (${headers.length} columns) to CSV.`);
    } catch (err: any) {
      this.toast.error(err.message || 'Export failed.');
    }
    this.isExporting = false;
    this.isExportModalOpen = false;
    this.cdr.markForCheck();
  }

  getOpenActionUser(): any | null {
    if (!this.openActionMenuId) return null;
    return this.users.find(u => u.id === this.openActionMenuId) || null;
  }

  getOpenActionItem(): any | null {
    return this.getOpenActionUser();
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
}