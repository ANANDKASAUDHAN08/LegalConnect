import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { SnackbarService } from '../../../../services/snackbar.service';
import { LocationService } from '../../../../services/location.service';

@Component({
  selector: 'app-sos-drawer',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './sos-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SosDrawerComponent {
  @Input() showSosDrawer = false;
  @Output() toggleSosDrawer = new EventEmitter<boolean>();

  private snackbarService = inject(SnackbarService);
  private locationService = inject(LocationService);

  sendEmergencySms(): void {
    const activeCity = this.locationService.getCurrentLocation() || 'India';
    const coords = this.locationService.getCoordinates();

    let locationParam = activeCity;
    if (coords && coords.lat && coords.lng) {
      locationParam = `https://maps.google.com/?q=${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`;
    }

    const messageText = encodeURIComponent(
      `EMERGENCY ALERT: I require urgent safety and legal intervention. My current location is: ${locationParam}. Please dispatch immediate help.`
    );

    this.snackbarService.show('Opening Emergency SMS app with location coordinates...', 'info');
    window.open(`sms:?body=${messageText}`, '_blank');
  }

  openNcwWhatsApp(): void {
    this.snackbarService.show('Connecting to National Commission for Women (NCW) WhatsApp Hotline...', 'info');
    const msg = encodeURIComponent('EMERGENCY: I need immediate legal assistance and protection support.');
    window.open(`https://wa.me/917217735372?text=${msg}`, '_blank');
  }

  openCyberCellWhatsApp(): void {
    this.snackbarService.show('Redirecting to 1930 Cyber Fraud Reporting Portal...', 'info');
    window.open('https://cybercrime.gov.in/', '_blank');
  }
}