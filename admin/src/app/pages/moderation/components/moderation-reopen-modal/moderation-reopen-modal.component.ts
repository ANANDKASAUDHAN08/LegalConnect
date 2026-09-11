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
import { AdminIconComponent } from '../../../../shared/components/icon/icon.component';
import { TooltipDirective } from '../../../../shared/directives/tooltip.directive';

export interface ReopenModalSubmitEvent {
  report: ModerationReport;
  reason: string;
  restoreTarget: boolean;
}

@Component({
  selector: 'moderation-reopen-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminIconComponent,
    TooltipDirective
  ],
  templateUrl: './moderation-reopen-modal.component.html',
  styleUrls: ['./moderation-reopen-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ModerationReopenModalComponent {
  private cdr = inject(ChangeDetectorRef);

  @Input() set isOpen(val: boolean) {
    this._isOpen = val;
    if (val) {
      this.reason = '';
      this.restoreTarget = false;
    }
  }
  get isOpen(): boolean {
    return this._isOpen;
  }
  private _isOpen = false;

  @Input() report: ModerationReport | null = null;
  @Input() isProcessing = false;

  @Output() confirmed = new EventEmitter<ReopenModalSubmitEvent>();
  @Output() closed = new EventEmitter<void>();

  reason = '';
  restoreTarget = false;

  submit(): void {
    if (!this.report || !this.reason.trim() || this.isProcessing) return;
    this.confirmed.emit({
      report: this.report,
      reason: this.reason.trim(),
      restoreTarget: this.restoreTarget
    });
  }

  close(): void {
    this.closed.emit();
  }

  reset(): void {
    this.reason = '';
    this.restoreTarget = false;
    this.cdr.markForCheck();
  }
}