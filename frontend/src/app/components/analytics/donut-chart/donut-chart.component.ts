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
  Inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Chart,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';

// Register Doughnut Chart modules
Chart.register(
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend
);

export interface DonutCategory {
  category: string;
  count: number;
  percentage: number;
  color?: string;
}

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="w-full h-full min-h-[200px] flex items-center justify-center relative">
      <!-- Active Chart View -->
      <ng-container *ngIf="hasData; else emptyState">
        <div class="relative w-full h-full flex items-center justify-center">
          <canvas #donutCanvas class="max-w-full max-h-full"></canvas>
          
          <!-- Center Cutout Metric Badge -->
          <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{{ centerSubtitle }}</span>
            <span class="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white leading-none mt-1">{{ centerTitle }}</span>
          </div>
        </div>
      </ng-container>

      <!-- Real Zero Data State (Perfect Center) -->
      <ng-template #emptyState>
        <div class="w-full flex flex-col items-center justify-center text-center p-4 space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 flex items-center justify-center border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            </svg>
          </div>
          <p class="text-xs font-bold text-slate-700 dark:text-slate-300">No practice distribution data</p>
          <p class="text-[11px] text-slate-400 dark:text-slate-500 max-w-[200px] leading-relaxed">
            Matters will categorize automatically based on received consultation inquiries.
          </p>
        </div>
      </ng-template>
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
export class DonutChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('donutCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() categories: DonutCategory[] = [];
  @Input() centerTitle: string = '';
  @Input() centerSubtitle: string = 'Matters';

  get hasData(): boolean {
    return Array.isArray(this.categories) &&
      this.categories.length > 0 &&
      this.categories.some(c => (c.count || 0) > 0);
  }

  private chartInstance: Chart | null = null;
  private isBrowser: boolean;

  private defaultColors = [
    '#6366f1', // Indigo
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#ec4899', // Pink
    '#8b5cf6', // Purple
    '#14b8a6'  // Teal
  ];

  private resizeObserver: ResizeObserver | null = null;
  private resizeDebounceTimeout: any = null;

  constructor(@Inject(PLATFORM_ID) platformId: object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit() {
    if (this.isBrowser && this.hasData) {
      this.initChart();
      this.setupResizeObserver();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['categories']) {
      if (this.hasData) {
        setTimeout(() => {
          this.initChart();
          this.setupResizeObserver();
        }, 0);
      } else {
        this.destroyChart();
      }
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
    if (this.resizeObserver) return;
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

  private initChart() {
    if (!this.hasData || !this.canvasRef?.nativeElement) {
      this.destroyChart();
      return;
    }
    this.destroyChart();

    const isDark = this.isDarkMode();
    const labels = this.categories.map(c => c.category);
    const data = this.categories.map(c => c.count);
    const backgroundColors = this.categories.map((c, i) => c.color || this.defaultColors[i % this.defaultColors.length]);

    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: backgroundColors,
            borderColor: isDark ? '#0f172a' : '#ffffff',
            borderWidth: 3,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
        cutout: typeof window !== 'undefined' && window.innerWidth < 640 ? '68%' : '72%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
            titleColor: isDark ? '#ffffff' : '#0f172a',
            bodyColor: isDark ? '#cbd5e1' : '#334155',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              label: (context) => {
                const idx = context.dataIndex;
                const cat = this.categories[idx];
                return ` ${cat.category}: ${cat.count} cases (${cat.percentage}%)`;
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