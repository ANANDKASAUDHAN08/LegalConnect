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

  constructor(private elementRef: ElementRef, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.scrollHandler = () => {
      if (this.isOpen && this.currentTriggerEl) {
        this.updatePosition();
      }
    };
    window.addEventListener('scroll', this.scrollHandler, true);

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

    let top = rect.bottom + 6;
    let left = rect.left + (rect.width / 2) - (this.dropdownWidth / 2);

    // Flip up if near the bottom edge
    if (top + this.dropdownHeight > window.innerHeight - 16) {
      top = Math.max(10, rect.top - this.dropdownHeight - 6);
    }
    // Keep within left/right viewport bounds
    if (left + this.dropdownWidth > window.innerWidth - 16) {
      left = window.innerWidth - this.dropdownWidth - 16;
    }
    if (left < 16) {
      left = 16;
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