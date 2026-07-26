import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../core/auth.service';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';

@Component({
  selector: 'admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  email = '';
  password = '';
  twoFactorCode = '';
  requires2FA = false;
  isLoading = false;
  errorMessage = '';

  constructor(private auth: AdminAuthService, private router: Router) {}

  onSubmit(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter both email and password.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.auth.login(this.email, this.password, this.twoFactorCode || undefined).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.requires2fa) {
          this.requires2FA = true;
          this.errorMessage = '2FA required. Enter your authenticator code.';
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Invalid email or password or unauthorized.';
      }
    });
  }
}