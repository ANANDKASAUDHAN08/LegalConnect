import { Component } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, NgFor, FormsModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent {
  searchQuery = '';

  features = [
    { icon: '📜', title: 'Complete Bare Acts', desc: 'Access the full text of 500+ Indian Acts and Statutes, from the Constitution to the latest legislation.' },
    { icon: '🔍', title: 'Smart Search', desc: 'Find any section, clause, or keyword instantly across the entire legal library of India.' },
    { icon: '⚖️', title: 'Know Your Rights', desc: 'Understand your Fundamental Rights, Consumer Rights, Tenant Rights, and more in plain language.' },
    { icon: '👨‍⚖️', title: 'Find a Lawyer', desc: 'Connect with verified, specialized lawyers across India for consultations and legal aid.' },
    { icon: '📱', title: 'Mobile Friendly', desc: 'Access the entire legal library on-the-go. Works offline as a Progressive Web App.' },
    { icon: '🔔', title: 'Law Alerts', desc: 'Get notified when laws relevant to your interests are amended or new acts are passed.' },
  ];

  constructor(private router: Router) {}

  onSearch() {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/search'], { queryParams: { q: this.searchQuery } });
    }
  }
}
