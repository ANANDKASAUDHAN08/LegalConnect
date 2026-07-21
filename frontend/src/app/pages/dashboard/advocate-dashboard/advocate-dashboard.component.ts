import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { AuthService, UserProfile } from '../../../services/auth.service';
import { LawyerService, Consultation } from '../../../services/lawyer.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { ReviewCardComponent } from '../../../components/review-card/review-card.component';

@Component({
  selector: 'app-advocate-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterLink, 
    StatCardComponent, 
    TooltipDirective,
    ReviewCardComponent
  ],
  templateUrl: './advocate-dashboard.component.html',
  styleUrls: ['./advocate-dashboard.component.scss']
})
export class AdvocateDashboardComponent implements OnInit, OnDestroy {
  // User Profile
  currentUser: UserProfile | null = null;

  // Active Tab
  activeTab = signal<'inbox' | 'preview' | 'reviews' | 'analytics'>('inbox');

  // Loading States
  minTimeElapsed = signal(false);
  inquiriesLoaded = signal(false);
  analyticsLoaded = signal(false);
  reviewsLoaded = signal(false);

  isPageLoading = computed(() => {
    return !(this.inquiriesLoaded() && this.analyticsLoaded() && this.reviewsLoaded() && this.minTimeElapsed());
  });

  // Data Signals
  inquiries = signal<Consultation[]>([]);
  analytics = signal<any>({
    totalViews: 0,
    viewsThisMonth: 0,
    totalInquiries: 0,
    conversionRate: 0,
    averageRating: 4.8,
    totalReviews: 0,
    dailyViews: []
  });
  reviewsList = signal<any[]>([]);

  // Search & Filter States
  searchText = signal('');
  statusFilter = signal<'All' | 'Pending' | 'Contacted' | 'Closed'>('All');

  // Computed lists for Inbox
  filteredInquiries = computed(() => {
    const list = this.inquiries();
    const query = this.searchText().trim().toLowerCase();
    const status = this.statusFilter();

    return list.filter(inq => {
      const matchesStatus = status === 'All' || inq.status === status;
      const clientName = inq.clientName ? inq.clientName.toLowerCase() : '';
      const clientEmail = inq.clientEmail ? inq.clientEmail.toLowerCase() : '';
      const message = inq.message ? inq.message.toLowerCase() : '';
      const matchesSearch = !query || 
                            clientName.includes(query) || 
                            clientEmail.includes(query) || 
                            message.includes(query);
      return matchesStatus && matchesSearch;
    });
  });

  // Computed stats
  pendingInquiriesCount = computed(() => {
    return this.inquiries().filter(i => i.status === 'Pending').length;
  });

  private sub = new Subscription();

  constructor(
    public authService: AuthService,
    private lawyerService: LawyerService,
    private snackbar: SnackbarService,
    private router: Router
  ) {}

  ngOnInit() {
    // 1. Ensure minimum visual loading time
    setTimeout(() => {
      this.minTimeElapsed.set(true);
    }, 600);

    // 2. Fetch User & Load Workstation data
    this.sub.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (user && user.role === 'Lawyer') {
          this.loadAllDashboardData();
        }
      })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  loadAllDashboardData() {
    this.inquiriesLoaded.set(false);
    this.analyticsLoaded.set(false);
    this.reviewsLoaded.set(false);

    // ForkJoin parallel fetches
    forkJoin({
      inquiries: this.lawyerService.getReceivedInquiries(),
      analytics: this.lawyerService.getMyAnalytics(),
      reviews: this.lawyerService.getMyReviews()
    }).subscribe({
      next: (res) => {
        this.inquiries.set(res.inquiries || []);
        this.analytics.set(res.analytics || {
          totalViews: 0,
          viewsThisMonth: 0,
          totalInquiries: 0,
          conversionRate: 0,
          averageRating: 4.8,
          totalReviews: 0,
          dailyViews: []
        });
        this.reviewsList.set(res.reviews || []);

        this.inquiriesLoaded.set(true);
        this.analyticsLoaded.set(true);
        this.reviewsLoaded.set(true);
      },
      error: () => {
        this.snackbar.show('Failed to fetch dashboard metrics. Reconnecting...', 'error');
        this.inquiriesLoaded.set(true);
        this.analyticsLoaded.set(true);
        this.reviewsLoaded.set(true);
      }
    });
  }

  updateInquiryStatus(id: number, status: string) {
    this.lawyerService.updateInquiryStatus(id, status).subscribe({
      next: () => {
        this.inquiries.update(list => {
          const item = list.find(i => i.id === id);
          if (item) {
            item.status = status;
          }
          return [...list];
        });
        this.snackbar.show(`Inquiry status updated to ${status}.`, 'success');
        
        // Refresh analytics in background to update conversion rates/speeds
        this.lawyerService.getMyAnalytics().subscribe(res => {
          if (res) this.analytics.set(res);
        });
      },
      error: () => {
        this.snackbar.show('Failed to update inquiry status. Try again.', 'error');
      }
    });
  }

  setActiveTab(tab: 'inbox' | 'preview' | 'reviews' | 'analytics') {
    this.activeTab.set(tab);
  }

  setFilter(status: any) {
    this.statusFilter.set(status);
  }

  getMaxDailyViewCount(): number {
    const daily = this.analytics().dailyViews || [];
    if (daily.length === 0) return 10;
    const max = Math.max(...daily.map((d: any) => d.count));
    return max > 0 ? max : 10;
  }

  getRatingDistribution(): number[] {
    const list = this.reviewsList();
    const counts = [0, 0, 0, 0, 0]; // 1 to 5 stars
    list.forEach(r => {
      const idx = Math.floor(r.rating) - 1;
      if (idx >= 0 && idx < 5) counts[idx]++;
    });
    return counts;
  }

  getRatingPct(stars: number): number {
    const total = this.reviewsList().length;
    if (total === 0) return 0;
    const dist = this.getRatingDistribution();
    return Math.round((dist[stars - 1] / total) * 100);
  }
}
