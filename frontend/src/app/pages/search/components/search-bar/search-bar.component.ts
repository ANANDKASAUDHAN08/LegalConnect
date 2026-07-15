import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject, ChangeDetectionStrategy, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
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
  private ngZone = inject(NgZone);

  @Input() query = '';
  @Input() loading = false;
  @Input() isOffline = false;
  @Input() size: 'normal' | 'compact' = 'normal';
  @Input() showPills = true;

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

  // Lifecycle memory-leak & crash guard
  private isDestroyed = false;

  ngOnInit() {
    this.initVoiceRecognition();

    // RxJS autocomplete debounce (Optimization #2)
    this.autocompleteSub = this.queryInputSubject.pipe(
      debounceTime(220),
      distinctUntilChanged(),
      switchMap(query => {
        const trimmed = query.trim();
        if (!trimmed || this.isOffline) {
          this.isSearchingSuggestions = false;
          this.showSuggestions = false;
          this.safeMarkForCheck();
          return of({ success: true, data: [] });
        }
        this.isSearchingSuggestions = true;
        this.showSuggestions = true;
        this.safeMarkForCheck();
        return this.legalService.getMappingSuggestions(trimmed);
      })
    ).subscribe({
      next: (res: any) => {
        const rawList = res.data || [];
        // Performance Tuning: Pre-calculate categories and clean names in TS
        // to avoid calling functions in HTML template on every CD cycle
        this.suggestions = rawList.map((s: any) => ({
          ...s,
          category: this.getActCategory(s.act),
          cleanedAct: this.cleanActName(s.act)
        }));
        this.isSearchingSuggestions = false;
        this.safeMarkForCheck();
      },
      error: () => {
        this.suggestions = [];
        this.isSearchingSuggestions = false;
        this.safeMarkForCheck();
      }
    });
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    if (this.autocompleteSub) {
      this.autocompleteSub.unsubscribe();
    }
    // Optimization #10: release microphone device
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
    }
  }

  // Safe wrapper to prevent ViewDestroyedException
  private safeMarkForCheck() {
    if (!this.isDestroyed) {
      this.cdr.markForCheck();
    }
  }

  trackBySuggestion(index: number, item: any): string {
    return `${item.act}-${item.section}`;
  }

  onQueryChange(val: string) {
    this.query = val;
    this.queryChange.emit(val);
    if (!val.trim()) {
      this.suggestions = [];
      this.showSuggestions = false;
      this.isSearchingSuggestions = false;
      this.safeMarkForCheck();
    }
    this.queryInputSubject.next(val);
  }

  onFocus() {
    if (this.query.trim() && !this.isOffline) {
      this.showSuggestions = true;
      this.safeMarkForCheck();
    }
  }

  performSearch() {
    this.showSuggestions = false;
    this.search.emit(this.query);
    this.safeMarkForCheck();
  }

  selectSuggestion(s: any) {
    const cleanTitle = (s.title || '').replace(/<[^>]*>/g, '');
    this.query = `${s.act} Section ${s.section}: ${cleanTitle}`;
    this.queryChange.emit(this.query);
    this.showSuggestions = false;
    this.performSearch();
    this.safeMarkForCheck();
  }

  getActCategory(act: string): 'criminal' | 'evidence' | 'general' {
    if (!act) return 'general';
    const upper = act.toUpperCase();
    if (upper.includes('BNS') || upper.includes('IPC') || upper.includes('CRPC')) {
      return 'criminal';
    }
    if (upper.includes('BSA') || upper.includes('IEA')) {
      return 'evidence';
    }
    return 'general';
  }

  cleanActName(act: string): string {
    if (!act) return '';
    const upper = act.trim().toUpperCase();
    
    // Exact mapping for messy DB keys
    const mapping: Record<string, string> = {
      'A(DOFAOSBAS': 'Aadhaar Act',
      'AAOI': 'Airports Authority Act',
      'RAAOIP': 'Requisitioning of Property Act',
      'ATALR': 'Ajmer Tenancy Act',
      'AF_1950': 'Air Force Act',
      'A_1950': 'Army Act',
      'ITA': 'IT Act',
      'CPA': 'Consumer Protection Act',
      'ICA': 'Contract Act',
      'RTI': 'RTI Act',
      'CONSTITUTION': 'Constitution of India'
    };

    if (mapping[upper]) {
      return mapping[upper];
    }

    // Strip year underscore suffix if present e.g. AF_1950 -> AF
    if (act.includes('_')) {
      const parts = act.split('_');
      if (parts[0] && !isNaN(Number(parts[1]))) {
        return parts[0];
      }
    }

    return act;
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
      this.ngZone.run(() => {
        this.isRecording = true;
        this.snackbar.show('Listening... Speak your question.', 'info');
        this.safeMarkForCheck();
      });
    };

    this.recognition.onerror = (err: any) => {
      this.ngZone.run(() => {
        console.error('Speech recognition error:', err);
        this.isRecording = false;

        if (err.error === 'no-speech') {
          this.snackbar.show('No speech detected. Please speak clearly.', 'info');
        } else if (err.error === 'not-allowed') {
          this.snackbar.show('Microphone access blocked. Check browser settings.', 'error');
        } else {
          this.snackbar.show('Voice input failed. Please try again.', 'error');
        }

        this.safeMarkForCheck();
      });
    };

    this.recognition.onend = () => {
      this.ngZone.run(() => {
        if (this.isRecording) {
          this.isRecording = false;
          this.snackbar.show('Voice search stopped.', 'info');
        }
        this.safeMarkForCheck();
      });
    };

    this.recognition.onresult = (event: any) => {
      this.ngZone.run(() => {
        const resultText = event.results[0][0].transcript;
        if (resultText) {
          this.query = resultText;
          this.queryChange.emit(resultText);
          this.performSearch();
          this.safeMarkForCheck();
        }
      });
    };
  }

  toggleVoiceRecording() {
    if (!this.recognition) {
      this.snackbar.show('Voice recognition is not supported on this browser.', 'error');
      return;
    }

    if (this.isRecording) {
      try {
        this.recognition.stop();
        this.snackbar.show('Voice search stopped.', 'info');
      } catch (e) {
        console.error('Error stopping speech recognition:', e);
      }
      this.isRecording = false;
    } else {
      this.recognition.lang = this.voiceLanguage === 'ENG' ? 'en-IN' : 'hi-IN';
      try {
        this.recognition.start();
      } catch (e) {
        console.error('Error starting speech recognition:', e);
        try {
          this.recognition.abort();
        } catch (abortError) { }
        this.isRecording = false;
        this.snackbar.show('Microphone is busy. Please tap again.', 'warning');
      }
    }
    this.safeMarkForCheck();
  }

  setVoiceLanguage(lang: 'ENG' | 'HI') {
    this.voiceLanguage = lang;
    this.snackbar.show(`Voice input language set to ${lang === 'ENG' ? 'English' : 'Hindi'}.`, 'success');
    this.safeMarkForCheck();
  }

  // --- Real OCR Document Scanner using Tesseract.js ---
  triggerOcrScan(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      this.snackbar.show(`Reading ${file.name}... Initializing OCR engine.`, 'info');
      this.loading = true;
      this.safeMarkForCheck();

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;

        // Bundle Size Optimization: Lazy load tesseract.js dynamically only when scanning is clicked
        import('tesseract.js').then(tesseract => {
          // Angular Zone Optimization: Run outside Angular zone so hundreds of Web Worker progress logging events 
          // do not trigger unnecessary Change Detection cycles on the main thread.
          this.ngZone.runOutsideAngular(() => {
            tesseract.recognize(
              dataUrl,
              'eng',
              {
                logger: m => {
                  if (m.status === 'recognizing') {
                    // Update progress snackbar inside Angular zone
                    this.ngZone.run(() => {
                      this.snackbar.show(`Scanning document... ${Math.round(m.progress * 100)}%`, 'info');
                    });
                  }
                }
              }
            ).then(({ data: { text } }) => {
              this.ngZone.run(() => {
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
                this.safeMarkForCheck();
              });
            }).catch(err => {
              this.ngZone.run(() => {
                this.loading = false;
                console.error('OCR Error:', err);
                this.snackbar.show('OCR scan failed. Please try a different image.', 'error');
                this.safeMarkForCheck();
              });
            });
          });
        }).catch(err => {
          this.loading = false;
          console.error('Failed to import Tesseract:', err);
          this.snackbar.show('Failed to initialize document scanner.', 'error');
          this.safeMarkForCheck();
        });
      };

      reader.readAsDataURL(file);
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (this.showSuggestions) {
      const target = event.target as HTMLElement;
      // Check against both the search bar and the suggestions panel
      if (!target.closest('.search-bar-container') && !target.closest('.suggestions-panel')) {
        this.showSuggestions = false;
        this.safeMarkForCheck();
      }
    }
  }
}