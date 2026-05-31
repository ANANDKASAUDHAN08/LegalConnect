import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BookmarkService, Bookmark } from '../../../../services/bookmark.service';
import { Observable } from 'rxjs';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-saved-laws-tab',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './saved-laws-tab.component.html'
})
export class SavedLawsTabComponent implements OnInit {
  bookmarks$!: Observable<Bookmark[]>;

  constructor(private bookmarkService: BookmarkService) {}

  ngOnInit() {
    this.bookmarks$ = this.bookmarkService.bookmarks$;
  }

  removeBookmark(actShortName: string, sectionNumber: string) {
    this.bookmarkService.removeBookmark(actShortName, sectionNumber);
  }
}
