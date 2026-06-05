import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Bookmark } from '../../../../../services/bookmark.service';

@Component({
  selector: 'app-bookmark-detail-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bookmark-detail-drawer.component.html',
  styleUrls: ['./bookmark-detail-drawer.component.scss']
})
export class BookmarkDetailDrawerComponent {
  @Input() isOpen = false;
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

  showFolderSelectDropdown = false;

  @HostListener('document:click')
  clickout() {
    this.showFolderSelectDropdown = false;
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
  }

  onFetchSummary() {
    this.fetchSummaryClicked.emit();
  }
}
