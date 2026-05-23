import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class ResetPasswordComponent implements OnInit {
  showPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);
  submitted = signal(false);

  email: string | null = null;
  token: string | null = null;
  password = '';
  confirmPassword = '';

  passwordStrength = signal<{
    score: number;
    label: string;
    colorClass: string;
    percentage: number;
    hasLength8: boolean;
    hasUpperLower: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  }>({
    score: 0,
    label: 'None',
    colorClass: 'bg-slate-300 dark:bg-slate-700',
    percentage: 0,
    hasLength8: false,
    hasUpperLower: false,
    hasNumber: false,
    hasSpecial: false
  });

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snackbar: SnackbarService
  ) {}

  ngOnInit() {
    this.email = this.route.snapshot.queryParams['email'] || null;
    this.token = this.route.snapshot.queryParams['token'] || null;

    if (!this.email || !this.token) {
      this.error.set('Invalid or incomplete password reset link.');
      this.snackbar.show('The password reset link is missing required parameters.', 'error');
    }
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  onPasswordChange(password: string) {
    this.evaluatePasswordStrength(password);
  }

  evaluatePasswordStrength(password: string) {
    if (!password) {
      this.passwordStrength.set({
        score: 0,
        label: 'None',
        colorClass: 'bg-slate-300 dark:bg-slate-700',
        percentage: 0,
        hasLength8: false,
        hasUpperLower: false,
        hasNumber: false,
        hasSpecial: false
      });
      return;
    }

    const hasLength8 = password.length >= 8;
    const hasUpperLower = /[a-z]/.test(password) && /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    let score = 0;
    if (hasLength8) score++;
    if (hasUpperLower) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;

    let label = 'Very Weak';
    let colorClass = 'bg-red-500';
    let percentage = 25;

    if (score === 2) {
      label = 'Weak';
      colorClass = 'bg-orange-500';
      percentage = 50;
    } else if (score === 3) {
      label = 'Medium';
      colorClass = 'bg-yellow-500';
      percentage = 75;
    } else if (score === 4) {
      label = 'Strong';
      colorClass = 'bg-emerald-500';
      percentage = 100;
    }

    this.passwordStrength.set({
      score,
      label,
      colorClass,
      percentage,
      hasLength8,
      hasUpperLower,
      hasNumber,
      hasSpecial
    });
  }

  onSubmit() {
    if (!this.email || !this.token) {
      this.snackbar.show('Invalid reset link details.', 'error');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.snackbar.show('Passwords do not match.', 'error');
      return;
    }

    if (this.passwordStrength().score < 3) {
      this.snackbar.show('Please enter a stronger password.', 'error');
      return;
    }

    this.error.set(null);
    this.loading.set(true);

    this.auth.resetPassword({
      email: this.email,
      token: this.token,
      password: this.password
    }).subscribe({
      next: (res) => {
        this.snackbar.show(res?.message || 'Password reset successfully! You can now log in.', 'success');
        this.submitted.set(true);
        this.loading.set(false);
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.error.set(err.error || 'Failed to reset password.');
        this.snackbar.show(this.error()!, 'error');
        this.loading.set(false);
      }
    });
  }
}
