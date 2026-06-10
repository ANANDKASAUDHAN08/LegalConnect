import { Injectable, signal, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { AuthService } from './auth.service';

export interface UserSettings {
  // DB Settings
  clientLanguage: string;
  preferredTimezone: string;
  dateFormat: string;
  notifyLawAmendments: boolean;
  notifyEmailDigest: boolean;
  notifyPushEnabled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private apiUrl = 'http://localhost:8888/api/auth/settings';
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Local Settings (persisted to localStorage)
  theme = signal<'light' | 'dark' | 'system'>('system');
  fontSize = signal<'sm' | 'md' | 'lg'>('md');
  uiDensity = signal<'compact' | 'comfortable' | 'spacious'>('comfortable');
  highContrast = signal<boolean>(false);
  reduceMotion = signal<boolean>(false);
  textSpacing = signal<boolean>(false);

  // Search Settings
  defaultCategoryFilter = signal<string>('All');
  resultsPerPage = signal<number>(10);
  showRelatedLaws = signal<boolean>(true);

  // Cookies Settings
  cookiePreferences = signal<{ essential: boolean; analytics: boolean; marketing: boolean }>({
    essential: true,
    analytics: true,
    marketing: false
  });

  // DB-backed settings (as signals)
  clientLanguage = signal<string>('English');
  preferredTimezone = signal<string>('Asia/Kolkata');
  dateFormat = signal<string>('DD/MM/YYYY');
  notifyLawAmendments = signal<boolean>(true);
  notifyEmailDigest = signal<boolean>(true);
  notifyPushEnabled = signal<boolean>(false);

  constructor() {
    this.loadLocalSettings();
    this.applyLocalSettings();

    // Re-apply system theme if OS preference changes and theme is 'system'
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.theme() === 'system') {
        this.applyTheme();
      }
    });

    // Fetch DB settings when user is logged in
    this.authService.isLoggedIn$.subscribe(loggedIn => {
      if (loggedIn) {
        this.fetchDbSettings().subscribe();
      }
    });

    // Effects to apply settings dynamically when signals change
    effect(() => {
      this.applyTheme();
    });

    effect(() => {
      this.applyAccessibilityAndLayout();
    });
  }

  private loadLocalSettings() {
    const theme = localStorage.getItem('lc_theme') || localStorage.getItem('theme');
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      this.theme.set(theme);
    } else {
      this.theme.set('system');
    }

    const fontSize = localStorage.getItem('lc_font_size');
    if (fontSize === 'sm' || fontSize === 'md' || fontSize === 'lg') {
      this.fontSize.set(fontSize);
    }

    const uiDensity = localStorage.getItem('lc_ui_density');
    if (uiDensity === 'compact' || uiDensity === 'comfortable' || uiDensity === 'spacious') {
      this.uiDensity.set(uiDensity);
    }

    this.highContrast.set(localStorage.getItem('lc_high_contrast') === 'true');
    this.reduceMotion.set(localStorage.getItem('lc_reduce_motion') === 'true');
    this.textSpacing.set(localStorage.getItem('lc_text_spacing') === 'true');

    const catFilter = localStorage.getItem('lc_default_category');
    if (catFilter) this.defaultCategoryFilter.set(catFilter);

    const results = localStorage.getItem('lc_results_per_page');
    if (results) this.resultsPerPage.set(parseInt(results, 10));

    const related = localStorage.getItem('lc_show_related_laws');
    if (related) this.showRelatedLaws.set(related === 'true');

    const cookies = localStorage.getItem('lc_cookies');
    if (cookies) {
      try {
        this.cookiePreferences.set(JSON.parse(cookies));
      } catch (e) {
        // ignore
      }
    }
  }

  private applyTheme() {
    const activeTheme = this.theme();
    let isDark = false;
    if (activeTheme === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = activeTheme === 'dark';
    }

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('lc_theme', activeTheme);
    // Sync with legacy theme key if needed
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }

  private applyAccessibilityAndLayout() {
    // Font Size
    const sz = this.fontSize();
    document.documentElement.setAttribute('data-font-size', sz);
    localStorage.setItem('lc_font_size', sz);

    // UI Density
    const density = this.uiDensity();
    document.documentElement.setAttribute('data-ui-density', density);
    localStorage.setItem('lc_ui_density', density);

    // High Contrast
    const hc = this.highContrast();
    if (hc) {
      document.documentElement.setAttribute('data-contrast', 'high');
    } else {
      document.documentElement.removeAttribute('data-contrast');
    }
    localStorage.setItem('lc_high_contrast', String(hc));

    // Reduce Motion
    const rm = this.reduceMotion();
    if (rm) {
      document.documentElement.setAttribute('data-reduced-motion', 'reduce');
    } else {
      document.documentElement.removeAttribute('data-reduced-motion');
    }
    localStorage.setItem('lc_reduce_motion', String(rm));

    // Text Spacing
    const ts = this.textSpacing();
    if (ts) {
      document.documentElement.setAttribute('data-text-spacing', 'extra');
    } else {
      document.documentElement.removeAttribute('data-text-spacing');
    }
    localStorage.setItem('lc_text_spacing', String(ts));

    // Search and Cookie settings saving
    localStorage.setItem('lc_default_category', this.defaultCategoryFilter());
    localStorage.setItem('lc_results_per_page', String(this.resultsPerPage()));
    localStorage.setItem('lc_show_related_laws', String(this.showRelatedLaws()));
    localStorage.setItem('lc_cookies', JSON.stringify(this.cookiePreferences()));
  }

  private applyLocalSettings() {
    this.applyTheme();
    this.applyAccessibilityAndLayout();
  }

  // API Methods
  fetchDbSettings(): Observable<UserSettings> {
    return this.http.get<UserSettings>(this.apiUrl, { withCredentials: true }).pipe(
      tap(settings => {
        this.clientLanguage.set(settings.clientLanguage || 'English');
        this.preferredTimezone.set(settings.preferredTimezone || 'Asia/Kolkata');
        this.dateFormat.set(settings.dateFormat || 'DD/MM/YYYY');
        this.notifyLawAmendments.set(settings.notifyLawAmendments);
        this.notifyEmailDigest.set(settings.notifyEmailDigest);
        this.notifyPushEnabled.set(settings.notifyPushEnabled);
      }),
      catchError(err => {
        console.error('Error fetching settings from backend:', err);
        return of({
          clientLanguage: this.clientLanguage(),
          preferredTimezone: this.preferredTimezone(),
          dateFormat: this.dateFormat(),
          notifyLawAmendments: this.notifyLawAmendments(),
          notifyEmailDigest: this.notifyEmailDigest(),
          notifyPushEnabled: this.notifyPushEnabled()
        });
      })
    );
  }

  saveDbSettings(settings: Partial<UserSettings>): Observable<any> {
    return this.http.put<any>(this.apiUrl, settings, { withCredentials: true }).pipe(
      tap(() => {
        if (settings.clientLanguage !== undefined) this.clientLanguage.set(settings.clientLanguage);
        if (settings.preferredTimezone !== undefined) this.preferredTimezone.set(settings.preferredTimezone);
        if (settings.dateFormat !== undefined) this.dateFormat.set(settings.dateFormat);
        if (settings.notifyLawAmendments !== undefined) this.notifyLawAmendments.set(settings.notifyLawAmendments);
        if (settings.notifyEmailDigest !== undefined) this.notifyEmailDigest.set(settings.notifyEmailDigest);
        if (settings.notifyPushEnabled !== undefined) this.notifyPushEnabled.set(settings.notifyPushEnabled);
      })
    );
  }

  // Update local settings (triggers effects)
  updateTheme(value: 'light' | 'dark' | 'system') {
    this.theme.set(value);
  }

  updateFontSize(value: 'sm' | 'md' | 'lg') {
    this.fontSize.set(value);
  }

  updateUiDensity(value: 'compact' | 'comfortable' | 'spacious') {
    this.uiDensity.set(value);
  }

  updateHighContrast(value: boolean) {
    this.highContrast.set(value);
  }

  updateReduceMotion(value: boolean) {
    this.reduceMotion.set(value);
  }

  updateTextSpacing(value: boolean) {
    this.textSpacing.set(value);
  }

  updateDefaultCategoryFilter(value: string) {
    this.defaultCategoryFilter.set(value);
  }

  updateResultsPerPage(value: number) {
    this.resultsPerPage.set(value);
  }

  updateShowRelatedLaws(value: boolean) {
    this.showRelatedLaws.set(value);
  }

  updateCookiePreferences(value: { essential: boolean; analytics: boolean; marketing: boolean }) {
    this.cookiePreferences.set(value);
  }
}
