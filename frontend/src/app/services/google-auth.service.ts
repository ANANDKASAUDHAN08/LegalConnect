import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private auth;
  private isPopupOpen = false;

  constructor() {
    const app = getApps().length === 0 ? initializeApp(environment.firebase) : getApp();
    this.auth = getAuth(app);
  }

  signInWithGoogle(role?: string): Observable<string | null> {
    if (this.isPopupOpen) {
      return new Observable(subscriber => {
        subscriber.error({ code: 'auth/popup-already-open', message: 'A Google sign-in popup is already open.' });
      });
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    if (role && typeof window !== 'undefined') {
      sessionStorage.setItem('lc_oauth_role', role);
    }

    this.isPopupOpen = true;

    return new Observable<string | null>((subscriber) => {
      signInWithPopup(this.auth, provider)
        .then((result) => {
          this.isPopupOpen = false;
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
          this.isPopupOpen = false;
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('lc_oauth_role');
          }
          subscriber.error(err);
        });

      return () => {
        this.isPopupOpen = false;
      };
    });
  }
}