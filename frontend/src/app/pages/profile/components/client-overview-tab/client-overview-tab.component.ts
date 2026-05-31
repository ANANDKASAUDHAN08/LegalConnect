import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserProfile } from '../../../../services/auth.service';
import { LawyerService } from '../../../../services/lawyer.service';

export interface QuickAccessItem {
  icon: string;
  label: string;
  description: string;
  tab: string;
  color: string;
  bgColor: string;
}

@Component({
  selector: 'app-client-overview-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-overview-tab.component.html'
})
export class ClientOverviewTabComponent implements OnInit {
  @Input() profile!: UserProfile;
  @Input() completionPct = 0;
  @Input() memberSinceLabel = '—';
  @Output() navigateTo = new EventEmitter<string>();

  casesCount = 0;
  upcomingCount = 0;
  reviewsCount = 0;
  loadingStats = true;

  quickAccessItems: QuickAccessItem[] = [
    {
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />`,
      label: 'Personal Details',
      description: 'Edit your legal profile',
      tab: 'profile-details',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />`,
      label: 'My Cases',
      description: 'View active & past cases',
      tab: 'activity-log',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    },
    {
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />`,
      label: 'Account Security',
      description: 'Manage password & 2FA',
      tab: 'security',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    },
    {
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.907c.961 0 1.36 1.24.588 1.81l-3.97 2.883a1 1 0 00-.364 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.971-2.883a1 1 0 00-1.175 0l-3.97 2.883c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.364-1.118L2.98 10.1c-.773-.57-.375-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />`,
      label: 'My Reviews',
      description: 'Reviews you\'ve written',
      tab: 'my-reviews',
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-50 dark:bg-amber-900/20'
    }
  ];

  statCards = [
    {
      key: 'consultations',
      label: 'CONSULTATIONS',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />`,
      iconBg: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400'
    },
    {
      key: 'upcoming',
      label: 'UPCOMING',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />`,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400'
    },
    {
      key: 'memberSince',
      label: 'MEMBER SINCE',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />`,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400'
    },
    {
      key: 'profile',
      label: 'PROFILE',
      icon: `<path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />`,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400'
    }
  ];

  constructor(private lawyerService: LawyerService) {}

  ngOnInit() {
    this.loadStats();
  }

  loadStats() {
    this.loadingStats = true;
    this.lawyerService.getSentInquiries().subscribe({
      next: (cases) => {
        this.casesCount = cases.length;
        this.upcomingCount = cases.filter(c => c.status === 'Pending' || c.status === 'Contacted').length;
        this.loadingStats = false;
      },
      error: () => { this.loadingStats = false; }
    });
  }

  getStatValue(key: string): string {
    switch (key) {
      case 'consultations': return String(this.casesCount);
      case 'upcoming': return this.upcomingCount > 0 ? `${this.upcomingCount} session${this.upcomingCount > 1 ? 's' : ''}` : 'None';
      case 'memberSince': return this.memberSinceLabel;
      case 'profile': return `${this.completionPct}%`;
      default: return '—';
    }
  }

  getStatValueClass(key: string): string {
    if (key === 'profile') return 'text-amber-600 dark:text-amber-400';
    return 'text-slate-900 dark:text-white';
  }

  getFirstName(): string {
    return this.profile?.fullName?.split(' ')[0] || 'there';
  }

  goTo(tab: string) {
    this.navigateTo.emit(tab);
  }
}
