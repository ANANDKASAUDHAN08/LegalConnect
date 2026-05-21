import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Section } from './legal.service';
import { SnackbarService } from './snackbar.service';

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
  private bookmarksSubject = new BehaviorSubject<Bookmark[]>(this.loadBookmarks());
  
  bookmarks$ = this.bookmarksSubject.asObservable();

  constructor(private snackbar: SnackbarService) {}

  private loadBookmarks(): Bookmark[] {
    const data = localStorage.getItem(this.bookmarksKey);
    return data ? JSON.parse(data) : [];
  }

  private saveBookmarks(bookmarks: Bookmark[]) {
    localStorage.setItem(this.bookmarksKey, JSON.stringify(bookmarks));
    this.bookmarksSubject.next(bookmarks);
  }

  addBookmark(actShortName: string, chapterNumber: string, section: Section) {
    const current = this.loadBookmarks();
    // Check if already exists
    if (!current.some(b => b.actShortName === actShortName && b.section.section_number === section.section_number)) {
      current.push({
        actShortName,
        chapterNumber,
        section,
        savedAt: Date.now()
      });
      this.saveBookmarks(current);
      this.snackbar.show('Section bookmarked!', 'success');
    }
  }

  removeBookmark(actShortName: string, sectionNumber: string) {
    let current = this.loadBookmarks();
    current = current.filter(b => !(b.actShortName === actShortName && b.section.section_number === sectionNumber));
    this.saveBookmarks(current);
    this.snackbar.show('Removed from library.', 'info');
  }

  isBookmarked(actShortName: string, sectionNumber: string): boolean {
    return this.loadBookmarks().some(b => b.actShortName === actShortName && b.section.section_number === sectionNumber);
  }
}
