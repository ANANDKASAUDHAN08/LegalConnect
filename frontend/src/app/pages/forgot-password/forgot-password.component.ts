import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { trigger, transition, style, animate } from '@angular/animations';
import { LogoComponent } from '../../components/logo/logo.component';
import { IconComponent } from '../../components/icon/icon.component';
import { TooltipDirective } from '../../directives/tooltip.directive';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, LogoComponent, IconComponent, TooltipDirective],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
  animations: [
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class ForgotPasswordComponent {
  @Input() isModal = false;
  @Output() close = new EventEmitter<void>();

  email = '';
  loading = signal(false);
  submitted = signal(false);

  constructor(
    private auth: AuthService,
    private snackbar: SnackbarService
  ) { }

  onSubmit() {
    const trimmedEmail = this.email.trim();
    if (!trimmedEmail) {
      this.snackbar.show('Please enter your email address.', 'warning');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      this.snackbar.show('Please enter a valid email address.', 'warning');
      return;
    }

    this.loading.set(true);
    this.auth.forgotPassword(trimmedEmail).subscribe({
      next: (res) => {
        this.submitted.set(true);
        this.loading.set(false);
        this.snackbar.show(res?.message || 'Password reset link sent to your email.', 'success');
      },
      error: (err) => {
        this.loading.set(false);
        const errMsg = err?.error?.message || err?.error || 'Failed to request password reset. Please try again.';
        this.snackbar.show(errMsg, 'error');
      }
    });
  }

  resend() {
    this.submitted.set(false);
    this.onSubmit();
  }
}