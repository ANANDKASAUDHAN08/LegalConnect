import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../../directives/tooltip.directive';

export interface FunnelStep {
  name: string;
  count: number;
  deltaPct?: number;
  conversionFromPrev?: number;
  colorClass: string;
}

@Component({
  selector: 'app-funnel-metric',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './funnel-metric.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FunnelMetricComponent {
  @Input() steps: FunnelStep[] = [];
  @Input() overallConversionRate: number = 0;

  getStepWidth(count: number): number {
    if (!this.steps.length) return 0;
    const max = this.steps[0].count || 1;
    return Math.max(8, Math.min(100, (count / max) * 100));
  }
}