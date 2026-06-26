import { Component, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookmarkService, Bookmark } from '../../../services/bookmark.service';
import { AuthService, UserProfile } from '../../../services/auth.service';
import { LawyerService, Consultation } from '../../../services/lawyer.service';
import { LegalService } from '../../../services/legal.service';
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
    TooltipDirective
  ],
  templateUrl: './client-dashboard.component.html',
  styleUrls: ['./client-dashboard.component.scss']
})
export class ClientDashboardComponent implements OnInit, OnDestroy {
  bookmarks$!: Observable<Bookmark[]>;
  currentUser: UserProfile | null = null;
  inquiries: Consultation[] = [];
  loadingInquiries = false;
  activeTab = 'bookmarks';

  // Revamp fields
  allBookmarks: Bookmark[] = [];

  private _searchQuery = '';
  get searchQuery(): string {
    return this._searchQuery;
  }
  set searchQuery(val: string) {
    this._searchQuery = val;
    this.searchSubject.next(val);
  }

  private _actFilter = '';
  get actFilter(): string {
    return this._actFilter;
  }
  set actFilter(val: string) {
    this._actFilter = val;
    this._currentPage = 1;
    this.refreshWorkspace();
  }

  private _sortBy = 'newest';
  get sortBy(): string {
    return this._sortBy;
  }
  set sortBy(val: string) {
    this._sortBy = val;
    this._currentPage = 1;
    this.refreshWorkspace();
  }

  private _currentPage = 1;
  get currentPage(): number {
    return this._currentPage;
  }
  set currentPage(val: number) {
    this._currentPage = val;
    this.refreshWorkspace();
  }

  private _itemsPerPage = 8;
  get itemsPerPage(): number {
    return this._itemsPerPage;
  }
  set itemsPerPage(val: number) {
    this._itemsPerPage = val;
    this._currentPage = 1;
    this.refreshWorkspace();
  }

  // Cached Properties (Computed in memory to optimize template rendering performance)
  filteredBookmarks: Bookmark[] = [];
  paginatedBookmarks: Bookmark[] = [];
  unassignedCount = 0;
  totalPages = 0;
  visiblePageNumbers: (number | string)[] = [];
  showingStart = 0;
  showingEnd = 0;
  totalSavedCount = 0;
  distinctActsCount = 0;
  activeInquiriesCount = 0;
  collectionsList: string[] = [];
  actsBreakdown: { name: string; count: number }[] = [];

  private _selectedCollection = 'All';
  get selectedCollection(): string {
    return this._selectedCollection;
  }
  set selectedCollection(val: string) {
    this._selectedCollection = val;
    this._currentPage = 1;
    this.refreshWorkspace();
  }
  newCollectionName = '';
  customCollections: string[] = [];
  sidebarFolderSearchQuery = '';

  // Dropdowns
  showSortDropdown = false;

  // Drawer
  selectedBookmark: Bookmark | null = null;
  drawerNoteText = '';
  aiSummary = '';
  loadingAiSummary = false;

  // Sharing
  bookmarkToShare: Bookmark | null = null;

  // Custom dialogs (replacing native alert/confirm/prompt)
  customConfirmTitle = '';
  customConfirmMessage = '';
  customConfirmType: 'danger' | 'warning' | 'info' = 'warning';
  customConfirmAction: (() => void) | null = null;

  customPromptTitle = '';
  customPromptLabel = '';
  customPromptValue = '';
  customPromptAction: ((val: string) => void) | null = null;

  // ── Page Skeleton Loader
  isPageLoading = true;

  // ── Acts Breakdown Modal
  showActsFilterModal = false;

  // Mobile Folder Search toggle
  showMobileFolderSearch = false;



  // Scroll lock helper
  private updateScrollLock() {
    if (typeof document !== 'undefined') {
      const lock = this._showNewCollectionModal ||
        this._showShareModal ||
        this._drawerOpen ||
        this._customConfirmOpen ||
        this._customPromptOpen ||
        this.showActsFilterModal;
      if (lock) {
        document.body.classList.add('overflow-hidden');
      } else {
        document.body.classList.remove('overflow-hidden');
      }
    }
  }

