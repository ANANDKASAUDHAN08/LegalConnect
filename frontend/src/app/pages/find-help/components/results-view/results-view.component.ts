import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

// Injected Services
import { LegalService } from '../../../../services/legal.service';
import { LocationService } from '../../../../services/location.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { ThemeService } from '../../../../services/theme.service';

// Child Components
import { FiltersPanelComponent } from '../filters-panel/filters-panel.component';
import { ResultsHeaderComponent } from '../results-header/results-header.component';
import { CasePackPreviewModalComponent } from '../case-pack-preview-modal/case-pack-preview-modal.component';
import { ResourceCardComponent } from '../resource-card/resource-card.component';
import { HelplineCardComponent } from '../helpline-card/helpline-card.component';
import { LawyerCardComponent } from '../../../../components/lawyer-card/lawyer-card.component';
import { FreeAidCheckerComponent } from '../free-aid-checker/free-aid-checker.component';
import { LegalRoadmapComponent } from '../legal-roadmap/legal-roadmap.component';
import { LegalAuthoritiesHubComponent } from '../legal-authorities-hub/legal-authorities-hub.component';

// Directives & Pipes
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { CategoryInsightsPipe } from '../../pipes/category-insights.pipe';

// Config
import { CITY_COORDINATES, INDIAN_STATES } from '../../config/category-data.config';

declare var google: any;

