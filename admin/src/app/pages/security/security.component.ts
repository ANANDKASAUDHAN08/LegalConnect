import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { ActiveSessionItem, LoginHistoryItem } from '../../core/models/admin.models';
import { ActivatedRoute } from '@angular/router';
import { CsvExporter } from '../../core/utils/csv-exporter';
import { TwoFactorEnforcerService } from '../../shared/services/two-factor-enforcer.service';

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
    private route: ActivatedRoute,
    private twoFactor: TwoFactorEnforcerService
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

  exportSessionsCsv(): void {
    if (!this.sessions.length) {
      this.toast.warning('No active session records to export.');
      return;
    }
    const headers = ['Session ID', 'User ID', 'IP Address', 'User Agent / Platform', 'Created At'];
    const rows = this.sessions.map(s => [
      s.id,
      s.userId,
      s.ipAddress || '',
      s.userAgent || '',
      s.createdAt || ''
    ]);

    try {
      CsvExporter.export('legalconnect_security_active_sessions_audit', headers, rows);
      this.toast.success(`Exported ${this.sessions.length} active session records for IT Act statutory compliance.`);
    } catch (err: any) {
      this.toast.error(err.message || 'Export failed.');
    }
  }

  exportLogsCsv(): void {
    if (!this.loginLogs.length) {
      this.toast.warning('No login audit history logs to export.');
      return;
    }
    const headers = ['Log ID', 'Email', 'IP Address', 'Login Status', 'Failure Reason', 'Timestamp'];
    const rows = this.loginLogs.map(l => [
      l.id,
      l.userEmail || (l as any).email || '',
      l.ipAddress || '',
      l.status || '',
      l.failureReason || 'N/A',
      l.loginTime || (l as any).createdAt || ''
    ]);

    try {
      CsvExporter.export('legalconnect_security_login_audit_history', headers, rows);
      this.toast.success(`Exported ${this.loginLogs.length} login audit log records.`);
    } catch (err: any) {
      this.toast.error(err.message || 'Export failed.');
    }
  }

  async forceLogout(id: number): Promise<void> {
    const confirmed = await this.dialog.danger(
      'Revoke Active Session',
      'Are you sure you want to revoke this user session immediately? The user will be signed out.'
    );

    if (!confirmed) return;

    // Enforce 2FA TOTP code prompt for session revocation
    const is2FaAuthorized = await this.twoFactor.prompt({
      title: '2FA Authorize Session Revocation',
      actionDescription: 'Revoking an active user session is a high-risk security operation. Enter your 6-digit TOTP authenticator code.'
    });

    if (!is2FaAuthorized) {
      this.toast.info('Session revocation cancelled: 2FA authorization required.');
      return;
    }

    this.api.forceLogout(id).subscribe({
      next: () => {
        this.toast.success('Session revoked successfully.');
        this.fetchSessions();
      },
      error: (err: any) => this.toast.error(err?.error?.message || 'Revoke failed.')
    });
  }
}