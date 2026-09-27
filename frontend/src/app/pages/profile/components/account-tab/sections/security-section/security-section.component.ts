import {
  Component, Input, Output, EventEmitter, inject,
  signal, computed, ChangeDetectionStrategy, OnInit, DestroyRef
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { UserProfile } from '../../../../../../services/auth.service';
import { UserProfileService } from '../../../../../../services/user-profile.service';
import { SnackbarService } from '../../../../../../services/snackbar.service';
import { VerificationFlowType } from '../../../verification-modal/verification-modal.component';
import { IconComponent } from '../../../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../../../directives/tooltip.directive';
import { calculateSecurityScore, getSecurityRating } from '../../../../../../utils/profile-helpers';

export interface PasswordFormModel {
  currentPassword: FormControl<string>;
  newPassword: FormControl<string>;
  confirmPassword: FormControl<string>;
}

export type TwoFaModalStep = 'setup' | 'disable' | 'reconfigure' | 'view-backup';

@Component({
  selector: 'app-security-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconComponent,
    TooltipDirective
  ],
  templateUrl: './security-section.component.html',
  styleUrls: ['./security-section.component.scss']
})
export class SecuritySectionComponent implements OnInit {
  @Input({ required: true }) profile!: UserProfile;
  @Input() isToggling2FA = false;

  @Output() open2FaModal = new EventEmitter<TwoFaModalStep>();
  @Output() requestVerification = new EventEmitter<VerificationFlowType>();
  @Output() passwordChanged = new EventEmitter<void>();

  private userProfileService = inject(UserProfileService);
  private snackbar = inject(SnackbarService);
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

  // ─── Password Change State ───────────────────────────────────
  showPasswordSection = signal<boolean>(false);
  isChangingPassword = signal<boolean>(false);
  passwordForm!: FormGroup<PasswordFormModel>;
  showCurrentPassword = signal<boolean>(false);
  showNewPassword = signal<boolean>(false);
  showConfirmPassword = signal<boolean>(false);

  // ─── Computed Projections ────────────────────────────────────
  securityScore = computed<number>(() => calculateSecurityScore(this.profile));
  securityRating = computed<string>(() => getSecurityRating(this.securityScore()));

  securityColorClasses = computed<string>(() => {
    const s = this.securityScore();
    if (s >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (s >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  });

  securityBgClasses = computed<string>(() => {
    const s = this.securityScore();
    if (s >= 80) {
      return 'bg-gradient-to-br from-emerald-500/[0.08] via-emerald-50/60 to-teal-500/[0.03] dark:from-emerald-950/45 dark:via-slate-900/90 dark:to-teal-950/25 border-emerald-500/25 dark:border-emerald-500/25 shadow-sm dark:shadow-[0_8px_30px_-6px_rgba(16,185,129,0.15)]';
    }
    if (s >= 60) {
      return 'bg-gradient-to-br from-amber-500/[0.08] via-amber-50/60 to-yellow-500/[0.03] dark:from-amber-950/45 dark:via-slate-900/90 dark:to-yellow-950/25 border-amber-500/25 dark:border-amber-500/25 shadow-sm dark:shadow-[0_8px_30px_-6px_rgba(245,158,11,0.15)]';
    }
    return 'bg-gradient-to-br from-rose-500/[0.08] via-rose-50/60 to-pink-500/[0.03] dark:from-rose-950/45 dark:via-slate-900/90 dark:to-pink-950/25 border-rose-500/25 dark:border-rose-500/25 shadow-sm dark:shadow-[0_8px_30px_-6px_rgba(244,63,94,0.15)]';
  });

  ngOnInit(): void {
    this.initPasswordForm();
  }

  toggleShowCurrentPassword(): void {
    this.showCurrentPassword.set(!this.showCurrentPassword());
  }

  toggleShowNewPassword(): void {
    this.showNewPassword.set(!this.showNewPassword());
  }

  toggleShowConfirmPassword(): void {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  // ─── 2FA Triggers ────────────────────────────────────────────
  toggleTwoFactor(): void {
    if (this.profile?.isTwoFactorEnabled) {
      this.open2FaModal.emit('disable');
    } else {
      this.open2FaModal.emit('setup');
    }
  }

  openReconfigure2FA(): void {
    this.open2FaModal.emit('reconfigure');
  }

  openViewBackupCodes(): void {
    this.open2FaModal.emit('view-backup');
  }

  // ─── Verification Trigger ────────────────────────────────────
  triggerVerification(flow: VerificationFlowType): void {
    this.requestVerification.emit(flow);
  }

  // ─── Password Update ─────────────────────────────────────────
  private initPasswordForm(): void {
    this.passwordForm = this.fb.group<PasswordFormModel>({
      currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
      confirmPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] })
    });
  }

  togglePasswordSection(): void {
    this.showPasswordSection.set(!this.showPasswordSection());
    if (!this.showPasswordSection()) {
      this.passwordForm.reset();
      this.showCurrentPassword.set(false);
      this.showNewPassword.set(false);
      this.showConfirmPassword.set(false);
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
    this.userProfileService.changePassword(currentPassword, newPassword)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.isChangingPassword.set(false);
          this.showPasswordSection.set(false);
          this.passwordForm.reset();
          this.snackbar.show(res?.message || 'Password updated successfully! Future logins require your new password.', 'success');
          this.passwordChanged.emit();
        },
        error: (err) => {
          this.isChangingPassword.set(false);
          const msg = err?.error?.message || err?.message || 'Current password is incorrect or does not meet requirements.';
          this.snackbar.show(msg, 'error');
        }
      });
  }
}