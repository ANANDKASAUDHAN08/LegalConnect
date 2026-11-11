import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  HostListener,
  signal,
  computed,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ElementRef,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatutoryRight, StatutoryRightFAQ } from '../../../../services/rights.service';
import { StatuteResolverService } from '../../../../services/statute-resolver.service';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { FocusTrapDirective } from '../../../../directives/focus-trap.directive';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';
import { ModerationReportService } from '../../../../services/moderation-report.service';
import {
  getRightTitle,
  getRightSummary,
  getRightWhatToSay,
  getRightDos,
  getRightDonts,
  getRightShareUrl,
  getRightShareSubject,
  getRightShareText
} from '../../utils/rights-helpers.util';

@Component({
  selector: 'app-right-detail-drawer',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective, FocusTrapDirective, ShareMenuComponent],
  templateUrl: './right-detail-drawer.component.html',
  styleUrls: ['./right-detail-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RightDetailDrawerComponent implements OnInit, OnChanges, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  public statuteResolver = inject(StatuteResolverService);
  private reportService = inject(ModerationReportService);

  @ViewChild('drawerScrollBody') scrollBody?: ElementRef<HTMLDivElement>;

  // Reactive signals for inputs to enable computed dependency tracking
  private _right = signal<StatutoryRight | null>(null);
  private _allRights = signal<StatutoryRight[]>([]);

  @Input({ required: true })
  set right(value: StatutoryRight) {
    this._right.set(value);
    this.cdr.markForCheck();
  }
  get right(): StatutoryRight {
    return this._right()!;
  }

  @Input()
  set allRights(value: StatutoryRight[]) {
    this._allRights.set(value || []);
    this.cdr.markForCheck();
  }
  get allRights(): StatutoryRight[] {
    return this._allRights();
  }

  @Input() currentLanguage: 'en' | 'hi' = 'en';
  @Input() isLoggedIn = false;
  @Input() isLawyerUser = false;
  @Input() isAdminUser = false;
  @Input() isSpeaking = false;
  @Input() speakingRightId: string | null = null;
  @Input() isBookmarked = false;
  @Input() isPrinting = false;

  @Output() close = new EventEmitter<void>();
  @Output() selectRight = new EventEmitter<StatutoryRight>();
  @Output() speak = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() flashPass = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() openNotice = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() share = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() toggleBookmark = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() copyCitation = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() copyScript = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() print = new EventEmitter<{ right: StatutoryRight; event: Event }>();
  @Output() adminEdit = new EventEmitter<{ rightId: string; event: Event }>();

  // Drawer presentation and navigation state
  activeTab = signal<'all' | 'script' | 'protections' | 'steps' | 'penalties' | 'faqs'>('all');
  readingMode = signal<'citizen' | 'lawyer'>('citizen');
  copiedCitation = signal<boolean>(false);
  copiedScript = signal<boolean>(false);
  isClosing = signal<boolean>(false);

  // In-situ localized language toggle (allows toggling without page reload)
  drawerLanguage = signal<'en' | 'hi'>('en');

  // Dynamic font-size legibility zoom (Tier-1 MNC feature: normal, large, xlarge)
  textScale = signal<'normal' | 'large' | 'xlarge'>('normal');

  // Mobile pull-down touch gesture state
  isDragging = signal<boolean>(false);
  dragTranslateY = signal<number>(0);
  private touchStartY = 0;
  private citationTimer?: ReturnType<typeof setTimeout>;
  private scriptTimer?: ReturnType<typeof setTimeout>;
  private closeTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.drawerLanguage.set(this.currentLanguage);
    if (this.isLoggedIn) {
      this.readingMode.set(this.isLawyerUser ? 'lawyer' : 'citizen');
    }
    if (typeof document !== 'undefined') {
      document.body.classList.add('drawer-open');
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentLanguage'] && !changes['currentLanguage'].isFirstChange()) {
      this.drawerLanguage.set(this.currentLanguage);
    }
    // Only update readingMode if user role explicitly changed from parent
    if (changes['isLawyerUser'] && !changes['isLawyerUser'].isFirstChange() && this.isLoggedIn) {
      this.readingMode.set(this.isLawyerUser ? 'lawyer' : 'citizen');
    }
  }

  ngOnDestroy(): void {
    if (this.citationTimer) clearTimeout(this.citationTimer);
    if (this.scriptTimer) clearTimeout(this.scriptTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('drawer-open');
    }
  }

  // Navigation computation based on current list
  currentIndex = computed(() => {
    const r = this._right();
    const list = this._allRights();
    if (!r || !list || list.length === 0) return -1;
    return list.findIndex(item => item.id === r.id);
  });

  totalCount = computed(() => this._allRights().length);

  hasPrevious = computed(() => {
    return this.currentIndex() > 0;
  });

  hasNext = computed(() => {
    const idx = this.currentIndex();
    const len = this._allRights().length;
    return idx >= 0 && idx < len - 1;
  });

  // Safe display numbers for header (avoids confusing "0 / 12" on direct deep links)
  displayPosition = computed(() => {
    const idx = this.currentIndex();
    const count = this.totalCount();
    if (idx === -1) {
      return count > 0 ? `1 / ${count}` : 'Dossier';
    }
    return `${idx + 1} / ${count}`;
  });

  previousRight(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const idx = this.currentIndex();
    const list = this._allRights();
    if (idx > 0) {
      const prev = list[idx - 1];
      if (prev) {
        if (this.activeTab() === 'faqs' && (!prev.frequentlyAskedQuestions || prev.frequentlyAskedQuestions.length === 0)) {
          this.activeTab.set('all');
        }
        this._right.set(prev);
        this.cdr.markForCheck();
        this.selectRight.emit(prev);
        this.scrollToTop();
      }
    }
  }

  nextRight(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const idx = this.currentIndex();
    const list = this._allRights();
    if (idx >= 0 && idx < list.length - 1) {
      const next = list[idx + 1];
      if (next) {
        if (this.activeTab() === 'faqs' && (!next.frequentlyAskedQuestions || next.frequentlyAskedQuestions.length === 0)) {
          this.activeTab.set('all');
        }
        this._right.set(next);
        this.cdr.markForCheck();
        this.selectRight.emit(next);
        this.scrollToTop();
      }
    }
  }

  scrollToTop(): void {
    if (this.scrollBody?.nativeElement) {
      this.scrollBody.nativeElement.scrollTop = 0;
    }
  }

  // Mobile Touch Pull-down handlers
  onTouchStart(e: any): void {
    if (e?.touches && e.touches.length > 0) {
      this.touchStartY = e.touches[0].clientY;
      this.isDragging.set(true);
    }
  }

  onTouchMove(e: any): void {
    if (!this.isDragging()) return;
    const touches = e?.touches;
    if (!touches || touches.length === 0) return;
    const currentY = touches[0].clientY;
    const diff = currentY - this.touchStartY;
    if (diff > 0) {
      this.dragTranslateY.set(Math.min(diff, 200));
    } else {
      this.dragTranslateY.set(0);
    }
  }

  onTouchEnd(): void {
    if (!this.isDragging()) return;
    const finalDiff = this.dragTranslateY();
    this.isDragging.set(false);
    if (finalDiff > 70) {
      this.onClose();
    } else {
      this.dragTranslateY.set(0);
    }
  }

  // Keyboard navigation hardened against browser shortcut collision
  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    const targetTag = (event.target as HTMLElement)?.tagName?.toLowerCase();
    const isContentEditable = (event.target as HTMLElement)?.isContentEditable;
    if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select' || isContentEditable) {
      return;
    }

    // Strictly preserve browser shortcuts (Ctrl+F for find, Ctrl+S for save, Alt/Cmd keys)
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.onClose();
    } else if (event.key === 'ArrowLeft') {
      if (this.hasPrevious()) {
        event.preventDefault();
        this.previousRight(event);
      }
    } else if (event.key === 'ArrowRight') {
      if (this.hasNext()) {
        event.preventDefault();
        this.nextRight(event);
      }
    } else if (event.key === 'f' || event.key === 'F') {
      if (this.right) {
        event.preventDefault();
        this.onFlashPass(event);
      }
    } else if (event.key === 's' || event.key === 'S') {
      if (this.right) {
        event.preventDefault();
        this.onSpeak(event);
      }
    } else if (event.key === 'b' || event.key === 'B') {
      if (this.right) {
        event.preventDefault();
        this.onToggleBookmark(event);
      }
    }
  }

  // Graceful exit animation (220ms reverse bezier before unmount)
  onClose(): void {
    if (this.isClosing()) return;
    this.isClosing.set(true);
    this.closeTimer = setTimeout(() => {
      this.close.emit();
    }, 220);
  }

  setTab(tab: 'all' | 'script' | 'protections' | 'steps' | 'penalties' | 'faqs'): void {
    this.activeTab.set(tab);
  }

  setReadingMode(mode: 'citizen' | 'lawyer'): void {
    this.readingMode.set(mode);
    this.triggerHaptic('light');
  }

  // In-situ language switcher between English and Hindi
  toggleLanguage(): void {
    const nextLang = this.drawerLanguage() === 'en' ? 'hi' : 'en';
    this.drawerLanguage.set(nextLang);
    this.triggerHaptic('light');
  }

  // Text legibility zoom scaler
  cycleTextScale(): void {
    const current = this.textScale();
    if (current === 'normal') this.textScale.set('large');
    else if (current === 'large') this.textScale.set('xlarge');
    else this.textScale.set('normal');
    this.triggerHaptic('light');
  }

  onFlashPass(event: Event): void {
    this.triggerHaptic('medium');
    this.flashPass.emit({ right: this.right, event });
  }

  onSpeak(event: Event): void {
    this.triggerHaptic('light');
    this.speak.emit({ right: this.right, event });
  }

  onOpenNotice(event: Event): void {
    this.triggerHaptic('light');
    this.openNotice.emit({ right: this.right, event });
  }

  onShare(event: Event): void {
    this.triggerHaptic('light');
    this.share.emit({ right: this.right, event });
  }

  onToggleBookmark(event: Event): void {
    this.triggerHaptic('light');
    this.toggleBookmark.emit({ right: this.right, event });
  }

  onPrint(event: Event): void {
    this.triggerHaptic('light');
    this.print.emit({ right: this.right, event });
  }

  onAdminEdit(event: Event): void {
    this.adminEdit.emit({ rightId: this.right.id, event });
  }

  hasReported(): boolean {
    if (!this.right?.id) return false;
    return this.reportService.hasReported('StatutoryRight', this.right.id);
  }

  getReport() {
    if (!this.right?.id) return null;
    return this.reportService.getReport('StatutoryRight', this.right.id);
  }

  onSuggestCorrection(event: Event): void {
    event.stopPropagation();
    if (!this.right) return;
    this.triggerHaptic('light');
    const title = `${this.getTitle()} (${this.right.statutoryBasis?.shortAct || this.right.statutoryBasis?.actName})`;
    this.reportService.openReport('StatutoryRight', this.right.id, title);
  }

  onCopyCitation(event: Event): void {
    this.triggerHaptic('success');
    this.copyCitation.emit({ right: this.right, event });
    this.copiedCitation.set(true);
    if (this.citationTimer) clearTimeout(this.citationTimer);
    this.citationTimer = setTimeout(() => this.copiedCitation.set(false), 2500);
  }

  onCopyScript(event: Event): void {
    this.triggerHaptic('success');
    this.copyScript.emit({ right: this.right, event });
    this.copiedScript.set(true);
    if (this.scriptTimer) clearTimeout(this.scriptTimer);
    this.scriptTimer = setTimeout(() => this.copiedScript.set(false), 2500);
  }

  private triggerHaptic(type: 'light' | 'medium' | 'success' = 'light'): void {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (type === 'light') navigator.vibrate(10);
        else if (type === 'medium') navigator.vibrate(25);
        else if (type === 'success') navigator.vibrate([15, 30, 15]);
      } catch {
        // Ignored on unsupported platforms
      }
    }
  }

  getTitle(): string {
    return getRightTitle(this.right, this.drawerLanguage());
  }

  getSummary(): string {
    return getRightSummary(this.right, this.drawerLanguage());
  }

  getWhatToSay(): string {
    return getRightWhatToSay(this.right, this.drawerLanguage());
  }

  getDos(): string[] {
    return getRightDos(this.right, this.drawerLanguage());
  }

  getDonts(): string[] {
    return getRightDonts(this.right, this.drawerLanguage());
  }

  formatDate(dateStr?: string | Date): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  trackByFaq(_index: number, faq: StatutoryRightFAQ): string {
    return faq.question;
  }

  trackByIndex(index: number): number {
    return index;
  }

  getShareUrl(): string {
    return getRightShareUrl(this.right?.id);
  }

  getShareSubject(): string {
    return getRightShareSubject(this.right, this.drawerLanguage());
  }

  getShareText(): string {
    return getRightShareText(this.right, this.drawerLanguage());
  }

  /**
   * Resolves the internal LegalConnect bare act reader route.
   */
  getActUrl(): string {
    return this.statuteResolver.getActUrl(this.right?.statutoryBasis);
  }

  /**
   * Resolves the section-specific link to navigate straight to the statutory text in our law-viewer.
   */
  getSectionUrl(sec: string): string {
    return this.statuteResolver.getSectionUrl(sec, this.right?.statutoryBasis);
  }

  /**
   * Intercepts section click, performs pre-flight DB existence check,
   * and displays a helpful snackbar if the section is not yet codified.
   */
  onSectionClick(sec: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.statuteResolver.navigateToSectionSafely(sec, this.right?.statutoryBasis);
  }

  /**
   * Intercepts Act click, verifies Bare Act existence in DB, and opens safely.
   */
  onActClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.statuteResolver.navigateToActSafely(this.right?.statutoryBasis);
  }
}