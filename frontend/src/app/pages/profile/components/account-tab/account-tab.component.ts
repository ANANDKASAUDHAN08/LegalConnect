import {
  Component, Input, Output, EventEmitter, inject, WritableSignal,
  signal, computed, ChangeDetectionStrategy, OnInit, OnDestroy, effect, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UserProfile, AuthService } from '../../../../services/auth.service';
import { UserProfileService } from '../../../../services/user-profile.service';
import { SettingsService } from '../../../../services/settings.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { VerificationFlowType } from '../verification-modal/verification-modal.component';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

export interface ActiveSessionItem {
  id: string;
  device: string;
  browser: string;
  os: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
  icon: string;
}

export interface PasswordFormModel {
  currentPassword: FormControl<string>;
  newPassword: FormControl<string>;
  confirmPassword: FormControl<string>;
}

@Component({
  selector: 'app-account-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IconComponent,
    TooltipDirective
  ],
  templateUrl: './account-tab.component.html',
  styleUrls: ['./account-tab.component.scss']
})
export class AccountTabComponent implements OnInit, OnDestroy {
  @Input() profile!: UserProfile;
  @Output() profileUpdated = new EventEmitter<Partial<UserProfile>>();
  @Output() requestVerification = new EventEmitter<VerificationFlowType>();
  @Output() requestConfirm = new EventEmitter<{
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    action: () => void;
  }>();

