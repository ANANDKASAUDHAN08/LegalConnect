import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminApiService } from '../../../core/admin-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';

export interface DuplicatePair {
  primary: any;
  duplicate: any;
  similarityScore: number;
  reason: string;
}

@Component({
  selector: 'admin-resource-duplicate-modal',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './resource-duplicate-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceDuplicateModalComponent {
  @Input() duplicatePairs: DuplicatePair[] = [];
  @Input() isLoading = false;
  @Output() closed = new EventEmitter<void>();
  @Output() merged = new EventEmitter<void>();

  isMerging = false;
  mergingPairIndex: number | null = null;

  constructor(
    private api: AdminApiService,
    private toast: ToastService
  ) { }

  close(): void {
    this.closed.emit();
  }

  mergePair(pair: DuplicatePair, index: number): void {
    if (this.isMerging) return;
    this.isMerging = true;
    this.mergingPairIndex = index;

    const primaryId = pair.primary._id || pair.primary.id;
    const duplicateId = pair.duplicate._id || pair.duplicate.id;

    this.api.mergeResourceDuplicates(primaryId, duplicateId).subscribe({
      next: (res) => {
        this.isMerging = false;
        this.mergingPairIndex = null;
        this.duplicatePairs.splice(index, 1);
        this.toast.success(res.message || 'Duplicate record merged successfully.');
        this.merged.emit();
      },
      error: () => {
        this.isMerging = false;
        this.mergingPairIndex = null;
        this.toast.error('Failed to merge duplicate records.');
      }
    });
  }

  dismissPair(index: number): void {
    this.duplicatePairs.splice(index, 1);
    this.toast.info('Dismissed candidate pair from current session.');
  }
}