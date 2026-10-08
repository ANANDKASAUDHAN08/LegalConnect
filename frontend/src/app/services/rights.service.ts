import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { SnackbarService } from './snackbar.service';
import { IconName } from '../components/icon/icon.types';

export interface StatutoryBasis {
  actName: string;
  shortAct: string;
  sections: string[];
  actUrl: string;
}

export interface EmergencyHelpline {
  name: string;
  number: string;
  description: string;
}

export interface StatutoryRight {
  id: string;
  slug: string;
  title: string;
  category: string;
  icon: IconName;
  summary: string;
  statutoryBasis: StatutoryBasis;
  keyProtections: string[];
  actionableSteps: string[];
  legalRemedy: string;
  emergencyHelpline?: EmergencyHelpline;
  penaltiesForViolation?: string;
  frequentlyAskedQuestions?: Array<{ question: string; answer: string }>;
  verifiedDate: string;
  isPopular?: boolean;
}

export interface RightsCategoryCount {
  name: string;
  count: number;
}

export interface RightsApiResponse {
  success: boolean;
  totalCount: number;
  categories: RightsCategoryCount[];
  data: StatutoryRight[];
}

@Injectable({ providedIn: 'root' })
export class RightsService {
  private http = inject(HttpClient);
  private snackbar = inject(SnackbarService);
  private apiUrl = '/api/info/rights';
  private readonly bookmarkKey = 'lc_bookmarked_rights';

  // Signals
  rights = signal<StatutoryRight[]>([]);
  categories = signal<RightsCategoryCount[]>([]);
  isLoading = signal<boolean>(false);
  bookmarkedIds = signal<string[]>([]);
  activeCategory = signal<string>('All');
  searchQuery = signal<string>('');

  constructor() {
    this.loadBookmarks();
  }

  private loadBookmarks() {
    if (typeof window === 'undefined') return;
    try {
      const data = localStorage.getItem(this.bookmarkKey);
      if (data) {
        this.bookmarkedIds.set(JSON.parse(data));
      }
    } catch {
      this.bookmarkedIds.set([]);
    }
  }

  private saveBookmarks() {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.bookmarkKey, JSON.stringify(this.bookmarkedIds()));
  }

  isBookmarked(id: string): boolean {
    return this.bookmarkedIds().includes(id);
  }

  toggleBookmark(id: string, title: string) {
    const current = this.bookmarkedIds();
    if (current.includes(id)) {
      this.bookmarkedIds.set(current.filter(item => item !== id));
      this.snackbar.show(`Removed "${title}" from saved rights.`, 'info');
    } else {
      this.bookmarkedIds.set([...current, id]);
      this.snackbar.show(`Saved "${title}" to your bookmarked rights.`, 'success');
    }
    this.saveBookmarks();
  }

  fetchRights(category: string = 'All', query: string = '', sort: string = 'popular'): Observable<RightsApiResponse> {
    this.isLoading.set(true);

    let url = `${this.apiUrl}?category=${encodeURIComponent(category)}&sort=${encodeURIComponent(sort)}`;
    if (query) {
      url += `&q=${encodeURIComponent(query)}`;
    }

    return this.http.get<RightsApiResponse>(url).pipe(
      tap(res => {
        if (res && res.success && Array.isArray(res.data)) {
          this.rights.set(res.data);
          this.categories.set(res.categories || []);
        }
        this.isLoading.set(false);
      }),
      catchError(err => {
        console.warn('Unable to load statutory rights from backend; check connection.', err);
        this.isLoading.set(false);
        return of({
          success: false,
          totalCount: 0,
          categories: [],
          data: []
        });
      })
    );
  }
}