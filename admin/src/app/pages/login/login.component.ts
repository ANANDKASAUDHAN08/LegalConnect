import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminAuthService } from '../../core/auth.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { AdminIconComponent } from '../../shared/components/icon/icon.component';

@Component({
  selector: 'admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, AdminIconComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  email = '';
  password = '';
  showPassword = false;
  twoFactorCode = '';
  requires2FA = false;
  isLoading = false;
  errorMessage = '';

  constructor(private auth: AdminAuthService, private router: Router, private cdr: ChangeDetectorRef) {}

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password.';
      this.cdr.markForCheck();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.auth.login(this.email, this.password, this.twoFactorCode || undefined).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.requires2fa) {
          this.requires2FA = true;
          this.errorMessage = '2FA required. Enter your authenticator code.';
          this.cdr.markForCheck();
        } else if (res?.user?.mustChangePassword) {
          this.router.navigate(['/account'], { queryParams: { promptPasswordChange: 'true' } });
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        if (err?.status === 0) {
          this.errorMessage = 'Unable to reach backend server. Please check your network connection.';
        } else if (err?.status === 429) {
          this.errorMessage = 'Too many login attempts. Please wait a minute before trying again.';
        } else if (err?.status >= 500) {
          this.errorMessage = 'Server error occurred. Please try again shortly.';
        } else if (typeof err?.error === 'string' && err.error.trim()) {
          this.errorMessage = err.error;
        } else {
          this.errorMessage = err?.error?.message || 'Invalid email or password credentials.';
        }
        this.cdr.markForCheck();
      }
    });
  }
}