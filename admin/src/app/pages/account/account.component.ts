import { Component, OnInit, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AdminApiService } from '../../core/admin-api.service';
import { AdminAuthService } from '../../core/auth.service';
import { ToastService } from '../../shared/services/toast.service';
import { DialogService } from '../../shared/services/dialog.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { environment } from '../../../environments/environment';

export interface AccountAuditLog {
  id: number;
  ipAddress: string;
  userAgent: string;
  loginTime: string;
  status: string;
}

@Component({
  selector: 'admin-account',
  standalone: true,
  imports: [CommonModule, FormsModule, SkeletonComponent, TooltipDirective],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss'
})
export class AccountComponent implements OnInit {

  activeTab: 'info' | 'password' | '2fa' | 'sessions' | 'audit' = 'info';

  // -- Account Info & Profile Edit --
  profile: any = null;
  isLoadingProfile = true;
  isEditingProfile = false;
  isSavingProfile = false;

  editForm = {
    fullName: '',
    phone: '',
    clientBio: '',
    preferredTimezone: 'Asia/Kolkata',
    notifyLawAmendments: true,
    notifyEmailDigest: true,
    notifyPushEnabled: false
  };

  // Custom Glassmorphic Timezone Selector State
  isTimezoneDropdownOpen = false;
  timezoneOptions = [
    { value: 'Asia/Kolkata', flag: '🇮🇳', label: 'Asia/Kolkata', tz: 'IST - UTC+05:30' },
    { value: 'UTC', flag: '🌐', label: 'UTC', tz: 'Coordinated Universal Time' },
    { value: 'America/New_York', flag: '🇺🇸', label: 'America/New_York', tz: 'EST - UTC-05:00' },
    { value: 'Europe/London', flag: '🇬🇧', label: 'Europe/London', tz: 'GMT - UTC+00:00' },
    { value: 'Asia/Singapore', flag: '🇸🇬', label: 'Asia/Singapore', tz: 'SGT - UTC+08:00' }
  ];

  get selectedTimezoneObj() {
    return this.timezoneOptions.find(t => t.value === this.editForm.preferredTimezone) || this.timezoneOptions[0];
  }

  @ViewChild('tzContainer') tzContainer?: ElementRef;

  toggleTimezoneDropdown(event: Event): void {
    event.stopPropagation();
    this.isTimezoneDropdownOpen = !this.isTimezoneDropdownOpen;
  }

