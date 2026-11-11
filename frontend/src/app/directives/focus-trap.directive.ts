import { Directive, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

/**
 * Focus Trap Directive — traps Tab focus within a container element.
 *
 * Usage: Add `appFocusTrap` to any modal/dialog container.
 * When Tab/Shift+Tab reaches the last/first focusable element,
 * focus wraps around instead of escaping to the background.
 *
 * Example:
 *   <div class="modal" appFocusTrap>
 *     <input />
 *     <button>Close</button>
 *   </div>
 */
@Directive({
  selector: '[appFocusTrap]',
  standalone: true
})
export class FocusTrapDirective implements AfterViewInit, OnDestroy {
  private focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  private keydownHandler = (event: KeyboardEvent) => this.onKeydown(event);
  private previousFocus: HTMLElement | null = null;

  constructor(private el: ElementRef<HTMLElement>) { }

  ngAfterViewInit() {
    // Store the previously focused element to restore on destroy (ignore body/html to avoid scroll reset)
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && active !== document.documentElement) {
      this.previousFocus = active;
    } else {
      this.previousFocus = null;
    }

    // Listen for Tab key
    this.el.nativeElement.addEventListener('keydown', this.keydownHandler);

    // Auto-focus container or designated element WITHOUT highlighting random header buttons
    setTimeout(() => {
      const el = this.el.nativeElement;
      const explicitAutofocus = el.querySelector<HTMLElement>('[autofocus], [data-autofocus]');
      if (explicitAutofocus) {
        explicitAutofocus.focus({ preventScroll: true });
      } else {
        if (!el.hasAttribute('tabindex')) {
          el.setAttribute('tabindex', '-1');
        }
        el.style.outline = 'none';
        el.focus({ preventScroll: true });
      }
    }, 50);
  }

  ngOnDestroy() {
    this.el.nativeElement.removeEventListener('keydown', this.keydownHandler);

    // Restore focus to the previously focused element safely without scrolling
    if (this.previousFocus && this.previousFocus !== document.body && this.previousFocus !== document.documentElement && typeof this.previousFocus.focus === 'function') {
      setTimeout(() => {
        try {
          this.previousFocus?.focus({ preventScroll: true });
        } catch { }
      }, 0);
    }
  }

  private onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;

    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      // Shift+Tab: wrap from first to last (or if currently on container, go to last)
      if (document.activeElement === first || document.activeElement === this.el.nativeElement) {
        event.preventDefault();
        last.focus();
      }
    } else {
      // Tab: wrap from last to first (or if currently on container, go to first)
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (document.activeElement === this.el.nativeElement) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  private getFocusableElements(): HTMLElement[] {
    return Array.from(
      this.el.nativeElement.querySelectorAll<HTMLElement>(this.focusableSelector)
    ).filter(el => {
      // Only include visible elements
      return el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0;
    });
  }
}