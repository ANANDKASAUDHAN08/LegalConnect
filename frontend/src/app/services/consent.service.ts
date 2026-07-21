import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface ConsentPreferences {
  analyticsConsent: boolean;
  marketingConsent: boolean;
  essentialConsent: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConsentService {
  private apiUrl = '/api/consent';
  private storageKey = 'lc_consent_preferences';
  private anonymousIdKey = 'lc_anonymous_id';

  consentPreferences = signal<ConsentPreferences>({
    essentialConsent: true,
    analyticsConsent: false,
    marketingConsent: false
  });

  hasUserConsented = signal<boolean>(false);

  constructor(private http: HttpClient) {
    this.initializeConsent();
  }

  private initializeConsent() {
    // 1. Ensure anonymous ID exists for tracking
    let anonId = localStorage.getItem(this.anonymousIdKey);
    if (!anonId) {
      anonId = this.generateUUID();
      localStorage.setItem(this.anonymousIdKey, anonId);
    }

    // 2. Load cached consent from localStorage
    const cached = localStorage.getItem(this.storageKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        this.consentPreferences.set({
          essentialConsent: true,
          analyticsConsent: !!parsed.analyticsConsent,
          marketingConsent: !!parsed.marketingConsent
        });
        this.hasUserConsented.set(true);
      } catch {
        this.hasUserConsented.set(false);
      }
    } else {
      // 3. Fallback: try fetching from backend for this anon ID or logged in user
      this.fetchConsentFromBackend().subscribe(res => {
        if (res && res.hasConsented) {
          this.updateLocalConsentState(
            res.analyticsConsent,
            res.marketingConsent,
            res.updatedAt,
            res.analyticsConsentedAt,
            res.marketingConsentedAt,
            res.policyVersion
          );
        }
      });
    }
  }

  getAnonymousId(): string {
    return localStorage.getItem(this.anonymousIdKey) || '';
  }

  public fetchConsentFromBackend(): Observable<any> {
    const anonId = this.getAnonymousId();
    return this.http.get<any>(`${this.apiUrl}?anonymousId=${anonId}`, { withCredentials: true });
  }

  saveConsent(analyticsConsent: boolean, marketingConsent: boolean): Observable<any> {
    const anonId = this.getAnonymousId();
    const payload = {
      anonymousId: anonId,
      analyticsConsent,
      marketingConsent
    };

    return this.http.post<any>(this.apiUrl, payload, { withCredentials: true }).pipe(
      tap((res) => {
        this.updateLocalConsentState(
          analyticsConsent,
          marketingConsent,
          res.updatedAt,
          res.analyticsConsentedAt,
          res.marketingConsentedAt,
          res.policyVersion
        );
      })
    );
  }

  public updateLocalConsentState(
    analyticsConsent: boolean,
    marketingConsent: boolean,
    updatedAt?: string,
    analyticsConsentedAt?: string,
    marketingConsentedAt?: string,
    policyVersion?: string
  ) {
    const preferences: ConsentPreferences = {
      essentialConsent: true,
      analyticsConsent,
      marketingConsent
    };
    this.consentPreferences.set(preferences);
    this.hasUserConsented.set(true);

    const cacheData = {
      ...preferences,
      updatedAt,
      analyticsConsentedAt,
      marketingConsentedAt,
      policyVersion,
      cachedAt: new Date().toISOString()
    };
    localStorage.setItem(this.storageKey, JSON.stringify(cacheData));
  }

  clearConsent() {
    localStorage.removeItem(this.storageKey);
    this.consentPreferences.set({
      essentialConsent: true,
      analyticsConsent: false,
      marketingConsent: false
    });
    this.hasUserConsented.set(false);
  }

  revokeConsent(): Observable<any> {
    const anonId = this.getAnonymousId();
    return this.http.delete<any>(`${this.apiUrl}?anonymousId=${anonId}`, { withCredentials: true }).pipe(
      tap(() => {
        this.clearConsent();
      })
    );
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}