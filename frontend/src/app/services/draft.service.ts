import { Injectable } from '@angular/core';

/**
 * DraftService
 * Lightweight wrapper around sessionStorage to auto-save form drafts.
 * Data is automatically wiped when the browser tab is closed.
 */
@Injectable({
  providedIn: 'root'
})
export class DraftService {

  /** Save any serializable object as a draft under the given key */
  save<T>(key: string, data: T): void {
    try {
      sessionStorage.setItem(`draft_${key}`, JSON.stringify(data));
    } catch {
      // sessionStorage quota exceeded — silently ignore
    }
  }

  /** Load and return a saved draft, or null if none exists */
  load<T>(key: string): T | null {
    const raw = sessionStorage.getItem(`draft_${key}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /** Clear a specific draft key */
  clear(key: string): void {
    sessionStorage.removeItem(`draft_${key}`);
  }

  /** Check if a draft exists for the given key */
  hasDraft(key: string): boolean {
    return sessionStorage.getItem(`draft_${key}`) !== null;
  }
}
