import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../directives/tooltip.directive';

@Component({
  selector: 'app-ticket-card',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './ticket-card.component.html'
})
export class TicketCardComponent {
  @Input() ticket!: any;
  @Input() now: number = Date.now();

  @Output() withdraw = new EventEmitter<any>();
  @Output() followUpSubmitted = new EventEmitter<{ ticket: any; text: string }>();

  isNotesExpanded = false;
  showFollowUpInput = false;
  followUpText = '';
  isSubmittingFollowUp = false;

  toggleNotes() {
    this.isNotesExpanded = !this.isNotesExpanded;
  }

  toggleFollowUpInput() {
    this.showFollowUpInput = !this.showFollowUpInput;
    if (!this.showFollowUpInput) {
      this.followUpText = '';
    }
  }

  trackByNoteTimestamp(index: number, note: any): any {
    return note ? note.date : index;
  }

  getFollowUpStatus(ticket: any): { allowed: boolean; reason?: string; cooldownText?: string; remainingSecs?: number } {
    if (!ticket) return { allowed: true };

    const notes = ticket.notes || [];
    if (notes.length >= 5) {
      return { allowed: false, reason: 'Maximum limit of 5 follow-up notes reached.' };
    }

    if (notes.length > 0) {
      const lastNote = notes[notes.length - 1];
      const lastTime = new Date(lastNote.date).getTime();
      const elapsedSecs = Math.floor((this.now - lastTime) / 1000);
      const COOLDOWN_SECS = 180;

      if (elapsedSecs < COOLDOWN_SECS) {
        const remainingSecs = COOLDOWN_SECS - elapsedSecs;
        const mins = Math.floor(remainingSecs / 60);
        const secs = remainingSecs % 60;
        const cooldownText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        return {
          allowed: false,
          reason: `Please wait ${cooldownText} before posting another follow-up note.`,
          cooldownText,
          remainingSecs
        };
      }
    }

    return { allowed: true };
  }

  onWithdraw() {
    this.withdraw.emit(this.ticket);
  }

  onSubmitFollowUp() {
    if (!this.followUpText.trim() || !this.getFollowUpStatus(this.ticket).allowed) {
      return;
    }
    this.isSubmittingFollowUp = true;
    this.followUpSubmitted.emit({
      ticket: this.ticket,
      text: this.followUpText.trim()
    });
  }

  // Method to reset follow up form after submission completes in parent
  resetFollowUp() {
    this.isSubmittingFollowUp = false;
    this.showFollowUpInput = false;
    this.followUpText = '';
  }
}