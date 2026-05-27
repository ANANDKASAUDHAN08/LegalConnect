import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { BookmarkService, Bookmark } from '../../../services/bookmark.service';
import { AuthService, UserProfile } from '../../../services/auth.service';
import { LawyerService, Consultation } from '../../../services/lawyer.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.scss']
})
export class ClientDashboardComponent implements OnInit {
  bookmarks$!: Observable<Bookmark[]>;
  currentUser: UserProfile | null = null;
  inquiries: Consultation[] = [];
  loadingInquiries = false;
  activeTab = 'bookmarks';

  constructor(
    public bookmarkService: BookmarkService,
    public authService: AuthService,
    private lawyerService: LawyerService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.bookmarks$ = this.bookmarkService.bookmarks$;
    
    // Support switching tab if query param matches
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'inquiries' || params['tab'] === 'bookmarks') {
        this.activeTab = params['tab'];
      }
    });

    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadInquiries();
      }
    });
  }

  loadInquiries() {
    this.loadingInquiries = true;
    this.lawyerService.getSentInquiries().subscribe({
      next: (res) => {
        this.inquiries = res;
        this.loadingInquiries = false;
      },
      error: () => {
        this.loadingInquiries = false;
      }
    });
  }

  removeBookmark(actId: string, secNum: string) {
    this.bookmarkService.removeBookmark(actId, secNum);
  }
}
