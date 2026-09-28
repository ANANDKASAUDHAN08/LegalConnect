import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { VerificationService } from '../../services/verification.service';
import { SnackbarService } from '../../services/snackbar.service';
import { IconComponent } from '../icon/icon.component';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { getWebmailLauncher, WebmailProvider } from '../../core/utils/webmail-helper';

export { WebmailProvider };

@Component({
  selector: 'app-email-verification-banner',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective],
  templateUrl: './email-verification-banner.component.html',
  styleUrl: './email-verification-banner.component.scss'
})
export class EmailVerificationBannerComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private verificationService = inject(VerificationService);
  private snackbar = inject(SnackbarService);

  readonly maxCooldown = 60;
  isSending = signal(false);
  cooldownSeconds = signal(0);
  isDismissed = signal(false);
  copiedEmail = signal(false);
  sentSuccess = signal(false);
  showDetails = signal(false);

  private cooldownTimer: ReturnType<typeof setInterval> | null = null;
  private successTimer: ReturnType<typeof setTimeout> | null = null;

  currentUser = computed(() => this.auth.currentUser);

  // If user is verified or banner was dismissed for this session, do not show
  shouldShow = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    if (this.isDismissed()) return false;
    return user.isEmailVerified === false;
  });

  userEmail = computed(() => this.currentUser()?.email || '');

  // Detects the email domain to generate a 1-click webmail inbox launcher
  webmailInfo = computed<WebmailProvider | null>(() => {
    return getWebmailLauncher(this.userEmail());
  });

  cooldownPercent = computed(() => {
    const s = this.cooldownSeconds();
    if (s <= 0) return 0;
    return Math.round((s / this.maxCooldown) * 100);
  });

  ngOnInit(): void {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const dismissed = sessionStorage.getItem('dismiss_email_verification_banner');
      if (dismissed === 'true') {
        this.isDismissed.set(true);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    if (this.successTimer) {
      clearTimeout(this.successTimer);
      this.successTimer = null;
    }
  }

  resendVerification(): void {
    const email = this.userEmail();
    if (!email || this.isSending() || this.cooldownSeconds() > 0) return;

    this.isSending.set(true);

    this.verificationService.resendEmailVerification(email).subscribe({
      next: (res) => {
        this.isSending.set(false);
        this.sentSuccess.set(true);
        const msg = res?.message || `Verification link sent to ${email}! Please check your inbox.`;
        this.snackbar.show(msg, 'success');
        this.startCooldown(this.maxCooldown);

        if (this.successTimer) {
          clearTimeout(this.successTimer);
        }
        this.successTimer = setTimeout(() => {
          this.sentSuccess.set(false);
        }, 5000);
      },
      error: (err) => {
        this.isSending.set(false);
        const msg = err?.error?.message || err?.message || 'Failed to dispatch verification email. Please try again.';
        this.snackbar.show(msg, 'error');
        this.startCooldown(15);
      }
    });
  }

  copyEmail(): void {
    const email = this.userEmail();
    if (!email) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(email).then(() => {
        this.copiedEmail.set(true);
        this.snackbar.show('Email address copied to clipboard', 'info');
        setTimeout(() => this.copiedEmail.set(false), 2000);
      }).catch(() => {
        this.fallbackCopyText(email);
      });
    } else {
      this.fallbackCopyText(email);
    }
  }

  private fallbackCopyText(text: string): void {
    if (typeof document === 'undefined') return;
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      this.copiedEmail.set(true);
      this.snackbar.show('Email address copied to clipboard', 'info');
      setTimeout(() => this.copiedEmail.set(false), 2000);
    } catch {
      // ignore
    }
    document.body.removeChild(textArea);
  }

  openWebmail(): void {
    const info = this.webmailInfo();
    if (info?.url && typeof window !== 'undefined') {
      window.open(info.url, '_blank', 'noopener,noreferrer');
    }
  }

  toggleDetails(): void {
    this.showDetails.update(v => !v);
  }

  private startCooldown(seconds: number): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }
    this.cooldownSeconds.set(seconds);
    this.cooldownTimer = setInterval(() => {
      const remaining = this.cooldownSeconds() - 1;
      if (remaining <= 0) {
        this.cooldownSeconds.set(0);
        if (this.cooldownTimer) {
          clearInterval(this.cooldownTimer);
          this.cooldownTimer = null;
        }
      } else {
        this.cooldownSeconds.set(remaining);
      }
    }, 1000);
  }

  dismissBanner(): void {
    this.isDismissed.set(true);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem('dismiss_email_verification_banner', 'true');
    }
  }
}