import { Component, Input, ElementRef, ViewChild, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonComponent } from '../../../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

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

  // 6 canvases for 6 chart panels
  @ViewChild('registrationCanvas') registrationCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('consultationDonutCanvas') consultationDonutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('loginSecurityCanvas') loginSecurityCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('specializationCanvas') specializationCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('cityCanvas') cityCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ratingCanvas') ratingCanvas!: ElementRef<HTMLCanvasElement>;

  private charts: { [key: string]: Chart | null } = {
    registration: null,
    consultationDonut: null,
    loginSecurity: null,
    specialization: null,
    city: null,
    rating: null
  };

  ngAfterViewInit(): void {
    setTimeout(() => this.renderAllCharts(), 200);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedTimeframe']) {
      this.renderAllCharts();
      return;
    }
    // Re-render specific charts when their data changes
    if (changes['regTrendData'] && this.registrationCanvas) this.renderRegistrationChart();
    if ((changes['consultationTrendData'] || changes['overview']) && this.consultationDonutCanvas) this.renderConsultationDonut();
    if (changes['loginTrendData'] && this.loginSecurityCanvas) this.renderLoginSecurityChart();
    if (changes['specializations'] && this.specializationCanvas) this.renderSpecializationChart();
    if (changes['cityTrendData'] && this.cityCanvas) this.renderCityChart();
    if (changes['reviewStatsData'] && this.ratingCanvas) this.renderRatingChart();
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
    this.renderConsultationDonut();
    this.renderLoginSecurityChart();
    this.renderSpecializationChart();
    this.renderCityChart();
    this.renderRatingChart();
  }

  // -- Shared chart styling --

  private darkGridOptions(stacked = false): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 12, usePointStyle: true, pointStyleWidth: 8 }
        }
      },
      scales: {
        x: {
          stacked,
          ticks: { color: '#64748b', maxRotation: 45, font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.04)' }
        },
        y: {
          stacked,
          ticks: { color: '#64748b', font: { size: 10 } },
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
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

  // -- 1. Registration Trend (Line - 30 days) --

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

    this.charts['registration'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Daily Registrations',
          data,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#6366f1',
          borderWidth: 2
        }]
      },
      options: this.darkGridOptions()
    });
  }

  // -- 2. Consultation Status (Donut) --

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
          case 'completed': return 'rgba(16, 185, 129, 0.8)';
          case 'pending': return 'rgba(245, 158, 11, 0.8)';
          case 'cancelled': return 'rgba(239, 68, 68, 0.8)';
          case 'in progress': return 'rgba(99, 102, 241, 0.8)';
          default: return 'rgba(148, 163, 184, 0.8)';
        }
      });
    } else {
      const total = this.overview?.totalConsultations || 0;
      const pending = this.overview?.pendingConsultations || 0;
      const completed = total - pending;
      if (total > 0) {
        labels = ['Completed', 'Pending'];
        data = [completed, pending];
        bgColors = ['rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)'];
      } else {
        labels = ['No data'];
        data = [1];
        bgColors = ['rgba(100, 100, 100, 0.3)'];
      }
    }

    this.charts['consultationDonut'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 6 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 }, padding: 12, usePointStyle: true }
          }
        }
      }
    });
  }

  // -- 3. Login Security (Stacked Bar - Success vs Failed) --

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
            backgroundColor: 'rgba(16, 185, 129, 0.7)',
            borderColor: '#10b981',
            borderWidth: 1,
            borderRadius: 2
          },
          {
            label: 'Failed',
            data: failedData,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: '#ef4444',
            borderWidth: 1,
            borderRadius: 2
          }
        ]
      },
      options: this.darkGridOptions(true)
    });
  }

  // -- 4. Top Specializations (Horizontal Bar) --

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
      'rgba(99, 102, 241, 0.7)', 'rgba(6, 182, 212, 0.7)', 'rgba(16, 185, 129, 0.7)',
      'rgba(245, 158, 11, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(236, 72, 153, 0.7)',
      'rgba(34, 197, 94, 0.7)', 'rgba(251, 146, 60, 0.7)'
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
          legend: { display: false }
        }
      }
    });
  }

  // -- 5. City Distribution (Grouped Bar) --

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
        label: 'Users',
        data: cities.map((c: any) => c.count),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 3
      });

      if (this.cityTrendData?.lawyerCities?.length > 0) {
        const lawyerData = labels.map(city => {
          const match = this.cityTrendData.lawyerCities.find((lc: any) => lc.city === city);
          return match ? match.count : 0;
        });
        datasets.push({
          label: 'Lawyers',
          data: lawyerData,
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: '#6366f1',
          borderWidth: 1,
          borderRadius: 3
        });
      }
    }

    if (labels.length === 0) {
      labels = ['No data'];
      datasets = [{ label: 'Users', data: [0], backgroundColor: 'rgba(100,100,100,0.2)', borderWidth: 0 }];
    }

    this.charts['city'] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets },
      options: this.darkGridOptions()
    });
  }

  // -- 6. Rating Breakdown (Horizontal Bar - Star Distribution) --

  private renderRatingChart(): void {
    if (!this.ratingCanvas?.nativeElement) return;
    this.destroyChart('rating');
    const ctx = this.ratingCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    let labels = ['5 ★', '4 ★', '3 ★', '2 ★', '1 ★'];
    let data = [0, 0, 0, 0, 0];
    let bgColors = [
      'rgba(16, 185, 129, 0.8)',
      'rgba(34, 197, 94, 0.7)',
      'rgba(245, 158, 11, 0.7)',
      'rgba(251, 146, 60, 0.7)',
      'rgba(239, 68, 68, 0.7)'
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
          legend: { display: false }
        }
      }
    });
  }
}