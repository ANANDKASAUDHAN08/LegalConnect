import {
  Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LegalService } from '../../../../services/legal.service';
import { ThemeService } from '../../../../services/theme.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { DomSanitizer, SafeResourceUrl, Meta, Title } from '@angular/platform-browser';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { IconComponent } from '../../../../components/icon';
import { LEGAL_RESOURCE_PIPES } from '../../../../pipes/legal-resource.pipe';
import { getResourceTypeLabel, getResourceTypeBadgeClass } from '../../../../core/constants/legal-resource.constants';

@Component({
  selector: 'app-resource-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TooltipDirective,
    IconComponent,
    LEGAL_RESOURCE_PIPES
  ],
  templateUrl: './resource-detail.component.html',
  styleUrls: ['./resource-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceDetailComponent implements OnInit {
  resource: any = null;
  isLoading = true;
  notFound = false;
  mapType: 'roadmap' | 'satellite' = 'roadmap';

  // Language support (Bilingual English / Hindi)
  selectedLanguage: 'en' | 'hi' = 'en';

  // Feedback State
  userVote: 'up' | 'down' | null = null;
  showFeedbackModal = false;
  selectedReason = '';
  isSubmittingFeedback = false;

  readonly FEEDBACK_REASONS = [
    'Incorrect Contact Number',
    'Permanently Closed or Shifted',
    'Wrong Address / Coordinates',
    'Inaccurate Operating Hours',
    'Facilities Information Outdated'
  ];

  // Nearby resources
  nearbyResources: any[] = [];
  isLoadingNearby = false;

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
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadResource(id);
      this.recordView(id);
    } else {
      this.notFound = true;
      this.isLoading = false;
    }
  }

  private loadResource(id: string): void {
    this.legalService.getResourceById(id).subscribe({
      next: (res: any) => {
        if (res?.success && res.data) {
          this.resource = res.data;
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
    this.legalService.recordResourceView(id).subscribe({
      error: () => { /* Silent fallback for telemetry */ }
    });
  }

  private updateSEO(): void {
    const r = this.resource;
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
    }).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.nearbyResources = (res.data || [])
            .filter((r: any) => r._id !== this.resource._id)
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

  // Feedback Handlers
  onUpvote(): void {
    if (this.userVote === 'up') return;
    this.userVote = 'up';
    this.legalService.submitResourceFeedback(this.resource._id, true).subscribe({
      next: (res) => {
        if (res?.feedback) {
          this.resource.feedback = res.feedback;
        }
        this.snackbar.show('Thank you! Your feedback helps keep this directory reliable.', 'success');
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackbar.show('Could not submit feedback at this moment.', 'error');
      }
    });
  }

  onDownvote(): void {
    this.showFeedbackModal = true;
    this.cdr.markForCheck();
  }

  submitDownvoteWithReason(): void {
    if (this.isSubmittingFeedback) return;
    this.isSubmittingFeedback = true;
    this.userVote = 'down';

    this.legalService.submitResourceFeedback(this.resource._id, false, this.selectedReason).subscribe({
      next: (res) => {
        if (res?.feedback) {
          this.resource.feedback = res.feedback;
        }
        this.showFeedbackModal = false;
        this.isSubmittingFeedback = false;
        this.snackbar.show('Report received. Our moderation team will verify this listing.', 'info');
        this.cdr.markForCheck();
      },
      error: () => {
        this.showFeedbackModal = false;
        this.isSubmittingFeedback = false;
        this.snackbar.show('Could not submit report at this moment.', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  closeFeedbackModal(): void {
    this.showFeedbackModal = false;
    this.selectedReason = '';
    this.cdr.markForCheck();
  }

  // Map
  get safeMapUrl(): SafeResourceUrl {
    let query: string;
    if (this.resource?.coordinates?.lat && this.resource?.coordinates?.lng) {
      query = `${this.resource.coordinates.lat},${this.resource.coordinates.lng}`;
    } else {
      query = encodeURIComponent(`${this.resource?.address || ''}, ${this.resource?.city || ''}, ${this.resource?.state || ''}`.trim());
    }
    const url = `https://maps.google.com/maps?q=${query}&hl=en&z=16&output=embed`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  toggleMapType(): void {
    this.mapType = this.mapType === 'roadmap' ? 'satellite' : 'roadmap';
  }

  // Helpers (Delegates to centralized Single Source of Truth)
  getTypeLabel(type: string): string {
    return getResourceTypeLabel(type, this.selectedLanguage);
  }

  getTypeColor(type: string): string {
    return getResourceTypeBadgeClass(type);
  }

  getVerificationFreshness(): { label: string; colorClass: string; tooltip: string } | null {
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

  getFacilityChips(): { label: string; iconKey: string; description: string }[] {
    const f = this.resource?.facilities;
    if (!f) return [];
    const chips: { label: string; iconKey: string; description: string }[] = [];
    if (f.hasEfiling) chips.push({ label: 'e-Filing', iconKey: 'efiling', description: 'e-Sewa Kendra digital filing desk available for electronic case filing' });
    if (f.hasLADCS) chips.push({ label: 'LADCS', iconKey: 'ladcs', description: 'Legal Aid Defense Counsel System — free defense counsel assignment' });
    if (f.hasVCRoom) chips.push({ label: 'VC Room', iconKey: 'vcroom', description: 'Video conferencing room for remote hearings and remand proceedings' });
    if (f.hasLegalAidClinic) chips.push({ label: 'Legal Aid Clinic', iconKey: 'clinic', description: 'On-site free legal aid clinic with walk-in consultations' });
    if (f.isWheelchairAccessible) chips.push({ label: 'Accessible', iconKey: 'accessible', description: 'Wheelchair ramps, accessible toilets, and lift facilities available' });
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
        this.snackbar.show('Address copied to clipboard!', 'success');
      }).catch(() => {
        this.snackbar.show('Could not copy address.', 'error');
      });
    }
  }

  shareResource(): void {
    const url = window.location.href;
    const title = `${this.resource?.name} — ${this.getTypeLabel(this.resource?.type)}`;
    if (navigator.share) {
      navigator.share({ title, text: title, url }).then(() => {
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

  printPage(): void {
    window.print();
  }

  trackById(index: number, item: any): string {
    return item._id;
  }
}