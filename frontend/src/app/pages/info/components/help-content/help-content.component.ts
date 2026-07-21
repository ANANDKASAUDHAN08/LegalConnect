import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { InfoApiService } from '../../services/info-api.service';

export interface HelpCategory {
  id: string;
  label: string;
  count: number;
  icon: string;
  color: string;
}

export interface FaqItem {
  id: string;
  category: string;
  sectionId: string;
  question: string;
  answer: string;
  badge?: string;
  expanded: boolean;
  voted?: boolean | null;
}

@Component({
  selector: 'app-help-content',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective],
  templateUrl: './help-content.component.html'
})
export class HelpContentComponent implements OnInit, OnDestroy {
  searchQuery = '';
  selectedCategory = 'all';

  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;

  // Help Categories with visual indicators & counts
  categories: HelpCategory[] = [
    { id: 'all', label: 'All Topics', count: 9, icon: 'M4 6h16M4 10h16M4 14h16M4 18h16', color: 'blue' },
    { id: 'general', label: 'General & Platform', count: 2, icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'indigo' },
    { id: 'advocate', label: 'Advocates & Verification', count: 3, icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', color: 'emerald' },
    { id: 'security', label: 'DPDP Privacy & Rights', count: 2, icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z', color: 'amber' },
    { id: 'library', label: 'Bare Acts & Research', count: 2, icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', color: 'purple' }
  ];

  // Quick Help Guides
  quickGuides = [
    {
      title: 'Advocate License Check',
      desc: 'How we cross-audit Bar Council ID numbers and active State practice status.',
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      badge: 'Verification',
      link: '#faq-bar'
    },
    {
      title: 'Export Personal Data',
      desc: 'Step-by-step guide to downloading your DPDP Act personal data dossier.',
      icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
      badge: 'DPDP Privacy',
      link: '#faq-dossier'
    },
    {
      title: 'Offline Bare Acts Access',
      desc: 'Learn how to cache statutory Bare Act provisions locally on your device.',
      icon: 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z',
      badge: 'PWA Offline',
      link: '#faq-offline'
    },
    {
      title: 'Zero Commission Policy',
      desc: 'Understand how LegalConnect guarantees zero middleman fees on lawyer consults.',
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      badge: 'Transparent Fee',
      link: '#faq-free'
    }
  ];

  // Trending Queries (fallback for new visitors)
  trendingQueries = ['BCI verification', 'DPDP rights', 'Dossier export', 'Zero commission', 'Offline Bare Acts'];

  // User's recent search history (max 5 items)
  recentSearches: string[] = [];
  private readonly recentSearchKey = 'lc_help_recent_searches';

  // Master FAQ list with plain English clarity & categorization
  faqs: FaqItem[] = [
    {
      id: 'faq-free',
      category: 'general',
      sectionId: 'faq-general',
      question: 'Is LegalConnect 100% free for clients?',
      answer: 'Yes, absolutely. Citizens and businesses can search advocate directories, explore Bare Acts, download court templates, and submit consultation inquiries completely free of charge. We never charge commission or platform markup fees.',
      badge: 'Free Access',
      expanded: true
    },
    {
      id: 'faq-grievance',
      category: 'general',
      sectionId: 'faq-general',
      question: 'How do I report incorrect info or file a platform grievance?',
      answer: 'You can submit a grievance directly to our designated Intermediary Grievance Officer via email at <a href="mailto:grievance@legalconnect.com" class="text-blue-600 dark:text-amber-500 font-bold hover:underline">grievance@legalconnect.com</a> or by using our Contact form. We acknowledge all complaints within 24 hours under the IT Rules 2021.',
      badge: 'Platform Governance',
      expanded: false
    },
    {
      id: 'faq-bar',
      category: 'advocate',
      sectionId: 'faq-lawyers',
      question: 'How do lawyers get verified on LegalConnect?',
      answer: 'Every advocate on LegalConnect undergoes mandatory Bar Council verification. Lawyers submit their State Bar Enrollment ID, year of registration, and identity credentials. Our Compliance DPO team cross-audits these records against public State Bar registers before issuing a "Verified Profile" badge.',
      badge: 'Verified Advocates',
      expanded: false
    },
    {
      id: 'faq-consultation',
      category: 'advocate',
      sectionId: 'faq-lawyers',
      question: 'How do client consultation inquiries reach advocates?',
      answer: 'When you submit a consultation request, your details are securely transmitted directly to the advocate’s private LegalConnect workstation. The lawyer reviews your case summary and gets in touch directly via phone or email.',
      badge: 'Direct Connect',
      expanded: false
    },
    {
      id: 'faq-commission',
      category: 'advocate',
      sectionId: 'faq-lawyers',
      question: 'Does LegalConnect take a cut of the advocate’s legal fees?',
      answer: 'No. LegalConnect operates with a strict Zero Middleman Fee policy. Advocates retain 100% of their professional fees. We do not participate in fee splitting, referral fees, or case bidding.',
      badge: 'Zero Commission',
      expanded: false
    },
    {
      id: 'faq-dpdp',
      category: 'security',
      sectionId: 'faq-privacy',
      question: 'What data protection rights do I have under the DPDP Act 2023?',
      answer: 'Under India\'s DPDP Act 2023, you hold the Right to Information/Summary, Right to Correction & Erasure, Right of Grievance Redressal, and Right to Withdraw Consent. You can manage tracker consents anytime in our Cookie Preferences center.',
      badge: 'DPDP Act 2023',
      expanded: false
    },
    {
      id: 'faq-dossier',
      category: 'security',
      sectionId: 'faq-privacy',
      question: 'How can I request or download my personal data dossier?',
      answer: 'Go to the Privacy Policy page or Account Settings and click "Request Dossier". Our system compiles your account records into a machine-readable JSON archive containing your bookmarks, audit logs, and communication histories for instant download.',
      badge: 'Subject Access Request',
      expanded: false
    },
    {
      id: 'faq-offline',
      category: 'library',
      sectionId: 'faq-research',
      question: 'Does the Bare Acts law library work offline without internet?',
      answer: 'Yes! LegalConnect is designed as a Progressive Web App (PWA). Sections, Bare Acts, and saved bookmarks you view are cached in your local browser storage, allowing full search and offline reading even with low or zero network signal.',
      badge: 'PWA Offline Cache',
      expanded: false
    },
    {
      id: 'faq-bns',
      category: 'library',
      sectionId: 'faq-research',
      question: 'Are the new criminal codes (BNS, BNSS, BSA) updated in the database?',
      answer: 'Yes. All 850+ Central Bare Acts—including the Bharatiya Nyaya Sanhita (BNS) 2023, Bharatiya Nagarik Suraksha Sanhita (BNSS) 2023, and Bharatiya Sakshya Adhiniyam (BSA) 2023—are fully indexed alongside legacy IPC, CrPC, and Evidence Act references.',
      badge: 'Updated 2026 Acts',
      expanded: false
    }
  ];

  constructor(
    private snackbar: SnackbarService,
    private sanitizer: DomSanitizer,
    private infoApi: InfoApiService
  ) { }

  ngOnInit() {
    // RxJS Debounced search handler (250ms delay)
    this.searchSub = this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged()
    ).subscribe(query => {
      if (query.trim().length >= 2) {
        this.infoApi.logSearchQuery(query).subscribe();
      }
    });

    // Fetch dynamic help data from backend API
    this.infoApi.getHelpData().subscribe(res => {
      if (res && res.success && res.trendingQueries && res.trendingQueries.length > 0) {
        this.trendingQueries = res.trendingQueries;
      }
    });

    // Restore persisted recent search history
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.recentSearchKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.recentSearches = parsed.slice(0, 5);
          }
        } catch {
          this.recentSearches = [];
        }
      }

