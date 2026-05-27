import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, UserProfile } from '../../../services/auth.service';
import { LawyerService, Consultation } from '../../../services/lawyer.service';

@Component({
  selector: 'app-advocate-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './advocate-dashboard.component.html',
  styleUrls: ['./advocate-dashboard.component.scss']
})
export class AdvocateDashboardComponent implements OnInit {
  currentUser: UserProfile | null = null;
  inquiries: Consultation[] = [];
  loadingInquiries = false;

  constructor(
    public authService: AuthService,
    private lawyerService: LawyerService
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user) {
        this.loadInquiries();
      }
    });
  }

  loadInquiries() {
    this.loadingInquiries = true;
    this.lawyerService.getReceivedInquiries().subscribe({
      next: (res) => {
        this.inquiries = res;
        this.loadingInquiries = false;
      },
      error: () => {
        this.loadingInquiries = false;
      }
    });
  }

  updateInquiryStatus(id: number, status: string) {
    this.lawyerService.updateInquiryStatus(id, status).subscribe({
      next: () => {
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
}
