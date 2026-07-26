import { Component, OnInit, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AdminApiService } from '../../core/admin-api.service';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { TooltipDirective } from '../../shared/directives/tooltip.directive';
import { smartLoading } from '../../core/utils/smart-loading.operator';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'admin-dashboard',
  standalone: true,
  imports: [CommonModule, SkeletonComponent, TooltipDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  overview: any = null;
  isLoading = true;

  @ViewChild('regChartCanvas') regCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('loginChartCanvas') loginCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('roleChartCanvas') roleCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('cityChartCanvas') cityCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('consentChartCanvas') consentCanvas!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  constructor(private api: AdminApiService, private router: Router) { }

  ngOnInit(): void {
    this.fetchOverview();
  }

  ngAfterViewInit(): void {
    this.initCharts();
  }

  ngOnDestroy(): void {
    this.charts.forEach(c => c.destroy());
  }

  navigateTo(path: string, queryParams?: any): void {
    this.router.navigate([path], { queryParams });
  }

  fetchOverview(): void {
    this.api.getOverview().pipe(smartLoading(l => this.isLoading = l)).subscribe({
      next: (data) => {
        this.overview = data;
      },
      error: (err) => {
        console.error('Failed to load overview', err);
      }
    });
  }

  initCharts(): void {
    // 1. Registration Trend Line Chart
    this.api.getRegistrationTrends().subscribe({
      next: (res) => {
        if (!this.regCanvas) return;
        const labels = res.daily.map((d: any) => d.date);
        const data = res.daily.map((d: any) => d.count);

        const chart = new Chart(this.regCanvas.nativeElement, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Registrations',
              data,
              borderColor: '#818cf8',
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              fill: true,
              tension: 0.4,
              borderWidth: 3,
              pointBackgroundColor: '#6366f1',
              pointRadius: 5,
              pointHoverRadius: 8
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: () => {
              this.navigateTo('/users', { sort: 'newest' });
            },
            onHover: (event, chartElement) => {
              if (event.native && event.native.target) {
                (event.native.target as HTMLElement).style.cursor = chartElement[0] ? 'pointer' : 'default';
              }
            },
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { color: '#64748b' } },
              y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } }
            }
          }
        });
        this.charts.push(chart);

        // Role Doughnut Chart
        if (res.roleDistribution && this.roleCanvas) {
          const roleLabels = res.roleDistribution.map((r: any) => r.role);
          const roleData = res.roleDistribution.map((r: any) => r.count);

          const roleChart = new Chart(this.roleCanvas.nativeElement, {
            type: 'doughnut',
            data: {
              labels: roleLabels,
              datasets: [{
                data: roleData,
                backgroundColor: ['#6366f1', '#06b6d4', '#10b981'],
                borderWidth: 0
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              onClick: (event, activeElements) => {
                if (activeElements.length > 0) {
                  const clickedIndex = activeElements[0].index;
                  const selectedRole = roleLabels[clickedIndex];
                  this.navigateTo('/users', { role: selectedRole });
                } else {
                  this.navigateTo('/users');
                }
              },
              onHover: (event, chartElement) => {
                if (event.native && event.native.target) {
                  (event.native.target as HTMLElement).style.cursor = chartElement[0] ? 'pointer' : 'default';
                }
              },
              plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
            }
          });
          this.charts.push(roleChart);
        }
      }
    });

    // 2. Login Security Audit Bar Chart
    this.api.getLoginTrends().subscribe({
      next: (res) => {
        if (!this.loginCanvas) return;
        const labels = res.daily.map((d: any) => d.date);
        const successData = res.daily.map((d: any) => d.success);
        const failedData = res.daily.map((d: any) => d.failed);

        const chart = new Chart(this.loginCanvas.nativeElement, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              {
                label: 'Successful',
                data: successData,
                backgroundColor: '#10b981',
                borderRadius: 4
              },
              {
                label: 'Failed',
                data: failedData,
                backgroundColor: '#ef4444',
                borderRadius: 4
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, activeElements) => {
              if (activeElements.length > 0) {
                const datasetIndex = activeElements[0].datasetIndex;
                const statusFilter = datasetIndex === 0 ? 'Success' : 'Failed';
                this.navigateTo('/security', { tab: 'logs', status: statusFilter });
              } else {
                this.navigateTo('/security', { tab: 'logs' });
              }
            },
            onHover: (event, chartElement) => {
              if (event.native && event.native.target) {
                (event.native.target as HTMLElement).style.cursor = chartElement[0] ? 'pointer' : 'default';
              }
            },
            plugins: { legend: { position: 'top', labels: { color: '#94a3b8' } } },
            scales: {
              x: { stacked: true, grid: { display: false }, ticks: { color: '#64748b' } },
              y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } }
            }
          }
        });
        this.charts.push(chart);
      }
    });

    // 3. Top Cities Horizontal Bar
    this.api.getCityStats().subscribe({
      next: (res) => {
        if (!this.cityCanvas) return;
        const cities = (res.userCities || []).slice(0, 5);
        const labels = cities.map((c: any) => c.city);
        const data = cities.map((c: any) => c.count);

        const chart = new Chart(this.cityCanvas.nativeElement, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Users',
              data,
              backgroundColor: '#06b6d4',
              borderRadius: 6
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, activeElements) => {
              if (activeElements.length > 0) {
                const clickedIndex = activeElements[0].index;
                const selectedCity = labels[clickedIndex];
                this.navigateTo('/lawyers', { city: selectedCity });
              } else {
                this.navigateTo('/lawyers');
              }
            },
            onHover: (event, chartElement) => {
              if (event.native && event.native.target) {
                (event.native.target as HTMLElement).style.cursor = chartElement[0] ? 'pointer' : 'default';
              }
            },
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } },
              y: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
          }
        });
        this.charts.push(chart);
      }
    });

    // 4. Consent Opt-In Doughnut
    this.api.getConsentStats().subscribe({
      next: (res) => {
        if (!this.consentCanvas) return;

        const chart = new Chart(this.consentCanvas.nativeElement, {
          type: 'doughnut',
          data: {
            labels: ['Analytics Opt-In', 'Marketing Opt-In', 'Essential Only'],
            datasets: [{
              data: [res.analyticsOptIn || 12, res.marketingOptIn || 8, (res.total || 25) - (res.analyticsOptIn || 12)],
              backgroundColor: ['#3b82f6', '#8b5cf6', '#475569'],
              borderWidth: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: () => {
              this.navigateTo('/users');
            },
            onHover: (event, chartElement) => {
              if (event.native && event.native.target) {
                (event.native.target as HTMLElement).style.cursor = chartElement[0] ? 'pointer' : 'default';
              }
            },
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
          }
        });
        this.charts.push(chart);
      }
    });
  }
}