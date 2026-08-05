import { Component, signal, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { GoogleAuthService } from '../../../services/google-auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
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
export class RegisterComponent implements OnInit {
  showPassword = signal(false);
  loading = signal(false);
  googleLoading = signal(false);
  error = signal<string | null>(null);
  showStrengthPopup = false;

  registerData = { fullName: '', email: '', password: '', role: 'Client' };
  agreeToTerms = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const inside = target.closest('#password-container');
    if (!inside) {
      this.showStrengthPopup = false;
    }
  }

  onPasswordBlur() {
    setTimeout(() => {
      const activeEl = document.activeElement;
      if (!activeEl || !activeEl.closest('#password-container')) {
        this.showStrengthPopup = false;
      }
    }, 150);
  }


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
    private googleAuth: GoogleAuthService,
    private router: Router,
    private snackbar: SnackbarService,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const roleParam = params['role'];
      if (roleParam) {
        const normalized = roleParam.trim().toLowerCase();
        if (normalized === 'lawyer' || normalized === 'advocate') {
          this.registerData.role = 'Lawyer';
        } else if (normalized === 'client') {
          this.registerData.role = 'Client';
        }
      }
    });
  }

  togglePassword() {
    this.showPassword.update(v => !v);
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

  // Touched state signals for real-world field validation
  fullNameTouched = signal(false);
  emailTouched = signal(false);
  passwordTouched = signal(false);
  formSubmitted = signal(false);

  fullNameError(): string | null {
    if (!this.fullNameTouched() && !this.formSubmitted()) return null;
    const val = (this.registerData.fullName || '').trim();
    if (!val) return 'Full name is required.';
    if (val.length < 2) return 'Full name must be at least 2 characters.';
    return null;
  }

  emailError(): string | null {
    if (!this.emailTouched() && !this.formSubmitted()) return null;
    const val = (this.registerData.email || '').trim();
    if (!val) return 'Email address is required.';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) return 'Please enter a valid email address.';
    return null;
  }

  passwordError(): string | null {
    if (!this.passwordTouched() && !this.formSubmitted()) return null;
    const val = this.registerData.password || '';
    if (!val) return 'Password is required.';
    if (val.length < 8) return 'Password must be at least 8 characters.';
    return null;
  }

  markTouched(field: 'fullName' | 'email' | 'password') {
    if (field === 'fullName') this.fullNameTouched.set(true);
    if (field === 'email') this.emailTouched.set(true);
    if (field === 'password') this.passwordTouched.set(true);
  }

  onInputChange(field?: 'fullName' | 'email' | 'password') {
    if (field === 'fullName') this.fullNameTouched.set(true);
    if (field === 'email') this.emailTouched.set(true);
    if (field === 'password') this.passwordTouched.set(true);

    if (this.error()) {
      this.error.set(null);
    }
  }

  onRegister() {
    this.formSubmitted.set(true);
    this.error.set(null);

    const nameErr = this.fullNameError();
    const emailErr = this.emailError();
    const passErr = this.passwordError();

    if (nameErr || emailErr || passErr) {
      return;
    }

    if (!this.agreeToTerms()) {
      this.error.set('Please agree to the Terms of Service and Privacy Policy.');
      return;
    }

    const fullName = (this.registerData.fullName || '').trim();
    const email = (this.registerData.email || '').trim();
    const password = this.registerData.password || '';

    this.loading.set(true);

    this.auth.register({
      fullName,
      email,
      password,
      role: this.registerData.role
    }).subscribe({
      next: (res) => {
        const msg = res?.message || 'Account created successfully! You can now sign in.';
        this.snackbar.show(msg, 'success');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        const rawMsg = typeof err?.error === 'string' ? err.error : (err?.error?.message || 'Registration failed.');
        this.error.set(rawMsg);
        this.loading.set(false);
      }
    });
  }

  loginWithGoogle() {
    this.error.set(null);
    this.googleLoading.set(true);

    this.googleAuth.signInWithGoogle().subscribe({
      next: (credential) => {
        this.auth.loginWithGoogle(credential, this.registerData.role).subscribe({
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
            const msg = typeof err?.error === 'string' ? err.error : (err?.error?.message || 'Google registration failed.');
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