  private _showNewCollectionModal = false;
  get showNewCollectionModal(): boolean {
    return this._showNewCollectionModal;
  }
  set showNewCollectionModal(val: boolean) {
    this._showNewCollectionModal = val;
    this.updateScrollLock();
  }

  private _showShareModal = false;
  get showShareModal(): boolean {
    return this._showShareModal;
  }
  set showShareModal(val: boolean) {
    this._showShareModal = val;
    this.updateScrollLock();
  }

  private _drawerOpen = false;
  get drawerOpen(): boolean {
    return this._drawerOpen;
  }
  set drawerOpen(val: boolean) {
    this._drawerOpen = val;
    this.updateScrollLock();
  }

  private _customConfirmOpen = false;
  get customConfirmOpen(): boolean {
    return this._customConfirmOpen;
  }
  set customConfirmOpen(val: boolean) {
    this._customConfirmOpen = val;
    this.updateScrollLock();
  }

  private _customPromptOpen = false;
  get customPromptOpen(): boolean {
    return this._customPromptOpen;
  }
  set customPromptOpen(val: boolean) {
    this._customPromptOpen = val;
    this.updateScrollLock();
  }

  printCollectionName = 'All';
  printDate = new Date();

  get printItemsCount(): number {
    if (this.printCollectionName === 'All') return this.allBookmarks.length;
    return this.allBookmarks.filter(b => b.collectionName === this.printCollectionName).length;
  }

  private sub = new Subscription();
  private summarySub: Subscription | null = null;
  private notesSubject = new Subject<string>();
  private searchSubject = new Subject<string>();

  @HostListener('document:click')
  clickout() {
    this.showSortDropdown = false;
  }