  selectTimezone(val: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.editForm.preferredTimezone = val;
    this.isTimezoneDropdownOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isTimezoneDropdownOpen) return;
    const targetElement = event.target as HTMLElement;
    if (this.tzContainer && !this.tzContainer.nativeElement.contains(targetElement)) {
      this.isTimezoneDropdownOpen = false;
    }
  }

  // -- Change Password --
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showCurrentPassword = false;
  showNewPassword = false;
  showConfirmPassword = false;
  isChangingPassword = false;

  // -- 2FA Management --
  is2FAEnabled = false;
  is2FALoading = false;

  // 2FA Setup Flow
  setupStep: 'idle' | 'qr' | 'verify' | 'done' = 'idle';
  totpSecret = '';
  qrUri = '';
  backupCodes: string[] = [];
  verifyCode = '';
  isVerifying = false;

  // 2FA Disable Flow
  disablePassword = '';
  showDisablePassword = false;
  isDisabling = false;

  // -- Sessions --
  sessions: any[] = [];
  isLoadingSessions = false;
  isRevokingOthers = false;

  // -- Security Activity Audit Log --
  auditLogs: AccountAuditLog[] = [];
  isLoadingAuditLogs = false;

  constructor(
    private api: AdminApiService,
    private auth: AdminAuthService,
    private http: HttpClient,
    private toast: ToastService,
    private dialog: DialogService,
    private el: ElementRef
  ) { }

  ngOnInit(): void {
    this.fetchProfile();
  }

  // -- Account Security Health Score Calculation ----------------

  get securityScore(): { score: number; label: string; colorClass: string; recommendations: string[] } {
    let score = 0;
    const recommendations: string[] = [];

    // 2FA check (35 points)
    if (this.is2FAEnabled) {
      score += 35;
    } else {
      recommendations.push('Enable Two-Factor Authentication (TOTP) to protect your account (+35%)');
    }

    // Password criteria check (30 points)
    if (this.newPassword ? this.passwordStrength.score >= 4 : true) {
      score += 30;
    } else {
      recommendations.push('Use a stronger password with uppercase, numbers, and symbols (+30%)');
    }

    // Email verification check (15 points)
    if (this.profile?.isEmailVerified ?? true) {
      score += 15;
    } else {
      recommendations.push('Verify your admin email address (+15%)');
    }

    // Phone number added (10 points)
    if (this.profile?.phone) {
      score += 10;
    } else {
      recommendations.push('Add a mobile phone number for security alerts (+10%)');
    }

    // Session hygiene check (10 points)
    if (this.sessions.length <= 3) {
      score += 10;
    } else {
      recommendations.push('Revoke inactive sessions to maintain session hygiene (+10%)');
    }

    let label = 'Needs Attention';
    let colorClass = 'score-badge-needs-attention';
    if (score >= 85) {
      label = 'Excellent';
      colorClass = 'score-badge-excellent';
    } else if (score >= 60) {
      label = 'Good';
      colorClass = 'score-badge-good';
    } else if (score >= 40) {
      label = 'Moderate';
      colorClass = 'score-badge-moderate';
    }

    return { score, label, colorClass, recommendations };
  }

  // -- Account Info & Profile Management ------------------------

  fetchProfile(): void {
    this.isLoadingProfile = true;
    this.http.get(`${environment.apiUrl}/me`).subscribe({
      next: (res: any) => {
        this.profile = res;
        this.is2FAEnabled = res.isTwoFactorEnabled ?? false;
        this.populateEditForm(res);
        this.isLoadingProfile = false;
      },
      error: () => {
        const user = this.auth.user;
        if (user) {
          this.profile = user;
          this.is2FAEnabled = (user as any).isTwoFactorEnabled ?? false;
          this.populateEditForm(user);
        }
        this.isLoadingProfile = false;
      }
    });
  }

  populateEditForm(data: any): void {
    this.editForm = {
      fullName: data.fullName || '',
      phone: data.phone || '',
      clientBio: data.clientBio || '',
      preferredTimezone: data.preferredTimezone || 'Asia/Kolkata',
      notifyLawAmendments: data.notifyLawAmendments ?? true,
      notifyEmailDigest: data.notifyEmailDigest ?? true,
      notifyPushEnabled: data.notifyPushEnabled ?? false
    };
  }

  refreshProfile(): void {
    this.http.get(`${environment.apiUrl}/me`).subscribe({
      next: (res: any) => {
        this.profile = res;
        this.is2FAEnabled = res.isTwoFactorEnabled ?? false;
        this.populateEditForm(res);
      }
    });
  }

  toggleProfileEdit(): void {
    this.isEditingProfile = !this.isEditingProfile;
    if (this.isEditingProfile && this.profile) {
      this.populateEditForm(this.profile);
    }
  }

  saveProfile(): void {
    if (!this.editForm.fullName.trim()) {
      this.toast.error('Full name is required.');
      return;
    }

    this.isSavingProfile = true;
    this.api.updateOwnProfile(this.editForm).subscribe({
      next: (res: any) => {
        this.isSavingProfile = false;
        this.isEditingProfile = false;
        this.toast.success('Profile updated successfully!');
        if (res.user) {
          this.profile = { ...this.profile, ...res.user };
        } else {
          this.refreshProfile();
        }
      },
      error: (err: any) => {
        this.isSavingProfile = false;
        this.toast.error(err?.error?.message || 'Failed to update profile.');
      }
    });
  }

  // -- Password Strength ----------------------------------------

  get passwordStrength(): { score: number; label: string; color: string } {
    const p = this.newPassword;
    if (!p) return { score: 0, label: '', color: '' };

    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { score: 2, label: 'Fair', color: 'bg-orange-500' };
    if (score === 3) return { score: 3, label: 'Good', color: 'bg-yellow-500' };
    if (score === 4) return { score: 4, label: 'Strong', color: 'bg-emerald-500' };
    return { score: 5, label: 'Excellent', color: 'bg-emerald-400' };
  }

  get passwordErrors(): string[] {
    const p = this.newPassword;
    if (!p) return [];
    const errors: string[] = [];
    if (p.length < 8) errors.push('At least 8 characters');
    if (!/[a-z]/.test(p)) errors.push('One lowercase letter');
    if (!/[A-Z]/.test(p)) errors.push('One uppercase letter');
    if (!/\d/.test(p)) errors.push('One digit');
    if (!/[^a-zA-Z0-9]/.test(p)) errors.push('One special character');
    return errors;
  }

  get hasMinLength(): boolean { return this.newPassword.length >= 8; }
  get hasUpper(): boolean { return /[A-Z]/.test(this.newPassword); }
  get hasLower(): boolean { return /[a-z]/.test(this.newPassword); }
  get hasNumber(): boolean { return /\d/.test(this.newPassword); }
  get hasSpecial(): boolean { return /[^a-zA-Z0-9]/.test(this.newPassword); }
  get passwordsMatch(): boolean { return !!this.confirmPassword && this.newPassword === this.confirmPassword; }

  get canSubmitPassword(): boolean {
    return !!this.currentPassword &&
      !!this.newPassword &&
      !!this.confirmPassword &&
      this.newPassword === this.confirmPassword &&
      this.passwordErrors.length === 0 &&
      !this.isChangingPassword;
  }

  changePassword(): void {
    if (!this.canSubmitPassword) return;

    this.isChangingPassword = true;
    this.api.changeOwnPassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.isChangingPassword = false;
        this.toast.success('Password changed successfully.');
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err: any) => {
        this.isChangingPassword = false;
        this.toast.error(err?.error?.message || 'Failed to change password.');
      }
    });
  }

  // -- 2FA Management -------------------------------------------

  initiate2FASetup(): void {
    this.is2FALoading = true;
    this.setupStep = 'idle';
    this.api.setup2FA().subscribe({
      next: (res: any) => {
        this.is2FALoading = false;
        this.totpSecret = res.secret;
        this.qrUri = res.qrUri;
        this.backupCodes = res.backupCodes || [];
        this.setupStep = 'qr';
      },
      error: (err: any) => {
        this.is2FALoading = false;
        this.toast.error(err?.error?.message || 'Failed to initiate 2FA setup.');
      }
    });
  }

  proceedToVerify(): void {
    this.setupStep = 'verify';
    this.verifyCode = '';
  }

  verify2FACode(): void {
    if (!this.verifyCode || this.verifyCode.length !== 6) {
      this.toast.error('Enter a valid 6-digit code.');
      return;
    }

    this.isVerifying = true;
    this.api.verify2FA(this.verifyCode).subscribe({
      next: () => {
        this.isVerifying = false;
        this.is2FAEnabled = true;
        this.setupStep = 'done';
        this.toast.success('Two-factor authentication activated!');
        this.refreshProfile();
      },
      error: (err: any) => {
        this.isVerifying = false;
        this.toast.error(err?.error?.message || 'Verification failed. Try again.');
      }
    });
  }

  reset2FASetup(): void {
    this.setupStep = 'idle';
    this.totpSecret = '';
    this.qrUri = '';
    this.backupCodes = [];
    this.verifyCode = '';
  }

  submitDisable2FA(): void {
    if (!this.disablePassword) {
      this.toast.error('Enter your password to confirm.');
      return;
    }

    this.isDisabling = true;
    this.api.disable2FA(this.disablePassword).subscribe({
      next: () => {
        this.isDisabling = false;
        this.is2FAEnabled = false;
        this.disablePassword = '';
        this.toast.success('2FA has been disabled.');
        this.refreshProfile();
        this.reset2FASetup();
      },
      error: (err: any) => {
        this.isDisabling = false;
        this.toast.error(err?.error?.message || 'Failed to disable 2FA.');
      }
    });
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.toast.success('Copied to clipboard!');
    }).catch(() => {
      this.toast.error('Failed to copy.');
    });
  }

  copyAllBackupCodes(): void {
    const text = this.backupCodes.join('\n');
    this.copyToClipboard(text);
  }

  downloadBackupCodesTxt(): void {
    if (!this.backupCodes.length) return;
    const content = `LEGALCONNECT ADMIN - 2FA BACKUP RECOVERY CODES\nGenerated: ${new Date().toLocaleString()}\nEmail: ${this.profile?.email || 'Admin'}\n\n` +
      `Keep these codes in a safe place. Each code can be used ONLY once:\n\n` +
      this.backupCodes.map((code, idx) => `${idx + 1}. ${code}`).join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `legalconnect-2fa-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Backup codes file downloaded!');
  }

  printBackupCodes(): void {
    if (!this.backupCodes.length) return;
    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>2FA Backup Codes - LegalConnect Admin</title>
          <style>
            body { font-family: monospace; padding: 2rem; }
            h2 { font-family: sans-serif; color: #1e293b; }
            .code-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 1rem; }
            .code-item { font-size: 14px; font-weight: bold; background: #f1f5f9; padding: 8px; border-radius: 6px; text-align: center; }
          </style>
        </head>
        <body>
          <h2>LegalConnect Admin - 2FA Backup Codes</h2>
          <p>Account: <strong>${this.profile?.email || 'Admin'}</strong></p>
          <p>Generated: ${new Date().toLocaleString()}</p>
          <hr />
          <div class="code-grid">
            ${this.backupCodes.map(c => `<div class="code-item">${c}</div>`).join('')}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  // -- Sessions Management --------------------------------------

  fetchSessions(): void {
    this.isLoadingSessions = true;
    this.api.getOwnSessions().subscribe({
      next: (res: any) => {
        this.isLoadingSessions = false;
        this.sessions = res.data || [];
      },
      error: (err: any) => {
        this.isLoadingSessions = false;
        this.toast.error(err?.error?.message || 'Failed to load sessions.');
      }
    });
  }

  async revokeSession(session: any): Promise<void> {
    if (session.isCurrent) {
      this.toast.warning('You cannot revoke your current session. Use logout instead.');
      return;
    }

    const confirmed = await this.dialog.danger(
      'Revoke Session',
      `Are you sure you want to terminate this session? (IP: ${session.ipAddress})`
    );

    if (!confirmed) return;

    this.api.revokeOwnSession(session.id).subscribe({
      next: () => {
        this.toast.success('Session revoked.');
        this.fetchSessions();
      },
      error: (err: any) => this.toast.error(err?.error?.message || 'Revocation failed.')
    });
  }

  async revokeAllOtherSessions(): Promise<void> {
    const otherCount = this.sessions.filter(s => !s.isCurrent).length;
    if (otherCount === 0) {
      this.toast.info('No other active sessions to revoke.');
      return;
    }

    const confirmed = await this.dialog.danger(
      'Revoke All Other Sessions',
      `This will immediately log out ${otherCount} other active session(s) across all devices. Proceed?`
    );

    if (!confirmed) return;

    this.isRevokingOthers = true;
    this.api.revokeAllOtherSessions().subscribe({
      next: (res: any) => {
        this.isRevokingOthers = false;
        this.toast.success(res?.message || 'All other sessions have been terminated.');
        this.fetchSessions();
      },
      error: (err: any) => {
        this.isRevokingOthers = false;
        this.toast.error(err?.error?.message || 'Failed to revoke other sessions.');
      }
    });
  }

  // -- Security Activity Audit Logs -----------------------------

  fetchAuditLogs(): void {
    this.isLoadingAuditLogs = true;
    this.api.getAccountAuditLog().subscribe({
      next: (res: any) => {
        this.isLoadingAuditLogs = false;
        this.auditLogs = res.data || [];
      },
      error: () => {
        this.isLoadingAuditLogs = false;
      }
    });
  }

  switchTab(tab: 'info' | 'password' | '2fa' | 'sessions' | 'audit'): void {
    this.activeTab = tab;
    if (tab === 'sessions' && this.sessions.length === 0) {
      this.fetchSessions();
    } else if (tab === 'audit' && this.auditLogs.length === 0) {
      this.fetchAuditLogs();
    }
  }

  parseUserAgent(ua: string): { browser: string; os: string } {
    if (!ua || ua === 'Unknown Device') return { browser: 'Unknown Device', os: 'Desktop' };
    
    let browser = 'Browser';
    if (ua.includes('Edg')) browser = 'Microsoft Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';

    let os = 'Desktop';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';

    return { browser, os };
  }
}