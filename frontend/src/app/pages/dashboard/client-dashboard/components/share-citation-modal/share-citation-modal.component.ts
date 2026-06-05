import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Bookmark } from '../../../../../services/bookmark.service';
import { Consultation } from '../../../../../services/lawyer.service';

@Component({
  selector: 'app-share-citation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './share-citation-modal.component.html'
})
export class ShareCitationModalComponent {
  @Input() isOpen = false;
  @Input() bookmark: Bookmark | null = null;
  @Input() inquiries: Consultation[] = [];

  @Output() closeModal = new EventEmitter<void>();
  @Output() lawyerSelected = new EventEmitter<Consultation>();

  onClose() {
    this.closeModal.emit();
  }

  selectLawyer(lawyer: Consultation) {
    this.lawyerSelected.emit(lawyer);
  }
}
