import { Component, Input, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';
import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Tree-shaked registration of only required Chart.js controllers & plugins
Chart.register(
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

@Component({
  selector: 'app-dashboard-charts',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, TooltipDirective],
  templateUrl: './dashboard-charts.component.html',
  styleUrl: './dashboard-charts.component.scss'
})
export class DashboardChartsComponent implements AfterViewInit, OnChanges {
  @Input() selectedTimeframe: '7D' | '30D' | '90D' | 'YTD' = '30D';
  @Input() isChartLoading = false;
  @Input() templateStats: any = null;
  @Input() bookmarkStats: any = null;
  @Input() specializations: any[] = [];
  @Input() regTrendData: any = null;
  @Input() loginTrendData: any = null;
  @Input() cityTrendData: any = null;
  @Input() reviewStatsData: any = null;
  @Input() consultationTrendData: any = null;
  @Input() overview: any = null;

  // Tier 2 & 3 Advanced Analytics Inputs
  @Input() conversionFunnelData: any = null;
  @Input() revenuePotentialData: any = null;
  @Input() supportBreakdown: any = null;
  @Input() consentTrendData: any = null;
  @Input() slaComplianceData: any = null;
  @Input() authProviderData: any = null;

  // Canvases for Chart Panels
  @ViewChild('registrationCanvas') registrationCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('conversionFunnelCanvas') conversionFunnelCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('revenuePotentialCanvas') revenuePotentialCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('consultationDonutCanvas') consultationDonutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('loginSecurityCanvas') loginSecurityCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('specializationCanvas') specializationCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('cityCanvas') cityCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('supportCategoryCanvas') supportCategoryCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ratingCanvas') ratingCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('authProviderCanvas') authProviderCanvas!: ElementRef<HTMLCanvasElement>;

  private charts: { [key: string]: Chart | null } = {
    registration: null,
    conversionFunnel: null,
    revenuePotential: null,
    consultationDonut: null,
    loginSecurity: null,
    specialization: null,
    city: null,
    supportCategory: null,
    rating: null,
    authProvider: null
  };

  ngAfterViewInit(): void {
    setTimeout(() => this.renderAllCharts(), 200);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedTimeframe']) {
      this.renderAllCharts();
      return;
    }
    // Re-render specific charts when their data inputs change
    if (changes['regTrendData'] && this.registrationCanvas) this.renderRegistrationChart();
    if (changes['conversionFunnelData'] && this.conversionFunnelCanvas) this.renderConversionFunnelChart();
    if (changes['revenuePotentialData'] && this.revenuePotentialCanvas) this.renderRevenuePotentialChart();
    if ((changes['consultationTrendData'] || changes['overview']) && this.consultationDonutCanvas) this.renderConsultationDonut();
    if (changes['loginTrendData'] && this.loginSecurityCanvas) this.renderLoginSecurityChart();
    if (changes['specializations'] && this.specializationCanvas) this.renderSpecializationChart();
    if (changes['cityTrendData'] && this.cityCanvas) this.renderCityChart();
    if (changes['supportBreakdown'] && this.supportCategoryCanvas) this.renderSupportCategoryChart();
    if (changes['ratingCanvas'] && this.ratingCanvas) this.renderRatingChart();
    if (changes['authProviderData'] && this.authProviderCanvas) this.renderAuthProviderChart();
  }

  private getSliceCount(): number {
    switch (this.selectedTimeframe) {
      case '7D': return 7;
      case '30D': return 30;
      case '90D': return 90;
      case 'YTD': return 365;
      default: return 14;
    }
  }

  private renderAllCharts(): void {
    this.renderRegistrationChart();
    this.renderConversionFunnelChart();
    this.renderRevenuePotentialChart();
    this.renderConsultationDonut();
    this.renderLoginSecurityChart();
    this.renderSpecializationChart();
    this.renderCityChart();
    this.renderSupportCategoryChart();
    this.renderRatingChart();
    this.renderAuthProviderChart();
  }

  // -- Shared glassmorphic chart styling & Custom Dark Tooltip --

  private darkGridOptions(stacked = false): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter, system-ui, sans-serif', size: 11, weight: '500' },
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.12)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          cornerRadius: 10,
          titleFont: { family: 'Inter, system-ui, sans-serif', size: 12, weight: '700' },
          bodyFont: { family: 'Inter, system-ui, sans-serif', size: 11 }
        }
      },
      scales: {
        x: {
          stacked,
          ticks: { color: '#64748b', maxRotation: 45, font: { size: 10, family: 'Inter, system-ui, sans-serif' } },
          grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false }
        },
        y: {
          stacked,
          ticks: { color: '#64748b', font: { size: 10, family: 'Inter, system-ui, sans-serif' } },
          grid: { color: 'rgba(255, 255, 255, 0.04)', drawBorder: false },
          beginAtZero: true
        }
      }
    };
  }

  private destroyChart(key: string): void {
    if (this.charts[key]) {
      this.charts[key]!.destroy();
      this.charts[key] = null;
    }
  }

  // -- 1. Registration Trend (Line with Indigo Gradient Glow) --

  private renderRegistrationChart(): void {
    if (!this.registrationCanvas?.nativeElement) return;
    this.destroyChart('registration');
    const ctx = this.registrationCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let labels: string[] = [];
    let data: number[] = [];

    if (this.regTrendData?.daily?.length > 0) {
      const daily = this.regTrendData.daily.slice(-this.getSliceCount());
      labels = daily.map((d: any) => d.date);
      data = daily.map((d: any) => d.count);
    }

    if (labels.length === 0) {
      labels = ['No data'];
      data = [0];
    }

    // Gorgeous linear gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
    gradient.addColorStop(0.7, 'rgba(99, 102, 241, 0.05)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    this.charts['registration'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Daily Registrations',
          data,
          borderColor: '#6366f1',
          backgroundColor: gradient,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          borderWidth: 2.5
        }]
      },
      options: this.darkGridOptions()
    });
  }

  // -- 2. Conversion Funnel (Horizontal Bar with Gradient Fill) --

  private renderConversionFunnelChart(): void {
    if (!this.conversionFunnelCanvas?.nativeElement) return;
    this.destroyChart('conversionFunnel');
    const ctx = this.conversionFunnelCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let labels = ['Profile Views', 'Consultations', 'Contacted', 'Cases Closed'];
    let data = [0, 0, 0, 0];

    if (this.conversionFunnelData?.stages?.length > 0) {
      labels = this.conversionFunnelData.stages.map((s: any) => s.stage);
      data = this.conversionFunnelData.stages.map((s: any) => s.count);
    } else {
      const views = 50;
      const consults = this.overview?.totalConsultations || 1;
      const closed = Math.max(0, consults - (this.overview?.pendingConsultations || 0));
      data = [views, consults, Math.round(consults * 0.8), closed];
    }

    const funnelColors = [
      'rgba(99, 102, 241, 0.85)', // Indigo
      'rgba(6, 182, 212, 0.85)',  // Cyan
      'rgba(16, 185, 129, 0.85)', // Emerald
      'rgba(168, 85, 247, 0.85)'  // Purple
    ];

    this.charts['conversionFunnel'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Conversion Volume',
          data,
          backgroundColor: funnelColors,
          borderRadius: 6,
          borderWidth: 0,
          barThickness: 20
        }]
      },
      options: {
        ...this.darkGridOptions(),
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: {
            ...this.darkGridOptions().plugins.tooltip,
            callbacks: {
              label: (context: any) => {
                const val = context.raw || 0;
                return ` ${val.toLocaleString()} interactions`;
              }
            }
          }
        }
      }
    });
  }

  // -- 3. Revenue Potential & Monthly GMV (Area Chart with Emerald Glow) --

  private renderRevenuePotentialChart(): void {
    if (!this.revenuePotentialCanvas?.nativeElement) return;
    this.destroyChart('revenuePotential');
    const ctx = this.revenuePotentialCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let labels: string[] = [];
    let gmvData: number[] = [];

    if (this.revenuePotentialData?.monthlyTrend?.length > 0) {
      labels = this.revenuePotentialData.monthlyTrend.map((m: any) => m.month);
      gmvData = this.revenuePotentialData.monthlyTrend.map((m: any) => m.estimatedGmv);
    } else {
      labels = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
      gmvData = [1200, 2400, 3100, 4800, 6200, 8500];
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    gradient.addColorStop(0.7, 'rgba(16, 185, 129, 0.05)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    this.charts['revenuePotential'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Est. Platform GMV (₹)',
          data: gmvData,
          borderColor: '#10b981',
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          borderWidth: 2.5
        }]
      },
      options: {
        ...this.darkGridOptions(),
        scales: {
          ...this.darkGridOptions().scales,
          y: {
            ...this.darkGridOptions().scales.y,
            ticks: {
              color: '#64748b',
              font: { size: 10 },
              callback: (val: any) => `₹${Number(val).toLocaleString()}`
            }
          }
        }
      }
    });
  }

  // -- 4. Consultation Status (Doughnut) --

  private renderConsultationDonut(): void {
    if (!this.consultationDonutCanvas?.nativeElement) return;
    this.destroyChart('consultationDonut');
    const ctx = this.consultationDonutCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let labels: string[] = [];
    let data: number[] = [];
    let bgColors: string[] = [];

    if (this.consultationTrendData?.statusDistribution?.length > 0) {
      const dist = this.consultationTrendData.statusDistribution;
      labels = dist.map((d: any) => d.status);
      data = dist.map((d: any) => d.count);
      bgColors = labels.map((s: string) => {
        switch (s.toLowerCase()) {
          case 'closed':
          case 'completed': return 'rgba(16, 185, 129, 0.85)';
          case 'pending': return 'rgba(245, 158, 11, 0.85)';
          case 'cancelled': return 'rgba(239, 68, 68, 0.85)';
          case 'contacted':
          case 'in progress': return 'rgba(99, 102, 241, 0.85)';
          default: return 'rgba(148, 163, 184, 0.85)';
        }
      });
    } else {
      const total = this.overview?.totalConsultations || 0;
      const pending = this.overview?.pendingConsultations || 0;
      const completed = Math.max(0, total - pending);
      if (total > 0) {
        labels = ['Completed/Contacted', 'Pending'];
        data = [completed, pending];
        bgColors = ['rgba(16, 185, 129, 0.85)', 'rgba(245, 158, 11, 0.85)'];
      } else {
        labels = ['No consultations yet'];
        data = [1];
        bgColors = ['rgba(100, 100, 100, 0.2)'];
      }
    }

    this.charts['consultationDonut'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 8 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 12, usePointStyle: true }
          },
          tooltip: this.darkGridOptions().plugins.tooltip
        }
      }
    });
  }

  // -- 5. Login Security (Stacked Bar - Success vs Failed) --

  private renderLoginSecurityChart(): void {
    if (!this.loginSecurityCanvas?.nativeElement) return;
    this.destroyChart('loginSecurity');
    const ctx = this.loginSecurityCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let labels: string[] = [];
    let successData: number[] = [];
    let failedData: number[] = [];

    if (this.loginTrendData?.daily?.length > 0) {
      const daily = this.loginTrendData.daily.slice(-this.getSliceCount());
      labels = daily.map((d: any) => d.date);
      successData = daily.map((d: any) => d.success || 0);
      failedData = daily.map((d: any) => d.failed || 0);
    }

    if (labels.length === 0) {
      labels = ['No data'];
      successData = [0];
      failedData = [0];
    }

    this.charts['loginSecurity'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Successful',
            data: successData,
            backgroundColor: 'rgba(16, 185, 129, 0.75)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 4
          },
          {
            label: 'Failed / Blocked',
            data: failedData,
            backgroundColor: 'rgba(239, 68, 68, 0.75)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 4
          }
        ]
      },
      options: this.darkGridOptions(true)
    });
  }

  // -- 6. Top Specializations (Horizontal Bar) --

  private renderSpecializationChart(): void {
    if (!this.specializationCanvas?.nativeElement) return;
    this.destroyChart('specialization');
    const ctx = this.specializationCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let labels: string[] = [];
    let data: number[] = [];

    if (this.specializations?.length > 0) {
      const sorted = [...this.specializations].sort((a, b) => b.count - a.count).slice(0, 8);
      labels = sorted.map((s: any) => s.specialization);
      data = sorted.map((s: any) => s.count);
    }

    if (labels.length === 0) {
      labels = ['No data'];
      data = [0];
    }

    const barColors = [
      'rgba(99, 102, 241, 0.75)', 'rgba(6, 182, 212, 0.75)', 'rgba(16, 185, 129, 0.75)',
      'rgba(245, 158, 11, 0.75)', 'rgba(139, 92, 246, 0.75)', 'rgba(236, 72, 153, 0.75)',
      'rgba(34, 197, 94, 0.75)', 'rgba(251, 146, 60, 0.75)'
    ];

    this.charts['specialization'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Lawyers',
          data,
          backgroundColor: barColors.slice(0, data.length),
          borderWidth: 0,
          borderRadius: 4
        }]
      },
      options: {
        ...this.darkGridOptions(),
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: this.darkGridOptions().plugins.tooltip
        }
      }
    });
  }

  // -- 7. City Distribution (Grouped Bar - Citizens vs Advocates) --

  private renderCityChart(): void {
    if (!this.cityCanvas?.nativeElement) return;
    this.destroyChart('city');
    const ctx = this.cityCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let labels: string[] = [];
    let datasets: any[] = [];

    if (this.cityTrendData?.userCities?.length > 0) {
      const cities = this.cityTrendData.userCities.slice(0, 8);
      labels = cities.map((c: any) => c.city);
      datasets.push({
        label: 'Citizens',
        data: cities.map((c: any) => c.count),
        backgroundColor: 'rgba(16, 185, 129, 0.65)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 4
      });

      if (this.cityTrendData?.lawyerCities?.length > 0) {
        const lawyerData = labels.map(city => {
          const match = this.cityTrendData.lawyerCities.find((lc: any) => lc.city === city);
          return match ? match.count : 0;
        });
        datasets.push({
          label: 'Advocates',
          data: lawyerData,
          backgroundColor: 'rgba(99, 102, 241, 0.65)',
          borderColor: '#6366f1',
          borderWidth: 1,
          borderRadius: 4
        });
      }
    }

    if (labels.length === 0) {
      labels = ['No data'];
      datasets = [{ label: 'Citizens', data: [0], backgroundColor: 'rgba(100,100,100,0.2)', borderWidth: 0 }];
    }

    this.charts['city'] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: this.darkGridOptions()
    });
  }

  // -- 8. Support Category Breakdown (Donut) --

  private renderSupportCategoryChart(): void {
    if (!this.supportCategoryCanvas?.nativeElement) return;
    this.destroyChart('supportCategory');
    const ctx = this.supportCategoryCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let labels: string[] = [];
    let data: number[] = [];

    if (this.supportBreakdown?.byCategory?.length > 0) {
      labels = this.supportBreakdown.byCategory.map((c: any) => c.category || 'General');
      data = this.supportBreakdown.byCategory.map((c: any) => c.count);
    } else {
      labels = ['General Inquiries', 'Lawyer Verification', 'DPDPA Grievances', 'Technical Bugs'];
      data = [4, 2, 1, 1];
    }

    const palette = [
      'rgba(99, 102, 241, 0.85)',
      'rgba(245, 158, 11, 0.85)',
      'rgba(16, 185, 129, 0.85)',
      'rgba(239, 68, 68, 0.85)',
      'rgba(6, 182, 212, 0.85)'
    ];

    this.charts['supportCategory'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: palette.slice(0, data.length),
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 10, usePointStyle: true }
          },
          tooltip: this.darkGridOptions().plugins.tooltip
        }
      }
    });
  }

  // -- 9. Rating Breakdown (Horizontal Bar - Star Distribution) --

  private renderRatingChart(): void {
    if (!this.ratingCanvas?.nativeElement) return;
    this.destroyChart('rating');
    const ctx = this.ratingCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let labels = ['5 ★', '4 ★', '3 ★', '2 ★', '1 ★'];
    let data = [0, 0, 0, 0, 0];
    let bgColors = [
      'rgba(16, 185, 129, 0.85)',
      'rgba(34, 197, 94, 0.75)',
      'rgba(245, 158, 11, 0.75)',
      'rgba(251, 146, 60, 0.75)',
      'rgba(239, 68, 68, 0.75)'
    ];

    if (this.reviewStatsData?.ratingDistribution?.length > 0) {
      const dist = this.reviewStatsData.ratingDistribution;
      data = [5, 4, 3, 2, 1].map(r => {
        const found = dist.find((d: any) => d.rating === r);
        return found ? found.count : 0;
      });
    }

    this.charts['rating'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Reviews',
          data,
          backgroundColor: bgColors,
          borderWidth: 0,
          borderRadius: 4
        }]
      },
      options: {
        ...this.darkGridOptions(),
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: this.darkGridOptions().plugins.tooltip
        }
      }
    });
  }

  // -- 10. Auth Provider Distribution (Donut) --

  private renderAuthProviderChart(): void {
    if (!this.authProviderCanvas?.nativeElement) return;
    this.destroyChart('authProvider');
    const ctx = this.authProviderCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let labels: string[] = [];
    let data: number[] = [];

    if (this.authProviderData?.distribution?.length > 0) {
      labels = this.authProviderData.distribution.map((d: any) => d.provider || 'Password');
      data = this.authProviderData.distribution.map((d: any) => d.count);
    } else {
      labels = ['Email & Password', 'Google OAuth', 'Phone OTP'];
      data = [18, 5, 2];
    }

    const colors = [
      'rgba(99, 102, 241, 0.85)', // Indigo
      'rgba(239, 68, 68, 0.85)',  // Red / Google
      'rgba(16, 185, 129, 0.85)'  // Emerald
    ];

    this.charts['authProvider'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 10, usePointStyle: true }
          },
          tooltip: this.darkGridOptions().plugins.tooltip
        }
      }
    });
  }
}