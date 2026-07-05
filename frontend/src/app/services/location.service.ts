import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private activeLocationSubject = new BehaviorSubject<string>(this.getStoredLocation() || 'New Delhi');
  activeLocation$ = this.activeLocationSubject.asObservable();

  private isEstimatedSubject = new BehaviorSubject<boolean>(this.getStoredEstimatedState());
  isEstimated$ = this.isEstimatedSubject.asObservable();

  constructor() { }

  getCurrentLocation(): string {
    return this.activeLocationSubject.value;
  }

  isLocationEstimated(): boolean {
    return this.isEstimatedSubject.value;
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

  setLocation(location: string, isEstimated: boolean = false) {
    if (!location || !location.trim()) return;
    const trimmedLoc = location.trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_location', trimmedLoc);
      localStorage.setItem('user_location_estimated', isEstimated ? 'true' : 'false');
    }
    this.activeLocationSubject.next(trimmedLoc);
    this.isEstimatedSubject.next(isEstimated);
  }

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