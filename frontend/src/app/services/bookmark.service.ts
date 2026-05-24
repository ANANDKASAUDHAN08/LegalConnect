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

  addBookmark(actShortName: string, chapterNumber: string, section: Section) {
    const current = this.bookmarksSubject.value;
    if (current.some(b => b.actShortName === actShortName && b.section.section_number === section.section_number)) {
      return;
    }

    const newBookmark: Bookmark = {
      actShortName,
      chapterNumber,
      section,
      savedAt: Date.now()
    };

    if (this.isLoggedIn) {
      const payload = {
        actShortName,
        chapterNumber,
        sectionNumber: section.section_number,
        sectionTitle: section.title,
        sectionContent: section.content
      };
      this.http.post<any>(this.apiUrl, payload, { withCredentials: true }).subscribe({
        next: () => {
          this.bookmarksSubject.next([...current, newBookmark]);
          this.snackbar.show('Section bookmarked to cloud!', 'success');
        },
        error: (err) => {
          this.snackbar.show(err.error?.message || err.error || 'Failed to save bookmark.', 'error');
        }
      });
    } else {
      const updated = [...current, newBookmark];
      this.saveLocalBookmarks(updated);
      this.snackbar.show('Section bookmarked locally!', 'success');
    }
  }

  removeBookmark(actShortName: string, sectionNumber: string) {
    const current = this.bookmarksSubject.value;
    if (this.isLoggedIn) {
      this.http.delete<any>(`${this.apiUrl}/${actShortName}/${sectionNumber}`, { withCredentials: true }).subscribe({
        next: () => {
          const updated = current.filter(b => !(b.actShortName === actShortName && b.section.section_number === sectionNumber));
          this.bookmarksSubject.next(updated);
          this.snackbar.show('Bookmark removed from cloud.', 'info');
        },
        error: () => {
          this.snackbar.show('Failed to remove bookmark.', 'error');
        }
      });
    } else {
      const updated = current.filter(b => !(b.actShortName === actShortName && b.section.section_number === sectionNumber));
      this.saveLocalBookmarks(updated);
      this.snackbar.show('Removed from local library.', 'info');
    }
  }

  isBookmarked(actShortName: string, sectionNumber: string): boolean {
    return this.bookmarksSubject.value.some(b => b.actShortName === actShortName && b.section.section_number === sectionNumber);
  }
}
