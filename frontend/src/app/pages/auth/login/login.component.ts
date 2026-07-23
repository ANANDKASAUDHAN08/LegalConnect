import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
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
  error = signal<string | null>(null);
  requires2fa = signal(false);

  loginData = { email: '', password: '' };
  twoFactorCode = '';
  rememberMe = signal(false);

  // Forgot Password Modal state
  showForgotPasswordModal = signal(false);

  constructor(
    private auth: AuthService,
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

  onLogin() {
    this.error.set(null);
    this.loading.set(true);

    if (this.rememberMe()) {
      localStorage.setItem('lc_remembered_email', this.loginData.email);
    } else {
      localStorage.removeItem('lc_remembered_email');
    }

    const loginPayload: { email: string; password: string; twoFactorCode?: string } = {
      email: this.loginData.email,
      password: this.loginData.password
    };

    if (this.requires2fa() && this.twoFactorCode) {
      loginPayload.twoFactorCode = this.twoFactorCode;
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
              this.error.set('Session initialization failed.');
              this.snackbar.show('Failed to complete session setup.', 'error');
              this.loading.set(false);
            }
          },
          error: () => {
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        this.error.set(err.error || 'Invalid credentials.');
        this.snackbar.show(this.error()!, 'error');
        this.loading.set(false);
      }
    });
  }

  loginWithGoogle() {
    this.snackbar.show('Google login coming soon!', 'info');
  }
}