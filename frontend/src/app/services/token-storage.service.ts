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
 * @see {@link AuthService} for session lifecycle management.
 * @see {@link AuthInterceptor} for automatic token attachment and 401 recovery.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private static readonly ACCESS_TOKEN_KEY = 'lc_access_token';

  private inMemoryToken: string | null = null;
  private inMemoryUser: any | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.inMemoryToken = localStorage.getItem(TokenStorageService.ACCESS_TOKEN_KEY);
    }
  }

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

  /**
   * Performs a soft clear — removes only the access token.
   *
   * The refresh token (HttpOnly cookie) is unaffected and managed by the server.
   * This allows session recovery on the next API call or proactive refresh cycle.
   *
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
    this.inMemoryUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TokenStorageService.ACCESS_TOKEN_KEY);
      localStorage.removeItem('lc_refresh_hint');
      localStorage.removeItem('lc_token');
      localStorage.removeItem('lc_user_profile');
      localStorage.removeItem('lc_has_session');
    }
  }

  /** Returns the cached user profile object, if available. */
  getCachedUser(): any | null {
    return this.inMemoryUser;
  }

  /** Caches the user profile object in memory for fast synchronous access. */
  setCachedUser(user: any): void {
    this.inMemoryUser = user;
  }
}