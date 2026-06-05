import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-prompt-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prompt-dialog.component.html'
})
export class PromptDialogComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() label = '';
  @Input() value = '';

  @Output() submit = new EventEmitter<string>();
  @Output() cancel = new EventEmitter<void>();

  onCancel() {
    this.cancel.emit();
  }

  onSubmit() {
    this.submit.emit(this.value);
  }
}
