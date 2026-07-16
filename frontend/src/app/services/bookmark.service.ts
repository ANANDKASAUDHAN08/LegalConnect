import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { Section } from './legal.service';
import { SnackbarService } from './snackbar.service';
import { AuthService } from './auth.service';

export interface Bookmark {
  actShortName: string;
  chapterNumber: string;
  section: Section;
  notes?: string;
  collectionName?: string;
  savedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class BookmarkService {
  private apiUrl = '/api/bookmark';

  // RxJS backing fields for backwards compatibility
  private bookmarksSubject = new BehaviorSubject<Bookmark[]>([]);
  bookmarks$ = this.bookmarksSubject.asObservable();

  // Modern Signals State Store
  private bookmarksSignal = signal<Bookmark[]>([]);
  bookmarks = this.bookmarksSignal.asReadonly();
  initialLoadComplete = signal(false);

  private isLoggedIn = false;

  constructor(
    private http: HttpClient,
    private snackbar: SnackbarService,
    private auth: AuthService,
    private router: Router
  ) {
    this.auth.isLoggedIn$.subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      this.loadBookmarks();
    });
  }

  private loadBookmarks() {
    if (this.isLoggedIn) {
      this.initialLoadComplete.set(false);
      this.http.get<Bookmark[]>(this.apiUrl, { withCredentials: true }).subscribe({
        next: (bookmarks) => {
          const sorted = (bookmarks || []).sort((a, b) => b.savedAt - a.savedAt);
          this.bookmarksSignal.set(sorted);
          this.bookmarksSubject.next(sorted);
          this.initialLoadComplete.set(true);
        },
        error: () => {
          this.bookmarksSignal.set([]);
          this.bookmarksSubject.next([]);
          this.initialLoadComplete.set(true);
        }
      });
    } else {
      this.bookmarksSignal.set([]);
      this.bookmarksSubject.next([]);
      this.initialLoadComplete.set(true);
    }
  }

  addBookmark(actShortName: string, chapterNumber: string, section: Section, collectionName?: string) {
    if (!this.isLoggedIn) {
      this.snackbar.show(
        'Login to save laws to your case pack dossier',
        'warning',
        5000,
        'Login →',
        () => this.router.navigate(['/login'])
      );
      return;
    }

    const current = this.bookmarksSignal();
    if (current.some(b => b.actShortName === actShortName && b.section.section_number === section.section_number)) {
      return;
    }

    const newBookmark: Bookmark = {
      actShortName,
      chapterNumber,
      section,
      collectionName,
      savedAt: Date.now()
    };

    const payload = {
      actShortName,
      chapterNumber,
      sectionNumber: section.section_number,
      sectionTitle: section.title,
      sectionContent: section.content,
      collectionName
    };

    this.http.post<any>(this.apiUrl, payload, { withCredentials: true }).subscribe({
      next: () => {
        const updated = [...current, newBookmark];
        this.bookmarksSignal.set(updated);
        this.bookmarksSubject.next(updated);
        this.snackbar.show(collectionName ? `Section saved to folder "${collectionName}" successfully.` : 'Section saved to General Reference successfully.', 'success');
      },
      error: (err) => {
        this.snackbar.show(err.error?.message || err.error || 'Failed to save section.', 'error');
      }
    });
  }

  removeBookmark(actShortName: string, sectionNumber: string) {
    if (!this.isLoggedIn) {
      return;
    }

    const current = this.bookmarksSignal();
    this.http.delete<any>(`${this.apiUrl}/${actShortName}/${sectionNumber}`, { withCredentials: true }).subscribe({
      next: () => {
        const updated = current.filter(b => !(b.actShortName === actShortName && b.section.section_number === sectionNumber));
        this.bookmarksSignal.set(updated);
        this.bookmarksSubject.next(updated);
        this.snackbar.show('Section removed from library successfully.', 'info');
      },
      error: () => {
        this.snackbar.show('Failed to remove section.', 'error');
      }
    });
  }

  updateBookmarkMetadata(
    actShortName: string,
    sectionNumber: string,
    notes?: string,
    collectionName?: string,
    silent = false,
    onSuccess?: () => void,
    onError?: () => void
  ) {
    if (!this.isLoggedIn) {
      if (onError) onError();
      return;
    }

    const payload = { notes, collectionName };
    this.http.put<any>(`${this.apiUrl}/${actShortName}/${sectionNumber}`, payload, { withCredentials: true }).subscribe({
      next: () => {
        const current = this.bookmarksSignal();
        const idx = current.findIndex(b => b.actShortName === actShortName && b.section.section_number === sectionNumber);
        if (idx !== -1) {
          const updated = [...current];
          updated[idx] = {
            ...updated[idx],
            notes: notes,
            collectionName: collectionName
          };
          this.bookmarksSignal.set(updated);
          this.bookmarksSubject.next(updated);
        }
        if (!silent) {
          this.snackbar.show('Section notes updated successfully.', 'success');
        }
        if (onSuccess) onSuccess();
      },
      error: () => {
        if (!silent) {
          this.snackbar.show('Failed to update section notes.', 'error');
        }
        if (onError) onError();
      }
    });
  }

  getPaginatedBookmarks(params: {
    collectionName?: string;
    actFilter?: string;
    searchQuery?: string;
    sortBy?: string;
    page: number;
    pageSize: number;
  }): Observable<{
    success: boolean;
    data: Bookmark[];
    pagination: {
      totalItems: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
  }> {
    let url = `${this.apiUrl}/paginated?page=${params.page}&pageSize=${params.pageSize}`;
    if (params.collectionName) url += `&collectionName=${encodeURIComponent(params.collectionName)}`;
    if (params.actFilter) url += `&actFilter=${encodeURIComponent(params.actFilter)}`;
    if (params.searchQuery) url += `&searchQuery=${encodeURIComponent(params.searchQuery)}`;
    if (params.sortBy) url += `&sortBy=${encodeURIComponent(params.sortBy)}`;

    return this.http.get<any>(url, { withCredentials: true });
  }

  isBookmarked(actShortName: string, sectionNumber: string): boolean {
    if (!this.isLoggedIn) {
      return false;
    }
    return this.bookmarksSignal().some(b => b.actShortName === actShortName && b.section.section_number === sectionNumber);
  }
}