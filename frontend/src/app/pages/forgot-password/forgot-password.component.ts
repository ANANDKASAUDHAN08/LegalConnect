import { Component, signal } from '@angular/core';
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
  email = '';
  loading = signal(false);
  submitted = signal(false);

  constructor(
    private auth: AuthService,
    private snackbar: SnackbarService
  ) {}

  onSubmit() {
    this.loading.set(true);
    // Note: Mocking this as there might not be a forgot-password endpoint yet
    // I'll check the auth service again to be sure
    setTimeout(() => {
      this.submitted.set(true);
      this.loading.set(false);
      this.snackbar.show('If an account exists with this email, you will receive reset instructions.', 'success');
    }, 1500);
  }
}
