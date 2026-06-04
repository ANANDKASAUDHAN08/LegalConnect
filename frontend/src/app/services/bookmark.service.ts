import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
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
  private bookmarksKey = 'legalconnect_bookmarks';
  private apiUrl = 'http://localhost:8888/api/bookmark';
  private bookmarksSubject = new BehaviorSubject<Bookmark[]>([]);

  bookmarks$ = this.bookmarksSubject.asObservable();
  private isLoggedIn = false;

  constructor(
    private http: HttpClient,
    private snackbar: SnackbarService,
    private auth: AuthService
  ) {
    this.auth.isLoggedIn$.subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      this.loadBookmarks();
    });

    // Auto-sync bookmarks when user switches back to this browser tab
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.loadBookmarks();
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.loadBookmarks();
        }
      });

      // Storage event for guest mode localStorage sync across tabs
      window.addEventListener('storage', (event) => {
        if (event.key === this.bookmarksKey) {
          this.loadBookmarks();
        }
      });
    }
  }

  private loadBookmarks() {
    if (this.isLoggedIn) {
      this.http.get<Bookmark[]>(this.apiUrl, { withCredentials: true }).subscribe({
        next: (bookmarks) => {
          this.bookmarksSubject.next(bookmarks);
        },
        error: () => {
          this.bookmarksSubject.next(this.loadLocalBookmarks());
        }
      });
    } else {
      this.bookmarksSubject.next(this.loadLocalBookmarks());
    }
  }

  private loadLocalBookmarks(): Bookmark[] {
    const data = localStorage.getItem(this.bookmarksKey);
    return data ? JSON.parse(data) : [];
  }

  private saveLocalBookmarks(bookmarks: Bookmark[]) {
    localStorage.setItem(this.bookmarksKey, JSON.stringify(bookmarks));
    this.bookmarksSubject.next(bookmarks);
  }

  addBookmark(actShortName: string, chapterNumber: string, section: Section, collectionName?: string) {
    const current = this.bookmarksSubject.value;
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

    if (this.isLoggedIn) {
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
          this.bookmarksSubject.next([...current, newBookmark]);
          this.snackbar.show(collectionName ? `Section saved to folder "${collectionName}" successfully.` : 'Section saved to General Reference successfully.', 'success');
        },
        error: (err) => {
          this.snackbar.show(err.error?.message || err.error || 'Failed to save section.', 'error');
        }
      });
    } else {
      const updated = [...current, newBookmark];
      this.saveLocalBookmarks(updated);
      this.snackbar.show(collectionName ? `Section saved to folder "${collectionName}" locally.` : 'Section saved to General Reference locally.', 'success');
    }
  }

  removeBookmark(actShortName: string, sectionNumber: string) {
    const current = this.bookmarksSubject.value;
    if (this.isLoggedIn) {
      this.http.delete<any>(`${this.apiUrl}/${actShortName}/${sectionNumber}`, { withCredentials: true }).subscribe({
        next: () => {
          const updated = current.filter(b => !(b.actShortName === actShortName && b.section.section_number === sectionNumber));
          this.bookmarksSubject.next(updated);
          this.snackbar.show('Section removed from library successfully.', 'info');
        },
        error: () => {
          this.snackbar.show('Failed to remove section.', 'error');
        }
      });
    } else {
      const updated = current.filter(b => !(b.actShortName === actShortName && b.section.section_number === sectionNumber));
      this.saveLocalBookmarks(updated);
      this.snackbar.show('Section removed from library.', 'info');
    }
  }

  updateBookmarkMetadata(actShortName: string, sectionNumber: string, notes?: string, collectionName?: string, silent = false) {
    const payload = { notes, collectionName };
    if (this.isLoggedIn) {
      this.http.put<any>(`${this.apiUrl}/${actShortName}/${sectionNumber}`, payload, { withCredentials: true }).subscribe({
        next: () => {
          const current = this.bookmarksSubject.value;
          const idx = current.findIndex(b => b.actShortName === actShortName && b.section.section_number === sectionNumber);
          if (idx !== -1) {
            const updated = [...current];
            updated[idx] = {
              ...updated[idx],
              notes: notes,
              collectionName: collectionName
            };
            this.bookmarksSubject.next(updated);
          }
          if (!silent) {
            this.snackbar.show('Section notes updated successfully.', 'success');
          }
        },
        error: () => {
          if (!silent) {
            this.snackbar.show('Failed to update section notes.', 'error');
          }
        }
      });
    } else {
      const current = this.bookmarksSubject.value;
      const idx = current.findIndex(b => b.actShortName === actShortName && b.section.section_number === sectionNumber);
      if (idx !== -1) {
        const updated = [...current];
        updated[idx] = {
          ...updated[idx],
          notes: notes,
          collectionName: collectionName
        };
        this.saveLocalBookmarks(updated);
      }
      if (!silent) {
        this.snackbar.show('Section notes updated locally.', 'success');
      }
    }
  }

  isBookmarked(actShortName: string, sectionNumber: string): boolean {
    return this.bookmarksSubject.value.some(b => b.actShortName === actShortName && b.section.section_number === sectionNumber);
  }
}