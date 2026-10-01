import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Enterprise Google Maps Lazy Loader Service
 * 
 * Complies with Top MNC architecture (Stripe, Airbnb, Uber):
 * Avoids loading the 200KB Google Maps SDK globally in index.html.
 * Instead, loads the script dynamically and on-demand only when a map or places component is accessed.
 */
@Injectable({
  providedIn: 'root'
})
export class GoogleMapsLoaderService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiKey = 'AIzaSyCbDolXO7Xj46w-Ty1NqG-2cqDr69nsu4s';
  private loadPromise: Promise<boolean> | null = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      (window as any).GOOGLE_MAPS_API_KEY = this.apiKey;
    }
  }

  /**
   * Check if Google Maps API is already loaded and ready in the browser window
   */
  isLoaded(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return typeof (window as any).google !== 'undefined' && typeof (window as any).google.maps !== 'undefined';
  }

  /**
   * Dynamically loads the Google Maps JavaScript SDK on demand.
   * Caches the promise to ensure single execution (idempotent).
   */
  load(): Promise<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve(false);
    }

    if (this.isLoaded()) {
      return Promise.resolve(true);
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise<boolean>((resolve) => {
      // Check if a script tag already exists in DOM
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        if (this.isLoaded()) {
          resolve(true);
          return;
        }
        existingScript.addEventListener('load', () => resolve(true), { once: true });
        existingScript.addEventListener('error', () => resolve(false), { once: true });
        return;
      }

      (window as any).GOOGLE_MAPS_API_KEY = this.apiKey;

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places&loading=async`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        resolve(true);
      };

      script.onerror = (err) => {
        console.warn('[GoogleMapsLoader] Failed to load Google Maps SDK', err);
        this.loadPromise = null;
        resolve(false);
      };

      document.head.appendChild(script);
    });

    return this.loadPromise;
  }
}