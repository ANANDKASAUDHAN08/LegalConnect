import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UniversalBookmarkService, UnifiedBookmark } from '../../../../services/universal-bookmark.service';
import { BookmarkService } from '../../../../services/bookmark.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { IconComponent } from '../../../../components/icon/icon.component';
import { CasePackExportService } from '../../../../services/case-pack-export.service';

export type BookmarkTypeFilter = 'ALL' | 'BareActSection' | 'Lawyer' | 'LegalResource' | 'Helpline';

@Component({
  selector: 'app-saved-laws-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TooltipDirective, IconComponent],
  templateUrl: './saved-laws-tab.component.html',
  styleUrls: ['./saved-laws-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SavedLawsTabComponent implements OnInit {
  private universalBookmarks = inject(UniversalBookmarkService);
  private legacyBookmarkService = inject(BookmarkService);
  private snackbar = inject(SnackbarService);
  private casePackExport = inject(CasePackExportService);
  private cdr = inject(ChangeDetectorRef);

  // Filter & Search Signals
  activeTypeFilter = signal<BookmarkTypeFilter>('ALL');
  selectedCollection = signal<string>('ALL');
  searchQuery = signal<string>('');

  // Inline Note Editing
  editingNoteId = signal<number | null>(null);
  noteDraft = '';

  // Dead Link / Dangling Reference Tracking (from cross-db validation)
  deadItemIds = signal<Set<string>>(new Set());

  // Reactive accessors from service
  allBookmarks = this.universalBookmarks.bookmarks;
  collections = this.universalBookmarks.collections;
  initialLoadComplete = this.universalBookmarks.initialLoadComplete;

  // Type Counts computed
  typeCounts = computed(() => {
    const list = this.allBookmarks();
    return {
      ALL: list.length,
      BareActSection: list.filter(b => b.targetType === 'BareActSection').length,
      Lawyer: list.filter(b => b.targetType === 'Lawyer').length,
      LegalResource: list.filter(b => b.targetType === 'LegalResource').length,
      Helpline: list.filter(b => b.targetType === 'Helpline').length,
    };
  });

  // Filtered List
  filteredBookmarks = computed(() => {
    let list = this.allBookmarks();
    const type = this.activeTypeFilter();
    const col = this.selectedCollection();
    const query = this.searchQuery().trim().toLowerCase();

    // 1. Filter by Entity Type
    if (type !== 'ALL') {
      list = list.filter(b => b.targetType === type);
    }

    // 2. Filter by Collection / Folder
    if (col !== 'ALL') {
      list = list.filter(b => (b.collectionName || 'General') === col);
    }

    // 3. Filter by Search Query
    if (query) {
      list = list.filter(b =>
        (b.title && b.title.toLowerCase().includes(query)) ||
        (b.subtitle && b.subtitle.toLowerCase().includes(query)) ||
        (b.customNotes && b.customNotes.toLowerCase().includes(query)) ||
        (b.targetType && b.targetType.toLowerCase().includes(query))
      );
    }

    return list;
  });

  ngOnInit(): void {
    // Run dead-link validation on load for MongoDB resources
    this.reconcileExternalResources();
  }

  setTypeFilter(type: BookmarkTypeFilter): void {
    this.activeTypeFilter.set(type);
  }

  setCollection(col: string): void {
    this.selectedCollection.set(col);
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
  }

  // ─── Actions ───

  removeItem(item: UnifiedBookmark, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    this.universalBookmarks.removeBookmarkById(item.id);

    // If it was a statutory BareActSection, also sync removal to legacy service
    if (item.targetType === 'BareActSection' && item.targetId.includes('::')) {
      const parts = item.targetId.split('::');
      if (parts.length === 2) {
        this.legacyBookmarkService.removeBookmark(parts[0], parts[1]);
      }
    }
  }

  startNoteEdit(item: UnifiedBookmark, event?: Event): void {
    if (event) event.stopPropagation();
    this.editingNoteId.set(item.id);
    this.noteDraft = item.customNotes || '';
  }

  saveNote(item: UnifiedBookmark, event?: Event): void {
    if (event) event.stopPropagation();
    this.universalBookmarks.updateNotes(item.id, this.noteDraft.trim());
    this.editingNoteId.set(null);
  }

  cancelNoteEdit(event?: Event): void {
    if (event) event.stopPropagation();
    this.editingNoteId.set(null);
    this.noteDraft = '';
  }

  moveToFolder(item: UnifiedBookmark, folderName: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.universalBookmarks.moveToCollection(item.id, folderName);
  }

  // ─── Helper Link & Badge Resolvers ───

  getItemRoute(item: UnifiedBookmark): { path: string; fragment?: string } {
    switch (item.targetType) {
      case 'BareActSection': {
        if (item.targetId.includes('::')) {
          const parts = item.targetId.split('::');
          return { path: `/laws/${parts[0]}`, fragment: `sec-${parts[1]}` };
        }
        return { path: '/laws' };
      }
      case 'Lawyer':
        return { path: `/lawyers/${item.targetId}` };
      case 'LegalResource':
        return { path: '/find-help' };
      case 'Helpline':
        return { path: '/find-help' };
      default:
        return { path: '/profile' };
    }
  }

  getItemTypeLabel(targetType: string): string {
    switch (targetType) {
      case 'BareActSection': return 'Act Section';
      case 'Lawyer': return 'Advocate';
      case 'LegalResource': return 'Legal Aid / Clinic';
      case 'Helpline': return 'Helpline';
      case 'Template': return 'Draft Template';
      default: return targetType;
    }
  }

  getItemTypeBadgeClass(targetType: string): string {
    switch (targetType) {
      case 'BareActSection':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25';
      case 'Lawyer':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/25';
      case 'LegalResource':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25';
      case 'Helpline':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25';
      default:
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25';
    }
  }

  private reconcileExternalResources(): void {
    const resources = this.allBookmarks().filter(b => b.targetType === 'LegalResource');
    if (resources.length === 0) return;

    const ids = resources.map(r => r.targetId);
    this.universalBookmarks.validateSavedResources('LegalResource', ids).subscribe({
      next: (res) => {
        const deadSet = new Set<string>();
        for (const [id, status] of Object.entries(res)) {
          if (!status.exists) {
            deadSet.add(id);
          }
        }
        this.deadItemIds.set(deadSet);
        this.cdr.markForCheck();
      },
      error: () => { /* Silent failure — non-blocking */ }
    });
  }

  // ── 1-Click Universal Case Pack Export (Delegated to CasePackExportService) ──

  openExportHub(): void {
    this.casePackExport.openExportHub(
      this.filteredBookmarks(),
      this.allBookmarks(),
      this.selectedCollection()
    );
  }
}