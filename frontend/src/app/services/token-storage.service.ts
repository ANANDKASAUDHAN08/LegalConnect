import { Injectable } from '@angular/core';

/**
 * Enterprise In-Memory Security Model:
 * Access tokens and user profile state are kept strictly IN-MEMORY.
 * They are NEVER written to localStorage to protect against XSS token harvesting.
 * Sessions are restored securely on load via HttpOnly refresh cookies (__session).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private inMemoryToken: string | null = null;
  private inMemoryUser: any | null = null;

  getToken(): string | null {
    return this.inMemoryToken;
  }

  setToken(token: string): void {
    this.inMemoryToken = token;
  }

  removeToken(): void {
    this.inMemoryToken = null;
    this.inMemoryUser = null;
    if (typeof window !== 'undefined') {
      // Clear legacy storage keys if present
      localStorage.removeItem('lc_token');
      localStorage.removeItem('lc_user_profile');
    }
  }

  getCachedUser(): any | null {
    return this.inMemoryUser;
  }

  setCachedUser(user: any): void {
    this.inMemoryUser = user;
  }
}