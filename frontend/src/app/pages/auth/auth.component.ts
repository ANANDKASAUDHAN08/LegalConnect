import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
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
export class AuthComponent implements OnInit {
  activeTab = signal<'login' | 'register'>('login');
  showPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  // Login form
  loginData = { email: '', password: '' };

  // Register form
  registerData = { fullName: '', email: '', password: '', role: 'Client' };

  testimonials = [
    { name: 'Anita Rao', role: 'Verified Client', quote: 'Found the perfect lawyer in 10 minutes. Saved my case!', avatar: 'AR' },
    { name: 'Mohit Kapoor', role: 'Verified Client', quote: 'Consultations are so easy now. Highly recommend.', avatar: 'MK' },
    { name: 'Sneha Verma', role: 'Verified Client', quote: '100% secure and professional. Best legal platform.', avatar: 'SV' }
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snackbar: SnackbarService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'register') {
        this.activeTab.set('register');
      } else {
        this.activeTab.set('login');
      }
    });
  }

  switchTab(tab: 'login' | 'register') {
    this.activeTab.set(tab);
    this.error.set(null);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  onLogin() {
    this.error.set(null);
    this.loading.set(true);
    this.auth.login(this.loginData).subscribe({
      next: () => {
        this.snackbar.show('Welcome back! Signed in successfully.', 'success');
        this.router.navigate(['/laws']);
      },
      error: (err) => {
        this.error.set(err.error || 'Invalid credentials.');
        this.snackbar.show(this.error()!, 'error');
        this.loading.set(false);
      }
    });
  }

  onRegister() {
    this.error.set(null);
    this.loading.set(true);
    this.auth.register(this.registerData).subscribe({
      next: () => {
        this.snackbar.show('Account created successfully! You can now sign in.', 'success');
        this.switchTab('login');
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error || 'Registration failed.');
        this.snackbar.show(this.error()!, 'error');
        this.loading.set(false);
      }
    });
  }

  loginWithGoogle() {
    this.snackbar.show('Google login coming soon!', 'info');
    // Implement Google OAuth logic here when ready
  }
}
