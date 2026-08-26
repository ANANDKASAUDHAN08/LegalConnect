import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  Inject,
  signal
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Chart,
  LineController,
  BarController,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register necessary Chart.js modules
Chart.register(
  LineController,
  BarController,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler
);

export interface ChartPoint {
  label: string;
  actual: number;
  projected?: number;
  views?: number;
}

@Component({
  selector: 'app-trend-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full h-full min-h-[220px] sm:min-h-[260px] flex flex-col justify-between">
      <!-- Mobile Touch Scrubbing Readout Banner -->
      <div *ngIf="activePoint() && data && data.length > 0" 
        class="flex sm:hidden items-center justify-between px-3 py-1.5 mb-1.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs animate-[fadeIn_0.15s_ease-out]">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="font-bold text-slate-700 dark:text-slate-200 font-mono">{{ activePoint()?.label }}</span>
        </div>
        <div class="flex items-center gap-2 font-mono">
          <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ formatCurrency(activePoint()?.actual || 0) }}</span>
          <span *ngIf="(activePoint()?.projected || 0) > 0" class="text-amber-500 font-semibold text-[10px]">
            (Proj: {{ formatCurrency(activePoint()?.projected || 0) }})
          </span>
        </div>
      </div>

      <div class="relative flex-1 w-full h-full min-h-[190px] flex items-center justify-center">
        <canvas #chartCanvas class="w-full h-full" [class.hidden]="!data || data.length === 0"></canvas>
        <div *ngIf="!data || data.length === 0" class="text-center p-6 space-y-2">
          <div class="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 mx-auto flex items-center justify-center border border-slate-200/50 dark:border-slate-700/50">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <p class="text-xs font-bold text-slate-700 dark:text-slate-300">No activity recorded for this period</p>
          <p class="text-[10px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto">Real profile views and consultation requests will map here automatically as clients interact with your listing.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrendChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() data: ChartPoint[] = [];
  @Input() isPrivacyMode: boolean = false;
  @Input() chartType: 'line' | 'bar' = 'line';
  @Input() height: number = 260;

  activePoint = signal<ChartPoint | null>(null);

  private chartInstance: Chart | null = null;
  private isBrowser: boolean;
  private resizeObserver: ResizeObserver | null = null;
  private resizeDebounceTimeout: any = null;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit() {
    if (this.isBrowser) {
      this.initChart();
      this.setupResizeObserver();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['data'] || changes['isPrivacyMode'] || changes['chartType']) && this.chartInstance) {
      this.updateChart();
    }
  }

  ngOnDestroy() {
    this.destroyChart();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.resizeDebounceTimeout) {
      clearTimeout(this.resizeDebounceTimeout);
    }
  }

  private setupResizeObserver() {
    if (!this.isBrowser || typeof ResizeObserver === 'undefined' || !this.canvasRef?.nativeElement) return;
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeDebounceTimeout) clearTimeout(this.resizeDebounceTimeout);
      this.resizeDebounceTimeout = setTimeout(() => {
        if (this.chartInstance) {
          this.chartInstance.resize();
        }
      }, 100);
    });
    this.resizeObserver.observe(this.canvasRef.nativeElement);
  }

  private destroyChart() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  private isDarkMode(): boolean {
    if (!this.isBrowser) return true;
    return document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  formatCurrency(val: number): string {
    if (this.isPrivacyMode) return '₹ •••••';
    return '₹' + Number(val).toLocaleString('en-IN');
  }

  private initChart() {
    if (!this.canvasRef?.nativeElement) return;
    this.destroyChart();

    const isDark = this.isDarkMode();
    const labels = this.data.map(d => d.label);
    const actualData = this.data.map(d => d.actual);
    const projectedData = this.data.map(d => d.projected ?? 0);

    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Gradient fill for actual earned revenue
    const actualGradient = ctx.createLinearGradient(0, 0, 0, 300);
    if (isDark) {
      actualGradient.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
      actualGradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');
    } else {
      actualGradient.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
      actualGradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');
    }

    const datasets: any[] = [
      {
        label: 'Realized Revenue',
        data: actualData,
        borderColor: '#10b981',
        backgroundColor: actualGradient,
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#10b981',
        pointBorderColor: isDark ? '#0f172a' : '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ];

    if (this.data.some(d => (d.projected ?? 0) > 0)) {
      datasets.push({
        label: 'Projected Retainers',
        data: projectedData,
        borderColor: '#f59e0b',
        borderWidth: 2,
        borderDash: [5, 5],
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.35,
        pointBackgroundColor: '#f59e0b',
        pointBorderColor: isDark ? '#0f172a' : '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5
      });
    }

    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    this.chartInstance = new Chart(ctx, {
      type: this.chartType,
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
        interaction: {
          mode: 'index',
          intersect: false
        },
        onHover: (event, activeElements) => {
          if (activeElements && activeElements.length > 0) {
            const idx = activeElements[0].index;
            if (this.data[idx]) {
              this.activePoint.set(this.data[idx]);
            }
          }
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: 'circle',
              color: textColor,
              font: { size: 11, family: 'Inter, sans-serif', weight: 'bold' }
            }
          },
          tooltip: {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
            titleColor: isDark ? '#ffffff' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 12,
            boxPadding: 4,
            usePointStyle: true,
            callbacks: {
              label: (context) => {
                const label = context.dataset.label || '';
                const val = context.parsed.y ?? 0;
                return ` ${label}: ${this.formatCurrency(val)}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              autoSkip: true,
              maxTicksLimit: typeof window !== 'undefined' && window.innerWidth < 640 ? 5 : 12,
              maxRotation: 0,
              font: { size: 10, family: 'Inter, sans-serif' }
            }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 10, family: 'Inter, sans-serif' },
              callback: (val: any) => {
                if (this.isPrivacyMode) return '•••';
                if (val >= 1000) return '₹' + (val / 1000).toFixed(0) + 'k';
                return '₹' + val;
              }
            }
          }
        }
      }
    });
  }

  private updateChart() {
    this.initChart();
  }
}