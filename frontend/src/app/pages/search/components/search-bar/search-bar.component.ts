import * as Tesseract from 'tesseract.js';
import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectionStrategy, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { LegalService } from '../../../../services/legal.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './search-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchBarComponent implements OnInit, OnDestroy {
  private legalService = inject(LegalService);
  private snackbar = inject(SnackbarService);
  private cdr = inject(ChangeDetectorRef);

  @Input() query = '';
  @Input() loading = false;
  @Input() isOffline = false;
  @Input() size: 'normal' | 'compact' = 'normal';

  @Output() queryChange = new EventEmitter<string>();
  @Output() search = new EventEmitter<string>();

  // Suggestions Autocomplete
  showSuggestions = false;
  suggestions: any[] = [];
  isSearchingSuggestions = false;

  private queryInputSubject = new Subject<string>();
  private autocompleteSub: Subscription | null = null;

  // Voice Input (Web Speech API)
  isRecording = false;
  voiceLanguage: 'ENG' | 'HI' = 'ENG';
  private recognition: any = null;

  ngOnInit() {
    this.initVoiceRecognition();

    // RxJS autocomplete debounce (Optimization #2)
    this.autocompleteSub = this.queryInputSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query.trim() || this.isOffline) {
          this.isSearchingSuggestions = false;
          this.showSuggestions = false;
          this.cdr.markForCheck();
          return [];
        }
        this.isSearchingSuggestions = true;
        this.showSuggestions = true;
        this.cdr.markForCheck();
        return this.legalService.getMappingSuggestions(query);
      })
    ).subscribe({
      next: (res: any) => {
        this.suggestions = res.data || [];
        this.isSearchingSuggestions = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.suggestions = [];
        this.isSearchingSuggestions = false;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy() {
    if (this.autocompleteSub) {
      this.autocompleteSub.unsubscribe();
    }
    // Optimization #10: release microphone device
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
    }
  }

  onQueryChange(val: string) {
    this.query = val;
    this.queryChange.emit(val);
    if (!val.trim()) {
      this.suggestions = [];
      this.showSuggestions = false;
      this.isSearchingSuggestions = false;
      this.cdr.markForCheck();
    }
    this.queryInputSubject.next(val);
  }

  onFocus() {
    if (this.query.trim() && !this.isOffline) {
      this.showSuggestions = true;
      this.cdr.markForCheck();
    }
  }

  performSearch() {
    this.showSuggestions = false;
    this.search.emit(this.query);
    this.cdr.markForCheck();
  }

  selectSuggestion(s: any) {
    this.query = `${s.act} Section ${s.section}: ${s.title}`;
    this.queryChange.emit(this.query);
    this.showSuggestions = false;
    this.performSearch();
    this.cdr.markForCheck();
  }

  // --- Voice Input (Web Speech API) ---
  private initVoiceRecognition() {
    const windowObj = window as any;
    const SpeechRec = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
    if (!SpeechRec) return;

    this.recognition = new SpeechRec();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.isRecording = true;
      this.snackbar.show('Listening... Speak your legal question.', 'info');
      this.cdr.markForCheck();
    };

    this.recognition.onerror = (err: any) => {
      console.error(err);
      this.isRecording = false;
      this.snackbar.show('Voice input failed. Please speak again.', 'error');
      this.cdr.markForCheck();
    };

    this.recognition.onend = () => {
      if (this.isRecording) {
        this.isRecording = false;
        this.snackbar.show('Voice search stopped.', 'info');
      }
      this.cdr.markForCheck();
    };

    this.recognition.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      if (resultText) {
        this.query = resultText;
        this.queryChange.emit(resultText);
        this.performSearch();
        this.cdr.markForCheck();
      }
    };
  }

  toggleVoiceRecording() {
    if (!this.recognition) {
      this.snackbar.show('Voice recognition is not supported on this browser.', 'error');
      return;
    }

    if (this.isRecording) {
      this.isRecording = false;
      this.recognition.stop();
      this.snackbar.show('Voice search stopped.', 'info');
    } else {
      this.recognition.lang = this.voiceLanguage === 'ENG' ? 'en-IN' : 'hi-IN';
      this.recognition.start();
    }
    this.cdr.markForCheck();
  }

  setVoiceLanguage(lang: 'ENG' | 'HI') {
    this.voiceLanguage = lang;
    this.snackbar.show(`Voice input language set to ${lang === 'ENG' ? 'English' : 'Hindi'}.`, 'success');
    this.cdr.markForCheck();
  }

  // --- Real OCR Document Scanner using Tesseract.js ---
  triggerOcrScan(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.snackbar.show(`Reading ${file.name}... Initializing OCR engine.`, 'info');
      this.loading = true;
      this.cdr.markForCheck();

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;

        // Execute real OCR character recognition directly in browser
        Tesseract.recognize(
          dataUrl,
          'eng',
          {
            logger: m => {
              if (m.status === 'recognizing') {
                // Show real-time progress update percentages in snackbar!
                this.snackbar.show(`Scanning document... ${Math.round(m.progress * 100)}%`, 'info');
              }
            }
          }
        ).then(({ data: { text } }) => {
          this.loading = false;

          if (text && text.trim()) {
            // Clean up the text: remove linebreaks, double spaces, and crop to safe length
            const cleanText = text.trim()
              .replace(/[\r\n]+/g, ' ')
              .replace(/\s+/g, ' ')
              .substring(0, 120); // Capture the main keyword context

            this.query = cleanText;
            this.queryChange.emit(cleanText);
            this.performSearch();
            this.snackbar.show('Document scan complete! Searching extracted text.', 'success');
          } else {
            this.snackbar.show('Scan complete, but no readable English text was found.', 'warning');
          }
          this.cdr.markForCheck();
        }).catch(err => {
          this.loading = false;
          console.error('OCR Error:', err);
          this.snackbar.show('OCR scan failed. Please try a different image.', 'error');
          this.cdr.markForCheck();
        });
      };

      reader.readAsDataURL(file);
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (this.showSuggestions) {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-bar-container')) {
        this.showSuggestions = false;
        this.cdr.markForCheck();
      }
    }
  }
}