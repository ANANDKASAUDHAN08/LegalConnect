import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LawyerService, Consultation } from '../../../../services/lawyer.service';
import { UserProfile } from '../../../../services/auth.service';
import { SnackbarService } from '../../../../services/snackbar.service';

@Component({
  selector: 'app-my-cases-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './my-cases-tab.component.html'
})
export class MyCasesTabComponent implements OnInit {
  @Input() profile!: UserProfile;
  cases: Consultation[] = [];
  loading = true;

  constructor(
    private lawyerService: LawyerService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit() {
    this.loadCases();
  }

  loadCases() {
    this.loading = true;
    const request = this.profile.role === 'Lawyer'
      ? this.lawyerService.getReceivedInquiries()
      : this.lawyerService.getSentInquiries();

    request.subscribe({
      next: (res) => {
        this.cases = res;
        this.loading = false;
      },
      error: () => {
        this.snackbar.show('Failed to fetch active inquiries.', 'error');
        this.loading = false;
      }
    });
  }

  updateStatus(c: Consultation, newStatus: string) {
    this.lawyerService.updateInquiryStatus(c.id, newStatus).subscribe({
      next: () => {
        c.status = newStatus;
        this.snackbar.show(`Inquiry status updated to ${newStatus}!`, 'success');
      },
      error: () => {
        this.snackbar.show('Failed to update status.', 'error');
      }
    });
  }

  getStatusBadgeColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'contacted':
        return 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40';
      case 'pending':
        return 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40';
      case 'closed':
        return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700/50';
      default:
        return 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/45';
    }
  }
}
