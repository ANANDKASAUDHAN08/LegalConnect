import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';
import { SnackbarService } from '../../../../services/snackbar.service';
import { LEGAL_RESOURCE_PIPES } from '../../../../pipes/legal-resource.pipe';
import { getResourceTypeLabel, getResourceTypeBadgeClass } from '../../../../core/constants/legal-resource.constants';

import { BookmarkButtonComponent } from '../../../../components/bookmark-button/bookmark-button.component';
import { InteractiveLikeComponent } from '../../../../components/interactive-like/interactive-like.component';
import { ReportTriggerComponent } from '../../../../components/report-modal/report-trigger/report-trigger.component';
import { IconComponent } from '../../../../components/icon';

@Component({
  selector: 'app-resource-card',
  standalone: true,
  imports: [
    CommonModule,
    TooltipDirective,
    ShareMenuComponent,
    LEGAL_RESOURCE_PIPES,
    BookmarkButtonComponent,
    InteractiveLikeComponent,
    ReportTriggerComponent,
    IconComponent
  ],
  templateUrl: './resource-card.component.html',
  styleUrls: ['./resource-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceCardComponent implements OnInit {
  @Input() resource: any;
  @Input() isFreeAidEligible = false;
  @Input() loading = false;
  @Input() isHovered = false;
  @Input() selectedLanguage: 'en' | 'hi' = 'en';
  @Input() userCoords: { lat: number; lng: number } | null = null;

  @Output() directions = new EventEmitter<{ lat: number, lng: number }>();
  @Output() showQr = new EventEmitter<any>();
  @Output() cardHover = new EventEmitter<string | null>();
  @Output() showOnMap = new EventEmitter<any>();

  operatingStatus!: { label: string, colorClass: string };
  isAddressCopied = false;

  constructor(
    private snackbar: SnackbarService,
    private router: Router
  ) { }

  onMouseEnter(): void {
    if (this.resource?._id) {
      this.cardHover.emit(this.resource._id);
    }
  }

  onMouseLeave(): void {
    this.cardHover.emit(null);
  }

  onShowOnMapClick(event: Event): void {
    event.stopPropagation();
    this.showOnMap.emit(this.resource);
  }

  ngOnInit(): void {
    if (!this.loading && this.resource) {
      this.operatingStatus = this.getLiveOperatingStatus();
    } else {
      this.operatingStatus = {
        label: 'Open Now',
        colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
      };
    }
  }

  copyCardDetails() {
    const text = this.getShareText() + `\nShared via LegalConnect Find-Help Portal`;
    navigator.clipboard.writeText(text).then(() => {
      this.snackbar.show('Contact details copied to clipboard!', 'success');
    }).catch(() => {
      this.snackbar.show('Could not copy contact details.', 'error');
    });
  }

  // Dynamic status check based on current time
  getLiveOperatingStatus(): { label: string, colorClass: string } {
    const hoursStr = this.resource.operatingHours;
    if (!hoursStr) return { label: 'Open Now', colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    const cleaned = hoursStr.toLowerCase().trim();

    if (cleaned.includes('24 hours')) {
      return { label: 'Open 24 Hours', colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    }

    try {
      const now = new Date();
      const currentHour = now.getHours();
      const currentTime = currentHour * 60 + now.getMinutes();

      if (currentHour === 13) {
        return { label: 'Lunch Break (Reopens 2 PM)', colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      }

      const parts = cleaned.split('-');
      if (parts.length === 2) {
        const startMin = this.parseTimeToMinutes(parts[0]);
        const endMin = this.parseTimeToMinutes(parts[1]);

        if (currentTime >= startMin && currentTime <= endMin) {
          if (endMin - currentTime <= 30) {
            return { label: 'Closing Soon', colorClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' };
          }
          return { label: 'Open Now', colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
        }
      }
    } catch (e) {
      // Fallback
    }

    return { label: 'Closed Now', colorClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
  }

  private parseTimeToMinutes(timeStr: string): number {
    const time = timeStr.trim();
    const isPM = time.includes('pm');
    const cleanTime = time.replace('am', '').replace('pm', '').trim();
    const parts = cleanTime.split(':');
    let hours = parseInt(parts[0]);
    const minutes = parts.length > 1 ? parseInt(parts[1]) : 0;

    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  trackBySubcategory(_: number, sub: string): string {
    return sub;
  }

  // Verification freshness indicator based on lastAuditDate
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
        tooltip: `Last verified ${dateStr} — data is current and reliable`
      };
    } else if (monthsAgo <= 12) {
      return {
        label: `Verified: ${dateStr}`,
        colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        tooltip: `Last verified ${dateStr} — verification may be due for renewal`
      };
    } else {
      return {
        label: `Verified: ${dateStr}`,
        colorClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        tooltip: `Last verified ${dateStr} — verification has expired, data may be outdated`
      };
    }
  }

  // Helpers (Delegates to centralized Single Source of Truth)
  getTypeLabel(type: string): string {
    return getResourceTypeLabel(type, this.selectedLanguage);
  }

  getTypeBadgeClass(type: string): string {
    return getResourceTypeBadgeClass(type);
  }

  // Facility chips from existing backend data
  getFacilityChips(): { label: string; iconKey: string; tooltip: string }[] {
    const f = this.resource?.facilities;
    if (!f) return [];
    const chips: { label: string; iconKey: string; tooltip: string }[] = [];
    if (f.hasEfiling) chips.push({ label: 'e-Filing', iconKey: 'efiling', tooltip: 'e-Sewa Kendra digital filing desk available' });
    if (f.hasLADCS) chips.push({ label: 'LADCS', iconKey: 'ladcs', tooltip: 'Legal Aid Defense Counsel System available' });
    if (f.hasVCRoom) chips.push({ label: 'VC Room', iconKey: 'vcroom', tooltip: 'Video conferencing remand room' });
    if (f.hasLegalAidClinic) chips.push({ label: 'Clinic', iconKey: 'clinic', tooltip: 'Free legal aid clinic on-site' });
    if (f.isWheelchairAccessible) chips.push({ label: 'Accessible', iconKey: 'accessible', tooltip: 'Wheelchair accessible facility' });
    return chips;
  }

  navigateToDetail(): void {
    if (this.resource?._id) {
      this.router.navigate(['/legal-resources', this.resource._id]);
    }
  }

  onDirectionsClick(event: Event) {
    event.stopPropagation();
    if (this.directions.observed) {
      this.directions.emit(this.resource.coordinates);
    } else if (this.resource?.coordinates) {
      const { lat, lng } = this.resource.coordinates;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    }
  }

  getShareSubject(): string {
    return `Legal Support: ${this.resource?.name || 'Contact Details'}`;
  }

  getShareText(): string {
    if (!this.resource) return '';
    const typeLabel = this.getTypeLabel(this.resource.type);
    let text = `[Institution] ${this.resource.name}\n`;
    text += `----------------------------------------------\n`;
    text += `Type: ${typeLabel}\n`;
    if (this.resource.contactNumber) {
      text += `Contact: ${Array.isArray(this.resource.contactNumber) ? this.resource.contactNumber.join(', ') : this.resource.contactNumber}\n`;
    }
    if (this.resource.address) {
      text += `Address: ${this.resource.address}\n`;
    }
    const locationUrl = this.getShareUrl();
    if (locationUrl) {
      text += `Directions: ${locationUrl}\n`;
    }
    return text;
  }

  getShareUrl(): string {
    if (this.resource?.coordinates) {
      return `https://www.google.com/maps/dir/?api=1&destination=${this.resource.coordinates.lat},${this.resource.coordinates.lng}`;
    }
    return this.resource?.website || 'https://legalconnect.com';
  }

  getContactNumber(): string | null {
    if (!this.resource?.contactNumber) return null;
    if (Array.isArray(this.resource.contactNumber)) {
      return this.resource.contactNumber.length > 0 ? this.resource.contactNumber[0] : null;
    }
    if (typeof this.resource.contactNumber === 'string' && this.resource.contactNumber.trim().length > 0) {
      return this.resource.contactNumber.trim();
    }
    return null;
  }

  getWebsiteUrl(): string | null {
    return this.resource?.website || this.resource?.officialWebsite || null;
  }

  hasValidDistance(): boolean {
    return this.resource?.distanceKm !== null &&
      this.resource?.distanceKm !== undefined &&
      Number(this.resource.distanceKm) > 0;
  }

  copyAddress(event: Event): void {
    event.stopPropagation();
    const address = this.resource?.address || (this.resource?.city && this.resource?.state ? `${this.resource.city}, ${this.resource.state}` : '');
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      this.isAddressCopied = true;
      this.snackbar.show('Address copied to clipboard!');
      setTimeout(() => {
        this.isAddressCopied = false;
      }, 2000);
    }).catch(() => {
      this.snackbar.show('Could not copy address.');
    });
  }

  onQrClick(event: Event) {
    event.stopPropagation();
    if (this.showQr.observed) {
      this.showQr.emit(this.resource);
    } else {
      const contact = this.getContactNumber() || 'N/A';
      const dataString = `Name: ${this.resource.name}\nAddress: ${this.resource.address || 'N/A'}\nPhone: ${contact}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(dataString)}`;
      window.open(qrUrl, '_blank', 'width=350,height=350,status=no,toolbar=no,menubar=no,location=no');
    }
  }
}