import {
  Component, ChangeDetectionStrategy, inject, input, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModerationReportService } from '../../../services/moderation-report.service';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { IconComponent } from '../../icon/icon.component';

/**
 * <app-report-trigger> — Report Button Trigger
 *
 * Small inline button that opens the report modal for the specified target.
 * Uses Angular 17+ Signal Inputs for reactive route parameter navigation.
 * Displays subtle active state if user has already submitted a report for this target.
 *
 * Usage:
 *   <app-report-trigger targetType="Review" [targetId]="review.id.toString()" [targetTitle]="review.targetName" />
 */
@Component({
  selector: 'app-report-trigger',
  standalone: true,
  imports: [CommonModule, TooltipDirective, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './report-trigger.component.html',
  styleUrls: ['./report-trigger.component.scss']
})
export class ReportTriggerComponent {
  targetType = input.required<string>();
  targetId = input.required<string>();
  targetTitle = input.required<string>();
  showLabel = input(true);

  private reportService = inject(ModerationReportService);

  isReported = computed(() => {
    const type = this.targetType();
    const id = this.targetId();
    if (!type || !id) return false;
    return this.reportService.hasReported(type, id);
  });

  activeReport = computed(() => {
    const type = this.targetType();
    const id = this.targetId();
    if (!type || !id) return null;
    return this.reportService.getReport(type, id);
  });

  tooltipText = computed(() => {
    const r = this.activeReport();
    if (r) {
      return `Report submitted (${r.referenceId}) • Under Moderation Review`;
    }
    return `Report issue or incorrect info with ${this.targetTitle() || 'this content'}`;
  });

  onReport(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.reportService.openReport(this.targetType(), this.targetId(), this.targetTitle());
  }
}