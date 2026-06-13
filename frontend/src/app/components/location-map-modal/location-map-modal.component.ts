import {
  Component, EventEmitter, Output, OnInit, OnDestroy,
  AfterViewInit, Input, ChangeDetectionStrategy, ChangeDetectorRef, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

declare var google: any;

@Component({
  selector: 'app-location-map-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './location-map-modal.component.html',
  styleUrls: ['./location-map-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocationMapModalComponent implements OnInit, OnDestroy, AfterViewInit {
  @Input() initialCity = 'New Delhi';
  @Output() locationConfirmed = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  mapMode: 'map' | 'satellite' = 'map';
  searchQuery = '';
  detectedAddress = '';
  isLoadingAddress = false;
  isDetectingGps = false;

  // Map state
  private map: any = null;
  private marker: any = null;
  private geocoder: any = null;
  private searchBox: any = null;
  private currentLat = 28.6139;
  private currentLng = 77.2090;

  // City center fallbacks
  private cityCenters: Record<string, [number, number]> = {
    'new delhi': [28.6139, 77.2090],
    'delhi': [28.6139, 77.2090],
    'mumbai': [19.0760, 72.8777],
    'bengaluru': [12.9716, 77.5946],
    'bangalore': [12.9716, 77.5946],
    'chennai': [13.0827, 80.2707],
    'kolkata': [22.5726, 88.3639],
    'hyderabad': [17.3850, 78.4867],
    'pune': [18.5204, 73.8567],
    'ahmedabad': [23.0225, 72.5714],
    'jaipur': [26.9124, 75.7873],
    'lucknow': [26.8467, 80.9462]
  };

  constructor(private cdr: ChangeDetectorRef, private zone: NgZone) { }

  ngOnInit() {
    // Center on initial city
    const key = this.initialCity.toLowerCase();
    let matched = false;
    for (const city of Object.keys(this.cityCenters)) {
      if (key.includes(city)) {
        [this.currentLat, this.currentLng] = this.cityCenters[city];
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Default to Delhi center
      [this.currentLat, this.currentLng] = [28.6139, 77.2090];
    }
    document.body.style.overflow = 'hidden';
  }

  ngAfterViewInit() {
    this.loadGoogleMaps().then(() => this.initMap()).catch(console.error);
  }

  ngOnDestroy() {
    document.body.style.overflow = '';
  }

  private loadGoogleMaps(): Promise<void> {
    if (window.hasOwnProperty('google') && (window as any).google?.maps) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        return;
      }
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

  private initMap() {
    const mapEl = document.getElementById('location-modal-map');
    if (!mapEl || !window.hasOwnProperty('google')) return;

    const isDark = document.documentElement.classList.contains('dark');
    const lightStyle = [
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] }
    ];

    this.map = new google.maps.Map(mapEl, {
      center: { lat: this.currentLat, lng: this.currentLng },
      zoom: 14,
      disableDefaultUI: true,
      zoomControl: true,
      fullscreenControl: false,
      streetViewControl: false,
      mapTypeControl: false,
      styles: isDark ? [] : lightStyle
    });

    this.geocoder = new google.maps.Geocoder();

    // Draggable red pin
    this.marker = new google.maps.Marker({
      position: { lat: this.currentLat, lng: this.currentLng },
      map: this.map,
      draggable: true,
      animation: google.maps.Animation.DROP
    });

    // Sync map and pin to the user's initial location if it's a custom/exact address
    const key = this.initialCity.toLowerCase();
    const isPopular = !!this.cityCenters[key];
    if (this.initialCity && !isPopular) {
      this.geocoder.geocode({ address: this.initialCity }, (results: any[], status: string) => {
        if (status === 'OK' && results[0] && results[0].geometry?.location) {
          const loc = results[0].geometry.location;
          this.currentLat = loc.lat();
          this.currentLng = loc.lng();
          this.map.setCenter(loc);
          this.marker.setPosition(loc);
          this.reverseGeocode(this.currentLat, this.currentLng);
        }
      });
    }

    // On drag end — reverse geocode
    this.marker.addListener('dragend', () => {
      this.zone.run(() => {
        const pos = this.marker.getPosition();
        this.currentLat = pos.lat();
        this.currentLng = pos.lng();
        this.reverseGeocode(this.currentLat, this.currentLng);
      });
    });

    // Click on map to move pin
    this.map.addListener('click', (event: any) => {
      this.zone.run(() => {
        this.currentLat = event.latLng.lat();
        this.currentLng = event.latLng.lng();
        this.marker.setPosition(event.latLng);
        this.reverseGeocode(this.currentLat, this.currentLng);
      });
    });

    // Initialize search box
    const searchInput = document.getElementById('modal-location-search') as HTMLInputElement;
    if (searchInput && google.maps.places) {
      this.searchBox = new google.maps.places.Autocomplete(searchInput, {
        componentRestrictions: { country: 'in' }
      });
      this.searchBox.addListener('place_changed', () => {
        this.zone.run(() => {
          const place = this.searchBox.getPlace();
          if (place.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            this.currentLat = lat;
            this.currentLng = lng;
            this.map.setCenter({ lat, lng });
            this.map.setZoom(14);
            this.marker.setPosition({ lat, lng });
            this.detectedAddress = place.formatted_address || place.name || '';
            this.searchQuery = this.detectedAddress;
            this.cdr.markForCheck();
          }
        });
      });
    }

    // Initial reverse geocode
    this.reverseGeocode(this.currentLat, this.currentLng);
  }

  reverseGeocode(lat: number, lng: number) {
    if (!this.geocoder) return;
    this.isLoadingAddress = true;
    this.cdr.markForCheck();

    this.geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      this.zone.run(() => {
        this.isLoadingAddress = false;
        if (status === 'OK' && results[0]) {
          this.detectedAddress = results[0].formatted_address;
        } else {
          this.detectedAddress = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
        this.cdr.markForCheck();
      });
    });
  }

  useMyLocation() {
    if (!navigator.geolocation) {
      this.detectedAddress = 'Geolocation not supported';
      this.cdr.markForCheck();
      return;
    }
    this.isDetectingGps = true;
    this.detectedAddress = 'Detecting your location...';
    this.cdr.markForCheck();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.zone.run(() => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.currentLat = lat;
          this.currentLng = lng;
          if (this.map) {
            this.map.setCenter({ lat, lng });
            this.map.setZoom(15);
          }
          if (this.marker) {
            this.marker.setPosition({ lat, lng });
          }
          this.isDetectingGps = false;
          this.reverseGeocode(lat, lng);
        });
      },
      (err) => {
        this.zone.run(() => {
          this.isDetectingGps = false;
          this.detectedAddress = 'Could not get location. Please drag the pin.';
          this.cdr.markForCheck();
        });
      }
    );
  }

  setMapMode(mode: 'map' | 'satellite') {
    this.mapMode = mode;
    if (this.map && window.hasOwnProperty('google')) {
      this.map.setMapTypeId(
        mode === 'satellite' ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP
      );
    }
    this.cdr.markForCheck();
  }

  // Extract city name from full address for LocationService
  private extractCityFromAddress(address: string): string {
    if (!address) return this.initialCity;
    // Try to extract city from formatted address components
    const parts = address.split(',').map(p => p.trim());
    // Usually the structure is: Area, City, State, Country
    // We want city-level granularity (usually 2nd from last before country)
    if (parts.length >= 3) {
      return parts[parts.length - 3] || parts[0];
    }
    return parts[0] || this.initialCity;
  }

  confirm() {
    if (!this.detectedAddress) return;
    this.locationConfirmed.emit(this.detectedAddress);
  }

  close() {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close();
    }
  }
}