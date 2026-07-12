import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LegalRoadmapComponent } from '../legal-roadmap/legal-roadmap.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
 
/**
 * Case Pack preview modal + print logic — deferred loaded on demand.
 * Extracts ~150 lines of modal HTML from the parent component.
 */
@Component({
  selector: 'app-case-pack-preview-modal',
  standalone: true,
  imports: [CommonModule, RouterLink, LegalRoadmapComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './case-pack-preview-modal.component.html',
  styleUrls: ['./case-pack-preview-modal.component.scss']
})
export class CasePackPreviewModalComponent implements OnInit, OnDestroy {
  @Input() activeCategory = '';
  @Input() locationQuery = '';
  @Input() roadmap: any = null;
  @Input() filteredResources: any[] = [];
  @Input() interactive = false;

  @Output() closed = new EventEmitter<void>();
  @Output() print = new EventEmitter<void>();

  // Text-To-Speech Narrator states
  isSpeaking = false;
  speakingTextKey: string | null = null;

  lastSavedTime = '';

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    document.body.style.overflow = 'hidden';
    this.lastSavedTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
    this.stopSpeaking();
  }

  // Speech synthesis narrator
  speakText(textKey: string, textToSpeak: string, langCode: 'en' | 'hi') {
    if (!('speechSynthesis' in window)) {
      return;
    }

    if (this.isSpeaking && this.speakingTextKey === textKey) {
      this.stopSpeaking();
      return;
    }

    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = langCode === 'hi' ? 'hi-IN' : 'en-IN';

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(langCode));
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      this.isSpeaking = false;
      this.speakingTextKey = null;
      this.cdr.markForCheck();
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error', e);
      this.isSpeaking = false;
      this.speakingTextKey = null;
      this.cdr.markForCheck();
    };

    this.isSpeaking = true;
    this.speakingTextKey = textKey;
    setTimeout(() => {
      if (this.speakingTextKey === textKey) {
        window.speechSynthesis.speak(utterance);
      }
    }, 100);
    this.cdr.markForCheck();
  }

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.speakingTextKey = null;
    this.cdr.markForCheck();
  }

  get todayDateString(): string {
    return new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  trackByIndex(index: number): number {
    return index;
  }
}