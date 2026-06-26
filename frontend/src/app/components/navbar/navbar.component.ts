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
    if (!navigator.geolocation) {
      this.snackbar.show('Geolocation not supported by your browser.', 'warning');
      return;
    }

    // Close dropdown and show detecting state in pill
    this.dropdownOpen = false;
    this.isDetecting = true;
    this.detectingText = 'Detecting...';
    this.cdr.markForCheck();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.zone.run(() => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.detectingText = 'Getting address...';

          // Reverse geocoding using Google Geocoding API (if available)
          this.reverseGeocodeToCity(lat, lng);
        });
      },
      (err) => {
        this.zone.run(() => {
          console.warn('Geolocation error', err);
          this.isDetecting = false;
          this.detectingText = '';
          this.snackbar.show('Failed to detect location. Please search manually.', 'error');
        });
      },
      { timeout: 10000 }
    );
  }

  private reverseGeocodeToCity(lat: number, lng: number) {
    const apiKey = (window as any).GOOGLE_MAPS_API_KEY || '';

    if (apiKey && (window as any).google?.maps) {
      const geocoder = new (window as any).google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
        this.zone.run(() => {
          this.isDetecting = false;
          this.detectingText = '';

          if (status === 'OK' && results[0]) {
            const address = results[0].formatted_address;
            this.locationService.setLocation(address, false);
            const clean = this.locationService.cleanAddress(address);
            const displayAddress = clean.length > 20 ? clean.substring(0, 17) + '...' : clean;
            this.snackbar.show(`Location set to ${displayAddress}`, 'success');
          } else {
            this.fallbackCityDetection(lat, lng);
          }
        });
      });
    } else {
      // Fallback: proximity-based city detection
      setTimeout(() => {
        this.zone.run(() => {
          this.isDetecting = false;
          this.detectingText = '';
          this.fallbackCityDetection(lat, lng);
        });
      }, 800);
    }
  }

  private extractCityFromGeocoderResult(result: any): string {
    const components = result.address_components || [];
    // Try locality first, then sublocality, then administrative_area_level_2
    const levels = ['locality', 'sublocality_level_1', 'administrative_area_level_2', 'administrative_area_level_1'];
    for (const level of levels) {
      const component = components.find((c: any) => c.types.includes(level));
      if (component) return component.long_name;
    }
    return result.formatted_address?.split(',')[0] || 'New Delhi';
  }

  private fallbackCityDetection(lat: number, lng: number): void {
    let detectedCity = 'New Delhi';
    const cities = [
      { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
      { name: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
      { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
      { name: 'Kolkata', lat: 22.5726, lng: 88.3639 },
      { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
      { name: 'Pune', lat: 18.5204, lng: 73.8567 },
      { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
      { name: 'Jaipur', lat: 26.9124, lng: 75.7873 },
      { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
      { name: 'New Delhi', lat: 28.6139, lng: 77.2090 }
    ];

    let minDist = Infinity;
    for (const city of cities) {
      const d = Math.sqrt(Math.pow(lat - city.lat, 2) + Math.pow(lng - city.lng, 2));
      if (d < minDist) {
        minDist = d;
        detectedCity = city.name;
      }
    }

    this.locationService.setLocation(detectedCity, false);
    this.snackbar.show(`Location set to ${detectedCity}`, 'success');
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

  onMapLocationConfirmed(address: string) {
    this.showMapModal = false;
    this.locationService.setLocation(address, false);
    const clean = this.locationService.cleanAddress(address);
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
    this.auth.logout().subscribe();
    this.snackbar.show('Logged out successfully. See you soon!', 'info');
    this.menuOpen = false;
    this.cdr.markForCheck();
  }
}