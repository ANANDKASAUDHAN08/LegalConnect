import { Component, OnInit, OnDestroy, HostListener, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { AuthService, UserProfile } from '../../../services/auth.service';
import { LawyerService, Consultation, AdvocateInsightsData } from '../../../services/lawyer.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { ReviewCardComponent } from '../../../components/review-card/review-card.component';
import { TrendChartComponent, ChartPoint } from '../../../components/analytics/trend-chart/trend-chart.component';
import { DonutChartComponent, DonutCategory } from '../../../components/analytics/donut-chart/donut-chart.component';
import { FunnelMetricComponent, FunnelStep } from '../../../components/analytics/funnel-metric/funnel-metric.component';
import { DataExportService } from '../../../services/data-export.service';

export interface AdvocateBasicAnalytics {
  totalViews: number;
  viewsThisMonth: number;
  totalInquiries: number;
  conversionRate: number;
  averageRating: number;
  totalReviews: number;
  dailyViews: { date: string; count: number }[];
}

export interface AdvocateReviewItem {
  id?: number;
  rating: number;
  title?: string;
  comment?: string;
  clientName?: string;
  authorName?: string;
  userName?: string;
  createdAt?: string;
  redactedContent?: string;
  content?: string;
  targetName?: string;
  lawyerName?: string;
  lastEditedAt?: string;
  originalContent?: string;
}

@Component({
  selector: 'app-advocate-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    StatCardComponent,
    TooltipDirective,
    ReviewCardComponent,
    TrendChartComponent,
    DonutChartComponent,
    FunnelMetricComponent
  ],
  templateUrl: './advocate-dashboard.component.html',
  styleUrls: ['./advocate-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
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
  insightsLoading = signal(false);

  isPageLoading = computed(() => {
    return !(this.inquiriesLoaded() && this.analyticsLoaded() && this.reviewsLoaded() && this.minTimeElapsed());
  });

  // Data Signals
  inquiries = signal<Consultation[]>([]);
  analytics = signal<AdvocateBasicAnalytics>({
    totalViews: 0,
    viewsThisMonth: 0,
    totalInquiries: 0,
    conversionRate: 0,
    averageRating: 4.8,
    totalReviews: 0,
    dailyViews: []
  });
  reviewsList = signal<AdvocateReviewItem[]>([]);

  // Enterprise Practice Intelligence Signals
  selectedRange = signal<'7d' | '30d' | '90d' | '1y'>('30d');
  isPrivacyMode = signal<boolean>(false);
  insightsData = signal<AdvocateInsightsData | null>(null);
  lastSyncedTime = signal<string>('Just now');
  isMobileActionSheetOpen = signal<boolean>(false);
  activeKpiSlide = signal<number>(0);

  // Active Insights (Real Database & Cached Snapshot)
  activeInsights = computed<AdvocateInsightsData>(() => {
    const real = this.insightsData();
    if (real) return real;
    return this.lawyerService.getCachedAdvocateInsights(this.selectedRange()) || this.generateDefaultInsights();
  });

  // Chart data computation
  trendPoints = computed<ChartPoint[]>(() => {
    const trajectory = this.activeInsights().trajectory || [];
    return trajectory.map(t => ({
      label: t.label,
      actual: t.actual,
      projected: t.projected,
      views: t.views
    }));
  });

  donutCategories = computed<DonutCategory[]>(() => {
    return this.activeInsights().practiceBreakdown || [];
  });

  totalMattersCount = computed<number>(() => {
    const list = this.donutCategories();
    return list.reduce((acc, curr) => acc + (curr.count || 0), 0);
  });

  hasPracticeData = computed<boolean>(() => {
    return this.donutCategories().some(c => (c.count || 0) > 0);
  });

  funnelSteps = computed<FunnelStep[]>(() => {
    const f = this.activeInsights().funnel;
    if (!f) return [];
    return [
      {
        name: 'Profile Discovery (Views)',
        count: f.impressions,
        deltaPct: f.impressionsDelta,
        conversionFromPrev: 100,
        colorClass: 'bg-indigo-500'
      },
      {
        name: 'Consultation Inquiries',
        count: f.inquiries,
        deltaPct: f.inquiriesDelta,
        conversionFromPrev: f.impressions > 0 ? Math.round((f.inquiries / f.impressions) * 100) : 15,
        colorClass: 'bg-amber-500'
      },
      {
        name: 'Active Retainers & Closed',
        count: Math.max(1, f.retainersSigned),
        conversionFromPrev: f.inquiries > 0 ? Math.round((f.retainersSigned / f.inquiries) * 100) : 45,
        colorClass: 'bg-emerald-500'
      }
    ];
  });

  // Search & Filter States for Inbox
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

  pendingInquiriesCount = computed(() => {
    return this.inquiries().filter(i => i.status === 'Pending').length;
  });

  private sub = new Subscription();

  constructor(
    public authService: AuthService,
    private lawyerService: LawyerService,
    private snackbar: SnackbarService,
    private dataExportService: DataExportService,
    private router: Router
  ) { }

  ngOnInit() {
    setTimeout(() => {
      this.minTimeElapsed.set(true);
    }, 500);

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

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent) {
    if (this.activeTab() !== 'analytics') return;
    // Don't trigger if user is typing in an input
    const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (event.key === '1') this.setRange('7d');
    else if (event.key === '2') this.setRange('30d');
    else if (event.key === '3') this.setRange('90d');
    else if (event.key === '4') this.setRange('1y');
    else if (event.key.toLowerCase() === 'p') this.togglePrivacyMode();
  }

  loadAllDashboardData() {
    this.inquiriesLoaded.set(false);
    this.analyticsLoaded.set(false);
    this.reviewsLoaded.set(false);

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

        // Load enterprise practice insights
        this.loadInsights(this.selectedRange());
      },
      error: () => {
        this.snackbar.show('Failed to fetch dashboard metrics. Reconnecting...', 'error');
        this.inquiriesLoaded.set(true);
        this.analyticsLoaded.set(true);
        this.reviewsLoaded.set(true);
      }
    });
  }

  loadInsights(range: string = '30d') {
    this.insightsLoading.set(true);
    const minTimer = new Promise(resolve => setTimeout(resolve, 300));

    this.lawyerService.getAdvocateInsights(range).subscribe({
      next: (data) => {
        minTimer.then(() => {
          this.insightsData.set(data);
          this.insightsLoading.set(false);
          this.lastSyncedTime.set(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        });
      },
      error: () => {
        minTimer.then(() => {
          const cached = this.lawyerService.getCachedAdvocateInsights(range);
          if (cached) this.insightsData.set(cached);
          this.insightsLoading.set(false);
        });
      }
    });
  }

  setRange(range: any) {
    const validRange: '7d' | '30d' | '90d' | '1y' =
      (range === '7d' || range === '30d' || range === '90d' || range === '1y') ? range : '30d';
    if (this.selectedRange() === validRange) return;
    this.selectedRange.set(validRange);
    const rangeLabels: Record<string, string> = {
      '7d': 'past 7 days',
      '30d': 'past 30 days',
      '90d': 'past 90 days',
      '1y': 'past 1 year'
    };
    this.snackbar.show(`Loading analytics for ${rangeLabels[validRange]}...`, 'info');
    this.loadInsights(validRange);
  }

  getRatingDistribution(): number[] {
    const list = this.reviewsList();
    const counts = [0, 0, 0, 0, 0];
    list.forEach(r => {
      const idx = Math.floor(r.rating) - 1;
      if (idx >= 0 && idx < 5) counts[idx]++;
    });
    return counts;
  }

  getRatingPct(stars: number): number {
    const total = this.reviewsList().length;
    if (total === 0) return stars === 5 ? 85 : (stars === 4 ? 15 : 0);
    const dist = this.getRatingDistribution();
    return Math.round((dist[stars - 1] / total) * 100);
  }

  togglePrivacyMode() {
    this.isPrivacyMode.update(v => !v);
    this.snackbar.show(
      this.isPrivacyMode() ? 'Privacy Mode Enabled (Amounts Hidden)' : 'Privacy Mode Disabled',
      'info'
    );
  }

  openMobileActionSheet() {
    this.isMobileActionSheetOpen.set(true);
  }

  closeMobileActionSheet() {
    this.isMobileActionSheetOpen.set(false);
  }

  onKpiScroll(event: Event) {
    const el = event.target as HTMLElement;
    if (!el) return;
    const cardWidth = el.offsetWidth * 0.85;
    if (cardWidth > 0) {
      const idx = Math.round(el.scrollLeft / cardWidth);
      this.activeKpiSlide.set(Math.min(3, Math.max(0, idx)));
    }
  }

  formatAmount(val: number): string {
    if (this.isPrivacyMode()) return '₹ ••••••';
    return '₹' + Number(val).toLocaleString('en-IN');
  }

  exportToCsv() {
    const data = this.activeInsights();
    const escapeCell = (val: any): string => {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows: (string | number)[][] = [
      ['Metric', 'Value'],
      ['Period', data.period],
      ['Realized Revenue (INR)', data.grossEarned],
      ['Projected Retainers (INR)', data.projectedRetainers],
      ['Revenue Delta %', `${data.revenueDeltaPct}%`],
      ['Total Impressions (Views)', data.funnel.impressions],
      ['Total Consultation Inquiries', data.funnel.inquiries],
      ['Discovery Conversion Rate', `${data.funnel.conversionRate}%`],
      ['Avg Response Time (mins)', data.slaAndReputation.avgResponseMinutes],
      ['Average Rating', data.slaAndReputation.averageRating],
      ['Total Verified Reviews', data.slaAndReputation.totalReviews],
      [''],
      ['Practice Category', 'Case Count', 'Percentage'],
      ...data.practiceBreakdown.map(p => [p.category, p.count, `${p.percentage}%`])
    ];

    const csvContent = '\uFEFF' + rows.map(r => r.map(escapeCell).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `legalconnect_practice_analytics_${this.selectedRange()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.snackbar.show('Exported Practice Analytics to CSV.', 'success');
  }

  printAnalyticsReport() {
    const success = this.dataExportService.printAdvocateAnalyticsDossier(
      this.currentUser,
      this.activeInsights(),
      this.selectedRange(),
      () => {
        this.snackbar.show('Popups were blocked by your browser. Printing triggered in background.', 'info');
      }
    );
    if (success) {
      this.snackbar.show('Generating Executive Practice Dossier...', 'info');
    }
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
        this.loadInsights(this.selectedRange());
      },
      error: () => {
        this.snackbar.show('Failed to update inquiry status. Try again.', 'error');
      }
    });
  }

  setActiveTab(tab: 'inbox' | 'preview' | 'reviews' | 'analytics') {
    this.activeTab.set(tab);
    if (tab === 'analytics') {
      this.loadInsights(this.selectedRange());
    }
  }

  setFilter(status: any) {
    this.statusFilter.set(status);
  }

  private generateDefaultInsights(): AdvocateInsightsData {
    return {
      period: 'Last 30 Days',
      grossEarned: 0,
      projectedRetainers: 0,
      revenueDeltaPct: 0,
      trajectory: [],
      practiceBreakdown: [],
      funnel: {
        impressions: 0,
        impressionsDelta: 0,
        inquiries: 0,
        inquiriesDelta: 0,
        consultationsHeld: 0,
        retainersSigned: 0,
        conversionRate: 0
      },
      slaAndReputation: {
        avgResponseMinutes: 0,
        peerAvgResponseMinutes: 60,
        responseGrade: 'New Profile',
        averageRating: 0,
        totalReviews: 0,
        starBreakdown: [
          { stars: 5, count: 0, percentage: 0 },
          { stars: 4, count: 0, percentage: 0 },
          { stars: 3, count: 0, percentage: 0 },
          { stars: 2, count: 0, percentage: 0 },
          { stars: 1, count: 0, percentage: 0 }
        ]
      },
      recentInquiries: []
    };
  }

  trackByReviewId(index: number, item: AdvocateReviewItem): number | string {
    return item.id ?? index;
  }

  trackByInquiryId(index: number, item: Consultation): number {
    return item.id;
  }

  trackByIndex(index: number, item: any): number {
    return index;
  }

  trackByCategory(index: number, item: DonutCategory): string {
    return item.category;
  }

  trackByStar(index: number, item: { stars: number }): number {
    return item.stars;
  }
}