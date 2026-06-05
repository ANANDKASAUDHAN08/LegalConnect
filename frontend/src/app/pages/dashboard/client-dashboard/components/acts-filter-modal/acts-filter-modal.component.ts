import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-acts-filter-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './acts-filter-modal.component.html',
  styleUrls: ['./acts-filter-modal.component.scss']
})
export class ActsFilterModalComponent {
  @Input() isOpen = false;
  @Input() actsBreakdown: { name: string, count: number }[] = [];

  @Output() closeModal = new EventEmitter<void>();
  @Output() actSelected = new EventEmitter<string>();

  onClose() {
    this.closeModal.emit();
  }

  selectAct(actName: string) {
    this.actSelected.emit(actName);
  }
}
