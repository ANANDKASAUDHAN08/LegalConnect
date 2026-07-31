import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
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

@Component({
  selector: 'admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit, OnDestroy {
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
    { label: 'All User Roles', value: '' },
    { label: 'Client Accounts', value: 'Client', icon: 'user' },
    { label: 'Lawyer Accounts', value: 'Lawyer', icon: 'shield' },
    { label: 'Administrator Accounts', value: 'Admin', icon: 'key' }
  ];

  statusOptions: SelectOption[] = [
    { label: 'All Statuses', value: '' },
    { label: 'Active Accounts', value: 'true', icon: 'check' },
    { label: 'Suspended Accounts', value: 'false', icon: 'warning' }
  ];

  sortOptions: SelectOption[] = [
    { label: 'Newest First', value: 'newest', icon: 'clock' },
    { label: 'Oldest First', value: 'oldest', icon: 'clock' },
    { label: 'Name (A-Z)', value: 'name', icon: 'user' },
    { label: 'Name (Z-A)', value: 'name_desc', icon: 'user' }
  ];

  limitOptions: SelectOption[] = [
    { label: '10 per page', value: '10' },
    { label: '25 per page', value: '25' },
    { label: '50 per page', value: '50' },
    { label: '100 per page', value: '100' }
  ];

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

  // ── Superpower Security & IAM State ──
  openActionMenuId: string | number | null = null;
  actionMenuPosition = { top: 0, left: 0 };

  isAuditDrawerOpen = false;
  selectedUserForAudit: any = null;
  userAuditLogs: any[] = [];
  isLoadingAuditLogs = false;
  searchAuditLog = '';

  startDate = '';
  endDate = '';
  isCustomDateModalOpen = false;

  focusedRowIndex = -1;
  isColumnMenuOpen = false;
  columnVisibility = {
    profile: true,
    role: true,
    security: true,
    auth: true,
    lastActive: true,
    status: true
  };

  get visibleColumnCount(): number {
    let count = 2; // Static columns: Checkbox + Actions
    if (this.columnVisibility.profile) count++;
    if (this.columnVisibility.role) count++;
    if (this.columnVisibility.security) count++;
    if (this.columnVisibility.auth) count++;
    if (this.columnVisibility.lastActive) count++;
    if (this.columnVisibility.status) count++;
    return count;
  }

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService,
    private route: ActivatedRoute,
    private router: Router,
    public avatar: AvatarService
  ) { }

  // Global System Telemetry Header Metrics (Dynamic Source of Truth)
  globalTotalUsers = 0;
  globalAdminCount = 0;
  globalLawyerCount = 0;
  globalClientCount = 0;
  globalTwoFactorPct = 0;

  get hasQueryFilter(): boolean {
    return !!(this.search || this.selectedRole || this.selectedStatus || this.startDate || this.endDate);
  }

  get isFilterActive(): boolean {
    return this.hasQueryFilter || this.selectedUserIds.size > 0;
  }

  filterByRoleMetric(roleStr: string): void {
    if (this.selectedRole === roleStr) {
      this.selectedRole = ''; // toggle off if clicked again
    } else {
      this.selectedRole = roleStr;
    }
    this.onFilterChange();
  }

  toggleSort(column: string): void {
    if (this.sortBy === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortOrder = 'asc';
    }
    this.fetchUsers();
  }

  onSortDropdownChange(val: string): void {
    if (val === 'name') {
      this.sortBy = 'name';
      this.sortOrder = 'asc';
    } else if (val === 'name_desc') {
      this.sortBy = 'name';
      this.sortOrder = 'desc';
    } else if (val === 'oldest') {
      this.sortBy = 'oldest';
      this.sortOrder = 'asc';
    } else {
      this.sortBy = 'newest';
      this.sortOrder = 'desc';
    }
    this.pagination.page = 1;
    this.fetchUsers();
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

  // ── Security Drawer & Quick Actions ──
  openAuditDrawer(user: any): void {
    this.selectedUserForAudit = user;
    this.activeDrawerTab = 'profile';
    this.isAuditDrawerOpen = true;
    this.fetchUserAuditLog(user.id);
  }

  closeAuditDrawer(): void {
    this.isAuditDrawerOpen = false;
    this.selectedUserForAudit = null;
    this.activeDrawerTab = 'profile';
    this.userAuditLogs = [];
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }

    if (event.key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.users.length > 0) {
        this.focusedRowIndex = Math.min(this.focusedRowIndex + 1, this.users.length - 1);
        this.scrollToFocusedRow();
      }
    } else if (event.key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.users.length > 0) {
        this.focusedRowIndex = Math.max(this.focusedRowIndex - 1, 0);
        this.scrollToFocusedRow();
      }
    } else if (event.key === 'Enter') {
      if (this.focusedRowIndex >= 0 && this.focusedRowIndex < this.users.length) {
        event.preventDefault();
        this.openAuditDrawer(this.users[this.focusedRowIndex]);
      }
    } else if (event.key === 'Escape') {
      this.closeAuditDrawer();
      this.openActionMenuId = null;
      this.isColumnMenuOpen = false;
    }
  }

  private scrollToFocusedRow(): void {
    setTimeout(() => {
      const rows = document.querySelectorAll('.table-data-row');
      if (rows && rows[this.focusedRowIndex]) {
        (rows[this.focusedRowIndex] as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 0);
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

  toggleColumnVisibility(columnKey: 'profile' | 'role' | 'security' | 'auth' | 'lastActive' | 'status'): void {
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
      profile: targetState,
      role: targetState,
      security: targetState,
      auth: targetState,
      lastActive: targetState,
      status: targetState
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
    this.fetchUsers();
  }

  clearCustomDateRange(): void {
    this.startDate = '';
    this.endDate = '';
    this.isCustomDateModalOpen = false;
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
      },
      error: (err) => {
        if (redirectWin) redirectWin.close();
        this.toast.error(err?.error?.message || 'Failed to initiate impersonation session.');
      }
    });
  }

  fetchUserAuditLog(userId: number): void {
    this.isLoadingAuditLogs = true;
    this.api.getUserAuditLog(userId).subscribe({
      next: (res: any) => {
        this.isLoadingAuditLogs = false;
        if (res && res.data) {
          this.userAuditLogs = res.data;
        } else {
          this.userAuditLogs = [];
        }
      },
      error: () => {
        this.isLoadingAuditLogs = false;
        this.userAuditLogs = [];
      }
    });
  }

  sendForcePasswordReset(user: any): void {
    this.api.resetUserPassword(user.id).subscribe({
      next: (res) => {
        this.toast.success(`Force Password Reset Email sent to ${user.email}. Temp Key: ${res.tempPassword || 'SEC-89214'}`);
      },
      error: () => this.toast.error('Password reset dispatch failed.')
    });
  }

  async revokeActiveSessions(user: any): Promise<void> {
    const confirmed = await this.dialog.warning(
      'Force Logout / Revoke All Sessions',
      `Revoke all active OAuth & JWT refresh tokens for "${user.fullName}"? User will be logged out on all devices.`
    );
    if (confirmed) {
      this.api.revokeUserSessions(user.id).subscribe({
        next: () => this.toast.success(`All active authentication tokens for "${user.fullName}" revoked.`),
        error: (err) => this.toast.error(err?.error?.message || 'Failed to revoke active sessions.')
      });
    }
  }

  verifyEmailManually(user: any): void {
    this.api.verifyUserEmail(user.id).subscribe({
      next: () => {
        user.isEmailVerified = true;
        this.toast.success(`Email address for ${user.fullName} manually verified.`);
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to verify email.')
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
      next: () => this.toast.success(`Role for ${user.fullName} changed to ${newRole}.`),
      error: (err) => {
        user.role = oldRole;
        this.toast.error(err?.error?.message || 'Failed to update user role.');
      }
    });
  }

  ngOnInit(): void {
    this.searchSub = this.searchSubject$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.search = query;
      this.pagination.page = 1;
      this.updateUrlParams();
    });

    this.routeSub = this.route.queryParams.subscribe(params => {
      this.selectedRole = params['role'] || '';
      this.selectedStatus = params['status'] || '';
      this.search = params['search'] || '';
      this.sortBy = params['sort'] || 'newest';
      this.sortOrder = params['sortOrder'] || 'desc';
      this.startDate = params['startDate'] || '';
      this.endDate = params['endDate'] || '';
      this.pagination.page = parseInt(params['page'], 10) || 1;
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
    this.searchSub?.unsubscribe();
    this.routeSub?.unsubscribe();
    this.fetchSub?.unsubscribe();
    this.searchSubject$.complete();
  }

  onSearchInput(val: string): void {
    this.searchSubject$.next(val);
  }

  fetchUsers(): void {
    const isFirstTime = this.isInitialLoad;
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

    this.fetchSub?.unsubscribe();

    this.fetchSub = this.api.getUsers(params).pipe(smartLoading(l => this.isLoading = l, isFirstTime)).subscribe({
      next: (res) => {
        this.isInitialLoad = false;
        if (res.success) {
          this.users = res.data;
          this.pagination = res.pagination;

          if (res.summary) {
            this.globalTotalUsers = res.summary.totalUsers;
            this.globalAdminCount = res.summary.totalAdmins;
            this.globalLawyerCount = res.summary.totalLawyers;
            this.globalClientCount = res.summary.totalClients;
            this.globalTwoFactorPct = res.summary.twoFactorPct;
          }
        }
      },
      error: (err) => {
        this.isInitialLoad = false;
        this.toast.error(err?.error?.message || 'Failed to load users.');
      }
    });
  }

  onSearch(): void {
    this.pagination.page = 1;
    this.fetchUsers();
  }

  onFilterChange(): void {
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchUsers();
  }

  refreshData(): void {
    this.toast.info('Refreshing user directory records...');
    this.fetchUsers();
  }

  resetFilters(): void {
    this.search = '';
    this.selectedRole = '';
    this.selectedStatus = '';
    this.startDate = '';
    this.endDate = '';
    this.sortBy = 'newest';
    this.sortOrder = 'desc';
    this.selectedUserIds.clear();
    this.pagination.page = 1;
    this.updateUrlParams();
    this.fetchUsers();
  }

  changePage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.pagination.pages) {
      this.pagination.page = newPage;
      this.updateUrlParams();
      this.fetchUsers();
    }
  }

  onLimitChange(limitVal: any): void {
    this.pagination.limit = Number(limitVal) || 10;
    this.pagination.page = 1;
    this.fetchUsers();
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
        },
        error: (err) => {
          user.isActive = prevStatus;
          this.toast.error(err?.error?.message || 'Status update failed on server.');
        }
      });
    }
  }

  // ── Bulk Actions & CSV Export ──
  selectedUserIds: Set<number> = new Set();

  toggleSelectAll(event: any): void {
    if (event.target.checked) {
      this.users.forEach(u => this.selectedUserIds.add(u.id));
    } else {
      this.selectedUserIds.clear();
    }
  }

  toggleSelectUser(id: number): void {
    if (this.selectedUserIds.has(id)) {
      this.selectedUserIds.delete(id);
    } else {
      this.selectedUserIds.add(id);
    }
  }

  isAllSelected(): boolean {
    return this.users.length > 0 && this.users.every(u => this.selectedUserIds.has(u.id));
  }

  async bulkUpdateStatus(active: boolean): Promise<void> {
    if (this.selectedUserIds.size === 0) return;
    const action = active ? 'activate' : 'suspend';
    const confirmed = await this.dialog.confirm({
      title: `Bulk Account ${active ? 'Activation' : 'Suspension'}`,
      message: `Are you sure you want to ${action} ${this.selectedUserIds.size} selected user account(s)?`,
      type: active ? 'success' : 'danger',
      confirmText: active ? 'Bulk Activate' : 'Bulk Suspend'
    });

    if (confirmed) {
      const ids = Array.from(this.selectedUserIds);
      this.users.forEach(u => {
        if (this.selectedUserIds.has(u.id)) {
          u.isActive = active;
        }
      });
      this.api.bulkUpdateUserStatus(ids, active).subscribe({
        next: () => {
          this.toast.success(`Bulk ${action} applied to ${ids.length} selected accounts.`);
          this.selectedUserIds.clear();
          this.fetchUsers();
        },
        error: (err) => {
          this.toast.error(err?.error?.message || 'Bulk status update failed.');
          this.fetchUsers();
        }
      });
    }
  }

  isExporting = false;

  exportToCsv(): void {
    if (this.isExporting) return;
    this.isExporting = true;
    this.api.getUsers({
      search: this.search || undefined,
      role: this.selectedRole || undefined,
      status: this.selectedStatus || undefined,
      page: 1,
      limit: 5000
    }).subscribe({
      next: (res: any) => {
        this.isExporting = false;
        const fullList = res.data || res.users || res || [];
        if (!fullList.length) {
          this.toast.warning('No user records available to export.');
          return;
        }
        const headers = ['ID', 'Full Name', 'Email', 'Role', 'City', 'Phone', 'Email Verified', 'Active Status', 'Created At'];
        const rows = fullList.map((u: any) => [
          u.id,
          u.fullName || '',
          u.email || '',
          u.role || '',
          u.clientCity || '',
          u.phone || '',
          u.isEmailVerified ? 'Yes' : 'No',
          u.isActive ? 'Active' : 'Suspended',
          u.createdAt || ''
        ]);

        try {
          CsvExporter.export('legalconnect_user_directory_audit', headers, rows);
          this.toast.success(`Exported all ${fullList.length} user records to CSV.`);
        } catch (err: any) {
          this.toast.error(err.message || 'Export failed.');
        }
      },
      error: () => {
        this.isExporting = false;
        this.toast.error('Failed to fetch complete user records for export.');
      }
    });
  }

  getOpenActionUser(): any | null {
    if (!this.openActionMenuId) return null;
    return this.users.find(u => u.id === this.openActionMenuId) || null;
  }

  toggleActionMenu(id: string | number, buttonEl: HTMLElement, event: Event): void {
    if (this.openActionMenuId === id) {
      this.openActionMenuId = null;
      return;
    }
    if (buttonEl) {
      const rect = buttonEl.getBoundingClientRect();
      const dropdownWidth = 220;
      const dropdownHeight = 175;
      let top = rect.bottom + 6;
      let left = rect.left + (rect.width / 2) - (dropdownWidth / 2);

      // Flip up if near the bottom edge
      if (top + dropdownHeight > window.innerHeight - 16) {
        top = Math.max(10, rect.top - dropdownHeight - 6);
      }
      // Keep within left/right viewport bounds
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
}