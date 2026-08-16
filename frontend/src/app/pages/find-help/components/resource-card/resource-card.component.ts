import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, OnInit, OnChanges, SimpleChanges, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { SavedItemsService } from '../../../../services/saved-items.service';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';
import { SnackbarService } from '../../../../services/snackbar.service';
import { calculateCourtOperatingStatus, OperatingStatus } from '../../../../utils/operating-hours.util';

@Component({
  selector: 'app-resource-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective, ShareMenuComponent],
  templateUrl: './resource-card.component.html',
  styles: [`:host { display: block; height: 100%; }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceCardComponent implements OnInit, OnChanges {
  @Input() resource: any;
  @Input() isFreeAidEligible = false;
  @Input() loading = false;

  @Output() bookmark = new EventEmitter<string>();
  @Output() directions = new EventEmitter<{ lat: number; lng: number }>();
  @Output() showQr = new EventEmitter<any>();

  operatingStatus!: OperatingStatus;

  // Reactive saved state
  isSaved = computed(() => (this.resource?._id ? this.savedItems.isSavedResource(this.resource._id) : false));

  constructor(
    private savedItems: SavedItemsService,
    private snackbar: SnackbarService
  ) {}

  ngOnInit(): void {
    this.updateOperatingStatus();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['resource'] || changes['loading']) {
      this.updateOperatingStatus();
    }
  }

  private updateOperatingStatus(): void {
    if (!this.loading && this.resource) {
      this.operatingStatus = calculateCourtOperatingStatus();
    } else {
      this.operatingStatus = {
        isOpen: true,
        isLunch: false,
        label: 'Open Now',
        colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dotColorClass: 'bg-emerald-500',
        detailText: 'Open today until 5:00 PM IST'
      };
    }
  }

  copyCardDetails(): void {
    const text = this.getShareText() + `\nShared via LegalConnect Find-Help Portal`;
    navigator.clipboard.writeText(text).then(() => {
      this.snackbar.show('Contact details copied to clipboard!', 'success');
    }).catch(() => {
      this.snackbar.show('Could not copy contact details.', 'error');
    });
  }

  onBookmarkClick(event: Event): void {
    event.stopPropagation();
    if (this.resource?._id) {
      this.savedItems.toggleResource(this.resource._id, this.resource.name);
      this.bookmark.emit(this.resource._id);
    }
  }

  trackBySubcategory(_: number, sub: string): string {
    return sub;
  }

  onDirectionsClick(event: Event): void {
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
    const typeLabel = this.resource.type === 'LegalAid' ? 'Legal Aid Center' : this.resource.type === 'Court' ? 'District Court' : 'Government Office';
    let text = `${this.resource.name}\n`;
    text += `----------------------------------------------\n`;
    text += `Type: ${typeLabel}\n`;
    if (this.resource.contactNumber) {
      text += `Contact: ${this.resource.contactNumber}\n`;
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

  onQrClick(event: Event): void {
    event.stopPropagation();
    if (this.showQr.observed) {
      this.showQr.emit(this.resource);
    } else {
      const dataString = `Name: ${this.resource.name}\nAddress: ${this.resource.address || 'N/A'}\nPhone: ${this.resource.contactNumber || 'N/A'}`;
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(dataString)}`;
      window.open(qrUrl, '_blank', 'width=350,height=350,status=no,toolbar=no,menubar=no,location=no');
    }
  }
}