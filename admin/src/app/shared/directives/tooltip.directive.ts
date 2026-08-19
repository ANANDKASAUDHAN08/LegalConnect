import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  Renderer2
} from '@angular/core';

@Directive({
  selector: '[adminTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  @Input('adminTooltip') tooltipText = '';
  @Input() tooltipPosition: 'top' | 'bottom' | 'left' | 'right' = 'top';
  @Input() tooltipDelay = 150; // ms delay before showing

  private tooltipElement: HTMLElement | null = null;
  private showTimeout: any = null;
  private scrollListener: (() => void) | null = null;

  constructor(private el: ElementRef, private renderer: Renderer2) { }

  ngOnInit(): void {
    this.scrollListener = () => {
      if (this.tooltipElement || this.showTimeout) {
        this.clearTimer();
        this.removeTooltip();
      }
    };
    window.addEventListener('scroll', this.scrollListener, true);
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (!this.tooltipText) return;
    this.clearTimer();
    this.showTimeout = setTimeout(() => {
      this.createTooltip();
    }, this.tooltipDelay);
  }

  @HostListener('mouseleave')
  @HostListener('click')
  onMouseLeave(): void {
    this.clearTimer();
    this.removeTooltip();
  }

  private clearTimer(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }
  }

  private createTooltip(): void {
    this.removeTooltip(); // Ensure no duplicates
    const activeTooltips = document.querySelectorAll('.admin-custom-tooltip');
    activeTooltips.forEach(t => t.remove());

    this.tooltipElement = this.renderer.createElement('div');
    const textSpan = this.renderer.createElement('span');
    this.renderer.appendChild(textSpan, this.renderer.createText(this.tooltipText));
    this.renderer.appendChild(this.tooltipElement, textSpan);

    this.renderer.addClass(this.tooltipElement, 'admin-custom-tooltip');
    this.renderer.addClass(this.tooltipElement, `tooltip-${this.tooltipPosition}`);
    this.renderer.appendChild(document.body, this.tooltipElement);

    const hostPos = this.el.nativeElement.getBoundingClientRect();
    const tooltipPos = this.tooltipElement!.getBoundingClientRect();

    let top = 0;
    let left = 0;
    let effectivePosition = this.tooltipPosition;

    switch (this.tooltipPosition) {
      case 'top':
        top = hostPos.top - tooltipPos.height - 8;
        left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
        break;
      case 'bottom':
        top = hostPos.bottom + 8;
        left = hostPos.left + (hostPos.width - tooltipPos.width) / 2;
        break;
      case 'left':
        top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.left - tooltipPos.width - 8;
        break;
      case 'right':
        top = hostPos.top + (hostPos.height - tooltipPos.height) / 2;
        left = hostPos.right + 8;
        break;
    }

    // Viewport Boundary Protection (Prevent Clipping)
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Horizontal Flip Protection for left/right positions
    if (this.tooltipPosition === 'right' && hostPos.right + tooltipPos.width + 8 > viewportWidth - margin) {
      left = hostPos.left - tooltipPos.width - 8;
      effectivePosition = 'left';
    } else if (this.tooltipPosition === 'left' && hostPos.left - tooltipPos.width - 8 < margin) {
      left = hostPos.right + 8;
      effectivePosition = 'right';
    }

    if (left + tooltipPos.width > viewportWidth - margin) {
      left = viewportWidth - tooltipPos.width - margin;
    }
    if (left < margin) {
      left = margin;
    }

    // Vertical Flip Protection for top/bottom positions
    if (top < margin && (this.tooltipPosition === 'top' || this.tooltipPosition === 'bottom')) {
      top = hostPos.bottom + 8;
      effectivePosition = 'bottom';
    } else if (top + tooltipPos.height > viewportHeight - margin && (this.tooltipPosition === 'top' || this.tooltipPosition === 'bottom')) {
      top = hostPos.top - tooltipPos.height - 8;
      effectivePosition = 'top';
    }

    if (top < margin) {
      top = margin;
    } else if (top + tooltipPos.height > viewportHeight - margin) {
      top = viewportHeight - tooltipPos.height - margin;
    }

    if (effectivePosition !== this.tooltipPosition) {
      this.renderer.removeClass(this.tooltipElement, `tooltip-${this.tooltipPosition}`);
      this.renderer.addClass(this.tooltipElement, `tooltip-${effectivePosition}`);
    }

    // Dynamic arrow alignment relative to the hovered element's center
    const targetCenterX = hostPos.left + hostPos.width / 2;
    const arrowLeft = Math.max(14, Math.min(tooltipPos.width - 14, targetCenterX - left));
    this.renderer.setStyle(this.tooltipElement, '--arrow-left', `${arrowLeft}px`);

    const targetCenterY = hostPos.top + hostPos.height / 2;
    const arrowTop = Math.max(10, Math.min(tooltipPos.height - 10, targetCenterY - top));
    this.renderer.setStyle(this.tooltipElement, '--arrow-top', `${arrowTop}px`);

    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'top', `${Math.round(top)}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${Math.round(left)}px`);
    this.renderer.setStyle(this.tooltipElement, 'z-index', '99999');
  }

  private removeTooltip(): void {
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.removeTooltip();
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, true);
    }
  }
}