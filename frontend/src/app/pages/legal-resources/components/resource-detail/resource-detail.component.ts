import {
  Component, OnInit, AfterViewInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, inject, DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LegalService } from '../../../../services/legal.service';
import { ThemeService } from '../../../../services/theme.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { DomSanitizer, SafeResourceUrl, Meta, Title } from '@angular/platform-browser';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { IconComponent } from '../../../../components/icon';
import { LEGAL_RESOURCE_PIPES } from '../../../../pipes/legal-resource.pipe';
import { getResourceTypeLabel, getResourceTypeBadgeClass } from '../../../../core/constants/legal-resource.constants';
import { PrintService } from '../../../../services/print.service';
import { BookmarkButtonComponent } from '../../../../components/bookmark-button/bookmark-button.component';
import { InteractiveLikeComponent } from '../../../../components/interactive-like/interactive-like.component';
import { ReportTriggerComponent } from '../../../../components/report-modal/report-trigger/report-trigger.component';
import { QrModalComponent } from '../../../../components/qr-modal/qr-modal.component';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';
import { ModerationReportService } from '../../../../services/moderation-report.service';
import { ScrollService } from '../../../../services/scroll.service';
import { InteractionService } from '../../../../services/interaction.service';
import { UniversalBookmarkService } from '../../../../services/universal-bookmark.service';
import {
  LegalResourceDetail,
  DocumentChecklistItem,
  EligibilityCategory,
  ApplicationStep,
  FacilityChip,
  VerificationBadge,
  ELIGIBILITY_CATEGORIES,
  APPLICATION_STEPS,
  DEFAULT_DOCUMENT_CHECKLIST
} from './resource-detail.constants';