      // Check URL hash if deep-linked to specific FAQ
      if (window.location.hash) {
        const targetId = window.location.hash.replace('#', '');
        const match = this.faqs.find(f => f.id === targetId);
        if (match) {
          this.faqs.forEach(f => f.expanded = (f.id === targetId));
        }
      }
    }
  }

  get filteredFaqs(): FaqItem[] {
    return this.faqs.filter(faq => {
      const matchesCategory = this.selectedCategory === 'all' || faq.category === this.selectedCategory;
      const matchesSearch = !this.searchQuery ||
        faq.question.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (faq.badge && faq.badge.toLowerCase().includes(this.searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }

  getCategoryCount(categoryId: string): number {
    return this.faqs.filter(faq => {
      const matchesCategory = categoryId === 'all' || faq.category === categoryId;
      const matchesSearch = !this.searchQuery ||
        faq.question.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (faq.badge && faq.badge.toLowerCase().includes(this.searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    }).length;
  }

  toggleFaq(id: string) {
    this.faqs.forEach(faq => {
      if (faq.id === id) {
        faq.expanded = !faq.expanded;
      } else {
        faq.expanded = false; // Smooth accordion single toggle
      }
    });
  }

  voteFaqHelpful(id: string, helpful: boolean) {
    const faq = this.faqs.find(f => f.id === id);
    if (faq) {
      faq.voted = helpful;
      // Persist vote to backend API
      this.infoApi.voteFaq(id, helpful).subscribe();

      if (helpful) {
        this.snackbar.show('Thank you! Glad this answer was helpful.', 'success');
      } else {
        this.snackbar.show('Thanks for the feedback. Our DPO desk will update this answer.', 'info');
      }
    }
  }

  isSearchFocused = false;

  onSearchFocus() {
    this.isSearchFocused = true;
  }

  onSearchBlur() {
    setTimeout(() => {
      this.isSearchFocused = false;
    }, 200);
  }

  closeSearchOverlay() {
    this.isSearchFocused = false;
  }

  selectSearchOverlayItem(faqId: string, questionText?: string) {
    this.isSearchFocused = false;
    if (questionText) {
      this.saveRecentSearch(questionText);
    } else if (this.searchQuery.trim().length >= 2) {
      this.saveRecentSearch(this.searchQuery.trim());
    }

    // Expand target FAQ
    this.faqs.forEach(f => f.expanded = (f.id === faqId));

    // Scroll smoothly to target FAQ accordion
    setTimeout(() => {
      this.scrollToTarget(faqId);
    }, 100);
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

  onSearchSubmit() {
    this.isSearchFocused = false;
    if (this.searchQuery.trim().length >= 2) {
      this.saveRecentSearch(this.searchQuery.trim());
    }
    // Scroll smoothly to FAQ section
    this.scrollToTarget('faq-section');
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;
    this.saveRecentSearch(query);
  }

  saveRecentSearch(query: string) {
    if (!query || query.trim().length < 2) return;
    const cleanQuery = query.trim();
    // Filter out duplicates (case-insensitive)
    const filtered = this.recentSearches.filter(s => s.toLowerCase() !== cleanQuery.toLowerCase());
    this.recentSearches = [cleanQuery, ...filtered].slice(0, 5);

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.recentSearchKey, JSON.stringify(this.recentSearches));
    }
  }

  clearRecentSearches() {
    this.recentSearches = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.recentSearchKey);
    }
    this.snackbar.show('Recent search history cleared.', 'info');
  }

  removeRecentSearch(itemToRemove: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.recentSearches = this.recentSearches.filter(item => item !== itemToRemove);
    if (typeof window !== 'undefined') {
      if (this.recentSearches.length > 0) {
        localStorage.setItem(this.recentSearchKey, JSON.stringify(this.recentSearches));
      } else {
        localStorage.removeItem(this.recentSearchKey);
      }
    }
  }

  clearSearch() {
    this.searchQuery = '';
  }

  selectCategory(categoryId: string) {
    this.selectedCategory = categoryId;
  }

  getHighlightedText(text: string): SafeHtml {
    if (!this.searchQuery || this.searchQuery.trim().length < 2) return text;
    const cleanQuery = this.searchQuery.trim();
    const escapedQuery = cleanQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const highlighted = text.replace(
      regex,
      `<mark class="bg-amber-400/30 text-amber-900 dark:text-amber-200 font-black px-1 py-0.5 rounded border border-amber-500/40 m-0 inline-block">$1</mark>`
    );
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }

  getAnswerSnippet(answer: string): SafeHtml | null {
    if (!this.searchQuery || this.searchQuery.trim().length < 2 || !answer) return null;
    const cleanQuery = this.searchQuery.trim().toLowerCase();
    const index = answer.toLowerCase().indexOf(cleanQuery);
    if (index === -1) return null;

    const start = Math.max(0, index - 25);
    const end = Math.min(answer.length, index + cleanQuery.length + 35);
    let snippet = answer.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < answer.length) snippet = snippet + '...';

    return this.getHighlightedText(snippet);
  }

  copySectionLink(id: string) {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url).then(() => {
      this.snackbar.show('FAQ link copied to clipboard!', 'success');
    }).catch(() => {
      this.snackbar.show('Failed to copy FAQ link.', 'error');
    });
  }

  scrollToTarget(link: string) {
    const id = link.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  trackById(index: number, item: any) {
    return item.id;
  }
}