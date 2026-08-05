import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private auth;

  constructor() {
    const app = getApps().length === 0 ? initializeApp(environment.firebase) : getApp();
    this.auth = getAuth(app);
  }

  /**
   * Industry-standard Google OAuth via Firebase signInWithPopup.
   * Captures the popup window reference to detect closure accurately
   * without false-positive resets when clicking on the parent window.
   */
  signInWithGoogle(): Observable<string> {
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    return new Observable<string>((subscriber) => {
      let isCompleted = false;
      let pollInterval: any = null;
      let popupRef: Window | null = null;

      const cleanup = () => {
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };

      // Intercept window.open to capture popup reference.
      // Restore original inside the interceptor itself after first capture,
      // because Firebase calls window.open asynchronously (not synchronously).
      const originalOpen = window.open;
      window.open = function (...args: any[]) {
        window.open = originalOpen; // restore immediately after capture
        popupRef = originalOpen.apply(window, args as any);

        // Start polling popup.closed now that we have the reference
        pollInterval = setInterval(() => {
          try {
            if (popupRef && popupRef.closed && !isCompleted) {
              isCompleted = true;
              cleanup();
              subscriber.error({ code: 'auth/popup-closed-by-user', message: 'Popup closed by user.' });
            }
          } catch {
            // COOP may block access — let Firebase handle it
          }
        }, 500);

        return popupRef;
      };

      // Safety: restore window.open after 5s even if interceptor never fired
      const restoreTimeout = setTimeout(() => { window.open = originalOpen; }, 5000);

      signInWithPopup(this.auth, provider)
        .then((result) => {
          if (isCompleted) return;
          isCompleted = true;
          cleanup();
          clearTimeout(restoreTimeout);
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
          if (isCompleted) return;
          isCompleted = true;
          cleanup();
          clearTimeout(restoreTimeout);
          subscriber.error(err);
        });
    });
  }
}