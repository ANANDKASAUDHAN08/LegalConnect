import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserProfile } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  profile: UserProfile | null = null;
  loading = true;
  error = '';
  success = '';

  // Profile Edit
  isEditing = false;
  editFullName = '';

  // Password Change
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordError = '';
  passwordSuccess = '';

  constructor(private auth: AuthService, private snackbar: SnackbarService) {}

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile() {
    this.loading = true;
    this.auth.getProfile().subscribe({
      next: (res) => {
        this.profile = res;
        this.editFullName = res.fullName;
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load profile. Please sign in again.';
        this.snackbar.show(this.error, 'error');
        this.loading = false;
      }
    });
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.profile) {
      this.editFullName = this.profile.fullName;
    }
  }

  updateProfile() {
    if (!this.editFullName.trim()) return;

    this.auth.updateProfile(this.editFullName).subscribe({
      next: (res) => {
        if (this.profile) this.profile.fullName = res.fullName;
        this.isEditing = false;
        this.snackbar.show('Profile updated successfully!', 'success');
      },
      error: () => {
        this.snackbar.show('Failed to update profile.', 'error');
      }
    });
  }

  changePassword() {
    this.passwordError = '';
    this.passwordSuccess = '';

    if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'Passwords do not match.';
      this.snackbar.show(this.passwordError, 'warning');
      return;
    }

    if (this.newPassword.length < 6) {
      this.passwordError = 'New password must be at least 6 characters.';
      this.snackbar.show(this.passwordError, 'warning');
      return;
    }

    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.snackbar.show('Password changed successfully!', 'success');
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.passwordError = err.error || 'Failed to change password.';
        this.snackbar.show(this.passwordError, 'error');
      }
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
}
