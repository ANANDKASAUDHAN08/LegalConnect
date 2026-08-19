import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TooltipDirective } from '../../../shared/directives/tooltip.directive';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { ToastService } from '../../../shared/services/toast.service';
import {
  INDIAN_STATES,
  getStateDistricts
} from '../../../core/constants/geo.constants';
import {
  LocationSearchResult,
  MAJOR_JUDICIAL_HUBS,
  searchLocalJurisdictions,
  parseAddressToJurisdiction,
  findBestMatchingDistrict
} from '../../../core/constants/judicial-hubs.constants';
import { environment } from '../../../../environments/environment';

export interface PresetHubItem extends LocationSearchResult {
  shortTitle: string;
}

@Component({
  selector: 'admin-resource-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, SelectComponent],
  templateUrl: './resource-modal.component.html',
  styleUrl: './resource-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResourceModalComponent implements OnInit, OnDestroy, OnChanges {
  @Input({ required: true }) isOpen = false;
  @Input() isEditMode = false;
  @Input() formData: any = {};
  @Input() stateOptions: SelectOption[] = [];
  @Input() isSaving = false;
  @Input() isGeocoding = false;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();
  @Output() resolveGis = new EventEmitter<void>();

  @ViewChild('locationSearchBox') locationSearchBox?: ElementRef;

  activeTab: 'general' | 'location' | 'facilities' | 'leadership' = 'general';

  // --- Select Dropdown Options for Enterprise Custom UI ---
  readonly institutionTypeOptions: SelectOption[] = [
    { label: 'Court / Judiciary Complex', value: 'Court', icon: 'shield', color: '#38bdf8' },
    { label: 'Legal Aid / DLSA Center', value: 'LegalAid', icon: 'file-text', color: '#34d399' },
    { label: 'Police Station / Cyber Desk', value: 'PoliceStation', icon: 'shield', color: '#f59e0b' },
    { label: 'Government Administrative Office', value: 'GovernmentOffice', icon: 'archive', color: '#a78bfa' }
  ];

  readonly jurisdictionLevelOptions: SelectOption[] = [
    { label: 'Supreme Court (Apex / National)', value: 'National', icon: 'star', color: '#fbbf24' },
    { label: 'High Court (State Jurisdiction)', value: 'State', icon: 'award', color: '#38bdf8' },
    { label: 'District & Sessions Court / DLSA', value: 'District', icon: 'map-pin', color: '#818cf8' },
    { label: 'Taluka Court / TLSC Sub-division', value: 'Taluka', icon: 'map-pin', color: '#94a3b8' },
    { label: 'Special Tribunal / Lok Adalat', value: 'SpecialTribunal', icon: 'zap', color: '#ec4899' }
  ];

  // Indian States & Preset Hubs
  readonly indianStates = INDIAN_STATES;

  // Deduplicated Presets with clear landmark badges
  readonly judicialHubPresets: PresetHubItem[] = [
    { ...MAJOR_JUDICIAL_HUBS[0], shortTitle: 'Supreme Court' },
    { ...MAJOR_JUDICIAL_HUBS[1], shortTitle: 'Delhi High Court' },
    { ...MAJOR_JUDICIAL_HUBS[2], shortTitle: 'Tis Hazari Court' },
    { ...MAJOR_JUDICIAL_HUBS[3], shortTitle: 'Saket Court' },
    { ...MAJOR_JUDICIAL_HUBS[4], shortTitle: 'Patiala House' },
    { ...MAJOR_JUDICIAL_HUBS[5], shortTitle: 'Karkardooma' },
    { ...MAJOR_JUDICIAL_HUBS[6], shortTitle: 'Bombay High Court' },
    { ...MAJOR_JUDICIAL_HUBS[7], shortTitle: 'Madras High Court' }
  ];

  // --- Location Search & Autocomplete State ---
  locationSearchQuery = '';
  isSearchingLocation = false;
  showSuggestions = false;
  activeSuggestionIndex = -1;
  suggestions: LocationSearchResult[] = [];
  appliedLocationInfo: {
    title: string;
    subtitle: string;
    state: string;
    district: string;
    lat: number;
    lng: number;
  } | null = null;
  isGpsDetecting = false;

  private searchSubject$ = new Subject<string>();
  private searchSub?: Subscription;

  mapType: 'roadmap' | 'satellite' = 'roadmap';

  constructor(
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private toast: ToastService
  ) { }

  ngOnInit(): void {
    // 200ms debouncer for location place search
    this.searchSub = this.searchSubject$.pipe(
      debounceTime(200),
      distinctUntilChanged()
    ).subscribe(query => {
      this.executeLocationSearch(query);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && changes['isOpen'].currentValue) {
      this.activeTab = 'general';
      this.locationSearchQuery = '';
      this.showSuggestions = false;
      this.suggestions = [];
      this.appliedLocationInfo = null;

      // Defaults if not defined
      if (!this.formData.type) {
        this.formData.type = 'Court';
      }
      if (!this.formData.jurisdictionLevel) {
        this.formData.jurisdictionLevel = 'District';
      }
      if (!this.formData.state && this.indianStates.length > 0) {
        this.formData.state = 'Delhi';
        const districts = getStateDistricts('Delhi');
        if (districts.length > 0) {
          this.formData.district = districts[0];
          this.formData.city = districts[0];
        }
      }

      // If in edit mode, sync applied info
      if (this.isEditMode && this.formData.name) {
        this.appliedLocationInfo = {
          title: this.formData.name,
          subtitle: `${this.formData.district || ''}, ${this.formData.state || ''}`,
          state: this.formData.state || '',
          district: this.formData.district || '',
          lat: Number(this.formData.lat) || 28.6139,
          lng: Number(this.formData.lng) || 77.2090
        };
      }
    }
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showSuggestions) {
      this.showSuggestions = false;
      this.cdr.markForCheck();
      return;
    }
    if (this.isOpen && !this.isSaving) {
      this.close();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeyDown(event: KeyboardEvent): void {
    if (this.isOpen && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      if (this.canSave) {
        event.preventDefault();
        this.onSave();
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showSuggestions && this.locationSearchBox) {
      const isClickInside = this.locationSearchBox.nativeElement.contains(event.target as Node);
      if (!isClickInside) {
        this.showSuggestions = false;
        this.cdr.markForCheck();
      }
    }
  }

  setTab(tab: 'general' | 'location' | 'facilities' | 'leadership'): void {
    this.activeTab = tab;
    if (tab === 'location') {
      // Pre-seed local suggestions if search query is empty
      if (!this.locationSearchQuery.trim()) {
        this.suggestions = MAJOR_JUDICIAL_HUBS.slice(0, 6);
      }
    }
    this.cdr.markForCheck();
  }

  // --- Cascading Select Options ---
  get stateSelectOptions(): SelectOption[] {
    return this.indianStates.map(st => ({
      label: st,
      value: st,
      icon: 'map-pin'
    }));
  }

  get availableDistricts(): string[] {
    if (!this.formData.state) return [];
    return getStateDistricts(this.formData.state);
  }

  get districtSelectOptions(): SelectOption[] {
    return this.availableDistricts.map(dst => ({
      label: dst,
      value: dst,
      icon: 'map-pin'
    }));
  }

  onStateChange(st: string): void {
    this.formData.state = st;
    const districts = getStateDistricts(st);
    if (districts.length > 0 && (!this.formData.district || !districts.includes(this.formData.district))) {
      this.formData.district = districts[0];
      this.formData.city = districts[0];
    } else if (districts.length === 0) {
      this.formData.district = '';
      this.formData.city = '';
    }
    this.cdr.markForCheck();
  }

  onDistrictChange(dst: string): void {
    this.formData.district = dst;
    this.formData.city = dst;
    this.cdr.markForCheck();
  }

  onTypeChange(newType: string): void {
    this.formData.type = newType;
    if (newType === 'PoliceStation') {
      this.formData.jurisdictionLevel = 'District';
    }
    this.cdr.markForCheck();
  }

  onJurisdictionLevelChange(newLevel: string): void {
    this.formData.jurisdictionLevel = newLevel;
    this.cdr.markForCheck();
  }

  onNameChange(name: string): void {
    if (!name) return;
    const lower = name.toLowerCase();
    if (!this.isEditMode) {
      if (lower.includes('high court')) {
        this.formData.jurisdictionLevel = 'State';
        this.formData.type = 'Court';
      } else if (lower.includes('supreme court')) {
        this.formData.jurisdictionLevel = 'National';
        this.formData.type = 'Court';
      } else if (lower.includes('police') || lower.includes('thana') || lower.includes('chowki') || lower.includes('cyber crime')) {
        this.formData.type = 'PoliceStation';
        this.formData.jurisdictionLevel = 'District';
      } else if (lower.includes('dlsa') || lower.includes('legal aid') || lower.includes('slsa') || lower.includes('taluka legal') || lower.includes('tlsc')) {
        this.formData.type = 'LegalAid';
        this.formData.jurisdictionLevel = lower.includes('slsa') ? 'State' : (lower.includes('taluka') || lower.includes('tlsc') ? 'Taluka' : 'District');
      } else if (lower.includes('taluka court') || lower.includes('munsiff') || lower.includes('civil court')) {
        this.formData.type = 'Court';
        this.formData.jurisdictionLevel = 'Taluka';
      } else if (lower.includes('tribunal') || lower.includes('lok adalat') || lower.includes('nclt') || lower.includes('cat')) {
        this.formData.type = 'Court';
        this.formData.jurisdictionLevel = 'SpecialTribunal';
      }
    }
    this.cdr.markForCheck();
  }

  toggleMapType(): void {
    this.mapType = this.mapType === 'roadmap' ? 'satellite' : 'roadmap';
    this.cdr.markForCheck();
  }

  // --- Location Autocomplete Search Engine ---
  onLocationSearchInput(query: string): void {
    this.locationSearchQuery = query;
    if (!query.trim()) {
      this.suggestions = MAJOR_JUDICIAL_HUBS.slice(0, 6);
      this.showSuggestions = true;
      this.activeSuggestionIndex = -1;
      this.isSearchingLocation = false;
      this.cdr.markForCheck();
      return;
    }
    this.isSearchingLocation = true;
    this.showSuggestions = true;
    this.searchSubject$.next(query);
    this.cdr.markForCheck();
  }

  private executeLocationSearch(query: string): void {
    if (!query.trim()) {
      this.suggestions = MAJOR_JUDICIAL_HUBS.slice(0, 6);
      this.isSearchingLocation = false;
      this.cdr.markForCheck();
      return;
    }

    // 1. Instant 0-Latency Local Matches
    const localMatches = searchLocalJurisdictions(query, 6);
    this.suggestions = [...localMatches];
    this.cdr.markForCheck();

    // 2. Query Remote Geocoder in background for exact address matches
    const apiKey = (environment as any).googleMapsApiKey;
    const encoded = encodeURIComponent(`${query.trim()}, India`);
    const endpoint = apiKey
      ? `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`
      : `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&countrycodes=in&limit=4&addressdetails=1`;

    fetch(endpoint)
      .then(res => res.json())
      .then(data => {
        this.isSearchingLocation = false;
        const remoteResults: LocationSearchResult[] = [];

        if (apiKey && data.results && data.results.length > 0) {
          data.results.slice(0, 4).forEach((item: any) => {
            const parsed = parseAddressToJurisdiction(item.formatted_address);
            remoteResults.push({
              title: item.formatted_address.split(',')[0] || item.formatted_address,
              subtitle: item.formatted_address,
              address: item.formatted_address,
              district: parsed.district || parsed.state,
              city: parsed.district || parsed.state,
              state: parsed.state,
              pincode: parsed.pincode,
              lat: item.geometry.location.lat,
              lng: item.geometry.location.lng,
              type: 'geocoded'
            });
          });
        } else if (Array.isArray(data) && data.length > 0) {
          data.forEach((item: any) => {
            const parsed = parseAddressToJurisdiction(item.display_name);
            remoteResults.push({
              title: item.display_name.split(',')[0] || item.display_name,
              subtitle: item.display_name,
              address: item.display_name,
              district: parsed.district || parsed.state,
              city: parsed.district || parsed.state,
              state: parsed.state,
              pincode: parsed.pincode,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              type: 'geocoded'
            });
          });
        }

        // Merge without duplicates
        const combined = [...this.suggestions];
        remoteResults.forEach(rem => {
          if (!combined.some(c => Math.abs(c.lat - rem.lat) < 0.001 && Math.abs(c.lng - rem.lng) < 0.001)) {
            combined.push(rem);
          }
        });

        this.suggestions = combined.slice(0, 8);
        this.cdr.markForCheck();
      })
      .catch(() => {
        this.isSearchingLocation = false;
        this.cdr.markForCheck();
      });
  }

  // --- Apply Selected Location To Form ---
  applySuggestion(item: LocationSearchResult): void {
    if (!item) return;

    // 1. Set Address & State
    this.formData.address = item.address || item.title;
    this.formData.state = item.state;

    // 2. Match District in Cascading list
    const matchedDist = findBestMatchingDistrict(item.state, item.district || item.city);
    this.formData.district = matchedDist;
    this.formData.city = item.city || matchedDist;

    // 3. Set PIN Code if returned
    if (item.pincode) {
      this.formData.pincode = item.pincode;
    }

    // 4. Set Coordinates
    this.formData.lat = parseFloat(Number(item.lat).toFixed(6));
    this.formData.lng = parseFloat(Number(item.lng).toFixed(6));

    // 5. Update confirmation banner
    this.appliedLocationInfo = {
      title: item.title,
      subtitle: item.subtitle || item.address,
      state: item.state,
      district: this.formData.district,
      lat: this.formData.lat,
      lng: this.formData.lng
    };

    this.locationSearchQuery = item.title;
    this.showSuggestions = false;
    this.activeSuggestionIndex = -1;

    // Snackbar notification for user feedback
    this.toast.info(`Applied GIS profile for ${item.title}`, 'GIS Auto-Applied');
    this.cdr.markForCheck();
  }

  clearLocationSearch(): void {
    this.locationSearchQuery = '';
    this.suggestions = MAJOR_JUDICIAL_HUBS.slice(0, 6);
    this.showSuggestions = false;
    this.activeSuggestionIndex = -1;
    this.cdr.markForCheck();
  }

  // --- Quick Judicial Hub Preset Chip ---
  applyPresetHub(hub: PresetHubItem | LocationSearchResult): void {
    this.applySuggestion(hub);
  }

  // --- GPS Current Device Detection ---
  detectCurrentLocationGps(): void {
    if (!navigator.geolocation) {
      this.toast.warning('Geolocation is not supported by your browser.', 'GPS Unavailable');
      return;
    }

    this.isGpsDetecting = true;
    this.cdr.markForCheck();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        this.formData.lat = lat;
        this.formData.lng = lng;

        // Reverse geocode via OSM Nominatim
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`)
          .then(res => res.json())
          .then(data => {
            this.isGpsDetecting = false;
            if (data && data.display_name) {
              const parsed = parseAddressToJurisdiction(data.display_name);
              this.formData.address = data.display_name;
              this.formData.state = parsed.state;
              this.formData.district = findBestMatchingDistrict(parsed.state, parsed.district);
              this.formData.city = this.formData.district;
              if (parsed.pincode) this.formData.pincode = parsed.pincode;

              this.appliedLocationInfo = {
                title: 'Current Device Location',
                subtitle: data.display_name,
                state: parsed.state,
                district: this.formData.district,
                lat,
                lng
              };
              this.locationSearchQuery = data.display_name.split(',')[0] || 'Current Location';
              this.toast.success(`Device GPS resolved: ${this.formData.district || parsed.state}`, 'GPS Pinpoint Locked');
            }
            this.cdr.markForCheck();
          })
          .catch(() => {
            this.isGpsDetecting = false;
            this.toast.warning('Reverse geocoding timed out. Coordinates were set.', 'GPS Warning');
            this.cdr.markForCheck();
          });
      },
      (err) => {
        this.isGpsDetecting = false;
        this.toast.warning(err.message || 'Unable to access device GPS coordinates. Please allow location permissions.', 'GPS Permission Denied');
        this.cdr.markForCheck();
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  // --- Keyboard Navigation for Suggestions ---
  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.showSuggestions || !this.suggestions.length) {
      if (event.key === 'ArrowDown') {
        this.showSuggestions = true;
        this.activeSuggestionIndex = 0;
        event.preventDefault();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeSuggestionIndex = (this.activeSuggestionIndex + 1) % this.suggestions.length;
      this.cdr.markForCheck();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeSuggestionIndex = this.activeSuggestionIndex <= 0 ? this.suggestions.length - 1 : this.activeSuggestionIndex - 1;
      this.cdr.markForCheck();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.activeSuggestionIndex >= 0 && this.suggestions[this.activeSuggestionIndex]) {
        this.applySuggestion(this.suggestions[this.activeSuggestionIndex]);
      } else if (this.suggestions.length > 0) {
        this.applySuggestion(this.suggestions[0]);
      }
    } else if (event.key === 'Escape') {
      this.showSuggestions = false;
      this.activeSuggestionIndex = -1;
      this.cdr.markForCheck();
    }
  }

  // --- Interactive Mini-Map Preview Sanitized URL (Google Maps) ---
  get safeMapUrl(): SafeResourceUrl {
    const lat = Number(this.formData.lat) || 28.6139;
    const lng = Number(this.formData.lng) || 77.2090;
    const apiKey = (environment as any).googleMapsApiKey;
    let url: string;
    if (apiKey) {
      if (this.mapType === 'satellite') {
        url = `https://www.google.com/maps/embed/v1/view?key=${apiKey}&center=${lat},${lng}&zoom=17&maptype=satellite`;
      } else {
        url = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=16`;
      }
    } else {
      url = `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=16&output=embed`;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  // --- Validation Helpers ---
  get isPincodeValid(): boolean {
    if (!this.formData.pincode) return true;
    return /^\d{6}$/.test(this.formData.pincode.trim());
  }

  get isCoordinatesValid(): boolean {
    const lat = Number(this.formData.lat);
    const lng = Number(this.formData.lng);
    return !isNaN(lat) && !isNaN(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
  }

  get isEmailValid(): boolean {
    if (!this.formData.email) return true;
    const emails = this.formData.email.split(',').map((e: string) => e.trim());
    return emails.every((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  }

  get hasGeneralErrors(): boolean {
    return !this.formData.name || !this.formData.name.trim();
  }

  get hasLocationErrors(): boolean {
    return !this.formData.address || !this.formData.address.trim() || !this.isPincodeValid || !this.isCoordinatesValid;
  }

  get isGeneralComplete(): boolean {
    return !!this.formData.name?.trim() && !!this.formData.type;
  }

  get isLocationComplete(): boolean {
    return !!this.formData.address?.trim() && this.isPincodeValid && this.isCoordinatesValid && !!this.formData.state;
  }

  get isFacilitiesComplete(): boolean {
    return true; // Facilities tab has no required fields — always complete
  }

  get isLeadershipComplete(): boolean {
    return this.isEmailValid; // Only email validation is blocking
  }

  get completedSectionsCount(): number {
    let count = 0;
    if (this.isGeneralComplete) count++;
    if (this.isLocationComplete) count++;
    if (this.isFacilitiesComplete) count++;
    if (this.isLeadershipComplete) count++;
    return count;
  }

  get completionPercent(): number {
    return Math.round((this.completedSectionsCount / 4) * 100);
  }

  get canSave(): boolean {
    return !this.hasGeneralErrors && !this.hasLocationErrors && this.isEmailValid && !this.isSaving;
  }

  close(): void {
    this.closed.emit();
  }

  onSave(): void {
    if (!this.canSave) {
      if (this.hasGeneralErrors) {
        this.toast.warning('Please provide the Institution Official Name.', 'Required Field');
        this.setTab('general');
      } else if (this.hasLocationErrors) {
        this.toast.warning('Please provide a physical street address and valid coordinates.', 'Required Field');
        this.setTab('location');
      } else if (!this.isEmailValid) {
        this.toast.warning('Please provide a valid official registry email address.', 'Invalid Email');
        this.setTab('leadership');
      }
      return;
    }
    this.saved.emit();
  }

  onResolveGis(): void {
    this.toast.info('Querying geocoder for coordinates...', 'Resolving GIS Pinpoint');
    this.resolveGis.emit();
  }
}