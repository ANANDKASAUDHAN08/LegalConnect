import { Component, HostListener } from '@angular/core';
import { RouterOutlet, ChildrenOutletContexts } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { SnackbarComponent } from './components/snackbar/snackbar.component';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav.component';
import { WhatsNewModalComponent } from './components/whats-new-modal/whats-new-modal.component';
import { VersionReloadPillComponent } from './components/version-reload-pill/version-reload-pill.component';
import { PwaInstallBannerComponent } from './components/pwa-install-banner/pwa-install-banner.component';
import { ConsentBannerComponent } from './components/consent-banner/consent-banner.component';
import { CommandPaletteComponent } from './components/command-palette/command-palette.component';
import { KeyboardShortcutsModalComponent } from './components/keyboard-shortcuts-modal/keyboard-shortcuts-modal.component';
import { PrintExportModalComponent } from './components/print-export-modal/print-export-modal.component';
import { ReportModalComponent } from './components/report-modal/report-modal/report-modal.component';
import { ThemeService } from './services/theme.service';
import { SettingsService } from './services/settings.service';
import { AuthService } from './services/auth.service';
import { SeoService } from './services/seo.service';
import { PrintService } from './services/print.service';
import { routeTransitionAnimation } from './core/animations/route.animations';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    NavbarComponent,
    FooterComponent,
    SnackbarComponent,
    BottomNavComponent,
    WhatsNewModalComponent,
    VersionReloadPillComponent,
    PwaInstallBannerComponent,
    ConsentBannerComponent,
    CommandPaletteComponent,
    KeyboardShortcutsModalComponent,
    PrintExportModalComponent,
    ReportModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [routeTransitionAnimation]
})
export class AppComponent {
  title = 'LegalConnect';
  constructor(
    private themeService: ThemeService,
    private settingsService: SettingsService,
    private seoService: SeoService,
    private authService: AuthService,
    private printService: PrintService,
    private contexts: ChildrenOutletContexts
  ) {
    // Auth session is hydrated by APP_INITIALIZER (checkSession)
    // Google OAuth uses popup-only flow — no redirect listener needed
  }

  /** Intercept native Ctrl+P / Cmd+P keyboard shortcuts globally for official print output */
  @HostListener('window:keydown', ['$event'])
  handleGlobalPrintKey(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key?.toLowerCase() === 'p') {
      const activeComponent = (this.contexts.getContext('primary')?.outlet?.component || {}) as any;

      // Check if active route component exposes a custom print action
      const printMethod = activeComponent.triggerPrint
        || activeComponent.print
        || activeComponent.printDirectory
        || activeComponent.printPage
        || activeComponent.printActiveSection;

      if (typeof printMethod === 'function') {
        event.preventDefault();
        event.stopPropagation();
        printMethod.call(activeComponent);
      }
      // If no custom print method is defined, allow default browser print to use _print.scss
    }
  }

  /** Provides the route path to the animation trigger so it fires on every navigation */
  getRouteAnimationData() {
    return this.contexts.getContext('primary')?.route?.snapshot?.url;
  }
}