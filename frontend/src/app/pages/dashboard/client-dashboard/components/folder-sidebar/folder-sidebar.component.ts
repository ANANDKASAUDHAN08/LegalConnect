import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Bookmark } from '../../../../../services/bookmark.service';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';

@Component({
  selector: 'app-folder-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective],
  templateUrl: './folder-sidebar.component.html',
  styleUrls: ['./folder-sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FolderSidebarComponent {
  @Input() layout: 'desktop' | 'mobile' = 'desktop';
  @Input() selectedCollection = 'All';
  @Input() customCollections: string[] = [];
  @Input() allBookmarks: Bookmark[] = [];
  @Input() unassignedCount = 0;
  @Input() casePacksCount = 0;
  @Input() savedContactsCount = 0;
  @Input() sidebarFolderSearchQuery = '';
  @Input() showMobileFolderSearch = false;
  @Input() activeTab: any = 'bookmarks';

  @Output() selectedCollectionChange = new EventEmitter<string>();
  @Output() sidebarFolderSearchQueryChange = new EventEmitter<string>();
  @Output() showMobileFolderSearchChange = new EventEmitter<boolean>();

  @Output() createNewFolder = new EventEmitter<void>();
  @Output() renameFolder = new EventEmitter<string>();
  @Output() deleteFolder = new EventEmitter<string>();
  @Output() shareFolder = new EventEmitter<string>();
  @Output() selectCasePacks = new EventEmitter<void>();
  @Output() selectSavedContacts = new EventEmitter<void>();

  selectCasePacksSystemDirectory() {
    this.selectCasePacks.emit();
  }

  selectSavedContactsSystemDirectory() {
    this.selectSavedContacts.emit();
  }

  get filteredSidebarFolders(): string[] {
    if (!this.sidebarFolderSearchQuery || !this.sidebarFolderSearchQuery.trim()) {
      return this.customCollections;
    }
    const query = this.sidebarFolderSearchQuery.toLowerCase().trim();
    return this.customCollections.filter(c => c.toLowerCase().includes(query));
  }

  getFolderCount(folderName: string): number {
    return this.allBookmarks.filter(b => b.collectionName === folderName).length;
  }

  selectCollection(folder: string) {
    this.selectedCollection = folder;
    this.selectedCollectionChange.emit(folder);
  }

  onSearchQueryChange(val: string) {
    this.sidebarFolderSearchQuery = val;
    this.sidebarFolderSearchQueryChange.emit(val);
  }

  toggleMobileFolderSearch(val: boolean) {
    this.showMobileFolderSearch = val;
    this.showMobileFolderSearchChange.emit(val);
  }

  onCreateNewFolder() {
    this.createNewFolder.emit();
  }

  onRenameFolder(folder: string, event: Event) {
    event.stopPropagation();
    this.renameFolder.emit(folder);
  }

  onDeleteFolder(folder: string, event: Event) {
    event.stopPropagation();
    this.deleteFolder.emit(folder);
  }

  trackByFolder(index: number, item: string): string {
    return item;
  }
}