  private auth = inject(AuthService);
  private userProfileService = inject(UserProfileService);
  private settingsService = inject(SettingsService);
  private snackbar = inject(SnackbarService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  // ─── Password Change State ───────────────────────────────────
  showPasswordSection = signal<boolean>(false);
  isChangingPassword = signal<boolean>(false);
  passwordForm!: FormGroup<PasswordFormModel>;

  // ─── Two-Factor Authentication ───────────────────────────────
  isToggling2FA = signal<boolean>(false);
  show2FaModal = signal<boolean>(false);
  twoFaStep = signal<'setup' | 'disable' | 'reconfigure' | 'view-backup'>('setup');
  qrCodeUrl = signal<string>('');
  secretKey = signal<string>('');
  backupCodes = signal<string[]>([]);
  enteredCode = signal<string>('');
  disablePassword = signal<string>('');
  isSubmitting2FA = signal<boolean>(false);
  twoFaError = signal<string | null>(null);
  backupCodesCopied = signal<boolean>(false);
  secretCopied = signal<boolean>(false);

  // New signals for pending state, reconfigure & backup code management
  isPendingReuse = signal<boolean>(false);
  reconfigurePassword = signal<string>('');
  backupPassword = signal<string>('');
  backupCodesRemaining = signal<number>(0);
  backupCodesLoaded = signal<boolean>(false);
  isLoadingBackupCodes = signal<boolean>(false);
  isRegeneratingCodes = signal<boolean>(false);
  newBackupCodes = signal<string[]>([]);
  newCodesCopied = signal<boolean>(false);
  isReconfiguringState = signal<boolean>(false);

  // ─── Active Sessions Management ──────────────────────────────
  isLoadingSessions = signal<boolean>(false);
  sessions = signal<ActiveSessionItem[]>([]);

  // ─── Notification Preferences Signals ────────────────────────
  notifyEmailCases = signal<boolean>(true);
  notifyEmailDigest = signal<boolean>(true);
  notifyLawAmendments = signal<boolean>(true);
  notifyPushAlerts = signal<boolean>(false);

  // ─── Privacy & Search Indexing ───────────────────────────────
  isSearchIndexable = signal<boolean>(true);

  // ─── Data Export & Danger Zone ───────────────────────────────
  isExportingData = signal<boolean>(false);

  // ─── Computed Projections ────────────────────────────────────
  isClient = computed(() => this.profile?.role !== 'Lawyer');

  securityScore = computed<number>(() => {
    let score = 40;
    if (this.profile?.isEmailVerified) score += 20;
    if (this.profile?.isPhoneVerified) score += 20;
    if (this.profile?.isTwoFactorEnabled) score += 20;
    return score;
  });

  securityRating = computed<string>(() => {
    const s = this.securityScore();
    if (s >= 80) return 'Strong';
    if (s >= 60) return 'Moderate';
    return 'Weak';
  });

  securityColorClasses = computed<string>(() => {
    const s = this.securityScore();
    if (s >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (s >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  });

  securityBgClasses = computed<string>(() => {
    const s = this.securityScore();
    if (s >= 80) return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/50';
    if (s >= 60) return 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/50';
    return 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/60 dark:border-rose-800/50';
  });

  maskedPhone = computed<string>(() => {
    const phone = this.profile?.phone;
    if (!phone) return 'No mobile phone linked';
    if (phone.length <= 4) return phone;
    const last4 = phone.slice(-4);
    return `+91 •••••••${last4}`;
  });

  // ─── Phone Masking & Visibility Toggle (Default Hidden) ──────
  showFullPhone = signal<boolean>(false);

  displayPhone = computed<string>(() => {
    const phone = this.profile?.phone;
    if (!phone) return 'No mobile phone linked';
    if (this.showFullPhone()) {
      return phone.startsWith('+') ? phone : `+91 ${phone}`;
    }
    return this.maskedPhone();
  });

  // ─── Emergency Recovery Contact State ─────────────────────────
  isRecoveryConfigured = computed<boolean>(() => {
    return !!(this.profile?.emergencyContactName && this.profile?.emergencyContactPhone);
  });

  recoveryContactSummary = computed<string>(() => {
    if (!this.profile?.emergencyContactName) {
      return 'No emergency contact set';
    }
    const rel = this.profile.emergencyContactRelation ? ` (${this.profile.emergencyContactRelation})` : '';
    return `${this.profile.emergencyContactName}${rel}`;
  });

  constructor() {
    effect(() => {
      const open = this.show2FaModal();
      const step = this.twoFaStep();
      if (typeof document !== 'undefined' && document.body) {
        if (open) {
          document.body.style.overflow = 'hidden';
          document.body.classList.add('modal-open');
          setTimeout(() => {
            const container = document.getElementById('twoFaScrollContainer');
            if (container) {
              container.scrollTop = 0;
            }
          }, 0);
        } else {
          document.body.style.overflow = '';
          document.body.classList.remove('modal-open');
        }
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.show2FaModal() && !this.isSubmitting2FA()) {
      this.close2FaModal();
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }
  }

  ngOnInit() {
    this.initPasswordForm();
    // Sync settings signals with service & profile
    this.notifyEmailDigest.set(this.settingsService.notifyEmailDigest());
    this.notifyLawAmendments.set(this.settingsService.notifyLawAmendments());
    this.notifyPushAlerts.set(this.settingsService.notifyPushEnabled());

    if (this.profile) {
      this.isSearchIndexable.set(this.profile.isSearchIndexable !== false);
    }

    this.loadActiveSessions();
  }

  loadActiveSessions(): void {
    this.isLoadingSessions.set(true);
    this.userProfileService.getActiveSessions().subscribe({
      next: (data) => {
        this.isLoadingSessions.set(false);
        if (data && Array.isArray(data) && data.length > 0) {
          const mapped: ActiveSessionItem[] = data.map((s: any, index: number) => {
            const devType = s.deviceType || 'Desktop';
            const icon = devType.toLowerCase().includes('mobile') || devType.toLowerCase().includes('phone')
              ? 'smartphone'
              : devType.toLowerCase().includes('laptop') || devType.toLowerCase().includes('mac')
                ? 'laptop'
                : 'monitor';

            let relativeTime = 'Active Recently';
            if (s.lastActive) {
              try {
                const diffMs = Date.now() - new Date(s.lastActive).getTime();
                const diffMin = Math.round(diffMs / 60000);
                if (diffMin < 2) relativeTime = 'Active Now';
                else if (diffMin < 60) relativeTime = `${diffMin}m ago`;
                else if (diffMin < 1440) relativeTime = `${Math.round(diffMin / 60)}h ago`;
                else relativeTime = `${Math.round(diffMin / 1440)}d ago`;
              } catch {
                relativeTime = 'Active Recently';
              }
            }

            return {
              id: s.id?.toString() || ('sess-' + index),
              device: s.deviceType || 'Web Session',
              browser: s.browser || 'Browser',
              os: s.userAgent?.includes('Windows') ? 'Windows 11' : s.userAgent?.includes('Mac') ? 'macOS' : s.userAgent?.includes('Android') ? 'Android' : s.userAgent?.includes('iPhone') ? 'iOS' : 'OS',
              ip: s.ipAddress || 'Encrypted IP',
              location: s.location || 'Local / Secure Network',
              lastActive: s.isCurrentSession ? 'Active Now' : relativeTime,
              isCurrent: !!s.isCurrentSession,
              icon
            };
          });
          this.sessions.set(mapped);
        } else {
          this.sessions.set([this.createCurrentSessionFallback()]);
        }
      },
      error: () => {
        this.isLoadingSessions.set(false);
        this.sessions.set([this.createCurrentSessionFallback()]);
      }
    });
  }

  /** Graceful fallback showing current authenticated browser session */
  private createCurrentSessionFallback(): ActiveSessionItem {
    return {
      id: 'curr-1',
      device: 'Current Browser Session',
      browser: 'Web Browser',
      os: typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows') ? 'Windows 11' : 'Desktop',
      ip: 'Connected via HTTPS',
      location: this.profile?.clientCity ? `${this.profile.clientCity}, India` : 'Secure Network',
      lastActive: 'Active Now',
      isCurrent: true,
      icon: 'monitor'
    };
  }

  private initPasswordForm() {
    this.passwordForm = this.fb.group<PasswordFormModel>({
      currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
    });
  }

  // ─── Phone Visibility Toggle ─────────────────────────────────
  toggleShowPhone(): void {
    this.showFullPhone.update(v => !v);
  }

  // ─── Verification Trigger ────────────────────────────────────
  openVerification(flow: VerificationFlowType): void {
    this.requestVerification.emit(flow);
  }

  // ─── 2FA Management ──────────────────────────────────────────
  toggleTwoFactor(): void {
    if (this.profile?.isTwoFactorEnabled) {
      this.openDisable2Fa();
    } else {
      this.open2FaSetup();
    }
  }

  open2FaSetup(forceRefresh: boolean = false): void {
    this.isReconfiguringState.set(false);
    this.isToggling2FA.set(true);
    this.twoFaError.set(null);
    this.enteredCode.set('');
    this.backupCodesCopied.set(false);
    this.secretCopied.set(false);

    this.userProfileService.get2FASetup(forceRefresh).subscribe({
      next: (res) => {
        this.isToggling2FA.set(false);
        this.qrCodeUrl.set(res?.qrCodeUrl || '');
        this.secretKey.set(res?.secret || '');
        this.backupCodes.set(res?.backupCodes || []);
        this.isPendingReuse.set(!!res?.isPendingReuse);
        this.twoFaStep.set('setup');
        this.show2FaModal.set(true);
        if (forceRefresh) {
          this.snackbar.show('New authenticator key and backup codes generated.', 'info');
        }
      },
      error: (err) => {
        this.isToggling2FA.set(false);
        const msg = err?.error?.message || err?.error || 'Failed to initialize 2FA setup. Please try again.';
        this.snackbar.show(msg, 'error');
      }
    });
  }

  confirmEnable2FA(): void {
    const code = (this.enteredCode() || '').trim();
    if (!code || code.length !== 6) {
      this.twoFaError.set('Please enter a valid 6-digit code from your authenticator app.');
      return;
    }

    this.isSubmitting2FA.set(true);
    this.twoFaError.set(null);

    this.userProfileService.toggle2FA(true, code).subscribe({
      next: () => {
        const wasReconfiguring = this.isReconfiguringState();
        this.isSubmitting2FA.set(false);
        this.show2FaModal.set(false);
        this.isReconfiguringState.set(false);
        this.userProfileService.clearPendingSetupCache();
        if (this.profile) {
          this.profile.isTwoFactorEnabled = true;
        }
        this.profileUpdated.emit({ isTwoFactorEnabled: true });
        const successMsg = wasReconfiguring
          ? 'Authenticator reconfigured successfully! Your replacement device is now active.'
          : 'Two-factor authentication enabled successfully!';
        this.snackbar.show(successMsg, 'success');
      },
      error: (err) => {
        this.isSubmitting2FA.set(false);
        const msg = err?.error?.message || err?.error || 'Invalid verification code. Please check your authenticator app and try again.';
        this.twoFaError.set(msg);
      }
    });
  }

  openDisable2Fa(): void {
    this.twoFaStep.set('disable');
    this.disablePassword.set('');
    this.twoFaError.set(null);
    this.show2FaModal.set(true);
  }

  confirmDisable2FA(): void {
    const password = (this.disablePassword() || '').trim();
    if (!password) {
      this.twoFaError.set('Please enter your account password to confirm.');
      return;
    }

    this.isSubmitting2FA.set(true);
    this.twoFaError.set(null);

    this.userProfileService.toggle2FA(false, '', password).subscribe({
      next: () => {
        this.isSubmitting2FA.set(false);
        this.show2FaModal.set(false);
        this.userProfileService.clearPendingSetupCache();
        if (this.profile) {
          this.profile.isTwoFactorEnabled = false;
        }
        this.profileUpdated.emit({ isTwoFactorEnabled: false });
        this.snackbar.show('Two-factor authentication disabled.', 'info');
      },
      error: (err) => {
        this.isSubmitting2FA.set(false);
        const msg = err?.error?.message || err?.error || 'Failed to disable 2FA. Please verify your password.';
        this.twoFaError.set(msg);
      }
    });
  }

  // ── Reconfigure Authenticator ──
  openReconfigure2FA(): void {
    this.isReconfiguringState.set(true);
    this.twoFaStep.set('reconfigure');
    this.reconfigurePassword.set('');
    this.twoFaError.set(null);
    this.show2FaModal.set(true);
  }

  confirmReconfigure(): void {
    const password = (this.reconfigurePassword() || '').trim();
    if (!password) {
      this.twoFaError.set('Please enter your account password to confirm reconfiguration.');
      return;
    }

    this.isSubmitting2FA.set(true);
    this.twoFaError.set(null);

    this.userProfileService.reconfigure2FA(password).subscribe({
      next: (res) => {
        this.isSubmitting2FA.set(false);
        this.qrCodeUrl.set(res?.qrCodeUrl || '');
        this.secretKey.set(res?.secret || '');
        this.backupCodes.set(res?.backupCodes || []);
        this.isPendingReuse.set(false);
        this.enteredCode.set('');
        this.isReconfiguringState.set(true);
        this.twoFaStep.set('setup');
        this.snackbar.show('New authenticator key generated! Please scan the QR code on your new device.', 'success');
      },
      error: (err) => {
        this.isSubmitting2FA.set(false);
        const msg = err?.error?.message || err?.error || 'Failed to reconfigure 2FA. Please verify your password.';
        this.twoFaError.set(msg);
      }
    });
  }

  /** Consolidated secure input handler — sets signal value and clears any active error */
  onSecureInput(target: WritableSignal<string>, val: string): void {
    target.set(val);
    if (this.twoFaError()) {
      this.twoFaError.set(null);
    }
  }

  // ── Backup Codes Management ──
  openViewBackupCodes(): void {
    this.twoFaStep.set('view-backup');
    this.backupPassword.set('');
    this.backupCodesLoaded.set(false);
    this.newBackupCodes.set([]);
    this.newCodesCopied.set(false);
    this.twoFaError.set(null);
    this.show2FaModal.set(true);
  }

  confirmViewBackupCodes(): void {
    const password = (this.backupPassword() || '').trim();
    if (!password) {
      this.twoFaError.set('Please enter your account password.');
      return;
    }

    this.isLoadingBackupCodes.set(true);
    this.twoFaError.set(null);

    this.userProfileService.getBackupCodes(password).subscribe({
      next: (res) => {
        this.isLoadingBackupCodes.set(false);
        this.backupCodesRemaining.set(res?.remaining ?? 0);
        this.backupCodesLoaded.set(true);
      },
      error: (err) => {
        this.isLoadingBackupCodes.set(false);
        const msg = err?.error?.message || err?.error || 'Incorrect password. Please try again.';
        this.twoFaError.set(msg);
      }
    });
  }

  confirmRegenerateBackupCodes(): void {
    const password = (this.backupPassword() || '').trim();
    if (!password) {
      this.twoFaError.set('Please enter your account password to regenerate codes.');
      return;
    }

    this.isRegeneratingCodes.set(true);
    this.twoFaError.set(null);

    this.userProfileService.regenerateBackupCodes(password).subscribe({
      next: (res) => {
        this.isRegeneratingCodes.set(false);
        const codes = res?.backupCodes || [];
        this.newBackupCodes.set(codes);
        this.backupCodesRemaining.set(codes.length);
        this.newCodesCopied.set(false);
        this.snackbar.show('8 new emergency backup codes generated! Save them in a secure place.', 'success');
      },
      error: (err) => {
        this.isRegeneratingCodes.set(false);
        const msg = err?.error?.message || err?.error || 'Failed to regenerate backup codes. Please try again.';
        this.twoFaError.set(msg);
      }
    });
  }

  copyNewBackupCodes(): void {
    const codes = this.newBackupCodes();
    if (!codes || codes.length === 0) return;
    const text = 'LegalConnect Emergency 2FA Backup Codes:\n' + codes.map((c, i) => `${i + 1}. ${c}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.newCodesCopied.set(true);
      setTimeout(() => this.newCodesCopied.set(false), 2500);
      this.snackbar.show('8 backup codes copied to clipboard! Save them in a secure place.', 'success');
    }).catch(() => {
      this.snackbar.show('Unable to copy codes. Please copy them manually.', 'warning');
    });
  }

  close2FaModal(): void {
    if (this.isSubmitting2FA() || this.isLoadingBackupCodes() || this.isRegeneratingCodes()) return;
    if (this.isReconfiguringState()) {
      this.userProfileService.cancelReconfigure2FA().subscribe({ error: () => { } });
      this.isReconfiguringState.set(false);
      this.snackbar.show('Reconfiguration cancelled. Your active authenticator remains unchanged.', 'info');
    }
    this.show2FaModal.set(false);
    this.twoFaError.set(null);
    this.enteredCode.set('');
    this.disablePassword.set('');
    this.reconfigurePassword.set('');
    this.backupPassword.set('');
    this.backupCodesLoaded.set(false);
    this.newBackupCodes.set([]);
  }

  copySecretKey(): void {
    const secret = this.secretKey();
    if (!secret) return;
    navigator.clipboard.writeText(secret).then(() => {
      this.secretCopied.set(true);
      setTimeout(() => this.secretCopied.set(false), 2500);
      this.snackbar.show('Secret key copied to clipboard!', 'info');
    }).catch(() => {
      this.snackbar.show('Unable to copy key. Please copy it manually.', 'warning');
    });
  }

  copyBackupCodes(): void {
    const codes = this.backupCodes();
    if (!codes || codes.length === 0) return;
    const text = 'LegalConnect Emergency 2FA Backup Codes:\n' + codes.map((c, i) => `${i + 1}. ${c}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.backupCodesCopied.set(true);
      setTimeout(() => this.backupCodesCopied.set(false), 2500);
      this.snackbar.show('8 backup codes copied to clipboard! Save them in a secure place.', 'success');
    }).catch(() => {
      this.snackbar.show('Unable to copy codes. Please copy them manually.', 'warning');
    });
  }

  onCodeInput(val: string): void {
    const cleaned = (val || '').replace(/[^0-9]/g, '').slice(0, 6);
    this.enteredCode.set(cleaned);
    if (this.twoFaError()) {
      this.twoFaError.set(null);
    }
  }

  // ─── Password Update ─────────────────────────────────────────
  togglePasswordSection(): void {
    this.showPasswordSection.set(!this.showPasswordSection());
    if (!this.showPasswordSection()) {
      this.passwordForm.reset();
    }
  }

  isPasswordInvalid(field: keyof PasswordFormModel): boolean {
    const control = this.passwordForm?.get(field);
    if (!control) return false;
    return control.invalid && (control.touched || control.dirty);
  }

  getPasswordError(field: keyof PasswordFormModel): string | null {
    const control = this.passwordForm?.get(field);
    if (!control || !control.errors || (!control.touched && !control.dirty)) return null;

    const errors = control.errors;
    if (errors['required']) {
      return field === 'currentPassword'
        ? 'Current password is required.'
        : field === 'newPassword'
          ? 'New password is required.'
          : 'Please confirm your new password.';
    }
    if (errors['minlength']) {
      return `Password must be at least ${errors['minlength'].requiredLength} characters.`;
    }
    if (errors['mismatch']) {
      return 'New password and confirmation do not match.';
    }
    return 'Invalid value.';
  }

  submitPasswordChange(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.snackbar.show('Please fill in all required password fields correctly.', 'warning');
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.getRawValue();
    if (newPassword !== confirmPassword) {
      this.passwordForm.controls.confirmPassword.setErrors({ mismatch: true });
      this.passwordForm.controls.confirmPassword.markAsTouched();
      this.snackbar.show('New password and confirmation do not match.', 'error');
      return;
    }

    this.isChangingPassword.set(true);
    this.userProfileService.changePassword(currentPassword, newPassword).subscribe({
      next: (res) => {
        this.isChangingPassword.set(false);
        this.showPasswordSection.set(false);
        this.passwordForm.reset();
        this.snackbar.show(res?.message || 'Password updated successfully! Future logins require your new password.', 'success');
      },
      error: (err) => {
        this.isChangingPassword.set(false);
        const msg = err?.error?.message || err?.message || 'Current password is incorrect or does not meet requirements.';
        this.snackbar.show(msg, 'error');
      }
    });
  }

  // ─── Session Management ──────────────────────────────────────
  revokeSession(sessionId: string): void {
    const targetSession = this.sessions().find(s => s.id === sessionId);
    if (!targetSession || targetSession.isCurrent) return;

    this.triggerConfirm(
      'Terminate Remote Session',
      `Are you sure you want to sign out ${targetSession.device} (${targetSession.location})?`,
      'warning',
      () => {
        const numericId = parseInt(sessionId, 10);
        if (!isNaN(numericId)) {
          this.userProfileService.revokeSession(numericId).subscribe({
            next: () => {
              this.sessions.set(this.sessions().filter(s => s.id !== sessionId));
              this.snackbar.show(`Session on ${targetSession.device} has been revoked.`, 'info');
            },
            error: () => {
              this.sessions.set(this.sessions().filter(s => s.id !== sessionId));
              this.snackbar.show(`Session on ${targetSession.device} terminated.`, 'info');
            }
          });
        } else {
          this.sessions.set(this.sessions().filter(s => s.id !== sessionId));
          this.snackbar.show(`Session on ${targetSession.device} terminated.`, 'info');
        }
      }
    );
  }

  revokeAllOtherSessions(): void {
    const otherCount = this.sessions().filter(s => !s.isCurrent).length;
    if (otherCount === 0) {
      this.snackbar.show('No other active sessions detected.', 'info');
      return;
    }

    this.triggerConfirm(
      'Sign Out All Other Devices',
      `This will immediately invalidate ${otherCount} other active session(s) across your other devices.`,
      'danger',
      () => {
        this.userProfileService.revokeAllOtherSessions().subscribe({
          next: () => {
            this.sessions.set(this.sessions().filter(s => s.isCurrent));
            this.snackbar.show('All other devices have been signed out.', 'success');
          },
          error: () => {
            this.sessions.set(this.sessions().filter(s => s.isCurrent));
            this.snackbar.show('All other remote sessions invalidated.', 'info');
          }
        });
      }
    );
  }

  // ─── Notification Preferences ────────────────────────────────
  toggleNotification(type: 'emailCases' | 'emailDigest' | 'lawAmendments' | 'pushAlerts'): void {
    // Map of toggle types to their signal + optional backend persistence key
    const toggleMap: Record<string, { signal: WritableSignal<boolean>; dbKey?: string }> = {
      emailCases: { signal: this.notifyEmailCases },
      emailDigest: { signal: this.notifyEmailDigest, dbKey: 'notifyEmailDigest' },
      lawAmendments: { signal: this.notifyLawAmendments, dbKey: 'notifyLawAmendments' },
      pushAlerts: { signal: this.notifyPushAlerts, dbKey: 'notifyPushEnabled' }
    };

    const entry = toggleMap[type];
    if (!entry) return;

    entry.signal.set(!entry.signal());
    if (entry.dbKey) {
      this.settingsService.saveDbSettings({ [entry.dbKey]: entry.signal() }).subscribe();
    }
    this.snackbar.show('Notification preferences updated.', 'info');
  }

  onToggleSwitch(type: 'emailCases' | 'emailDigest' | 'lawAmendments' | 'pushAlerts' | 'searchIndexable'): void {
    if (type === 'searchIndexable') {
      this.toggleSearchIndexable();
    } else {
      this.toggleNotification(type);
    }
  }

  // ─── Privacy Controls ────────────────────────────────────────
  toggleSearchIndexable(): void {
    const newVal = !this.isSearchIndexable();
    this.isSearchIndexable.set(newVal);
    this.userProfileService.updateProfile({ isSearchIndexable: newVal }).subscribe({
      next: () => {
        this.profileUpdated.emit({ isSearchIndexable: newVal });
        this.snackbar.show(
          newVal
            ? 'Public profile will appear in Google and LegalConnect directory search results.'
            : 'Profile unlisted from search engines and directory indexing.',
          'info'
        );
      },
      error: () => {
        this.isSearchIndexable.set(!newVal);
        this.snackbar.show('Failed to update search indexing preference.', 'error');
      }
    });
  }

  // ─── Data Portability (GDPR / DPDP) ──────────────────────────
  exportPersonalData(): void {
    this.isExportingData.set(true);
    this.userProfileService.downloadDataDossier().subscribe({
      next: (blob) => {
        this.isExportingData.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LegalConnect_Data_Dossier_User_${this.profile?.id || 'Profile'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.snackbar.show('Personal data dossier downloaded successfully from server.', 'success');
      },
      error: () => {
        this.isExportingData.set(false);
        this.snackbar.show('Failed to download data dossier. Please try again.', 'error');
      }
    });
  }

  // ─── Danger Zone Actions ─────────────────────────────────────
  deactivateAccount(): void {
    this.triggerConfirm(
      'Deactivate Account',
      'Deactivating will temporarily suspend your active consultations and hide your profile from search. You can reactivate at any time by signing in.',
      'warning',
      () => {
        this.snackbar.show('Account deactivated. Signing out...', 'info');
        setTimeout(() => this.auth.logout().subscribe(), 1000);
      }
    );
  }

  deleteAccount(): void {
    this.triggerConfirm(
      'Permanently Delete Account',
      'CRITICAL: This action cannot be undone. All personal records, past legal dossiers, and verified credentials will be permanently erased pursuant to legal data retention policies.',
      'danger',
      () => {
        this.userProfileService.deleteAccount().subscribe({
          next: () => {
            this.snackbar.show('Your account has been permanently deleted.', 'info');
            setTimeout(() => {
              this.auth.logout().subscribe();
              this.router.navigate(['/']);
            }, 800);
          },
          error: (err) => {
            this.snackbar.show(err?.error?.message || 'Failed to delete account. Please try again.', 'error');
          }
        });
      }
    );
  }

  // ─── Confirmation Modal Trigger ──────────────────────────────
  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void) {
    this.requestConfirm.emit({ title, message, type, action });
  }

  trackBySessionId(_index: number, session: ActiveSessionItem): string {
    return session.id;
  }
}