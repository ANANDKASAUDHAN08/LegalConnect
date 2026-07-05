import { Component, OnInit, OnDestroy, HostListener, ElementRef, effect, untracked, ChangeDetectionStrategy, ChangeDetectorRef, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookmarkService, Bookmark } from '../../../services/bookmark.service';
import { AuthService, UserProfile } from '../../../services/auth.service';
import { LawyerService, Consultation } from '../../../services/lawyer.service';
import { LegalService } from '../../../services/legal.service';
import { SavedItemsService } from '../../../services/saved-items.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { Observable, Subscription, Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';
import { PromptDialogComponent } from '../../../components/prompt-dialog/prompt-dialog.component';
import { FolderSidebarComponent } from './components/folder-sidebar/folder-sidebar.component';
import { BookmarkCardComponent } from './components/bookmark-card/bookmark-card.component';
import { BookmarkDetailDrawerComponent } from './components/bookmark-detail-drawer/bookmark-detail-drawer.component';
import { InquiriesTimelineComponent } from './components/inquiries-timeline/inquiries-timeline.component';
import { ActsFilterModalComponent } from './components/acts-filter-modal/acts-filter-modal.component';
import { ShareCitationModalComponent } from './components/share-citation-modal/share-citation-modal.component';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { LawyerCardComponent } from '../../../components/lawyer-card/lawyer-card.component';
import { HelplineCardComponent } from '../../find-help/components/helpline-card/helpline-card.component';
import { ResourceCardComponent } from '../../find-help/components/resource-card/resource-card.component';
import { DirectoryDetailDrawerComponent } from './components/directory-detail-drawer/directory-detail-drawer.component';
import { SavedDirectoryTabComponent } from './components/saved-directory-tab/saved-directory-tab.component';
import { PrintDossierComponent } from './components/print-dossier/print-dossier.component';

