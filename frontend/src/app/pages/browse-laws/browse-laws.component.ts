import { Component, OnInit, OnDestroy, NgZone, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgFor, NgIf, NgClass } from '@angular/common';
import { LegalService, BareAct, ApiResponse } from '../../services/legal.service';
import { NotificationService } from '../../services/notification.service';
import { SnackbarService } from '../../services/snackbar.service';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil, delay, Subscription } from 'rxjs';
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
  activeTab: 'featured' | 'library' = 'featured';
  Math = Math;

  // Optimized Precomputed Properties
  filteredActsList: BareAct[] = [];
  aiFilteredActsList: BareAct[] = [];
  libraryFilteredActsList: BareAct[] = [];
  libraryPaginatedActsList: BareAct[] = [];

  // Autocomplete Suggestions
  autocompleteSuggestions: BareAct[] = [];

  libraryPage = 1;
  libraryPageSize = 18;

  // Listen to window resizing to update page size dynamically
  @HostListener('window:resize')
  onResize() {
    this.updateLibraryPageSize();
  }

  private updateLibraryPageSize() {
    const isMobile = window.innerWidth < 768; // 768px matches Tailwind's md breakpoint
    const newPageSize = isMobile ? 10 : 18;

    if (this.libraryPageSize !== newPageSize) {
      this.libraryPageSize = newPageSize;
      this.libraryPage = 1; // Reset to page 1 to prevent indexing out of bounds
    }
  }

  librarySearchQuery = '';
  libraryEnactmentYear: number | null = null;
  librarySortBy: 'name-asc' | 'name-desc' | 'year-desc' | 'year-asc' = 'name-asc';

  // Custom Dropdown Open States
  isYearDropdownOpen = false;
  isSortDropdownOpen = false;

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
  private aiSubscription: Subscription | null = null;

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
    this.updateLibraryPageSize(); // Initial check

    this.legalService.getActs()
      .pipe(delay(1000))
      .subscribe({
        next: (res: ApiResponse<BareAct[]>) => {
          // If the cached list has fewer than 50 acts, detect cache staleness and force refresh
          if (res.data && res.data.length < 50) {
            console.warn(`⚠️ Stale acts cache detected (${res.data.length} acts). Force-refreshing from backend...`);
            this.legalService.getActs(true).subscribe({
              next: (refreshRes: ApiResponse<BareAct[]>) => {
                this.acts = refreshRes.data;
                this.loading = false;
                this.updateFilteredActs();
                this.updateAiFilteredActs();
                this.updateLibraryActs();
              },
              error: () => {
                this.acts = res.data;
                this.loading = false;
                this.updateFilteredActs();
                this.updateAiFilteredActs();
                this.updateLibraryActs();
              }
            });
          } else {
            this.acts = res.data;
            this.loading = false;
            this.updateFilteredActs();
            this.updateAiFilteredActs();
            this.updateLibraryActs();
          }
        },
        error: () => { this.error = 'Could not load acts from the server.'; this.loading = false; }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopVoiceSearch();
    if (this.aiSubscription) {
      this.aiSubscription.unsubscribe();
    }
  }

  toggleSearchMode() {
    this.searchMode = this.searchMode === 'keyword' ? 'ai' : 'keyword';
    if (this.aiSubscription) {
      this.aiSubscription.unsubscribe();
      this.aiSubscription = null;
    }
    this.aiAnswer = '';
    this.aiSuggestedActs = [];
    this.aiError = '';
    this.aiQuery = '';
    this.searchQuery = '';
    this.updateFilteredActs();
    this.updateAiFilteredActs();
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
    this.updateAiFilteredActs();

    this.aiSubscription = this.legalService.askLegalQuestion(this.aiQuery.trim()).subscribe({
      next: (res) => {
        this.aiLoading = false;
        this.aiAnswer = res.answer;
        this.aiSuggestedActs = res.suggestedActs;
        this.updateAiFilteredActs();
        this.aiSubscription = null;
      },
      error: () => {
        this.aiLoading = false;
        this.aiError = 'AI could not process your question. Please try keyword search.';
        this.updateAiFilteredActs();
        this.aiSubscription = null;
      }
    });
  }

  stopAiRequest() {
    if (this.aiSubscription) {
      this.aiSubscription.unsubscribe();
      this.aiSubscription = null;
    }
    this.aiLoading = false;
    this.aiAnswer = 'AI analysis was stopped by the user.';
    this.aiSuggestedActs = [];
    this.updateAiFilteredActs();
  }

  clearAiAnswer() {
    this.aiAnswer = '';
    this.aiSuggestedActs = [];
    this.aiError = '';
    this.updateAiFilteredActs();
  }

  openAiSuggestedAct(shortName: string) {
    this.router.navigate(['/laws', shortName]);
  }

  onAiQueryKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.submitAiQuery();
    }
  }

  get totalLibraryPages(): number {
    return Math.ceil(this.libraryFilteredActsList.length / this.libraryPageSize);
  }

  get libraryYears(): number[] {
    const years = this.acts.map(a => a.year);
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }

  changeLibraryPage(page: number) {
    if (page >= 1 && page <= this.totalLibraryPages) {
      this.libraryPage = page;
      this.updateLibraryPaginatedActs();
      const element = document.getElementById('library-section-top');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  toggleYearDropdown() {
    this.isYearDropdownOpen = !this.isYearDropdownOpen;
    this.isSortDropdownOpen = false;
  }

  toggleSortDropdown() {
    this.isSortDropdownOpen = !this.isSortDropdownOpen;
    this.isYearDropdownOpen = false;
  }

  selectYear(year: number | null) {
    this.libraryEnactmentYear = year;
    this.libraryPage = 1;
    this.isYearDropdownOpen = false;
    this.updateLibraryActs();
  }

  selectSort(sortBy: 'name-asc' | 'name-desc' | 'year-desc' | 'year-asc') {
    this.librarySortBy = sortBy;
    this.libraryPage = 1;
    this.isSortDropdownOpen = false;
    this.updateLibraryActs();
  }

  getSortLabel(sortBy: string): string {
    switch (sortBy) {
      case 'name-asc': return 'Alphabetical (A-Z)';
      case 'name-desc': return 'Alphabetical (Z-A)';
      case 'year-desc': return 'Year (Newest First)';
      case 'year-asc': return 'Year (Oldest First)';
      default: return 'Alphabetical (A-Z)';
    }
  }

  @HostListener('document:click', ['$event'])
  onDropdownDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container')) {
      this.isYearDropdownOpen = false;
      this.isSortDropdownOpen = false;
    }
  }

  onSearchQueryChange(query: string) {
    if (this.searchMode === 'ai') {
      this.aiQuery = query;
      return;
    }
    this.searchQuery = query;
    this.updateFilteredActs();
    if (query.trim().length >= 2) {
      const q = query.toLowerCase().trim();
      this.autocompleteSuggestions = this.acts.filter(a =>
        a.actName.toLowerCase().includes(q) ||
        a.shortName.toLowerCase().includes(q) ||
        a.year.toString().includes(q)
      ).slice(0, 6);
    } else {
      this.autocompleteSuggestions = [];
    }
  }

  selectCategory(category: string, clearQuery = false) {
    this.selectedCategory = category;
    if (clearQuery) {
      this.searchQuery = '';
    }
    this.updateFilteredActs();
  }

  onLibrarySearchChange(query: string) {
    this.librarySearchQuery = query;
    this.libraryPage = 1;
    this.updateLibraryActs();
  }

  updateFilteredActs() {
    const featuredShorts = ['Constitution', 'BNS', 'BNSS', 'BSA', 'IPC', 'CrPC', 'IEA', 'CPC', 'MVA', 'NIA', 'HMA', 'IDA'];
    let list = this.acts.filter(a => featuredShorts.includes(a.shortName));

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

    if (!this.searchQuery.trim()) {
      this.filteredActsList = list;
      return;
    }
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredActsList = list.filter(a =>
      a.actName.toLowerCase().includes(q) ||
      a.shortName.toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q)
    );
  }

  updateAiFilteredActs() {
    const featuredShorts = ['Constitution', 'BNS', 'BNSS', 'BSA', 'IPC', 'CrPC', 'IEA', 'CPC', 'MVA', 'NIA', 'HMA', 'IDA'];
    let list = this.acts.filter(a => featuredShorts.includes(a.shortName));
    if (!this.aiSuggestedActs.length) {
      this.aiFilteredActsList = list;
      return;
    }
    const suggested = list.filter(a => this.aiSuggestedActs.includes(a.shortName));
    const rest = list.filter(a => !this.aiSuggestedActs.includes(a.shortName));
    this.aiFilteredActsList = [...suggested, ...rest];
  }

  updateLibraryActs() {
    let list = this.acts;

    if (this.librarySearchQuery.trim()) {
      const q = this.librarySearchQuery.toLowerCase().trim();
      list = list.filter(a =>
        a.actName.toLowerCase().includes(q) ||
        a.shortName.toLowerCase().includes(q) ||
        a.year.toString().includes(q)
      );
    }

    if (this.libraryEnactmentYear) {
      list = list.filter(a => a.year === this.libraryEnactmentYear);
    }

    list = [...list];
    if (this.librarySortBy === 'name-asc') {
      list.sort((a, b) => a.actName.localeCompare(b.actName));
    } else if (this.librarySortBy === 'name-desc') {
      list.sort((a, b) => b.actName.localeCompare(a.actName));
    } else if (this.librarySortBy === 'year-desc') {
      list.sort((a, b) => b.year - a.year);
    } else if (this.librarySortBy === 'year-asc') {
      list.sort((a, b) => a.year - b.year);
    }

    this.libraryFilteredActsList = list;
    this.updateLibraryPaginatedActs();
  }

  updateLibraryPaginatedActs() {
    const start = (this.libraryPage - 1) * this.libraryPageSize;
    this.libraryPaginatedActsList = this.libraryFilteredActsList.slice(start, start + this.libraryPageSize);
  }

  selectSuggestion(shortName: string) {
    this.router.navigate(['/laws', shortName]);
    this.searchQuery = '';
    this.autocompleteSuggestions = [];
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
