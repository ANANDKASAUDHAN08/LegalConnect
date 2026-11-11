import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  HostListener,
  signal,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../../../../components/icon/icon.component';
import { TooltipDirective } from '../../../../directives/tooltip.directive';
import { StatutoryRight } from '../../../../services/rights.service';
import { StatuteResolverService } from '../../../../services/statute-resolver.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { ShareMenuComponent } from '../../../../components/share-menu/share-menu.component';
import {
  getRightTitle,
  getRightWhatToSay,
  getRightShareUrl,
  getRightShareSubject,
  getRightShareText
} from '../../utils/rights-helpers.util';

@Component({
  selector: 'app-legal-pass-modal',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective, ShareMenuComponent],
  templateUrl: './legal-pass-modal.component.html',
  styleUrls: ['./legal-pass-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LegalPassModalComponent implements OnInit, OnChanges, OnDestroy {
  private statuteResolver = inject(StatuteResolverService);
  private snackbar = inject(SnackbarService);

  @Input({ required: true }) pass!: StatutoryRight;
  @Input() isPrinting = false;
  @Input() currentLanguage: 'en' | 'hi' = 'en';

  @Output() close = new EventEmitter<void>();
  @Output() print = new EventEmitter<void>();

  // In-situ language toggle
  modalLanguage = signal<'en' | 'hi'>('en');

  // Copy feedback states
  copiedScript = signal<boolean>(false);
  copiedShare = signal<boolean>(false);

  // Smooth exit state
  isClosing = signal<boolean>(false);

  // Mobile pull-down swipe to dismiss
  isDragging = signal<boolean>(false);
  dragTranslateY = signal<number>(0);
  private touchStartY = 0;

  private copyTimer?: ReturnType<typeof setTimeout>;
  private shareTimer?: ReturnType<typeof setTimeout>;
  private closeTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.modalLanguage.set(this.currentLanguage);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentLanguage'] && !changes['currentLanguage'].isFirstChange()) {
      this.modalLanguage.set(this.currentLanguage);
    }
  }

  ngOnDestroy(): void {
    if (this.copyTimer) clearTimeout(this.copyTimer);
    if (this.shareTimer) clearTimeout(this.shareTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
  }

  @HostListener('window:keydown.escape', ['$event'])
  onEscape(event: KeyboardEvent): void {
    event.preventDefault();
    this.onClose();
  }

  onClose(): void {
    if (this.isClosing()) return;
    this.isClosing.set(true);
    this.closeTimer = setTimeout(() => {
      this.close.emit();
    }, 200);
  }

  onPrint(): void {
    this.triggerHaptic('light');
    this.print.emit();
  }

  toggleLanguage(): void {
    this.triggerHaptic('light');
    this.modalLanguage.set(this.modalLanguage() === 'en' ? 'hi' : 'en');
  }

  onCopyScript(event: Event): void {
    event.stopPropagation();
    this.triggerHaptic('success');
    const text = this.getWhatToSay();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.copiedScript.set(true);
      this.snackbar.show('Confrontation script copied to clipboard!', 'success', 2500);
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.copiedScript.set(false), 2200);
    }
  }

  onShare(event: Event): void {
    event.stopPropagation();
    this.triggerHaptic('light');
    const title = this.getTitle();
    const act = this.pass.statutoryBasis ? `\nStatute: ${this.pass.statutoryBasis.actName} (${(this.pass.statutoryBasis.sections || []).join(', ')})` : '';
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/rights?detail=${this.pass.id}` : `/rights?detail=${this.pass.id}`;
    const text = `Citizen Statutory Defense Pass: ${title}${act}\nVerified Authority Directive:\n"${this.getWhatToSay()}"\nOfficial Verification: ${shareUrl}`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title, text, url: shareUrl }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.copiedShare.set(true);
      this.snackbar.show('Digital Legal Pass details copied to clipboard!', 'success', 2500);
      if (this.shareTimer) clearTimeout(this.shareTimer);
      this.shareTimer = setTimeout(() => this.copiedShare.set(false), 2200);
    }
  }

  // Mobile Touch Handlers
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
      this.dragTranslateY.set(Math.min(diff, 180));
    } else {
      this.dragTranslateY.set(0);
    }
  }

  onTouchEnd(): void {
    if (!this.isDragging()) return;
    const diff = this.dragTranslateY();
    this.isDragging.set(false);
    if (diff > 65) {
      this.onClose();
    } else {
      this.dragTranslateY.set(0);
    }
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
    return getRightTitle(this.pass, this.modalLanguage());
  }

  getWhatToSay(): string {
    return getRightWhatToSay(this.pass, this.modalLanguage());
  }

  trackByString(_index: number, item: string): string {
    return item;
  }

  trackByIndex(index: number): number {
    return index;
  }

  getActUrl(): string {
    return this.statuteResolver.getActUrl(this.pass?.statutoryBasis);
  }

  getSectionUrl(sec: string): string {
    return this.statuteResolver.getSectionUrl(sec, this.pass?.statutoryBasis);
  }

  onSectionClick(sec: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.statuteResolver.navigateToSectionSafely(sec, this.pass?.statutoryBasis);
  }

  onActClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.statuteResolver.navigateToActSafely(this.pass?.statutoryBasis);
  }

  getShareUrl(): string {
    return getRightShareUrl(this.pass?.id);
  }

  getShareSubject(): string {
    if (!this.pass) return 'Citizen Statutory Defense Pass';
    return `${this.getTitle()} | Statutory Defense Pass`;
  }

  getShareText(): string {
    return getRightShareText(this.pass, this.modalLanguage(), {
      prefix: 'Citizen Statutory Defense Pass:',
      includeDirective: true
    });
  }
}