import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
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
  ) {}

  onSubmit() {
    if (!this.email) return;
    this.loading.set(true);
    this.auth.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.submitted.set(true);
        this.loading.set(false);
        this.snackbar.show(res?.message || 'Reset link sent successfully.', 'success');
      },
      error: (err) => {
        this.loading.set(false);
        this.snackbar.show(err.error || 'Failed to request password reset.', 'error');
      }
    });
  }
}
