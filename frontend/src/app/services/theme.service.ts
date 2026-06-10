import { Injectable, computed, inject } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private settingsService = inject(SettingsService);

  isDarkMode = computed(() => {
    const activeTheme = this.settingsService.theme();
    if (activeTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return activeTheme === 'dark';
  });

  toggleTheme() {
    const currentTheme = this.settingsService.theme();
    if (currentTheme === 'dark') {
      this.settingsService.updateTheme('light');
    } else if (currentTheme === 'light') {
      this.settingsService.updateTheme('system');
    } else {
      // If 'system', toggle to 'dark' first, or 'light'
      this.settingsService.updateTheme('dark');
    }
  }
}