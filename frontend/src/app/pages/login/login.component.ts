import { Component } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, NgIf, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = ''; password = ''; error = ''; loading = false;
  constructor(
    private auth: AuthService, 
    private router: Router,
    private snackbar: SnackbarService
  ) {}

  onSubmit() {
    this.error = ''; this.loading = true;
    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.snackbar.show('Welcome back! Signed in successfully.', 'success');
        this.router.navigate(['/laws']);
      },
      error: (err) => { 
        this.error = err.error || 'Invalid credentials.'; 
        this.snackbar.show(this.error, 'error');
        this.loading = false; 
      }
    });
  }
}
