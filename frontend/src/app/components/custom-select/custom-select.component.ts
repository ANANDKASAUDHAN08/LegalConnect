import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  AfterViewChecked,
  ElementRef,
  HostListener,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  inject,
  NgZone,
  ViewChild,
  Optional,
  Self
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NgControl, FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon.types';
import {
  SelectOption,
  SelectGroup,
  SelectSize,
  SelectVariant,
  SelectDropPosition,
  SelectMenuAlign,
  SelectRounded,
  HighlightPart
} from './custom-select.types';

let nextUniqueId = 0;

export interface ProcessedGroup {
  name: string;
  icon?: IconName | string;
  options: SelectOption[];
}

@Component({
  selector: 'app-custom-select, app-select',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, IconComponent],
  templateUrl: './custom-select.component.html',
  styleUrl: './custom-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomSelectComponent implements OnInit, OnDestroy, AfterViewChecked, ControlValueAccessor {
  @Input() options: SelectOption[] = [];
  @Input() groups?: SelectGroup[];
  @Input() value: any = '';
  @Input() placeholder: string = 'Select Option';
  @Input() width: string = 'auto';
  @Input() minWidth: string = '150px';
  @Input() maxWidth?: string;
  @Input() height?: string;
  @Input() size: SelectSize = 'md';
  @Input() variant: SelectVariant = 'default';
  @Input() rounded: SelectRounded = 'xl';
  @Input() menuRounded: SelectRounded = '2xl';
  @Input() triggerClass?: string;
  @Input() icon?: IconName | string;
  @Input() iconColor?: string;
  @Input() dropPosition: SelectDropPosition = 'auto';
  @Input() menuAlign: SelectMenuAlign = 'auto';
  @Input() maxMenuHeight: string = '320px';
  @Input() menuMinWidth: string = '180px';
  @Input() menuMaxWidth: string = '420px';
  @Input() smMenuMinWidth?: string;
  @Input() smMenuMaxWidth?: string;
  @Input() mdMenuMinWidth?: string;
  @Input() mdMenuMaxWidth?: string;
  @Input() menuClass?: string;
  @Input() tooltip?: string;
  @Input() tooltipPlacement: 'top' | 'bottom' | 'left' | 'right' = 'top';
  @Input() disabled: boolean = false;
  @Input() loading: boolean = false;
  @Input() isLoading: boolean = false;
  @Input() loadingText: string = 'Loading...';
  @Input() showCheckmark: boolean = true;
  @Input() searchable: boolean = false;
  @Input() searchPlaceholder: string = 'Search...';
  @Input() emptyText: string = 'No options found';
  @Input() clearable: boolean = false;
  @Input() closeOnScroll: boolean = false;
  @Input() required: boolean = false;
  @Input() ariaLabel?: string;
  @Input() useBottomSheetOnMobile: boolean = true;
  @Input() sheetTitle?: string;

  // Multi-select inputs
  @Input() multiple: boolean = false;
  @Input() maxDisplayTags: number = 2;
  @Input() selectAllText: string = 'Select All';
  @Input() clearAllText: string = 'Clear All';

  @Output() valueChange = new EventEmitter<any>();
  @Output() selectionChange = new EventEmitter<SelectOption | SelectOption[]>();
  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('searchInput') searchInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('mobileSearchInput') mobileSearchInputElement?: ElementRef<HTMLInputElement>;
  @ViewChild('triggerButton') triggerButton?: ElementRef<HTMLDivElement>;
  @ViewChild('portalContainer') portalContainer?: ElementRef<HTMLDivElement>;

  readonly instanceId = `lc-select-${++nextUniqueId}`;
  isOpen = false;
  isClosing = false;
  dropUp = false;
  alignRight = false;
  searchTerm = '';
  focusedIndex = -1;
  isMobileView = false;

  // Touch drag-down state for mobile bottom sheet
  sheetTranslateY = 0;
  private touchStartY = 0;
  isDraggingSheet = false;

  // Precision viewport overlay styles (portaled directly to document.body)
  floatingStyles: { [key: string]: string } = {};

  private onChange: (val: any) => void = () => { };
  private onTouched: () => void = () => { };
  private clickListener: ((event: MouseEvent) => void) | null = null;
  private scrollListener: ((event: Event) => void) | null = null;
  private resizeListener: (() => void) | null = null;
  private rafId: number | null = null;
  private typeaheadBuffer = '';
  private typeaheadTimer: any = null;

  private elementRef = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private ngControl = inject(NgControl, { optional: true, self: true });

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  ngOnInit(): void {
    this.checkMobileView();

    // Global outside click listener (with support for body-portaled menu)
    this.clickListener = (event: MouseEvent) => {
      if (!this.isOpen) return;
      const target = event.target as Node;
      if (!target) return;

      // On mobile bottom sheet, backdrop clicks handle dismissal
      if (this.isMobileView && this.useBottomSheetOnMobile) {
        return;
      }

      const clickedTrigger = this.elementRef.nativeElement.contains(target);
      const clickedPortal = this.portalContainer?.nativeElement?.contains(target);

      if (!clickedTrigger && !clickedPortal) {
        this.zone.run(() => {
          this.close();
        });
      }
    };
    window.addEventListener('click', this.clickListener, true);

    // High performance RAF scroll listener
    this.zone.runOutsideAngular(() => {
      this.scrollListener = (event: Event) => {
        if (!this.isOpen || (this.isMobileView && this.useBottomSheetOnMobile)) return;

        const target = event.target as Node;
        // Ignore scrolls inside the dropdown menu options list itself
        if (target && this.portalContainer?.nativeElement?.contains(target)) {
          return;
        }

        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
        }

        this.rafId = requestAnimationFrame(() => {
          if (this.isElementOutOfView()) {
            this.zone.run(() => {
              this.close();
            });
            return;
          }

          if (this.closeOnScroll) {
            this.zone.run(() => {
              this.close();
            });
          } else {
            this.recalculatePosition();
            this.zone.run(() => {
              this.cdr.markForCheck();
            });
          }
        });
      };
      window.addEventListener('scroll', this.scrollListener, true);

      // Window resize listener
      this.resizeListener = () => {
        const wasMobile = this.isMobileView;
        this.checkMobileView();

        if (this.isOpen) {
          if (this.isMobileView !== wasMobile) {
            this.zone.run(() => {
              this.handleBodyScrollLock(this.isMobileView && this.useBottomSheetOnMobile);
              this.recalculatePosition();
              this.cdr.markForCheck();
            });
          } else if (!this.isMobileView) {
            this.recalculatePosition();
            this.zone.run(() => {
              this.cdr.markForCheck();
            });
          }
        }
      };
      window.addEventListener('resize', this.resizeListener, { passive: true });
    });
  }

  ngAfterViewChecked(): void {
    // Attach portaled container to document.body to break out of transformed containers forever
    if (typeof document !== 'undefined' && this.portalContainer?.nativeElement) {
      const portalEl = this.portalContainer.nativeElement;
      if ((this.isOpen || this.isClosing) && portalEl.parentElement !== document.body) {
        document.body.appendChild(portalEl);
        if (!this.isMobileView || !this.useBottomSheetOnMobile) {
          this.recalculatePosition();
          this.cdr.markForCheck();
        }
      }
    }
  }

  ngOnDestroy(): void {
    if (this.isOpen && this.isMobileView && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lc-nested-sheet-change', {
        detail: { open: false, selectId: this.instanceId }
      }));
    }

    // Clean up DOM portal from body
    if (typeof document !== 'undefined' && this.portalContainer?.nativeElement) {
      const portalEl = this.portalContainer.nativeElement;
      if (portalEl.parentElement === document.body) {
        document.body.removeChild(portalEl);
      }
    }

    this.handleBodyScrollLock(false);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.clickListener) {
      window.removeEventListener('click', this.clickListener, true);
    }
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, true);
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
    if (this.typeaheadTimer) {
      clearTimeout(this.typeaheadTimer);
    }
  }

  private lockedParentElements: Array<{ el: HTMLElement; prevOverflowY: string; prevTouchAction: string }> = [];

  private checkMobileView(): void {
    if (typeof window !== 'undefined') {
      this.isMobileView = window.innerWidth < 640;
    }
  }

  private handleBodyScrollLock(lock: boolean): void {
    if (typeof document === 'undefined') return;
    if (lock) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      if (document.documentElement) {
        document.documentElement.style.overflow = 'hidden';
      }

      // Lock all parent scrollable containers
      this.lockedParentElements = [];
      let parent = this.elementRef.nativeElement.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        const style = window.getComputedStyle(parent);
        if (
          style.overflowY === 'auto' ||
          style.overflowY === 'scroll' ||
          style.overflow === 'auto' ||
          style.overflow === 'scroll'
        ) {
          this.lockedParentElements.push({
            el: parent,
            prevOverflowY: parent.style.overflowY,
            prevTouchAction: parent.style.touchAction
          });
          parent.style.overflowY = 'hidden';
          parent.style.touchAction = 'none';
        }
        parent = parent.parentElement;
      }
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      if (document.documentElement) {
        document.documentElement.style.overflow = '';
      }

      // Restore parent scrollable containers
      for (const item of this.lockedParentElements) {
        item.el.style.overflowY = item.prevOverflowY;
        item.el.style.touchAction = item.prevTouchAction;
      }
      this.lockedParentElements = [];
    }
  }

  // Reactive Form Validation State
  get isInvalid(): boolean {
    return !!(this.ngControl && this.ngControl.invalid && (this.ngControl.touched || this.ngControl.dirty));
  }

  // ControlValueAccessor methods
  writeValue(obj: any): void {
    if (this.multiple) {
      this.value = Array.isArray(obj) ? obj : (obj !== undefined && obj !== null && obj !== '' ? [obj] : []);
    } else {
      this.value = obj ?? '';
    }
    this.cdr.markForCheck();
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  get isCustomRounded(): boolean {
    return !!this.rounded && (this.rounded.includes('px') || this.rounded.includes('rem') || this.rounded.includes('%') || /^\d+$/.test(this.rounded));
  }

  get customRoundedStyle(): string | null {
    if (!this.rounded) return null;
    if (/^\d+$/.test(this.rounded)) return `${this.rounded}px`;
    if (this.isCustomRounded) return this.rounded;
    return null;
  }

  get roundedClass(): string {
    if (this.isCustomRounded) return '';
    switch (this.rounded) {
      case 'none': return 'rounded-none';
      case 'sm': return 'rounded-sm';
      case 'md': return 'rounded-md';
      case 'lg': return 'rounded-lg';
      case 'xl': return 'rounded-xl';
      case '2xl': return 'rounded-2xl';
      case '3xl': return 'rounded-3xl';
      case 'full': return 'rounded-full';
      default: return 'rounded-xl';
    }
  }

  get isCustomMenuRounded(): boolean {
    return !!this.menuRounded && (this.menuRounded.includes('px') || this.menuRounded.includes('rem') || this.menuRounded.includes('%') || /^\d+$/.test(this.menuRounded));
  }

  get customMenuRoundedStyle(): string | null {
    if (!this.menuRounded) return null;
    if (/^\d+$/.test(this.menuRounded)) return `${this.menuRounded}px`;
    if (this.isCustomMenuRounded) return this.menuRounded;
    return null;
  }

  get menuRoundedClass(): string {
    if (this.isCustomMenuRounded) return '';
    switch (this.menuRounded) {
      case 'none': return 'rounded-none';
      case 'sm': return 'rounded-sm';
      case 'md': return 'rounded-md';
      case 'lg': return 'rounded-lg';
      case 'xl': return 'rounded-xl';
      case '2xl': return 'rounded-2xl';
      case '3xl': return 'rounded-3xl';
      case 'full': return 'rounded-3xl';
      default: return 'rounded-2xl';
    }
  }

  // All combined options (from options array or groups)
  get allOptions(): SelectOption[] {
    if (this.groups && this.groups.length > 0) {
      return this.groups.flatMap(g => g.options);
    }
    return this.options || [];
  }

  // Grouped options processed for template rendering
  get groupedOptions(): ProcessedGroup[] {
    if (this.groups && this.groups.length > 0) {
      return this.groups.map(g => ({
        name: g.name,
        icon: g.icon,
        options: this.filterOptionList(g.options)
      })).filter(g => g.options.length > 0);
    }

    // Auto-detect group property on flat options if present
    const hasInlineGroups = this.options.some(o => !!o.group);
    if (hasInlineGroups) {
      const groupMap = new Map<string, SelectOption[]>();
      for (const opt of this.options) {
        const gName = opt.group || 'Other';
        if (!groupMap.has(gName)) {
          groupMap.set(gName, []);
        }
        groupMap.get(gName)!.push(opt);
      }
      return Array.from(groupMap.entries()).map(([name, opts]) => ({
        name,
        options: this.filterOptionList(opts)
      })).filter(g => g.options.length > 0);
    }

    // Flat default group
    return [{
      name: '',
      options: this.filteredOptions
    }];
  }

  get hasMultipleGroups(): boolean {
    return this.groupedOptions.length > 1 || (this.groupedOptions.length === 1 && !!this.groupedOptions[0].name);
  }

  private filterOptionList(list: SelectOption[]): SelectOption[] {
    if (!this.searchable || !this.searchTerm.trim()) {
      return list;
    }
    const term = this.searchTerm.toLowerCase().trim();
    return list.filter(
      opt =>
        opt.label.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
    );
  }

  // Filtered options computed getter
  get filteredOptions(): SelectOption[] {
    return this.filterOptionList(this.allOptions);
  }

  get selectedOption(): SelectOption | undefined {
    if (this.multiple) return undefined;
    if (this.value === undefined || this.value === null) return undefined;
    return this.allOptions.find(o => String(o.value ?? '') === String(this.value ?? ''));
  }

  get selectedOptions(): SelectOption[] {
    if (!this.multiple || !Array.isArray(this.value)) return [];
    return this.allOptions.filter(o =>
      this.value.some((v: any) => String(v ?? '') === String(o.value ?? ''))
    );
  }

  get hasValue(): boolean {
    if (this.multiple) {
      return Array.isArray(this.value) && this.value.length > 0;
    }
    return (
      this.value !== '' &&
      this.value !== null &&
      this.value !== undefined &&
      this.selectedOption !== undefined &&
      this.selectedOption.value !== ''
    );
  }

  // Display explicit tooltip or fallback to selected option label/placeholder
  get triggerTooltip(): string {
    if (this.isOpen) return '';
    if (this.tooltip) return this.tooltip;
    if (this.multiple && this.selectedOptions.length > 0) {
      return this.selectedOptions.map(o => o.label).join(', ');
    }
    if (this.selectedOption) return this.selectedOption.label;
    return this.placeholder || '';
  }

  isSelected(optValue: any): boolean {
    if (this.multiple) {
      if (!Array.isArray(this.value)) return false;
      return this.value.some((v: any) => String(v ?? '') === String(optValue ?? ''));
    }
    if (this.value === undefined || this.value === null) return false;
    return String(optValue ?? '') === String(this.value ?? '');
  }

  toggleOpen(): void {
    if (this.disabled) return;
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    if (this.disabled || this.isOpen) return;
    this.checkMobileView();
    this.isOpen = true;
    this.isClosing = false;
    this.sheetTranslateY = 0;
    this.searchTerm = '';

    if (this.multiple) {
      this.focusedIndex = this.filteredOptions.length > 0 ? 0 : -1;
    } else {
      this.focusedIndex = this.filteredOptions.findIndex(o => this.isSelected(o.value));
      if (this.focusedIndex === -1 && this.filteredOptions.length > 0) {
        this.focusedIndex = 0;
      }
    }

    if (this.isMobileView && this.useBottomSheetOnMobile) {
      this.handleBodyScrollLock(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lc-nested-sheet-change', {
          detail: { open: true, selectId: this.instanceId }
        }));
      }
    } else {
      this.recalculatePosition();
    }

    this.opened.emit();
    this.cdr.markForCheck();

    // Auto-focus search input immediately on Desktop; skip on mobile to prevent virtual keyboard pop
    setTimeout(() => {
      if (this.searchable && !this.isMobileView) {
        this.searchInputElement?.nativeElement?.focus();
      }
      this.scrollFocusedOptionIntoView();
    }, 60);
  }

  close(): void {
    if (!this.isOpen || this.isClosing) return;

    if (this.isMobileView && this.useBottomSheetOnMobile) {
      // Smooth slide-down exit animation for mobile bottom sheet
      this.isClosing = true;
      this.onTouched();
      this.closed.emit();

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('lc-nested-sheet-change', {
          detail: { open: false, selectId: this.instanceId }
        }));
      }
      this.cdr.markForCheck();

      setTimeout(() => {
        this.isOpen = false;
        this.isClosing = false;
        this.searchTerm = '';
        this.focusedIndex = -1;
        this.sheetTranslateY = 0;
        this.handleBodyScrollLock(false);
        this.cdr.markForCheck();
      }, 200);
    } else {
      this.isOpen = false;
      this.isClosing = false;
      this.searchTerm = '';
      this.focusedIndex = -1;
      this.handleBodyScrollLock(false);
      this.onTouched();
      this.closed.emit();
      this.cdr.markForCheck();
    }
  }

  // Touch Drag-to-Dismiss Gesture Handlers for Mobile Bottom Sheet
  onSheetTouchStart(event: TouchEvent): void {
    if (event.touches && event.touches.length === 1) {
      this.touchStartY = event.touches[0].clientY;
      this.isDraggingSheet = true;
    }
  }

  onSheetTouchMove(event: TouchEvent): void {
    if (!this.isDraggingSheet) return;
    const currentY = event.touches[0].clientY;
    const deltaY = currentY - this.touchStartY;
    if (deltaY > 0) {
      // Smooth rubberband resistance curve
      this.sheetTranslateY = Math.pow(deltaY, 0.88);
      this.cdr.markForCheck();
    }
  }

  onSheetTouchEnd(): void {
    if (!this.isDraggingSheet) return;
    this.isDraggingSheet = false;
    if (this.sheetTranslateY > 60) {
      this.close();
    } else {
      this.sheetTranslateY = 0;
      this.cdr.markForCheck();
    }
  }

  selectOption(option: SelectOption, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (option.disabled) return;

    if (this.multiple) {
      const currentValues = Array.isArray(this.value) ? [...this.value] : [];
      const index = currentValues.findIndex(v => String(v ?? '') === String(option.value ?? ''));
      if (index >= 0) {
        currentValues.splice(index, 1);
      } else {
        currentValues.push(option.value);
      }
      this.value = currentValues;
      this.onChange(this.value);
      this.valueChange.emit(this.value);
      this.selectionChange.emit(this.selectedOptions);
      this.cdr.markForCheck();
      return;
    }

    this.value = option.value;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    this.selectionChange.emit(option);
    this.close();

    // Restore focus to trigger for keyboard users
    setTimeout(() => {
      this.triggerButton?.nativeElement?.focus();
    }, 0);
  }

  removeTag(option: SelectOption, event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;
    if (this.multiple && Array.isArray(this.value)) {
      this.value = this.value.filter(v => String(v ?? '') !== String(option.value ?? ''));
      this.onChange(this.value);
      this.valueChange.emit(this.value);
      this.selectionChange.emit(this.selectedOptions);
      this.cdr.markForCheck();
    }
  }

  selectAll(): void {
    if (!this.multiple || this.disabled) return;
    const nonDisabledOpts = this.filteredOptions.filter(o => !o.disabled);
    this.value = nonDisabledOpts.map(o => o.value);
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    this.selectionChange.emit(this.selectedOptions);
    this.cdr.markForCheck();
  }

  deselectAll(): void {
    if (!this.multiple || this.disabled) return;
    this.value = [];
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    this.selectionChange.emit([]);
    this.cdr.markForCheck();
  }

  clearSelection(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.value = this.multiple ? [] : '';
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    if (this.multiple) {
      this.selectionChange.emit([]);
    }
    this.cdr.markForCheck();
  }

  onSearchInput(term: string): void {
    this.searchTerm = term;
    this.focusedIndex = this.filteredOptions.length > 0 ? 0 : -1;
    this.cdr.markForCheck();
  }

  // Highlight search matches safely
  getHighlights(text: string): HighlightPart[] {
    if (!this.searchTerm.trim() || !text) {
      return [{ text, match: false }];
    }
    const term = this.searchTerm.trim();
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map(part => ({
      text: part,
      match: part.toLowerCase() === term.toLowerCase()
    }));
  }

  private scrollFocusedOptionIntoView(): void {
    if (this.focusedIndex < 0) return;
    setTimeout(() => {
      const container = (this.portalContainer?.nativeElement || this.elementRef.nativeElement).querySelector(
        this.isMobileView && this.useBottomSheetOnMobile
          ? '.custom-select-mobile-list'
          : '.custom-select-scrollbar'
      );
      if (!container) return;

      const options = container.querySelectorAll('[role="option"]');
      const target = options[this.focusedIndex] as HTMLElement;
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 10);
  }

  private recalculatePosition(): void {
    const el = this.triggerButton?.nativeElement || this.elementRef.nativeElement;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Intelligent Vertical Flip
    if (this.dropPosition === 'up') {
      this.dropUp = true;
    } else if (this.dropPosition === 'down') {
      this.dropUp = false;
    } else {
      this.dropUp = spaceBelow < 260 && spaceAbove > spaceBelow;
    }

    // Intelligent Horizontal Alignment
    if (this.menuAlign === 'right') {
      this.alignRight = true;
    } else if (this.menuAlign === 'left') {
      this.alignRight = false;
    } else {
      const spaceRight = viewportWidth - rect.left;
      this.alignRight = spaceRight < 280 || (rect.right > viewportWidth - 60);
    }

    // Compute pixel-perfect coordinates
    const top = this.dropUp ? (rect.top - 6) : (rect.bottom + 6);
    
    // Resolve dynamic width constraints (handle '100%' gracefully)
    let computedMinWidth = this.menuMinWidth;
    if (!computedMinWidth || computedMinWidth === '100%') {
      computedMinWidth = `${Math.max(rect.width, 180)}px`;
    }

    let computedMaxWidth = this.menuMaxWidth;
    if (computedMaxWidth === '100%') {
      computedMaxWidth = `${Math.max(rect.width, 360)}px`;
    }

    const availableVerticalHeight = this.dropUp ? Math.max(120, rect.top - 20) : Math.max(120, viewportHeight - rect.bottom - 20);
    const parsedMaxMenuHeight = parseInt(this.maxMenuHeight, 10) || 320;
    const clampedHeight = Math.min(parsedMaxMenuHeight, availableVerticalHeight);

    this.floatingStyles = {
      position: 'fixed',
      top: `${top}px`,
      left: this.alignRight ? 'auto' : `${Math.max(8, Math.min(rect.left, viewportWidth - 200))}px`,
      right: this.alignRight ? `${Math.max(8, viewportWidth - rect.right)}px` : 'auto',
      minWidth: computedMinWidth,
      maxWidth: computedMaxWidth || '420px',
      maxHeight: `${clampedHeight}px`,
      transform: this.dropUp ? 'translateY(-100%)' : 'none',
      zIndex: '999999'
    };
  }

  private isElementOutOfView(): boolean {
    if (typeof window === 'undefined') return false;
    const el = this.triggerButton?.nativeElement || this.elementRef.nativeElement;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

    // Viewport bounds check
    return rect.bottom <= 0 || rect.top >= viewportHeight || rect.right <= 0 || rect.left >= viewportWidth;
  }

  @HostListener('keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (this.disabled) return;

    if (!this.isOpen) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.open();
        return;
      }
      // Typeahead when closed
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        this.handleTypeahead(event.key);
      }
      return;
    }

    const opts = this.filteredOptions.filter(o => !o.disabled);
    if (opts.length === 0 && event.key !== 'Escape') return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        this.triggerButton?.nativeElement?.focus();
        break;

      case 'ArrowDown': {
        event.preventDefault();
        if (this.focusedIndex < opts.length - 1) {
          this.focusedIndex++;
        } else {
          this.focusedIndex = 0;
        }
        this.scrollFocusedOptionIntoView();
        this.cdr.markForCheck();
        break;
      }

      case 'ArrowUp': {
        event.preventDefault();
        if (this.focusedIndex > 0) {
          this.focusedIndex--;
        } else {
          this.focusedIndex = opts.length - 1;
        }
        this.scrollFocusedOptionIntoView();
        this.cdr.markForCheck();
        break;
      }

      case 'Home': {
        if (!this.searchable || event.target !== this.searchInputElement?.nativeElement) {
          event.preventDefault();
          this.focusedIndex = 0;
          this.scrollFocusedOptionIntoView();
          this.cdr.markForCheck();
        }
        break;
      }

      case 'End': {
        if (!this.searchable || event.target !== this.searchInputElement?.nativeElement) {
          event.preventDefault();
          this.focusedIndex = opts.length - 1;
          this.scrollFocusedOptionIntoView();
          this.cdr.markForCheck();
        }
        break;
      }

      case 'Enter': {
        event.preventDefault();
        if (this.focusedIndex >= 0 && this.focusedIndex < opts.length) {
          this.selectOption(opts[this.focusedIndex]);
        } else if (opts.length === 1 && this.searchable && this.searchTerm) {
          this.selectOption(opts[0]);
        } else {
          this.close();
        }
        break;
      }

      case 'Tab':
        this.close();
        break;

      default:
        // Typeahead jump if not inside search input
        if (!this.searchable && event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
          this.handleTypeahead(event.key);
        }
        break;
    }
  }

  private handleTypeahead(char: string): void {
    this.typeaheadBuffer += char.toLowerCase();
    if (this.typeaheadTimer) {
      clearTimeout(this.typeaheadTimer);
    }
    this.typeaheadTimer = setTimeout(() => {
      this.typeaheadBuffer = '';
    }, 600);

    const matchIndex = this.filteredOptions.findIndex(
      opt => !opt.disabled && opt.label.toLowerCase().startsWith(this.typeaheadBuffer)
    );

    if (matchIndex >= 0) {
      this.focusedIndex = matchIndex;
      if (!this.isOpen && !this.multiple) {
        this.selectOption(this.filteredOptions[matchIndex]);
      } else {
        this.scrollFocusedOptionIntoView();
        this.cdr.markForCheck();
      }
    }
  }
}