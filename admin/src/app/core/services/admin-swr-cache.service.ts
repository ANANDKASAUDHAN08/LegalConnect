import { Injectable } from '@angular/core';

export interface SwrCacheEntry<T = any> {
  data: T;
  timestamp: number;
  paramsKey: string;
}

/**
 * Enterprise Centralized SWR (Stale-While-Revalidate) Cache Service
 * Provides instant 0ms cached UI rendering with automatic background revalidation
 * and granular namespace-based cache invalidation across all admin modules.
 */
@Injectable({ providedIn: 'root' })
export class SwrCacheService {
  private cache = new Map<string, SwrCacheEntry>();
  // Best enterprise default: 2-minute TTL (120,000 ms) with background revalidation & instant mutation invalidation
  private readonly DEFAULT_TTL_MS = 2 * 60 * 1000;

  private generateKey(namespace: string, params?: any): string {
    const serializedParams = params ? JSON.stringify(params) : '{}';
    return `${namespace}::${serializedParams}`;
  }

  /**
   * Retrieve cached item if valid and within TTL window.
   */
  get<T>(namespace: string, params?: any, customTtlMs?: number): T | null {
    const key = this.generateKey(namespace, params);
    const entry = this.cache.get(key);
    if (!entry) return null;

    const ttl = customTtlMs ?? this.DEFAULT_TTL_MS;
    const isExpired = Date.now() - entry.timestamp > ttl;

    if (isExpired) {
      // Keep in cache for SWR background revalidation, but mark stale
      return entry.data as T;
    }

    return entry.data as T;
  }

  /**
   * Check if cache entry is stale and needs background revalidation
   */
  isStale(namespace: string, params?: any, customTtlMs?: number): boolean {
    const key = this.generateKey(namespace, params);
    const entry = this.cache.get(key);
    if (!entry) return true;
    const ttl = customTtlMs ?? this.DEFAULT_TTL_MS;
    return Date.now() - entry.timestamp > ttl;
  }

  /**
   * Store data snapshot in cache
   */
  set<T>(namespace: string, params: any, data: T): void {
    const key = this.generateKey(namespace, params);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      paramsKey: key
    });
  }

  /**
   * Invalidate all cache entries matching a namespace (e.g. 'users', 'lawyers', 'support')
   */
  invalidate(namespace: string): void {
    const prefix = `${namespace}::`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire SWR cache
   */
  invalidateAll(): void {
    this.cache.clear();
  }
}