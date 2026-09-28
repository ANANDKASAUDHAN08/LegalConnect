import {
  Component, Input, Output, EventEmitter, inject,
  signal, computed, ChangeDetectionStrategy, OnDestroy, DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserProfile, AuthService } from '../../../../services/auth.service';
import { UserProfileService } from '../../../../services/user-profile.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { VerificationFlowType } from '../verification-modal/verification-modal.component';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { SecuritySectionComponent } from './sections/security-section/security-section.component';
import { SessionsSectionComponent } from './sections/sessions-section/sessions-section.component';
import { PreferencesSectionComponent } from './sections/preferences-section/preferences-section.component';
import { TwoFactorModalComponent, TwoFaStep } from './sections/two-factor-modal/two-factor-modal.component';

// Re-export types for backward compatibility
export { ActiveSessionItem } from './sections/sessions-section/sessions-section.component';
export { PasswordFormModel, TwoFaModalStep } from './sections/security-section/security-section.component';
export { TwoFaStep } from './sections/two-factor-modal/two-factor-modal.component';

@Component({
  selector: 'app-account-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IconComponent,
    TooltipDirective,
    SecuritySectionComponent,
    SessionsSectionComponent,
    PreferencesSectionComponent,
    TwoFactorModalComponent
  ],
  templateUrl: './account-tab.component.html',
  styleUrls: ['./account-tab.component.scss']
})
export class AccountTabComponent implements OnDestroy {
  @Input({ required: true }) profile!: UserProfile;
  @Output() profileUpdated = new EventEmitter<Partial<UserProfile>>();
  @Output() requestVerification = new EventEmitter<VerificationFlowType>();
  @Output() requestEditProfile = new EventEmitter<void>();
  @Output() requestConfirm = new EventEmitter<{
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    action: () => void;
  }>();

  private auth = inject(AuthService);
  private userProfileService = inject(UserProfileService);
  private snackbar = inject(SnackbarService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  private pendingTimers = new Set<ReturnType<typeof setTimeout>>();
  private isDestroyed = false;

  // ─── 2FA Modal Orchestration ──────────────────────────────────
  show2FaModal = signal<boolean>(false);
  twoFaStep = signal<TwoFaStep>('setup');
  isToggling2FA = signal<boolean>(false);

  // ─── Phone Masking & Visibility Toggle ───────────────────────
  showFullPhone = signal<boolean>(false);

  maskedPhone = computed<string>(() => {
    const phone = this.profile?.phone;
    if (!phone) return 'No mobile phone linked';
    if (phone.length <= 4) return phone;
    const last4 = phone.slice(-4);
    return `+91 •••••••${last4}`;
  });

  displayPhone = computed<string>(() => {
    const phone = this.profile?.phone;
    if (!phone) return 'No mobile phone linked';
    if (this.showFullPhone()) {
      return phone.startsWith('+') ? phone : `+91 ${phone}`;
    }
    return this.maskedPhone();
  });

  // ─── WhatsApp Alerts Summary ─────────────────────────────────
  isWhatsAppEnabled = computed<boolean>(() => {
    return !!this.profile?.notifyWhatsAppEnabled;
  });

  whatsAppSummary = computed<string>(() => {
    if (!this.profile?.notifyWhatsAppEnabled) {
      return 'Instant hearing & consultation alerts';
    }
    const phone = this.profile.whatsAppPhone || this.profile.phone;
    if (phone) {
      return `Active on ${phone.startsWith('+') ? phone : '+91 ' + phone}`;
    }
    return 'Active for case & hearing notices';
  });

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.pendingTimers.forEach(t => clearTimeout(t));
    this.pendingTimers.clear();
  }

  private safeTimeout(fn: () => void, ms: number): void {
    const timer = setTimeout(() => {
      this.pendingTimers.delete(timer);
      if (!this.isDestroyed) fn();
    }, ms);
    this.pendingTimers.add(timer);
  }

  toggleShowPhone(): void {
    this.showFullPhone.update(v => !v);
  }

  openVerification(flow: VerificationFlowType): void {
    this.requestVerification.emit(flow);
  }

  handlePhoneAction(): void {
    if (!this.profile?.phone) {
      this.requestEditProfile.emit();
    } else {
      this.openVerification('phone');
    }
  }

  handleOpen2FaModal(step: TwoFaStep): void {
    this.twoFaStep.set(step);
    this.show2FaModal.set(true);
  }

  close2FaModal(): void {
    this.show2FaModal.set(false);
  }

  handle2FaStatusChanged(enabled: boolean): void {
    if (this.profile) {
      this.profile.isTwoFactorEnabled = enabled;
    }
  }

  // ─── Danger Zone Actions ─────────────────────────────────────
  deactivateAccount(): void {
    this.triggerConfirm(
      'Deactivate Account',
      'Deactivating will temporarily pause your active consultations and hide your profile from search results. You can reactivate at any time simply by signing back in.',
      'warning',
      () => {
        this.userProfileService.deactivateAccount()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackbar.show('Account deactivated. Signing out...', 'info');
              this.safeTimeout(() => {
                this.auth.logout().subscribe();
                this.router.navigate(['/login']);
              }, 800);
            },
            error: (err) => {
              this.snackbar.show(err?.error?.message || 'Failed to deactivate account. Please try again.', 'error');
            }
          });
      }
    );
  }

  deleteAccount(): void {
    this.triggerConfirm(
      'Permanently Delete Account',
      'CRITICAL: This action cannot be undone. All personal records, past legal dossiers, and verified credentials will be permanently erased pursuant to legal data retention policies.',
      'danger',
      () => {
        this.userProfileService.deleteAccount()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.snackbar.show('Your account has been permanently deleted.', 'info');
              this.safeTimeout(() => {
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

  triggerConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', action: () => void): void {
    this.requestConfirm.emit({ title, message, type, action });
  }
}