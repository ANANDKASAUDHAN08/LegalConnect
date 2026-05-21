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
        const localResults = await this.db.searchActs(query);
        this.results = localResults.map(act => ({
          _id: act.shortName,
          actName: act.actName,
          shortName: act.shortName,
          year: Number(act.year),
          description: act.description,
          chapters: []
        }));
        this.loading = false;
        if (this.results.length === 0) {
          this.snackbar.show(`No offline results for "${query}"`, 'info');
        } else {
          this.snackbar.show(`Showing ${this.results.length} offline cached result(s)`, 'warning');
        }
      } catch {
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
          this.db.searchActs(query).then(localResults => {
            this.results = localResults.map(act => ({
              _id: act.shortName,
              actName: act.actName,
              shortName: act.shortName,
              year: Number(act.year),
              description: act.description,
              chapters: []
            }));
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
}

