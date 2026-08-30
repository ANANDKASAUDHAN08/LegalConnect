import {
  Component, Input, ChangeDetectionStrategy, inject, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModerationReportService } from '../../../services/moderation-report.service';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { IconComponent } from '../../icon/icon.component';

/**
 * <app-report-trigger> — Report Button Trigger
 *
 * Small inline button that opens the report modal for the specified target.
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
  @Input({ required: true }) targetType!: string;
  @Input({ required: true }) targetId!: string;
  @Input({ required: true }) targetTitle!: string;
  @Input() showLabel = true;

  private reportService = inject(ModerationReportService);

  onReport(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.reportService.openReport(this.targetType, this.targetId, this.targetTitle);
  }
}
