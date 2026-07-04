import { Injectable, computed, inject, effect } from '@angular/core';
import { SettingsService } from './settings.service';

declare var google: any;

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private settingsService = inject(SettingsService);
  private registeredMaps = new Map<any, { getIsSatellite: () => boolean }>();

  isDarkMode = computed(() => {
    const activeTheme = this.settingsService.theme();
    if (activeTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return activeTheme === 'dark';
  });

  constructor() {
    // Dynamically update styling on all registered maps when theme changes
    effect(() => {
      // Access the signal to subscribe
      this.isDarkMode();
      this.registeredMaps.forEach((config, map) => {
        try {
          this.applyMapTheme(map, config.getIsSatellite());
        } catch (e) {
          // If a map was destroyed but not cleaned up, remove it
          this.registeredMaps.delete(map);
        }
      });
    });
  }

  // Register a map to automatically follow theme changes
  registerMap(map: any, getIsSatellite: () => boolean): () => void {
    this.registeredMaps.set(map, { getIsSatellite });
    // Apply theme immediately on register
    this.applyMapTheme(map, getIsSatellite());
    
    // Return clean-up function to call on destroy
    return () => {
      this.registeredMaps.delete(map);
    };
  }

  // Applies custom style sheets to a Google Map instance
  applyMapTheme(map: any, isSatellite = false) {
    if (!map || !window.hasOwnProperty('google')) return;

    if (isSatellite) {
      map.setMapTypeId(google.maps.MapTypeId.SATELLITE);
    } else {
      map.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      const isDark = this.isDarkMode();

      const lightStyle = [
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#e2e8f0' }] },
        { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e2e8f0' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
      ];

      const darkStyle = [
        { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
        { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#334155' }] },
        { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] }
      ];

      map.setOptions({ styles: isDark ? darkStyle : lightStyle });
    }
  }

  toggleTheme() {
    const currentTheme = this.settingsService.theme();
    if (currentTheme === 'dark') {
      this.settingsService.updateTheme('light');
    } else if (currentTheme === 'light') {
      this.settingsService.updateTheme('system');
    } else {
      this.settingsService.updateTheme('dark');
    }
  }
}