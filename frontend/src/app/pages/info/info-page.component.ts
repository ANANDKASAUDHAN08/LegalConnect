import { Component, OnInit, OnDestroy, HostListener, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { SnackbarService } from '../../services/snackbar.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { PrivacyContentComponent } from './components/privacy-content/privacy-content.component';
import { TermsContentComponent } from './components/terms-content/terms-content.component';
import { AboutContentComponent } from './components/about-content/about-content.component';
import { HelpContentComponent } from './components/help-content/help-content.component';
import { ScrollService } from '../../services/scroll.service';
import { FeedbackService } from '../../services/feedback.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-info-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TooltipDirective,
    PrivacyContentComponent,
    TermsContentComponent,
    AboutContentComponent,
    HelpContentComponent
  ],
  templateUrl: './info-page.component.html',
  styleUrl: './info-page.component.scss'
})
export class InfoPageComponent implements OnInit, OnDestroy {
  slug = '';
  lastUpdatedDate = '18 Jul 2026';
  isLoading = true;
  private _activeSection = '';
  feedbackSubmitted = false;
  lastFeedbackResponse: boolean | null = null;
  showBackToTop = false;
  isDrawerOpen = false;

  get activeSection(): string {
    return this._activeSection;
  }

  set activeSection(val: string) {
    if (this._activeSection !== val) {
      this._activeSection = val;
      if (val) {
        this.scrollActiveTabIntoView();
      }
    }
  }

  private observer!: IntersectionObserver;
  private observedIds = new Set<string>();

  expandedFaqs: { [key: string]: boolean } = {
    'faq-free': false,
    'faq-dpdp': false,
    'faq-verify': false,
    'faq-views': false,
    'faq-dossier': false
  };

  sectionsMap: { [key: string]: { id: string; name: string }[] } = {
    about: [
      { id: 'mission', name: 'Why LegalConnect' },
      { id: 'how-it-works', name: '4 Pillars of Innovation' },
      { id: 'goals', name: 'Strategic Roadmap' },
      { id: 'core-values', name: 'Core Principles' },
      { id: 'governance', name: 'System Governance' },
      { id: 'leadership', name: 'Platform Milestones' }
    ],
    privacy: [
      { id: 'intro', name: '1. Introduction & DPO' },
      { id: 'data-collected', name: '2. Categories of Data' },
      { id: 'purpose', name: '3. Purpose of Processing' },
      { id: 'principal-rights', name: '4. Rights under DPDP' },
      { id: 'sharing', name: '5. Data Sharing' },
      { id: 'retention', name: '6. Security & Retention' }
    ],
    terms: [
      { id: 'acceptance', name: '1. Acceptance of Terms' },
      { id: 'eligibility', name: '2. Account Registration' },
      { id: 'disclaimer', name: '3. Legal Disclaimer' },
      { id: 'conduct', name: '4. Code of Conduct' },
      { id: 'liability', name: '5. Limitation of Liability' },
      { id: 'jurisdiction', name: '6. Governing Law' }
    ],
    help: [
      { id: 'faq-general', name: 'General FAQs' },
      { id: 'faq-lawyers', name: 'For Advocates' },
      { id: 'faq-research', name: 'Research & Workspaces' },
      { id: 'escalate', name: 'Still Need Help?' }
    ]
  };

  readingTimes: { [key: string]: string } = {
    about: '3 min read',
    privacy: '6 min read',
    terms: '7 min read',
    help: '4 min read'
  };

  feedbackQuestions: { [key: string]: string } = {
    about: 'Was this article helpful?',
    privacy: 'Was this privacy policy clear?',
    terms: 'Were these terms of service clear?',
    help: 'Did this answer your question?'
  };

