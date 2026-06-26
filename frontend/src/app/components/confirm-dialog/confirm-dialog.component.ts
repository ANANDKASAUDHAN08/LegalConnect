import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html'
})
export class ConfirmDialogComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() message = '';
  @Input() type: 'danger' | 'warning' | 'info' = 'warning';
  @Input() icon?: string;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onCancel() {
    this.cancel.emit();
  }

  onConfirm() {
    this.confirm.emit();
  }

  getIconName(): string {
    if (this.icon) {
      return this.icon.toLowerCase();
    }
    const msg = (this.message + ' ' + this.title).toLowerCase();
    if (msg.includes('delete') || msg.includes('remove') || msg.includes('wipe') || msg.includes('clear')) {
      return 'trash';
    }
    if (msg.includes('sync') || msg.includes('switch') || msg.includes('mode')) {
      return 'sync';
    }
    return this.type;
  }
}
