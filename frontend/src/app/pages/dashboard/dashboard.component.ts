import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BookmarkService, Bookmark } from '../../services/bookmark.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { LawyerService, Consultation } from '../../services/lawyer.service';
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
  currentUser: UserProfile | null = null;
  inquiries: Consultation[] = [];
  loadingInquiries = false;
  activeTab = 'bookmarks';

  constructor(
    public bookmarkService: BookmarkService,
    public authService: AuthService,
    private lawyerService: LawyerService
  ) {}

  ngOnInit() {
    this.bookmarks$ = this.bookmarkService.bookmarks$;
    
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadInquiries();
      }
    });
  }

  loadInquiries() {
    if (!this.currentUser) return;
    
    this.loadingInquiries = true;
    if (this.currentUser.role === 'Lawyer') {
      this.lawyerService.getReceivedInquiries().subscribe({
        next: (res) => {
          this.inquiries = res;
          this.loadingInquiries = false;
        },
        error: () => {
          this.loadingInquiries = false;
        }
      });
    } else {
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
  }

  updateInquiryStatus(id: number, status: string) {
    this.lawyerService.updateInquiryStatus(id, status).subscribe({
      next: () => {
        // Find and update status locally
        const inquiry = this.inquiries.find(i => i.id === id);
        if (inquiry) {
          inquiry.status = status;
        }
      }
    });
  }

  get pendingInquiriesCount(): number {
    return this.inquiries.filter(i => i.status === 'Pending').length;
  }

  removeBookmark(actId: string, secNum: string) {
    this.bookmarkService.removeBookmark(actId, secNum);
  }
}
