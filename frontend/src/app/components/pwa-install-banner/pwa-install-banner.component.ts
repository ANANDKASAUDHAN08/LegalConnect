import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaInstallService } from '../../services/pwa-install.service';
import { TooltipDirective } from '../../directives/tooltip.directive';

@Component({
  selector: 'app-pwa-install-banner',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './pwa-install-banner.component.html',
  styleUrls: ['./pwa-install-banner.component.scss']
})
export class PwaInstallBannerComponent implements OnInit, OnDestroy {
  pwaInstall = inject(PwaInstallService);
  isVisible = false; // Hidden initially on page load
  isLeaving = false;

  private showTimer: any = null;
  private autoDismissTimer: any = null;

  ngOnInit() {
    if (typeof window !== 'undefined') {
      // 1. Wait 2.5 seconds after page loads before popping up with movement animation
      this.showTimer = setTimeout(() => {
        this.isVisible = true;

        // 2. Stay visible for 7 seconds, then auto-dismiss gracefully
        this.autoDismissTimer = setTimeout(() => {
          this.dismissBanner();
        }, 7000);
      }, 2500);
    }
  }

  ngOnDestroy() {
    if (this.showTimer) clearTimeout(this.showTimer);
    if (this.autoDismissTimer) clearTimeout(this.autoDismissTimer);
  }

  installApp() {
    this.pwaInstall.promptInstall();
    this.dismissBanner();
  }

  dismissBanner() {
    if (this.isLeaving || !this.isVisible) return;
    this.isLeaving = true;

    if (this.autoDismissTimer) {
      clearTimeout(this.autoDismissTimer);
      this.autoDismissTimer = null;
    }

    // Wait 350ms for pop-out exit animation to finish
    setTimeout(() => {
      this.isVisible = false;
      this.isLeaving = false;
    }, 350);
  }
}