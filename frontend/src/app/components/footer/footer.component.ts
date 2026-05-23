import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
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

  // A list of rotating inspiring quotes on justice
  quotes = [
    { text: "Justice is truth in action.", author: "Benjamin Disraeli" },
    { text: "Injustice anywhere is a threat to justice everywhere.", author: "Martin Luther King Jr." },
    { text: "The first duty of society is justice.", author: "Alexander Hamilton" },
    { text: "Law and order are the medicine of the body politic.", author: "Dr. B.R. Ambedkar" }
  ];
  currentQuoteIndex = signal(0);

  constructor(private snackbar: SnackbarService) {}

  cycleQuote() {
    this.currentQuoteIndex.update(idx => (idx + 1) % this.quotes.length);
  }

  onSubscribe() {
    if (!this.email) {
      this.snackbar.show('Please enter a valid email address.', 'error');
      return;
    }
    
    // Check basic email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.snackbar.show('Please enter a valid email format.', 'error');
      return;
    }

    this.loading.set(true);
    // Simulate API call
    setTimeout(() => {
      this.snackbar.show('Successfully subscribed to updates!', 'success');
      this.email = '';
      this.loading.set(false);
    }, 1000);
  }
}
