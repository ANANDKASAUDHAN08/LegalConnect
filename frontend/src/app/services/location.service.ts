import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { INDIAN_GEO_CENTROIDS } from '../core/constants/legal-resource.constants';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private activeLocationSubject = new BehaviorSubject<string>(this.getStoredLocation() || 'New Delhi');
  activeLocation$ = this.activeLocationSubject.asObservable();

  private isEstimatedSubject = new BehaviorSubject<boolean>(this.getStoredEstimatedState());
  isEstimated$ = this.isEstimatedSubject.asObservable();

  private coordinatesSubject = new BehaviorSubject<{ lat: number; lng: number } | null>(this.getStoredCoordinates());
  coordinates$ = this.coordinatesSubject.asObservable();

  constructor(private ngZone: NgZone) { }

  getCurrentLocation(): string {
    return this.activeLocationSubject.value;
  }

  isLocationEstimated(): boolean {
    return this.isEstimatedSubject.value;
  }

  getCoordinates(): { lat: number; lng: number } | null {
    return this.coordinatesSubject.value;
  }

  cleanAddress(address: string): string {
    if (!address) return '';
    const trimmed = address.trim();
    if (!trimmed.includes(',')) {
      return trimmed;
    }

    const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);

    // Remove "India" if it is the last element
    if (parts.length > 1 && parts[parts.length - 1].toLowerCase() === 'india') {
      parts.pop();
    }

    if (parts.length === 1) {
      return parts[0].replace(/\b\d{5,}\b/g, '').trim();
    }

    const states = [
      'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh',
      'goa', 'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka',
      'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram',
      'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu',
      'telangana', 'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal',
      'delhi', 'jammu and kashmir', 'ladakh', 'puducherry', 'chandigarh',
      'dadra and nagar haveli', 'daman and diu', 'lakshadweep', 'andaman and nicobar'
    ];

    let lastPart = parts[parts.length - 1].toLowerCase();
    lastPart = lastPart.replace(/\b\d{5,}\b/g, '').trim();

    // If the last part is a known state, return "City, State"
    if (states.some(state => lastPart.includes(state)) && parts.length > 1) {
      const city = parts[parts.length - 2].replace(/\b\d{5,}\b/g, '').trim();
      const stateName = parts[parts.length - 1].replace(/\b\d{5,}\b/g, '').trim();
      return `${city}, ${stateName}`;
    }

    return parts[parts.length - 1].replace(/\b\d{5,}\b/g, '').trim();
  }

  setLocation(location: string, isEstimated: boolean = false, coordinates?: { lat: number; lng: number } | null) {
    if (!location || !location.trim()) return;
    const trimmedLoc = location.trim();
    const coords = coordinates;

    if (typeof window !== 'undefined') {
      localStorage.setItem('user_location', trimmedLoc);
      localStorage.setItem('user_location_estimated', isEstimated ? 'true' : 'false');
      if (coords) {
        localStorage.setItem('user_location_lat', String(coords.lat));
        localStorage.setItem('user_location_lng', String(coords.lng));
      } else {
        localStorage.removeItem('user_location_lat');
        localStorage.removeItem('user_location_lng');
      }
    }
    this.activeLocationSubject.next(trimmedLoc);
    this.isEstimatedSubject.next(isEstimated);
    this.coordinatesSubject.next(coords || null);
  }

  // ── GPS Detection (wraps navigator.geolocation as a clean Promise) ──

  detectGpsPosition(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported by your browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          reject(new Error(err.message || 'Location access denied or unavailable'));
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }

  // ── Tiered Reverse Geocoding (Google → Nominatim → Centroid Fallback) ──

  reverseGeocode(lat: number, lng: number): Promise<string> {
    return new Promise((resolve) => {
      // Tier 1: Google Maps Geocoder (high precision, already loaded for Places autocomplete)
      if ((window as any).google?.maps?.Geocoder) {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          this.ngZone.run(() => {
            if (status === 'OK' && results?.[0]) {
              resolve(results[0].formatted_address);
            } else {
              this.nominatimFallback(lat, lng).then(resolve);
            }
          });
        });
        return;
      }

      // Tier 2/3: Nominatim → Centroid
      this.nominatimFallback(lat, lng).then(resolve);
    });
  }

  /** Tier 2: Nominatim API (free, global, village-level precision) */
  private async nominatimFallback(lat: number, lng: number): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const place = addr.village || addr.suburb || addr.town || addr.city || addr.district || addr.state_district || addr.state;
        const state = addr.state || '';
        if (place && state && !place.includes(state)) {
          return `${place}, ${state}`;
        }
        if (place) return place;
      }
    } catch {
      // Network error or timeout — fall through to Tier 3
    }

    // Tier 3: Nearest centroid from comprehensive Indian city/state database
    return this.findNearestCity(lat, lng);
  }

  /** Comprehensive Indian city & state centroids */
  readonly centroids = INDIAN_GEO_CENTROIDS;

  /** Find the nearest city/state name for given coordinates */
  findNearestCity(lat: number, lng: number): string {
    let nearestName = 'New Delhi';
    let minDist = Infinity;

    for (const [name, [cLat, cLng]] of Object.entries(INDIAN_GEO_CENTROIDS)) {
      const d = Math.sqrt(Math.pow(lat - cLat, 2) + Math.pow(lng - cLng, 2));
      if (d < minDist) {
        minDist = d;
        nearestName = name;
      }
    }

    // Title case the result
    return nearestName.replace(/\b\w/g, c => c.toUpperCase());
  }

  /** Get coordinates for a given city or state name */
  getCentroid(locationKey?: string): [number, number] {
    if (!locationKey) return [28.6139, 77.2090];
    const clean = locationKey.toLowerCase().trim();
    return INDIAN_GEO_CENTROIDS[clean] || [28.6139, 77.2090];
  }

  // ── Private Storage Helpers ──

  private getStoredLocation(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_location');
    }
    return null;
  }

  private getStoredEstimatedState(): boolean {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('user_location_estimated');
      if (this.getStoredLocation() && stored === null) {
        return false;
      }
      return stored !== 'false';
    }
    return true;
  }

  private getStoredCoordinates(): { lat: number; lng: number } | null {
    if (typeof window !== 'undefined') {
      const lat = localStorage.getItem('user_location_lat');
      const lng = localStorage.getItem('user_location_lng');
      if (lat && lng) {
        return { lat: Number(lat), lng: Number(lng) };
      }
    }
    return null;
  }

  // List of Union Territories in India (including merged/variant names for DB matching)
  readonly unionTerritories = [
    'Andaman & Nicobar Islands',
    'Andaman & Nicobar',
    'Chandigarh',
    'Dadra & Nagar Haveli',
    'Daman & Diu',
    'Dadra & Nagar Haveli and Daman & Diu',
    'Delhi',
    'Jammu & Kashmir',
    'Ladakh',
    'Lakshadweep',
    'Puducherry'
  ];

  isUnionTerritory(utName: string): boolean {
    if (!utName) return false;
    const name = utName.trim().toLowerCase();
    return this.unionTerritories.some(ut => ut.toLowerCase() === name);
  }

  isState(stateName: string): boolean {
    if (!stateName) return false;
    return !this.isUnionTerritory(stateName);
  }
}