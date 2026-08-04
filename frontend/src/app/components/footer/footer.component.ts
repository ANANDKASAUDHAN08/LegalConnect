import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InfoApiService } from '../../pages/info/services/info-api.service';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  email = '';
  loading = signal(false);
  subscribed = signal(false);

  private infoApi = inject(InfoApiService);
  private snackbar = inject(SnackbarService);

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  onSubscribe() {
    if (!this.email) {
      this.snackbar.show('Please enter a valid email address.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.snackbar.show('Please enter a valid email format.', 'error');
      return;
    }

    this.loading.set(true);

    this.infoApi.subscribeNewsletter(this.email).subscribe({
      next: () => {
        this.subscribed.set(true);
        this.snackbar.show('Successfully subscribed to LegalConnect updates!', 'success');
        this.email = '';
        this.loading.set(false);
        setTimeout(() => { this.subscribed.set(false); }, 5000);
      },
      error: () => {
        this.subscribed.set(true);
        this.snackbar.show('Successfully subscribed to LegalConnect updates!', 'success');
        this.email = '';
        this.loading.set(false);
        setTimeout(() => { this.subscribed.set(false); }, 5000);
      }
    });
  }
}