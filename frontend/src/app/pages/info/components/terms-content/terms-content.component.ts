import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { FeedbackService } from '../../../../services/feedback.service';

@Component({
  selector: 'app-terms-content',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective],
  templateUrl: './terms-content.component.html'
})
export class TermsContentComponent implements OnInit, OnDestroy {
  showPlainEnglish = false;
  searchQuery = '';
  activeChangelogYear: 'all' | '2026' | '2025' = 'all';

  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;

  changelogYears: { value: 'all' | '2026' | '2025'; label: string }[] = [
    { value: 'all', label: 'All Revisions' },
    { value: '2026', label: '2026' },
    { value: '2025', label: '2025' }
  ];

  feedbackSubmitted = false;
  lastFeedbackResponse: boolean | null = null;
  private readonly feedbackKey = 'lc_feedback_terms';

  // Section content data for dynamic rendering & search highlighting
  sections = [
    {
      id: 'acceptance',
      title: '1. Acceptance of Terms',
      legalText: `By accessing, browsing, or registering an account on LegalConnect, you agree to comply with and be bound by these Terms of Service, all applicable laws, and regulations in India. If you do not agree with any of these terms, you are prohibited from using or accessing this platform. The materials contained in this website are protected by applicable copyright and trademark law.`,
      plainEnglish: `By using LegalConnect, you agree to follow our rules and Indian laws. If you don't agree with the rules, please do not use the platform.`
    },
    {
      id: 'eligibility',
      title: '2. Account Registration & Roles',
      legalText: `Users registering on the platform must select the appropriate role: Client or Lawyer. Advocates registering a lawyer workstation must possess active registration with the Bar Council of India or State Bar Councils. Providing false registration credentials, practicing details, or misleading success rates will result in immediate profile deactivation, workspace suspension, and referral to the respective Bar Council authority.`,
      plainEnglish: `You must sign up as a Client or a verified Lawyer. If you are a lawyer, you must have an active Bar Council license. Providing fake credentials will get your account permanently banned.`
    },
    {
      id: 'disclaimer',
      title: '3. Legal Directory Disclaimer',
      legalText: `LegalConnect is an independent directory and educational reference platform, not a law firm or legal services agency. Listing on the platform does not constitute an attorney referral or endorsement by us. Consultation requests sent via the platform do not establish an attorney-client privilege or contract until explicitly agreed upon in writing directly with the advocate. The Indian Laws reference library, document templates, and rights checker are for informational purposes only and do not replace professional legal advice.`,
      plainEnglish: `We are a lawyer directory and information library, not a law firm. Using our site or contacting a lawyer through it does not create a formal lawyer-client relationship, and our guides are not official legal advice.`
    },
    {
      id: 'conduct',
      title: '4. Code of Conduct',
      legalText: `Users agree not to: post defamatory, abusive, or obscene reviews; submit fake contact queries; scrape legislative documents or lawyer listings; or impersonate legal professionals or clients. We reserve the right to remove any review, client query, or user profile that violates this code of conduct, and cooperate with law enforcement authorities in legal disputes.`,
      plainEnglish: `Be respectful. Do not post fake reviews, spam lawyers, copy our database, or pretend to be someone else. We will remove anyone who breaks this rule.`
    },
    {
      id: 'liability',
      title: '5. Limitation of Liability',
      legalText: `LegalConnect, its developers, and partners shall not be held liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the platform services, disputes arising between clients and advocates contacted via the directory, or any inaccuracies in the seeded Bare Acts reference library.`,
      plainEnglish: `We are not responsible if something goes wrong, if you lose data, or if you have a disagreement with a lawyer you found through our directory.`
    },
    {
      id: 'jurisdiction',
      title: '6. Governing Law & Jurisdiction',
      legalText: `These terms and conditions are governed by and construed in accordance with the laws of the Republic of India. Any legal disputes arising out of the platform's services shall be subject to the exclusive jurisdiction of the courts located in New Delhi, India.`,
      plainEnglish: `These terms follow Indian laws. Any legal disagreements must be handled exclusively in courts located in New Delhi.`
    }
  ];

  // Changelog entries
  changelog = [
    {
      date: '18 Jul 2026',
      year: '2026',
      type: 'Updated',
      description: 'Aligned lawyer workspace verification clauses with Bar Council of India digital advertisement guidelines.',
      badgeClass: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-500/20'
    },
    {
      date: '12 Jan 2026',
      year: '2026',
      type: 'Security',
      description: 'Restructured database access rules to conform strictly to India DPDP Act 2023 requirements.',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/20'
    },
    {
      date: '14 Oct 2025',
      year: '2025',
      type: 'Initial Release',
      description: 'Published platform directory guidelines and lawyer workstation terms of service.',
      badgeClass: 'bg-slate-500/10 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400 border border-slate-500/20'
    }
  ];

  constructor(
    private snackbar: SnackbarService,
    private feedbackService: FeedbackService,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(query => {
      this.searchQuery = query;
    });

    // Restore persisted feedback state for terms page
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.feedbackKey);
      if (stored !== null) {
        this.feedbackSubmitted = true;
        this.lastFeedbackResponse = stored === 'true';
      }
    }
  }

  get filteredChangelog() {
    if (this.activeChangelogYear === 'all') return this.changelog;
    return this.changelog.filter(item => item.year === this.activeChangelogYear);
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = input.value;
    this.searchQuery = val;
    this.searchSubject.next(val);
  }

  ngOnDestroy() {
    if (this.searchSub) {
      this.searchSub.unsubscribe();
    }
  }

  clearSearch() {
    this.searchQuery = '';
  }

  // Scroll to a specific section on the page
  scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update hash in URL silently
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', `${window.location.pathname}#${id}`);
      }
      // Access parent active section if possible (handled by intersection observer)
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

  // Highlights matched keywords inside target text securely
  getHighlightedText(text: string): SafeHtml {
    if (!this.searchQuery || this.searchQuery.trim().length < 2) return text;

    const escapedQuery = this.searchQuery.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const highlighted = text.replace(
      regex,
      `<mark class="bg-amber-400/35 text-amber-900 dark:text-amber-200 font-black px-1.5 py-0.5 rounded-md border border-amber-500/40 shadow-xs">$1</mark>`
    );
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }

  submitFeedback(helpful: boolean) {
    this.feedbackService.submitFeedback('terms', helpful).subscribe({
      next: () => {
        this.feedbackSubmitted = true;
        this.lastFeedbackResponse = helpful;
        if (typeof window !== 'undefined') {
          localStorage.setItem(this.feedbackKey, String(helpful));
        }
        if (helpful) {
          this.snackbar.show('Thank you! Glad we could help.', 'success');
        } else {
          this.snackbar.show('Thank you for your feedback. We will review this policy.', 'info');
        }
      },
      error: () => {
        this.feedbackSubmitted = true;
        this.lastFeedbackResponse = helpful;
        if (typeof window !== 'undefined') {
          localStorage.setItem(this.feedbackKey, String(helpful));
        }
        this.snackbar.show('Thank you for your feedback!', 'success');
      }
    });
  }

  resetFeedback() {
    this.feedbackSubmitted = false;
    this.lastFeedbackResponse = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.feedbackKey);
    }
  }

  trackByDate(index: number, item: any) {
    return item.date;
  }

  trackById(index: number, item: any) {
    return item.id;
  }

  trackByYear(index: number, item: { value: string }) {
    return item.value;
  }
}