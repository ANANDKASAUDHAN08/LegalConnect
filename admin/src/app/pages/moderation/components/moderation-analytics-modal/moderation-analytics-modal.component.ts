import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  AdminModerationService,
  ModerationAnalyticsData,
  DailyVolumeTrend,
  ModeratorThroughput,
  ActionBreakdown
} from '../../../../core/services/admin-moderation.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { AdminIconComponent } from '../../../../shared/components/icon/icon.component';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';
import { extractUserInitials } from '../../../../core/utils';

@Component({
  selector: 'moderation-analytics-modal',
  standalone: true,
  imports: [CommonModule, AdminIconComponent, TooltipDirective],
  templateUrl: './moderation-analytics-modal.component.html',
  styleUrls: ['./moderation-analytics-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModerationAnalyticsModalComponent implements OnInit, OnDestroy {
  private moderationService = inject(AdminModerationService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  @Input() set isOpen(val: boolean) {
    this._isOpen = val;
    if (val && !this.analyticsData) {
      this.loadAnalytics(this.analyticsDays);
    }
  }
  get isOpen(): boolean {
    return this._isOpen;
  }
  private _isOpen = false;

  @Output() closed = new EventEmitter<void>();
  @Output() queueNeedsReload = new EventEmitter<void>();

  isLoadingAnalytics = false;
  isAutoEscalating = false;
  analyticsDays = 7;
  analyticsData: ModerationAnalyticsData | null = null;

  ngOnInit(): void { }

  loadAnalytics(days: number = 7): void {
    this.analyticsDays = days;
    this.isLoadingAnalytics = true;
    this.cdr.markForCheck();

    this.moderationService.getAnalytics(days)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res?.data) {
            this.analyticsData = res.data;
          }
          this.isLoadingAnalytics = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.toast.error('Failed to load operational analytics metrics');
          this.isLoadingAnalytics = false;
          this.cdr.markForCheck();
        }
      });
  }

  triggerAutoEscalate(): void {
    this.isAutoEscalating = true;
    this.cdr.markForCheck();

    this.moderationService.triggerAutoEscalate()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.isAutoEscalating = false;
          if (res?.escalatedCount > 0) {
            this.toast.warning(`${res.escalatedCount} breached report(s) auto-escalated to Critical.`);
            this.queueNeedsReload.emit();
            this.loadAnalytics(this.analyticsDays);
          } else {
            this.toast.success('All active tickets are compliant within their SLA thresholds.');
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.isAutoEscalating = false;
          this.toast.error('Auto-escalation scan failed');
          this.cdr.markForCheck();
        }
      });
  }

  close(): void {
    this.closed.emit();
  }

  getMaxDaily(trends?: DailyVolumeTrend[]): number {
    if (!trends || trends.length === 0) return 10;
    const max = Math.max(...trends.map(t => Math.max(t.incoming, t.resolved, t.dismissed)));
    return Math.max(max, 5);
  }

  formatActionName(action: string): string {
    return action
      .replace(/^REPORT_/, '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  getInitials(email?: string): string {
    return extractUserInitials(email);
  }

  getActionPercent(count: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.min(100, Math.round((count / total) * 100));
  }

  getTotalBreakdownActions(b?: ActionBreakdown): number {
    if (!b) return 0;
    return (b.resolved || 0) + (b.dismissed || 0) + (b.escalated || 0) + (b.reopened || 0) + (b.claimed || 0) + (b.notes || 0);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}