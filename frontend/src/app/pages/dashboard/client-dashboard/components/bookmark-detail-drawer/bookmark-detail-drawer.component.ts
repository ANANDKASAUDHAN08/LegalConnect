import { Component, Input, Output, EventEmitter, HostListener, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Bookmark } from '../../../../../services/bookmark.service';
import { FormattingService } from '../../../../../services/formatting.service';
import { DatabaseService } from '../../../../../services/database.service';
import { LegalService } from '../../../../../services/legal.service';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';

@Component({
  selector: 'app-bookmark-detail-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './bookmark-detail-drawer.component.html',
  styleUrls: ['./bookmark-detail-drawer.component.scss']
})
export class BookmarkDetailDrawerComponent implements OnChanges, OnDestroy {
  private _isOpen = false;

  @Input()
  set isOpen(val: boolean) {
    this._isOpen = val;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = val ? 'hidden' : '';
    }
  }
  get isOpen(): boolean {
    return this._isOpen;
  }
  @Input() bookmark: Bookmark | null = null;
  @Input() customCollections: string[] = [];
  @Input() drawerNoteText = '';
  @Input() aiSummary = '';
  @Input() loadingAiSummary = false;

  @Output() closeDrawer = new EventEmitter<void>();
  @Output() copyClicked = new EventEmitter<Bookmark>();
  @Output() folderAssigned = new EventEmitter<{ bookmark: Bookmark, folder: string }>();
  @Output() notesChanged = new EventEmitter<string>();
  @Output() fetchSummaryClicked = new EventEmitter<void>();
  @Output() removeBookmark = new EventEmitter<Bookmark>();

  showFolderSelectDropdown = false;
  latestSection: any = null;
  notesSaveStatus: 'idle' | 'saved' | 'saving' = 'idle';
  private saveStatusTimeout: any = null;

  constructor(
    private formatter: FormattingService,
    private db: DatabaseService,
    private legalService: LegalService,
    private sanitizer: DomSanitizer
  ) {}

  async loadLatestSection() {
    if (!this.bookmark) {
      this.latestSection = null;
      return;
    }
    const shortName = this.bookmark.actShortName;
    const secNum = this.bookmark.section.section_number;

    try {
      const cached = await this.db.getLocalSection(shortName, secNum);
      if (cached && cached.content) {
        this.latestSection = cached;
        return;
      }
    } catch (e) {
      console.warn('Error reading from IndexedDB:', e);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      this.legalService.getSection(shortName, secNum).subscribe({
        next: (res) => {
          if (res && res.data) {
            this.latestSection = res.data;
            this.db.saveLocalSection({
              actShortName: shortName,
              chapterNumber: this.bookmark!.chapterNumber,
              section_number: secNum,
              ...res.data
            }).catch(() => {});
          }
        }
      });
    }
  }

  get formattedContent(): SafeHtml {
    const sec = this.latestSection || this.bookmark?.section;
    if (!sec || !sec.content) return '';
    const healed = this.formatter.healTitleAndContent(sec.title, sec.content);
    const cleaned = this.formatter.cleanSectionContent(healed.content);
    return this.sanitizer.bypassSecurityTrustHtml(this.formatter.formatSectionHtml(cleaned));
  }

  get timeline(): { label: string; details: string; year?: number }[] {
    const sec = this.latestSection || this.bookmark?.section;
    if (!sec || !sec.content) return [];
    return this.formatter.getAmendmentTimeline(
      sec.content,
      this.bookmark!.actShortName
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    // Reset folder dropdown when a new bookmark is loaded
    if (changes['bookmark']) {
      this.showFolderSelectDropdown = false;
      this.notesSaveStatus = 'idle';
      if (this.saveStatusTimeout) {
        clearTimeout(this.saveStatusTimeout);
        this.saveStatusTimeout = null;
      }
      this.loadLatestSection();
    }
  }

  ngOnDestroy() {
    if (this.saveStatusTimeout) {
      clearTimeout(this.saveStatusTimeout);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this._isOpen) {
      this.onClose();
    }
  }

  @HostListener('document:click')
  clickout() {
    this.showFolderSelectDropdown = false;
  }

  /** Words per minute reading estimate */
  get readingTime(): string {
    const content = this.bookmark?.section?.content || '';
    const words = content.trim().split(/\s+/).length;
    const minutes = Math.max(1, Math.round(words / 200));
    return `${minutes} min read`;
  }

  /** Human-readable saved date from timestamp */
  get formattedSavedDate(): string {
    if (!this.bookmark?.savedAt) return '';
    return new Date(this.bookmark.savedAt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  onRemoveBookmark() {
    if (this.bookmark) {
      this.removeBookmark.emit(this.bookmark);
    }
  }

  onClose() {
    this.closeDrawer.emit();
  }

  onCopy() {
    if (this.bookmark) {
      this.copyClicked.emit(this.bookmark);
    }
  }

  toggleFolderDropdown(event: Event) {
    event.stopPropagation();
    this.showFolderSelectDropdown = !this.showFolderSelectDropdown;
  }

  assignFolder(folder: string) {
    if (this.bookmark) {
      this.folderAssigned.emit({ bookmark: this.bookmark, folder });
    }
    this.showFolderSelectDropdown = false;
  }

  onNotesChange(newNotes: string) {
    this.drawerNoteText = newNotes;
    this.notesChanged.emit(newNotes);

    this.notesSaveStatus = 'saving';
    if (this.saveStatusTimeout) {
      clearTimeout(this.saveStatusTimeout);
    }
    this.saveStatusTimeout = setTimeout(() => {
      this.notesSaveStatus = 'saved';
      this.saveStatusTimeout = null;
    }, 1000);
  }

  onFetchSummary() {
    this.fetchSummaryClicked.emit();
  }
}