@Component({
  selector: 'app-results-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FiltersPanelComponent,
    ResultsHeaderComponent,
    CasePackPreviewModalComponent,
    ResourceCardComponent,
    HelplineCardComponent,
    LawyerCardComponent,
    FreeAidCheckerComponent,
    LegalRoadmapComponent,
    LegalAuthoritiesHubComponent,
    TooltipDirective,
    CategoryInsightsPipe
  ],
  templateUrl: './results-view.component.html',
  styleUrls: ['./results-view.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsViewComponent implements OnInit, OnDestroy, OnChanges {
  @Input() activeCategory = '';
  @Input() locationQuery = '';

  @Output() back = new EventEmitter<void>();
  @Output() suggestClicked = new EventEmitter<void>();
  @Output() changeLocation = new EventEmitter<void>();

  isLoading = true;
  isMobile = false;
  showMobileFilters = false;

  // Split View Navigation and Tabs
  activeViewMode: 'split' | 'list' | 'map' = 'split';
  activeTab = 'All';
  private _activeResultsTab: 'roadmap' | 'nearby' | 'lawyers' = 'roadmap';
  get activeResultsTab(): 'roadmap' | 'nearby' | 'lawyers' {
    return this._activeResultsTab;
  }
  set activeResultsTab(value: 'roadmap' | 'nearby' | 'lawyers') {
    if (this._activeResultsTab !== value) {
      this._activeResultsTab = value;
      this.updateMapMarkers();
    }
  }

  // API Retrieved Raw Results
  resources: any[] = [];
  lawyers: any[] = [];
  helplines: any[] = [];

  // Filtered Lists
  filteredResources: any[] = [];
  filteredLawyers: any[] = [];
  nonSlsaFilteredResources: any[] = [];
  nationalAuthorities: any[] = [];
  slsaResources: any[] = [];
  allSlsaResources: any[] = [];

  allResultsCount = 0;
  allSubcategories: string[] = [];
  resourcePage = 1;
  lawyerPage = 1;
  itemsPerPage = 10;

  // Filters State
  filters = {
    radius: 50,
    resourceTypes: {
      LegalAid: true,
      Court: true,
      GovernmentOffice: true,
      Helpline: true,
      Lawyer: true
    },
    openNow: true,
    verifiedOnly: false,
    languages: {
      English: false,
      Hindi: false,
      Punjabi: false,
      Bengali: false
    },
    lawyerGender: 'Any',
    maxConsultationFee: 3000,
    subcategories: {} as Record<string, boolean>
  };

  // Eligibility Flow
  eligibilityStep = 0;
  eligibilityAnswers: any = { gender: '', income: '', category: '' };
  isFreeAidEligible = false;
  isFiltering = false;
  filterTimeout: any = null;
  isMapReady = false;
  isInitialLoad = true;

  // Case Pack
  isCasePackSaved = false;
  roadmap: any = null;
  showCasePackPreviewModal = false;

  // Text-To-Speech Narrator
  isSpeaking = false;
  speakingTextKey: string | null = null;

  // QR Modal
  showQrModal = false;
  qrCodeUrl = '';
  qrModalTitle = '';

  // Free Aid Modal
  showFreeAidModal = false;

  // Leaflet Map properties
  private map: any = null;
  private markers: any[] = [];
  private mapCenter: [number, number] = [28.6139, 77.2090]; // Delhi Default
  private userMarker: any = null;
  private openInfoWindow: any = null;
  private markersMap = new Map<string, any>();
  private infoWindowsMap = new Map<string, any>();
  highlightedResourceId: string | null = null;
  userGpsLat: number | null = null;
  userGpsLng: number | null = null;
  isSatelliteView = false;
  private mapThemeUnregister: (() => void) | null = null;
  get nearbyTypeFilter(): 'all' | 'LegalAid' | 'Court' | 'GovernmentOffice' | 'Helpline' {
    const types = this.filters.resourceTypes;
    if (types.LegalAid && types.Court && types.GovernmentOffice && types.Helpline) {
      return 'all';
    }
    if (types.LegalAid && !types.Court && !types.GovernmentOffice && !types.Helpline) {
      return 'LegalAid';
    }
    if (!types.LegalAid && types.Court && !types.GovernmentOffice && !types.Helpline) {
      return 'Court';
    }
    if (!types.LegalAid && !types.Court && types.GovernmentOffice && !types.Helpline) {
      return 'GovernmentOffice';
    }
    if (!types.LegalAid && !types.Court && !types.GovernmentOffice && types.Helpline) {
      return 'Helpline';
    }
    return 'all';
  }
  isDropdownOpen = false;

  nearbyFilterOptions = [
    {
      key: 'all' as const,
      label: 'All Help',
      activeClass: 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm',
      inactiveClass: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700',
      dotColor: 'bg-slate-400',
      showDot: false
    },
    {
      key: 'LegalAid' as const,
      label: 'Legal Aid',
      activeClass: 'bg-purple-600 text-white shadow-sm shadow-purple-500/20',
      inactiveClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20',
      dotColor: 'bg-purple-600',
      showDot: true
    },
    {
      key: 'Court' as const,
      label: 'District Courts',
      activeClass: 'bg-blue-600 text-white shadow-sm shadow-blue-500/20',
      inactiveClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20',
      dotColor: 'bg-blue-600',
      showDot: true
    },
    {
      key: 'GovernmentOffice' as const,
      label: 'Gov. Offices',
      activeClass: 'bg-orange-500 text-white shadow-sm shadow-orange-500/20',
      inactiveClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20',
      dotColor: 'bg-orange-500',
      showDot: true
    },
    {
      key: 'Helpline' as const,
      label: 'Helplines',
      activeClass: 'bg-amber-500 text-white shadow-sm shadow-amber-500/20',
      inactiveClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20',
      dotColor: 'bg-amber-500',
      showDot: true
    }
  ];

  get visibleFilterOptions() {
    return this.nearbyFilterOptions.filter(opt => {
      if (opt.key === 'Helpline') {
        return this.filters.resourceTypes.Helpline && this.helplines.length > 0;
      }
      return true;
    });
  }

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  selectFilter(filterType: 'all' | 'LegalAid' | 'Court' | 'GovernmentOffice' | 'Helpline'): void {
    if (filterType === 'all') {
      this.filters.resourceTypes.LegalAid = true;
      this.filters.resourceTypes.Court = true;
      this.filters.resourceTypes.GovernmentOffice = true;
      this.filters.resourceTypes.Helpline = true;
    } else {
      this.filters.resourceTypes.LegalAid = (filterType === 'LegalAid');
      this.filters.resourceTypes.Court = (filterType === 'Court');
      this.filters.resourceTypes.GovernmentOffice = (filterType === 'GovernmentOffice');
      this.filters.resourceTypes.Helpline = (filterType === 'Helpline');
    }

    this.resourcePage = 1;
    this.isDropdownOpen = false;
    this.applyFilters();
  }

  getFilterLabel(): string {
    const active = this.nearbyFilterOptions.find(o => o.key === this.nearbyTypeFilter);
    return active ? active.label : 'All Help';
  }

  @HostListener('document:click')
  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  trackByKey(index: number, opt: any): string {
    return opt.key;
  }

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private zone: NgZone,
    private legalService: LegalService,
    private locationService: LocationService,
    private snackbar: SnackbarService,
    public themeService: ThemeService
  ) { }

  ngOnInit() {
    this.checkMobile();
    this.syncFiltersFromUrl();

    // Sync allSLSA authorities once for the cross-picker
    this.legalService.getAllAuthorities().subscribe((res: any) => {
      if (res) {
        this.allSlsaResources = res || [];
        this.cdr.markForCheck();
      }
    });

    // Query physical GPS once on startup to store origin
    if (navigator.geolocation && this.userGpsLat === null) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.userGpsLat = pos.coords.latitude;
          this.userGpsLng = pos.coords.longitude;
          this.applyFilters();
          this.cdr.markForCheck();
        },
        (err) => {
          console.warn('Startup geolocation query failed:', err);
        },
        { timeout: 4000, maximumAge: 60000 }
      );
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['activeCategory'] || changes['locationQuery']) {
      if (this.activeCategory && this.locationQuery) {
        this.fetchData();
      }
    }
  }

  ngOnDestroy() {
    this.stopSpeaking();
    this.clearMapMarkers();
    if (this.mapThemeUnregister) {
      this.mapThemeUnregister();
    }
    if (this.map) {
      this.map = null;
    }
    document.body.style.overflow = '';
  }

  @HostListener('window:resize', [])
  onResize() {
    this.checkMobile();
  }

  private checkMobile() {
    const mobile = window.innerWidth < 768;
    if (this.isMobile !== mobile) {
      this.isMobile = mobile;
      if (this.isMobile) {
        if (this.activeViewMode === 'split') {
          this.activeViewMode = 'list';
        }
      } else {
        if (this.activeViewMode === 'list') {
          this.activeViewMode = 'split';
        }
      }
      this.cdr.markForCheck();
    }
  }

  scrollListToTop() {
    // Desktop: scroll the fixed-height panel
    const panel = document.querySelector('.list-scroll-panel');
    if (panel) {
      panel.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Mobile: scroll to tab bar (not page top)
    if (this.isMobile) {
      const tabBar = document.getElementById('results-tab-bar') as HTMLElement | null;
      if (tabBar) {
        window.scrollTo({ top: tabBar.offsetTop - 95, behavior: 'smooth' });
      }
    }
  }

  switchTab(tab: 'roadmap' | 'nearby' | 'lawyers') {
    if (this.activeResultsTab === tab) return;
    this.activeResultsTab = tab;
    this.scrollListToTop();
    this.isFiltering = true;
    if (this.filterTimeout) {
      clearTimeout(this.filterTimeout);
    }
    this.filterTimeout = setTimeout(() => {
      this.isFiltering = false;
      this.filterTimeout = null;
      this.cdr.markForCheck();
    }, 300);
  }

  toggleMobileFilters() {
    this.showMobileFilters = !this.showMobileFilters;
    if (this.showMobileFilters) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    this.cdr.markForCheck();
  }

  // Load help resources from service
  fetchData() {
    this.clearMapMarkers();
    this.isLoading = true;
    this.isCasePackSaved = false;
    this.isMapReady = false;
    this.isInitialLoad = true;
    this.cdr.markForCheck();

    // Check if offline and load cached Case Pack
    if (!navigator.onLine) {
      const key = `offline_casepack_${this.activeCategory.toLowerCase()}_${this.locationService.cleanAddress(this.locationQuery).toLowerCase()}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          this.roadmap = parsed.roadmap;
          this.helplines = parsed.helplines || [];
          this.resources = parsed.resources || [];
          this.lawyers = []; // No lawyers available offline

          // Extract unique subcategories
          const subSet = new Set<string>();
          (this.resources || []).forEach((r: any) => {
            if (r.subcategories) {
              r.subcategories.forEach((s: string) => subSet.add(s));
            }
          });
          this.allSubcategories = Array.from(subSet);

          this.isCasePackSaved = true;
          this.isLoading = false;
          this.applyFilters();
          this.cdr.markForCheck();
          return;
        } catch (e) {
          console.error('Failed to parse offline Case Pack data', e);
        }
      }
    }

    const state = this.extractState(this.locationQuery);
    this.legalService.getHelpNearMe(this.activeCategory, this.locationService.cleanAddress(this.locationQuery), state).subscribe({
      next: (res: any) => {
        // Premium 800ms artificial delay to allow smooth, polished skeleton loading animations
        setTimeout(() => {
          try {
            this.isLoading = false;
            if (res && res.success) {
              this.roadmap = res.roadmap;
              this.helplines = res.helplines || [];
              this.resources = res.resources || [];
              this.lawyers = res.lawyers || [];

              // Extract unique subcategories
              const subSet = new Set<string>();
              (res.resources || []).forEach((r: any) => {
                if (r.subcategories) {
                  r.subcategories.forEach((s: string) => subSet.add(s));
                }
              });
              (res.lawyers || []).forEach((l: any) => {
                if (l.specializations) {
                  l.specializations.forEach((s: string) => subSet.add(s));
                }
              });
              this.allSubcategories = Array.from(subSet);

              // Determine mapCenter coordinates based on search location
              const localResource = (res.resources || []).find((r: any) =>
                !r.isNationalAuthority && !r.isStateAuthority &&
                r.coordinates && typeof r.coordinates.lat === 'number'
              );
              if (localResource) {
                this.mapCenter = [localResource.coordinates.lat, localResource.coordinates.lng];
              } else {
                const city = this.locationService.cleanAddress(this.locationQuery).toLowerCase();
                const matched = Object.keys(CITY_COORDINATES).find(k => city.includes(k));
                this.mapCenter = matched ? CITY_COORDINATES[matched] : [28.6139, 77.2090];
              }

              this.applyFilters();
              this.checkOfflineCasePackStatus();
              this.isInitialLoad = false;
              setTimeout(() => {
                this.initMap();
                this.cdr.markForCheck();
              }, 100);
            }
          } catch (err) {
            this.isInitialLoad = false;
            console.error('Error during data processing in next callback:', err);
            this.isLoading = false;
          } finally {
            this.cdr.markForCheck();
          }
        }, 800);
      },
      error: (err) => {
        setTimeout(() => {
          this.isLoading = false;
          this.isInitialLoad = false;
          console.error('Failed to retrieve nearby help resources', err);
          this.cdr.markForCheck();
        }, 800);
      }
    });
  }

  private extractState(address: string): string {
    if (!address) return '';
    const normalized = address.toLowerCase();
    for (const state of INDIAN_STATES) {
      if (normalized.includes(state.toLowerCase())) {
        return state;
      }
    }
    return '';
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  applyFilters() {
    try {
      if (!this.isLoading && !this.isInitialLoad) {
        this.isFiltering = true;
      }
      this.syncFiltersToUrl();
      this.resourcePage = 1;
      this.lawyerPage = 1;

      let originLat = this.mapCenter[0];
      let originLng = this.mapCenter[1];

      if (this.userGpsLat !== null && this.userGpsLat !== undefined &&
        this.userGpsLng !== null && this.userGpsLng !== undefined) {
        const gpsToCenterDist = this.calculateDistance(
          this.userGpsLat,
          this.userGpsLng,
          this.mapCenter[0],
          this.mapCenter[1]
        );
        // If user GPS is within 80km of the searched map center, use precise GPS.
        // Otherwise, use map center to prevent showing huge distances for other cities.
        if (gpsToCenterDist <= 80) {
          originLat = this.userGpsLat;
          originLng = this.userGpsLng;
        }
      }

      // Enrich resources with distance
      (this.resources || []).forEach(item => {
        if (item && item.coordinates && typeof item.coordinates.lat === 'number' && typeof item.coordinates.lng === 'number') {
          item.distanceKm = this.calculateDistance(originLat, originLng, item.coordinates.lat, item.coordinates.lng);
        } else {
          item.distanceKm = null;
        }
      });

      // Enrich lawyers with distance and gender
      (this.lawyers || []).forEach((lawyer, i) => {
        if (lawyer) {
          if (!lawyer.gender) {
            lawyer.gender = 'Male';
          }

          if (lawyer.coordinates && typeof lawyer.coordinates.lat === 'number' && typeof lawyer.coordinates.lng === 'number') {
            lawyer.distanceKm = this.calculateDistance(originLat, originLng, lawyer.coordinates.lat, lawyer.coordinates.lng);
          } else {
            const offsetLat = (Math.sin(i) * 0.015) + 0.005;
            const offsetLng = (Math.cos(i) * 0.015) - 0.005;
            const simulatedLat = originLat + offsetLat;
            const simulatedLng = originLng + offsetLng;
            lawyer.coordinates = { lat: simulatedLat, lng: simulatedLng };
            lawyer.distanceKm = this.calculateDistance(originLat, originLng, simulatedLat, simulatedLng);
          }
        }
      });

      this.filteredResources = (this.resources || []).filter(item => {
        if (!item) return false;
        const matchedType =
          (item.type === 'LegalAid' && this.filters.resourceTypes.LegalAid) ||
          (item.type === 'Court' && this.filters.resourceTypes.Court) ||
          (item.type === 'GovernmentOffice' && this.filters.resourceTypes.GovernmentOffice) ||
          (item.type === 'PoliceStation' && this.filters.resourceTypes.GovernmentOffice);

        if (!matchedType) return false;

        // Filter by radius unless it's a National or State Authority
        const isNationalOrState = item.isNationalAuthority || item.isStateAuthority;
        if (!isNationalOrState && item.distanceKm !== null && item.distanceKm !== undefined) {
          if (item.distanceKm > this.filters.radius) return false;
        }

        // Subcategory Filter
        const activeSubcats = Object.keys(this.filters.subcategories).filter(k => this.filters.subcategories[k]);
        if (activeSubcats.length > 0) {
          const hasMatchingSub = (item.subcategories || []).some((s: string) => activeSubcats.includes(s));
          if (!hasMatchingSub) return false;
        }

        if (this.filters.openNow && !item.isOpenNow) return false;
        if (this.filters.verifiedOnly && !item.isVerified) return false;

        return true;
      });

      // Sort resources: group by type, then nearest first within each group
      const typeOrder: Record<string, number> = {
        'LegalAid': 0,
        'Court': 1,
        'GovernmentOffice': 2,
        'PoliceStation': 2
      };
      this.filteredResources.sort((a, b) => {
        const typeA = typeOrder[a.type] ?? 99;
        const typeB = typeOrder[b.type] ?? 99;
        if (typeA !== typeB) return typeA - typeB; // group by type first
        // within same type, sort nearest first
        if (a.distanceKm === null || a.distanceKm === undefined) return 1;
        if (b.distanceKm === null || b.distanceKm === undefined) return -1;
        return a.distanceKm - b.distanceKm;
      });

      this.filteredLawyers = (this.lawyers || []).filter(lawyer => {
        if (!lawyer) return false;
        if (!this.filters.resourceTypes.Lawyer) return false;

        // Filter by radius
        if (lawyer.distanceKm !== null && lawyer.distanceKm !== undefined) {
          if (lawyer.distanceKm > this.filters.radius) return false;
        }

        // Gender Filter
        if (this.filters.lawyerGender !== 'Any' && lawyer.gender) {
          if (lawyer.gender.toLowerCase() !== this.filters.lawyerGender.toLowerCase()) return false;
        }

        // Consultation Fee Filter
        if (lawyer.consultationFee !== undefined && lawyer.consultationFee !== null) {
          if (lawyer.consultationFee > this.filters.maxConsultationFee) return false;
        }

        // Specialization (Subcategory) Filter
        const activeSubcats = Object.keys(this.filters.subcategories).filter(k => this.filters.subcategories[k]);
        if (activeSubcats.length > 0) {
          const hasMatchingSub = (lawyer.specializations || []).some((s: string) => activeSubcats.includes(s));
          if (!hasMatchingSub) return false;
        }

        const activeLangs = Object.keys(this.filters.languages).filter(k => (this.filters.languages as any)[k]);
        if (activeLangs.length > 0) {
          const speaks = (lawyer.languagesSpoken || []).some((l: string) =>
            activeLangs.some(al => l.toLowerCase().includes(al.toLowerCase()))
          );
          if (!speaks) return false;
        }

        if (this.filters.verifiedOnly && !lawyer.isVerified) return false;

        return true;
      });

      // Sort lawyers by distance (nearest first)
      this.filteredLawyers.sort((a, b) => {
        if (a.distanceKm === null || a.distanceKm === undefined) return 1;
        if (b.distanceKm === null || b.distanceKm === undefined) return -1;
        return a.distanceKm - b.distanceKm;
      });

      this.nationalAuthorities = this.filteredResources.filter((r: any) => r.isNationalAuthority === true);
      this.slsaResources = this.filteredResources.filter((r: any) => r.isStateAuthority === true);
      this.nonSlsaFilteredResources = this.filteredResources.filter((r: any) => !r.isStateAuthority && !r.isNationalAuthority);

      this.allResultsCount = this.filteredResources.length + this.filteredLawyers.length + (this.filters.resourceTypes.Helpline ? this.helplines.length : 0);
      this.updateMapMarkers();

      if (this.isFiltering) {
        if (this.filterTimeout) {
          clearTimeout(this.filterTimeout);
        }
        this.filterTimeout = setTimeout(() => {
          this.isFiltering = false;
          this.filterTimeout = null;
          this.cdr.markForCheck();
        }, 300);
      }
    } catch (err) {
      this.isFiltering = false;
      if (this.filterTimeout) {
        clearTimeout(this.filterTimeout);
        this.filterTimeout = null;
      }
      console.error('Error executing applyFilters():', err);
    }
  }

  // URL sync logic
  private syncFiltersFromUrl() {
    const params = this.route.snapshot.queryParams;
    if (params['radius']) this.filters.radius = Number(params['radius']);
    if (params['openNow']) this.filters.openNow = params['openNow'] === 'true';
    if (params['verified']) this.filters.verifiedOnly = params['verified'] === 'true';
    if (params['gender']) this.filters.lawyerGender = params['gender'];
    if (params['maxFee']) this.filters.maxConsultationFee = Number(params['maxFee']);
    if (params['types']) {
      const types = params['types'].split(',');
      Object.keys(this.filters.resourceTypes).forEach(k => {
        (this.filters.resourceTypes as any)[k] = types.includes(k);
      });
    }
    if (params['langs']) {
      const langs = params['langs'].split(',');
      Object.keys(this.filters.languages).forEach(k => {
        (this.filters.languages as any)[k] = langs.includes(k);
      });
    }
    if (params['subcats']) {
      const subcats = params['subcats'].split(',');
      this.filters.subcategories = {};
      subcats.forEach((s: string) => {
        this.filters.subcategories[s] = true;
      });
    }
  }

  private syncFiltersToUrl() {
    const typesCsv = Object.keys(this.filters.resourceTypes)
      .filter(k => (this.filters.resourceTypes as any)[k])
      .join(',');

    const langsCsv = Object.keys(this.filters.languages)
      .filter(k => (this.filters.languages as any)[k])
      .join(',');

    const subcatsCsv = Object.keys(this.filters.subcategories)
      .filter(k => this.filters.subcategories[k])
      .join(',');

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        radius: this.filters.radius || null,
        types: typesCsv || null,
        openNow: this.filters.openNow ? 'true' : null,
        langs: langsCsv || null,
        verified: this.filters.verifiedOnly ? 'true' : null,
        gender: this.filters.lawyerGender !== 'Any' ? this.filters.lawyerGender : null,
        maxFee: this.filters.maxConsultationFee !== 3000 ? this.filters.maxConsultationFee : null,
        subcats: subcatsCsv || null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  // Pagination getters & methods
  get paginatedResources(): any[] {
    const limit = this.resourcePage * this.itemsPerPage;
    return this.nonSlsaFilteredResources.slice(0, limit);
  }

  get paginatedLawyers(): any[] {
    const limit = this.lawyerPage * this.itemsPerPage;
    return this.filteredLawyers.slice(0, limit);
  }

  get hasMoreResults(): boolean {
    const resourceLimit = this.resourcePage * this.itemsPerPage;
    const lawyerLimit = this.lawyerPage * this.itemsPerPage;
    return this.nonSlsaFilteredResources.length > resourceLimit || this.filteredLawyers.length > lawyerLimit;
  }

  get remainingCount(): number {
    const resourceLimit = this.resourcePage * this.itemsPerPage;
    const lawyerLimit = this.lawyerPage * this.itemsPerPage;
    const resRem = Math.max(0, this.nonSlsaFilteredResources.length - resourceLimit);
    const lawRem = Math.max(0, this.filteredLawyers.length - lawyerLimit);
    return resRem + lawRem;
  }

  loadMoreResults() {
    this.resourcePage++;
    this.lawyerPage++;
    this.cdr.markForCheck();
  }

  // Eligibility Flow Check
  startEligibilityCheck() {
    this.eligibilityStep = 1;
    this.eligibilityAnswers = { gender: '', income: '', category: '' };
  }

  openFreeAidModal() {
    this.showFreeAidModal = true;
    document.body.style.overflow = 'hidden';
    this.cdr.markForCheck();
  }

  closeFreeAidModal() {
    this.showFreeAidModal = false;
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  submitEligibilityStepFromModal() {
    this.submitEligibilityStep();
    this.showFreeAidModal = false;
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  resetEligibilityCheckFromModal() {
    this.resetEligibilityCheck();
    this.showFreeAidModal = false;
    document.body.style.overflow = '';
    this.cdr.markForCheck();
  }

  submitEligibilityStep() {
    const ans = this.eligibilityAnswers;
    const isWomanOrChild = ans.gender === 'female' || ans.gender === 'other';
    const isScStOrWorkman = ans.category === 'sc' || ans.category === 'st' || ans.category === 'labour';
    const isLowIncome = ans.income === 'under125' || ans.income === 'under300';

    if (isWomanOrChild || isScStOrWorkman || isLowIncome) {
      this.isFreeAidEligible = true;
    } else {
      this.isFreeAidEligible = false;
    }

    this.eligibilityStep = 2;

    if (this.isFreeAidEligible) {
      this.filters.resourceTypes.Court = false;
      this.filters.resourceTypes.GovernmentOffice = false;
      this.filters.resourceTypes.Lawyer = false;
      this.filters.resourceTypes.LegalAid = true;
      this.activeTab = 'LegalAid';
      this.applyFilters();
    }
  }

  resetEligibilityCheck() {
    this.eligibilityStep = 0;
    this.isFreeAidEligible = false;
    this.filters.resourceTypes.Court = true;
    this.filters.resourceTypes.GovernmentOffice = true;
    this.filters.resourceTypes.Lawyer = true;
    this.filters.resourceTypes.LegalAid = true;
    this.activeTab = 'All';
    this.applyFilters();
  }

  resetFilters() {
    this.filters = {
      radius: 50,
      resourceTypes: {
        LegalAid: true,
        Court: true,
        GovernmentOffice: true,
        Helpline: true,
        Lawyer: true
      },
      openNow: true,
      verifiedOnly: false,
      languages: {
        English: false,
        Hindi: false,
        Punjabi: false,
        Bengali: false
      },
      lawyerGender: 'Any',
      maxConsultationFee: 3000,
      subcategories: {} as Record<string, boolean>
    };
    this.applyFilters();
  }

  // Case Pack Storage
  checkOfflineCasePackStatus() {
    if (!this.activeCategory || !this.locationQuery) return;
    const key = `offline_casepack_${this.activeCategory.toLowerCase()}_${this.locationService.cleanAddress(this.locationQuery).toLowerCase()}`;
    this.isCasePackSaved = !!localStorage.getItem(key);
    this.cdr.markForCheck();
  }

  saveCasePackOffline() {
    if (!this.roadmap || !this.activeCategory || !this.locationQuery) return;
    const key = `offline_casepack_${this.activeCategory.toLowerCase()}_${this.locationService.cleanAddress(this.locationQuery).toLowerCase()}`;
    const payload = {
      category: this.activeCategory,
      location: this.locationQuery,
      roadmap: this.roadmap,
      helplines: this.helplines,
      resources: this.filteredResources.slice(0, 8),
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(payload));
    this.isCasePackSaved = true;
    this.cdr.markForCheck();
    alert('📋 Case Pack saved successfully to your offline library! You can access it anytime from this browser.');
  }

  removeOfflineCasePack() {
    if (!this.activeCategory || !this.locationQuery) return;
    const key = `offline_casepack_${this.activeCategory.toLowerCase()}_${this.locationService.cleanAddress(this.locationQuery).toLowerCase()}`;
    localStorage.removeItem(key);
    this.isCasePackSaved = false;
    this.cdr.markForCheck();
    alert('🗑️ Case Pack removed from your offline library.');
  }

  downloadCasePack() {
    this.showCasePackPreviewModal = true;
    this.cdr.markForCheck();
  }

  triggerPrintDownload() {
    this.showCasePackPreviewModal = false;
    this.cdr.markForCheck();

    setTimeout(() => {
      this.executePrintProcess();
    }, 300);
  }

  executePrintProcess() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const documentChecklistHtml = this.roadmap.documents.map((d: string) => `<li>[ ] ${d}</li>`).join('');
    const actionStepsHtml = this.roadmap.steps.map((s: any, i: number) => `
      <div style="margin-bottom: 15px;">
        <b style="color: #1e3a8a;">Step ${i + 1}: ${s.title}</b>
        <p style="margin: 4px 0 0 0; color: #475569; font-size: 13px;">${s.detail}</p>
      </div>
    `).join('');

    const resourceCardsHtml = this.filteredResources.slice(0, 5).map(res => `
      <div style="border-bottom: 1px solid #e2e8f0; padding: 10px 0;">
        <b style="font-size: 14px;">${res.name} (${res.type})</b>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">${res.address}</p>
        <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Phone: ${res.contactNumber || 'N/A'} | Hours: ${res.operatingHours}</p>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>LegalConnect Case Pack - ${this.activeCategory}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 20px; }
            h1 { margin: 0; color: #1e3a8a; font-size: 24px; }
            h2 { color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; font-size: 16px; margin-top: 30px; }
            .meta { color: #64748b; font-size: 12px; margin-top: 5px; }
            ul { padding-left: 20px; font-size: 13px; }
            li { margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LegalConnect Offline Case Pack</h1>
            <div class="meta">Category: ${this.activeCategory} | Location: ${this.locationQuery} | Generated: ${new Date().toLocaleDateString()}</div>
          </div>
          
          <h2>📋 PERSONALIZED LEGAL ROADMAP</h2>
          ${actionStepsHtml}

          <h2>📁 REQUIRED DOCUMENTS CHECKLIST</h2>
          <ul>${documentChecklistHtml}</ul>

          <h2>🏢 NEARBY SUPPORT CONTACTS</h2>
          ${resourceCardsHtml}

          <h2>💡 LOK ADALAT / ADR ADVISORY</h2>
          <p style="font-size: 13px; color: #475569;">${this.roadmap.lokAdalatGuidance}</p>

          <footer style="margin-top: 50px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center;">
            LegalConnect &copy; 2026. This is an informational case pack. Always consult a legal professional before filing suits.
          </footer>
          <script>
            window.onload = () => {
              window.print();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  // Speech synthesis narrator
  speakText(textKey: string, textToSpeak: string, langCode: 'en' | 'hi') {
    if (!('speechSynthesis' in window)) {
      alert('Your browser does not support voice narration.');
      return;
    }

    if (this.isSpeaking && this.speakingTextKey === textKey) {
      this.stopSpeaking();
      return;
    }

    this.stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = langCode === 'hi' ? 'hi-IN' : 'en-IN';

    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.startsWith(langCode));
    if (voice) utterance.voice = voice;

    utterance.onend = () => {
      this.zone.run(() => {
        this.isSpeaking = false;
        this.speakingTextKey = null;
        this.cdr.markForCheck();
      });
    };

    utterance.onerror = (e) => {
      console.error('Speech synthesis error', e);
      this.zone.run(() => {
        this.isSpeaking = false;
        this.speakingTextKey = null;
        this.cdr.markForCheck();
      });
    };

    this.isSpeaking = true;
    this.speakingTextKey = textKey;
    setTimeout(() => {
      if (this.speakingTextKey === textKey) {
        window.speechSynthesis.speak(utterance);
      }
    }, 100);
    this.cdr.markForCheck();
  }

  stopSpeaking() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    this.speakingTextKey = null;
    this.cdr.markForCheck();
  }

  // QR Code Modal
  openQrModal(name: string, item: any) {
    this.qrModalTitle = name;
    this.qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
      `Name: ${name}\nAddress: ${item.address || 'N/A'}\nPhone: ${item.contactNumber || item.number || 'N/A'}`
    )}`;
    this.showQrModal = true;
    this.cdr.markForCheck();
  }

  closeQrModal() {
    this.showQrModal = false;
    this.qrCodeUrl = '';
    this.cdr.markForCheck();
  }

  goToLawyerDetail(lawyerId: string) {
    this.router.navigate(['/lawyers', lawyerId]);
  }

  shareViaWhatsApp(resource: any) {
    let text = `*Legal Support Contact Details*\n\n`;
    text += `*Name:* ${resource.name}\n`;
    if (resource.type) text += `*Type:* ${resource.type}\n`;
    if (resource.contactNumber) text += `*Phone:* ${resource.contactNumber}\n`;
    if (resource.address) text += `*Address:* ${resource.address}\n`;
    if (resource.coordinates) {
      text += `*Directions:* https://www.google.com/maps/dir/?api=1&destination=${resource.coordinates.lat},${resource.coordinates.lng}\n`;
    }
    text += `\n_Shared via LegalConnect Find-Help Portal_`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  setViewMode(mode: 'split' | 'list' | 'map') {
    this.activeViewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => {
      if (this.map && (!document.getElementById('google-map-container') || !document.body.contains(this.map.getDiv()))) {
        this.clearMapMarkers();
        this.map = null;
      }
      if (this.map && window.hasOwnProperty('google')) {
        google.maps.event.trigger(this.map, 'resize');
        this.map.setCenter({ lat: this.mapCenter[0], lng: this.mapCenter[1] });
      } else if (this.showMap && !this.map) {
        this.initMap();
      }
    }, 100);
  }

  get showMap() {
    if (this.isMobile) {
      return this.activeViewMode === 'map';
    }
    return this.activeViewMode === 'split' || this.activeViewMode === 'map';
  }

  get showList() {
    if (this.isMobile) {
      return this.activeViewMode === 'list' || this.activeViewMode === 'split';
    }
    return this.activeViewMode === 'split' || this.activeViewMode === 'list';
  }

  openDirections(lat: number, lng: number) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  }

  // Dynamic Google Maps Map setup
  private loadGoogleMaps(): Promise<void> {
    if (window.hasOwnProperty('google') && (window as any).google.maps) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const apiKey = (window as any).GOOGLE_MAPS_API_KEY || '';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Maps'));
      document.body.appendChild(script);
    });
  }

  initMap() {
    const mapEl = document.getElementById('google-map-container');
    if (!mapEl) {
      setTimeout(() => this.initMap(), 100);
      return;
    }

    this.loadGoogleMaps().then(() => {
      const latLng = { lat: this.mapCenter[0], lng: this.mapCenter[1] };

      if (this.map) {
        try {
          if (document.getElementById('google-map-container') && document.body.contains(this.map.getDiv())) {
            this.map.setCenter(latLng);
            this.map.setZoom(this.getZoomLevel());
            this.updateMapMarkers();
            this.isMapReady = true;
            this.cdr.markForCheck();
            return;
          } else {
            this.clearMapMarkers();
            this.map = null;
          }
        } catch (e) {
          this.clearMapMarkers();
          this.map = null;
        }
      }

      this.map = new google.maps.Map(mapEl, {
        center: latLng,
        zoom: this.getZoomLevel(),
        disableDefaultUI: this.isMobile,
        zoomControl: !this.isMobile,
        mapTypeControl: false,
        scaleControl: true,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false
      });

      google.maps.event.addListenerOnce(this.map, 'idle', () => {
        this.isMapReady = true;
        this.cdr.markForCheck();
      });

      // 3-second fallback to prevent getting stuck in skeleton loader if maps api fails or offline
      setTimeout(() => {
        if (!this.isMapReady) {
          this.isMapReady = true;
          this.cdr.markForCheck();
        }
      }, 3000);

      if (this.mapThemeUnregister) {
        this.mapThemeUnregister();
      }
      this.mapThemeUnregister = this.themeService.registerMap(this.map, () => this.isSatelliteView);

      this.updateMapMarkers();
      this.cdr.markForCheck();
    }).catch(err => {
      this.isMapReady = true;
      this.cdr.markForCheck();
      console.error('Google Maps script load failed', err);
    });
  }

  setMapLayer() {
    this.themeService.applyMapTheme(this.map, this.isSatelliteView);
  }

  toggleSatelliteView() {
    this.isSatelliteView = !this.isSatelliteView;
    this.setMapLayer();
  }

  getZoomLevel(): number {
    const r = this.filters.radius;
    if (r <= 2) return 14;
    if (r <= 5) return 13;
    if (r <= 10) return 12;
    return 11;
  }

  clearMapMarkers() {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    this.markersMap.clear();
    this.infoWindowsMap.clear();
    if (this.userMarker) {
      this.userMarker.setMap(null);
      this.userMarker = null;
    }
  }

  getMarkerIcon(type: string): any {
    if (!window.hasOwnProperty('google')) return null;

    let pinColor = '#a855f7';
    let iconPath = '';

    if (type === 'User') {
      pinColor = '#10b981';
      iconPath = `<circle cx="12" cy="9.2" r="3.2" fill="white" />`;
    } else if (type === 'Court') {
      pinColor = '#2563eb';
      iconPath = `<path d="M7 9.2h10M12 6.2v8M9.5 14.2a2.5 2.5 0 01-5 0M19.5 14.2a2.5 2.5 0 01-5 0" stroke="white" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
    } else if (type === 'GovernmentOffice' || type === 'PoliceStation') {
      pinColor = '#f97316';
      iconPath = `<path d="M12 5.2l5 2.5v4.5c0 3.1-2.1 6-5 6.8-2.9-.8-5-3.7-5-6.8V7.7l5-2.5z" stroke="white" stroke-width="1.2" fill="none" stroke-linejoin="round" />`;
    } else if (type === 'Lawyer') {
      pinColor = '#d97706';
      iconPath = `<path d="M12 7.2a2 2 0 100 4 2 2 0 000-4zM6 16.2c0-2 3-3.5 6-3.5s6 1.5 6 3.5" stroke="white" stroke-width="1.2" fill="none" stroke-linecap="round" />`;
    } else {
      pinColor = '#9333ea';
      iconPath = `<path d="M12 6.2v4.5M12 13.2h.01" stroke="white" stroke-width="2" stroke-linecap="round" />`;
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="34" height="34">
        <path fill="${pinColor}" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 12 7 12s7-6.75 7-12c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9.2" r="5" fill="${pinColor}" />
        ${iconPath}
      </svg>
    `;

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg.trim()),
      scaledSize: new google.maps.Size(34, 34),
      anchor: new google.maps.Point(17, 34)
    };
  }

  private buildInfoWindowContent(opts: {
    title: string;
    subtitle?: string;
    tag?: string;
    tagColor?: string;
    address?: string;
    extra?: string;
  }): string {
    const isDark = document.documentElement.classList.contains('dark');
    const titleColor = isDark ? '#f1f5f9' : '#0f172a';
    const subColor = isDark ? '#94a3b8' : '#64748b';
    const addrColor = isDark ? '#cbd5e1' : '#475569';
    const tagBg = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
    return `
      <div style="
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        padding: 8px 11px 9px;
        width: 220px;
      ">
        <div style="font-size:13px; font-weight:700; color:${titleColor}; line-height:1.35; margin-bottom:${opts.tag ? '5px' : '0'};">${opts.title}</div>
        ${opts.tag ? `<div style="margin-bottom:${opts.address || opts.subtitle ? '4px' : '0'};"><span style="font-size:10px; font-weight:700; color:${opts.tagColor || subColor}; background:${tagBg}; border-radius:4px; padding:2px 7px; white-space:nowrap;">${opts.tag}</span></div>` : ''}
        ${opts.subtitle ? `<div style="font-size:11px; color:${subColor}; margin-top:2px; line-height:1.4;">${opts.subtitle}</div>` : ''}
        ${opts.address ? `<div style="font-size:11px; color:${addrColor}; line-height:1.4; margin-top:2px;">${opts.address}</div>` : ''}
        ${opts.extra ? `<div style="font-size:11px; color:${subColor}; margin-top:3px;">${opts.extra}</div>` : ''}
      </div>
    `;
  }

  private openMarkerPopup(infoWindow: any, marker: any) {
    if (this.openInfoWindow) {
      try { this.openInfoWindow.close(); } catch (_) { }
    }
    infoWindow.open(this.map, marker);
    this.openInfoWindow = infoWindow;
  }

  updateMapMarkers() {
    if (!this.map || !window.hasOwnProperty('google')) return;

    try {
      let userLat = this.mapCenter[0];
      let userLng = this.mapCenter[1];
      let isGpsUsed = false;

      if (this.userGpsLat !== null && this.userGpsLat !== undefined &&
        this.userGpsLng !== null && this.userGpsLng !== undefined) {
        const gpsToCenterDist = this.calculateDistance(
          this.userGpsLat,
          this.userGpsLng,
          this.mapCenter[0],
          this.mapCenter[1]
        );
        if (gpsToCenterDist <= 80) {
          userLat = this.userGpsLat;
          userLng = this.userGpsLng;
          isGpsUsed = true;
        }
      }

      if (!this.userMarker) {
        this.userMarker = new google.maps.Marker({
          position: { lat: userLat, lng: userLng },
          map: this.map,
          title: isGpsUsed ? 'Your Location' : (this.locationQuery || 'Search Center'),
          icon: this.getMarkerIcon('User'),
          zIndex: 999
        });
        const userInfoContent = this.buildInfoWindowContent({
          title: isGpsUsed ? 'Your Location' : (this.locationQuery || 'Search Center'),
          tag: isGpsUsed ? 'You are here' : 'Search Center',
          tagColor: '#10b981'
        });
        const userPopup = new google.maps.InfoWindow({ content: userInfoContent, disableAutoPan: false });
        this.userMarker.addListener('click', () => this.openMarkerPopup(userPopup, this.userMarker));
        this.userMarker.addListener('mouseover', () => this.openMarkerPopup(userPopup, this.userMarker));
      } else {
        this.userMarker.setPosition({ lat: userLat, lng: userLng });
        this.userMarker.setTitle(isGpsUsed ? 'Your Location' : (this.locationQuery || 'Search Center'));
      }

      const newItemsMap = new Map<string, { lat: number; lng: number; title: string; type: string; details: any }>();

      // Only map resources if the active tab is Guide (roadmap) or Nearby Help
      if (this.activeResultsTab === 'roadmap' || this.activeResultsTab === 'nearby') {
        (this.filteredResources || []).forEach(res => {
          if (res && res.coordinates && typeof res.coordinates.lat === 'number' && typeof res.coordinates.lng === 'number') {
            newItemsMap.set(res._id, {
              lat: res.coordinates.lat,
              lng: res.coordinates.lng,
              title: res.name || 'Resource',
              type: res.type,
              details: res
            });
          }
        });
      }

      // Only map lawyers if the active tab is Lawyers
      if (this.activeResultsTab === 'lawyers') {
        (this.filteredLawyers || []).forEach((lawyer, i) => {
          if (lawyer) {
            const offsetLat = (Math.sin(i) * 0.015) + 0.005;
            const offsetLng = (Math.cos(i) * 0.015) - 0.005;
            newItemsMap.set(lawyer._id, {
              lat: userLat + offsetLat,
              lng: userLng + offsetLng,
              title: lawyer.name || 'Lawyer',
              type: 'Lawyer',
              details: lawyer
            });
          }
        });
      }

      this.markersMap.forEach((marker, id) => {
        if (!newItemsMap.has(id)) {
          marker.setMap(null);
          this.markersMap.delete(id);
          this.infoWindowsMap.delete(id);
          const idx = this.markers.indexOf(marker);
          if (idx > -1) {
            this.markers.splice(idx, 1);
          }
        }
      });

      newItemsMap.forEach((item, id) => {
        if (!this.markersMap.has(id)) {
          const marker = new google.maps.Marker({
            position: { lat: item.lat, lng: item.lng },
            map: this.map,
            title: item.title,
            icon: this.getMarkerIcon(item.type)
          });

          let infoContent = '';
          if (item.type === 'Lawyer') {
            const lawyer = item.details;
            infoContent = this.buildInfoWindowContent({
              title: lawyer.name || 'Lawyer',
              tag: `⭐ ${lawyer.rating || 'N/A'}`,
              tagColor: '#d97706',
              subtitle: (lawyer.specializations && lawyer.specializations[0]) || '',
              extra: `Consultation: ₹${lawyer.consultationFee || 0}`
            });
          } else {
            const res = item.details;
            infoContent = this.buildInfoWindowContent({
              title: res.name || 'Resource',
              tag: `${res.type || ''}${res.operatingHours ? ' · ' + res.operatingHours : ''}`,
              tagColor: res.type === 'Court' ? '#2563eb' : res.type === 'GovernmentOffice' ? '#f97316' : '#9333ea',
              address: res.address || ''
            });
          }

          const infoWindow = new google.maps.InfoWindow({ content: infoContent, disableAutoPan: false });
          marker.addListener('click', () => {
            this.openMarkerPopup(infoWindow, marker);
            this.scrollToResourceCard(id);
          });
          marker.addListener('mouseover', () => this.openMarkerPopup(infoWindow, marker));

          this.markers.push(marker);
          this.markersMap.set(id, marker);
          this.infoWindowsMap.set(id, infoWindow);
        }
      });

      this.fitAllMarkers();
    } catch (err) {
      console.error('Error executing updateMapMarkers():', err);
    }
  }

  scrollToResourceCard(id: string) {
    this.highlightedResourceId = id;
    this.cdr.markForCheck();

    setTimeout(() => {
      const element = document.getElementById(`resource-card-${id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    setTimeout(() => {
      if (this.highlightedResourceId === id) {
        this.highlightedResourceId = null;
        this.cdr.markForCheck();
      }
    }, 3000);
  }

  highlightResource(id: string) {
    if (!this.map || !window.hasOwnProperty('google')) return;

    const marker = this.markersMap.get(id);
    const infoWindow = this.infoWindowsMap.get(id);

    if (marker) {
      this.map.panTo(marker.getPosition());
      marker.setAnimation(google.maps.Animation.BOUNCE);
      setTimeout(() => marker.setAnimation(null), 1400);

      if (infoWindow) {
        this.openMarkerPopup(infoWindow, marker);
      }
    }
  }

  clearHighlightResource(id: string) { }

  fitAllMarkers() {
    if (!this.map || !window.hasOwnProperty('google')) return;
    let userLat = this.mapCenter[0];
    let userLng = this.mapCenter[1];

    if (this.userGpsLat !== null && this.userGpsLat !== undefined &&
      this.userGpsLng !== null && this.userGpsLng !== undefined) {
      const gpsToCenterDist = this.calculateDistance(
        this.userGpsLat,
        this.userGpsLng,
        this.mapCenter[0],
        this.mapCenter[1]
      );
      if (gpsToCenterDist <= 80) {
        userLat = this.userGpsLat;
        userLng = this.userGpsLng;
      }
    }

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: userLat, lng: userLng });
    this.markers.forEach(m => { const pos = m.getPosition(); if (pos) bounds.extend(pos); });
    if (this.markers.length > 1) {
      this.map.fitBounds(bounds, { top: 60, right: 24, bottom: 24, left: 24 });
    } else {
      this.map.setCenter({ lat: userLat, lng: userLng });
      this.map.setZoom(14);
    }
  }

  recenterMap() {
    if (!this.map || !window.hasOwnProperty('google')) return;
    let userLat = this.mapCenter[0];
    let userLng = this.mapCenter[1];

    if (this.userGpsLat !== null && this.userGpsLat !== undefined &&
      this.userGpsLng !== null && this.userGpsLng !== undefined) {
      const gpsToCenterDist = this.calculateDistance(
        this.userGpsLat,
        this.userGpsLng,
        this.mapCenter[0],
        this.mapCenter[1]
      );
      if (gpsToCenterDist <= 80) {
        userLat = this.userGpsLat;
        userLng = this.userGpsLng;
      }
    }

    this.map.panTo({ lat: userLat, lng: userLng });
    this.map.setZoom(14);
  }

  get activeFiltersCount(): number {
    let count = 0;
    if (this.filters.radius !== 50) count++;
    if (!this.filters.openNow) count++;
    if (this.filters.verifiedOnly) count++;
    if (this.filters.lawyerGender !== 'Any') count++;
    if (this.filters.maxConsultationFee !== 3000) count++;

    // Resource Types (defaults to all checked)
    const uncheckedTypes = Object.keys(this.filters.resourceTypes).filter(
      k => !this.filters.resourceTypes[k as keyof typeof this.filters.resourceTypes]
    );
    if (uncheckedTypes.length > 0) count++;

    // Languages (defaults to all unchecked)
    const checkedLangs = Object.keys(this.filters.languages).filter(
      k => (this.filters.languages as any)[k]
    );
    if (checkedLangs.length > 0) count++;

    // Subcategories (defaults to empty/unchecked)
    const checkedSubcats = Object.keys(this.filters.subcategories).filter(
      k => this.filters.subcategories[k]
    );
    if (checkedSubcats.length > 0) count++;

    return count;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByResourceId(_: number, res: any): string {
    return res._id;
  }

  trackByLawyerId(_: number, lawyer: any): string {
    return lawyer._id;
  }

  trackByHelplineId(_: number, phone: any): string {
    return phone._id || phone.number;
  }
}
