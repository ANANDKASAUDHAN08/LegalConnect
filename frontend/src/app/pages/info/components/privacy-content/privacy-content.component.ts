import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { AuthService } from '../../../../services/auth.service';
import { FeedbackService } from '../../../../services/feedback.service';

@Component({
  selector: 'app-privacy-content',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective],
  templateUrl: './privacy-content.component.html'
})
export class PrivacyContentComponent implements OnInit {
  feedbackSubmitted = false;
  lastFeedbackResponse: boolean | null = null;
  dossierRequested = false;

  private readonly feedbackKey = 'lc_feedback_privacy';

  consentStatus = 'Required Only';

  constructor(
    private snackbar: SnackbarService,
    private authService: AuthService,
    private feedbackService: FeedbackService
  ) { }

  ngOnInit() {
    this.dossierRequested = false;

    // Precompute consent status
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('cookie-preferences');
      if (!raw) {
        this.consentStatus = 'Pending Preferences';
      } else {
        try {
          const parsed = JSON.parse(raw);
          this.consentStatus = parsed.analytics ? 'Analytics Enabled' : 'Required Only';
        } catch {
          this.consentStatus = 'Required Only';
        }
      }
    }

    // Restore persisted feedback state
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.feedbackKey);
      if (stored !== null) {
        this.feedbackSubmitted = true;
        this.lastFeedbackResponse = stored === 'true';
      }
    }
  }

  copySectionLink(id: string) {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackbar.show('Section anchor link copied to clipboard!', 'success');
    }).catch(() => {
      this.snackbar.show('Failed to copy section link.', 'error');
    });
  }

  submitFeedback(helpful: boolean) {
    this.feedbackService.submitFeedback('privacy', helpful).subscribe({
      next: () => {
        this.feedbackSubmitted = true;
        this.lastFeedbackResponse = helpful;
        localStorage.setItem(this.feedbackKey, String(helpful));
        if (helpful) {
          this.snackbar.show('Thank you! Glad we could help.', 'success');
        } else {
          this.snackbar.show('Thank you for your feedback. We will review this policy.', 'info');
        }
      },
      error: () => {
        this.feedbackSubmitted = true;
        this.lastFeedbackResponse = helpful;
        localStorage.setItem(this.feedbackKey, String(helpful));
        this.snackbar.show('Thank you for your feedback!', 'success');
      }
    });
  }

  resetFeedback() {
    // Clear localStorage so refresh shows fresh Yes/No buttons.
    // The DB keeps the old vote until the user submits a new one (upsert).
    this.feedbackSubmitted = false;
    this.lastFeedbackResponse = null;
    localStorage.removeItem(this.feedbackKey);
  }

  requestDataDossier() {
    this.authService.downloadDataDossier().subscribe({
      next: (blob) => {
        this.dossierRequested = true;
        
        // Trigger browser file download
        if (typeof window !== 'undefined') {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'legalconnect_user_data_export.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }

        this.snackbar.show('Subject Access Request completed! Your personal data archive has been downloaded.', 'success');
      },
      error: (err) => {
        console.error('SAR failed:', err);
        if (err.status === 401) {
          this.snackbar.show('Please log in first to request your personal data archive.', 'error');
        } else {
          this.snackbar.show('Failed to compile your data dossier. Please try again later.', 'error');
        }
      }
    });
  }
}