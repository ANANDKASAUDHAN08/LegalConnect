import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { GoogleAuthService } from '../../../services/google-auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { ForgotPasswordComponent } from '../../forgot-password/forgot-password.component';
import { extractErrorMessage } from '../../../core/utils/error-utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ForgotPasswordComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit, OnDestroy {
  showPassword = signal(false);
  loading = signal(false);
  googleLoading = signal(false);
  error = signal<string | null>(null);
  requires2fa = signal(false);

  // Real-time account lockout countdown timer state
  lockoutSeconds = signal<number>(0);
  lockoutBannerDismissed = signal<boolean>(false);
  attemptsRemaining = signal<number | null>(null);
  private lockoutIntervalId: any = null;

  loginData = { email: '', password: '' };
  twoFactorCode = '';
  rememberMe = signal(false);

  // Forgot Password Modal state
  showForgotPasswordModal = signal(false);

  constructor(
    private auth: AuthService,
    private googleAuth: GoogleAuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snackbar: SnackbarService
  ) { }

  ngOnInit() {
    const rememberedEmail = localStorage.getItem('lc_remembered_email');
    if (rememberedEmail) {
      this.loginData.email = rememberedEmail;
      this.rememberMe.set(true);
    }

    // Check for an active lockout timer saved across page reloads
    this.checkPersistedLockout();
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  openForgotPasswordModal() {
    this.showForgotPasswordModal.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeForgotPasswordModal() {
    this.showForgotPasswordModal.set(false);
    document.body.style.overflow = '';
  }

  checkPersistedLockout() {
    const lockoutUntilStr = localStorage.getItem('lc_lockout_until');
    if (lockoutUntilStr) {
      const lockoutUntil = parseInt(lockoutUntilStr, 10);
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      if (remaining > 0) {
        const lockedEmail = localStorage.getItem('lc_lockout_email');
        this.startLockoutTimer(remaining, lockedEmail || undefined);
      } else {
        localStorage.removeItem('lc_lockout_until');
        localStorage.removeItem('lc_lockout_email');
      }
    }
  }

  startLockoutTimer(totalSeconds: number, email?: string) {
    const lockoutUntil = Date.now() + totalSeconds * 1000;

    // Skip redundant restarts: if interval is already ticking towards the same epoch (±2s tolerance),
    // just update the signal and localStorage without recreating the interval.
    const existingUntilStr = localStorage.getItem('lc_lockout_until');
    if (this.lockoutIntervalId && existingUntilStr) {
      const existingUntil = parseInt(existingUntilStr, 10);
      if (Math.abs(existingUntil - lockoutUntil) < 2000) {
        this.lockoutSeconds.set(totalSeconds);
        this.lockoutBannerDismissed.set(false);
        return;
      }
    }

    this.stopLockoutTimer();
    this.lockoutSeconds.set(totalSeconds);
    this.lockoutBannerDismissed.set(false);
    localStorage.setItem('lc_lockout_until', lockoutUntil.toString());
    if (email) {
      localStorage.setItem('lc_lockout_email', email.trim().toLowerCase());
    }

    this.lockoutIntervalId = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      this.lockoutSeconds.set(remaining);

      if (remaining <= 0) {
        this.stopLockoutTimer();
        localStorage.removeItem('lc_lockout_until');
        localStorage.removeItem('lc_lockout_email');
        this.lockoutBannerDismissed.set(false);
        this.error.set(null);
        this.snackbar.show('Account lockout has expired. You may now attempt to sign in again.', 'info');
      }
    }, 1000);
  }

  stopLockoutTimer() {
    if (this.lockoutIntervalId) {
      clearInterval(this.lockoutIntervalId);
      this.lockoutIntervalId = null;
    }
  }

  dismissLockoutBanner() {
    // Only dismiss the visual card. Do NOT wipe out the timer so remaining seconds are preserved!
    this.lockoutBannerDismissed.set(true);
  }

  clearLockout() {
    this.stopLockoutTimer();
    this.lockoutSeconds.set(0);
    this.lockoutBannerDismissed.set(false);
    this.attemptsRemaining.set(null);
    this.error.set(null);
    localStorage.removeItem('lc_lockout_until');
    localStorage.removeItem('lc_lockout_email');
  }

  /**
   * Returns true only when the email currently in the input matches the locked email
   * AND the lockout timer is still active. This enables per-email lockout:
   * if user@a.com is locked, another@b.com can still sign in from the same device.
   */
  isCurrentEmailLocked(): boolean {
    if (this.lockoutSeconds() <= 0) return false;
    const lockedEmail = localStorage.getItem('lc_lockout_email');
    if (!lockedEmail) return true; // No email stored — apply lockout globally (safety fallback)
    const currentEmail = (this.loginData.email || '').trim().toLowerCase();
    if (!currentEmail) return true; // Empty input — keep locked (can't determine)
    return lockedEmail === currentEmail;
  }

  formatLockoutTime(totalSeconds: number): string {
    if (totalSeconds <= 0) return '00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const sStr = seconds.toString().padStart(2, '0');
    if (hours > 0) {
      const mStr = minutes.toString().padStart(2, '0');
      return `${hours}h ${mStr}m ${sStr}s`;
    }
    const mStr = minutes.toString().padStart(2, '0');
    return `${mStr}:${sStr}`;
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
    this.stopLockoutTimer();
  }

  // Touched state signals for real-world field validation
  emailTouched = signal(false);
  passwordTouched = signal(false);
  codeTouched = signal(false);
  formSubmitted = signal(false);

  emailError(): string | null {
    if (!this.emailTouched() && !this.formSubmitted()) return null;
    const val = (this.loginData.email || '').trim();
    if (!val) return 'Email address is required.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) return 'Please enter a valid email address.';
    return null;
  }

  passwordError(): string | null {
    if (!this.passwordTouched() && !this.formSubmitted()) return null;
    const val = this.loginData.password || '';
    if (!val) return 'Password is required.';
    return null;
  }

  codeError(): string | null {
    if (!this.requires2fa()) return null;
    if (!this.codeTouched() && !this.formSubmitted()) return null;
    const val = (this.twoFactorCode || '').trim();
    if (!val) return 'Verification code is required.';
    if (val.length < 6) return 'Verification code must be at least 6 characters.';
    return null;
  }

  markTouched(field: 'email' | 'password' | 'code') {
    if (field === 'email') this.emailTouched.set(true);
    if (field === 'password') this.passwordTouched.set(true);
    if (field === 'code') this.codeTouched.set(true);
  }

  onInputChange(field?: 'email' | 'password' | 'code') {
    if (field === 'email') this.emailTouched.set(true);
    if (field === 'password') this.passwordTouched.set(true);
    if (field === 'code') this.codeTouched.set(true);

    if (this.error()) {
      this.error.set(null);
    }
  }

  onLogin() {
    this.formSubmitted.set(true);
    this.error.set(null);

    const emailErr = this.emailError();
    const passErr = this.passwordError();
    const codeErr = this.codeError();

    if (emailErr || passErr || codeErr) {
      return;
    }

    const email = (this.loginData.email || '').trim();
    const password = this.loginData.password || '';

    // ── Client-side lockout gate ──
    // If user dismissed the banner and clicks "Sign In" again while still locked,
    // do NOT send the request to the backend. Just re-show the banner with exact remaining time.
    const lockoutUntilStr = localStorage.getItem('lc_lockout_until');
    const lockedEmail = localStorage.getItem('lc_lockout_email');
    if (lockoutUntilStr && (!lockedEmail || lockedEmail === email.toLowerCase())) {
      const lockoutUntil = parseInt(lockoutUntilStr, 10);
      const remainingSeconds = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
      if (remainingSeconds > 0) {
        // Re-show the lockout banner with exact remaining seconds (no API call, no reset)
        this.lockoutBannerDismissed.set(false);
        this.lockoutSeconds.set(remainingSeconds);
        if (!this.lockoutIntervalId) {
          this.startLockoutTimer(remainingSeconds, email);
        }
        return; // Block the API request entirely
      } else {
        // Lockout expired since last check — clean up stale keys
        localStorage.removeItem('lc_lockout_until');
        localStorage.removeItem('lc_lockout_email');
      }
    }

    this.loading.set(true);

    if (this.rememberMe()) {
      localStorage.setItem('lc_remembered_email', email);
    } else {
      localStorage.removeItem('lc_remembered_email');
    }

    const loginPayload: { email: string; password: string; twoFactorCode?: string } = {
      email,
      password
    };

    if (this.requires2fa() && this.twoFactorCode) {
      loginPayload.twoFactorCode = this.twoFactorCode.trim();
    }

    this.auth.login(loginPayload).subscribe({
      next: (res) => {
        if (res?.requires2fa) {
          this.requires2fa.set(true);
          this.loading.set(false);
          return;
        }

        if (!res || (!res.token && !res.user && !this.auth.isLoggedIn)) {
          this.loading.set(false);
          this.error.set('Authentication failed. No valid session was received from the server.');
          return;
        }

        this.loading.set(false);
        this.clearLockout();
        this.snackbar.show('Welcome back! Signed in successfully.', 'success');
        const role = (res.user?.role || this.auth.currentUser?.role || '').toLowerCase();
        const defaultDestination = role === 'lawyer' ? '/lawyer/workstation' : '/client/portal';
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || defaultDestination;
        this.router.navigateByUrl(returnUrl).then(success => {
          if (!success) {
            this.router.navigate([defaultDestination]).then(fallbackSuccess => {
              if (!fallbackSuccess) {
                this.router.navigate(['/home']);
              }
            });
          }
        }).catch(() => {
          this.router.navigate([defaultDestination]).catch(() => {
            this.router.navigate(['/home']);
          });
        });
      },
      error: (err) => {
        const userMsg = extractErrorMessage(err, 'Invalid email address or password. Please double-check your credentials and try again.');
        this.error.set(userMsg);
        this.loading.set(false);

        // Detect account lockout and start/continue real-time countdown timer
        let lockoutDurationSeconds = 0;

        // Priority 1: Exact seconds from structured API response (most accurate)
        if (err?.error?.lockoutSeconds && typeof err.error.lockoutSeconds === 'number') {
          lockoutDurationSeconds = err.error.lockoutSeconds;
        } else if (typeof userMsg === 'string') {
          // Priority 2: Parse compound format: "9 minute(s) and 12 second(s)"
          const minSecMatch = userMsg.match(/(\d+)\s*(?:minutes?|m)\s*(?:and\s*)?(\d+)\s*(?:seconds?|s)/i);
          if (minSecMatch) {
            lockoutDurationSeconds = parseInt(minSecMatch[1], 10) * 60 + parseInt(minSecMatch[2], 10);
          } else {
            // Priority 3: Parse individual time units with smart reconciliation
            const hourMatch = userMsg.match(/(\d+)\s*hour/i);
            const minMatch = userMsg.match(/(\d+)\s*minute/i);
            const secMatch = userMsg.match(/(\d+)\s*second/i);

            if (hourMatch) {
              lockoutDurationSeconds = parseInt(hourMatch[1], 10) * 3600;
            } else if (minMatch) {
              const serverMinutes = parseInt(minMatch[1], 10);

              // Smart reconciliation: If we already have an active countdown whose
              // ceiling matches the server's rounded minutes, preserve exact seconds.
              // Example: timer shows 09:12 (552s) → Math.ceil(552/60) = 10
              // Server says "10 minute(s)" → keep 552s, don't reset to 600s.
              const currentRemaining = this.lockoutSeconds();
              const existingUntilStr = localStorage.getItem('lc_lockout_until');
              let storedRemaining = 0;
              if (existingUntilStr) {
                storedRemaining = Math.max(0, Math.ceil((parseInt(existingUntilStr, 10) - Date.now()) / 1000));
              }

              const bestRemaining = currentRemaining > 0 ? currentRemaining : storedRemaining;
              if (bestRemaining > 0 && Math.ceil(bestRemaining / 60) === serverMinutes) {
                lockoutDurationSeconds = bestRemaining;
              } else {
                lockoutDurationSeconds = serverMinutes * 60;
              }
            } else if (secMatch) {
              lockoutDurationSeconds = parseInt(secMatch[1], 10);
            }
          }
        }

        if (lockoutDurationSeconds > 0) {
          this.lockoutBannerDismissed.set(false);
          this.attemptsRemaining.set(null); // Clear warning when locked
          this.startLockoutTimer(lockoutDurationSeconds, email);
        } else {
          // Capture attemptsRemaining for pre-lockout warning banner
          const remaining = err?.error?.attemptsRemaining;
          if (typeof remaining === 'number' && remaining >= 0) {
            this.attemptsRemaining.set(remaining);
          } else {
            this.attemptsRemaining.set(null);
          }
        }
      }
    });
  }

  loginWithGoogle() {
    this.error.set(null);
    this.googleLoading.set(true);

    this.googleAuth.signInWithGoogle().subscribe({
      next: (credential) => {
        if (!credential) {
          this.googleLoading.set(false);
          return;
        }

        this.auth.loginWithGoogle(credential).subscribe({
          next: (isLoggedIn) => {
            if (isLoggedIn) {
              this.clearLockout();
              this.snackbar.show('Signed in with Google successfully!', 'success');
              const role = (this.auth.currentUser?.role || '').toLowerCase();
              const defaultDestination = role === 'lawyer' ? '/lawyer/workstation' : '/client/portal';
              const returnUrl = this.route.snapshot.queryParams['returnUrl'] || defaultDestination;
              this.router.navigateByUrl(returnUrl).then(success => {
                if (!success) {
                  this.router.navigate([defaultDestination]).then(fallbackSuccess => {
                    if (!fallbackSuccess) {
                      this.router.navigate(['/home']);
                    }
                  });
                }
              }).catch(() => {
                this.router.navigate([defaultDestination]).catch(() => {
                  this.router.navigate(['/home']);
                });
              });
            } else {
              this.error.set('Failed to initialize session with Google.');
              this.googleLoading.set(false);
            }
          },
          error: (err) => {
            const msg = extractErrorMessage(err, 'Google authentication failed.');
            this.error.set(msg);
            this.snackbar.show(msg, 'error');
            this.googleLoading.set(false);
          }
        });
      },
      error: (err) => {
        // If user double-clicked while popup is still open, keep loading state
        if (err?.code === 'auth/popup-already-open') {
          return;
        }
        const silentCodes = ['auth/popup-closed-by-user', 'auth/user-cancelled', 'auth/cancelled-popup-request'];
        if (!silentCodes.includes(err?.code)) {
          const msg = err?.message || 'Google Sign-In failed.';
          this.error.set(msg);
          this.snackbar.show(msg, 'error');
        }
        this.googleLoading.set(false);
      }
    });
  }
}