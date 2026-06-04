import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookmarkService, Bookmark } from '../../services/bookmark.service';
import { AuthService } from '../../services/auth.service';
import { Section } from '../../services/legal.service';

@Component({
  selector: 'app-bookmark-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bookmark-modal.component.html',
  styleUrls: ['./bookmark-modal.component.scss']
})
export class BookmarkModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isOpen = false;
  @Input() actShortName = '';
  @Input() chapterNumber = '';
  @Input() section: Section | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  notesText = '';
  selectedFolder = 'Unassigned';
  newFolderName = '';
  showNewFolderInput = false;

  // Custom dropdown states
  showFolderDropdown = false;
  folderSearchQuery = '';

  customCollections: string[] = [];
  currentUserEmail = 'guest';
  isBookmarked = false;
  existingBookmark: Bookmark | null = null;
  allBookmarks: Bookmark[] = [];

  @HostListener('document:click')
  onDocumentClick() {
    this.showFolderDropdown = false;
  }

  toggleDropdown(event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    this.showFolderDropdown = !this.showFolderDropdown;
    if (this.showFolderDropdown) {
      this.folderSearchQuery = '';
    }
  }

  get filteredFolders(): string[] {
    if (!this.folderSearchQuery || !this.folderSearchQuery.trim()) {
      return this.customCollections;
    }
    const query = this.folderSearchQuery.toLowerCase().trim();
    return this.customCollections.filter(f => f.toLowerCase().includes(query));
  }

  constructor(
    public bookmarkService: BookmarkService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.bookmarkService.bookmarks$.subscribe(bms => {
      this.allBookmarks = bms;
      if (this.isOpen) {
        this.initializeState();
      }
    });
    this.authService.currentUser$.subscribe(user => {
      this.currentUserEmail = user ? user.email : 'guest';
      this.loadCustomCollections();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['isOpen']) {
      this.toggleBodyScroll(this.isOpen);
      if (this.isOpen) {
        this.initializeState();
      }
    }
  }

  ngOnDestroy() {
    this.toggleBodyScroll(false);
  }

  toggleBodyScroll(disable: boolean) {
    if (disable) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }

  loadCustomCollections() {
    const key = `legalconnect_custom_folders_${this.currentUserEmail}`;
    const saved = localStorage.getItem(key);
    this.customCollections = saved ? JSON.parse(saved) : [];
  }

  initializeState() {
    if (!this.section) return;

    // Reset state
    this.notesText = '';
    this.selectedFolder = 'Unassigned';
    this.newFolderName = '';
    this.showNewFolderInput = false;
    this.showFolderDropdown = false;
    this.folderSearchQuery = '';
    this.loadCustomCollections();

    // Check if section is already bookmarked
    this.existingBookmark = this.allBookmarks.find(
      (b: Bookmark) => b.actShortName === this.actShortName && b.section.section_number === this.section!.section_number
    ) || null;

    this.isBookmarked = !!this.existingBookmark;

    if (this.existingBookmark) {
      this.notesText = this.existingBookmark.notes || '';
      this.selectedFolder = this.existingBookmark.collectionName || 'Unassigned';
    } else {
      // Default to sticky folder if set in session
      const sessionSticky = sessionStorage.getItem('legalconnect_sticky_folder');
      if (sessionSticky && (sessionSticky === 'Unassigned' || this.customCollections.includes(sessionSticky))) {
        this.selectedFolder = sessionSticky;
      }
    }
  }

  createFolder() {
    const folder = this.newFolderName.trim();
    if (!folder) return;

    if (!this.customCollections.includes(folder)) {
      this.customCollections.push(folder);
      this.customCollections.sort();
      const key = `legalconnect_custom_folders_${this.currentUserEmail}`;
      localStorage.setItem(key, JSON.stringify(this.customCollections));
    }

    this.selectedFolder = folder;
    this.newFolderName = '';
    this.showNewFolderInput = false;
  }

  save() {
    if (!this.section) return;

    const folder = this.selectedFolder === 'Unassigned' ? undefined : this.selectedFolder;

    // Save sticky folder in session
    sessionStorage.setItem('legalconnect_sticky_folder', this.selectedFolder);

    if (this.isBookmarked) {
      // Update existing bookmark notes and folder
      this.bookmarkService.updateBookmarkMetadata(
        this.actShortName,
        this.section.section_number,
        this.notesText,
        folder
      );
    } else {
      // Add new bookmark
      this.bookmarkService.addBookmark(
        this.actShortName,
        this.chapterNumber,
        this.section,
        folder
      );
      
      // Save notes if any notes are entered
      if (this.notesText && this.notesText.trim()) {
        setTimeout(() => {
          this.bookmarkService.updateBookmarkMetadata(
            this.actShortName,
            this.section!.section_number,
            this.notesText,
            folder
          );
        }, 300);
      }
    }

    this.saved.emit();
    this.closeModal();
  }

  remove() {
    if (!this.section) return;
    this.bookmarkService.removeBookmark(this.actShortName, this.section.section_number);
    this.saved.emit();
    this.closeModal();
  }

  closeModal() {
    this.isOpen = false;
    this.toggleBodyScroll(false);
    this.close.emit();
  }
}