@Component({
  selector: 'app-client-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ConfirmDialogComponent,
    PromptDialogComponent,
    FolderSidebarComponent,
    BookmarkCardComponent,
    BookmarkDetailDrawerComponent,
    InquiriesTimelineComponent,
    ActsFilterModalComponent,
    ShareCitationModalComponent,
    StatCardComponent,
    TooltipDirective,
    LawyerCardComponent,
    HelplineCardComponent,
    ResourceCardComponent,
    DirectoryDetailDrawerComponent,
    SavedDirectoryTabComponent,
    PrintDossierComponent
  ],
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientDashboardComponent implements OnInit, OnDestroy {
  bookmarks$!: Observable<Bookmark[]>;
  bookmarks = toSignal(this.bookmarkService.bookmarks$, { initialValue: [] });
  currentUser = toSignal(this.authService.currentUser$, { initialValue: null });
  inquiries = signal<Consultation[]>([]);
  loadingInquiries = signal(false);
  activeTab = signal('bookmarks');

  // Search input local value for instant binding
  searchVal = '';

  // Writable Signals for queries
  searchQuery = signal('');
  actFilter = signal('');
  sortBy = signal('newest');
  currentPage = signal(1);
  itemsPerPage = signal(8);
  selectedCollection = signal('All');

  allBookmarks = computed(() => this.bookmarks());

  filteredBookmarks = signal<Bookmark[]>([]);
  totalFilteredItems = signal(0);
  totalPages = signal(0);

  paginatedBookmarks = computed(() => this.filteredBookmarks());

  showingStart = computed(() => {
    if (this.totalFilteredItems() === 0) return 0;
    const total = this.totalPages();
    const current = this.currentPage();
    const page = current > total && total > 0 ? 1 : current;
    return (page - 1) * this.itemsPerPage() + 1;
  });

  showingEnd = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const page = current > total && total > 0 ? 1 : current;
    const end = page * this.itemsPerPage();
    const count = this.totalFilteredItems();
    return end > count ? count : end;
  });

  visiblePageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const page = current > total && total > 0 ? 1 : current;
    if (total <= 5) {
      const pages = [];
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    } else {
      const pages: (number | string)[] = [];
      pages.push(1);
      const start = Math.max(2, page - 1);
      const end = Math.min(total - 1, page + 1);

      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < total - 1) pages.push('...');
      pages.push(total);
      return pages;
    }
  });

  // Statistics signals (computed declarations)
  totalSavedCount = computed(() => this.allBookmarks().length);
  unassignedCount = computed(() => this.allBookmarks().filter(b => !b.collectionName || !b.collectionName.trim()).length);

  distinctActsCount = computed(() => {
    const uniqueActs = new Set<string>();
    this.allBookmarks().forEach(b => uniqueActs.add(b.actShortName));
    return uniqueActs.size;
  });

  actsBreakdown = computed(() => {
    const map = new Map<string, number>();
    this.allBookmarks().forEach(b => {
      map.set(b.actShortName, (map.get(b.actShortName) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  });

  activeInquiriesCount = computed(() => {
    return this.inquiries().filter(i => i.status === 'Pending' || i.status === 'Contacted').length;
  });

  newCollectionName = signal('');
  customCollections = signal<string[]>([]);
  sidebarFolderSearchQuery = signal('');

  // Dropdowns
  showSortDropdown = signal(false);

  // Drawer states
  selectedBookmark = signal<Bookmark | null>(null);
  drawerNoteText = signal('');
  aiSummary = signal('');
  loadingAiSummary = signal(false);

  // Saved directory details lists
  savedLawyersDetails = signal<any[]>([]);
  savedHelplinesDetails = signal<any[]>([]);
  savedResourcesDetails = signal<any[]>([]);

  // Cached directory lists
  private cachedLawyers: any[] | null = null;
  private cachedHelplines: any[] | null = null;
  private cachedResources: any[] | null = null;

  private loadingLawyersList = false;
  private loadingHelplinesList = false;
  private loadingResourcesList = false;

  // Directory Detail Drawer state
  directoryDrawerOpen = signal(false);
  directoryDrawerType = signal<'lawyer' | 'resource' | 'helpline' | null>(null);
  directoryDrawerData = signal<any>(null);

  // Sharing
  bookmarkToShare = signal<Bookmark | null>(null);

  // Custom dialogs states
  customConfirmTitle = signal('');
  customConfirmMessage = signal('');
  customConfirmType = signal<'danger' | 'warning' | 'info'>('warning');
  customConfirmAction: (() => void) | null = null;

  customPromptTitle = signal('');
  customPromptLabel = signal('');
  customPromptValue = signal('');
  customPromptAction: ((val: string) => void) | null = null;

  // Page Load state
  isPageLoading = signal(true);
  isTabLoading = signal(false);

  showActsFilterModal = signal(false);
  showMobileFolderSearch = signal(false);

  // Modal getters and setters wrapped around internally-stored signals (prevents breaking old code)
  private _showNewCollectionModal = signal(false);
  get showNewCollectionModal(): boolean {
    return this._showNewCollectionModal();
  }
  set showNewCollectionModal(val: boolean) {
    this._showNewCollectionModal.set(val);
    this.updateScrollLock();
  }

  private _showShareModal = signal(false);
  get showShareModal(): boolean {
    return this._showShareModal();
  }
  set showShareModal(val: boolean) {
    this._showShareModal.set(val);
    this.updateScrollLock();
  }

  private _drawerOpen = signal(false);
  get drawerOpen(): boolean {
    return this._drawerOpen();
  }
  set drawerOpen(val: boolean) {
    this._drawerOpen.set(val);
    this.updateScrollLock();
  }

  private _customConfirmOpen = signal(false);
  get customConfirmOpen(): boolean {
    return this._customConfirmOpen();
  }
  set customConfirmOpen(val: boolean) {
    this._customConfirmOpen.set(val);
    this.updateScrollLock();
  }

  private _customPromptOpen = signal(false);
  get customPromptOpen(): boolean {
    return this._customPromptOpen();
  }
  set customPromptOpen(val: boolean) {
    this._customPromptOpen.set(val);
    this.updateScrollLock();
  }

  private updateScrollLock() {
    if (typeof document !== 'undefined') {
      const lock = this.showNewCollectionModal ||
        this.showShareModal ||
        this.drawerOpen ||
        this.directoryDrawerOpen() ||
        this.customConfirmOpen ||
        this.customPromptOpen ||
        this.showActsFilterModal();
      if (lock) {
        document.body.classList.add('overflow-hidden');
      } else {
        document.body.classList.remove('overflow-hidden');
      }
    }
  }

  printCollectionName = 'All';
  printDate = new Date();

  get printItemsCount(): number {
    if (this.printCollectionName === 'All') return this.allBookmarks().length;
    return this.allBookmarks().filter(b => b.collectionName === this.printCollectionName).length;
  }

  get printedBookmarks(): Bookmark[] {
    if (this.printCollectionName === 'All') {
      return this.allBookmarks();
    }
    return this.allBookmarks().filter(bm => bm.collectionName === this.printCollectionName);
  }

  private sub = new Subscription();
  private summarySub: Subscription | null = null;
  private notesSubject = new Subject<string>();
  private searchSubject = new Subject<string>();

  @HostListener('document:click')
  clickout() {
    this.showSortDropdown.set(false);
  }

  constructor(
    public bookmarkService: BookmarkService,
    public authService: AuthService,
    private lawyerService: LawyerService,
    private legalService: LegalService,
    private snackbarService: SnackbarService,
    public savedItemsService: SavedItemsService,
    private route: ActivatedRoute,
    private eRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {
    // Effect 1: React to saved-items list changes; use untracked() for detail cache reads
    // to avoid re-triggering when the cache itself is updated.
    effect(() => {
      // Track only the saved IDs lists as reactive dependencies
      const savedLawyers = this.savedItemsService.savedLawyers();
      const savedHelplines = this.savedItemsService.savedHelplines();
      const savedResources = this.savedItemsService.savedResources();

      // All reads of detail caches + writes happen in untracked to prevent loop
      untracked(() => this.loadSavedDirectoryDetails());
    });

    // Effect 2: Sync drawer's bookmark reference when bookmarks array changes.
    // Use untracked() on selectedBookmark read to avoid loop when we write to it.
    effect(() => {
      const bms = this.bookmarks();
      const selected = untracked(() => this.selectedBookmark());
      if (selected) {
        const match = bms.find(b => b.actShortName === selected.actShortName && b.section.section_number === selected.section.section_number);
        if (match) {
          untracked(() => this.selectedBookmark.set(match));
        }
      }
    });

    // Effect 3: Reload custom folder list when bookmarks or user changes.
    effect(() => {
      this.bookmarks();
      this.currentUser();
      untracked(() => this.loadCustomCollections());
    });

    // Effect 4: Reload paginated bookmark page whenever any filter/sort/page changes.
    effect(() => {
      // Explicitly track all dependencies
      this.bookmarks();
      this.selectedCollection();
      this.actFilter();
      this.searchQuery();
      this.sortBy();
      this.currentPage();
      this.itemsPerPage();

      // Run in untracked so internal signal writes don't re-trigger this effect
      untracked(() => this.loadPaginatedBookmarks());
    });
  }

  ngOnInit() {
    this.bookmarks$ = this.bookmarkService.bookmarks$;

    // Debounce note saving to optimize database/network writes
    this.sub.add(
      this.notesSubject.pipe(
        debounceTime(750),
        distinctUntilChanged()
      ).subscribe(() => {
        this.saveNotes();
      })
    );

    // Debounce search query to optimize UI rendering performance on fast typing
    this.sub.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe((val) => {
        this.currentPage.set(1);
        this.actFilter.set('');
        this.searchQuery.set(val);
      })
    );

    // ── Skeleton Loader gating
    this.isPageLoading.set(true);
    let authResolved = false;
    let minTimeElapsed = false;

    const tryHideSkeleton = () => {
      if (authResolved && minTimeElapsed) {
        this.isPageLoading.set(false);
      }
    };

    setTimeout(() => {
      minTimeElapsed = true;
      tryHideSkeleton();
    }, 500);

    // Support switching tab if query param matches
    this.sub.add(
      this.route.queryParams.subscribe(params => {
        if (params['tab'] === 'inquiries' || params['tab'] === 'bookmarks') {
          this.activeTab.set(params['tab']);
        }
      })
    );

    // Gate 2: auth resolved
    this.sub.add(
      this.authService.currentUser$.subscribe(user => {
        if (user) {
          this.loadInquiries();
        }
        authResolved = true;
        tryHideSkeleton();
      })
    );

    // Sync custom collections/folders when user switches back to this browser tab
    if (typeof window !== 'undefined') {
      const focusHandler = () => {
        this.loadCustomCollections();
      };
      window.addEventListener('focus', focusHandler);
      this.sub.add({
        unsubscribe: () => window.removeEventListener('focus', focusHandler)
      });
    }
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
    if (this.summarySub) {
      this.summarySub.unsubscribe();
    }
    if (typeof document !== 'undefined') {
      document.body.classList.remove('overflow-hidden');
    }
  }

  // ── Mobile scroll-to-content helper ─────────────────────────────────────────
  private scrollToContent(delayMs = 120) {
    if (typeof window === 'undefined') return;
    const isMobile = window.innerWidth < 1024;
    if (!isMobile) return;
    setTimeout(() => {
      const el = document.getElementById('content-section');
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 80; // 80px navbar offset
      window.scrollTo({ top, behavior: 'smooth' });
    }, delayMs);
  }

  setPage(page: number | string) {
    if (typeof page === 'string') return;
    const total = this.totalPages();
    if (page >= 1 && page <= total) {
      this.currentPage.set(page);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  onSearchChanged(val: string) {
    this.searchVal = val;
    this.searchSubject.next(val);
  }

  // ── Stats Card Click Handlers ────────────────────────────────────────────────
  onCardClick(card: 'saved' | 'collections' | 'acts' | 'inquiries') {
    if (card === 'saved') {
      this.activeTab.set('bookmarks');
      this.selectedCollection.set('All');
      this.searchVal = '';
      this.searchQuery.set('');
      this.actFilter.set('');
      this.scrollToContent();
    } else if (card === 'collections') {
      this.activeTab.set('bookmarks');
      setTimeout(() => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
        const targetId = isMobile ? 'content-section' : 'folders-section';
        const el = document.getElementById(targetId);
        if (el) {
          const top = el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      }, 100);
    } else if (card === 'acts') {
      if (this.actsBreakdown().length === 0) {
        this.snackbarService.show('No acts referenced yet. Save some legal sections to get started.', 'info');
        return;
      }
      this.showActsFilterModal.set(true);
      this.updateScrollLock();
    } else if (card === 'inquiries') {
      this.activeTab.set('inquiries');
      this.scrollToContent();
    }
  }

  filterByAct(actName: string) {
    this.showActsFilterModal.set(false);
    this.updateScrollLock();
    this.activeTab.set('bookmarks');
    this.selectedCollection.set('All');
    this.searchVal = '';
    this.searchQuery.set('');
    this.actFilter.set(actName);
    this.currentPage.set(1);
    this.scrollToContent(180);
  }

  clearActFilter() {
    this.actFilter.set('');
    this.currentPage.set(1);
  }

  closeActsModal() {
    this.showActsFilterModal.set(false);
    this.updateScrollLock();
  }

  loadInquiries() {
    this.loadingInquiries.set(true);
    this.lawyerService.getSentInquiries().subscribe({
      next: (res) => {
        this.inquiries.set(res || []);
        this.loadingInquiries.set(false);
      },
      error: () => {
        this.loadingInquiries.set(false);
      }
    });
  }

  removeBookmark(actId: string, secNum: string) {
    this.openCustomConfirm(
      'Remove Bookmark',
      'Are you sure you want to remove this bookmark reference from your library?',
      'danger',
      () => {
        this.bookmarkService.removeBookmark(actId, secNum);
        const selected = this.selectedBookmark();
        if (selected && selected.actShortName === actId && selected.section.section_number === secNum) {
          this.closeBookmarkDrawer();
        }
      }
    );
  }

  loadCustomCollections() {
    const user = this.currentUser();
    const key = user ? `legalconnect_custom_folders_${user.email}` : `legalconnect_custom_folders_guest`;
    const saved = localStorage.getItem(key);
    const localFolders: string[] = saved ? JSON.parse(saved) : [];

    const activeFolders = this.allBookmarks()
      .map(b => b.collectionName)
      .filter((name): name is string => !!name && name.trim().length > 0);

    this.customCollections.set(Array.from(new Set([...localFolders, ...activeFolders])).sort());
    this.saveCustomCollections();
  }

  saveCustomCollections() {
    const user = this.currentUser();
    const key = user ? `legalconnect_custom_folders_${user.email}` : `legalconnect_custom_folders_guest`;
    localStorage.setItem(key, JSON.stringify(this.customCollections()));
  }

  createCollection() {
    const folder = this.newCollectionName().trim();
    if (!folder) return;

    if (this.customCollections().includes(folder)) {
      this.snackbarService.show('Research folder already exists.', 'warning');
      return;
    }

    this.customCollections.update(cols => [...cols, folder].sort());
    this.saveCustomCollections();

    this.selectedCollection.set(folder);
    this.newCollectionName.set('');
    this.showNewCollectionModal = false;
    this.snackbarService.show(`Research folder "${folder}" created successfully.`, 'success');
  }

  renameCollection(oldName: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.openCustomPrompt(
      'Rename Research Folder',
      'Enter a new name for this folder:',
      oldName,
      (newName) => {
        if (!newName || !newName.trim() || newName.trim() === oldName) return;

        const cleanNewName = newName.trim();
        if (this.customCollections().includes(cleanNewName)) {
          this.snackbarService.show('A folder with this name already exists.', 'warning');
          return;
        }

        this.customCollections.update(cols => cols.map(c => c === oldName ? cleanNewName : c).sort());
        this.saveCustomCollections();

        this.allBookmarks().forEach(bm => {
          if (bm.collectionName === oldName) {
            this.bookmarkService.updateBookmarkMetadata(bm.actShortName, bm.section.section_number, bm.notes, cleanNewName, true);
          }
        });

        if (this.selectedCollection() === oldName) {
          this.selectedCollection.set(cleanNewName);
        }
        this.snackbarService.show(`Research folder "${oldName}" successfully renamed to "${cleanNewName}".`, 'success');
      }
    );
  }

  deleteCollection(folderName: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.openCustomConfirm(
      'Delete Research Folder',
      `Are you sure you want to delete the folder "${folderName}"? All saved sections in it will be moved to General Reference.`,
      'danger',
      () => {
        this.customCollections.update(cols => cols.filter(c => c !== folderName));
        this.saveCustomCollections();

        this.allBookmarks().forEach(bm => {
          if (bm.collectionName === folderName) {
            this.bookmarkService.updateBookmarkMetadata(bm.actShortName, bm.section.section_number, bm.notes, undefined, true);
          }
        });

        if (this.selectedCollection() === folderName) {
          this.selectedCollection.set('All');
        }
        this.snackbarService.show(`Research folder "${folderName}" deleted successfully. Saved items moved to General Reference.`, 'success');
      }
    );
  }

  // --- CUSTOM POPUP DIALOG UTILITIES ---
  openCustomConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', onConfirm: () => void) {
    this.customConfirmTitle.set(title);
    this.customConfirmMessage.set(message);
    this.customConfirmType.set(type);
    this.customConfirmAction = onConfirm;
    this.customConfirmOpen = true;
  }

  closeCustomConfirm() {
    this.customConfirmOpen = false;
    this.customConfirmAction = null;
  }

  triggerCustomConfirm() {
    if (this.customConfirmAction) {
      this.customConfirmAction();
    }
    this.closeCustomConfirm();
  }

  openCustomPrompt(title: string, label: string, initialValue: string, onConfirm: (val: string) => void) {
    this.customPromptTitle.set(title);
    this.customPromptLabel.set(label);
    this.customPromptValue.set(initialValue);
    this.customPromptAction = onConfirm;
    this.customPromptOpen = true;
  }

  closeCustomPrompt() {
    this.customPromptOpen = false;
    this.customPromptValue.set('');
    this.customPromptAction = null;
  }

  triggerCustomPrompt() {
    if (this.customPromptAction) {
      this.customPromptAction(this.customPromptValue());
    }
    this.closeCustomPrompt();
  }

  shareCollection(folderName: string) {
    const list = this.allBookmarks().filter(b => b.collectionName === folderName);
    if (list.length === 0) {
      this.snackbarService.show('No items in this collection to share.', 'warning');
      return;
    }

    const citationText = list.map((bm, index) => {
      const noteContent = bm.notes ? `\n   Note: "${bm.notes}"` : '';
      return `${index + 1}. ${bm.actShortName} Section ${bm.section.section_number}: ${bm.section.title}\n   Text: "${bm.section.content}"${noteContent}`;
    }).join('\n\n');

    const shareBody = `LegalConnect Research Collection - "${folderName}"\nCompiled Date: ${new Date().toLocaleDateString()}\n\n${citationText}`;

    navigator.clipboard.writeText(shareBody).then(() => {
      this.snackbarService.show(`Folder "${folderName}" citation contents copied to clipboard!`, 'success');
    }).catch(() => {
      this.snackbarService.show('Failed to copy folder contents to clipboard.', 'error');
    });
  }

  getSortLabel(val: string): string {
    if (val === 'newest') return 'Recently Saved';
    if (val === 'oldest') return 'Oldest Saved';
    if (val === 'sectionAsc') return 'Section No (Asc)';
    if (val === 'sectionDesc') return 'Section No (Desc)';
    return 'Recently Saved';
  }

  selectSort(val: string) {
    this.sortBy.set(val);
    this.showSortDropdown.set(false);
    this.currentPage.set(1);
  }

  // Move / Organize bookmark folder
  moveBookmarkToCollection(bm: Bookmark, collectionName: string, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const target = collectionName === 'Unassigned' || !collectionName ? undefined : collectionName;
    this.bookmarkService.updateBookmarkMetadata(bm.actShortName, bm.section.section_number, bm.notes, target);
  }

  // Quick View Drawer open/close
  openBookmarkDrawer(bm: Bookmark) {
    this.selectedBookmark.set(bm);
    this.drawerOpen = true;

    // Check if there is an unsaved local draft first
    const draftKey = `note_draft_${bm.actShortName}_${bm.section.section_number}`;
    const draft = localStorage.getItem(draftKey);
    this.drawerNoteText.set(draft !== null ? draft : (bm.notes || ''));

    this.aiSummary.set('');
    this.loadingAiSummary.set(false);
  }

  closeBookmarkDrawer() {
    this.drawerOpen = false;
    if (this.summarySub) {
      this.summarySub.unsubscribe();
      this.summarySub = null;
    }

    // Delay clearing the data so the slide-out animation runs smoothly with content visible
    setTimeout(() => {
      if (!this.drawerOpen) { // Make sure the user didn't open a new one in the meantime
        this.selectedBookmark.set(null);
        this.drawerNoteText.set('');
        this.aiSummary.set('');
      }
    }, 400);
  }

  // Save notes to cloud/db
  saveNotes() {
    const bm = this.selectedBookmark();
    if (!bm) return;
    const notesText = this.drawerNoteText();
    const draftKey = `note_draft_${bm.actShortName}_${bm.section.section_number}`;

    this.bookmarkService.updateBookmarkMetadata(
      bm.actShortName,
      bm.section.section_number,
      notesText,
      bm.collectionName,
      false, // silent
      () => {
        // onSuccess: Clear draft from localStorage once successfully synced to db
        localStorage.removeItem(draftKey);
      },
      () => {
        // onError: Keep the draft in localStorage so they don't lose it!
      }
    );
  }

  onNotesChanged(newNotes: string) {
    this.drawerNoteText.set(newNotes);

    // Save draft in localStorage immediately
    const bm = this.selectedBookmark();
    if (bm) {
      const draftKey = `note_draft_${bm.actShortName}_${bm.section.section_number}`;
      localStorage.setItem(draftKey, newNotes);
    }

    this.notesSubject.next(newNotes);
  }

  // Copy citation details to clipboard
  copySectionToClipboard(bm: Bookmark, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    const citation = `${bm.actShortName} - Section ${bm.section.section_number}: ${bm.section.title}\n\n"${bm.section.content}"`;
    navigator.clipboard.writeText(citation).then(() => {
      this.snackbarService.show('Section citation copied to clipboard.', 'success');
    }).catch(() => {
      this.snackbarService.show('Failed to copy text.', 'error');
    });
  }

  // Gemini AI summary fetch
  fetchAiSummary() {
    const bm = this.selectedBookmark();
    if (!bm) return;
    this.loadingAiSummary.set(true);
    this.aiSummary.set('');

    if (this.summarySub) {
      this.summarySub.unsubscribe();
    }

    this.summarySub = this.legalService.getSectionSummaryStream(
      bm.actShortName,
      bm.section.section_number
    ).subscribe({
      next: (chunk) => {
        this.loadingAiSummary.set(false);
        this.aiSummary.update(val => val + chunk);
      },
      error: (err) => {
        console.error('Streaming summary error:', err);
        if (!this.aiSummary()) {
          this.aiSummary.set('AI Summary feature is currently unavailable. Please ensure the backend is connected and configured.');
        }
        this.loadingAiSummary.set(false);
      },
      complete: () => {
        this.loadingAiSummary.set(false);
      }
    });
  }

  // Share with Lawyer Modal
  openShareModal(bm: Bookmark, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.bookmarkToShare.set(bm);
    this.showShareModal = true;
  }

  shareWithSelectedLawyer(lawyer: Consultation) {
    const bm = this.bookmarkToShare();
    if (!bm) return;
    const noteText = bm.notes ? `\n\nClient Notes: "${bm.notes}"` : '';
    const shareText = `Hello Advocate, here is a legal section from my saved library reference:
${bm.actShortName} Section ${bm.section.section_number}: ${bm.section.title}

"${bm.section.content}"${noteText}`;

    navigator.clipboard.writeText(shareText).then(() => {
      this.snackbarService.show(`Copied reference citation for ${lawyer.lawyerName || 'Advocate'} to clipboard.`, 'success');
    }).catch(() => {
      this.snackbarService.show('Failed to copy sharing text.', 'error');
    });
    this.showShareModal = false;
    this.bookmarkToShare.set(null);
  }

  triggerPrint(collectionName: string) {
    this.printCollectionName = collectionName;
    this.printDate = new Date();
    // Brief timeout to let the print template render before dialog opens
    setTimeout(() => {
      window.print();
    }, 150);
  }

  triggerPrintDirectory() {
    this.printDate = new Date();
    // Brief timeout to let the print template render before dialog opens
    setTimeout(() => {
      window.print();
    }, 150);
  }

  trackByBookmark(index: number, item: Bookmark): string {
    return `${item.actShortName}_${item.section.section_number}`;
  }

  trackByInquiry(index: number, item: Consultation): number {
    return item.id;
  }

  trackById(index: number, item: any): string {
    return item._id || index.toString();
  }

  trackByPage(index: number, item: any): string {
    return item.toString();
  }

  setActiveTab(tab: string) {
    if (this.activeTab() === tab) return;
    this.isTabLoading.set(true);
    this.activeTab.set(tab);

    // If actual backend reloading is needed, trigger it here:
    if (tab === 'inquiries') {
      this.loadInquiries();
    }

    // Brief timeout to allow the skeleton loader to smoothly fade in/out
    setTimeout(() => {
      this.isTabLoading.set(false);
    }, 1000);
  }

  loadSavedDirectoryDetails() {
    const savedLawyersList = this.savedItemsService.savedLawyers();
    const savedLawyerIds = savedLawyersList.map(l => l.lawyerId);

    // Check if we need to fetch or filter
    const hasNewLawyer = savedLawyerIds.some(id => !this.savedLawyersDetails().some(l => l._id === id));
    const isLawyerListSmaller = savedLawyerIds.length < this.savedLawyersDetails().length;

    if (isLawyerListSmaller) {
      const set = new Set(savedLawyerIds);
      this.savedLawyersDetails.update(list => list.filter(l => set.has(l._id)));
      if (this.directoryDrawerOpen() && this.directoryDrawerType() === 'lawyer' && Array.isArray(this.directoryDrawerData())) {
        this.directoryDrawerData.set(this.savedLawyersDetails());
      }
    } else if (hasNewLawyer && savedLawyerIds.length > 0) {
      this.lawyerService.getLawyersByIds(savedLawyerIds).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.savedLawyersDetails.set(res.data);
            if (this.directoryDrawerOpen() && this.directoryDrawerType() === 'lawyer' && Array.isArray(this.directoryDrawerData())) {
              this.directoryDrawerData.set(this.savedLawyersDetails());
            }
          }
        }
      });
    } else if (savedLawyerIds.length === 0) {
      this.savedLawyersDetails.set([]);
      if (this.directoryDrawerOpen() && this.directoryDrawerType() === 'lawyer' && Array.isArray(this.directoryDrawerData())) {
        this.directoryDrawerData.set([]);
      }
    }

    const savedHelplinesList = this.savedItemsService.savedHelplines();
    const savedHelplineIds = savedHelplinesList.map(h => h.helplineId);

    const hasNewHelpline = savedHelplineIds.some(id => !this.savedHelplinesDetails().some(h => h._id === id));
    const isHelplineListSmaller = savedHelplineIds.length < this.savedHelplinesDetails().length;

    if (isHelplineListSmaller) {
      const set = new Set(savedHelplineIds);
      this.savedHelplinesDetails.update(list => list.filter(h => set.has(h._id)));
      if (this.directoryDrawerOpen() && this.directoryDrawerType() === 'helpline' && Array.isArray(this.directoryDrawerData())) {
        this.directoryDrawerData.set(this.savedHelplinesDetails());
      }
    } else if (hasNewHelpline && savedHelplineIds.length > 0) {
      this.legalService.getHelplinesByIds(savedHelplineIds).subscribe({
        next: (res) => {
          if (res && res.success && res.data) {
            this.savedHelplinesDetails.set(res.data);
            if (this.directoryDrawerOpen() && this.directoryDrawerType() === 'helpline' && Array.isArray(this.directoryDrawerData())) {
              this.directoryDrawerData.set(this.savedHelplinesDetails());
            }
          }
        }
      });
    } else if (savedHelplineIds.length === 0) {
      this.savedHelplinesDetails.set([]);
      if (this.directoryDrawerOpen() && this.directoryDrawerType() === 'helpline' && Array.isArray(this.directoryDrawerData())) {
        this.directoryDrawerData.set([]);
      }
    }

    const savedResourcesList = this.savedItemsService.savedResources();
    const savedResourceIds = savedResourcesList.map(r => r.resourceId);

    const hasNewResource = savedResourceIds.some(id => !this.savedResourcesDetails().some(r => r._id === id));
    const isResourceListSmaller = savedResourceIds.length < this.savedResourcesDetails().length;

    if (isResourceListSmaller) {
      const set = new Set(savedResourceIds);
      this.savedResourcesDetails.update(list => list.filter(r => set.has(r._id)));
      if (this.directoryDrawerOpen() && this.directoryDrawerType() === 'resource' && Array.isArray(this.directoryDrawerData())) {
        this.directoryDrawerData.set(this.savedResourcesDetails());
      }
    } else if (hasNewResource && savedResourceIds.length > 0) {
      this.legalService.getResourcesByIds(savedResourceIds).subscribe({
        next: (res) => {
          if (res && res.success && res.data) {
            this.savedResourcesDetails.set(res.data);
            if (this.directoryDrawerOpen() && this.directoryDrawerType() === 'resource' && Array.isArray(this.directoryDrawerData())) {
              this.directoryDrawerData.set(this.savedResourcesDetails());
            }
          }
        }
      });
    } else if (savedResourceIds.length === 0) {
      this.savedResourcesDetails.set([]);
      if (this.directoryDrawerOpen() && this.directoryDrawerType() === 'resource' && Array.isArray(this.directoryDrawerData())) {
        this.directoryDrawerData.set([]);
      }
    }
  }

  loadPaginatedBookmarks() {
    const runClientSidePagination = () => {
      let list = [...this.bookmarks()];

      // 1. Collection Name filter
      const folder = this.selectedCollection();
      if (folder && folder !== 'All') {
        if (folder === 'Unassigned') {
          list = list.filter(b => !b.collectionName || !b.collectionName.trim());
        } else {
          list = list.filter(b => b.collectionName === folder);
        }
      }

      // 2. Act filter
      const act = this.actFilter();
      if (act) {
        list = list.filter(b => b.actShortName === act);
      }

      // 3. Search query filter
      const search = this.searchQuery()?.toLowerCase();
      if (search) {
        list = list.filter(b =>
          b.actShortName.toLowerCase().includes(search) ||
          b.section.section_number.toLowerCase().includes(search) ||
          b.section.title.toLowerCase().includes(search) ||
          b.section.content.toLowerCase().includes(search) ||
          (b.notes && b.notes.toLowerCase().includes(search))
        );
      }

      // 4. Sort order
      const sort = this.sortBy();
      if (sort === 'oldest') {
        list.sort((a, b) => a.savedAt - b.savedAt);
      } else if (sort === 'sectionAsc') {
        list.sort((a, b) => a.section.section_number.localeCompare(b.section.section_number, undefined, { numeric: true, sensitivity: 'base' }));
      } else if (sort === 'sectionDesc') {
        list.sort((a, b) => b.section.section_number.localeCompare(a.section.section_number, undefined, { numeric: true, sensitivity: 'base' }));
      } else {
        // newest
        list.sort((a, b) => b.savedAt - a.savedAt);
      }

      const total = list.length;
      const size = this.itemsPerPage();
      const pages = Math.ceil(total / size);
      const page = this.currentPage();
      const skip = (page - 1) * size;
      const paginated = list.slice(skip, skip + size);

      this.filteredBookmarks.set(paginated);
      this.totalFilteredItems.set(total);
      this.totalPages.set(pages);
      this.isTabLoading.set(false);
    };

    const user = this.currentUser();
    if (!user) {
      runClientSidePagination();
      return;
    }

    this.isTabLoading.set(true);
    this.bookmarkService.getPaginatedBookmarks({
      collectionName: this.selectedCollection(),
      actFilter: this.actFilter(),
      searchQuery: this.searchQuery(),
      sortBy: this.sortBy(),
      page: this.currentPage(),
      pageSize: this.itemsPerPage()
    }).subscribe({
      next: (res) => {
        this.isTabLoading.set(false);
        if (res.success && res.data) {
          this.filteredBookmarks.set(res.data);
          this.totalFilteredItems.set(res.pagination.totalItems);
          this.totalPages.set(res.pagination.totalPages);
        } else {
          runClientSidePagination();
        }
      },
      error: () => {
        runClientSidePagination();
      }
    });
  }

  openDirectoryDrawer(type: 'lawyer' | 'resource' | 'helpline', data: any) {
    this.directoryDrawerType.set(type);
    this.directoryDrawerData.set(data);
    this.directoryDrawerOpen.set(true);
    this.updateScrollLock();
  }

  closeDirectoryDrawer() {
    this.directoryDrawerOpen.set(false);
    this.updateScrollLock();

    // Delay clearing data for a smooth slide-out transition
    setTimeout(() => {
      if (!this.directoryDrawerOpen()) {
        this.directoryDrawerType.set(null);
        this.directoryDrawerData.set(null);
      }
    }, 400);
  }

  copySummaryToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.snackbarService.show('Directory summary copied to clipboard!', 'success');
    }).catch(() => {
      this.snackbarService.show('Failed to copy summary to clipboard.', 'error');
    });
  }
}