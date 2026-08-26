import {
  Component, OnInit, AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy, NgZone, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { LegalService } from '../../services/legal.service';
import { LocationService } from '../../services/location.service';
import { ThemeService } from '../../services/theme.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ScrollService } from '../../services/scroll.service';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { Meta, Title } from '@angular/platform-browser';
import { IndiaMapComponent } from './components/india-map/india-map.component';
import { ResourceCardComponent } from '../find-help/components/resource-card/resource-card.component';
import { SuggestResourceModalComponent } from '../find-help/components/suggest-resource-modal/suggest-resource-modal.component';
import { LEGAL_RESOURCE_PIPES } from '../../pipes/legal-resource.pipe';
import {
  INDIAN_STATES,
  UNION_TERRITORIES,
  INDIAN_STATES_AND_UTS,
  getStateDistricts,
  getResourceTypeLabel,
  getResourceTypeBadgeClass
} from '../../core/constants/legal-resource.constants';
import { CustomSelectComponent, SelectOption } from '../../components/custom-select';
import { IconComponent } from '../../components/icon';
import { Subject, fromEvent } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

export interface DirectoryFilters {
  search: string;
  pincode?: string;
  state: string;
  district: string;
  type: string;
  jurisdictionLevel: string;
  facility: string;
  sortBy: string;
  sortOrder: string;
}

export interface CanonicalTypeOption {
  value: string;
  label: string;
  labelHi: string;
  icon: string;
}

@Component({
  selector: 'app-legal-resources',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TooltipDirective,
    IndiaMapComponent,
    ResourceCardComponent,
    SuggestResourceModalComponent,
    LEGAL_RESOURCE_PIPES,
    CustomSelectComponent,
    IconComponent
  ],
  templateUrl: './legal-resources.component.html',
  styleUrls: ['./legal-resources.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalResourcesComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private filterChange$ = new Subject<void>();

  // Dynamic Navbar Height & Scroll State
  navbarHeight = 68;
  isScrolled = false;

  // Mobile Bottom Sheet Drawer States (Single & Nested Support)
  isMobileDrawerOpen = false;
  isMobileDrawerClosing = false;
  isNestedSelectOpen = false;
  drawerTranslateY = 0;
  private drawerTouchStartY = 0;
  isDraggingDrawer = false;
  private nestedSheetListener: ((event: any) => void) | null = null;

  // Mobile View Mode Switcher ('list' | 'map') for mobile devices
  mobileViewMode: 'list' | 'map' = 'list';
  showBottomNav = true;

  // Mobile Map Pin Selected Preview Card
  selectedMapPreviewResource: any = null;

  // Layout View Mode ('split' | 'grid' | 'map') - Default to Airbnb/Google Maps Split View on Desktop
  viewMode: 'split' | 'grid' | 'map' = 'split';

  // Hovered Resource Synchronization with Map Pins
  hoveredResourceId: string | null = null;

  // Language support (Bilingual English / Hindi)
  selectedLanguage: 'en' | 'hi' = 'en';

  // Data
  resources: any[] = [];
  mapResources: any[] = [];
  mapScope: 'page' | 'all' = 'page';
  isLoading = true;
  isInitialLoad = true;

  get displayedMapResources(): any[] {
    return (this.mapScope === 'all' && this.mapResources.length) ? this.mapResources : this.resources;
  }

  onMapScopeChanged(scope: 'page' | 'all'): void {
    this.mapScope = scope;
  }

  // Mobile View Mode Toggle (Airbnb / Google Maps mobile standard)
  toggleMobileViewMode(): void {
    this.mobileViewMode = this.mobileViewMode === 'list' ? 'map' : 'list';
    if (this.mobileViewMode === 'map') {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 150);
    }
    this.cdr.markForCheck();
  }

  setMobileViewMode(mode: 'list' | 'map'): void {
    if (this.mobileViewMode === mode) return;
    this.mobileViewMode = mode;
    if (mode === 'map') {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 150);
    }
    this.cdr.markForCheck();
  }

  closeMobilePinPreview(): void {
    this.selectedMapPreviewResource = null;
    this.hoveredResourceId = null;
    this.cdr.markForCheck();
  }

  openDirections(resource: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (!resource) return;
    const lat = resource.coordinates?.lat || resource.location?.coordinates?.[1];
    const lng = resource.coordinates?.lng || resource.location?.coordinates?.[0];
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    } else if (resource.address || (resource.city && resource.state)) {
      const destination = resource.address || `${resource.city}, ${resource.state}`;
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, '_blank');
    }
  }

  getContactNumber(resource: any): string | null {
    if (!resource?.contactNumber) return null;
    if (Array.isArray(resource.contactNumber)) {
      return resource.contactNumber.length > 0 ? resource.contactNumber[0] : null;
    }
    if (typeof resource.contactNumber === 'string' && resource.contactNumber.trim().length > 0) {
      return resource.contactNumber.trim();
    }
    return null;
  }

  navigateToResourceDetail(resource: any, event?: Event): void {
    if (event) event.stopPropagation();
    const id = resource?._id || resource?.id;
    if (id) {
      this.router.navigate(['/legal-resources', id]);
    }
  }

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalResults = 0;
  itemsPerPage = 20;

  // Metrics from API
  stateMetrics: Record<string, number> = {};
  typeMetrics: Record<string, number> = {};
  totalResourceCount = 0;
  coveredStates = 0;

  // Geolocation & Near Me
  isNearMeActive = false;
  isLocating = false;
  userCoords: { lat: number; lng: number } | null = null;

  // Dynamic District Options
  districtOptions: SelectOption[] = [
    { value: '', label: 'All Districts', icon: 'map-pin' }
  ];
  isLoadingDistricts = false;

  // AI Search & Triage State
  searchMode: 'standard' | 'ai' = 'standard';
  aiQuery = '';
  isAiSearching = false;
  aiExplanation: string | null = null;

  // Suggest Resource Modal State
  isSuggestModalOpen = false;
  isSubmittingSuggestion = false;

  // Filters (Single Canonical Source)
  filters: DirectoryFilters = {
    search: '',
    pincode: '',
    state: '',
    district: '',
    type: '',
    jurisdictionLevel: '',
    facility: '',
    sortBy: 'name',
    sortOrder: 'asc'
  };

  // Search debounce
  private searchTimeout: any = null;

  // State/UT lists (Delegates to centralized Single Source of Truth)
  readonly INDIAN_STATES = INDIAN_STATES;
  readonly UNION_TERRITORIES = UNION_TERRITORIES;

  // Canonical Single Source of Truth for Institutional Categories
  readonly CANONICAL_TYPES: CanonicalTypeOption[] = [
    { value: '', label: 'All Institutions', labelHi: 'सभी संस्थान', icon: 'grid' },
    { value: 'Court', label: 'Courts & Tribunals', labelHi: 'अदालतें व न्यायाधिकरण', icon: 'landmark' },
    { value: 'LegalAid', label: 'Free Legal Aid (DLSA)', labelHi: 'मुफ्त कानूनी सहायता', icon: 'shield' },
    { value: 'PoliceStation', label: 'Police Stations', labelHi: 'पुलिस स्टेशन', icon: 'shield' },
    { value: 'GovernmentOffice', label: 'Govt Legal Offices', labelHi: 'सरकारी कार्यालय', icon: 'building' },
    { value: 'Helpline', label: 'Helplines (24/7)', labelHi: 'हेल्पलाइन', icon: 'phone' },
    { value: 'Notary', label: 'Public Notaries', labelHi: 'सार्वजनिक नोटरी', icon: 'file-text' },
    { value: 'LokAdalat', label: 'Lok Adalats', labelHi: 'लोक अदालत', icon: 'scale' },
    { value: 'MediationCenter', label: 'Mediation Hubs', labelHi: 'मध्यस्थता केंद्र', icon: 'users' },
    { value: 'BarAssociation', label: 'Bar Associations', labelHi: 'बार एसोसिएशन', icon: 'award' }
  ];

  get typeSelectOptions(): SelectOption[] {
    return this.CANONICAL_TYPES.map(t => ({
      value: t.value,
      label: this.selectedLanguage === 'hi' ? t.labelHi : t.label,
      icon: t.icon
    }));
  }

  private normalizeRegionName(name: string): string {
    return (name || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/\bislands\b/g, '')
      .replace(/\but\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  getStateCount(stateName: string): number {
    if (!this.stateMetrics || Object.keys(this.stateMetrics).length === 0) return 0;
    if (this.stateMetrics[stateName] !== undefined) {
      return this.stateMetrics[stateName];
    }
    const targetNorm = this.normalizeRegionName(stateName);
    for (const [key, count] of Object.entries(this.stateMetrics)) {
      if (this.normalizeRegionName(key) === targetNorm) {
        return count;
      }
    }
    return 0;
  }

  get heroStateOptions(): SelectOption[] {
    const hasMetrics = Object.keys(this.stateMetrics).length > 0;

    // Combine canonical States, UTs, and any active backend metric keys
    const allRegions = Array.from(new Set([
      ...this.INDIAN_STATES,
      ...this.UNION_TERRITORIES,
      ...Object.keys(this.stateMetrics)
    ]));

    // Filter for active regions (has > 0 records or currently selected), and compute counts
    const activeRegions = allRegions
      .map(region => {
        const count = this.getStateCount(region);
        return {
          region,
          count,
          hasData: count > 0 || this.filters.state === region
        };
      })
      .filter(item => !hasMetrics || item.hasData);

    // Deduplicate any slight spelling variants (e.g. 'Andaman & Nicobar' vs 'Andaman and Nicobar Islands')
    const uniqueMap = new Map<string, { region: string; count: number }>();
    for (const item of activeRegions) {
      const normKey = this.normalizeRegionName(item.region);
      if (!uniqueMap.has(normKey)) {
        uniqueMap.set(normKey, { region: item.region, count: item.count });
      } else {
        const existing = uniqueMap.get(normKey)!;
        if (item.count > existing.count) {
          uniqueMap.set(normKey, { region: item.region, count: item.count });
        }
      }
    }

    const uniqueList = Array.from(uniqueMap.values());

    // Sort all active regions alphabetically (A-Z)
    uniqueList.sort((a, b) => a.region.localeCompare(b.region));

    const totalRegions = uniqueList.length;
    const allLabel = hasMetrics
      ? `All India (${totalRegions} Active Regions)`
      : 'All India (36 States & UTs)';

    return [
      { value: '', label: allLabel, icon: 'globe' },
      ...uniqueList.map(item => ({
        value: item.region,
        label: hasMetrics && item.count > 0 ? `${item.region} (${item.count})` : item.region,
        icon: 'map-pin'
      }))
    ];
  }

  readonly JURISDICTION_OPTIONS: SelectOption[] = [
    { value: '', label: 'All Levels', icon: 'globe' },
    { value: 'National', label: 'National Level', icon: 'landmark' },
    { value: 'State', label: 'State Level', icon: 'map-pin' },
    { value: 'District', label: 'District Level', icon: 'building' },
    { value: 'Taluka', label: 'Taluka / Tehsil', icon: 'map-pin' },
    { value: 'SpecialTribunal', label: 'Special Tribunal', icon: 'scale' }
  ];

  readonly FACILITY_OPTIONS: SelectOption[] = [
    { value: '', label: 'All Facilities', icon: 'sparkles' },
    { value: 'hasEfiling', label: 'e-Filing Desk (e-Sewa)', icon: 'file-text' },
    { value: 'hasLADCS', label: 'LADCS Defense System', icon: 'shield' },
    { value: 'hasVCRoom', label: 'VC Hearing Room', icon: 'eye' },
    { value: 'hasLegalAidClinic', label: 'Legal Aid Clinic', icon: 'building' },
    { value: 'isWheelchairAccessible', label: 'Wheelchair Accessible', icon: 'badge-check' }
  ];

  readonly SORT_OPTIONS: SelectOption[] = [
    { value: 'name', label: 'Name (A–Z)', icon: 'sort-asc' },
    { value: 'state', label: 'State / Region', icon: 'map-pin' },
    { value: 'type', label: 'Institution Type', icon: 'filter' },
    { value: 'lastAuditDate', label: 'Recently Verified', icon: 'badge-check' },
    { value: 'distance', label: 'Nearest Proximity First', icon: 'map-pin' }
  ];

  constructor(
    private legalService: LegalService,
    public locationService: LocationService,
    private snackbar: SnackbarService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    public themeService: ThemeService,
    private meta: Meta,
    private titleService: Title,
    private ngZone: NgZone,
    private scrollService: ScrollService
  ) { }

  isDesktop = false;

  ngOnInit(): void {
    this.updateNavbarHeight();
    this.updateScreenSize();

    // Listen for child nested custom-select sheet open/close events to trigger parent card-deck scaling
    if (typeof window !== 'undefined') {
      this.nestedSheetListener = (event: any) => {
        if (event.detail && typeof event.detail.open === 'boolean') {
          this.isNestedSelectOpen = event.detail.open;
          this.cdr.markForCheck();
        }
      };
      window.addEventListener('lc-nested-sheet-change', this.nestedSheetListener);
    }

    this.ngZone.runOutsideAngular(() => {
      fromEvent(window, 'resize').pipe(
        debounceTime(150),
        takeUntil(this.destroy$)
      ).subscribe(() => {
        this.ngZone.run(() => {
          this.updateNavbarHeight();
          this.updateScreenSize();
          this.cdr.markForCheck();
        });
      });
    });

    this.scrollService.isScrolled$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((scrolled) => {
      this.isScrolled = scrolled;
      this.updateNavbarHeight();
      this.cdr.markForCheck();
    });

    this.scrollService.scrollDirection$.pipe(
      takeUntil(this.destroy$)
    ).subscribe((dir) => {
      this.showBottomNav = dir === 'up';
      this.cdr.markForCheck();
    });

    // Reactive filter stream to prevent UI race conditions
    this.filterChange$.pipe(
      debounceTime(100),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.fetchResources();
    });

    this.titleService.setTitle('Legal Resources Directory — Courts, DLSA & Legal Aid | LegalConnect');
    this.meta.updateTag({
      name: 'description',
      content: 'Official national registry of Indian courts, District Legal Services Authorities (DLSA), SLSAs, legal aid clinics, notaries, and mediation centers across 36 States & UTs.'
    });

    // Sync filters from URL
    const params = this.route.snapshot.queryParams;
    if (params['state']) this.filters.state = params['state'];
    if (params['district']) this.filters.district = params['district'];
    if (params['type']) this.filters.type = params['type'];
    if (params['search']) this.filters.search = params['search'];
    if (params['pincode']) this.filters.pincode = params['pincode'];
    if (params['jurisdiction']) this.filters.jurisdictionLevel = params['jurisdiction'];
    if (params['facility']) this.filters.facility = params['facility'];
    if (params['sortBy']) this.filters.sortBy = params['sortBy'];
    if (params['page']) this.currentPage = parseInt(params['page'], 10) || 1;

    if (this.filters.state) {
      this.loadDistrictsForState(this.filters.state);
    }

    this.fetchResources();
    this.injectStructuredData();
  }

  private navResizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    const nav = document.querySelector('nav');
    if (nav) {
      this.navbarHeight = nav.offsetHeight;
      if (typeof ResizeObserver !== 'undefined') {
        this.navResizeObserver = new ResizeObserver(() => {
          this.updateNavbarHeight();
          this.cdr.markForCheck();
        });
        this.navResizeObserver.observe(nav);
      }
    }
    setTimeout(() => {
      this.updateNavbarHeight();
      this.cdr.markForCheck();
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.nestedSheetListener && typeof window !== 'undefined') {
      window.removeEventListener('lc-nested-sheet-change', this.nestedSheetListener);
    }
    if (this.navResizeObserver) {
      this.navResizeObserver.disconnect();
    }
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    document.body.style.overflow = '';
    this.destroy$.next();
    this.destroy$.complete();
    this.removeStructuredData();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    if (event.key === '/' && !isInput) {
      event.preventDefault();
      const searchEl = document.querySelector('input[type="text"]') as HTMLInputElement;
      if (searchEl) {
        searchEl.focus();
        searchEl.select();
      }
    } else if (event.key === 'Escape' && !isInput && this.hasActiveFilters()) {
      event.preventDefault();
      this.clearAllFilters();
    } else if (event.key === 'ArrowLeft' && !isInput && this.currentPage > 1) {
      event.preventDefault();
      this.goToPage(this.currentPage - 1);
    } else if (event.key === 'ArrowRight' && !isInput && this.currentPage < this.totalPages) {
      event.preventDefault();
      this.goToPage(this.currentPage + 1);
    }
  }

  private updateNavbarHeight(): void {
    const nav = document.querySelector('nav');
    if (nav) {
      this.navbarHeight = nav.offsetHeight;
    }
  }

  private updateScreenSize(): void {
    if (typeof window !== 'undefined') {
      this.isDesktop = window.innerWidth >= 1024;
    }
  }

  setLanguage(lang: 'en' | 'hi'): void {
    this.selectedLanguage = lang;
    this.fetchResources(true);
  }

  fetchResources(refresh = false): void {
    this.isLoading = true;
    this.cdr.markForCheck();

    this.legalService.getResourceDirectory({
      page: this.currentPage,
      limit: this.itemsPerPage,
      search: this.filters.search || undefined,
      pincode: this.filters.pincode || undefined,
      state: this.filters.state || undefined,
      district: this.filters.district || undefined,
      type: this.filters.type || undefined,
      jurisdictionLevel: this.filters.jurisdictionLevel || undefined,
      facility: this.filters.facility || undefined,
      lat: this.isNearMeActive && this.userCoords ? this.userCoords.lat : undefined,
      lng: this.isNearMeActive && this.userCoords ? this.userCoords.lng : undefined,
      sortBy: this.filters.sortBy,
      sortOrder: this.filters.sortOrder,
      lang: this.selectedLanguage
    }, refresh).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.resources = res.data || [];
          this.mapResources = (res.mapPins && res.mapPins.length) ? res.mapPins : (res.data || []);
          this.totalResults = res.pagination?.total || 0;
          this.totalPages = res.pagination?.pages || 1;
          this.currentPage = res.pagination?.page || 1;

          if (res.metrics) {
            this.stateMetrics = res.metrics.stateMetrics || {};
            this.typeMetrics = res.metrics.typeMetrics || {};
            this.totalResourceCount = res.metrics.total || this.totalResults;
            this.coveredStates = res.metrics.coveredStates || 0;
          }
        }
        this.isLoading = false;
        this.isInitialLoad = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.isInitialLoad = false;
        this.snackbar.show('Failed to fetch legal resources.', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  loadDistrictsForState(stateName: string): void {
    if (!stateName) {
      this.districtOptions = [{ value: '', label: 'All Districts', icon: 'map-pin' }];
      return;
    }

    // Step 1: Immediately populate with all official canonical districts for the state (zero delay)
    const canonicalDistricts = getStateDistricts(stateName);
    const initialOpts: SelectOption[] = [
      { value: '', label: `All ${stateName} Districts`, icon: 'map-pin' },
      ...canonicalDistricts.map(d => ({
        value: d,
        label: d,
        icon: 'building'
      }))
    ];
    this.districtOptions = initialOpts;
    this.cdr.markForCheck();

    // Step 2: Fetch active database record counts and enrich district labels
    this.isLoadingDistricts = true;
    this.legalService.getDistrictsByState(stateName).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res: any) => {
        if (res?.success && Array.isArray(res.data)) {
          const countsMap = new Map<string, number>();
          res.data.forEach((item: any) => {
            if (item.district) {
              countsMap.set(item.district.toLowerCase().trim(), item.count);
            }
          });

          // Enrich canonical districts with database counts
          const enrichedOpts: SelectOption[] = [
            { value: '', label: `All ${stateName} Districts`, icon: 'map-pin' }
          ];

          // Add all canonical districts with counts
          canonicalDistricts.forEach(d => {
            const count = countsMap.get(d.toLowerCase().trim()) || 0;
            enrichedOpts.push({
              value: d,
              label: count > 0 ? `${d} (${count})` : d,
              icon: 'building'
            });
            countsMap.delete(d.toLowerCase().trim());
          });

          // Add any extra districts from DB that might not be in canonical list
          res.data.forEach((item: any) => {
            if (item.district && countsMap.has(item.district.toLowerCase().trim())) {
              enrichedOpts.push({
                value: item.district,
                label: `${item.district} (${item.count})`,
                icon: 'building'
              });
            }
          });

          this.districtOptions = enrichedOpts;
        }
        this.isLoadingDistricts = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoadingDistricts = false;
        this.cdr.markForCheck();
      }
    });
  }

  onSearchChange(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.updateQueryParams();
      this.filterChange$.next();
    }, 250);
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.updateQueryParams();
    this.filterChange$.next();
  }

  selectQuickCategory(type: string): void {
    this.filters.type = this.filters.type === type ? '' : type;
    this.onFilterChange();
  }

  toggleFacility(facilityKey: string): void {
    this.filters.facility = this.filters.facility === facilityKey ? '' : facilityKey;
    this.onFilterChange();
  }

  onStateSelected(state: string): void {
    this.filters.state = state || '';
    this.filters.district = '';
    if (this.filters.state) {
      this.loadDistrictsForState(this.filters.state);
    } else {
      this.districtOptions = [{ value: '', label: 'All Districts', icon: 'map-pin' }];
    }
    this.onFilterChange();
  }

  onMapStateSelected(state: string): void {
    if (this.filters.state === state) {
      this.onStateSelected('');
    } else {
      this.onStateSelected(state);
    }
  }

  // ── High-Performance TrackBy Optimizers ──
  trackById(index: number, item: any): string {
    return item?._id || item?.id || String(index);
  }

  trackByValue(index: number, item: any): string {
    return item?.value ?? String(index);
  }

  trackByPage(index: number, page: number): number {
    return page;
  }

  trackByIndex(index: number): number {
    return index;
  }

  getUserLocationLabel(): string {
    const loc = this.locationService.getCurrentLocation();
    if (loc) {
      const clean = this.locationService.cleanAddress(loc);
      return `Near: ${clean}`;
    }
    if (this.userCoords) {
      return `Near: ${this.userCoords.lat.toFixed(2)}°, ${this.userCoords.lng.toFixed(2)}°`;
    }
    return 'Near Me';
  }

  toggleNearMe(): void {
    if (this.isNearMeActive) {
      this.isNearMeActive = false;
      this.userCoords = null;
      if (this.filters.sortBy === 'distance') {
        this.filters.sortBy = 'name';
      }
      this.onFilterChange();
      this.snackbar.show('Location search disabled', 'info');
      return;
    }

    // Step 1: Check if the Top Navbar already has real coordinates set
    const existingCoords = this.locationService.getCoordinates();
    const isEstimated = this.locationService.isLocationEstimated();

    if (existingCoords && !isEstimated) {
      // Navbar already resolved an exact location → reuse it instantly (zero GPS prompt, zero API call)
      this.activateNearMe(existingCoords);
      const loc = this.locationService.cleanAddress(this.locationService.getCurrentLocation());
      this.snackbar.show(`Showing legal resources closest to ${loc || 'you'}`, 'success');
      return;
    }

    // Step 2: Navbar has no real location → trigger fresh GPS detection via shared service
    this.isLocating = true;
    this.cdr.markForCheck();

    this.locationService.detectGpsPosition()
      .then(async (coords) => {
        const address = await this.locationService.reverseGeocode(coords.lat, coords.lng);
        this.ngZone.run(() => {
          this.isLocating = false;
          this.locationService.setLocation(address, false, coords);
          this.activateNearMe(coords);
          const loc = this.locationService.cleanAddress(address);
          this.snackbar.show(`Showing legal resources closest to ${loc || 'you'}`, 'success');
        });
      })
      .catch((err) => {
        this.ngZone.run(() => {
          this.isLocating = false;
          this.isNearMeActive = false;
          this.userCoords = null;
          this.snackbar.show(err?.message || 'Location access denied or unavailable', 'error');
          this.cdr.markForCheck();
        });
      });
  }

  /** Shared activation logic for Near Me */
  private activateNearMe(coords: { lat: number; lng: number }): void {
    this.isNearMeActive = true;
    this.userCoords = coords;
    this.filters.sortBy = 'distance';
    this.onFilterChange();
    this.cdr.markForCheck();
  }

  openMobileDrawer(): void {
    this.isMobileDrawerOpen = true;
    this.isMobileDrawerClosing = false;
    this.drawerTranslateY = 0;
    this.isNestedSelectOpen = false;
    document.body.style.overflow = 'hidden';
    this.cdr.markForCheck();
  }

  closeMobileDrawer(): void {
    if (!this.isMobileDrawerOpen || this.isMobileDrawerClosing) return;
    this.isMobileDrawerClosing = true;
    this.cdr.markForCheck();

    setTimeout(() => {
      this.isMobileDrawerOpen = false;
      this.isMobileDrawerClosing = false;
      this.drawerTranslateY = 0;
      this.isNestedSelectOpen = false;
      document.body.style.overflow = '';
      this.cdr.markForCheck();
    }, 220);
  }

  // Touch drag-to-dismiss gesture handlers for mobile bottom sheet drawer
  onDrawerTouchStart(event: TouchEvent): void {
    if (event.touches && event.touches.length === 1) {
      this.drawerTouchStartY = event.touches[0].clientY;
      this.isDraggingDrawer = true;
    }
  }

  onDrawerTouchMove(event: TouchEvent): void {
    if (!this.isDraggingDrawer) return;
    const currentY = event.touches[0].clientY;
    const deltaY = currentY - this.drawerTouchStartY;
    if (deltaY > 0) {
      // Gentle rubber-band physics
      this.drawerTranslateY = Math.pow(deltaY, 0.9);
      this.cdr.markForCheck();
    }
  }

  onDrawerTouchEnd(): void {
    if (!this.isDraggingDrawer) return;
    this.isDraggingDrawer = false;
    if (this.drawerTranslateY > 70) {
      this.closeMobileDrawer();
    } else {
      this.drawerTranslateY = 0;
      this.cdr.markForCheck();
    }
  }

  setHoveredResource(id: string | null): void {
    this.hoveredResourceId = id;
    this.cdr.markForCheck();
  }

  onMapResourceSelected(resource: any): void {
    const targetId = resource?._id || resource?.id;
    this.hoveredResourceId = targetId;
    this.selectedMapPreviewResource = resource;

    if (this.viewMode === 'grid') {
      this.viewMode = 'split';
    }
    const cardEl = document.getElementById(`resource-card-${targetId}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cardEl.classList.add('pulse-highlight');
      setTimeout(() => cardEl.classList.remove('pulse-highlight'), 1800);
    }
    this.cdr.markForCheck();
  }

  clearFilter(filterKey: string): void {
    if (filterKey === 'nearMe') {
      if (this.isNearMeActive) {
        this.toggleNearMe();
      }
      return;
    }
    if (filterKey === 'sortBy') {
      this.filters.sortBy = 'name';
    } else if (filterKey === 'sortOrder') {
      this.filters.sortOrder = 'asc';
    } else if (filterKey === 'state') {
      this.filters.state = '';
      this.filters.district = '';
      this.districtOptions = [{ value: '', label: 'All Districts', icon: 'map-pin' }];
    } else if (filterKey in this.filters) {
      (this.filters as any)[filterKey] = '';
    }
    this.onFilterChange();
  }

  clearAllFilters(): void {
    this.filters = {
      search: '',
      pincode: '',
      state: '',
      district: '',
      type: '',
      jurisdictionLevel: '',
      facility: '',
      sortBy: 'name',
      sortOrder: 'asc'
    };
    this.aiExplanation = null;
    this.aiQuery = '';
    this.isNearMeActive = false;
    this.userCoords = null;
    this.districtOptions = [{ value: '', label: 'All Districts', icon: 'map-pin' }];
    this.currentPage = 1;
    this.updateQueryParams();
    this.fetchResources(true);
    this.snackbar.show('All filters reset', 'info');
  }

  // ── AI Natural Language Intent Search ──
  onAiSearch(): void {
    if (!this.aiQuery.trim()) return;
    this.isAiSearching = true;
    this.cdr.markForCheck();

    this.legalService.aiSearchDirectory(this.aiQuery.trim()).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res: any) => {
        this.isAiSearching = false;
        if (res?.success && res.data) {
          const parsed = res.data.parsedCriteria || {};
          this.aiExplanation = res.data.explanation || null;
          if (parsed.state) this.filters.state = parsed.state;
          if (parsed.district) this.filters.district = parsed.district;
          if (parsed.type) this.filters.type = parsed.type;
          if (parsed.jurisdictionLevel) this.filters.jurisdictionLevel = parsed.jurisdictionLevel;
          if (parsed.pincode) this.filters.pincode = parsed.pincode;
          if (parsed.facility) this.filters.facility = parsed.facility;
          if (parsed.searchQuery) this.filters.search = parsed.searchQuery;

          this.currentPage = 1;
          this.updateQueryParams();
          this.fetchResources(true);
          this.snackbar.show(res.data.explanation || 'AI filters applied successfully', 'info');
        } else {
          this.snackbar.show('Could not parse specific legal criteria. Showing standard results.', 'info');
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isAiSearching = false;
        this.snackbar.show('AI search failed. Please try standard keyword search.', 'error');
        this.cdr.markForCheck();
      }
    });
  }

  setSearchMode(mode: 'standard' | 'ai'): void {
    this.searchMode = mode;
    this.cdr.markForCheck();
  }

  clearAiSearch(): void {
    this.aiExplanation = null;
    this.aiQuery = '';
    this.clearAllFilters();
  }

  // ── Guided Legal Triage Helper ──
  selectTriage(pathway: string): void {
    this.clearAllFilters();
    switch (pathway) {
      case 'free_legal_aid':
        this.filters.type = 'LegalAid';
        this.filters.facility = 'hasLegalAidClinic';
        break;
      case 'efiling_bail':
        this.filters.type = 'Court';
        this.filters.facility = 'hasEfiling';
        break;
      case 'defense_counsel':
        this.filters.type = 'LegalAid';
        this.filters.facility = 'hasLADCS';
        break;
      case 'police_cyber':
        this.filters.type = 'PoliceStation';
        break;
    }
    this.currentPage = 1;
    this.updateQueryParams();
    this.fetchResources(true);
  }

  // ── Public Suggest Missing Legal Aid Clinic / Place Modal ──
  openSuggestModal(): void {
    this.isSuggestModalOpen = true;
    this.cdr.markForCheck();
  }

  closeSuggestModal(): void {
    this.isSuggestModalOpen = false;
    this.cdr.markForCheck();
  }

  onResourceSuggested(data?: any): void {
    this.isSuggestModalOpen = false;
    this.cdr.markForCheck();
  }

  // ── Quick Helpful 👍 Upvote Action ──
  onHelpfulUpvote(resource: any, event?: Event): void {
    event?.stopPropagation();
    const id = resource?._id || resource?.id;
    if (!id) return;

    this.legalService.submitResourceFeedback(id, true).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (res: any) => {
        if (resource.feedback) {
          resource.feedback.upvotes = (resource.feedback.upvotes || 0) + 1;
        } else {
          resource.feedback = { upvotes: 1, downvotes: 0, helpfulnessScore: 100 };
        }
        this.snackbar.show('Thank you! Feedback recorded.', 'success');
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackbar.show('Feedback could not be recorded.', 'error');
      }
    });
  }

  hasActiveFilters(): boolean {
    return this.getActiveFilterCount() > 0;
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.filters.search && this.filters.search.trim()) count++;
    if (this.filters.state) count++;
    if (this.filters.district) count++;
    if (this.filters.type) count++;
    if (this.filters.jurisdictionLevel) count++;
    if (this.filters.facility) count++;
    if (this.filters.sortBy && this.filters.sortBy !== 'name') count++;
    if (this.isNearMeActive) count++;
    return count;
  }

  getFacilityLabel(facilityKey: string): string {
    const fac = this.FACILITY_OPTIONS.find(f => f.value === facilityKey);
    return fac ? fac.label : facilityKey;
  }

  getSortLabel(sortKey: string): string {
    const s = this.SORT_OPTIONS.find(opt => opt.value === sortKey);
    return s ? s.label : sortKey;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    this.updateQueryParams();
    this.fetchResources();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getPagesArray(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  private updateQueryParams(): void {
    const queryParams: Record<string, any> = {};
    if (this.filters.state) queryParams['state'] = this.filters.state;
    if (this.filters.district) queryParams['district'] = this.filters.district;
    if (this.filters.type) queryParams['type'] = this.filters.type;
    if (this.filters.search) queryParams['search'] = this.filters.search;
    if (this.filters.jurisdictionLevel) queryParams['jurisdiction'] = this.filters.jurisdictionLevel;
    if (this.filters.facility) queryParams['facility'] = this.filters.facility;
    if (this.filters.sortBy && this.filters.sortBy !== 'name') queryParams['sortBy'] = this.filters.sortBy;
    if (this.currentPage > 1) queryParams['page'] = this.currentPage;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams
    });
  }

  // Live IST Operating Hours Engine
  getOperatingStatus(resource: any): { status: 'open' | 'lunch' | 'closed'; label: string; colorClass: string } {
    try {
      const now = new Date();
      const istTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
      const [hStr, mStr] = istTimeStr.split(':');
      const currentMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10);
      const day = now.getDay(); // 0 is Sunday

      // Standard government institutions closed on Sunday
      if (day === 0) {
        return {
          status: 'closed',
          label: 'Closed Today (Sunday)',
          colorClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
        };
      }

      // Check lunch break (default 1:30 PM - 2:00 PM -> 810 to 840 mins)
      if (currentMinutes >= 810 && currentMinutes < 840) {
        return {
          status: 'lunch',
          label: 'Lunch Break (1:30–2:00 PM)',
          colorClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
        };
      }

      // Standard working hours 9:30 AM (570) to 5:00 PM (1020)
      if (currentMinutes >= 570 && currentMinutes < 1020) {
        return {
          status: 'open',
          label: 'Open Now (closes 5:00 PM)',
          colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
        };
      }

      return {
        status: 'closed',
        label: 'Closed (Opens 9:30 AM)',
        colorClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
      };
    } catch {
      return {
        status: 'open',
        label: 'Institutional Registry',
        colorClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
      };
    }
  }

  // Navigation & Directions Deep Link
  getDirectionsUrl(resource: any): string {
    if (resource.coordinates?.lat && resource.coordinates?.lng) {
      return `https://www.google.com/maps/dir/?api=1&destination=${resource.coordinates.lat},${resource.coordinates.lng}`;
    }
    const query = encodeURIComponent(`${resource.name}, ${resource.address || ''}, ${resource.city || ''}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  // Sharing & Copy Actions
  shareResource(resource: any, event?: Event): void {
    if (event) event.stopPropagation();
    const url = `${window.location.origin}/legal-resources/${resource._id}`;
    if (navigator.share) {
      navigator.share({
        title: resource.name,
        text: `Official Institutional Listing: ${resource.name} (${resource.city || resource.district}, ${resource.state})`,
        url
      }).catch(() => { /* silent */ });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        this.snackbar.show('Registry link copied to clipboard!', 'success');
      });
    }
  }

  copyAddress(resource: any, event?: Event): void {
    if (event) event.stopPropagation();
    const fullText = `${resource.name}\n${resource.address || ''}\n${resource.city || ''}, ${resource.state || ''} - ${resource.pincode || ''}\nPhone: ${resource.contactNumber?.[0] || 'N/A'}`;
    navigator.clipboard.writeText(fullText).then(() => {
      this.snackbar.show('Official address & contact copied!', 'success');
    });
  }

  // Export to CSV
  exportToCSV(): void {
    if (!this.resources.length) {
      this.snackbar.show('No records available to export', 'info');
      return;
    }

    const headers = ['Institution Name', 'Type', 'Jurisdiction', 'State', 'District', 'Address', 'Pincode', 'Phone', 'e-Filing', 'LADCS', 'VC Room', 'Legal Aid Clinic', 'Wheelchair Access', 'Last Verified Date'];

    const rows = this.resources.map(r => [
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${this.getTypeLabel(r.type)}"`,
      `"${r.jurisdictionLevel || 'District'}"`,
      `"${r.state || ''}"`,
      `"${r.district || r.city || ''}"`,
      `"${(r.address || '').replace(/"/g, '""')}"`,
      `"${r.pincode || ''}"`,
      `"${(r.contactNumber?.[0] || '').replace(/"/g, '""')}"`,
      r.facilities?.hasEfiling ? 'Yes' : 'No',
      r.facilities?.hasLADCS ? 'Yes' : 'No',
      r.facilities?.hasVCRoom ? 'Yes' : 'No',
      r.facilities?.hasLegalAidClinic ? 'Yes' : 'No',
      r.facilities?.isWheelchairAccessible ? 'Yes' : 'No',
      r.lastAuditDate ? new Date(r.lastAuditDate).toISOString().split('T')[0] : 'N/A'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateStr = new Date().toISOString().split('T')[0];
    const stateTag = this.filters.state ? `_${this.filters.state.replace(/\s+/g, '_')}` : '';
    link.setAttribute('download', `LegalConnect_Institutional_Registry${stateTag}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.snackbar.show(`Exported ${this.resources.length} registry records to CSV`, 'success');
  }

  // JSON-LD SEO Structured Data
  private injectStructuredData(): void {
    const existing = document.getElementById('jsonld-legal-resources');
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = 'jsonld-legal-resources';
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'GovernmentOrganization',
      'name': 'National Legal Resources & Institutional Directory',
      'description': 'Directory of Indian Courts, DLSAs, SLSAs, Legal Aid Clinics, Notaries, and Public Tribunals.',
      'url': window.location.href,
      'areaServed': 'IN'
    });
    document.head.appendChild(script);
  }

  private removeStructuredData(): void {
    const el = document.getElementById('jsonld-legal-resources');
    if (el) el.remove();
  }

  // Formatting helpers (Delegates to centralized Single Source of Truth)
  getTypeLabel(type: string): string {
    return getResourceTypeLabel(type, this.selectedLanguage);
  }

  getTypeBadgeClass(type: string): string {
    return getResourceTypeBadgeClass(type);
  }

  getTypeColor(type: string): string {
    return getResourceTypeBadgeClass(type);
  }

  getVerificationFreshness(resource: any): { label: string; colorClass: string; tooltip: string } | null {
    if (!resource?.lastAuditDate) return null;
    const auditDate = new Date(resource.lastAuditDate);
    const now = new Date();
    const monthsAgo = (now.getFullYear() - auditDate.getFullYear()) * 12 + (now.getMonth() - auditDate.getMonth());
    const dateStr = auditDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    if (monthsAgo <= 6) {
      return {
        label: `Verified: ${dateStr}`,
        colorClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        tooltip: `Verified: ${dateStr} — data is current and verified by registry administrators`
      };
    } else if (monthsAgo <= 12) {
      return {
        label: `Verified: ${dateStr}`,
        colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
        tooltip: `Verified: ${dateStr} — verification due for statutory annual compliance renewal`
      };
    } else {
      return {
        label: `Verified: ${dateStr}`,
        colorClass: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
        tooltip: `Verified: ${dateStr} — verification expired (>12 months)`
      };
    }
  }

  getFacilityChips(resource: any): { label: string; iconKey: string; tooltip: string }[] {
    const f = resource?.facilities;
    if (!f) return [];
    const chips: { label: string; iconKey: string; tooltip: string }[] = [];
    if (f.hasEfiling) chips.push({ label: 'e-Filing', iconKey: 'efiling', tooltip: 'e-Sewa Kendra digital filing desk available' });
    if (f.hasLADCS) chips.push({ label: 'LADCS', iconKey: 'ladcs', tooltip: 'Legal Aid Defense Counsel System available' });
    if (f.hasVCRoom) chips.push({ label: 'VC Room', iconKey: 'vcroom', tooltip: 'Video conferencing remand room' });
    if (f.hasLegalAidClinic) chips.push({ label: 'Clinic', iconKey: 'clinic', tooltip: 'Free legal aid clinic on-site' });
    if (f.isWheelchairAccessible) chips.push({ label: 'Accessible', iconKey: 'accessible', tooltip: 'Wheelchair accessible facility' });
    return chips;
  }

  printDirectory(): void {
    window.print();
  }

}