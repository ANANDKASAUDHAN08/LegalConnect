import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  HostListener,
  signal,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatutoryRight } from '../../../../services/rights.service';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';
import {
  getRightTitle,
  getRightSummary,
  getRightShareUrl,
  getRightShareSubject,
  getRightShareText,
  getRightCitationText,
  getCitationSuccessMessage
} from '../../utils/rights-helpers.util';

@Component({
  selector: 'app-rights-showcase-view',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective, ShareMenuComponent],
  templateUrl: './rights-showcase-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RightsShowcaseViewComponent {
  @Input({ required: true }) rights: StatutoryRight[] = [];
  @Input() currentLanguage: 'en' | 'hi' = 'en';
  @Input() isLoggedIn = false;
  @Input() isLawyerUser = false;
  @Input() isAdminUser = false;
  @Input() isSpeaking = false;
  @Input() speakingRightId: string | null = null;
  @Input() bookmarkedIds: string[] = [];

  @Output() openDetail = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() speak = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() flashPass = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() openNotice = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() share = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() toggleBookmark = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() copyCitation = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() copyScript = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() adminEdit = new EventEmitter<{ rightId: string; event: Event }>();

  copiedRightId = signal<string | null>(null);

  // Keyboard navigation across cards
  focusedCardIndex = signal<number>(-1);

  @HostListener('window:keydown', ['$event'])
  handleKeyboardNav(event: KeyboardEvent): void {
    if (
      document.activeElement?.tagName === 'INPUT' ||
      document.activeElement?.tagName === 'TEXTAREA' ||
      document.activeElement?.getAttribute('role') === 'dialog'
    ) {
      return;
    }

    const rightsList = this.visibleRights();
    if (rightsList.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIdx = Math.min(rightsList.length - 1, this.focusedCardIndex() + 1);
      this.focusedCardIndex.set(nextIdx);
      this.scrollCardIntoView(rightsList[nextIdx].id);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIdx = Math.max(0, this.focusedCardIndex() - 1);
      this.focusedCardIndex.set(prevIdx);
      this.scrollCardIntoView(rightsList[prevIdx].id);
      return;
    }

    if (event.key === 'Enter' && this.focusedCardIndex() >= 0) {
      const activeRight = rightsList[this.focusedCardIndex()];
      if (activeRight) {
        event.preventDefault();
        this.openDetail.emit({ right: activeRight, event });
      }
      return;
    }
  }

  private scrollCardIntoView(id: string): void {
    if (typeof document !== 'undefined') {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  // Progressive loading / virtualization limit to prevent DOM bloat
  visibleLimit = signal<number>(10);

  visibleRights = computed(() => {
    return this.rights.slice(0, this.visibleLimit());
  });

  hasMoreRights = computed(() => {
    return this.rights.length > this.visibleLimit();
  });

  remainingCount = computed(() => {
    return Math.max(0, this.rights.length - this.visibleLimit());
  });

  loadMore(): void {
    this.visibleLimit.update(curr => curr + 10);
  }

  showAll(): void {
    this.visibleLimit.set(this.rights.length);
  }

  onOpenDetail(right: StatutoryRight, event: Event): void {
    this.openDetail.emit({ right, event });
  }

  isBookmarked(id: string): boolean {
    return this.bookmarkedIds.includes(id);
  }

  onToggleBookmark(right: StatutoryRight, event: Event): void {
    this.toggleBookmark.emit({ right, event });
  }

  onFlashPass(right: StatutoryRight, event: Event): void {
    this.flashPass.emit({ right, event });
  }

  onOpenNotice(right: StatutoryRight, event: Event): void {
    this.openNotice.emit({ right, event });
  }

  onShare(right: StatutoryRight, event: Event): void {
    this.share.emit({ right, event });
  }

  onSpeak(right: StatutoryRight, event: Event): void {
    this.speak.emit({ right, event });
  }

  onCopyCitation(right: StatutoryRight, event: Event): void {
    this.copyCitation.emit({ right, event });
    this.copiedRightId.set(right.id);
    setTimeout(() => this.copiedRightId.set(null), 2500);
  }

  onAdminEdit(rightId: string, event: Event): void {
    this.adminEdit.emit({ rightId, event });
  }

  getTitle(right: StatutoryRight): string {
    return getRightTitle(right, this.currentLanguage);
  }

  getSummary(right: StatutoryRight): string {
    return getRightSummary(right, this.currentLanguage);
  }

  getShareUrl(right: StatutoryRight): string {
    return getRightShareUrl(right?.id);
  }

  getShareSubject(right: StatutoryRight): string {
    return getRightShareSubject(right, this.currentLanguage);
  }

  getShareText(right: StatutoryRight): string {
    return getRightShareText(right, this.currentLanguage);
  }

  getCitationText(right: StatutoryRight): string {
    return getRightCitationText(right, true);
  }

  getCitationSuccessMessage(right: StatutoryRight): string {
    return getCitationSuccessMessage(right);
  }

  trackByRightId(_index: number, right: StatutoryRight): string {
    return right.id;
  }
}