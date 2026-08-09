import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'admin-action-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './action-menu.component.html',
  styleUrls: ['./action-menu.component.scss']
})
export class ActionMenuComponent implements OnInit, OnDestroy {
  @Input() isOpen = false;
  @Input() headerLabel = '';
  @Input() dropdownWidth = 220;
  @Input() dropdownHeight = 175;
  @Output() closed = new EventEmitter<void>();

  position = { top: 0, left: 0 };

  private currentTriggerEl: HTMLElement | null = null;
  private scrollHandler: (() => void) | null = null;
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(private elementRef: ElementRef, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.scrollHandler = () => {
      if (this.isOpen && this.currentTriggerEl) {
        this.updatePosition();
      }
    };
    window.addEventListener('scroll', this.scrollHandler, { capture: true, passive: true });

    this.clickHandler = (event: MouseEvent) => {
      if (!this.isOpen) return;
      const target = event.target as Node;
      if (!target) return;
      const clickedTrigger = this.currentTriggerEl ? this.currentTriggerEl.contains(target) : false;
      const clickedInsideMenu = this.elementRef.nativeElement.contains(target);
      if (!clickedTrigger && !clickedInsideMenu) {
        this.close();
      }
    };
    window.addEventListener('click', this.clickHandler, true);
  }

  ngOnDestroy(): void {
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler, true);
    }
    if (this.clickHandler) {
      window.removeEventListener('click', this.clickHandler, true);
    }
  }

  /** Call this from the parent when the kebab button is clicked, passing the button element */
  openAt(triggerEl: HTMLElement): void {
    this.currentTriggerEl = triggerEl;
    this.updatePosition();

    // Auto-measure rendered menu height and adjust position accurately
    setTimeout(() => {
      if (!this.isOpen || !this.currentTriggerEl) return;
      const menuEl = this.elementRef.nativeElement.querySelector('.action-dropdown');
      if (menuEl && menuEl.offsetHeight > 0) {
        this.dropdownHeight = menuEl.offsetHeight;
        this.updatePosition();
      }
    }, 0);
  }

  updatePosition(): void {
    if (!this.currentTriggerEl) return;
    const rect = this.currentTriggerEl.getBoundingClientRect();

    // Find table container if inside one
    const container = this.currentTriggerEl.closest('.data-table-wrapper') ||
      this.currentTriggerEl.closest('.table-responsive') ||
      this.currentTriggerEl.closest('.glass-card');

    if (container) {
      const containerRect = container.getBoundingClientRect();
      // Close menu if trigger button has scrolled above or below visible table bounds
      if (rect.bottom < containerRect.top + 30 || rect.top > containerRect.bottom - 20) {
        this.close();
        return;
      }
    }

    // Check window viewport bounds
    if (rect.bottom < 50 || rect.top > window.innerHeight - 20) {
      this.close();
      return;
    }

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Detect sticky headers / filter toolbars across admin pages to avoid overlap
    const stickyHeader = document.querySelector('.page-filters') ||
      document.querySelector('.sticky-header') ||
      document.querySelector('header');
    const stickyBottom = stickyHeader ? stickyHeader.getBoundingClientRect().bottom : 60;

    const spaceBelow = viewportHeight - rect.bottom - 16;
    const spaceAbove = rect.top - stickyBottom - 16;
    const actualHeight = this.dropdownHeight || 175;

    let top: number;
    // Prefer opening downwards if space allows or if opening upwards would collide with sticky header
    if (spaceBelow >= actualHeight || spaceBelow >= spaceAbove) {
      top = rect.bottom + 6;
      if (top + actualHeight > viewportHeight - 12) {
        top = Math.max(stickyBottom + 6, viewportHeight - actualHeight - 12);
      }
    } else {
      top = rect.top - actualHeight - 6;
      if (top < stickyBottom + 6) {
        top = stickyBottom + 6;
      }
    }

    // Align right edge of menu with right edge of trigger button for clean layout
    let left = rect.right - this.dropdownWidth;
    if (left < 16) {
      left = 16;
    }
    if (left + this.dropdownWidth > viewportWidth - 16) {
      left = viewportWidth - this.dropdownWidth - 16;
    }

    this.position = { top, left };
    this.cdr.markForCheck();
  }



  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const items = Array.from(this.elementRef.nativeElement.querySelectorAll('.dropdown-item')) as HTMLElement[];
      if (items.length === 0) return;
      event.preventDefault();
      const activeIdx = items.findIndex(el => el === document.activeElement);
      let nextIdx = 0;
      if (event.key === 'ArrowDown') {
        nextIdx = activeIdx >= 0 && activeIdx < items.length - 1 ? activeIdx + 1 : 0;
      } else {
        nextIdx = activeIdx > 0 ? activeIdx - 1 : items.length - 1;
      }
      items[nextIdx]?.focus();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.isOpen) {
      this.close();
    }
  }

  private close(): void {
    this.currentTriggerEl = null;
    this.closed.emit();
    this.cdr.markForCheck();
  }
}