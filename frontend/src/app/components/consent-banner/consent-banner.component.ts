import { Component, ChangeDetectionStrategy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { ConsentService } from '../../services/consent.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-consent-banner',
  standalone: true,
  imports: [CommonModule, RouterLink, TooltipDirective],
  templateUrl: './consent-banner.component.html',
  styleUrls: ['./consent-banner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class ConsentBannerComponent {
  // Signal tracking current route path
  private currentPath = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(e => e.urlAfterRedirects.split('?')[0].split('#')[0])
    ),
    { initialValue: typeof window !== 'undefined' ? window.location.pathname : '/' }
  );

  // Computed signal for banner visibility — 100% reactive, declarative & memory-leak free!
  showBanner = computed(() => {
    if (this.consentService.hasUserConsented()) {
      return false;
    }
    return this.currentPath() !== '/cookie-preferences';
  });

  constructor(
    public consentService: ConsentService,
    private router: Router
  ) { }

  acceptAll() {
    this.consentService.saveConsent(true, true).subscribe();
  }

  rejectAll() {
    this.consentService.saveConsent(false, false).subscribe();
  }
}