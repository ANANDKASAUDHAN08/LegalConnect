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
  private cancelActive$ = new Subject<void>();

  constructor(
    private legalService: LegalService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['sectionNumber'] || changes['shortName']) {
      this.cancelActive$.next();
      this.chatLoading = false;
      this.chatInput = '';
      this.loadChatHistory();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.cancelActive$.next();
    this.cancelActive$.complete();
  }

  private getStorageKey(): string {
    return `legalconnect_chat_${this.shortName}_${this.sectionNumber}`;
  }

  private loadChatHistory() {
    if (!this.shortName || !this.sectionNumber) {
      this.chatMessages = [];
      this.cdr.markForCheck();
      return;
    }

    const key = this.getStorageKey();
    const stored = localStorage.getItem(key);

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const timestamp = parsed.timestamp || 0;
        const messages = parsed.messages || [];

        // Expiry of 30 days (30 * 24 * 60 * 60 * 1000 = 2592000000 ms)
        if (Date.now() - timestamp > 2592000000) {
          localStorage.removeItem(key);
          this.chatMessages = [];
        } else {
          this.chatMessages = messages;
        }
      } catch (e) {
        console.error('Error parsing stored chat:', e);
        this.chatMessages = [];
      }
    } else {
      this.chatMessages = [];
    }
    this.cdr.markForCheck();
  }

  private saveChatHistory() {
    if (!this.shortName || !this.sectionNumber) return;
    const key = this.getStorageKey();

    // Performance optimization: Limit stored history to last 50 messages to keep storage size small
    const messagesToSave = this.chatMessages.slice(-50);

    const payload = {
      timestamp: Date.now(),
      messages: messagesToSave
    };

    try {
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (err) {
      console.warn('LocalStorage save failed (possibly quota full):', err);
    }
  }

  sendChatMessage() {
    if (!this.chatInput.trim() || this.chatLoading || !this.sectionNumber) return;
    const userMsg = this.chatInput.trim();

    // Add user message to array and save to local storage
    this.chatMessages.push({ sender: 'user', text: userMsg });
    this.saveChatHistory();

    // Context prompt trick to pass conversation history statelessly to Gemini
    let contextPrompt = '';
    // Performance optimization: Only pass the last 6 messages (3 back-and-forth exchanges) 
    // to focus the AI on immediate context and avoid bloated token sizes.
    const history = this.chatMessages.slice(0, -1).slice(-6);
    if (history.length > 0) {
      const historyStr = history
        .map(msg => `${msg.sender === 'user' ? 'User' : 'AI'}: ${msg.text}`)
        .join('\n');
      contextPrompt = `Previous conversation context:\n${historyStr}\n\nFollow-up question: ${userMsg}`;
    } else {
      contextPrompt = userMsg;
    }

    this.chatInput = '';
    this.chatLoading = true;
    this.cdr.markForCheck();

    this.legalService.chatAboutSection(this.shortName, this.sectionNumber, contextPrompt)
      .pipe(
        takeUntil(this.destroy$),
        takeUntil(this.cancelActive$)
      )
      .subscribe({
        next: (res) => {
          this.chatLoading = false;
          if (res.success && res.answer) {
            this.chatMessages.push({ sender: 'ai', text: res.answer });
          } else {
            this.chatMessages.push({ sender: 'ai', text: 'Sorry, I encountered an issue generating a response.' });
          }
          this.saveChatHistory();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.chatLoading = false;
          console.error('Chat error:', err);
          this.chatMessages.push({ sender: 'ai', text: 'Error communicating with AI service.' });
          this.saveChatHistory();
          this.cdr.markForCheck();
        }
      });
  }

  clearChat() {
    this.chatMessages = [];
    if (this.shortName && this.sectionNumber) {
      localStorage.removeItem(this.getStorageKey());
    }
    this.cdr.markForCheck();
  }
}