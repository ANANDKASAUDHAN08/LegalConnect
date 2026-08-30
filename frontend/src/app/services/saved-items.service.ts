import { Injectable, signal, computed, inject } from '@angular/core';
import { UniversalBookmarkService } from './universal-bookmark.service';

export interface SavedLawyerInfo {
  lawyerId: string;
  lawyerName: string;
}

export interface SavedHelplineInfo {
  helplineId: string;
  helplineName: string;
}

export interface SavedResourceInfo {
  resourceId: string;
  resourceName: string;
}

/**
 * SavedItemsService — Backwards-compatible facade over UniversalBookmarkService.
 * All state is reactively derived from UniversalBookmarkService's single source of truth.
 */
@Injectable({ providedIn: 'root' })
export class SavedItemsService {
  private universalBookmarks = inject(UniversalBookmarkService);

  // Derived signals for backwards compatibility
  public savedLawyers = computed<SavedLawyerInfo[]>(() => {
    return this.universalBookmarks.bookmarks()
      .filter(b => b.targetType === 'Lawyer')
      .map(b => ({ lawyerId: b.targetId, lawyerName: b.title }));
  });

  public savedHelplines = computed<SavedHelplineInfo[]>(() => {
    return this.universalBookmarks.bookmarks()
      .filter(b => b.targetType === 'Helpline')
      .map(b => ({ helplineId: b.targetId, helplineName: b.title }));
  });

  public savedResources = computed<SavedResourceInfo[]>(() => {
    return this.universalBookmarks.bookmarks()
      .filter(b => b.targetType === 'LegalResource')
      .map(b => ({ resourceId: b.targetId, resourceName: b.title }));
  });

  public initialLoadComplete = this.universalBookmarks.initialLoadComplete;

  // Derived sets for O(1) fast isSaved check
  public savedLawyerIds = computed(() => this.universalBookmarks.savedIds()?.get('Lawyer') ?? new Set<string>());
  public savedHelplineIds = computed(() => this.universalBookmarks.savedIds()?.get('Helpline') ?? new Set<string>());
  public savedResourceIds = computed(() => this.universalBookmarks.savedIds()?.get('LegalResource') ?? new Set<string>());

  // ─── QUERY ─────────────────────────────────────────────────────────────────

  isSavedLawyer(lawyerId: string): boolean {
    if (!lawyerId) return false;
    return this.universalBookmarks.isSaved('Lawyer', lawyerId);
  }

  isSavedHelpline(helplineId: string): boolean {
    if (!helplineId) return false;
    return this.universalBookmarks.isSaved('Helpline', helplineId);
  }

  isSavedResource(resourceId: string): boolean {
    if (!resourceId) return false;
    return this.universalBookmarks.isSaved('LegalResource', resourceId);
  }

  // ─── TOGGLE ────────────────────────────────────────────────────────────────

  toggleLawyer(lawyerId: string, lawyerName: string) {
    if (!lawyerId) return;
    this.universalBookmarks.toggleBookmark('Lawyer', lawyerId, lawyerName || 'Advocate');
  }

  toggleResource(resourceId: string, resourceName: string) {
    if (!resourceId) return;
    this.universalBookmarks.toggleBookmark('LegalResource', resourceId, resourceName || 'Legal Resource');
  }

  toggleHelpline(helplineId: string, helplineName: string) {
    if (!helplineId) return;
    this.universalBookmarks.toggleBookmark('Helpline', helplineId, helplineName || 'Helpline');
  }
}