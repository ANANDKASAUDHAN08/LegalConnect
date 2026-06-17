import {
  Component, Input, HostListener, ElementRef,
  ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { SnackbarService } from '../../services/snackbar.service';

@Component({
  selector: 'app-share-menu',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './share-menu.component.html',
  styleUrls: ['./share-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShareMenuComponent implements OnDestroy {
  @Input() shareUrl?: string;
  @Input() title?: string;
  @Input() text?: string;
  @Input() subject?: string;
  @Input() buttonClass = '';
  @Input() tooltipText = 'Share';
  @Input() tooltipPlacement: 'top' | 'bottom' | 'left' | 'right' = 'top';
  @Input() iconClass = 'w-3.5 h-3.5';

  showShareDropdown = false;
  private mobileSheetElement: HTMLElement | null = null;

  @ViewChild('mobileSheet') set mobileSheet(content: ElementRef<HTMLElement> | undefined) {
    if (content) {
      const el = content.nativeElement;
      if (el && el.parentNode && el.parentNode !== document.body) {
        document.body.appendChild(el);
        this.mobileSheetElement = el;
      }
    }
  }

  constructor(
    private elementRef: ElementRef,
    private snackbar: SnackbarService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnDestroy() {
    this.cleanupMobileSheet();
  }

  private cleanupMobileSheet() {
    if (this.mobileSheetElement && this.mobileSheetElement.parentNode === document.body) {
      document.body.removeChild(this.mobileSheetElement);
      this.mobileSheetElement = null;
    }
  }

  toggleShareDropdown(event: MouseEvent) {
    event.stopPropagation();
    this.showShareDropdown = !this.showShareDropdown;
    this.updateBodyScroll();
    this.cdr.markForCheck();
  }

  closeShareDropdown() {
    if (this.showShareDropdown) {
      this.showShareDropdown = false;
      this.updateBodyScroll();
      this.cleanupMobileSheet();
      this.cdr.markForCheck();
    }
  }

  private updateBodyScroll() {
    if (typeof document !== 'undefined' && typeof window !== 'undefined') {
      if (this.showShareDropdown && window.innerWidth < 768) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      if (this.showShareDropdown) {
        this.showShareDropdown = false;
        this.updateBodyScroll();
        this.cdr.markForCheck();
      }
    }
  }

  getShareData() {
    const url = this.shareUrl || (typeof window !== 'undefined' ? window.location.href : '');
    const title = this.title || 'LegalConnect';
    const text = this.text || 'Check out this page on LegalConnect:';
    const subject = this.subject || title;

    return {
      url,
      subject,
      text,
      fullText: `${text}\n${url}`
    };
  }

  shareTo(platform: string) {
    const data = this.getShareData();
    let shareUrl = '';

    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(data.fullText)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.url)}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(data.url)}`;
        break;
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.fullText)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(data.url).then(() => {
          this.snackbar.show('Link copied to clipboard');
        }).catch(() => {
          this.snackbar.show('Could not copy link');
        });
        break;
      case 'native':
        if (navigator.share) {
          navigator.share({
            title: data.subject,
            text: data.text,
            url: data.url
          }).catch(() => { });
        }
        break;
    }

    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }

    this.showShareDropdown = false;
    this.updateBodyScroll();
    this.cdr.markForCheck();
  }

  get hasNativeShare(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.share;
  }
}