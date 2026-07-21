import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserProfile } from '../../../../services/auth.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { ConfirmDialogComponent } from '../../../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-security-settings-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  templateUrl: './security-settings-tab.component.html'
})
export class SecuritySettingsTabComponent implements OnInit, OnDestroy {
  // Modal Dialog variables
  isConfirmOpen = false;
  confirmTitle = '';
  confirmMessage = '';
  confirmType: 'danger' | 'warning' | 'info' = 'warning';
  onConfirmAction: (() => void) | null = null;

  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.confirmTitle = title;
    this.confirmMessage = message;
    this.confirmType = type;
    this.onConfirmAction = action;
    this.isConfirmOpen = true;
  }

  onConfirmDialog() {
    this.isConfirmOpen = false;
    if (this.onConfirmAction) {
      this.onConfirmAction();
    }
  }

  onCancelDialog() {
    this.isConfirmOpen = false;
    this.onConfirmAction = null;
  }
  @Input() profile!: UserProfile;
  @Output() profileUpdated = new EventEmitter<Partial<UserProfile>>();

  // Password change
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  showCurrentPwd = false;
  showNewPwd = false;
  showConfirmPwd = false;
  pwdLoading = false;

  // 2FA
  twoFaEnabled = false;
  show2FaSetup = false;
  twoFaCode = '';
  twoFaLoading = false;
  qrCodeUrl = '';
  secretKey = '';
  showDisableConfirmModal = false;

  // Active Sessions & Login History
  activeSessions: any[] = [];
  loginHistory: any[] = [];
  showSessionsList = false;
  showHistoryList = false;
  sessionsLoading = false;
  historyLoading = false;

  ngOnInit() {
    this.twoFaEnabled = !!this.profile?.isTwoFactorEnabled;
    this.loadActiveSessions();
    this.loadLoginHistory();
  }

  constructor(
    private auth: AuthService,
    private snackbar: SnackbarService
  ) {}

  loadActiveSessions() {
    this.sessionsLoading = true;
    this.auth.getActiveSessions().subscribe({
      next: (sessions) => {
        this.activeSessions = sessions;
        this.sessionsLoading = false;
      },
      error: (err) => {
        this.sessionsLoading = false;
      }
    });
  }

  loadLoginHistory() {
    this.historyLoading = true;
    this.auth.getLoginHistory().subscribe({
      next: (history) => {
        this.loginHistory = history;
        this.historyLoading = false;
      },
      error: (err) => {
        this.historyLoading = false;
      }
    });
  }

  revokeSession(id: number) {
    this.triggerConfirm(
      'Revoke Device Session',
      'Are you sure you want to revoke this session? Any unsaved changes on that device will be lost.',
      'danger',
      () => {
        this.auth.revokeSession(id).subscribe({
          next: () => {
            this.snackbar.show('Session revoked successfully.', 'success');
            const session = this.activeSessions.find(s => s.id === id);
            if (session && session.isCurrent) {
              this.auth.logout().subscribe();
            } else {
              this.loadActiveSessions();
            }
          },
          error: (err) => {
            this.snackbar.show(err.error || 'Failed to revoke session.', 'error');
          }
        });
      }
    );
  }

  changePassword() {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.snackbar.show('Please fill in all password fields.', 'warning');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.snackbar.show('New passwords do not match.', 'error');
      return;
    }
    if (this.newPassword.length < 6) {
      this.snackbar.show('Password must be at least 6 characters.', 'warning');
      return;
    }

    this.pwdLoading = true;
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.pwdLoading = false;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.showCurrentPwd = false;
        this.showNewPwd = false;
        this.showConfirmPwd = false;
        this.snackbar.show('Password changed successfully!', 'success');
      },
      error: (err) => {
        this.pwdLoading = false;
        this.snackbar.show(err.error || 'Failed to change password.', 'error');
      }
    });
  }

  ngOnDestroy() {
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  updateScroll() {
    if (typeof document !== 'undefined') {
      if (this.showDisableConfirmModal) {
        document.body.classList.add('overflow-hidden');
      } else {
        document.body.classList.remove('overflow-hidden');
      }
    }
  }

  closeDisableModal() {
    this.showDisableConfirmModal = false;
    this.updateScroll();
  }

  toggle2FA() {
    if (!this.twoFaEnabled) {
      this.twoFaLoading = true;
      this.auth.get2FASetup().subscribe({
        next: (res) => {
          this.twoFaLoading = false;
          this.qrCodeUrl = res.qrCodeUrl;
          this.secretKey = res.secret;
          this.show2FaSetup = true;
        },
        error: (err) => {
          this.twoFaLoading = false;
          this.snackbar.show(err.error || 'Failed to initialize 2FA setup.', 'error');
        }
      });
    } else {
      this.showDisableConfirmModal = true;
      this.updateScroll();
    }
  }

  confirmDisable2FA() {
    this.twoFaLoading = true;
    this.showDisableConfirmModal = false;
    this.updateScroll();
    this.auth.toggle2FA(false, '').subscribe({
      next: () => {
        this.twoFaLoading = false;
        this.twoFaEnabled = false;
        this.show2FaSetup = false;
        this.snackbar.show('2FA disabled successfully.', 'success');
        this.profileUpdated.emit({ isTwoFactorEnabled: false });
      },
      error: (err) => {
        this.twoFaLoading = false;
        this.snackbar.show(err.error || 'Failed to disable 2FA.', 'error');
      }
    });
  }

  enable2FA() {
    if (!this.twoFaCode.trim()) {
      this.snackbar.show('Please enter the verification code.', 'warning');
      return;
    }
    this.twoFaLoading = true;
    this.auth.toggle2FA(true, this.twoFaCode).subscribe({
      next: () => {
        this.twoFaLoading = false;
        this.twoFaEnabled = true;
        this.show2FaSetup = false;
        this.twoFaCode = '';
        this.snackbar.show('2FA enabled successfully!', 'success');
        this.profileUpdated.emit({ isTwoFactorEnabled: true });
      },
      error: (err) => {
        this.twoFaLoading = false;
        this.snackbar.show(err.error || 'Invalid code. Use 123456 for this demo.', 'error');
      }
    });
  }
}
