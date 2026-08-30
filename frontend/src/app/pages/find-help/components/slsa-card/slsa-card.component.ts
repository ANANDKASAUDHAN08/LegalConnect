import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { SnackbarService } from '../../../../services/snackbar.service';
import { IconComponent } from '../../../../components/icon';

@Component({
  selector: 'app-slsa-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective, IconComponent],
  templateUrl: './slsa-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SlsaCardComponent {
  @Input() resource: any;
  @Output() directions = new EventEmitter<{ lat: number, lng: number }>();

  constructor(private snackbar: SnackbarService) { }

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
    this.snackbar.show(`Calling ${num}...`, 'info');
    window.open(`tel:${cleaned}`, '_self');
  }

  openEmail() {
    if (this.cleanEmail) {
      this.snackbar.show(`Opening email to ${this.cleanEmail}...`, 'info');
      window.open(`mailto:${this.cleanEmail}`, '_self');
    }
  }

  openWebsite() {
    if (this.resource?.website) {
      this.snackbar.show('Opening official portal website in a new tab...', 'info');
      window.open(this.resource.website, '_blank');
    }
  }

  openDirections() {
    if (this.resource?.coordinates) {
      this.snackbar.show('Locating directions on map...', 'info');
      this.directions.emit(this.resource.coordinates);
    }
  }
}