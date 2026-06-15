import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { LegalService, SearchResultItem } from '../../services/legal.service';
import { DatabaseService } from '../../services/database.service';
import { FormsModule } from '@angular/forms';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent implements OnInit {
  searchQuery = '';
  lastQuery = '';
  results: SearchResultItem[] = [];
  loading = false;
  hasSearched = false;
  isOffline = !navigator.onLine;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private legalService: LegalService,
    private db: DatabaseService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit() {
    // Track network status changes in real time
    window.addEventListener('online', () => {
      this.isOffline = false;
      this.snackbar.show('Back online!', 'success');
    });
    window.addEventListener('offline', () => {
      this.isOffline = true;
      this.snackbar.show('You are offline. Searching from local cache.', 'warning');
    });

    // Auto-sync acts into IndexedDB if online and cache is empty
    if (navigator.onLine) {
      this.db.getCount().then(count => {
        if (count === 0) {
          this.legalService.getActs().subscribe({
            next: (res) => this.db.syncActs(res.data),
            error: () => {} // Silently fail sync
          });
        }
      });
    }

    this.route.queryParams.subscribe(params => {
      const q = params['q'];
      if (q) {
        this.searchQuery = q;
        this.executeSearch(q);
      }
    });
  }

  performSearch() {
    if (!this.searchQuery.trim()) return;
    this.router.navigate(['/search'], { queryParams: { q: this.searchQuery } });
  }

  private async executeSearch(query: string) {
    this.loading = true;
    this.hasSearched = true;
    this.lastQuery = query;

    if (this.isOffline) {
      // --- OFFLINE PATH: Query IndexedDB via Dexie ---
      try {
        const localSections = await this.db.searchSections(query);
        const mappedResults: SearchResultItem[] = [];
        
        for (const sec of localSections) {
          const act = await this.db.getActByShortName(sec.actShortName);
          mappedResults.push({
            _id: sec.id?.toString() || sec.section_number,
            section_number: sec.section_number,
            title: sec.title,
            actName: act ? act.actName : sec.actShortName,
            shortName: sec.actShortName,
            year: act ? Number(act.year) : undefined,
            chapterNumber: sec.chapterNumber,
            snippet: sec.content ? sec.content.substring(0, 150) + '...' : ''
          });
        }
        
        this.results = mappedResults;
        this.loading = false;
        if (this.results.length === 0) {
          this.snackbar.show(`No offline results for "${query}"`, 'info');
        } else {
          this.snackbar.show(`Showing ${this.results.length} offline cached result(s)`, 'warning');
        }
      } catch (err) {
        console.error(err);
        this.results = [];
        this.loading = false;
        this.snackbar.show('Offline search failed. No local cache available.', 'error');
      }
    } else {
      // --- ONLINE PATH: Query the API ---
      this.legalService.searchLaws(query).subscribe({
        next: (res) => {
          this.results = res.data || [];
          this.loading = false;
          if (this.results.length === 0) {
            this.snackbar.show(`No results found for "${query}"`, 'info');
          }
        },
        error: () => {
          // API failed — try IndexedDB as a fallback
          this.snackbar.show('API unavailable. Trying local cache...', 'warning');
          this.db.searchSections(query).then(async (localSections) => {
            const mappedResults: SearchResultItem[] = [];
            for (const sec of localSections) {
              const act = await this.db.getActByShortName(sec.actShortName);
              mappedResults.push({
                _id: sec.id?.toString() || sec.section_number,
                section_number: sec.section_number,
                title: sec.title,
                actName: act ? act.actName : sec.actShortName,
                shortName: sec.actShortName,
                year: act ? Number(act.year) : undefined,
                chapterNumber: sec.chapterNumber,
                snippet: sec.content ? sec.content.substring(0, 150) + '...' : ''
              });
            }
            this.results = mappedResults;
            this.loading = false;
          }).catch(() => {
            this.results = [];
            this.loading = false;
            this.snackbar.show('Search failed. Please check your connection.', 'error');
          });
        }
      });
    }
  }

  getCleanChapterTitle(title: string): string {
    if (!title) return '';
    let clean = title.trim().toLowerCase();
    if (clean.startsWith('of the ')) {
      clean = clean.substring(7);
    } else if (clean.startsWith('of ')) {
      clean = clean.substring(3);
    }
    
    const minorWords = ['and', 'or', 'but', 'for', 'of', 'in', 'on', 'at', 'to', 'by', 'the', 'a', 'an', 'its', 'with', 'from', 'as'];
    const words = clean.split(/\s+/);
    return words.map((word, idx) => {
      if (idx === 0 || !minorWords.includes(word)) {
        return word.replace(/[a-z]/i, (char) => char.toUpperCase());
      }
      return word;
    }).join(' ');
  }
}

