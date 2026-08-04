import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, throwError } from 'rxjs';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { environment } from '../../environments/environment';

/** Cooldown period in milliseconds between OTP send requests */
const OTP_SEND_COOLDOWN_MS = 60_000;

@Injectable({
  providedIn: 'root'
})
export class PhoneAuthService implements OnDestroy {
  private http = inject(HttpClient);
  private apiUrl = '/api/auth';

  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private confirmationResult: ConfirmationResult | null = null;

  /** Timestamp of the last successful OTP send (for rate-limiting) */
  private lastOtpSentAt = 0;

  /** Remaining cooldown seconds (observable-friendly) */
  get cooldownRemaining(): number {
    if (!this.lastOtpSentAt) return 0;
    const elapsed = Date.now() - this.lastOtpSentAt;
    return Math.max(0, Math.ceil((OTP_SEND_COOLDOWN_MS - elapsed) / 1000));
  }

  get canSendOtp(): boolean {
    return this.cooldownRemaining === 0;
  }

  private get firebaseAuth() {
    const app = getApps().length === 0 ? initializeApp(environment.firebase) : getApp();
    return getAuth(app);
  }

  /**
   * Resets rate-limiting cooldown manually (e.g. on error or user cancel)
   */
  resetCooldown(): void {
    this.lastOtpSentAt = 0;
  }

  /**
   * Normalizes a phone number to E.164 format for Firebase.
   * Removes spaces, dashes, and parentheses.
   * E.g. "+91 90795 23068" → "+919079523068"
   */
  private normalizePhone(phone: string): string {
    // Strip all non-digit chars except the leading +
    const cleaned = phone.replace(/(?!^\+)\D/g, '');
    // Ensure it starts with +
    return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  }

  /**
   * Returns an existing invisible reCAPTCHA verifier or initializes a new one.
   * Reusing the verifier avoids destroying/recreating DOM nodes while reCAPTCHA timers are active.
   */
  private getOrCreateRecaptcha(): RecaptchaVerifier {
    if (typeof window === 'undefined') {
      throw new Error('Window is not available');
    }

    if (this.recaptchaVerifier) {
      return this.recaptchaVerifier;
    }

    // Ensure a single, stable container element exists in document.body
    let container = document.getElementById('recaptcha-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'recaptcha-container';
      document.body.appendChild(container);
    }

    const auth = this.firebaseAuth;
    this.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved automatically — no-op
      },
      'expired-callback': () => {
        console.warn('⚠️ reCAPTCHA expired, resetting...');
        this.cleanupRecaptcha();
      }
    });

    return this.recaptchaVerifier;
  }

  /**
   * Fully cleans up reCAPTCHA verifier instance.
   */
  private cleanupRecaptcha(): void {
    if (this.recaptchaVerifier) {
      try {
        this.recaptchaVerifier.clear();
      } catch (e) {
        // Safe to ignore — may already be cleared
      }
      this.recaptchaVerifier = null;
    }
  }

  /**
   * Sends a 6-digit SMS OTP to the specified phone number.
   * Enforces a 60-second cooldown between sends.
   * Phone number should include country code (e.g. "+919079523068").
   */
  sendSmsOtp(phoneNumber: string): Observable<boolean> {
    // Rate limit check
    if (!this.canSendOtp) {
      const remaining = this.cooldownRemaining;
      return throwError(() => new Error(
        `Please wait ${remaining} seconds before requesting another OTP.`
      ));
    }

    const normalizedPhone = this.normalizePhone(phoneNumber);

    return from((async () => {
      try {
        const auth = this.firebaseAuth;
        const verifier = this.getOrCreateRecaptcha();
        this.confirmationResult = await signInWithPhoneNumber(auth, normalizedPhone, verifier);
        this.lastOtpSentAt = Date.now();
        return true;
      } catch (error: any) {
        // Reset rate-limiting timestamp on error so user can immediately retry
        this.resetCooldown();
        this.cleanupRecaptcha();

        const code = error?.code || '';
        const msg = error?.message || '';

        if (code === 'auth/invalid-app-credential') {
          throw new Error(
            'Phone authentication failed (auth/invalid-app-credential). Please check Authorized Domains & API Key restrictions in Firebase Console.'
          );
        } else if (code === 'auth/too-many-requests') {
          throw new Error(
            'Too many SMS requests sent to this number. Please wait or add this number as a "Phone number for testing" in Firebase Console.'
          );
        } else if (code === 'auth/captcha-check-failed') {
          throw new Error(
            'reCAPTCHA verification failed. If this is a test number, ensure it is added under "Phone numbers for testing" in Firebase Console.'
          );
        } else if (code === 'auth/invalid-phone-number') {
          throw new Error(
            'Invalid phone number format. Please include your country code (e.g. +91XXXXXXXXXX).'
          );
        } else if (code === 'auth/quota-exceeded') {
          throw new Error(
            'SMS quota exceeded for this project. Please contact support.'
          );
        } else if (msg.includes('reading \'style\'') || msg.includes('element has been removed')) {
          throw new Error(
            'reCAPTCHA verification error. Please click Verify again.'
          );
        }
        throw error;
      }
    })());
  }

  /**
   * Verifies the 6-digit SMS OTP code entered by the user.
   * Returns a Firebase ID token on success for backend verification.
   */
  verifySmsOtp(otpCode: string): Observable<{ success: boolean; idToken: string }> {
    if (!this.confirmationResult) {
      return throwError(() => new Error('OTP session expired. Please request a new SMS code.'));
    }

    return from((async () => {
      try {
        const credential = await this.confirmationResult!.confirm(otpCode);
        const idToken = await credential.user.getIdToken();
        this.cleanupRecaptcha(); // Clean up after successful verification
        return { success: true, idToken };
      } catch (error: any) {
        const code = error?.code || '';
        if (code === 'auth/invalid-verification-code') {
          throw new Error('Invalid OTP code. Please check and try again.');
        } else if (code === 'auth/code-expired') {
          this.confirmationResult = null;
          throw new Error('OTP code has expired. Please request a new one.');
        }
        throw error;
      }
    })());
  }

  /**
   * Sends the verified Firebase ID token to the .NET backend
   * so it can validate the token and set User.IsPhoneVerified = true.
   */
  saveVerifiedPhoneToBackend(phone: string, firebaseToken: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/verify-phone`, {
      phone: this.normalizePhone(phone),
      firebaseToken
    });
  }

  /**
   * Resets the OTP session state. Call this when user cancels or navigates away.
   */
  resetOtpSession(): void {
    this.confirmationResult = null;
    this.cleanupRecaptcha();
  }

  /**
   * Full cleanup on service destruction (when app is destroyed).
   */
  ngOnDestroy(): void {
    this.resetOtpSession();
  }
}