@Component({
  selector: 'app-resource-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TooltipDirective,
    IconComponent,
    LEGAL_RESOURCE_PIPES,
    BookmarkButtonComponent,
    InteractiveLikeComponent,
    ReportTriggerComponent,
    QrModalComponent,
    ShareMenuComponent
  ],
  templateUrl: './resource-detail.component.html',
  styleUrls: ['./resource-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  resource: LegalResourceDetail | null = null;
  isLoading = true;
  notFound = false;

  // Bottom Nav synchronization (Hide action bar when bottom navbar is visible)
  isBottomNavVisible = true;
  private scrollService = inject(ScrollService);
  private interactionService = inject(InteractionService);
  private bookmarkService = inject(UniversalBookmarkService);

  // Dynamic Navbar Height synchronization for mobile & desktop
  navbarHeight = 68;
  private navResizeObserver?: ResizeObserver;
  private destroyRef = inject(DestroyRef);

  // Language support (Bilingual English / Hindi)
  selectedLanguage: 'en' | 'hi' = 'en';

  // Feedback State
  userVote: 'up' | 'down' | null = null;

  // Section 12 Free Legal Aid Eligibility Categories (Statutory under Legal Services Authorities Act, 1987)
  showEligibilityDetails = false;
  readonly ELIGIBILITY_CATEGORIES: EligibilityCategory[] = ELIGIBILITY_CATEGORIES;

  // Interactive Document Checklist
  documentChecklist: DocumentChecklistItem[] = JSON.parse(JSON.stringify(DEFAULT_DOCUMENT_CHECKLIST));

  // 4-Step Application Procedure Steps
  readonly APPLICATION_STEPS: ApplicationStep[] = APPLICATION_STEPS;

  // QR Modal State
  showQrModal = false;
  qrModalData: any = null;

  // Nearby resources
  nearbyResources: any[] = [];
  isLoadingNearby = false;

  // Cached template bindings
  sanitizedMapUrl: SafeResourceUrl | null = null;
  isMapLoaded = false;
  facilityChips: FacilityChip[] = [];
  verificationBadge: VerificationBadge | null = null;

  // Mobile overflow menu
  showMobileOverflow = false;

  constructor(
    private route: ActivatedRoute,
    private legalService: LegalService,
    private snackbar: SnackbarService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private meta: Meta,
    private titleService: Title,
    public themeService: ThemeService
  ) { }

  ngOnInit(): void {
    // Synchronize bottom nav scroll visibility
    this.scrollService.scrollDirection$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(dir => {
        this.isBottomNavVisible = dir === 'up';
        this.cdr.markForCheck();
      });

    // Reactive route parameter listener (re-loads resource when navigating between nearby resources)
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const id = params.get('id');
        if (id) {
          this.isLoading = true;
          this.notFound = false;
          this.userVote = null;
          this.documentChecklist = JSON.parse(JSON.stringify(DEFAULT_DOCUMENT_CHECKLIST));
          this.loadResource(id);
          this.recordView(id);
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        } else {
          this.notFound = true;
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  ngAfterViewInit(): void {
    this.updateNavbarHeight();
    if (typeof document !== 'undefined') {
      const nav = document.querySelector('nav') || document.querySelector('app-navbar nav');
      if (nav && typeof ResizeObserver !== 'undefined') {
        this.navResizeObserver = new ResizeObserver(() => {
          this.updateNavbarHeight();
        });
        this.navResizeObserver.observe(nav);
      }
    }
    setTimeout(() => {
      this.updateNavbarHeight();
    }, 0);
  }

  ngOnDestroy(): void {
    this.navResizeObserver?.disconnect();
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateNavbarHeight();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

    if (event.key === 'p' || event.key === 'P') {
      this.printPage();
    } else if (event.key === 'd' || event.key === 'D') {
      this.openDirections();
    } else if (event.key === 'Escape') {
      if (this.showQrModal) this.closeQrModal();
      if (this.showMobileOverflow) this.closeMobileOverflow();
    }
  }

  private updateNavbarHeight(): void {
    if (typeof document === 'undefined') return;
    const nav = document.querySelector('nav') || document.querySelector('app-navbar nav');
    if (nav) {
      const height = nav.offsetHeight;
      if (height > 0 && height !== this.navbarHeight) {
        this.navbarHeight = height;
        this.cdr.markForCheck();
      }
    }
  }

  private loadResource(id: string): void {
    this.legalService.getResourceById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          if (res?.success && res.data) {
            this.resource = res.data;

            // Server-Side Enrichment Pre-Seeding: 0ms Frame 0 Display
            const inter = res.data.interaction;
            if (inter) {
              this.interactionService.seedState('LegalResource', res.data._id, {
                count: inter.count || 0,
                liked: Boolean(inter.liked),
                type: inter.liked ? 'Like' : null
              });
              if (inter.saved) {
                this.bookmarkService.seedBookmark('LegalResource', res.data._id, true);
              }
            }

            this.buildCachedProperties();
            this.updateSEO();
            this.loadNearbyResources();
          } else {
            this.notFound = true;
          }
          this.isLoading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.notFound = true;
          this.isLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  private recordView(id: string): void {
    this.legalService.recordResourceView(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => { /* Silent fallback for telemetry */ }
      });
  }

  private updateSEO(): void {
    const r = this.resource;
    if (!r) return;
    this.titleService.setTitle(`${r.name} — ${this.getTypeLabel(r.type)} | LegalConnect`);
    this.meta.updateTag({
      name: 'description',
      content: `${r.name} — ${this.getTypeLabel(r.type)} located at ${r.address}. Contact: ${r.contactNumber?.[0] || 'N/A'}. Official legal infrastructure directory.`
    });
  }

  private loadNearbyResources(): void {
    if (!this.resource?.state) return;
    this.isLoadingNearby = true;
    this.legalService.getResourceDirectory({
      state: this.resource.state,
      type: this.resource.type,
      limit: 4,
      page: 1
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res: any) => {
          if (res?.success) {
            this.nearbyResources = (res.data || [])
              .filter((r: any) => r._id !== this.resource?._id)
              .slice(0, 3);
          }
          this.isLoadingNearby = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.isLoadingNearby = false;
          this.cdr.markForCheck();
        }
      });
  }

  setLanguage(lang: 'en' | 'hi'): void {
    this.selectedLanguage = lang;
    this.cdr.markForCheck();
  }

  // Interactive Checklist Controls
  toggleChecklistItem(item: DocumentChecklistItem): void {
    item.checked = !item.checked;
    this.cdr.markForCheck();
  }

  get completedChecklistCount(): number {
    return this.documentChecklist.filter(i => i.checked).length;
  }

  resetChecklist(): void {
    this.documentChecklist.forEach(i => i.checked = false);
    this.cdr.markForCheck();
  }

  // Eligibility Details Toggle
  toggleEligibility(): void {
    this.showEligibilityDetails = !this.showEligibilityDetails;
    this.cdr.markForCheck();
  }

  // Feedback Handlers with Verified Auth/Network Guard
  onUpvote(): void {
    if (!this.resource || this.userVote === 'up') return;
    this.legalService.submitResourceFeedback(this.resource._id, true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.userVote = 'up';
          if (res?.feedback && this.resource) {
            this.resource.feedback = res.feedback;
          }
          this.snackbar.show('Thank you! Your feedback helps verify national directory accuracy.', 'success');
          this.cdr.markForCheck();
        },
        error: () => {
          this.snackbar.show('Please sign in or try again later to submit feedback.', 'warning');
        }
      });
  }

  openReportModal(): void {
    if (!this.resource) return;
    this.reportService.openReport('LegalResource', this.resource._id, this.resource.name);
  }

  // QR Modal
  openQrModal(): void {
    if (!this.resource) return;
    this.qrModalData = {
      name: this.resource.name,
      address: `${this.resource.address}, ${this.resource.city || ''}, ${this.resource.state || ''}`,
      contactNumber: this.resource.contactNumber?.[0] || 'N/A'
    };
    this.showQrModal = true;
    if (typeof document !== 'undefined') {
      document.body.classList.add('overflow-hidden');
    }
    this.cdr.markForCheck();
  }

  closeQrModal(): void {
    this.showQrModal = false;
    this.qrModalData = null;
    if (typeof document !== 'undefined' && !this.showMobileOverflow) {
      document.body.classList.remove('overflow-hidden');
    }
    this.cdr.markForCheck();
  }

  // Build all cached properties after resource data arrives
  private buildCachedProperties(): void {
    this.buildMapUrl();
    this.facilityChips = this.computeFacilityChips();
    this.verificationBadge = this.computeVerificationFreshness();
  }

  // Map URL
  private buildMapUrl(): void {
    if (!this.resource) return;
    let query: string;
    if (this.resource.coordinates?.lat && this.resource.coordinates?.lng) {
      query = `${this.resource.coordinates.lat},${this.resource.coordinates.lng}`;
    } else {
      query = encodeURIComponent(`${this.resource?.address || ''}, ${this.resource?.city || ''}, ${this.resource?.state || ''}`.trim());
    }
    const url = `https://maps.google.com/maps?q=${query}&hl=en&z=16&output=embed`;
    this.sanitizedMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  onMapLoad(): void {
    this.isMapLoaded = true;
    this.cdr.markForCheck();
  }

  toggleMobileOverflow(): void {
    this.showMobileOverflow = !this.showMobileOverflow;
    if (typeof document !== 'undefined') {
      if (this.showMobileOverflow) {
        document.body.classList.add('overflow-hidden');
      } else if (!this.showQrModal) {
        document.body.classList.remove('overflow-hidden');
      }
    }
    this.cdr.markForCheck();
  }

  closeMobileOverflow(): void {
    this.showMobileOverflow = false;
    if (typeof document !== 'undefined' && !this.showQrModal) {
      document.body.classList.remove('overflow-hidden');
    }
    this.cdr.markForCheck();
  }

  // Helpers
  getTypeLabel(type: string): string {
    return getResourceTypeLabel(type, this.selectedLanguage);
  }

  getTypeColor(type: string): string {
    return getResourceTypeBadgeClass(type);
  }

  private computeVerificationFreshness(): { label: string; colorClass: string; tooltip: string } | null {
    if (!this.resource?.lastAuditDate) return null;
    const auditDate = new Date(this.resource.lastAuditDate);
    const now = new Date();
    const monthsAgo = (now.getFullYear() - auditDate.getFullYear()) * 12 + (now.getMonth() - auditDate.getMonth());
    const dateStr = auditDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    if (monthsAgo <= 6) {
      return {
        label: `Verified: ${dateStr}`,
        colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        tooltip: 'Data is verified by registry administrators within the last 6 months'
      };
    }
    if (monthsAgo <= 12) {
      return {
        label: `Verified: ${dateStr}`,
        colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        tooltip: 'Verification is approaching statutory annual compliance renewal'
      };
    }
    return {
      label: `Verified: ${dateStr}`,
      colorClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      tooltip: 'Verification cycle expired (>12 months). Pending annual re-audit.'
    };
  }

  private computeFacilityChips(): { label: string; iconKey: string; description: string }[] {
    const f = this.resource?.facilities;
    if (!f) return [];
    const chips: { label: string; iconKey: string; description: string }[] = [];
    if (f.hasEfiling) chips.push({ label: 'e-Filing Kendra', iconKey: 'efiling', description: 'Digital e-Sewa filing desk for rapid electronic case registration' });
    if (f.hasLADCS) chips.push({ label: 'LADCS Defense', iconKey: 'ladcs', description: 'Legal Aid Defense Counsel System — free full-time defense representation' });
    if (f.hasVCRoom) chips.push({ label: 'VC Hearing Room', iconKey: 'vcroom', description: 'Dedicated video conferencing facility for virtual court hearings & remands' });
    if (f.hasLegalAidClinic) chips.push({ label: 'Legal Aid Clinic', iconKey: 'clinic', description: 'Free walk-in consultation desk with panel advocates on duty' });
    if (f.isWheelchairAccessible) chips.push({ label: 'Accessible Campus', iconKey: 'accessible', description: 'Wheelchair ramps, accessible restrooms, and barrier-free elevators' });
    return chips;
  }

  openDirections(): void {
    if (!this.resource) return;
    let url: string;
    if (this.resource.coordinates?.lat && this.resource.coordinates?.lng) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${this.resource.coordinates.lat},${this.resource.coordinates.lng}`;
    } else {
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent((this.resource.address || '') + ', ' + (this.resource.city || '') + ', ' + (this.resource.state || ''))}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  copyAddress(): void {
    if (this.resource?.address) {
      navigator.clipboard.writeText(this.resource.address).then(() => {
        this.snackbar.show('Official address copied to clipboard!', 'success');
      }).catch(() => {
        this.snackbar.show('Could not copy address.', 'error');
      });
    }
  }

  copyCoordinates(): void {
    if (this.resource?.coordinates?.lat && this.resource?.coordinates?.lng) {
      const coords = `${this.resource.coordinates.lat}, ${this.resource.coordinates.lng}`;
      navigator.clipboard.writeText(coords).then(() => {
        this.snackbar.show(`Coordinates ${coords} copied!`, 'success');
      }).catch(() => {
        this.snackbar.show('Could not copy coordinates.', 'error');
      });
    } else {
      this.copyAddress();
    }
  }

  get shareUrl(): string {
    return typeof window !== 'undefined' ? window.location.href : '';
  }

  get shareSubject(): string {
    return this.resource ? `${this.resource.name} — ${this.getTypeLabel(this.resource.type)}` : 'Legal Resource';
  }

  get shareText(): string {
    if (!this.resource) return '';
    const phone = this.resource.contactNumber?.[0] || 'N/A';
    return `🏛️ ${this.resource.name}\n📍 ${this.resource.address}, ${this.resource.city || ''}, ${this.resource.state || ''}\n📞 Phone: ${phone}\n🕒 Hours: ${this.resource.operatingHours || '10:00 AM - 5:00 PM'}`;
  }

  shareResource(): void {
    if (!this.resource) return;
    const url = window.location.href;
    const title = `${this.resource.name} — ${this.getTypeLabel(this.resource.type)}`;
    if (navigator.share) {
      navigator.share({ title, text: `${title}\n${this.resource.address}`, url }).then(() => {
        this.snackbar.show('Shared successfully!', 'success');
      }).catch(() => {
        navigator.clipboard.writeText(url);
        this.snackbar.show('Link copied to clipboard!', 'success');
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        this.snackbar.show('Link copied to clipboard!', 'success');
      });
    }
  }

  openECourts(): void {
    window.open('https://services.ecourts.gov.in/', '_blank', 'noopener,noreferrer');
  }

  private printService = inject(PrintService);
  private reportService = inject(ModerationReportService);

  printPage(): void {
    if (!this.resource) return;
    const dossierHtml = this.printService.buildResourceDossier(this.resource);
    this.printService.print({
      title: this.resource.name || 'Legal Resource Detail',
      subtitle: `Official Institutional Dossier • ${this.printService.getTypeLabel(this.resource.type)}`,
      content: dossierHtml,
      sealText: 'Verified Registry Entry • National Legal Infrastructure Directory',
      accentColor: '#4338ca',
      classification: 'OFFICIAL REGISTRY DOSSIER'
    });
  }

  trackById(index: number, item: any): string {
    return item._id || index.toString();
  }
}