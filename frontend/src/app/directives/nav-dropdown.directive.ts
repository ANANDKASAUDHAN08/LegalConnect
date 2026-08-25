import {
  Directive,
  ElementRef,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
  NgZone,
  ChangeDetectorRef,
  AfterViewInit
} from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

let nextDropdownId = 0;

/**
 * Enterprise Navigation Dropdown Root Directive
 * Manages state, hover-intent timers, touch vs pointer modes, router synchronization,
 * and keyboard navigation orchestration.
 */
@Directive({
  selector: '[appNavDropdown]',
  standalone: true,
  exportAs: 'appNavDropdown'
})
export class NavDropdownDirective implements OnInit, OnDestroy {
  readonly id = `lc-nav-dropdown-${++nextDropdownId}`;
  readonly triggerId = `${this.id}-trigger`;
  readonly panelId = `${this.id}-panel`;

  /** Time in ms to wait before opening on hover (prevents accidental flashing) */
  @Input() openDelay = 40;

  /** Time in ms to keep menu open after pointer leaves (grace timer for diagonal movement) */
  @Input() closeDelay = 140;

  /** Whether the dropdown is disabled */
  @Input() disabled = false;

  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  isOpen = false;
  isTouchDevice = false;

  private openTimer: any = null;
  private closeTimer: any = null;
  private routerSub!: Subscription;

  private el = inject(ElementRef<HTMLElement>);
  private router = inject(Router);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  triggerEl: HTMLElement | null = null;
  panelEl: HTMLElement | null = null;

  ngOnInit(): void {
    // Detect touch device capabilities
    if (typeof window !== 'undefined') {
      this.isTouchDevice = window.matchMedia('(hover: none)').matches;
    }

    // Auto-close on route transition
    this.routerSub = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.close(true);
    });
  }

  ngOnDestroy(): void {
    this.clearTimers();
    if (this.routerSub) {
      this.routerSub.unsubscribe();
    }
  }

  open(immediate = false): void {
    if (this.disabled || this.isOpen) return;
    this.clearTimers();

    if (immediate || this.openDelay <= 0 || this.isTouchDevice) {
      this.setOpenState(true);
    } else {
      this.openTimer = setTimeout(() => {
        this.zone.run(() => {
          this.setOpenState(true);
        });
      }, this.openDelay);
    }
  }

  close(immediate = false): void {
    if (!this.isOpen) {
      this.clearTimers();
      return;
    }
    this.clearTimers();

    if (immediate || this.closeDelay <= 0 || this.isTouchDevice) {
      this.setOpenState(false);
    } else {
      this.closeTimer = setTimeout(() => {
        this.zone.run(() => {
          this.setOpenState(false);
        });
      }, this.closeDelay);
    }
  }

  toggle(): void {
    if (this.isOpen) {
      this.close(true);
    } else {
      this.open(true);
    }
  }

  cancelClose(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private setOpenState(open: boolean): void {
    this.clearTimers();
    if (this.isOpen === open) return;
    this.isOpen = open;
    this.cdr.markForCheck();

    if (open) {
      this.opened.emit();
    } else {
      this.closed.emit();
    }
  }

  private clearTimers(): void {
    if (this.openTimer) {
      clearTimeout(this.openTimer);
      this.openTimer = null;
    }
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen) return;
    const target = event.target as Node;
    if (target && !this.el.nativeElement.contains(target)) {
      this.close(true);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeyDown(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
      this.triggerEl?.focus();
    }
  }
}

/**
 * Trigger Button Directive
 * Handles ARIA attributes, click-toggle, mouse hover-intent, and arrow-key entry.
 */
