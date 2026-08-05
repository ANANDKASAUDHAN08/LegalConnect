import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { GoogleAuthService } from '../../../services/google-auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { ForgotPasswordComponent } from '../../forgot-password/forgot-password.component';

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

  ngOnDestroy() {
    document.body.style.overflow = '';
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
    if (val.length < 6) return 'Verification code must be 6 digits.';
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

        // Complete session if token was received
        this.auth.completeLogin().subscribe({
          next: (isLoggedIn) => {
            if (isLoggedIn) {
              this.snackbar.show('Welcome back! Signed in successfully.', 'success');
              const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
              this.router.navigateByUrl(returnUrl);
            } else {
              const msg = 'Session initialization failed. Please try again.';
              this.error.set(msg);
              this.snackbar.show(msg, 'error');
              this.loading.set(false);
            }
          },
          error: () => {
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        let rawMsg = '';
        if (typeof err?.error === 'string') {
          rawMsg = err.error;
        } else if (err?.error?.message && typeof err.error.message === 'string') {
          rawMsg = err.error.message;
        } else if (err?.error?.title && typeof err.error.title === 'string') {
          rawMsg = err.error.title;
        } else if (err?.message && typeof err.message === 'string') {
          rawMsg = err.message;
        }

        let userMsg = 'Invalid email address or password. Please double-check your credentials and try again.';
        if (rawMsg && !rawMsg.toLowerCase().includes('invalid credential')) {
          userMsg = rawMsg;
        }

        this.error.set(userMsg);
        this.loading.set(false);
      }
    });
  }

  loginWithGoogle() {
    this.error.set(null);
    this.googleLoading.set(true);

    this.googleAuth.signInWithGoogle().subscribe({
      next: (credential) => {
        this.auth.loginWithGoogle(credential).subscribe({
          next: () => {
            this.auth.completeLogin().subscribe({
              next: (isLoggedIn) => {
                if (isLoggedIn) {
                  this.snackbar.show('Signed in with Google successfully!', 'success');
                  const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
                  this.router.navigateByUrl(returnUrl);
                } else {
                  this.error.set('Failed to initialize session with Google.');
                  this.snackbar.show('Session setup failed.', 'error');
                  this.googleLoading.set(false);
                }
              },
              error: () => this.googleLoading.set(false)
            });
          },
          error: (err) => {
            const msg = typeof err?.error === 'string' ? err.error : (err?.error?.message || 'Google authentication failed.');
            this.error.set(msg);
            this.snackbar.show(msg, 'error');
            this.googleLoading.set(false);
          }
        });
      },
      error: (err) => {
        const silentCodes = ['auth/popup-closed-by-user', 'auth/user-cancelled', 'auth/cancelled-popup-request'];
        if (!silentCodes.includes(err?.code)) {
          const msg = err?.message || 'Google Sign-In failed or popup was closed.';
          this.error.set(msg);
          this.snackbar.show(msg, 'error');
        }
        this.googleLoading.set(false);
      }
    });
  }
}