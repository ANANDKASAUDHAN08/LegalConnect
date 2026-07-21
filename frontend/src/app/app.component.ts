import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { SnackbarComponent } from './components/snackbar/snackbar.component';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav.component';
import { WhatsNewModalComponent } from './components/whats-new-modal/whats-new-modal.component';
import { VersionReloadPillComponent } from './components/version-reload-pill/version-reload-pill.component';
import { PwaInstallBannerComponent } from './components/pwa-install-banner/pwa-install-banner.component';
import { ConsentBannerComponent } from './components/consent-banner/consent-banner.component';
import { ThemeService } from './services/theme.service';
import { SettingsService } from './services/settings.service';

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
    ConsentBannerComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'LegalConnect';
  constructor(
    private themeService: ThemeService,
    private settingsService: SettingsService
  ) { }
}