@Directive({
  selector: '[appNavDropdownTrigger]',
  standalone: true
})
export class NavDropdownTriggerDirective implements OnInit {
  private dropdown = inject(NavDropdownDirective);
  private el = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    this.dropdown.triggerEl = this.el.nativeElement;
  }

  @HostBinding('attr.id')
  get id(): string {
    return this.dropdown.triggerId;
  }

  @HostBinding('attr.aria-haspopup')
  readonly ariaHasPopup = 'menu';

  @HostBinding('attr.aria-expanded')
  get ariaExpanded(): boolean {
    return this.dropdown.isOpen;
  }

  @HostBinding('attr.aria-controls')
  get ariaControls(): string {
    return this.dropdown.panelId;
  }

  @HostListener('click', ['$event'])
  onClick(event: MouseEvent): void {
    event.stopPropagation();
    this.dropdown.toggle();
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (!this.dropdown.isTouchDevice) {
      this.dropdown.open();
    }
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (!this.dropdown.isTouchDevice) {
      this.dropdown.close();
    }
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      if (!this.dropdown.isOpen) {
        event.preventDefault();
        this.dropdown.open(true);
        setTimeout(() => this.focusFirstItem(), 30);
      }
    }
  }

  private focusFirstItem(): void {
    if (!this.dropdown.panelEl) return;
    const firstItem = this.dropdown.panelEl.querySelector(
      'a, button, [tabindex="0"], [role="menuitem"]'
    ) as HTMLElement | null;
    firstItem?.focus();
  }
}

/**
 * Dropdown Panel Directive
 * Binds ARIA menu role, applies open class, coordinates hover buffer, handles arrow-key item navigation,
 * and auto-closes on item selection.
 */
@Directive({
  selector: '[appNavDropdownPanel]',
  standalone: true
})
export class NavDropdownPanelDirective implements OnInit, AfterViewInit {
  private dropdown = inject(NavDropdownDirective);
  private el = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    this.dropdown.panelEl = this.el.nativeElement;
  }

  ngAfterViewInit(): void {
    this.adjustBoundaryPosition();
  }

  @HostBinding('attr.id')
  get id(): string {
    return this.dropdown.panelId;
  }

  @HostBinding('attr.aria-labelledby')
  get ariaLabelledBy(): string {
    return this.dropdown.triggerId;
  }

  @HostBinding('attr.role')
  readonly role = 'menu';

  @HostBinding('attr.tabindex')
  readonly tabIndex = -1;

  @HostBinding('class.is-open')
  get isOpen(): boolean {
    return this.dropdown.isOpen;
  }

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (!this.dropdown.isTouchDevice) {
      this.dropdown.cancelClose();
    }
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (!this.dropdown.isTouchDevice) {
      this.dropdown.close();
    }
  }

  /** Auto-close when clicking any interactive link/button inside the panel */
  @HostListener('click', ['$event'])
  onItemClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickable = target.closest('a, button, [role="menuitem"]');
    if (clickable) {
      this.dropdown.close(true);
    }
  }

  /** Keyboard Navigation inside Menu Panel */
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const items = (Array.from(
      this.el.nativeElement.querySelectorAll('a, button, [tabindex="0"], [role="menuitem"]')
    ) as HTMLElement[]).filter(el => !el.hasAttribute('disabled'));

    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[nextIndex]?.focus();
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prevIndex]?.focus();
        break;
      }
      case 'Home': {
        event.preventDefault();
        items[0]?.focus();
        break;
      }
      case 'End': {
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      }
      case 'Tab': {
        // Tab naturally exits menu, close cleanly
        this.dropdown.close(true);
        break;
      }
    }
  }

  private adjustBoundaryPosition(): void {
    if (typeof window === 'undefined') return;
    const rect = this.el.nativeElement.getBoundingClientRect();
    const margin = 12;
    if (rect.right > window.innerWidth - margin) {
      const overflow = rect.right - (window.innerWidth - margin);
      this.el.nativeElement.style.transform = `translateX(calc(-50% - ${overflow}px))`;
    }
  }
}

/** Convenience bundle export for simple component imports */
export const NAV_DROPDOWN_DIRECTIVES = [
  NavDropdownDirective,
  NavDropdownTriggerDirective,
  NavDropdownPanelDirective
] as const;