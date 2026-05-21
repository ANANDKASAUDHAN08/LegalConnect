import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BookmarkService, Bookmark } from '../../services/bookmark.service';
import { AuthService } from '../../services/auth.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  bookmarks$!: Observable<Bookmark[]>;

  constructor(
    public bookmarkService: BookmarkService,
    public authService: AuthService
  ) {}

  ngOnInit() {
    this.bookmarks$ = this.bookmarkService.bookmarks$;
  }

  removeBookmark(actId: string, secNum: string) {
    this.bookmarkService.removeBookmark(actId, secNum);
  }
}
