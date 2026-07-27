import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-quick-verify-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quick-verify-modal.component.html',
  styleUrl: './quick-verify-modal.component.scss'
})
export class QuickVerifyModalComponent {
  @Input() isOpen = false;
  @Input() pendingLawyersList: any[] = [];
  @Input() isSubmitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() verifyLawyer = new EventEmitter<any>();
  @Output() rejectLawyer = new EventEmitter<any>();

  onClose(): void {
    this.close.emit();
  }

  onVerify(lawyer: any): void {
    this.verifyLawyer.emit(lawyer);
  }

  onReject(lawyer: any): void {
    this.rejectLawyer.emit(lawyer);
  }
}