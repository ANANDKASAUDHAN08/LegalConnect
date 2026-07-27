import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-quick-broadcast-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quick-broadcast-modal.component.html',
  styleUrl: './quick-broadcast-modal.component.scss'
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