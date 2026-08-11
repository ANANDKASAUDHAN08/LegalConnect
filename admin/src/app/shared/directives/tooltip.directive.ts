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

  constructor(private el: ElementRef, private renderer: Renderer2) { }

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
  @HostListener('window:scroll')
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

    if (left + tooltipPos.width > viewportWidth - margin) {
      left = viewportWidth - tooltipPos.width - margin;
    }
    if (left < margin) {
      left = margin;
    }
    if (top < margin) {
      top = hostPos.bottom + 8;
    }
    if (top + tooltipPos.height > viewportHeight - margin) {
      top = hostPos.top - tooltipPos.height - 8;
    }

    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
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
  }
}