import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { NgFor, NgIf, AsyncPipe, NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserProfile } from '../../services/auth.service';
import { BookmarkService, Bookmark } from '../../services/bookmark.service';
import { LawyerService } from '../../services/lawyer.service';
import { LegalService } from '../../services/legal.service';
import { Observable } from 'rxjs';

// Modular Child Components
import { GuestNavigatorComponent } from '../../components/guest-navigator/guest-navigator.component';
import { RightsCheckerComponent } from '../../components/rights-checker/rights-checker.component';
import { BnsIpcLookupComponent } from '../../components/bns-ipc-lookup/bns-ipc-lookup.component';
import { PremiumPreviewModalComponent } from '../../components/premium-preview-modal/premium-preview-modal.component';
import { ReviewsSectionComponent } from '../../components/reviews-section/reviews-section.component';

import { IconComponent } from '../../components/icon/icon.component';
import { TooltipDirective } from '../../directives/tooltip.directive';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    RouterLink,
    NgFor,
    NgIf,
    AsyncPipe,
    FormsModule,
    NgClass,
    DecimalPipe,
    GuestNavigatorComponent,
    RightsCheckerComponent,
    BnsIpcLookupComponent,
    PremiumPreviewModalComponent,
    ReviewsSectionComponent,
    IconComponent,
    TooltipDirective
  ],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  searchQuery = '';
  currentUser$!: Observable<UserProfile | null>;
  currentUser: UserProfile | null = null;
  preferredRole: string | null = null;
  bookmarks$!: Observable<Bookmark[]>;
  pendingInquiriesCount = 0;
  totalInquiriesCount = 0;

  // Count-up animation state (Enhancement #8d)
  statsAnimated = false;
  displayStats = { acts: 0, sections: 0, centers: 0 };
  private statsObserver?: IntersectionObserver;

  // Preview Modal State
  showPreviewModal = false;
  previewModalFeatureName: 'ai' | 'templates' = 'ai';

  keyActs: any[] = [
    { shortName: 'Constitution', actName: 'Constitution of India', year: 1950, description: 'The supreme law of India establishing government structure and fundamental rights.' },
    { shortName: 'BNS', actName: 'Bharatiya Nyaya Sanhita', year: 2023, description: "Replaced the Indian Penal Code of 1860 as India's modern criminal code." }
  ];

  // Citizen/Public features
  features = [
    { icon: 'bare-acts', title: 'Complete Bare Acts', desc: 'Access the full text of 500+ Indian Acts and Statutes, from the Constitution to the latest legislation.', link: '/laws' },
    { icon: 'search', title: 'Smart Search', desc: 'Find any section, clause, or keyword instantly across the entire legal library of India.', link: '/search' },
    { icon: 'rights', title: 'Know Your Rights', desc: 'Understand your Fundamental Rights, Consumer Rights, Tenant Rights, and more in plain language.', link: '#rights-checker' },
    { icon: 'lawyer', title: 'Find a Lawyer', desc: 'Connect with verified, specialized lawyers across India for consultations and legal aid.', link: '/lawyers' },
    { icon: 'ai', title: 'AI Legal Assistant', desc: 'Upload contracts or notices to get instant plain-language summaries and risk analysis highlights.', link: '/client/portal' },
    { icon: 'templates', title: 'Legal Templates', desc: 'Download verified templates for rent agreements, affidavits, deeds, and legal notices.', link: '/client/portal' },
  ];

  // Advocate/Professional features
  lawyerFeatures = [
    { icon: 'bare-acts', title: 'Bare Acts Reference', desc: 'Query 500+ Indian central and state acts for citation details in legal drafts.', link: '/laws' },
    { icon: 'search', title: 'Citation Search', desc: 'Find relevant sections or precedents instantly using advanced query filters.', link: '/search' },
    { icon: 'rights', title: 'BNS equivalent search', desc: 'Map old IPC penal code references to the new BNS sections instantly.', link: '#bns-lookup' },
    { icon: 'lawyer', title: 'Client Intake Inbox', desc: 'Review pre-screened consultation inquires and messages directly from local citizens.', link: '/lawyer/workstation' },
    { icon: 'ai', title: 'AI Citation Summarizer', desc: 'Scan judgment PDFs and contract clauses for immediate case law citations.', link: '/lawyer/workstation' },
    { icon: 'templates', title: 'Court Draft Templates', desc: 'Download standard formats for affidavits, vakalatnamas, petitions, and legal briefs.', link: '/lawyer/workstation' }
  ];

  constructor(
    private router: Router,
    public auth: AuthService,
    public bookmarkService: BookmarkService,
    private lawyerService: LawyerService,
    private legalService: LegalService,
    private elRef: ElementRef
  ) {}

  ngOnInit() {
    this.currentUser$ = this.auth.currentUser$;
    this.preferredRole = localStorage.getItem('lc_preferred_role');
    this.bookmarks$ = this.bookmarkService.bookmarks$;

    this.currentUser$.subscribe(user => {
      this.currentUser = user;
      if (user && user.role === 'Lawyer') {
        this.loadLawyerStats();
      }
    });

    this.loadKeyActs();
  }

  ngAfterViewInit() {
    this.initStatsCountUp();
  }

  ngOnDestroy() {
    this.statsObserver?.disconnect();
  }

  loadKeyActs() {
    this.legalService.getActs().subscribe({
      next: (res) => {
        if (res && res.success && res.data && res.data.length > 0) {
          const fetchedActs = res.data;
          const matched = [];
          
          // Try to find Constitution
          const constAct = fetchedActs.find(a => a.shortName === 'Constitution');
          if (constAct) matched.push(constAct);
          else matched.push(this.keyActs[0]);

          // Try to find BNS
          const bnsAct = fetchedActs.find(a => a.shortName === 'BNS' || a.shortName === 'IPC');
          if (bnsAct) matched.push(bnsAct);
          else matched.push(this.keyActs[1]);

          this.keyActs = matched;
        }
      },
      error: (err) => {
        console.error('Failed to fetch acts from API, using fallback data', err);
      }
    });
  }

  loadLawyerStats() {
    this.lawyerService.getReceivedInquiries().subscribe({
      next: (res) => {
        this.totalInquiriesCount = res.length;
        this.pendingInquiriesCount = res.filter(i => i.status === 'Pending').length;
      }
    });
  }

  onSearch() {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/search'], { queryParams: { q: this.searchQuery } });
    }
  }

  // Feature selection based on user role
  get featuresToDisplay() {
    if (this.currentUser && this.currentUser.role === 'Lawyer') {
      return this.lawyerFeatures;
    }
    return this.features;
  }

  // Feature card click interception
  onFeatureClick(feature: any, event: Event) {
    if (feature.icon === 'rights') {
      event.preventDefault();
      const targetId = (this.currentUser && this.currentUser.role === 'Lawyer') ? 'bns-lookup' : 'rights-checker';
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    if (feature.icon === 'ai' || feature.icon === 'templates') {
      if (!this.currentUser) {
        event.preventDefault();
        event.stopPropagation();
        this.openPreviewModal(feature.icon);
      }
    }
  }

  isRestricted(feature: any): boolean {
    if (!this.currentUser) {
      return feature.icon === 'ai' || feature.icon === 'templates';
    }
    return false;
  }

  openPreviewModal(type: 'ai' | 'templates') {
    this.previewModalFeatureName = type;
    this.showPreviewModal = true;
  }

  /** Count-up animation for stats banner — fires once when scrolled into view */
  private initStatsCountUp() {
    const statsBanner = this.elRef.nativeElement.querySelector('.stats-banner');
    if (!statsBanner) return;

    this.statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.statsAnimated) {
          this.statsAnimated = true;
          this.animateCount('acts', 500, 800);
          this.animateCount('sections', 10000, 1000);
          this.animateCount('centers', 160, 700);
          this.statsObserver?.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    this.statsObserver.observe(statsBanner);
  }

  private animateCount(key: 'acts' | 'sections' | 'centers', target: number, duration: number) {
    const startTime = performance.now();
    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for natural deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      this.displayStats[key] = Math.round(eased * target);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }
}