  // Unified sidebar widget data model — drives the entire sidebar via *ngFor (DRY)
  sidebarWidgets: { [key: string]: {
    title: string;
    description: string;
    ctaLabel: string;
    ctaLink: string;
    ctaIcon: string;
    color: string;        // e.g. 'blue', 'emerald', 'indigo', 'rose'
    darkColor: string;    // dark mode override e.g. 'amber' for privacy
    extraTitle: string;
    extraType: 'badges' | 'key-value' | 'stats';
    extraItems: { icon?: string; label: string; value?: string; highlight?: boolean }[];
  }} = {
    privacy: {
      title: 'DPDP Consent Manager',
      description: 'In compliance with India\'s DPDP Act 2023, you can query or withdraw data consent directly via our Data Protection Officer.',
      ctaLabel: 'Contact Privacy DPO',
      ctaLink: '/contact',
      ctaIcon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      color: 'blue',
      darkColor: 'amber',
      extraTitle: 'Compliance',
      extraType: 'badges',
      extraItems: [
        { icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', label: 'DPDP Act 2023' },
        { icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', label: 'SSL/TLS Encrypted' },
        { icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z', label: 'GCP & Firebase Hosted' },
        { icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636', label: 'Zero Data Sale Policy' }
      ]
    },
    terms: {
      title: 'Verified Workstation',
      description: 'All advocates registered on LegalConnect are validated under State Bar Councils before database seed indexation.',
      ctaLabel: 'Report Non-Compliance',
      ctaLink: '/contact',
      ctaIcon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      color: 'emerald',
      darkColor: 'emerald',
      extraTitle: 'Jurisdiction',
      extraType: 'key-value',
      extraItems: [
        { icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Governing Law', value: 'Republic of India' },
        { icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', label: 'Statute', value: 'IT Act, 2000' },
        { icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3', label: 'Dispute Forum', value: 'Lucknow High Court' }
      ]
    },
    about: {
      title: 'Platform Index',
      description: 'LegalConnect provides open reference access to 850+ Central Bare Acts and legal guidelines across India.',
      ctaLabel: 'Browse Acts Library',
      ctaLink: '/browse-laws',
      ctaIcon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
      color: 'indigo',
      darkColor: 'indigo',
      extraTitle: 'Platform Stats',
      extraType: 'stats',
      extraItems: [
        { label: 'Acts Indexed', value: '850+' },
        { label: 'Cities', value: '35+' },
        { label: 'Advocates', value: '2K+' },
        { label: 'Access', value: '24/7' }
      ]
    },
    help: {
      title: 'Indian Grievance Desk',
      description: 'In compliance with Intermediary Guidelines, reach our designated Grievance DPO officer directly.',
      ctaLabel: 'Contact Support DPO',
      ctaLink: '/contact',
      ctaIcon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z',
      color: 'rose',
      darkColor: 'rose',
      extraTitle: 'Support',
      extraType: 'key-value',
      extraItems: [
        { label: 'Avg. Response', value: '< 24 hrs', highlight: true },
        { label: 'Desk Hours', value: 'Mon–Sat' },
        { label: 'Priority', value: 'Email & Form' },
        { label: 'Language', value: 'EN · HI' }
      ]
    }
  };

  pageBadges: { [key: string]: string } = {
    about: 'About LegalConnect',
    privacy: 'Official Platform Policy',
    terms: 'Official Terms of Service',
    help: 'Help Center & FAQs'
  };

  lastUpdatedDates: { [key: string]: string } = {
    about: '10 Jul 2026',
    privacy: '18 Jul 2026',
    terms: '15 Jul 2026',
    help: '20 Jul 2026'
  };

  // Precomputed properties (replaces expensive getters)
  currentSections: { id: string; name: string }[] = [];
  currentReadingTime = '5 min read';
  currentFeedbackQuestion = 'Was this article helpful?';
  currentWidget: typeof this.sidebarWidgets['about'] | null = null;
  currentBadge = 'Official Platform Policy';
  currentLastUpdated = '18 Jul 2026';
  isScrolled = false;

  private routeSub!: Subscription;
  private scrollSub!: Subscription;

  constructor(
    private route: ActivatedRoute,
    private snackbar: SnackbarService,
    private scrollService: ScrollService,
    private feedbackService: FeedbackService,
    private authService: AuthService,
    private ngZone: NgZone,
    private titleService: Title,
    private metaService: Meta
  ) { }

  ngOnInit() {
    this.routeSub = this.route.url.subscribe(urlSegments => {
      const path = urlSegments[0]?.path || 'about';
      this.slug = path;

      // Precompute static properties on route change
      this.currentSections = this.sectionsMap[this.slug] || [];
      this.currentReadingTime = this.readingTimes[this.slug] || '5 min read';
      this.currentFeedbackQuestion = this.feedbackQuestions[this.slug] || 'Was this article helpful?';
      this.currentWidget = this.sidebarWidgets[this.slug] || null;
      this.currentBadge = this.pageBadges[this.slug] || 'Official Platform Policy';
      this.currentLastUpdated = this.lastUpdatedDates[this.slug] || '18 Jul 2026';

      // Dynamic SEO Title & Meta Tag Updates
      this.updateSeoMeta(path);

      this.isLoading = true;
      this.activeSection = '';

      // Restore persisted feedback state for this page
      const feedbackKey = `lc_feedback_${path}`;
      const stored = localStorage.getItem(feedbackKey);
      if (stored !== null) {
        this.feedbackSubmitted = true;
        this.lastFeedbackResponse = stored === 'true';
      } else {
        this.feedbackSubmitted = false;
        this.lastFeedbackResponse = null;
      }

      // Reset Accordion expansion states
      Object.keys(this.expandedFaqs).forEach(key => this.expandedFaqs[key] = false);

      setTimeout(() => {
        this.isLoading = false;
        const hash = window.location.hash;
        if (hash) {
          const id = hash.replace('#', '');
          if (id !== 'intro') {
            this.scrollToSection(id);
          } else {
            window.scrollTo({ top: 0 });
          }
        }
      }, 300);
    });

    // Subscribe to isScrolled once
    this.scrollSub = this.scrollService.isScrolled$.subscribe(val => {
      this.isScrolled = val;
    });

    // Run scroll listener outside Angular zone to optimize performance
    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onWindowScrollBound, { passive: true });
    });
  }

  private updateSeoMeta(slug: string) {
    const titles: Record<string, string> = {
      help: 'LegalConnect — Help Center & Statutory FAQs',
      terms: 'LegalConnect — Terms of Service & Intermediary Policy',
      privacy: 'LegalConnect — Privacy Policy & DPDP Act 2023 Compliance',
      about: 'LegalConnect — About Us & Platform Vision'
    };

    const descriptions: Record<string, string> = {
      help: 'Search LegalConnect knowledge base for advocate verification guidance, DPDP privacy rights, Bare Acts reference, and zero-commission rules.',
      terms: 'Read LegalConnect statutory terms of service, Bar Council verification policies, and intermediary liability disclosures under IT Act 2000.',
      privacy: 'Learn how LegalConnect complies with DPDP Act 2023, personal data protection, subject access rights, and data dossier exports.',
      about: 'Discover LegalConnect’s mission to bridge Indian citizens and verified statutory advocates with zero commission.'
    };

    const pageTitle = titles[slug] || 'LegalConnect — Official Information';
    const pageDesc = descriptions[slug] || 'LegalConnect legal tech platform policies and statutory disclosures.';

    this.titleService.setTitle(pageTitle);
    this.metaService.updateTag({ name: 'description', content: pageDesc });
    this.metaService.updateTag({ property: 'og:title', content: pageTitle });
    this.metaService.updateTag({ property: 'og:description', content: pageDesc });
  }

  ngOnDestroy() {
    if (this.observer) this.observer.disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.onWindowScrollBound);
    }
    if (this.routeSub) this.routeSub.unsubscribe();
    if (this.scrollSub) this.scrollSub.unsubscribe();
  }

  trackById(index: number, item: { id: string }) {
    return item.id;
  }

  trackByLabel(index: number, item: { label: string }) {
    return item.label;
  }

  // Scroll listener handler bound to instance
  private onWindowScrollBound = () => {
    if (typeof window === 'undefined') return;

    const shouldShow = window.scrollY > 400;
    const shouldClearActive = window.scrollY < 180;

    // Only trigger Angular Change Detection when states actually change
    if (this.showBackToTop !== shouldShow || (shouldClearActive && this.activeSection !== '')) {
      this.ngZone.run(() => {
        this.showBackToTop = shouldShow;
        if (shouldClearActive) {
          this.activeSection = '';
        }
      });
    }
  };

  scrollActiveTabIntoView() {
    if (typeof document === 'undefined') return;

    // Wait for Angular to update DOM bindings
    setTimeout(() => {
      const activeElement = document.querySelector('.mobile-sticky-nav .bg-blue-600');
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }, 50);
  }

  scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update hash in URL silently without reloading
      if (typeof window !== 'undefined') {
        window.history.pushState(null, '', `${window.location.pathname}#${id}`);
      }
      this.activeSection = id;
    }
  }

