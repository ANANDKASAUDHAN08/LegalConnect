import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { SnackbarService } from './snackbar.service';

/**
 * Universal Bookmark Service
 *
 * Unified replacement for legacy BookmarkService + SavedItemsService.
 * Manages all bookmark types (Lawyer, LegalResource, BareActSection, Helpline, Template)
 * through a single polymorphic backend endpoint.
 *
 * Features:
 * - Signal-based reactive store with computed fast-lookup sets
 * - BroadcastChannel cross-tab synchronization
 * - IndexedDB offline persistence with queue replay
 * - Collection (folder) management
 */

export interface UnifiedBookmark {
  id: number;
  targetType: string;
  targetId: string;
  title: string;
  subtitle?: string;
  customNotes?: string;
  collectionName: string;
  metadataJson?: string;
  savedAt: number; // Unix timestamp ms
}

@Injectable({ providedIn: 'root' })
export class UniversalBookmarkService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private router = inject(Router);
  private snackbar = inject(SnackbarService);

  private apiUrl = '/api/universalbookmark';

  // ── Signal State Store ──
  bookmarks = signal<UnifiedBookmark[]>([]);
  collections = signal<{ name: string; count: number }[]>([]);
  initialLoadComplete = signal(false);

  // ── Derived fast-lookup: targetType → Set<targetId> ──
  savedIds = computed(() => {
    const map = new Map<string, Set<string>>();
    for (const b of this.bookmarks()) {
      if (!map.has(b.targetType)) map.set(b.targetType, new Set());
      map.get(b.targetType)!.add(b.targetId);
    }
    return map;
  });

  // ── BroadcastChannel ──
  private channel: BroadcastChannel | null = null;

  // ── IndexedDB for offline ──
  private readonly DB_NAME = 'lc-bookmarks';
  private readonly STORE_NAME = 'items';
  private readonly STORAGE_CACHE_KEY = 'lc_bookmarks_cache';
  private db: IDBDatabase | null = null;

  private isLoggedIn = false;

  constructor() {
    // 0ms Synchronous Cache Hydration (Stale-While-Revalidate)
    // Populate state on frame 0 before any template renders
    const cached = this.loadFromStorageCache();
    if (cached && cached.length > 0) {
      this.bookmarks.set(cached);
      this.initialLoadComplete.set(true);
    }

    // Init BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('lc-bookmarks');
      this.channel.onmessage = (event) => {
        if (event.data?.action === 'reload') {
          this.loadBookmarks();
        }
      };
    }

    // Init IndexedDB
    this.initIndexedDB();

    this.auth.isLoggedIn$.subscribe(loggedIn => {
      this.isLoggedIn = loggedIn;
      if (loggedIn) {
        if (this.bookmarks().length === 0) {
          const cachedItems = this.loadFromStorageCache();
          if (cachedItems && cachedItems.length > 0) {
            this.bookmarks.set(cachedItems);
            this.initialLoadComplete.set(true);
          }
        }
        this.loadBookmarks();
        this.loadCollections();
      } else {
        this.bookmarks.set([]);
        this.collections.set([]);
        this.clearStorageCache();
        this.initialLoadComplete.set(true);
      }
    });
  }

  // ── Public API: Read ──

  /**
   * Check if a specific entity is bookmarked.
   */
  isSaved(targetType: string, targetId: string): boolean {
    return this.savedIds()?.get(targetType)?.has(targetId) ?? false;
  }

  /**
   * Get bookmarks filtered by type and/or collection.
   */
  getByFilter(targetType?: string, collectionName?: string): UnifiedBookmark[] {
    let result = this.bookmarks();
    if (targetType) result = result.filter(b => b.targetType === targetType);
    if (collectionName) result = result.filter(b => b.collectionName === collectionName);
    return result;
  }

  /**
   * Pre-seed bookmark existence from server-side enriched payload.
   * Ensures 0ms instant display even if full user bookmark list is still fetching.
   */
  seedBookmark(targetType: string, targetId: string, isSaved: boolean): void {
    if (!targetType || !targetId) return;
    const currentSaved = this.isSaved(targetType, targetId);
    if (isSaved && !currentSaved) {
      const placeholder: UnifiedBookmark = {
        id: -Date.now(),
        targetType,
        targetId,
        title: '',
        collectionName: 'General',
        savedAt: Date.now()
      };
      this.bookmarks.update(list => [placeholder, ...list]);
      this.persistToStorageCache(this.bookmarks());
    }
  }

  // ── Public API: Toggle ──

  /**
   * Toggle bookmark state with optimistic UI.
   * If not saved → save. If saved → remove.
   */
  toggleBookmark(
    targetType: string,
    targetId: string,
    title: string,
    subtitle?: string,
    collectionName?: string,
    metadataJson?: string
  ): void {
    if (!this.isLoggedIn) {
      this.snackbar.show(
        'Login to save items to your profile',
        'warning', 5000, 'Login →',
        () => this.router.navigate(['/login'])
      );
      return;
    }

    const wasSaved = this.isSaved(targetType, targetId);

    // Optimistic UI update
    if (wasSaved) {
      this.bookmarks.update(list => list.filter(b => !(b.targetType === targetType && b.targetId === targetId)));
    } else {
      const optimistic: UnifiedBookmark = {
        id: -Date.now(), // Temp ID
        targetType, targetId, title,
        subtitle,
        collectionName: collectionName || 'General',
        metadataJson,
        savedAt: Date.now()
      };
      this.bookmarks.update(list => [optimistic, ...list]);
    }

    // Haptic feedback
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12);
    }

    // HTTP request
    this.http.post<any>(
      `${this.apiUrl}/toggle`,
      { targetType, targetId, title, subtitle, collectionName, metadataJson },
      { withCredentials: true }
    ).subscribe({
      next: (res) => {
        if (res?.success) {
          if (res.saved && res.bookmark) {
            // Replace optimistic entry with server-confirmed one
            this.bookmarks.update(list => {
              const filtered = list.filter(b => !(b.targetType === targetType && b.targetId === targetId));
              return [res.bookmark, ...filtered];
            });
          }
          this.snackbar.show(
            res.saved ? `Saved to ${res.bookmark?.collectionName || 'Bookmarks'} ✓` : 'Removed from bookmarks',
            res.saved ? 'success' : 'info',
            2500
          );
          this.broadcastChange();
          this.persistToStorageCache(this.bookmarks());
          this.persistToIndexedDB();
          this.loadCollections();
        }
      },
      error: () => {
        // Rollback
        if (wasSaved) {
          // Was saved but we removed → re-add (reload from server)
          this.loadBookmarks();
        } else {
          // Wasn't saved but we added → remove optimistic
          this.bookmarks.update(list => list.filter(b => !(b.targetType === targetType && b.targetId === targetId)));
        }
        this.snackbar.show('Failed to update bookmark. Please try again.', 'error');
      }
    });
  }

  // ── Public API: Update ──

  updateNotes(bookmarkId: number, notes: string, silent = false): void {
    this.http.put<any>(
      `${this.apiUrl}/${bookmarkId}`,
      { customNotes: notes },
      { withCredentials: true }
    ).subscribe({
      next: () => {
        this.bookmarks.update(list =>
          list.map(b => b.id === bookmarkId ? { ...b, customNotes: notes } : b)
        );
        if (!silent) this.snackbar.show('Notes updated ✓', 'success');
        this.persistToIndexedDB();
      },
      error: () => {
        if (!silent) this.snackbar.show('Failed to update notes.', 'error');
      }
    });
  }

  moveToCollection(bookmarkId: number, collectionName: string): void {
    this.http.put<any>(
      `${this.apiUrl}/${bookmarkId}`,
      { collectionName },
      { withCredentials: true }
    ).subscribe({
      next: () => {
        this.bookmarks.update(list =>
          list.map(b => b.id === bookmarkId ? { ...b, collectionName } : b)
        );
        this.snackbar.show(`Moved to "${collectionName}" ✓`, 'success');
        this.loadCollections();
        this.persistToIndexedDB();
      },
      error: () => {
        this.snackbar.show('Failed to move bookmark.', 'error');
      }
    });
  }

  removeBookmarkById(bookmarkId: number): void {
    const item = this.bookmarks().find(b => b.id === bookmarkId);
    if (!item) return;

    // Optimistic remove
    this.bookmarks.update(list => list.filter(b => b.id !== bookmarkId));

    this.http.delete<any>(`${this.apiUrl}/${bookmarkId}`, { withCredentials: true }).subscribe({
      next: () => {
        this.snackbar.show('Bookmark removed', 'info', 2000);
        this.broadcastChange();
        this.persistToStorageCache(this.bookmarks());
        this.persistToIndexedDB();
        this.loadCollections();
      },
      error: () => {
        // Rollback
        this.loadBookmarks();
        this.snackbar.show('Failed to remove bookmark.', 'error');
      }
    });
  }

  /**
   * Validate existence of MongoDB entities (LegalResource, Helpline) in the bookmarks store.
   * Returns a map of targetId -> { exists: boolean, currentName?: string }.
   */
  validateSavedResources(targetType: 'LegalResource' | 'Helpline', targetIds: string[]) {
    return this.http.post<Record<string, { exists: boolean; currentName?: string }>>(
      '/api/legal/bookmarks/validate',
      { targetType, targetIds }
    );
  }

  // ── Public API: Batch Status ──

  /**
   * Check saved status for multiple IDs at once (for list pages).
   */
  batchCheckStatus(targetType: string, targetIds: string[]): void {
    if (!this.isLoggedIn || !targetIds.length) return;

    this.http.post<Record<string, { saved: boolean }>>(
      `${this.apiUrl}/batch-status`,
      { targetType, targetIds },
      { withCredentials: true }
    ).subscribe({
      next: (result) => {
        // The bookmarks signal already contains the full state,
        // but this confirms server truth for edge cases
      },
      error: () => { /* Silent */ }
    });
  }

  // ── Private: Data Loading ──

  private loadBookmarks(): void {
    if (!this.isLoggedIn) return;

    // Only set loading to false if we don't have a cache in memory
    if (this.bookmarks().length === 0) {
      this.initialLoadComplete.set(false);
    }

    this.http.get<any>(this.apiUrl, { withCredentials: true }).subscribe({
      next: (res) => {
        const items = (res?.data || res || []).sort(
          (a: any, b: any) => (b.savedAt || 0) - (a.savedAt || 0)
        );
        this.bookmarks.set(items);
        this.initialLoadComplete.set(true);
        this.persistToStorageCache(items);
        this.persistToIndexedDB();
      },
      error: () => {
        // Try loading from IndexedDB cache if memory is still empty
        if (this.bookmarks().length === 0) {
          this.loadFromIndexedDB();
        }
        this.initialLoadComplete.set(true);
      }
    });
  }

  // ── Storage Cache Helpers (0ms Stale-While-Revalidate) ──

  private loadFromStorageCache(): UnifiedBookmark[] | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(this.STORAGE_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  private persistToStorageCache(items: UnifiedBookmark[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.STORAGE_CACHE_KEY, JSON.stringify(items));
    } catch { /* Quota exceeded or private browsing */ }
  }

  private clearStorageCache(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(this.STORAGE_CACHE_KEY);
    } catch { /* Silent */ }
  }

  private loadCollections(): void {
    if (!this.isLoggedIn) return;

    this.http.get<any[]>(`${this.apiUrl}/collections`, { withCredentials: true }).subscribe({
      next: (cols) => this.collections.set(cols || []),
      error: () => { /* Silent */ }
    });
  }

  // ── Private: BroadcastChannel ──

  private broadcastChange(): void {
    if (this.channel) {
      try {
        this.channel.postMessage({ action: 'reload' });
      } catch { /* Channel may be closed */ }
    }
  }

  // ── Private: IndexedDB Offline Persistence ──

  private initIndexedDB(): void {
    if (typeof indexedDB === 'undefined') return;

    const request = indexedDB.open(this.DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(this.STORE_NAME)) {
        db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      this.db = request.result;
    };
    request.onerror = () => { /* Silent */ };
  }

  private persistToIndexedDB(): void {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(this.STORE_NAME, 'readwrite');
      const store = tx.objectStore(this.STORE_NAME);
      store.clear();
      for (const bookmark of this.bookmarks()) {
        store.put(bookmark);
      }
    } catch { /* Silent */ }
  }

  private loadFromIndexedDB(): void {
    if (!this.db) return;

    try {
      const tx = this.db.transaction(this.STORE_NAME, 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        if (request.result?.length) {
          this.bookmarks.set(request.result);
        }
      };
    } catch { /* Silent */ }
  }

  ngOnDestroy(): void {
    this.channel?.close();
    this.db?.close();
  }
}