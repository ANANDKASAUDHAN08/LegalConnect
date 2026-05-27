import { Component, signal, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
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
    private router: Router,
    private snackbar: SnackbarService,
    private route: ActivatedRoute
  ) {}

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

  onRegister() {
    if (!this.agreeToTerms()) {
      this.snackbar.show('Please agree to the Terms of Service and Privacy Policy.', 'error');
      return;
    }

    this.error.set(null);
    this.loading.set(true);

    this.auth.register(this.registerData).subscribe({
      next: (res) => {
        const msg = res?.message || 'Account created successfully! You can now sign in.';
        this.snackbar.show(msg, 'success');
        this.router.navigate(['/login']);
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
  }
}
