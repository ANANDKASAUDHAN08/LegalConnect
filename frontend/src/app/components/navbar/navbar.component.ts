import { Component, HostListener, OnInit, OnDestroy, ChangeDetectorRef, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe, NgClass, NgIf, NgForOf, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { NotificationService } from '../../services/notification.service';
import { SnackbarService } from '../../services/snackbar.service';
import { LocationService } from '../../services/location.service';
import { MobileMenuComponent } from '../mobile-menu/mobile-menu.component';
import { UserProfileMenuComponent } from '../user-profile-menu/user-profile-menu.component';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { LocationMapModalComponent } from '../location-map-modal/location-map-modal.component';
import { Subscription } from 'rxjs';
import { ScrollService } from '../../services/scroll.service';
import { NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { PwaInstallService } from '../../services/pwa-install.service';
import { SystemAnnouncementService } from '../../services/system-announcement.service';

declare var google: any;

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    AsyncPipe,
    NgClass,
    NgIf,
    NgForOf,
    UpperCasePipe,
    FormsModule,
    MobileMenuComponent,
    UserProfileMenuComponent,
    TooltipDirective,
    LocationMapModalComponent
  ],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NavbarComponent implements OnInit, OnDestroy {
  menuOpen = false;
  isScrolled = false;
  showNavbar = true;
  scrollPercentage = 0;
  showProgressBar = false;

  // Location Selection state
  dropdownOpen = false;
  activeLocation = 'New Delhi';
  isLocationEstimated = true;
  searchQuery = '';

  // GPS detecting states (for pill text)
  isDetecting = false;
  detectingText = '';

  // Map modal state
  showMapModal = false;

  private locationSub!: Subscription;
  private scrollSub!: Subscription;
  private routerSub!: Subscription;

  constructor(
    public auth: AuthService,
    public themeService: ThemeService,
    public notificationService: NotificationService,
    public pwaInstall: PwaInstallService,
    public systemAnnouncements: SystemAnnouncementService,
    private snackbar: SnackbarService,
    public router: Router,
    private locationService: LocationService,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private scrollService: ScrollService
  ) { }

  ngOnInit() {
    this.locationSub = this.locationService.activeLocation$.subscribe(loc => {
      this.activeLocation = loc;
      this.cdr.markForCheck();
    });
    this.locationSub.add(
      this.locationService.isEstimated$.subscribe(est => {
        this.isLocationEstimated = est;
        this.cdr.markForCheck();
      })
    );

    // Subscribe to ScrollService events
    this.scrollSub = this.scrollService.isScrolled$.subscribe(scrolled => {
      this.isScrolled = scrolled;
      this.cdr.markForCheck();
    });

    this.scrollSub.add(
      this.scrollService.scrollPercentage$.subscribe(pct => {
        this.scrollPercentage = pct;
        this.cdr.markForCheck();
      })
    );

    // Track active route changes to show/hide reading progress bar
    this.updateProgressBarVisibility(this.router.url);
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateProgressBarVisibility(event.urlAfterRedirects || event.url);
    });
  }

  ngOnDestroy() {
    if (this.locationSub) {
      this.locationSub.unsubscribe();
    }
    if (this.scrollSub) {
      this.scrollSub.unsubscribe();
    }
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }

  private updateProgressBarVisibility(url: string) {
    this.showProgressBar = url.includes('/laws/') || url.includes('/lawyers/');
    this.cdr.markForCheck();
  }


  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (this.dropdownOpen) {
      const target = event.target as HTMLElement;
      if (!target.closest('.location-selector-container')) {
        this.dropdownOpen = false;
        this.cdr.markForCheck();
      }
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.router.navigate(['/search']);
    }
    if (event.key === 'Escape' && this.showMapModal) {
      this.closeMapModal();
    }
  }

  toggleLocationDropdown(event: Event) {
    event.stopPropagation();
    this.dropdownOpen = !this.dropdownOpen;
    this.cdr.markForCheck();
    if (this.dropdownOpen) {
      setTimeout(() => {
        this.initNavbarAutocomplete();
      }, 50);
    }
  }

  initNavbarAutocomplete() {
    const searchInput = document.getElementById('location-search-input') as HTMLInputElement;
    if (searchInput && (window as any).google?.maps?.places) {
      const autocomplete = new google.maps.places.Autocomplete(searchInput, {
        componentRestrictions: { country: 'in' }
      });
      autocomplete.addListener('place_changed', () => {
        this.zone.run(() => {
          const place = autocomplete.getPlace();
          if (place.geometry) {
            const address = place.formatted_address || place.name;
            this.selectLocation(address, false);
            this.searchQuery = '';
            this.cdr.markForCheck();
          } else if (place.name) {
            // Fallback: geocode raw text entered by user
            const query = place.name.trim();

            // Close dropdown immediately and show resolving state in navbar pill
            this.dropdownOpen = false;
            this.isDetecting = true;
            this.detectingText = 'Resolving...';
            this.cdr.markForCheck();

            if ((window as any).google?.maps?.Geocoder) {
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ address: query, componentRestrictions: { country: 'IN' } }, (results: any[], status: string) => {
                this.zone.run(() => {
                  this.isDetecting = false;
                  this.detectingText = '';
                  if (status === 'OK' && results[0]) {
                    const address = results[0].formatted_address;
                    this.selectLocation(address, false);
                  } else {
                    this.selectLocation(query, false);
                  }
                  this.searchQuery = '';
                  this.cdr.markForCheck();
                });
              });
            } else {
              this.isDetecting = false;
              this.detectingText = '';
              this.selectLocation(query, false);
              this.searchQuery = '';
              this.cdr.markForCheck();
            }
          }
        });
      });
    }
  }

  selectLocation(city: string, isEstimated: boolean = false) {
    this.locationService.setLocation(city, isEstimated);
    this.dropdownOpen = false;
    this.snackbar.show(`Location switched to ${city}`, 'success');
  }

  selectCustomLocation() {
    // Redundant since autocomplete handles place selection and enter key, keeping as no-op to avoid breaking HTML compilation
  }

  useCurrentLocation() {
    // Close dropdown and show detecting state in pill
    this.dropdownOpen = false;
    this.isDetecting = true;
    this.detectingText = 'Detecting...';
    this.cdr.markForCheck();

    this.locationService.detectGpsPosition()
      .then(async (coords) => {
        this.detectingText = 'Getting address...';
        this.cdr.markForCheck();

        const address = await this.locationService.reverseGeocode(coords.lat, coords.lng);
        this.zone.run(() => {
          this.isDetecting = false;
          this.detectingText = '';
          this.locationService.setLocation(address, false, coords);
          const clean = this.locationService.cleanAddress(address);
          const displayAddress = clean.length > 20 ? clean.substring(0, 17) + '...' : clean;
          this.snackbar.show(`Location set to ${displayAddress}`, 'success');
          this.cdr.markForCheck();
        });
      })
      .catch((err) => {
        this.zone.run(() => {
          console.warn('Geolocation error', err);
          this.isDetecting = false;
          this.detectingText = '';
          this.snackbar.show('Failed to detect location. Please search manually.', 'error');
          this.cdr.markForCheck();
        });
      });
  }

  openMapModal(event?: Event) {
    if (event) event.stopPropagation();
    this.dropdownOpen = false;
    this.showMapModal = true;
    this.cdr.markForCheck();
  }

  closeMapModal() {
    this.showMapModal = false;
    this.cdr.markForCheck();
  }

  onMapLocationConfirmed(event: { address: string; lat: number; lng: number }) {
    this.showMapModal = false;
    this.locationService.setLocation(event.address, false, { lat: event.lat, lng: event.lng });
    const clean = this.locationService.cleanAddress(event.address);
    const displayAddress = clean.length > 20 ? clean.substring(0, 17) + '...' : clean;
    this.snackbar.show(`Location set to ${displayAddress}`, 'success');
    this.cdr.markForCheck();
  }

  getLocationTooltip(): string {
    if (this.isLocationEstimated) {
      return `Location set to default (${this.activeLocation}). Click to set your exact location.`;
    }
    return `Location set to ${this.activeLocation}. Click to change.`;
  }

  truncateLocation(loc: string): string {
    if (!loc) return '';
    return loc.length > 18 ? loc.substring(0, 15) + '...' : loc;
  }

  cleanLocation(loc: string): string {
    return this.locationService.cleanAddress(loc);
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
    this.cdr.markForCheck();
  }

  logout() {
    this.snackbar.show('Logged out successfully. See you soon!', 'info');
    this.menuOpen = false;
    this.cdr.markForCheck();
    this.auth.logout().subscribe();
  }
}