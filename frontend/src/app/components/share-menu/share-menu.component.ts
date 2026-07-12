import {
  Component, Input, HostListener, ElementRef,
  ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, OnDestroy,
  EventEmitter,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { SnackbarService } from '../../services/snackbar.service';

export interface SharePlatform {
  id: 'whatsapp' | 'facebook' | 'twitter' | 'linkedin' | 'telegram' | 'email';
  name: string;
  desktopIconClass: string;
  mobileBgClass: string;
  mobileIconClass: string;
  mobileHoverClass: string;
  svgPath: string;
  isStroke?: boolean;
}

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
  @Input() label = '';
  @Input() description = '';
  @Input() customActionLabel = '';
  @Input() copyLinkLabel = 'Copy Link';
  @Output() customActionClicked = new EventEmitter<MouseEvent>();

  platforms: SharePlatform[] = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      desktopIconClass: 'text-emerald-500',
      mobileBgClass: 'bg-emerald-500 shadow-emerald-500/25',
      mobileIconClass: 'text-white',
      mobileHoverClass: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20',
      svgPath: 'M12.012 2c-5.506 0-9.988 4.482-9.988 9.988 0 1.76.46 3.473 1.334 4.98L2 22l5.176-1.36a9.923 9.923 0 004.836 1.254h.004c5.506 0 9.988-4.482 9.988-9.988C22 6.482 17.518 2 12.012 2zm6.07 14.225c-.252.708-1.46 1.3-2.014 1.386-.48.074-1.1.137-3.26-.725-2.766-1.102-4.553-3.92-4.69-4.103-.137-.184-1.12-1.488-1.12-2.836 0-1.348.704-2.011.956-2.278.252-.266.55-.333.732-.333.184 0 .367.002.53.01.173.007.408-.067.637.49.23.558.78 1.905.848 2.04.068.136.113.292.022.476-.09.183-.136.299-.272.455-.136.156-.285.35-.408.47-.136.13-.278.272-.12.544.156.27.694 1.146 1.486 1.854.78.7 1.432 1.146 1.704 1.282.272.136.43.116.59-.068.156-.184.68-.79.864-1.062.184-.272.367-.224.62-.13.252.095 1.6.756 1.875.892.274.137.458.204.526.32.068.116.068.674-.184 1.382z'
    },
    {
      id: 'facebook',
      name: 'Facebook',
      desktopIconClass: 'text-blue-600',
      mobileBgClass: 'bg-blue-600 shadow-blue-600/25',
      mobileIconClass: 'text-white',
      mobileHoverClass: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
      svgPath: 'M9.101 23.656v-10.74H6.559V9.835h2.542V7.581c0-2.52 1.584-3.893 3.848-3.893 1.086 0 2.018.081 2.29.117v2.652l-1.571.001c-1.222 0-1.459.581-1.459 1.434v1.943h2.951l-.388 3.081h-2.563v10.74h-2.73z'
    },
    {
      id: 'twitter',
      name: 'Twitter / X',
      desktopIconClass: 'text-slate-800 dark:text-white',
      mobileBgClass: 'bg-slate-900 dark:bg-white',
      mobileIconClass: 'text-white dark:text-slate-900',
      mobileHoverClass: 'hover:bg-slate-100 dark:hover:bg-white/5',
      svgPath: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      desktopIconClass: 'text-blue-700',
      mobileBgClass: 'bg-blue-700 shadow-blue-700/25',
      mobileIconClass: 'text-white',
      mobileHoverClass: 'hover:bg-blue-50 dark:hover:bg-blue-950/20',
      svgPath: 'M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z'
    },
    {
      id: 'telegram',
      name: 'Telegram',
      desktopIconClass: 'text-sky-500',
      mobileBgClass: 'bg-sky-500 shadow-sky-500/25',
      mobileIconClass: 'text-white',
      mobileHoverClass: 'hover:bg-sky-50 dark:hover:bg-sky-950/20',
      svgPath: 'M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.47-.52-.17l-9.49 5.96-4.11-1.28c-.9-.28-.91-.9.19-1.33L19.38 3c.75-.28 1.4.17 1.15 1.25l-2.65 12.5c-.2 1-.79 1.25-1.63.78l-4.11-3.03-1.98 1.91c-.22.22-.4.41-.82.41z'
    },
    {
      id: 'email',
      name: 'Email',
      desktopIconClass: 'text-rose-500',
      mobileBgClass: 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/25',
      mobileIconClass: 'text-white',
      mobileHoverClass: 'hover:bg-rose-50 dark:hover:bg-rose-950/20',
      svgPath: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      isStroke: true
    }
  ];

  trackByPlatform(index: number, item: SharePlatform) {
    return item.id;
  }

  showShareDropdown = false;
  private mobileSheetElement: HTMLElement | null = null;
  private desktopDropdownElement: HTMLElement | null = null;
  dropdownStyles: any = {};

  @ViewChild('mobileSheet') set mobileSheet(content: ElementRef<HTMLElement> | undefined) {
    if (content) {
      const el = content.nativeElement;
      if (el && el.parentNode && el.parentNode !== document.body) {
        document.body.appendChild(el);
        this.mobileSheetElement = el;
      }
    }
  }

  @ViewChild('desktopDropdown') set desktopDropdown(content: ElementRef<HTMLElement> | undefined) {
    if (content) {
      const el = content.nativeElement;
      if (el && el.parentNode && el.parentNode !== document.body) {
        document.body.appendChild(el);
        this.desktopDropdownElement = el;
        setTimeout(() => this.calculateDropdownPosition(), 0);
      }
    }
  }

  private scrollListener = () => {
    if (this.showShareDropdown) {
      this.closeShareDropdown();
    }
  };

  constructor(
    private elementRef: ElementRef,
    private snackbar: SnackbarService,
    private cdr: ChangeDetectorRef
  ) {
    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', this.scrollListener, true);
    }
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', this.scrollListener, true);
    }
    this.cleanupElements();
  }

  private cleanupElements() {
    if (this.mobileSheetElement && this.mobileSheetElement.parentNode === document.body) {
      document.body.removeChild(this.mobileSheetElement);
      this.mobileSheetElement = null;
    }
    if (this.desktopDropdownElement && this.desktopDropdownElement.parentNode === document.body) {
      document.body.removeChild(this.desktopDropdownElement);
      this.desktopDropdownElement = null;
    }
  }

  openUpwards = false;

  toggleShareDropdown(event: MouseEvent) {
    event.stopPropagation();

    // Try native sharing directly on mobile if supported
    if (typeof window !== 'undefined' && window.innerWidth < 768 && this.hasNativeShare) {
      this.triggerNativeShare();
      return;
    }

    this.showShareDropdown = !this.showShareDropdown;
    this.updateBodyScroll();
    if (this.showShareDropdown) {
      setTimeout(() => this.calculateDropdownPosition(), 0);
    }
    this.cdr.markForCheck();
  }

  triggerNativeShare() {
    const data = this.getShareData();
    if (navigator.share) {
      navigator.share({
        title: data.subject,
        text: data.text,
        url: data.url
      }).then(() => {
        this.showShareDropdown = false;
        this.cdr.markForCheck();
      }).catch((err) => {
        // Fallback to custom sheet if sharing encounters issues or is cancelled
        this.showShareDropdown = true;
        this.updateBodyScroll();
        this.cdr.markForCheck();
      });
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapePress(event: KeyboardEvent) {
    this.closeShareDropdown();
  }

  private calculateDropdownPosition() {
    if (typeof window === 'undefined') return;
    const el = this.elementRef.nativeElement;
    const rect = el.getBoundingClientRect();
    
    // Measure actual height if rendered, fallback to 360
    const dropdownEl = this.desktopDropdownElement;
    const dropdownHeight = dropdownEl ? dropdownEl.offsetHeight : 320;
    const dropdownWidth = 220;
    
    const spaceBelow = window.innerHeight - rect.bottom;
    
    // Decide direction based on where there is more space
    this.openUpwards = spaceBelow < dropdownHeight && rect.top > dropdownHeight;
    
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    let top = 0;
    let left = rect.right - dropdownWidth + scrollX;
    
    // Keep horizontally within screen bounds
    if (left < 8) left = 8;
    
    if (this.openUpwards) {
      top = rect.top - dropdownHeight - 8 + scrollY;
    } else {
      top = rect.bottom + 8 + scrollY;
    }
    
    this.dropdownStyles = {
      position: 'absolute',
      top: `${top}px`,
      left: `${left}px`,
      width: `${dropdownWidth}px`,
      zIndex: '10000'
    };
    this.cdr.markForCheck();
  }

  closeShareDropdown() {
    if (this.showShareDropdown) {
      this.showShareDropdown = false;
      this.updateBodyScroll();
      this.cleanupElements();
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

  onCustomAction(event: MouseEvent) {
    event.stopPropagation();
    this.customActionClicked.emit(event);
    this.showShareDropdown = false;
    this.updateBodyScroll();
    this.cdr.markForCheck();
  }

  getDisplayUrl(): string {
    const url = this.shareUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (url.includes('google.com/maps')) {
      return 'Google Maps Location';
    }
    return url;
  }
}