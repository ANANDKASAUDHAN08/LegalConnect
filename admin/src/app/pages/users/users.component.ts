import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { ActivatedRoute } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { smartLoading } from '../../core/utils/smart-loading.operator';
import { Subject } from 'rxjs';

@Component({
  selector: 'admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective, SelectComponent],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  users: any[] = [];
  isLoading = false;
  isInitialLoad = true;
  search = '';
  private searchSubject$ = new Subject<string>();

  selectedRole = '';
  selectedStatus = '';
  sortBy = 'newest';

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
    { label: 'Name (A-Z)', value: 'name', icon: 'user' }
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

  selectedUserDetail: any = null;

  editingUser: any = null;
  editForm: any = {};

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.searchSubject$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.search = query;
      this.pagination.page = 1;
      this.fetchUsers();
    });

    this.route.queryParams.subscribe(params => {
      if (params['role']) {
        this.selectedRole = params['role'];
      }
      if (params['sort']) {
        this.sortBy = params['sort'];
      }
      this.fetchUsers();
    });
  }

  onSearchInput(val: string): void {
    this.searchSubject$.next(val);
  }

  fetchUsers(): void {
    const isFirstTime = this.isInitialLoad;
    const params = {
      page: this.pagination.page,
      limit: this.pagination.limit,
      role: this.selectedRole || undefined,
      isActive: this.selectedStatus ? this.selectedStatus === 'true' : undefined,
      search: this.search || undefined,
      sort: this.sortBy
    };

    this.api.getUsers(params).pipe(smartLoading(l => this.isLoading = l, isFirstTime)).subscribe({
      next: (res) => {
        this.isInitialLoad = false;
        if (res.success) {
          this.users = res.data;
          this.pagination = res.pagination;
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
    this.fetchUsers();
  }

  resetFilters(): void {
    this.search = '';
    this.selectedRole = '';
    this.selectedStatus = '';
    this.sortBy = 'newest';
    this.pagination.page = 1;
    this.fetchUsers();
  }

  changePage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.pagination.pages) {
      this.pagination.page = newPage;
      this.fetchUsers();
    }
  }

  viewUser(id: number): void {
    this.api.getUser(id).subscribe({
      next: (res) => this.selectedUserDetail = res,
      error: (err) => this.toast.error(err?.error?.message || 'Failed to view user details.')
    });
  }

  closeViewModal(): void {
    this.selectedUserDetail = null;
  }

  openEditModal(user: any): void {
    this.editingUser = user;
    this.editForm = { ...user };
  }

  closeEditModal(): void {
    this.editingUser = null;
    this.editForm = {};
  }

  saveUserEdit(): void {
    if (!this.editingUser) return;
    this.api.updateUser(this.editingUser.id, this.editForm).subscribe({
      next: () => {
        this.toast.success(`User profile "${this.editForm.fullName}" updated successfully.`);
        this.closeEditModal();
        this.fetchUsers();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Failed to update user profile.')
    });
  }

  async toggleActive(user: any): Promise<void> {
    const action = user.isActive ? 'deactivate' : 'activate';
    const confirmed = await this.dialog.warning(
      `Confirm Account ${user.isActive ? 'Deactivation' : 'Activation'}`,
      `Are you sure you want to ${action} user "${user.fullName}"?`
    );

    if (confirmed) {
      const prevStatus = user.isActive;
      // Optimistic UI update: instantly mutate local state
      user.isActive = !prevStatus;
      this.toast.success(`Account for ${user.fullName} is now ${user.isActive ? 'Active' : 'Deactivated'}.`);

      if (prevStatus) {
        this.api.deleteUser(user.id).subscribe({
          error: (err) => {
            user.isActive = prevStatus; // Rollback
            this.toast.error(err?.error?.message || 'Deactivation failed on server.');
          }
        });
      } else {
        this.api.updateUser(user.id, { isActive: true }).subscribe({
          error: (err) => {
            user.isActive = prevStatus; // Rollback
            this.toast.error(err?.error?.message || 'Activation failed on server.');
          }
        });
      }
    }
  }

  triggerPasswordReset(id: number): void {
    this.api.resetUserPassword(id).subscribe({
      next: (res) => {
        this.toast.info(`Temporary Password: ${res.tempPassword}`, 'Password Reset');
      },
      error: (err) => this.toast.error(err?.error?.message || 'Password reset failed.')
    });
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
      type: active ? 'info' : 'warning',
      confirmText: `Bulk ${action.toUpperCase()}`
    });

    if (confirmed) {
      const ids = Array.from(this.selectedUserIds);
      // Optimistic UI Update: instantly update matching local rows
      this.users.forEach(u => {
        if (this.selectedUserIds.has(u.id)) {
          u.isActive = active;
        }
      });
      this.toast.success(`Bulk ${action} applied to ${ids.length} selected accounts.`);
      this.selectedUserIds.clear();

      ids.forEach(id => {
        if (!active) {
          this.api.deleteUser(id).subscribe();
        } else {
          this.api.updateUser(id, { isActive: true }).subscribe();
        }
      });
    }
  }

  exportToCsv(): void {
    if (!this.users.length) {
      this.toast.warning('No user records available to export.');
      return;
    }
    const headers = ['ID', 'Full Name', 'Email', 'Role', 'City', 'Phone', 'Email Verified', 'Active Status', 'Created At'];
    const rows = this.users.map(u => [
      u.id,
      `"${u.fullName || ''}"`,
      `"${u.email || ''}"`,
      u.role || '',
      `"${u.clientCity || ''}"`,
      `"${u.phone || ''}"`,
      u.isEmailVerified ? 'Yes' : 'No',
      u.isActive ? 'Active' : 'Suspended',
      u.createdAt || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `legalconnect_users_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toast.success(`Exported ${this.users.length} user records to CSV.`);
  }
}