  scrollToTop() {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  toggleDrawer() {
    this.isDrawerOpen = !this.isDrawerOpen;
    // Lock body scroll when drawer is open
    if (typeof document !== 'undefined') {
      document.body.style.overflow = this.isDrawerOpen ? 'hidden' : '';
    }
  }

  closeDrawer() {
    this.isDrawerOpen = false;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
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

  toggleFaq(faqId: string) {
    this.expandedFaqs[faqId] = !this.expandedFaqs[faqId];
  }

  submitFeedback(helpful: boolean) {
    const feedbackKey = `lc_feedback_${this.slug}`;
    this.feedbackService.submitFeedback(this.slug, helpful).subscribe({
      next: () => {
        this.feedbackSubmitted = true;
        this.lastFeedbackResponse = helpful;
        localStorage.setItem(feedbackKey, String(helpful));
        if (helpful) {
          this.snackbar.show('Thank you! Glad we could help.', 'success');
        } else {
          this.snackbar.show('Thank you for your feedback. We will review this policy.', 'info');
        }
      },
      error: () => {
        this.feedbackSubmitted = true;
        this.lastFeedbackResponse = helpful;
        localStorage.setItem(feedbackKey, String(helpful));
        this.snackbar.show('Thank you for your feedback!', 'success');
      }
    });
  }

  resetFeedback() {
    // Clear localStorage so refresh shows fresh Yes/No buttons.
    // The DB keeps the old vote until the user submits a new one (upsert).
    this.feedbackSubmitted = false;
    this.lastFeedbackResponse = null;
    localStorage.removeItem(`lc_feedback_${this.slug}`);
  }

  printDocument() {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  private setupIntersectionObserver() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window) || this.isLoading) return;

    const sections = document.querySelectorAll('section[id]');
    if (sections.length === 0) return;

    if (this.observer) this.observer.disconnect();
    this.observedIds.clear();

    const options = {
      root: null,
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0
    };

    // Run observer callback inside zone since it updates this.activeSection (which affects UI binding)
    this.observer = new IntersectionObserver((entries) => {
      this.ngZone.run(() => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Only highlight if we scrolled past the top header card
            if (window.scrollY > 180) {
              this.activeSection = entry.target.id;
            } else {
              this.activeSection = '';
            }
          }
        });
      });
    }, options);

    sections.forEach(sec => {
      this.observer.observe(sec);
      this.observedIds.add(sec.id);
    });
  }

  downloadDossier() {
    this.authService.downloadDataDossier().subscribe({
      next: (blob) => {
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
        if (err.status === 401) {
          this.snackbar.show('Please log in first to request your personal data archive.', 'error');
        } else {
          this.snackbar.show('Failed to compile your data dossier. Please try again later.', 'error');
        }
      }
    });
  }
}