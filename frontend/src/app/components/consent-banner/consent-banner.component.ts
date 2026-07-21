import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConsentService } from '../../services/consent.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-consent-banner',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective],
  templateUrl: './consent-banner.component.html',
  styleUrls: ['./consent-banner.component.scss'],
  animations: [
    trigger('bannerAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px) scale(0.97)' }),
        animate('420ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('280ms cubic-bezier(0.4, 0, 1, 1)',
          style({ opacity: 0, transform: 'translateY(12px) scale(0.98)' }))
      ])
    ])
  ]
})
export class ConsentBannerComponent implements OnInit {
  showBanner = false;

  constructor(private consentService: ConsentService) { }

  ngOnInit() {
    // Show banner after a brief delay to avoid layout flash
    setTimeout(() => {
      this.showBanner = !this.consentService.hasUserConsented();
    }, 1200);
  }

  acceptAll() {
    this.consentService.saveConsent(true, true).subscribe({
      next: () => {
        this.showBanner = false;
      }
    });
  }

  rejectAll() {
    this.consentService.saveConsent(false, false).subscribe({
      next: () => {
        this.showBanner = false;
      }
    });
  }
}