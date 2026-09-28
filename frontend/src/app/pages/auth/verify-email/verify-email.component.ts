import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VerificationService } from '../../../services/verification.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { IconComponent } from '../../../components/icon/icon.component';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { getWebmailLauncher, WebmailProvider } from '../../../core/utils/webmail-helper';

export type VerificationState = 'loading' | 'success' | 'error' | 'manual';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, IconComponent, TooltipDirective],
  templateUrl: './verify-email.component.html'
})
export class VerifyEmailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private verificationService = inject(VerificationService);
  private auth = inject(AuthService);
  private snackbar = inject(SnackbarService);

  status = signal<VerificationState>('loading');
  errorMessage = signal<string>('');
  verifiedEmail = signal<string>('');
  resendEmail = signal<string>('');
  otpCode = signal<string>('');
  isVerifyingOtp = signal<boolean>(false);
  isResending = signal<boolean>(false);
  resendCooldown = signal<number>(0);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  currentUser = computed(() => this.auth.currentUser);

  get isLoggedIn(): boolean {
    return this.auth.isLoggedIn;
  }

  webmailInfo = computed<WebmailProvider | null>(() => {
    return getWebmailLauncher(this.resendEmail());
  });

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParams;
    const token = qp['token'] || qp['code'];
    const email = qp['email'] || this.auth.currentUser?.email || '';

    if (email) {
      const cleanEmail = decodeURIComponent(email).trim();
      this.resendEmail.set(cleanEmail);
      this.verifiedEmail.set(cleanEmail);
    }

    if (token && email) {
      const cleanEmail = decodeURIComponent(email).trim();
      const cleanToken = decodeURIComponent(token).trim();

      // If token is 6 digits, also prefill otpCode
      if (/^\d{6}$/.test(cleanToken)) {
        this.otpCode.set(cleanToken);
      }

      this.executeVerification(cleanToken, cleanEmail);
    } else {
      // Direct visit or navigation from in-app banner: enter manual OTP entry mode
      this.status.set('manual');
    }
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  private executeVerification(tokenOrCode: string, email: string): void {
    this.status.set('loading');
    this.verificationService.verifyEmail(tokenOrCode, email).subscribe({
      next: (res) => {
        this.status.set('success');
        this.auth.updateCurrentUser({ isEmailVerified: true });
        const successMsg = res?.message || 'Email confirmed successfully! Your dossier is now activated.';
        this.snackbar.show(successMsg, 'success');
      },
      error: (err) => {
        this.status.set('error');
        const rawErr = err?.error?.message || err?.message || 'This verification link is invalid or has expired.';
        this.errorMessage.set(rawErr);
        this.snackbar.show(rawErr, 'error');
      }
    });
  }

  onOtpInput(val: string): void {
    // Keep only numbers and max 6 chars
    const numeric = val.replace(/\D/g, '').slice(0, 6);
    this.otpCode.set(numeric);

    // Auto-verify as soon as all 6 digits are typed
    if (numeric.length === 6 && this.resendEmail().trim()) {
      this.verifyWithOtp();
    }
  }

  verifyWithOtp(): void {
    const code = this.otpCode().trim();
    const email = this.resendEmail().trim();

    if (!email) {
      this.snackbar.show('Please provide the registered email address.', 'warning');
      return;
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      this.snackbar.show('Please enter a valid 6-digit numeric verification code.', 'warning');
      return;
    }

    this.isVerifyingOtp.set(true);

    this.verificationService.verifyEmail(code, email).subscribe({
      next: (res) => {
        this.isVerifyingOtp.set(false);
        this.status.set('success');
        this.verifiedEmail.set(email);
        this.auth.updateCurrentUser({ isEmailVerified: true });
        const successMsg = res?.message || 'Email confirmed successfully! Your legal dossier is activated.';
        this.snackbar.show(successMsg, 'success');
      },
      error: (err) => {
        this.isVerifyingOtp.set(false);
        const rawErr = err?.error?.message || err?.message || 'Invalid or expired verification code. Please check your email or request a new code.';
        this.errorMessage.set(rawErr);
        this.snackbar.show(rawErr, 'error');
      }
    });
  }

  resendVerification(): void {
    const email = (this.resendEmail() || '').trim();
    if (!email || this.isResending() || this.resendCooldown() > 0) return;

    this.isResending.set(true);

    this.verificationService.resendEmailVerification(email).subscribe({
      next: (res) => {
        this.isResending.set(false);
        const msg = res?.message || `A new verification email with a 6-digit code has been dispatched to ${email}.`;
        this.snackbar.show(msg, 'success');
        this.startCooldown(60);
      },
      error: (err) => {
        this.isResending.set(false);
        const errDesc = err?.error?.message || err?.message || 'Failed to resend verification email. Please try again later.';
        this.snackbar.show(errDesc, 'error');
        this.startCooldown(15);
      }
    });
  }

  openWebmail(): void {
    const provider = this.webmailInfo();
    if (provider) {
      window.open(provider.url, '_blank', 'noopener,noreferrer');
    }
  }

  private startCooldown(seconds: number): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }
    this.resendCooldown.set(seconds);
    this.cooldownTimer = setInterval(() => {
      const remaining = this.resendCooldown() - 1;
      if (remaining <= 0) {
        this.resendCooldown.set(0);
        if (this.cooldownTimer) {
          clearInterval(this.cooldownTimer);
          this.cooldownTimer = null;
        }
      } else {
        this.resendCooldown.set(remaining);
      }
    }, 1000);
  }

  continueToDashboard(): void {
    const user = this.auth.currentUser;
    if (user) {
      const role = (user.role || '').toLowerCase();
      const dest = role === 'lawyer' ? '/lawyer/workstation' : '/client/portal';
      this.router.navigateByUrl(dest);
    } else {
      this.router.navigate(['/login'], { queryParams: { verified: 'true' } });
    }
  }
}