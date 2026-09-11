import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModerationReport } from '../../../../core/services/admin-moderation.service';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { AdminIconComponent } from '../../../../shared/components/icon/icon.component';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';

export interface ActionModalSubmitEvent {
  report: ModerationReport;
  mode: 'resolve' | 'dismiss';
  action: string;
  notes: string;
  cascade: boolean;
}

@Component({
  selector: 'moderation-action-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminIconComponent,
    TooltipDirective,
    SelectComponent
  ],
  templateUrl: './moderation-action-modal.component.html',
  styleUrls: ['./moderation-action-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModerationActionModalComponent {
  private cdr = inject(ChangeDetectorRef);

  @Input() isOpen = false;
  @Input() mode: 'resolve' | 'dismiss' = 'resolve';
  @Input() report: ModerationReport | null = null;
  @Input() isProcessing = false;

  @Output() confirmed = new EventEmitter<ActionModalSubmitEvent>();
  @Output() closed = new EventEmitter<void>();

  resolutionAction = 'ContentRemoved';
  moderatorNotes = '';
  cascadeEnforcement = true;

  readonly resolutionActions: SelectOption[] = [
    { label: 'Remove / Hide Content (Soft Delete)', value: 'ContentRemoved' },
    { label: 'Redact PII Information (DPDP Compliance)', value: 'InformationCorrected' },
    { label: 'Issue Formal Policy Warning', value: 'WarningIssued' },
    { label: 'Suspend User Account (Revoke Sessions)', value: 'UserSuspended' },
    { label: 'False Positive / Approve Content', value: 'NoActionRequired' }
  ];

  readonly presetTemplates: string[] = [
    'Violates DPDP Act §8: Personal contact & Aadhaar data leaked in public domain.',
    'Inauthentic / Astroturfed spam detected from coordinated subnet cluster.',
    'Forged Bar Council enrollment credentials; flagged for verification audit.',
    'Defamatory allegation lacking verifiable documentation or court receipt.',
    'False positive: advocate verified license and review conforms to guidelines.',
    'Directory registry corrected to reflect current administrative jurisdiction.'
  ];

  applyTemplate(template: string): void {
    this.moderatorNotes = template;
    this.cdr.markForCheck();
  }

  submit(): void {
    if (!this.report || this.isProcessing) return;
    this.confirmed.emit({
      report: this.report,
      mode: this.mode,
      action: this.resolutionAction,
      notes: this.moderatorNotes,
      cascade: this.cascadeEnforcement
    });
  }

  close(): void {
    this.closed.emit();
  }

  reset(): void {
    this.resolutionAction = 'ContentRemoved';
    this.moderatorNotes = '';
    this.cascadeEnforcement = true;
    this.cdr.markForCheck();
  }
}