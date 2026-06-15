import { Directive, Input, ElementRef, Renderer2, HostListener, OnDestroy, inject, NgZone } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') tooltipText = '';
  @Input() tooltipPlacement: 'top' | 'bottom' | 'left' | 'right' = 'top';

  private tooltipEl: HTMLElement | null = null;
  private active = false;

  private el = inject(ElementRef);
  private renderer = inject(Renderer2);
  private zone = inject(NgZone);

  @HostListener('mouseenter')
  onMouseEnter() {
    this.show();
  }

  @HostListener('mouseleave')
  onMouseLeave() {
    this.hide();
  }

  @HostListener('focusin')
  onFocusIn() {
    this.show();
  }

  @HostListener('focusout')
  onFocusOut() {
    this.hide();
  }

  @HostListener('click')
  onClick() {
    this.hide();
  }

  private onWindowScrollBound = () => {
    this.zone.run(() => {
      this.destroyTooltip();
    });
  };

  private onWindowResizeBound = () => {
    this.zone.run(() => {
      this.destroyTooltip();
    });
  };

  ngOnDestroy() {
    this.destroyTooltip();
  }

  private show() {
    if (typeof document === 'undefined' || !this.tooltipText || !this.tooltipText.trim() || this.active) return;
    this.active = true;

    // Create tooltip element
    this.tooltipEl = this.renderer.createElement('div');
    this.renderer.appendChild(this.tooltipEl, this.renderer.createText(this.tooltipText));

    // Tailwind classes for premium UI tooltip design
    const classes = [
      'fixed', 'z-[9999]', 'pointer-events-none', 'px-2.5', 'py-1', 
      'text-[11px]', 'font-medium', 'rounded-md', 'shadow-md', 
      'border', 'bg-white', 'text-slate-800', 'border-slate-200/90',
      'dark:bg-slate-950', 'dark:text-slate-200', 'dark:border-slate-800/95',
      'opacity-0', 'transition-all', 'duration-150', 'ease-out', 'transform'
    ];
    classes.forEach(cls => this.renderer.addClass(this.tooltipEl, cls));

    // Add translation offset class based on placement for a premium entrance animation
    let offsetClass = 'translate-y-1';
    if (this.tooltipPlacement === 'bottom') offsetClass = '-translate-y-1';
    if (this.tooltipPlacement === 'left') offsetClass = 'translate-x-1';
    if (this.tooltipPlacement === 'right') offsetClass = '-translate-x-1';
    
    this.renderer.addClass(this.tooltipEl, offsetClass);
    this.renderer.appendChild(document.body, this.tooltipEl);

    // Position the tooltip element
    this.setPosition();

    // Listen to scroll and resize events outside Angular zone only when tooltip is active
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onWindowScrollBound, { passive: true });
      window.addEventListener('resize', this.onWindowResizeBound, { passive: true });
    });

    // Trigger transition: fade in and reset translation
    setTimeout(() => {
      if (this.tooltipEl) {
        this.renderer.removeClass(this.tooltipEl, 'opacity-0');
        this.renderer.removeClass(this.tooltipEl, offsetClass);
        this.renderer.addClass(this.tooltipEl, 'opacity-100');
        this.renderer.addClass(this.tooltipEl, 'translate-y-0');
        this.renderer.addClass(this.tooltipEl, 'translate-x-0');
      }
    }, 10);
  }

  private hide() {
    if (!this.active) return;
    this.active = false;
    
    if (this.tooltipEl) {
      const el = this.tooltipEl;
      
      // Animate out
      this.renderer.removeClass(el, 'opacity-100');
      this.renderer.addClass(el, 'opacity-0');
      
      let offsetClass = 'translate-y-1';
      if (this.tooltipPlacement === 'bottom') offsetClass = '-translate-y-1';
      if (this.tooltipPlacement === 'left') offsetClass = 'translate-x-1';
      if (this.tooltipPlacement === 'right') offsetClass = '-translate-x-1';
      this.renderer.addClass(el, offsetClass);
      
      this.zone.runOutsideAngular(() => {
        window.removeEventListener('scroll', this.onWindowScrollBound);
        window.removeEventListener('resize', this.onWindowResizeBound);
      });
      
      setTimeout(() => {
        if (!this.active && el.parentNode) {
          this.renderer.removeChild(document.body, el);
          if (this.tooltipEl === el) {
            this.tooltipEl = null;
          }
        }
      }, 150);
    }
  }

  private destroyTooltip() {
    this.zone.runOutsideAngular(() => {
      window.removeEventListener('scroll', this.onWindowScrollBound);
      window.removeEventListener('resize', this.onWindowResizeBound);
    });
    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.renderer.removeChild(document.body, this.tooltipEl);
    }
    this.tooltipEl = null;
    this.active = false;
  }

  private setPosition() {
    if (!this.tooltipEl) return;

    const hostRect = this.el.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipEl.getBoundingClientRect();

    let top = 0;
    let left = 0;
    const spacing = 6; // spacing gap in px

    switch (this.tooltipPlacement) {
      case 'top':
        top = hostRect.top - tooltipRect.height - spacing;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = hostRect.bottom + spacing;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.left - tooltipRect.width - spacing;
        break;
      case 'right':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.right + spacing;
        break;
    }

    // Boundary constraints to keep tooltip inside viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < spacing) left = spacing;
    if (left + tooltipRect.width > viewportWidth - spacing) {
      left = viewportWidth - tooltipRect.width - spacing;
    }

    if (top < spacing) {
      if (this.tooltipPlacement === 'top') {
        top = hostRect.bottom + spacing; // Flip to bottom
      } else {
        top = spacing;
      }
    } else if (top + tooltipRect.height > viewportHeight - spacing) {
      if (this.tooltipPlacement === 'bottom') {
        top = hostRect.top - tooltipRect.height - spacing; // Flip to top
      } else {
        top = viewportHeight - tooltipRect.height - spacing;
      }
    }

    this.renderer.setStyle(this.tooltipEl, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipEl, 'left', `${left}px`);
  }
}
