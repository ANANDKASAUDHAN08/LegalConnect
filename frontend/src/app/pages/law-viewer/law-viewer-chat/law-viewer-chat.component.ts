import { Component, Input, OnChanges, SimpleChanges, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { LegalService } from '../../../services/legal.service';

@Component({
  selector: 'app-law-viewer-chat',
  standalone: true,
  imports: [NgFor, NgIf, NgClass, FormsModule],
  templateUrl: './law-viewer-chat.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LawViewerChatComponent implements OnChanges, OnDestroy {
  @Input() shortName = '';
  @Input() sectionNumber = '';
  @Input() sectionTitle = '';

  chatMessages: { sender: 'user' | 'ai'; text: string }[] = [];
  chatInput = '';
  chatLoading = false;

  private destroy$ = new Subject<void>();

  constructor(
    private legalService: LegalService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['sectionNumber'] || changes['shortName']) {
      this.clearChat();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  sendChatMessage() {
    if (!this.chatInput.trim() || this.chatLoading || !this.sectionNumber) return;
    const userMsg = this.chatInput.trim();
    this.chatMessages.push({ sender: 'user', text: userMsg });
    this.chatInput = '';
    this.chatLoading = true;
    this.cdr.markForCheck();

    this.legalService.chatAboutSection(this.shortName, this.sectionNumber, userMsg)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.chatLoading = false;
          if (res.success && res.answer) {
            this.chatMessages.push({ sender: 'ai', text: res.answer });
          } else {
            this.chatMessages.push({ sender: 'ai', text: 'Sorry, I encountered an issue generating a response.' });
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.chatLoading = false;
          console.error('Chat error:', err);
          this.chatMessages.push({ sender: 'ai', text: 'Error communicating with AI service.' });
          this.cdr.markForCheck();
        }
      });
  }

  clearChat() {
    this.chatMessages = [];
  }
}
