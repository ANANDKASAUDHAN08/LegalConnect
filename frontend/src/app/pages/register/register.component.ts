import { Component } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, NgIf, FormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  fullName = ''; email = ''; password = ''; role = 'Client';
  error = ''; success = ''; loading = false;
  
  constructor(
    private auth: AuthService, 
    private router: Router,
    private snackbar: SnackbarService
  ) {}

  onSubmit() {
    this.error = ''; this.loading = true;
    this.auth.register({ 
      fullName: this.fullName, 
      email: this.email, 
      password: this.password, 
      role: this.role 
    }).subscribe({
      next: () => { 
        this.snackbar.show('Account created successfully! You can now sign in.', 'success');
        this.router.navigate(['/login']); 
      },
      error: (err) => { 
        this.error = err.error || 'Registration failed.'; 
        this.snackbar.show(this.error, 'error');
        this.loading = false; 
      }
    });
  }
}
