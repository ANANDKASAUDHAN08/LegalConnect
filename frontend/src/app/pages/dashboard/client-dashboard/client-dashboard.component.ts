import { Component, OnInit, OnDestroy, HostListener, ElementRef, effect, untracked, ChangeDetectionStrategy, ChangeDetectorRef, signal, computed, Injector, Signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BookmarkService, Bookmark } from '../../../services/bookmark.service';
import { AuthService, UserProfile } from '../../../services/auth.service';
import { LawyerService, Consultation } from '../../../services/lawyer.service';
import { LegalService } from '../../../services/legal.service';
import { LocationService } from '../../../services/location.service';
import { SavedItemsService } from '../../../services/saved-items.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { Observable, Subscription, Subject, debounceTime, distinctUntilChanged, map, switchMap, catchError, of } from 'rxjs';

import { ConfirmDialogComponent } from '../../../components/confirm-dialog/confirm-dialog.component';
import { PromptDialogComponent } from '../../../components/prompt-dialog/prompt-dialog.component';
import { FolderSidebarComponent } from './components/folder-sidebar/folder-sidebar.component';
import { BookmarksTabComponent } from './components/bookmarks-tab/bookmarks-tab.component';
import { CasePacksTabComponent } from './components/case-packs-tab/case-packs-tab.component';
import { InquiriesTimelineComponent } from './components/inquiries-timeline/inquiries-timeline.component';
import { ActsFilterModalComponent } from './components/acts-filter-modal/acts-filter-modal.component';
import { StatCardComponent } from '../../../components/stat-card/stat-card.component';
import { TooltipDirective } from '../../../directives/tooltip.directive';
import { LawyerCardComponent } from '../../../components/lawyer-card/lawyer-card.component';
import { HelplineCardComponent } from '../../find-help/components/helpline-card/helpline-card.component';
import { ResourceCardComponent } from '../../find-help/components/resource-card/resource-card.component';
import { DirectoryDetailDrawerComponent } from './components/directory-detail-drawer/directory-detail-drawer.component';
import { SavedDirectoryTabComponent } from './components/saved-directory-tab/saved-directory-tab.component';
import { PrintDossierComponent } from './components/print-dossier/print-dossier.component';
import { CasePackPreviewModalComponent } from '../../find-help/components/case-pack-preview-modal/case-pack-preview-modal.component';
import { ReaderModeModalComponent } from '../../search/components/reader-modal/reader-modal.component';
import { QrModalComponent } from '../../../components/qr-modal/qr-modal.component';

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
    BookmarksTabComponent,
    CasePacksTabComponent,
    ReaderModeModalComponent,
    InquiriesTimelineComponent,
    ActsFilterModalComponent,
    StatCardComponent,
    TooltipDirective,
    LawyerCardComponent,
    HelplineCardComponent,
    ResourceCardComponent,
    DirectoryDetailDrawerComponent,
    SavedDirectoryTabComponent,
    PrintDossierComponent,
    CasePackPreviewModalComponent,
    QrModalComponent
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
  activeTab = signal<string>('bookmarks');

  // Case Pack Dossiers tab signals
  savedCasePacks = signal<any[]>([]);
  loadingCasePacks = signal(false);
  selectedCasePack = signal<any | null>(null);
  showRoadmapPreviewModal = signal(false);

  // QR Modal signals
  showQrModal = signal<boolean>(false);
  qrModalItem = signal<any>(null);

  // Writable Signals for queries
  searchQuery = signal('');
  actFilter = signal('');
  selectedCollection = signal('All');

  allBookmarks = computed(() => this.bookmarks());
  generalBookmarks = computed(() => this.bookmarks());
  totalCasePacksCount = computed(() => this.savedCasePacks().length);
  totalSavedContactsCount = computed(() => this.savedLawyersDetails().length + this.savedHelplinesDetails().length + this.savedResourcesDetails().length);

  // Statistics signals (computed declarations)
  totalSavedCount = computed(() => this.allBookmarks().length + this.totalSavedContactsCount());
  unassignedCount = computed(() => this.generalBookmarks().filter(b => !b.collectionName || !b.collectionName.trim()).length);

  distinctActsCount = computed(() => {
    const uniqueActs = new Set<string>();
    this.generalBookmarks().forEach(b => uniqueActs.add(b.actShortName));
    return uniqueActs.size;
  });

  actsBreakdown = computed(() => {
    const map = new Map<string, number>();
    this.generalBookmarks().forEach(b => {
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

  // Drawer states
  selectedBookmark = signal<Bookmark | null>(null);
  drawerNoteText = signal('');
  aiSummary = signal('');
  loadingAiSummary = signal(false);

  // Reader Mode Modal
  showReaderModal = false;
  readerSection: any = null;
  lastQuery = '';

  // Saved directory details lists
  savedLawyersDetails!: Signal<any[]>;
  savedHelplinesDetails!: Signal<any[]>;
  savedResourcesDetails!: Signal<any[]>;

  private lawyersCache: any[] = [];
  private helplinesCache: any[] = [];
  private resourcesCache: any[] = [];

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
  minTimeElapsed = signal(false);
  isPageLoading = computed(() => {
    const bookmarksLoaded = this.bookmarkService.initialLoadComplete();
    const savedItemsLoaded = this.savedItemsService.initialLoadComplete();
    const timeElapsed = this.minTimeElapsed();
    return !(bookmarksLoaded && savedItemsLoaded && timeElapsed);
  });
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

  constructor(
    public bookmarkService: BookmarkService,
    public authService: AuthService,
    private lawyerService: LawyerService,
    private legalService: LegalService,
    private snackbarService: SnackbarService,
    public savedItemsService: SavedItemsService,
    private locationService: LocationService,
    private route: ActivatedRoute,
    private eRef: ElementRef,
    private cdr: ChangeDetectorRef,
    private injector: Injector
  ) {
    this.savedLawyersDetails = toSignal(
      toObservable(this.savedItemsService.savedLawyers).pipe(
        map(list => list.map(l => l.lawyerId)),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap(ids => {
          if (ids.length === 0) {
            this.lawyersCache = [];
            return of([]);
          }
          const hasNewLawyer = ids.some(id => !this.lawyersCache.some(l => l._id === id));
          const isListSmaller = ids.length < this.lawyersCache.length;

          if (isListSmaller) {
            const set = new Set(ids);
            this.lawyersCache = this.lawyersCache.filter(l => set.has(l._id));
            return of(this.lawyersCache);
          } else if (hasNewLawyer) {
            return this.lawyerService.getLawyersByIds(ids).pipe(
              map(res => {
                if (res.success && res.data) {
                  this.lawyersCache = res.data;
                }
                return this.lawyersCache;
              }),
              catchError(() => of(this.lawyersCache))
            );
          } else {
            return of(this.lawyersCache);
          }
        })
      ),
      { initialValue: [] }
    );

    this.savedHelplinesDetails = toSignal(
      toObservable(this.savedItemsService.savedHelplines).pipe(
        map(list => list.map(h => h.helplineId)),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap(ids => {
          if (ids.length === 0) {
            this.helplinesCache = [];
            return of([]);
          }
          const hasNewHelpline = ids.some(id => !this.helplinesCache.some(h => h._id === id));
          const isListSmaller = ids.length < this.helplinesCache.length;

          if (isListSmaller) {
            const set = new Set(ids);
            this.helplinesCache = this.helplinesCache.filter(h => set.has(h._id));
            return of(this.helplinesCache);
          } else if (hasNewHelpline) {
            return this.legalService.getHelplinesByIds(ids).pipe(
              map(res => {
                if (res && res.success && res.data) {
                  this.helplinesCache = res.data;
                }
                return this.helplinesCache;
              }),
              catchError(() => of(this.helplinesCache))
            );
          } else {
            return of(this.helplinesCache);
          }
        })
      ),
      { initialValue: [] }
    );

    this.savedResourcesDetails = toSignal(
      toObservable(this.savedItemsService.savedResources).pipe(
        map(list => list.map(r => r.resourceId)),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
        switchMap(ids => {
          if (ids.length === 0) {
            this.resourcesCache = [];
            return of([]);
          }
          const hasNewResource = ids.some(id => !this.resourcesCache.some(r => r._id === id));
          const isListSmaller = ids.length < this.resourcesCache.length;

          if (isListSmaller) {
            const set = new Set(ids);
            this.resourcesCache = this.resourcesCache.filter(r => set.has(r._id));
            return of(this.resourcesCache);
          } else if (hasNewResource) {
            return this.legalService.getResourcesByIds(ids).pipe(
              map(res => {
                if (res && res.success && res.data) {
                  this.resourcesCache = res.data;
                }
                return this.resourcesCache;
              }),
              catchError(() => of(this.resourcesCache))
            );
          } else {
            return of(this.resourcesCache);
          }
        })
      ),
      { initialValue: [] }
    );

    // Effect 1: Synchronize the directory detail drawer with the latest loaded directory collections
    effect(() => {
      if (this.directoryDrawerOpen() && Array.isArray(this.directoryDrawerData())) {
        const type = this.directoryDrawerType();
        if (type === 'lawyer') {
          this.directoryDrawerData.set(this.savedLawyersDetails());
        } else if (type === 'helpline') {
          this.directoryDrawerData.set(this.savedHelplinesDetails());
        } else if (type === 'resource') {
          this.directoryDrawerData.set(this.savedResourcesDetails());
        }
      }
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

    // ── Skeleton Loader gating (minimum timer)
    setTimeout(() => {
      this.minTimeElapsed.set(true);
    }, 600);

    // Support switching tab if query param matches
    this.sub.add(
      this.route.queryParams.subscribe(params => {
        if (params['tab'] === 'inquiries' || params['tab'] === 'bookmarks') {
          this.activeTab.set(params['tab']);
        }
      })
    );

    // Load inquiries and synced case packs once user resolves
    this.sub.add(
      this.authService.currentUser$.subscribe(user => {
        if (user) {
          this.loadInquiries();
          this.loadSyncedCasePacks();
        }
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


  // ── Stats Card Click Handlers ────────────────────────────────────────────────
  onCardClick(card: 'saved' | 'collections' | 'acts' | 'inquiries') {
    if (card === 'saved') {
      this.activeTab.set('bookmarks');
      this.selectedCollection.set('All');
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
    this.searchQuery.set('');
    this.actFilter.set(actName);
    this.scrollToContent(180);
  }

  clearActFilter() {
    this.actFilter.set('');
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

  loadSyncedCasePacks() {
    this.loadingCasePacks.set(true);

    const localPacks: any[] = [];
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('offline_casepack_')) {
            const val = localStorage.getItem(key);
            if (val) {
              localPacks.push(JSON.parse(val));
            }
          }
        }
      } catch (e) {
        console.warn('Error reading offline case packs:', e);
      }
    }

    if (localPacks.length > 0 && typeof navigator !== 'undefined' && navigator.onLine) {
      this.legalService.syncCasePacks(localPacks).subscribe({
        next: () => {
          // Do not delete local items so they remain available offline.
          // Just fetch the latest server-synced list.
          this.fetchSyncedCasePacksFromServer(localPacks);
        },
        error: () => {
          this.fetchSyncedCasePacksFromServer(localPacks);
        }
      });
    } else {
      this.fetchSyncedCasePacksFromServer(localPacks);
    }
  }

  fetchSyncedCasePacksFromServer(localFallback: any[] = []) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // Offline mode: directly use local storage case packs
      this.savedCasePacks.set(localFallback);
      this.loadingCasePacks.set(false);
      this.cdr.markForCheck();
      return;
    }

    this.legalService.getSyncedCasePacks().subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          const serverPacks = res.data || [];
          const merged = [...serverPacks];
          localFallback.forEach(local => {
            const exists = serverPacks.some((s: any) =>
              s.category === local.category && s.location === local.location
            );
            if (!exists) {
              merged.push(local);
            }
          });
          this.savedCasePacks.set(merged);
        } else {
          this.savedCasePacks.set(localFallback);
        }
        this.loadingCasePacks.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.savedCasePacks.set(localFallback);
        this.loadingCasePacks.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  deleteCasePack(pack: any) {
    this.openCustomConfirm(
      'Delete Case Pack',
      'Are you sure you want to permanently delete this Case Pack roadmap?',
      'danger',
      () => {
        // Always clean up from local storage if present
        if (typeof window !== 'undefined') {
          try {
            const key = `offline_casepack_${pack.category.toLowerCase()}_${this.locationService.cleanAddress(pack.location).toLowerCase()}`;
            localStorage.removeItem(key);
          } catch (e) { }
        }

        if (pack._id) {
          this.legalService.deleteCasePack(pack._id).subscribe({
            next: (res) => {
              if (res && res.success) {
                this.savedCasePacks.update(packs => packs.filter(p => p._id !== pack._id));
                this.snackbarService.show('Case Pack successfully deleted.', 'success');
              } else {
                this.snackbarService.show('Failed to delete Case Pack.', 'error');
              }
            },
            error: () => {
              this.snackbarService.show('Failed to delete Case Pack. Backend server error.', 'error');
            }
          });
        } else {
          this.savedCasePacks.update(packs => packs.filter(p =>
            !(p.category === pack.category && p.location === pack.location)
          ));
          this.snackbarService.show('Offline Case Pack successfully deleted.', 'success');
        }
      }
    );
  }

  openRoadmapPreview(pack: any) {
    this.selectedCasePack.set(pack);
    this.showRoadmapPreviewModal.set(true);
  }

  closeRoadmapPreview() {
    this.showRoadmapPreviewModal.set(false);
    this.selectedCasePack.set(null);
  }

  triggerPrintDownload() {
    const pack = this.selectedCasePack();
    if (!pack) return;
    this.showRoadmapPreviewModal.set(false);

    setTimeout(() => {
      this.executePrintProcess(pack);
    }, 300);
  }

  executePrintProcess(pack: any) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.snackbarService.show('Please allow popups to download report.', 'error');
      return;
    }

    const documentChecklistHtml = (pack.roadmap?.documents || []).map((d: string) => `<li>[ ] ${d}</li>`).join('');
    const actionStepsHtml = (pack.roadmap?.steps || []).map((s: any, i: number) => `
      <div style="margin-bottom: 15px;">
        <b style="color: #1e3a8a;">Step ${i + 1}: ${s.title}</b>
        <p style="margin: 4px 0 0 0; color: #475569; font-size: 13px;">${s.detail}</p>
      </div>
    `).join('');

    const resourceCardsHtml = (pack.resources || []).slice(0, 5).map((res: any) => `
      <div style="border-bottom: 1px solid #e2e8f0; padding: 10px 0;">
        <b style="font-size: 14px;">${res.name} (${res.type})</b>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">${res.address}</p>
        <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Phone: ${res.contactNumber || 'N/A'} | Hours: ${res.operatingHours}</p>
      </div>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>LegalConnect Case Pack - ${pack.category}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; }
            .header { border-bottom: 2px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 20px; }
            h1 { color: #1e3a8a; margin: 0; font-size: 24px; }
            h2 { color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-top: 30px; font-size: 18px; }
            ul { padding-left: 20px; }
            li { margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LegalConnect Case Pack Dossier</h1>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">
              Category: <b>${pack.category}</b> | Location: <b>${pack.location}</b> | Exported: ${new Date().toLocaleDateString()}
            </p>
          </div>
          
          <h2>📋 Mandatory Document Checklist</h2>
          <ul>${documentChecklistHtml || '<li>No specific documents registered.</li>'}</ul>

          <h2>⚖️ Procedural Action Steps</h2>
          ${actionStepsHtml || '<p>No procedural roadmap steps registered.</p>'}

          <h2>📍 Local Legal Authorities & Help Centers</h2>
          ${resourceCardsHtml || '<p>No local authorities registered.</p>'}

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
    let localFolders: string[] = saved ? JSON.parse(saved) : [];

    // Filter out "Case Packs" and "Saved Directory" to avoid confusion with System Directories
    const reservedNames = ['Case Packs', 'Saved Directory'];
    localFolders = localFolders.filter(f => !reservedNames.some(res => res.toLowerCase() === f.toLowerCase()));

    const activeFolders = this.allBookmarks()
      .map(b => b.collectionName)
      .filter((name): name is string =>
        !!name &&
        name.trim().length > 0 &&
        !reservedNames.some(res => res.toLowerCase() === name.toLowerCase())
      );

    this.customCollections.set(
      Array.from(new Set([...localFolders, ...activeFolders]))
        .sort()
    );
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

    // Block system-reserved folder names
    const reservedNames = ['Case Packs', 'Saved Directory', 'All', 'General Reference', 'Unassigned'];
    if (reservedNames.some(name => name.toLowerCase() === folder.toLowerCase())) {
      this.snackbarService.show(`"${folder}" is a system-reserved directory name.`, 'warning');
      return;
    }

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

        // Block system-reserved folder names
        const reservedNames = ['Case Packs', 'Saved Directory', 'All', 'General Reference', 'Unassigned'];
        if (reservedNames.some(name => name.toLowerCase() === cleanNewName.toLowerCase())) {
          this.snackbarService.show(`"${cleanNewName}" is a system-reserved directory name.`, 'warning');
          return;
        }

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

  openReaderMode(bookmark: Bookmark) {
    this.selectedBookmark.set(bookmark);
    this.readerSection = {
      shortName: bookmark.actShortName,
      chapterNumber: bookmark.chapterNumber,
      section_number: bookmark.section.section_number,
      title: bookmark.section.title,
      title_hi: bookmark.section.title_hi,
      content: bookmark.section.content,
      content_hi: bookmark.section.content_hi,
      aiSummary: bookmark.section.aiSummary
    };
    this.showReaderModal = true;
  }

  closeReaderMode() {
    this.showReaderModal = false;
    this.selectedBookmark.set(null);
  }

  onNotesChangedInReader(event: { bookmark: Bookmark, notes: string }) {
    this.bookmarkService.updateBookmarkMetadata(event.bookmark.actShortName, event.bookmark.section.section_number, event.notes, event.bookmark.collectionName);
  }

  onFolderAssignedInReader(event: { bookmark: Bookmark, folder: string }) {
    const target = event.folder === 'Unassigned' || !event.folder ? undefined : event.folder;
    this.bookmarkService.updateBookmarkMetadata(event.bookmark.actShortName, event.bookmark.section.section_number, event.bookmark.notes, target);
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

  trackByInquiry(index: number, item: Consultation): number {
    return item.id;
  }

  trackById(index: number, item: any): string {
    return item._id || index.toString();
  }

  setActiveTab(tab: string) {
    if (this.activeTab() === tab) return;
    this.isTabLoading.set(true);
    this.activeTab.set(tab);
    this.scrollToTabs();

    // If actual backend reloading is needed, trigger it here:
    if (tab === 'inquiries') {
      this.loadInquiries();
    }

    // Brief timeout to allow the skeleton loader to smoothly fade in/out
    setTimeout(() => {
      this.isTabLoading.set(false);
    }, 1000);
  }

  selectCollectionFromSidebar(collection: string) {
    this.selectedCollection.set(collection);
    this.setActiveTab('bookmarks');
    this.scrollToTabs();
  }

  private scrollToTabs() {
    setTimeout(() => {
      const tabsEl = document.getElementById('dashboard-tabs');
      if (tabsEl) {
        tabsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  openDirectoryDrawer(type: 'lawyer' | 'resource' | 'helpline', data: any) {
    this.directoryDrawerType.set(type);
    this.directoryDrawerData.set(data);
    this.directoryDrawerOpen.set(true);
    this.updateScrollLock();
  }

  openQrModal(item: any) {
    this.qrModalItem.set(item);
    this.showQrModal.set(true);
  }

  closeQrModal() {
    this.showQrModal.set(false);
    this.qrModalItem.set(null);
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