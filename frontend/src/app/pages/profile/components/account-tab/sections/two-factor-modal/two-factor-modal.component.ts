import {
  Component, Input, Output, EventEmitter, inject, WritableSignal,
  signal, ChangeDetectionStrategy, OnInit, OnDestroy, HostListener, DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserProfile } from '../../../../../../services/auth.service';
import { UserProfileService } from '../../../../../../services/user-profile.service';
import { SnackbarService } from '../../../../../../services/snackbar.service';
import { IconComponent } from '../../../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../../../directives/tooltip.directive';

export type TwoFaStep = 'setup' | 'disable' | 'reconfigure' | 'view-backup';

@Component({
  selector: 'app-two-factor-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    TooltipDirective
  ],
  templateUrl: './two-factor-modal.component.html',
  styleUrls: ['./two-factor-modal.component.scss']
})
export class TwoFactorModalComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() initialStep: TwoFaStep = 'setup';
  @Input({ required: true }) profile!: UserProfile;

  @Output() closeModal = new EventEmitter<void>();
  @Output() statusChanged = new EventEmitter<boolean>();
  @Output() profileUpdated = new EventEmitter<Partial<UserProfile>>();

  private userProfileService = inject(UserProfileService);
  private snackbar = inject(SnackbarService);
  private destroyRef = inject(DestroyRef);

  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private isDestroyed = false;

  twoFaStep = signal<TwoFaStep>('setup');
  qrCodeUrl = signal<string>('');
  secretKey = signal<string>('');
  backupCodes = signal<string[]>([]);
  enteredCode = signal<string>('');
  disablePassword = signal<string>('');
  isSubmitting2FA = signal<boolean>(false);
  isToggling2FA = signal<boolean>(false);
  twoFaError = signal<string | null>(null);
  backupCodesCopied = signal<boolean>(false);
  secretCopied = signal<boolean>(false);

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

  ngOnInit(): void {
    this.lockBodyScroll();
    this.initStep(this.initialStep);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.pendingTimers.forEach(t => clearTimeout(t));
    this.pendingTimers.clear();
    this.unlockBodyScroll();
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.isOpen && !this.isSubmitting2FA() && !this.isLoadingBackupCodes() && !this.isRegeneratingCodes()) {
      this.handleClose();
    }
  }

  private lockBodyScroll(): void {
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
      this.safeTimeout(() => {
        if (this.isDestroyed) return;
        const container = document.getElementById('twoFaScrollContainer');
        if (container) {
          container.scrollTop = 0;
        }
      }, 0);
    }
  }

  private unlockBodyScroll(): void {
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
    }
  }

  private safeTimeout(fn: () => void, ms: number): void {
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      if (!this.isDestroyed) fn();
    }, ms);
    this.pendingTimers.add(timer);
  }

  initStep(step: TwoFaStep): void {
    this.twoFaStep.set(step);
    if (step === 'setup') {
      this.open2FaSetup();
    } else if (step === 'reconfigure') {
      this.openReconfigure2FA();
    } else if (step === 'view-backup') {
      this.openViewBackupCodes();
    } else if (step === 'disable') {
      this.openDisable2Fa();
    }
  }

  open2FaSetup(forceRefresh = false): void {
    this.isReconfiguringState.set(false);
    this.isToggling2FA.set(true);
    this.twoFaError.set(null);
    this.enteredCode.set('');
    this.backupCodesCopied.set(false);
    this.secretCopied.set(false);

    this.userProfileService.get2FASetup(forceRefresh)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isToggling2FA.set(false);
          this.qrCodeUrl.set(res?.qrCodeUrl || '');
          this.secretKey.set(res?.secret || '');
          this.backupCodes.set(res?.backupCodes || []);
          this.isPendingReuse.set(!!res?.isPendingReuse);
          this.twoFaStep.set('setup');
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

    this.userProfileService.toggle2FA(true, code)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const wasReconfiguring = this.isReconfiguringState();
          this.isSubmitting2FA.set(false);
          this.isReconfiguringState.set(false);
          this.userProfileService.clearPendingSetupCache();
          if (this.profile) {
            this.profile.isTwoFactorEnabled = true;
          }
          this.statusChanged.emit(true);
          this.profileUpdated.emit({ isTwoFactorEnabled: true });
          const successMsg = wasReconfiguring
            ? 'Authenticator reconfigured successfully! Your replacement device is now active.'
            : 'Two-factor authentication enabled successfully!';
          this.snackbar.show(successMsg, 'success');
          this.handleClose();
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
  }

  confirmDisable2FA(): void {
    const password = (this.disablePassword() || '').trim();
    if (!password) {
      this.twoFaError.set('Please enter your account password to confirm.');
      return;
    }

    this.isSubmitting2FA.set(true);
    this.twoFaError.set(null);

    this.userProfileService.toggle2FA(false, '', password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSubmitting2FA.set(false);
          this.userProfileService.clearPendingSetupCache();
          if (this.profile) {
            this.profile.isTwoFactorEnabled = false;
          }
          this.statusChanged.emit(false);
          this.profileUpdated.emit({ isTwoFactorEnabled: false });
          this.snackbar.show('Two-factor authentication disabled.', 'info');
          this.handleClose();
        },
        error: (err) => {
          this.isSubmitting2FA.set(false);
          const msg = err?.error?.message || err?.error || 'Failed to disable 2FA. Please verify your password.';
          this.twoFaError.set(msg);
        }
      });
  }

  openReconfigure2FA(): void {
    this.isReconfiguringState.set(true);
    this.twoFaStep.set('reconfigure');
    this.reconfigurePassword.set('');
    this.twoFaError.set(null);
  }

  confirmReconfigure(): void {
    const password = (this.reconfigurePassword() || '').trim();
    if (!password) {
      this.twoFaError.set('Please enter your account password to confirm reconfiguration.');
      return;
    }

    this.isSubmitting2FA.set(true);
    this.twoFaError.set(null);

    this.userProfileService.reconfigure2FA(password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

  onSecureInput(target: WritableSignal<string>, val: string): void {
    target.set(val);
    if (this.twoFaError()) {
      this.twoFaError.set(null);
    }
  }

  openViewBackupCodes(): void {
    this.twoFaStep.set('view-backup');
    this.backupPassword.set('');
    this.backupCodesLoaded.set(false);
    this.newBackupCodes.set([]);
    this.newCodesCopied.set(false);
    this.twoFaError.set(null);
  }

  confirmViewBackupCodes(): void {
    const password = (this.backupPassword() || '').trim();
    if (!password) {
      this.twoFaError.set('Please enter your account password.');
      return;
    }

    this.isLoadingBackupCodes.set(true);
    this.twoFaError.set(null);

    this.userProfileService.getBackupCodes(password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

    this.userProfileService.regenerateBackupCodes(password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
      this.safeTimeout(() => this.newCodesCopied.set(false), 2500);
      this.snackbar.show('8 backup codes copied to clipboard! Save them in a secure place.', 'success');
    }).catch(() => {
      this.snackbar.show('Unable to copy codes. Please copy them manually.', 'warning');
    });
  }

  copySecretKey(): void {
    const secret = this.secretKey();
    if (!secret) return;
    navigator.clipboard.writeText(secret).then(() => {
      this.secretCopied.set(true);
      this.safeTimeout(() => this.secretCopied.set(false), 2500);
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
      this.safeTimeout(() => this.backupCodesCopied.set(false), 2500);
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

  handleClose(): void {
    if (this.isSubmitting2FA() || this.isLoadingBackupCodes() || this.isRegeneratingCodes()) return;
    if (this.isReconfiguringState()) {
      this.userProfileService.cancelReconfigure2FA().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => { } });
      this.isReconfiguringState.set(false);
      this.snackbar.show('Reconfiguration cancelled. Your active authenticator remains unchanged.', 'info');
    }
    this.unlockBodyScroll();
    this.closeModal.emit();
  }
}