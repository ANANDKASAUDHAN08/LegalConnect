import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  UserCredential
} from 'firebase/auth';
import { environment } from '../../environments/environment';
import { Observable, from, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface GoogleAuthResult {
  idToken: string;
  role?: string;
}

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private auth;

  constructor() {
    const app = getApps().length === 0 ? initializeApp(environment.firebase) : getApp();
    this.auth = getAuth(app);
  }

  /**
   * Helper to detect mobile browsers, touch devices, or PWA standalone mode.
   */
  isMobileOrPwa(): boolean {
    if (typeof window === 'undefined') return false;
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    const isMobileUserAgent =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth <= 768;
    return isStandalone || isMobileUserAgent;
  }

  private createProvider(role?: string): GoogleAuthProvider {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });
    if (role && typeof window !== 'undefined') {
      sessionStorage.setItem('lc_oauth_role', role);
    }
    return provider;
  }

  /**
   * Production-grade Google OAuth handler:
   * - Uses signInWithRedirect on Mobile & PWA to prevent popup blocking/closure issues.
   * - Uses signInWithPopup on Desktop for immediate modal interaction.
   */
  signInWithGoogle(role?: string): Observable<string | null> {
    const provider = this.createProvider(role);

    if (this.isMobileOrPwa()) {
      // On mobile / PWA, trigger full browser redirect
      signInWithRedirect(this.auth, provider);
      // Return null while browser navigates to Google
      return of(null);
    }

    // On desktop, use standard popup window without fragile interceptors
    return new Observable<string>((subscriber) => {
      signInWithPopup(this.auth, provider)
        .then((result) => {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const idToken = credential?.idToken;
          if (!idToken) {
            subscriber.error(new Error('Google authentication succeeded but no ID token was returned.'));
          } else {
            subscriber.next(idToken);
            subscriber.complete();
          }
        })
        .catch((err) => {
          subscriber.error(err);
        });
    });
  }

  /**
   * Processes the OAuth redirect result on page load (primarily for Mobile/PWA redirect flows).
   */
  handleRedirectResult(): Observable<GoogleAuthResult | null> {
    if (typeof window === 'undefined') return of(null);

    return from(getRedirectResult(this.auth)).pipe(
      map((result: UserCredential | null) => {
        if (!result) return null;
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const idToken = credential?.idToken;
        if (!idToken) return null;

        const role = sessionStorage.getItem('lc_oauth_role') || undefined;
        sessionStorage.removeItem('lc_oauth_role');

        return { idToken, role };
      }),
      catchError((err) => {
        console.error('[GoogleAuth] Error handling redirect result:', err);
        return of(null);
      })
    );
  }
}