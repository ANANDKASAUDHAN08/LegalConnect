import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../../../directives/tooltip.directive';

@Component({
  selector: 'app-slsa-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './slsa-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SlsaCardComponent {
  @Input() resource: any;
  @Output() directions = new EventEmitter<{ lat: number, lng: number }>();

  get phoneNumbers(): string[] {
    if (!this.resource?.contactNumber) return [];
    return this.resource.contactNumber
      .split(/[,\/]/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);
  }

  get cleanEmail(): string {
    return this.resource?.email || '';
  }

  callPhone(num: string) {
    const cleaned = num.replace(/\s+/g, '').replace(/-/g, '');
    window.open(`tel:${cleaned}`, '_self');
  }

  openEmail() {
    if (this.cleanEmail) {
      window.open(`mailto:${this.cleanEmail}`, '_self');
    }
  }

  openWebsite() {
    if (this.resource?.website) {
      window.open(this.resource.website, '_blank');
    }
  }

  openDirections() {
    if (this.resource?.coordinates) {
      this.directions.emit(this.resource.coordinates);
    }
  }
}
