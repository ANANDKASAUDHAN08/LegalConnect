import { Injectable } from '@angular/core';

/**
 * Hybrid Token Persistence Strategy:
 *
 * Access tokens (short-lived, 15 min) are stored in BOTH in-memory and localStorage.
 * - In-memory for fast access during the session
 * - localStorage for persistence across page refreshes/PWA restarts
 *
 * Refresh tokens are stored in localStorage (lc_refresh_hint) as the
 * reliable persistence mechanism. HttpOnly __session cookies are a secondary
 * channel but are NOT relied upon due to Firebase Hosting cookie stripping
 * and PWA cookie partitioning issues.
 *
 * This is the same approach used by Notion, Linear, Vercel, Supabase, etc.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private static readonly ACCESS_TOKEN_KEY = 'lc_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'lc_refresh_hint';

  private inMemoryToken: string | null = null;
  private inMemoryUser: any | null = null;

  constructor() {
    // Hydrate in-memory token from localStorage on service init (page refresh)
    if (typeof window !== 'undefined') {
      this.inMemoryToken = localStorage.getItem(TokenStorageService.ACCESS_TOKEN_KEY);
    }
  }

  getToken(): string | null {
    // In-memory is always the freshest copy
    if (this.inMemoryToken) {
      return this.inMemoryToken;
    }
    // Fallback to localStorage (for page refresh scenarios before constructor runs)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(TokenStorageService.ACCESS_TOKEN_KEY);
      if (stored) {
        this.inMemoryToken = stored;
      }
      return stored;
    }
    return null;
  }

  setToken(token: string): void {
    this.inMemoryToken = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem(TokenStorageService.ACCESS_TOKEN_KEY, token);
    }
  }

  getFallbackRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TokenStorageService.REFRESH_TOKEN_KEY);
    }
    return null;
  }

  setFallbackRefreshToken(refreshToken: string): void {
    if (typeof window !== 'undefined' && refreshToken) {
      localStorage.setItem(TokenStorageService.REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  removeToken(): void {
    this.inMemoryToken = null;
    this.inMemoryUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TokenStorageService.ACCESS_TOKEN_KEY);
      localStorage.removeItem(TokenStorageService.REFRESH_TOKEN_KEY);
      // Clean up legacy keys
      localStorage.removeItem('lc_token');
      localStorage.removeItem('lc_user_profile');
      localStorage.removeItem('lc_has_session');
    }
  }

  getCachedUser(): any | null {
    return this.inMemoryUser;
  }

  setCachedUser(user: any): void {
    this.inMemoryUser = user;
  }
}