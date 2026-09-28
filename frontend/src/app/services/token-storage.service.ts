import { Injectable } from '@angular/core';

/**
 * Token Persistence Service
 *
 * Manages client-side storage for authentication tokens using a dual-layer strategy:
 *
 * - **Access Token (JWT, short-lived):** Stored in both in-memory cache and `localStorage`.
 *   In-memory provides fast, synchronous access during the session lifetime.
 *   `localStorage` provides persistence across page refreshes and PWA restarts.
 *
 * - **Refresh Token (opaque, long-lived):** Stored exclusively in an `HttpOnly`, `Secure`,
 *   `SameSite` cookie (`__session`) managed entirely by the server. This token never enters
 *   JavaScript execution context, making it immune to XSS exfiltration.
 *
 * ## Cross-Tab Synchronization
 * Listens to browser `storage` events to keep in-memory caches synchronized across
 * all open tabs. When Tab A rotates a token, Tab B immediately receives the update
 * via the `storage` event (which fires only in other tabs, not the originator).
 *
 * @see {@link AuthService} for session lifecycle management.
 * @see {@link AuthInterceptor} for automatic token attachment and 401 recovery.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private static readonly ACCESS_TOKEN_KEY = 'lc_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'lc_refresh_token';
  private static readonly SESSION_HINT_KEY = 'lc_has_session';

  private inMemoryToken: string | null = null;
  private inMemoryRefreshToken: string | null = null;
  private inMemoryUser: any | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.inMemoryToken = localStorage.getItem(TokenStorageService.ACCESS_TOKEN_KEY);
      this.inMemoryRefreshToken = localStorage.getItem(TokenStorageService.REFRESH_TOKEN_KEY);

      // Cross-tab sync: when another tab writes to localStorage, update in-memory caches.
      // The `storage` event fires ONLY in other tabs (not the one that wrote), which is
      // exactly the behavior needed to prevent multi-tab token desynchronization.
      window.addEventListener('storage', (event) => {
        if (event.key === TokenStorageService.ACCESS_TOKEN_KEY) {
          this.inMemoryToken = event.newValue;
        }
        if (event.key === TokenStorageService.REFRESH_TOKEN_KEY) {
          this.inMemoryRefreshToken = event.newValue;
        }
      });
    }
  }

  // ─── Session Hint ────────────────────────────────────────────────────────────

  /**
   * Returns `true` if the user was previously logged in (session hint flag exists
   * or a refresh token is present in storage). Used by `checkSession()` to avoid
   * firing a blind `POST /api/auth/refresh` for unauthenticated guests.
   */
  hasSessionHint(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(TokenStorageService.SESSION_HINT_KEY) === '1'
        || !!this.getRefreshToken();
  }

  /** Marks the current browser as having an active session. Set on login success. */
  setSessionHint(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TokenStorageService.SESSION_HINT_KEY, '1');
    }
  }

  /**
   * Clears the session hint. Called ONLY during explicit logout or confirmed
   * server-side token revocation. Must NOT be called on transient failures.
   */
  clearSessionHint(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TokenStorageService.SESSION_HINT_KEY);
    }
  }

  // ─── Access Token ────────────────────────────────────────────────────────────

  /** Returns the current access token, preferring the in-memory cache over `localStorage`. */
  getToken(): string | null {
    if (this.inMemoryToken) {
      return this.inMemoryToken;
    }
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(TokenStorageService.ACCESS_TOKEN_KEY);
      if (stored) {
        this.inMemoryToken = stored;
      }
      return stored;
    }
    return null;
  }

  /** Persists a new access token to both in-memory cache and `localStorage`. */
  setToken(token: string): void {
    this.inMemoryToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem(TokenStorageService.ACCESS_TOKEN_KEY, token);
    }
  }

  // ─── Refresh Token ───────────────────────────────────────────────────────────

  /**
   * Returns the current refresh token with cross-tab freshness guarantee.
   *
   * Always cross-checks `localStorage` to detect updates written by another tab
   * that may not yet have been received via the `storage` event (e.g., event
   * fired but JS event loop hasn't processed it yet).
   */
  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(TokenStorageService.REFRESH_TOKEN_KEY);
      if (stored && stored !== this.inMemoryRefreshToken) {
        this.inMemoryRefreshToken = stored; // Another tab updated it
      }
      return this.inMemoryRefreshToken;
    }
    return this.inMemoryRefreshToken;
  }

  /** Persists the refresh token to both in-memory cache and `localStorage`. */
  setRefreshToken(refreshToken: string): void {
    this.inMemoryRefreshToken = refreshToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem(TokenStorageService.REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  /** Removes only the refresh token. */
  removeRefreshToken(): void {
    this.inMemoryRefreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TokenStorageService.REFRESH_TOKEN_KEY);
    }
  }

  // ─── Clear Operations ────────────────────────────────────────────────────────

  /**
   * Performs a soft clear — removes only the access token.
   *
   * The refresh token is preserved for potential session recovery.
   * Used during: normal token rotation, transient server errors, session rehydration failures.
   */
  removeAccessTokenOnly(): void {
    this.inMemoryToken = null;
    this.inMemoryUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TokenStorageService.ACCESS_TOKEN_KEY);
    }
  }

  /**
   * Performs a hard clear — removes all client-side authentication state.
   *
   * The HttpOnly `__session` cookie is cleared server-side via the `/auth/logout` endpoint.
   * Also removes legacy keys from previous implementations to prevent stale state.
   *
   * Used during: explicit user logout, confirmed server-side token revocation (401/403 on refresh).
   */
  removeAllTokens(): void {
    this.inMemoryToken = null;
    this.inMemoryRefreshToken = null;
    this.inMemoryUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TokenStorageService.ACCESS_TOKEN_KEY);
      localStorage.removeItem(TokenStorageService.REFRESH_TOKEN_KEY);
      localStorage.removeItem(TokenStorageService.SESSION_HINT_KEY);
      localStorage.removeItem('lc_refresh_hint');
      localStorage.removeItem('lc_token');
      localStorage.removeItem('lc_user_profile');
      localStorage.removeItem('lc_has_session');
    }
  }

  // ─── User Cache ──────────────────────────────────────────────────────────────

  /** Returns the cached user profile object, if available. */
  getCachedUser(): any | null {
    return this.inMemoryUser;
  }

  /** Caches the user profile object in memory for fast synchronous access. */
  setCachedUser(user: any): void {
    this.inMemoryUser = user;
  }
}