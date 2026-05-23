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

  loginData = { email: '', password: '' };
  rememberMe = signal(false);

  // Forgot Password Modal state
  showForgotPasswordModal = signal(false);

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snackbar: SnackbarService
  ) {}

  ngOnInit() {
    // Remember Me logic: restore email from local storage
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

    // Save or clear email for Remember Me
    if (this.rememberMe()) {
      localStorage.setItem('lc_remembered_email', this.loginData.email);
    } else {
      localStorage.removeItem('lc_remembered_email');
    }

    this.auth.login(this.loginData).subscribe({
      next: () => {
        this.snackbar.show('Welcome back! Signed in successfully.', 'success');
        
        // Redirect back to query parameter "returnUrl" if exists, else dashboard/laws
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/laws';
        this.router.navigateByUrl(returnUrl);
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