  constructor(
    public bookmarkService: BookmarkService,
    public authService: AuthService,
    private lawyerService: LawyerService,
    private legalService: LegalService,
    private snackbarService: SnackbarService,
    private route: ActivatedRoute,
    private eRef: ElementRef
  ) { }

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
      ).subscribe(() => {
        this._currentPage = 1;
        this.refreshWorkspace();
      })
    );

    // ── Skeleton: enforce minimum 1200ms display ─────────────────────────────
    // BehaviorSubject emits synchronously, so without a minimum timer the
    // skeleton would be hidden before the first rendered frame.
    this.isPageLoading = true;
    let authResolved = false;
    let minTimeElapsed = false;

    const tryHideSkeleton = () => {
      if (authResolved && minTimeElapsed) {
        this.isPageLoading = false;
      }
    };

    // Gate 1: minimum display time
    setTimeout(() => {
      minTimeElapsed = true;
      tryHideSkeleton();
    }, 500);

    // Subscribe to bookmarks$ to keep allBookmarks up-to-date locally for filter/stats logic
    this.sub.add(
      this.bookmarkService.bookmarks$.subscribe(bms => {
        this.allBookmarks = bms;
        this.loadCustomCollections();
        this.refreshStats();
        this.refreshWorkspace();
        // If drawer is open, keep its selectedBookmark details synchronized
        if (this.selectedBookmark) {
          const match = bms.find(b => b.actShortName === this.selectedBookmark!.actShortName && b.section.section_number === this.selectedBookmark!.section.section_number);
          if (match) {
            this.selectedBookmark = match;
          }
        }
      })
    );

    // Support switching tab if query param matches
    this.sub.add(
      this.route.queryParams.subscribe(params => {
        if (params['tab'] === 'inquiries' || params['tab'] === 'bookmarks') {
          this.activeTab = params['tab'];
        }
      })
    );

    // Gate 2: auth resolved
    this.sub.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
        if (user) {
          this.loadInquiries();
        }
        this.loadCustomCollections();
        this.refreshStats();
        this.refreshWorkspace();
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
  // On desktop (lg+) the content is always visible beside the sidebar, no scroll needed.
  // On mobile the stat cards sit above the content, so we scroll down to show results.
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

  // ── Stats Card Click Handlers ────────────────────────────────────────────────
  onCardClick(card: 'saved' | 'collections' | 'acts' | 'inquiries') {
    if (card === 'saved') {
      this.activeTab = 'bookmarks';
      this.selectedCollection = 'All';
      this.searchQuery = '';
      this.actFilter = '';
      this.scrollToContent();
    } else if (card === 'collections') {
      this.activeTab = 'bookmarks';
      // Desktop: scroll to sidebar; Mobile: scroll to content (folders pills are there)
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
      if (this.actsBreakdown.length === 0) {
        this.snackbarService.show('No acts referenced yet. Save some legal sections to get started.', 'info');
        return;
      }
      this.showActsFilterModal = true;
      this.updateScrollLock();
    } else if (card === 'inquiries') {
      this.activeTab = 'inquiries';
      this.scrollToContent();
    }
  }

  filterByAct(actName: string) {
    this.showActsFilterModal = false;
    this.updateScrollLock();
    this.activeTab = 'bookmarks';
    this.selectedCollection = 'All';
    this.searchQuery = '';       // clear free-text search
    this.actFilter = actName;    // exact match — avoids substring false positives
    this.currentPage = 1;
    this.scrollToContent(180);   // slightly longer delay to let modal close animate first
  }

  clearActFilter() {
    this.actFilter = '';
    this.currentPage = 1;
  }

  closeActsModal() {
    this.showActsFilterModal = false;
    this.updateScrollLock();
  }


  loadInquiries() {
    this.loadingInquiries = true;
    this.lawyerService.getSentInquiries().subscribe({
      next: (res) => {
        this.inquiries = res;
        this.loadingInquiries = false;
        this.refreshStats();
      },
      error: () => {
        this.loadingInquiries = false;
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
        if (this.selectedBookmark && this.selectedBookmark.actShortName === actId && this.selectedBookmark.section.section_number === secNum) {
          this.closeBookmarkDrawer();
        }
      }
    );
  }

  // --- REVAMPED WORKSPACE LOGIC ---

  refreshStats() {
    this.totalSavedCount = this.allBookmarks.length;

    const uniqueActs = new Set<string>();
    const map = new Map<string, number>();
    this.allBookmarks.forEach(b => {
      uniqueActs.add(b.actShortName);
      map.set(b.actShortName, (map.get(b.actShortName) || 0) + 1);
    });
    this.distinctActsCount = uniqueActs.size;
    this.actsBreakdown = Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    this.activeInquiriesCount = this.inquiries.filter(i => i.status === 'Pending' || i.status === 'Contacted').length;

    const list = new Set<string>();
    this.allBookmarks.forEach(b => {
      if (b.collectionName && b.collectionName.trim()) {
        list.add(b.collectionName.trim());
      }
    });
    this.collectionsList = Array.from(list).sort();
    
    this.unassignedCount = this.allBookmarks.filter(b => !b.collectionName || !b.collectionName.trim()).length;
  }

  refreshWorkspace() {
    let list = [...this.allBookmarks];

    // Filter by Collection Folder
    if (this.selectedCollection === 'Unassigned') {
      list = list.filter(b => !b.collectionName || !b.collectionName.trim());
    } else if (this.selectedCollection !== 'All') {
      list = list.filter(b => b.collectionName === this.selectedCollection);
    }

    // Filter by exact Act name (set from Acts modal — strict equality, not substring)
    if (this.actFilter) {
      list = list.filter(b => b.actShortName === this.actFilter);
    }

    // Filter by Search Query (Keyword search on free-text fields)
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(b =>
        b.actShortName.toLowerCase().includes(q) ||
        b.section.section_number.toLowerCase().includes(q) ||
        b.section.title.toLowerCase().includes(q) ||
        b.section.content.toLowerCase().includes(q) ||
        (b.notes && b.notes.toLowerCase().includes(q))
      );
    }

    // Sort
    if (this.sortBy === 'newest') {
      list.sort((a, b) => b.savedAt - a.savedAt);
    } else if (this.sortBy === 'oldest') {
      list.sort((a, b) => a.savedAt - b.savedAt);
    } else if (this.sortBy === 'sectionAsc') {
      list.sort((a, b) => {
        const numA = parseFloat(a.section.section_number);
        const numB = parseFloat(b.section.section_number);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.section.section_number.localeCompare(b.section.section_number);
      });
    } else if (this.sortBy === 'sectionDesc') {
      list.sort((a, b) => {
        const numA = parseFloat(a.section.section_number);
        const numB = parseFloat(b.section.section_number);
        if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
        return b.section.section_number.localeCompare(a.section.section_number);
      });
    }

    this.filteredBookmarks = list;

    // Calculate total pages
    this.totalPages = Math.ceil(this.filteredBookmarks.length / this.itemsPerPage);

    // Adjust current page if out of bounds
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this._currentPage = 1;
    }

    // Paginated Bookmarks
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedBookmarks = this.filteredBookmarks.slice(startIndex, startIndex + this.itemsPerPage);

    // Showing Start & End
    if (this.filteredBookmarks.length === 0) {
      this.showingStart = 0;
      this.showingEnd = 0;
    } else {
      this.showingStart = startIndex + 1;
      const end = this.currentPage * this.itemsPerPage;
      this.showingEnd = end > this.filteredBookmarks.length ? this.filteredBookmarks.length : end;
    }

    // Calculate visible page numbers
    const total = this.totalPages;
    const current = this.currentPage;
    if (total <= 5) {
      const pages = [];
      for (let i = 1; i <= total; i++) pages.push(i);
      this.visiblePageNumbers = pages;
    } else {
      const pages: (number | string)[] = [];
      pages.push(1);
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      if (start > 2) {
        pages.push('...');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < total - 1) {
        pages.push('...');
      }

      pages.push(total);
      this.visiblePageNumbers = pages;
    }
  }

  setPage(page: number | string) {
    if (typeof page === 'string') return;
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  loadCustomCollections() {
    const key = this.currentUser ? `legalconnect_custom_folders_${this.currentUser.email}` : `legalconnect_custom_folders_guest`;
    const saved = localStorage.getItem(key);
    const localFolders: string[] = saved ? JSON.parse(saved) : [];

    const activeFolders = this.allBookmarks
      .map(b => b.collectionName)
      .filter((name): name is string => !!name && name.trim().length > 0);

    this.customCollections = Array.from(new Set([...localFolders, ...activeFolders])).sort();
    this.saveCustomCollections();
  }

  saveCustomCollections() {
    const key = this.currentUser ? `legalconnect_custom_folders_${this.currentUser.email}` : `legalconnect_custom_folders_guest`;
    localStorage.setItem(key, JSON.stringify(this.customCollections));
  }

  // Create custom Folder Collection
  createCollection() {
    const folder = this.newCollectionName.trim();
    if (!folder) return;

    if (this.customCollections.includes(folder)) {
      this.snackbarService.show('Research folder already exists.', 'warning');
      return;
    }

    this.customCollections.push(folder);
    this.customCollections.sort();
    this.saveCustomCollections();
    this.refreshStats();

    this.selectedCollection = folder;
    this.newCollectionName = '';
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
        if (this.customCollections.includes(cleanNewName)) {
          this.snackbarService.show('A folder with this name already exists.', 'warning');
          return;
        }

        // Update list
        this.customCollections = this.customCollections.map(c => c === oldName ? cleanNewName : c).sort();
        this.saveCustomCollections();
        this.refreshStats();

        // Update bookmarks (silently to prevent toast spam)
        this.allBookmarks.forEach(bm => {
          if (bm.collectionName === oldName) {
            this.bookmarkService.updateBookmarkMetadata(bm.actShortName, bm.section.section_number, bm.notes, cleanNewName, true);
          }
        });

        if (this.selectedCollection === oldName) {
          this.selectedCollection = cleanNewName;
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
        this.customCollections = this.customCollections.filter(c => c !== folderName);
        this.saveCustomCollections();
        this.refreshStats();

        // Update bookmarks (silently to prevent toast spam)
        this.allBookmarks.forEach(bm => {
          if (bm.collectionName === folderName) {
            this.bookmarkService.updateBookmarkMetadata(bm.actShortName, bm.section.section_number, bm.notes, undefined, true);
          }
        });

        if (this.selectedCollection === folderName) {
          this.selectedCollection = 'All';
        }
        this.snackbarService.show(`Research folder "${folderName}" deleted successfully. Saved items moved to General Reference.`, 'success');
      }
    );
  }

  // --- CUSTOM POPUP DIALOG UTILITIES ---
  openCustomConfirm(title: string, message: string, type: 'danger' | 'warning' | 'info', onConfirm: () => void) {
    this.customConfirmTitle = title;
    this.customConfirmMessage = message;
    this.customConfirmType = type;
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
    this.customPromptTitle = title;
    this.customPromptLabel = label;
    this.customPromptValue = initialValue;
    this.customPromptAction = onConfirm;
    this.customPromptOpen = true;
  }

  closeCustomPrompt() {
    this.customPromptOpen = false;
    this.customPromptValue = '';
    this.customPromptAction = null;
  }

  triggerCustomPrompt() {
    if (this.customPromptAction) {
      this.customPromptAction(this.customPromptValue);
    }
    this.closeCustomPrompt();
  }

  shareCollection(folderName: string) {
    const list = this.allBookmarks.filter(b => b.collectionName === folderName);
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
    this.sortBy = val;
    this.showSortDropdown = false;
    this.currentPage = 1;
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
    this.selectedBookmark = bm;
    this.drawerOpen = true;
    
    // Check if there is an unsaved local draft first
    const draftKey = `note_draft_${bm.actShortName}_${bm.section.section_number}`;
    const draft = localStorage.getItem(draftKey);
    this.drawerNoteText = draft !== null ? draft : (bm.notes || '');

    this.aiSummary = '';
    this.loadingAiSummary = false;
  }

  closeBookmarkDrawer() {
    this.selectedBookmark = null;
    this.drawerOpen = false;
    this.drawerNoteText = '';
    this.aiSummary = '';
    if (this.summarySub) {
      this.summarySub.unsubscribe();
      this.summarySub = null;
    }
  }

  // Save notes to cloud/db
  saveNotes() {
    if (!this.selectedBookmark) return;
    const bm = this.selectedBookmark;
    const notesText = this.drawerNoteText;
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
    this.drawerNoteText = newNotes;
    
    // Save draft in localStorage immediately
    if (this.selectedBookmark) {
      const draftKey = `note_draft_${this.selectedBookmark.actShortName}_${this.selectedBookmark.section.section_number}`;
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
    if (!this.selectedBookmark) return;
    this.loadingAiSummary = true;
    this.aiSummary = '';
    
    if (this.summarySub) {
      this.summarySub.unsubscribe();
    }

    this.summarySub = this.legalService.getSectionSummaryStream(
      this.selectedBookmark.actShortName,
      this.selectedBookmark.section.section_number
    ).subscribe({
      next: (chunk) => {
        this.loadingAiSummary = false;
        this.aiSummary += chunk;
      },
      error: (err) => {
        console.error('Streaming summary error:', err);
        if (!this.aiSummary) {
          this.aiSummary = 'AI Summary feature is currently unavailable. Please ensure the backend is connected and configured.';
        }
        this.loadingAiSummary = false;
      },
      complete: () => {
        this.loadingAiSummary = false;
      }
    });
  }

  // Share with Lawyer Modal
  openShareModal(bm: Bookmark, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.bookmarkToShare = bm;
    this.showShareModal = true;
  }

  shareWithSelectedLawyer(lawyer: Consultation) {
    if (!this.bookmarkToShare) return;
    const noteText = this.bookmarkToShare.notes ? `\n\nClient Notes: "${this.bookmarkToShare.notes}"` : '';
    const shareText = `Hello Advocate, here is a legal section from my saved library reference:
${this.bookmarkToShare.actShortName} Section ${this.bookmarkToShare.section.section_number}: ${this.bookmarkToShare.section.title}

"${this.bookmarkToShare.section.content}"${noteText}`;

    navigator.clipboard.writeText(shareText).then(() => {
      this.snackbarService.show(`Copied reference citation for ${lawyer.lawyerName || 'Advocate'} to clipboard.`, 'success');
    }).catch(() => {
      this.snackbarService.show('Failed to copy sharing text.', 'error');
    });
    this.showShareModal = false;
    this.bookmarkToShare = null;
  }

  triggerPrint(collectionName: string) {
    this.printCollectionName = collectionName;
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
}