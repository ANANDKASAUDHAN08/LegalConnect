import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminIconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-quick-broadcast-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminIconComponent],
  templateUrl: './quick-broadcast-modal.component.html',
  styleUrl: './quick-broadcast-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickBroadcastModalComponent {
  @Input() isOpen = false;
  @Input() broadcastData: { title: string; message: string; targetAudience: string; priority: string } = {
    title: '',
    message: '',
    targetAudience: 'All',
    priority: 'Normal'
  };
  @Input() isSubmitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() submitBroadcast = new EventEmitter<any>();

  onClose(): void {
    this.close.emit();
  }

  onSubmit(): void {
    this.submitBroadcast.emit(this.broadcastData);
  }
}