import { Component, OnInit, OnDestroy, HostListener, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { LawyerService, Lawyer } from '../../services/lawyer.service';
import { SnackbarService } from '../../services/snackbar.service';
import { AuthService, UserProfile } from '../../services/auth.service';
import { LawyerCardComponent } from '../../components/lawyer-card/lawyer-card.component';
import { LocationService } from '../../services/location.service';
import { LocationMapModalComponent } from '../../components/location-map-modal/location-map-modal.component';

declare var google: any;

@Component({
  selector: 'app-lawyers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LawyerCardComponent, LocationMapModalComponent],
  templateUrl: './lawyers.component.html',
  styleUrls: ['./lawyers.component.scss']
})
export class LawyersComponent implements OnInit, OnDestroy, AfterViewInit {
  // Raw and filtered lists
  allLawyers: Lawyer[] = [];
  filteredLawyers: Lawyer[] = [];

  // Meta filters loaded from backend
  cities: string[] = [];
  specializations: string[] = [];

  // Loading states
  loading = true;
  error = '';

  // Filter variables
  searchQuery = '';
  selectedLocation = '';
  applyLocationFilter = false;
  selectedPracticeAreas: { [key: string]: boolean } = {};
  selectedAvailability = 'any'; // 'any' | 'today' | 'week'
  minFee = 0;
  maxFee = 5000;

  // Sorting & Layout
  sortBy = 'bestMatch'; // 'bestMatch' | 'experience' | 'feeLow' | 'feeHigh'
  viewMode: 'grid' | 'list' = 'grid';
  showMobileFilters = false;
  showMobileSearch = false;

  // New filters: Experience & Rating
  selectedExperience = 0;
  selectedRating = 0;

  // Pagination
  currentPage = 1;

  // Custom sort dropdown properties
  showSortDropdown = false;
  sortOptions = [
    { value: 'bestMatch', label: 'Best Match' },
    { value: 'experience', label: 'Experience' },
    { value: 'feeLow', label: 'Price: Low to High' },
    { value: 'feeHigh', label: 'Price: High to Low' }
  ];

  // Image preview state
  previewImageUrl: string | null = null;
  private loadingTimeout: any;

  // Scroll states for mobile nav adjustment
  isScrolled = false;
  isMobile = false;

  // Location modal state
  showLocationModal = false;

  currentUser: UserProfile | null = null;
  private querySub: any;
  private locationSub: any;

  constructor(
    private lawyerService: LawyerService,
    private snackbar: SnackbarService,
    private auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private locationService: LocationService
  ) { }

  ngOnInit() {
    this.checkMobile();
    this.auth.currentUser$.subscribe(user => this.currentUser = user);

    // Subscribe to active location changes from global LocationService
    this.locationSub = this.locationService.activeLocation$.subscribe(loc => {
      this.selectedLocation = loc;
      this.applyFilters();
      this.cdr.markForCheck();
    });

    // Load metadata from backend
    this.lawyerService.getMeta().subscribe({
      next: res => {
        this.cities = res.data.cities;
        this.specializations = res.data.specializations;
        // Initialize checkboxes
        this.specializations.forEach(spec => {
          this.selectedPracticeAreas[spec] = false;
        });

        // After meta is loaded, read query params
        this.readQueryParamsAndLoad();
      },
      error: () => {
        this.readQueryParamsAndLoad();
      }
    });

    // Register scroll event outside Angular's zone to prevent change detection on every scroll pixel
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngAfterViewInit() {
    this.initSidebarLocationAutocomplete();
  }

  initSidebarLocationAutocomplete() {
    const searchInput = document.getElementById('lawyers-sidebar-location') as HTMLInputElement;
    if (searchInput && (window as any).google?.maps?.places) {
      const autocomplete = new google.maps.places.Autocomplete(searchInput, {
        componentRestrictions: { country: 'in' }
      });
      autocomplete.addListener('place_changed', () => {
        this.zone.run(() => {
          const place = autocomplete.getPlace();
          if (place.geometry) {
            const address = place.formatted_address || place.name;
            this.selectedLocation = address;
            this.applyFilters();
            this.cdr.markForCheck();
          } else if (place.name) {
            const query = place.name.trim();
            if ((window as any).google?.maps?.Geocoder) {
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ address: query, componentRestrictions: { country: 'IN' } }, (results: any[], status: string) => {
                this.zone.run(() => {
                  if (status === 'OK' && results[0]) {
                    const address = results[0].formatted_address;
                    this.selectedLocation = address;
                  } else {
                    this.selectedLocation = query;
                  }
                  this.applyFilters();
                  this.cdr.markForCheck();
                });
              });
            } else {
              this.selectedLocation = query;
              this.applyFilters();
              this.cdr.markForCheck();
            }
          }
        });
      });
    }
  }

  initMobileLocationAutocomplete() {
    const searchInput = document.getElementById('lawyers-mobile-location') as HTMLInputElement;
    if (searchInput && (window as any).google?.maps?.places) {
      const autocomplete = new google.maps.places.Autocomplete(searchInput, {
        componentRestrictions: { country: 'in' }
      });
      autocomplete.addListener('place_changed', () => {
        this.zone.run(() => {
          const place = autocomplete.getPlace();
          if (place.geometry) {
            const address = place.formatted_address || place.name;
            this.selectedLocation = address;
            this.applyFilters();
            this.cdr.markForCheck();
          } else if (place.name) {
            const query = place.name.trim();
            if ((window as any).google?.maps?.Geocoder) {
              const geocoder = new google.maps.Geocoder();
              geocoder.geocode({ address: query, componentRestrictions: { country: 'IN' } }, (results: any[], status: string) => {
                this.zone.run(() => {
                  if (status === 'OK' && results[0]) {
                    const address = results[0].formatted_address;
                    this.selectedLocation = address;
                  } else {
                    this.selectedLocation = query;
                  }
                  this.applyFilters();
                  this.cdr.markForCheck();
                });
              });
            } else {
              this.selectedLocation = query;
              this.applyFilters();
              this.cdr.markForCheck();
            }
          }
        });
      });
    }
  }

  resolveLocationQuery() {
    // Redundant since autocomplete handles Enter and click selections, keeping as no-op.
  }

  private extractCityFromAddress(address: string): string {
    if (!address) return '';
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      return parts[parts.length - 3].replace(/\b\d{5,}\b/g, '').trim();
    }
    return parts[0].replace(/\b\d{5,}\b/g, '').trim();
  }

  ngOnDestroy() {
    document.body.classList.remove('overflow-hidden');
    if (this.querySub) {
      this.querySub.unsubscribe();
    }
    if (this.locationSub) {
      this.locationSub.unsubscribe();
    }
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    window.removeEventListener('scroll', this.onScroll);
  }

  readQueryParamsAndLoad() {
    this.querySub = this.route.queryParams.subscribe(params => {
      this.searchQuery = params['q'] || '';
      
      const cityParam = params['city'] || '';
      if (cityParam) {
        this.locationService.setLocation(cityParam, false);
        this.applyLocationFilter = true;
      }

      const specParam = params['specialization'] || '';
      if (specParam) {
        // Reset and check this one
        Object.keys(this.selectedPracticeAreas).forEach(k => this.selectedPracticeAreas[k] = false);
        if (this.selectedPracticeAreas.hasOwnProperty(specParam)) {
          this.selectedPracticeAreas[specParam] = true;
        } else {
          // If it matches case insensitively
          const key = Object.keys(this.selectedPracticeAreas).find(k => k.toLowerCase() === specParam.toLowerCase());
          if (key) this.selectedPracticeAreas[key] = true;
        }
      }

      this.loadLawyers();
    });
  }

  loadLawyers() {
    this.loading = true;
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    this.lawyerService.getLawyers().subscribe({
      next: res => {
        this.loadingTimeout = setTimeout(() => {
          this.allLawyers = res.data;
          this.applyFilters();
          this.loading = false;
        }, 500);
      },
      error: () => {
        this.loadingTimeout = setTimeout(() => {
          this.error = 'Could not load lawyers. Please try again.';
          this.loading = false;
        }, 500);
      }
    });
  }

  applyFilters() {
    let result = [...this.allLawyers];

    // 1. Text Search Query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(lawyer =>
        lawyer.name.toLowerCase().includes(q) ||
        lawyer.bio.toLowerCase().includes(q) ||
        lawyer.specializations.some(s => s.toLowerCase().includes(q))
      );
    }

    // 2. Location Filter
    if (this.applyLocationFilter && this.selectedLocation.trim()) {
      const cleanLoc = this.extractCityFromAddress(this.selectedLocation).toLowerCase().trim();
      result = result.filter(lawyer =>
        lawyer.city.toLowerCase().includes(cleanLoc)
      );
    }

    // 3. Practice Areas (Specializations checkboxes)
    const selectedAreas = Object.keys(this.selectedPracticeAreas).filter(k => this.selectedPracticeAreas[k]);
    if (selectedAreas.length > 0) {
      result = result.filter(lawyer =>
        lawyer.specializations.some(spec => selectedAreas.includes(spec))
      );
    }

    // 4. Availability
    if (this.selectedAvailability === 'today') {
      result = result.filter(lawyer => lawyer.isAvailable !== false);
    } else if (this.selectedAvailability === 'week') {
      // Simulate "this week" as available or high rating
      result = result.filter(lawyer => lawyer.isAvailable !== false || lawyer.rating >= 4.7);
    }

    // 5. Price Range (Consultation Fee)
    result = result.filter(lawyer => {
      const fee = lawyer.consultationFee || 0;
      return fee >= this.minFee && fee <= this.maxFee;
    });

    // 6. Experience Filter
    if (this.selectedExperience > 0) {
      result = result.filter(lawyer => lawyer.experience >= this.selectedExperience);
    }

    // 7. Minimum Rating Filter
    if (this.selectedRating > 0) {
      result = result.filter(lawyer => lawyer.rating >= this.selectedRating);
    }

    // 8. Sorting
    if (this.sortBy === 'bestMatch') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (this.sortBy === 'experience') {
      result.sort((a, b) => b.experience - a.experience);
    } else if (this.sortBy === 'feeLow') {
      result.sort((a, b) => (a.consultationFee || 0) - (b.consultationFee || 0));
    } else if (this.sortBy === 'feeHigh') {
      result.sort((a, b) => (b.consultationFee || 0) - (a.consultationFee || 0));
    }

    this.filteredLawyers = result;
    this.currentPage = 1;
  }

  get itemsPerPage(): number {
    return this.isMobile ? 8 : 10;
  }

  get paginatedLawyers(): Lawyer[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredLawyers.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredLawyers.length / this.itemsPerPage);
  }

  get pageNumbers(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // Chip helpers
  getActiveChips(): string[] {
    const chips: string[] = [];
    if (this.applyLocationFilter && this.selectedLocation) {
      chips.push(`Location: ${this.cleanLocation(this.selectedLocation)}`);
    }
    if (this.selectedAvailability !== 'any') {
      chips.push(this.selectedAvailability === 'today' ? 'Available Today' : 'Available This Week');
    }
    Object.keys(this.selectedPracticeAreas).forEach(key => {
      if (this.selectedPracticeAreas[key]) {
        chips.push(key);
      }
    });
    if (this.minFee > 0 || this.maxFee < 5000) {
      chips.push(`Fee: ₹${this.minFee} - ₹${this.maxFee}`);
    }
    if (this.selectedExperience > 0) {
      chips.push(`Exp: ${this.selectedExperience}+ Yrs`);
    }
    if (this.selectedRating > 0) {
      chips.push(`Rating: ${this.selectedRating}+ ★`);
    }
    return chips;
  }

  removeChip(chip: string) {
    if (chip.startsWith('Location: ')) {
      this.applyLocationFilter = false;
    } else if (chip === 'Available Today' || chip === 'Available This Week') {
      this.selectedAvailability = 'any';
    } else if (chip.startsWith('Fee: ')) {
      this.minFee = 0;
      this.maxFee = 5000;
    } else if (chip.startsWith('Exp: ')) {
      this.selectedExperience = 0;
    } else if (chip.startsWith('Rating: ')) {
      this.selectedRating = 0;
    } else {
      if (this.selectedPracticeAreas.hasOwnProperty(chip)) {
        this.selectedPracticeAreas[chip] = false;
      }
    }
    this.applyFilters();
  }

  clearAllFilters() {
    this.searchQuery = '';
    this.applyLocationFilter = false;
    this.selectedAvailability = 'any';
    this.minFee = 0;
    this.maxFee = 5000;
    this.selectedExperience = 0;
    this.selectedRating = 0;
    Object.keys(this.selectedPracticeAreas).forEach(k => this.selectedPracticeAreas[k] = false);
    this.applyFilters();
  }

  // TrackBy for *ngFor performance — avoids full DOM re-renders on filter/sort
  trackByLawyerId(_index: number, lawyer: Lawyer): string {
    return lawyer._id;
  }

  useMyLocation() {
    if (!navigator.geolocation) {
      this.snackbar.show('Geolocation not supported by your browser.', 'warning');
      return;
    }
    this.snackbar.show('Locating your position...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if ((window as any).google?.maps?.Geocoder) {
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
            this.zone.run(() => {
              if (status === 'OK' && results[0]) {
                const address = results[0].formatted_address;
                this.locationService.setLocation(address, false);
                this.applyLocationFilter = true;
                const clean = this.locationService.cleanAddress(address);
                this.snackbar.show(`Location set to ${clean}`, 'success');
              } else {
                this.locationService.setLocation('New Delhi', false);
                this.applyLocationFilter = true;
                this.snackbar.show('Could not detect address. Defaulted to New Delhi.', 'info');
              }
            });
          });
        } else {
          this.locationService.setLocation('New Delhi', false);
          this.applyLocationFilter = true;
          this.snackbar.show('Location set to New Delhi.', 'success');
        }
      },
      () => {
        this.locationService.setLocation('New Delhi', false);
        this.applyLocationFilter = true;
        this.snackbar.show('Could not access location. Defaulted to New Delhi.', 'info');
      }
    );
  }

  openLocationModal() {
    this.showLocationModal = true;
    this.cdr.markForCheck();
  }

  closeLocationModal() {
    this.showLocationModal = false;
    this.cdr.markForCheck();
  }

  onMapLocationConfirmed(event: { address: string; lat: number; lng: number }) {
    this.locationService.setLocation(event.address, false, { lat: event.lat, lng: event.lng });
    this.applyLocationFilter = true;
    this.closeLocationModal();
  }

  cleanLocation(loc: string): string {
    return this.locationService.cleanAddress(loc);
  }

  getSelectedPracticeAreasCount(): number {
    return Object.values(this.selectedPracticeAreas).filter(Boolean).length;
  }

  toggleMobileFilters() {
    this.showMobileFilters = !this.showMobileFilters;
    if (this.showMobileFilters) {
      document.body.classList.add('overflow-hidden');
      setTimeout(() => this.initMobileLocationAutocomplete(), 100);
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }

  toggleSortDropdown(event: Event) {
    event.stopPropagation();
    this.showSortDropdown = !this.showSortDropdown;
  }

  selectSort(val: string, event: Event) {
    event.stopPropagation();
    this.sortBy = val;
    this.showSortDropdown = false;
    this.applyFilters();
  }

  getSortLabel(val: string): string {
    const opt = this.sortOptions.find(o => o.value === val);
    return opt ? opt.label : 'Best Match';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick() {
    this.showSortDropdown = false;
  }

  // Card interaction handlers
  goToDetail(id: string) {
    this.router.navigate(['/lawyers', id]);
  }

  // Triggered by (bookClick) output from app-lawyer-card
  onCardBookClick(id: string) {
    this.router.navigate(['/lawyers', id], { queryParams: { action: 'book' } });
  }

  // Triggered by (messageClick) output from app-lawyer-card
  onCardMessageClick(id: string) {
    this.router.navigate(['/lawyers', id], { queryParams: { action: 'message' } });
  }

  openImagePreview(url: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.previewImageUrl = url;
  }

  closeImagePreview() {
    this.previewImageUrl = null;
  }

  goToSpecialization(specName: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.router.navigate(['/specializations'], { queryParams: { name: specName } });
  }

  private onScroll = () => {
    const scrolled = window.scrollY > 20;
    if (scrolled !== this.isScrolled) {
      this.zone.run(() => {
        this.isScrolled = scrolled;
        this.cdr.markForCheck();
      });
    }
  };

  openMobileSearch() {
    this.showMobileSearch = true;
    setTimeout(() => {
      const searchInput = document.getElementById('mobileSearchInput');
      if (searchInput) {
        searchInput.focus();
      }
    }, 50);
  }

  closeMobileSearch() {
    this.showMobileSearch = false;
  }

  @HostListener('window:resize', [])
  onResize() {
    this.checkMobile();
  }

  private checkMobile() {
    const oldIsMobile = this.isMobile;
    this.isMobile = window.innerWidth < 768;
    if (oldIsMobile !== this.isMobile) {
      this.currentPage = 1;
    }
  }
}