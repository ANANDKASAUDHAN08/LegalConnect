import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Bookmark } from '../../../../../services/bookmark.service';
import { TooltipDirective } from '../../../../../directives/tooltip.directive';
import { ShareMenuComponent } from '../../../../../components/share-menu/share-menu.component';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { DatabaseService } from '../../../../../services/database.service';
import { LegalService } from '../../../../../services/legal.service';

@Component({
  selector: 'app-bookmark-card',
  standalone: true,
  imports: [CommonModule, TooltipDirective, ShareMenuComponent],
  templateUrl: './bookmark-card.component.html',
  styleUrls: ['./bookmark-card.component.scss']
})
export class BookmarkCardComponent implements OnInit {
  @Input() bookmark!: Bookmark;
  @Input() searchQuery = '';

  @Output() cardClicked = new EventEmitter<Bookmark>();
  @Output() removeClicked = new EventEmitter<{ actShortName: string, sectionNumber: string }>();
  @Output() copyClicked = new EventEmitter<Bookmark>();

  latestSection: any = null;

  constructor(
    private snackbarService: SnackbarService,
    private db: DatabaseService,
    private legalService: LegalService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
  ) {}

  actHue = 215;

  ngOnInit() {
    this.actHue = this.getActHue(this.bookmark?.actShortName);
    this.loadLatestSection();
  }

  async loadLatestSection() {
    if (!this.bookmark) return;
    const shortName = this.bookmark.actShortName;
    const secNum = this.bookmark.section.section_number;

    try {
      const cached = await this.db.getLocalSection(shortName, secNum);
      if (cached && cached.content && cached.criminalDetails) {
        this.latestSection = cached;
        this.cdr.markForCheck();
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
            this.cdr.markForCheck();
            this.db.saveLocalSection({
              actShortName: shortName,
              chapterNumber: this.bookmark.chapterNumber,
              section_number: secNum,
              ...res.data
            }).catch(() => {});
          }
        }
      });
    }
  }

  onCardClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest('app-share-menu') || target.closest('button') || target.closest('a')) {
      return;
    }
    this.cardClicked.emit(this.bookmark);
  }

  onRemove(event: Event) {
    event.stopPropagation();
    this.removeClicked.emit({
      actShortName: this.bookmark.actShortName,
      sectionNumber: this.bookmark.section.section_number
    });
  }

  onCopy(event: Event) {
    event.stopPropagation();
    this.copyClicked.emit(this.bookmark);
  }

  copyAdvocateFormat() {
    const bm = this.bookmark;
    let text = `📖 Legal Reference: S. ${bm.section.section_number} - ${bm.section.title}\n`;
    text += `----------------------------------------------\n`;
    text += `📜 Law: ${bm.actShortName}\n`;
    text += `💡 Excerpt: "${bm.section.content}"\n`;
    if (bm.notes) {
      text += `📝 My Notes: ${bm.notes}\n`;
    }
    const shareUrl = this.getShareUrl();
    if (shareUrl) {
      text += `🔗 Read Full: ${shareUrl}\n`;
    }
    text += `\nShared via LegalConnect Research Library`;

    navigator.clipboard.writeText(text).then(() => {
      this.snackbarService.show(`Formatted citation and notes copied to clipboard for your advocate.`, 'success');
    }).catch(() => {
      this.snackbarService.show('Failed to copy text.', 'error');
    });
  }

  getShareUrl(): string {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/laws/${this.bookmark.actShortName}#sec-${this.bookmark.section.section_number}`;
    }
    return '';
  }

  getShareSubject(): string {
    return `${this.bookmark.actShortName} — Sec. ${this.bookmark.section.section_number}`;
  }

  getShareText(): string {
    return `Read Section ${this.bookmark.section.section_number} of ${this.bookmark.actShortName}: ${this.bookmark.section.title}`;
  }

  getActHue(actShortName: string): number {
    if (!actShortName) return 215;
    let hash = 0;
    for (let i = 0; i < actShortName.length; i++) {
      hash = actShortName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  }

  highlightText(text: string, query: string): SafeHtml {
    if (!text) return '';
    if (!query || !query.trim()) return text;

    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const highlighted = text.replace(regex, '<mark class="bg-amber-500/25 dark:bg-amber-500/35 text-amber-950 dark:text-amber-300 rounded px-0.5 border border-amber-500/20 font-bold">$1</mark>');
    return this.sanitizer.bypassSecurityTrustHtml(highlighted);
  }
}
