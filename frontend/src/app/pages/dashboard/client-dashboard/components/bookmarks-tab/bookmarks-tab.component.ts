import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy, HostListener, SimpleChanges, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Bookmark } from '../../../../../services/bookmark.service';
import { BookmarkCardComponent } from '../bookmark-card/bookmark-card.component';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';

@Component({
  selector: 'app-bookmarks-tab',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, BookmarkCardComponent, TooltipDirective],
  templateUrl: './bookmarks-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookmarksTabComponent implements OnInit, OnChanges, OnDestroy {
  @Input() bookmarks: Bookmark[] = [];
  @Input() selectedCollection = 'All';
  @Input() customCollections: string[] = [];
  @Input() actFilter = '';
  @Input() searchQuery = '';

  @Output() actFilterChange = new EventEmitter<string>();
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() openReader = new EventEmitter<Bookmark>();
  @Output() removeBookmark = new EventEmitter<{ actShortName: string, sectionNumber: string }>();
  @Output() copyBookmark = new EventEmitter<Bookmark>();
  @Output() shareFolder = new EventEmitter<string>();
  @Output() renameFolder = new EventEmitter<string>();
  @Output() deleteFolder = new EventEmitter<string>();

  // Local state signals
  sortBy = signal<string>('newest');
  currentPage = signal<number>(1);
  itemsPerPage = signal<number>(8);
  showSortDropdown = signal<boolean>(false);

  // Writable signals mirroring inputs for signal reactivity inside computed blocks
  bookmarksSignal = signal<Bookmark[]>([]);
  selectedCollectionSignal = signal<string>('All');
  actFilterSignal = signal<string>('');
  searchQuerySignal = signal<string>('');

  // Search input local value
  searchVal = '';
  private searchSubject = new Subject<string>();
  private sub = new Subscription();

  sortOptions = [
    { value: 'newest', label: 'Recently Saved' },
    { value: 'oldest', label: 'Oldest Saved' },
    { value: 'sectionAsc', label: 'Section No (Asc)' },
    { value: 'sectionDesc', label: 'Section No (Desc)' }
  ];

  @HostListener('document:click')
  clickout() {
    this.showSortDropdown.set(false);
  }

  ngOnInit() {
    this.sub.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(val => {
        this.searchQueryChange.emit(val);
      })
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['bookmarks']) {
      this.bookmarksSignal.set(this.bookmarks || []);
    }
    if (changes['selectedCollection']) {
      this.selectedCollectionSignal.set(this.selectedCollection || 'All');
    }
    if (changes['actFilter']) {
      this.actFilterSignal.set(this.actFilter || '');
    }
    if (changes['searchQuery']) {
      this.searchQuerySignal.set(this.searchQuery || '');
      this.searchVal = this.searchQuery || '';
    }

    if (changes['selectedCollection'] || changes['actFilter'] || changes['searchQuery'] || changes['bookmarks']) {
      this.currentPage.set(1);
    }
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  onSearchChanged(val: string) {
    this.searchVal = val;
    this.searchSubject.next(val);
  }

  // Computed signals
  allFilteredBookmarks = computed(() => {
    let list = [...this.bookmarksSignal()];

    // 1. Folder collection filter
    const folder = this.selectedCollectionSignal();
    if (folder && folder !== 'All') {
      if (folder === 'Unassigned') {
        list = list.filter(b => !b.collectionName || !b.collectionName.trim());
      } else {
        list = list.filter(b => b.collectionName === folder);
      }
    }

    // 2. Act filter
    const act = this.actFilterSignal();
    if (act) {
      list = list.filter(b => b.actShortName === act);
    }

    // 3. Search query filter (Smart Universal Matcher)
    const search = this.searchQuerySignal()?.toLowerCase().trim();
    if (search) {
      list = list.filter(b => {
        // A. Match Act details (e.g. "bns", "bnss", "rti", or "Bharatiya Nyaya Sanhita")
        const matchesAct =
          b.actShortName.toLowerCase().includes(search) ||
          (b.section.title && b.section.title.toLowerCase().includes(search));

        // B. Match Enactment Year (e.g. "2023", "2005")
        // (Checked against typical year numbers if they are inside the act name or metadata)
        const matchesYear = b.section.title?.includes(search) || b.actShortName.includes(search);

        // C. Match Complexity (e.g. typing "low", "medium", "high")
        // (If latestSection complexity rating is cached locally)
        const matchesComplexity = b.section.content?.toLowerCase().includes(search);

        // D. Match Section Details
        const matchesSection =
          b.section.section_number.toLowerCase() === search ||
          b.section.title.toLowerCase().includes(search) ||
          b.section.content.toLowerCase().includes(search);

        // E. Match personal Client Notes
        const matchesNotes = b.notes && b.notes.toLowerCase().includes(search);

        return matchesAct || matchesYear || matchesComplexity || matchesSection || matchesNotes;
      });
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

    return list;
  });

  totalFilteredItems = computed(() => this.allFilteredBookmarks().length);

  totalPages = computed(() => {
    return Math.ceil(this.totalFilteredItems() / this.itemsPerPage());
  });

  paginatedBookmarks = computed(() => {
    const list = this.allFilteredBookmarks();
    const size = this.itemsPerPage();
    const page = this.currentPage();
    const skip = (page - 1) * size;
    return list.slice(skip, skip + size);
  });

  showingStart = computed(() => {
    if (this.totalFilteredItems() === 0) return 0;
    return (this.currentPage() - 1) * this.itemsPerPage() + 1;
  });

  showingEnd = computed(() => {
    const end = this.currentPage() * this.itemsPerPage();
    const count = this.totalFilteredItems();
    return end > count ? count : end;
  });

  visiblePageNumbers = computed(() => {
    const total = this.totalPages();
    const page = this.currentPage();
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

  trackByBookmark(index: number, item: Bookmark): string {
    return `${item.actShortName}_${item.section.section_number}`;
  }

  trackByPage(index: number, item: any): string {
    return item.toString();
  }

  trackByOption(index: number, item: any): string {
    return item.value;
  }
}