import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { LegalService, BareAct, ApiResponse } from '../../services/legal.service';
import { NotificationService } from '../../services/notification.service';
import { SnackbarService } from '../../services/snackbar.service';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, delay } from 'rxjs';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { ActCardComponent } from './components/act-card/act-card.component';

@Component({
  selector: 'app-browse-laws',
  standalone: true,
  imports: [RouterLink, NgFor, NgIf, NgClass, FormsModule, TooltipDirective, ActCardComponent],
  templateUrl: './browse-laws.component.html',
  styleUrls: ['./browse-laws.component.scss']
})
export class BrowseLawsComponent implements OnInit, OnDestroy {
  acts: BareAct[] = [];
  searchQuery = '';
  loading = true;
  error = '';
  selectedCategory = 'all';

  // Voice Search State
  isListening = false;
  private voiceRecognition: any = null;
  private voiceTimeout: any = null;

  // Search mode: 'keyword' or 'ai'
  searchMode: 'keyword' | 'ai' = 'keyword';
  aiQuery = '';
  aiLoading = false;
  aiAnswer = '';
  aiSuggestedActs: string[] = [];
  aiError = '';

  // Quick prompt chips for AI mode
  quickPrompts = [
    'What law covers murder in India?',
    'Which act handles cheque bounce?',
    'How to claim accident compensation?',
    'What are divorce laws in India?',
    'Cybercrime reporting procedure?',
  ];

  // Library stats (will be computed from acts)
  get totalActs(): number { return this.acts.length; }
  get totalSections(): number {
    // Acts data from list endpoint doesn't include chapters, so use a sensible static
    return 3300;
  }

  private destroy$ = new Subject<void>();
  private aiQueryChange$ = new Subject<string>();

  constructor(
    private legalService: LegalService,
    public notificationService: NotificationService,
    private snackbar: SnackbarService,
    private router: Router,
    private ngZone: NgZone
  ) { }

  ngOnInit() {
    this.legalService.getActs()
      .pipe(delay(1000))
      .subscribe({
        next: (res: ApiResponse<BareAct[]>) => { this.acts = res.data; this.loading = false; },
        error: () => { this.error = 'Could not load acts from the server.'; this.loading = false; }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopVoiceSearch();
  }

  toggleSearchMode() {
    this.searchMode = this.searchMode === 'keyword' ? 'ai' : 'keyword';
    this.aiAnswer = '';
    this.aiSuggestedActs = [];
    this.aiError = '';
    this.aiQuery = '';
    this.searchQuery = '';
  }

  useQuickPrompt(prompt: string) {
    this.aiQuery = prompt;
    this.submitAiQuery();
  }

  submitAiQuery() {
    if (!this.aiQuery.trim() || this.aiLoading) return;
    this.aiLoading = true;
    this.aiAnswer = '';
    this.aiSuggestedActs = [];
    this.aiError = '';

    this.legalService.askLegalQuestion(this.aiQuery.trim()).subscribe({
      next: (res) => {
        this.aiLoading = false;
        this.aiAnswer = res.answer;
        this.aiSuggestedActs = res.suggestedActs;
      },
      error: () => {
        this.aiLoading = false;
        this.aiError = 'AI could not process your question. Please try keyword search.';
      }
    });
  }

  openAiSuggestedAct(shortName: string) {
    this.router.navigate(['/laws', shortName]);
  }

  onAiQueryKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.submitAiQuery();
    }
  }

  get filteredActs() {
    // If AI mode with suggested acts, show those first then all
    let list = this.acts;

    if (this.selectedCategory !== 'all') {
      const cat = this.selectedCategory;
      if (cat === 'criminal') {
        list = list.filter(a => ['BNS', 'BNSS', 'BSA', 'IPC', 'CrPC', 'IEA'].includes(a.shortName));
      } else if (cat === 'civil') {
        list = list.filter(a => ['CPC', 'MVA', 'NIA'].includes(a.shortName));
      } else if (cat === 'family') {
        list = list.filter(a => ['HMA', 'IDA'].includes(a.shortName));
      } else if (cat === 'constitutional') {
        list = list.filter(a => ['Constitution'].includes(a.shortName));
      }
    }

    if (!this.searchQuery.trim()) return list;
    const q = this.searchQuery.toLowerCase();
    return list.filter(a =>
      a.actName.toLowerCase().includes(q) ||
      a.shortName.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q)
    );
  }

  get aiFilteredActs(): BareAct[] {
    if (!this.aiSuggestedActs.length) return this.acts;
    const suggested = this.acts.filter(a => this.aiSuggestedActs.includes(a.shortName));
    const rest = this.acts.filter(a => !this.aiSuggestedActs.includes(a.shortName));
    return [...suggested, ...rest];
  }

  isAiSuggested(shortName: string): boolean {
    return this.aiSuggestedActs.includes(shortName);
  }

  startVoiceSearch() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.snackbar.show('Voice search is not supported in this browser.', 'warning');
      return;
    }
    if (this.isListening) {
      this.stopVoiceSearch();
      return;
    }

    if (this.voiceTimeout) {
      clearTimeout(this.voiceTimeout);
    }

    this.voiceRecognition = new SpeechRecognition();
    this.voiceRecognition.lang = 'en-IN';
    this.voiceRecognition.interimResults = false;
    this.voiceRecognition.maxAlternatives = 1;

    this.isListening = true;
    this.snackbar.show('Listening... Speak now.', 'info');

    // Automatically stop after 10 seconds of silence/no results
    this.voiceTimeout = setTimeout(() => {
      this.ngZone.run(() => {
        if (this.isListening) {
          this.stopVoiceSearch();
          this.snackbar.show('Voice search timed out.', 'info');
        }
      });
    }, 10000);

    this.voiceRecognition.onresult = (event: any) => {
      if (this.voiceTimeout) {
        clearTimeout(this.voiceTimeout);
        this.voiceTimeout = null;
      }
      const result = event.results[0][0].transcript;
      if (result) {
        this.ngZone.run(() => {
          if (this.searchMode === 'ai') {
            this.aiQuery = result;
            this.snackbar.show(`Voice input: "${result}"`, 'success');
            this.submitAiQuery();
          } else {
            this.searchQuery = result;
            this.snackbar.show(`Voice search: "${result}"`, 'success');
          }
        });
      }
    };

    this.voiceRecognition.onerror = (err: any) => {
      console.error('Speech recognition error', err);
      if (this.voiceTimeout) {
        clearTimeout(this.voiceTimeout);
        this.voiceTimeout = null;
      }
      this.ngZone.run(() => {
        this.isListening = false;
      });
    };

    this.voiceRecognition.onend = () => {
      if (this.voiceTimeout) {
        clearTimeout(this.voiceTimeout);
        this.voiceTimeout = null;
      }
      this.ngZone.run(() => {
        this.isListening = false;
        this.voiceRecognition = null;
      });
    };

    this.voiceRecognition.start();
  }

  stopVoiceSearch() {
    if (this.voiceTimeout) {
      clearTimeout(this.voiceTimeout);
      this.voiceTimeout = null;
    }
    if (this.voiceRecognition) {
      try {
        this.voiceRecognition.stop();
      } catch (e) {
        console.error('Error stopping voice search:', e);
      }
      this.isListening = false;
      this.voiceRecognition = null;
      this.snackbar.show('Voice search stopped.', 'info');
    }
  }
}
