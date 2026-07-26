import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { ActiveSessionItem, LoginHistoryItem } from '../../core/models/admin.models';

import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'admin-security',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, TooltipDirective],
  templateUrl: './security.component.html',
  styleUrl: './security.component.scss'
})
export class SecurityComponent implements OnInit {
  activeTab: 'sessions' | 'logs' = 'sessions';
  sessions: ActiveSessionItem[] = [];
  loginLogs: LoginHistoryItem[] = [];
  isLoading = false;
  statusFilter = '';

  constructor(
    private api: AdminApiService,
    private toast: ToastService,
    private dialog: DialogService,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'logs' || params['status']) {
        this.activeTab = 'logs';
        if (params['status']) {
          this.statusFilter = params['status'];
        }
        this.fetchLoginLogs();
      } else {
        this.activeTab = 'sessions';
        this.fetchSessions();
      }
    });
  }

  fetchSessions(): void {
    this.isLoading = true;
    this.api.getActiveSessions().subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.sessions = res.data || [];
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error(err?.error?.message || 'Failed to fetch active sessions.');
      }
    });
  }

  fetchLoginLogs(): void {
    this.isLoading = true;
    this.api.getLoginHistory({ page: 1, limit: 20, status: this.statusFilter || undefined }).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.loginLogs = res.data || [];
      },
      error: (err: any) => {
        this.isLoading = false;
        this.toast.error(err?.error?.message || 'Failed to fetch login history.');
      }
    });
  }

  async forceLogout(id: number): Promise<void> {
    const confirmed = await this.dialog.danger(
      'Revoke Active Session',
      'Are you sure you want to revoke this user session immediately? The user will be signed out.'
    );

    if (confirmed) {
      this.api.forceLogout(id).subscribe({
        next: () => {
          this.toast.success('Session revoked successfully.');
          this.fetchSessions();
        },
        error: (err: any) => this.toast.error(err?.error?.message || 'Revoke failed.')
      });
    }
  }
}