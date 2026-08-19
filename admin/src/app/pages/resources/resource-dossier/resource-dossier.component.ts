import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LegalResourceItem } from '../../legal-content/legal-content.models';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { ToastService } from '../../../shared/services/toast.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'admin-resource-dossier',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './resource-dossier.component.html',
  styleUrl: './resource-dossier.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceDossierComponent {
  @Input({ required: true }) item: LegalResourceItem | null = null;
  @Input() activeTab: 'overview' | 'facilities' | 'leadership' | 'audit' = 'overview';
  @Input() isVerifyingCycle = false;

  @Output() closed = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<LegalResourceItem>();
  @Output() renewRequested = new EventEmitter<LegalResourceItem>();
  @Output() activeTabChange = new EventEmitter<'overview' | 'facilities' | 'leadership' | 'audit'>();

  constructor(
    private toast: ToastService,
    private sanitizer: DomSanitizer
  ) { }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  setTab(tab: 'overview' | 'facilities' | 'leadership' | 'audit'): void {
    this.activeTab = tab;
    this.activeTabChange.emit(tab);
  }

  close(): void {
    this.closed.emit();
  }

  onEdit(): void {
    if (this.item) {
      this.editRequested.emit(this.item);
    }
  }

  onRenew(): void {
    if (this.item) {
      this.renewRequested.emit(this.item);
    }
  }

  mapType: 'roadmap' | 'satellite' = 'roadmap';

  toggleMapType(): void {
    this.mapType = this.mapType === 'roadmap' ? 'satellite' : 'roadmap';
  }

  // --- Embedded Google Maps Pinpoint Sanitizer ---
  get safeMapUrl(): SafeResourceUrl {
    const lat = this.item?.coordinates?.lat || 28.6139;
    const lng = this.item?.coordinates?.lng || 77.2090;
    const apiKey = (environment as any).googleMapsApiKey;
    let url: string;
    if (apiKey) {
      if (this.mapType === 'satellite') {
        url = `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lat},${lng}&zoom=17&maptype=satellite`;
      } else {
        url = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=16`;
      }
    } else {
      url = `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=16&output=embed`;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  // --- Verification Expiration Days Calculation ---
  get daysUntilExpiry(): number | null {
    if (!this.item?.verificationExpiry) return null;
    const expiry = new Date(this.item.verificationExpiry).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  // --- Export Dossier JSON ---
  exportDossierJson(): void {
    if (!this.item) return;
    const filename = `dossier_${(this.item.name || 'institution').toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
    const blob = new Blob([JSON.stringify(this.item, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Downloaded Institution Dossier JSON.');
  }

  copyToClipboard(text: string, label = 'Content'): void {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        this.toast.success(`${label} copied to clipboard.`);
      }).catch(() => {
        this.toast.info(`${label}: ${text}`);
      });
    } else {
      this.toast.info(`${label}: ${text}`);
    }
  }
}