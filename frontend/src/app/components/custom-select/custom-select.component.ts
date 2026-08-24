import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  ElementRef,
  HostListener,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  forwardRef,
  inject,
  NgZone,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon.types';
import {
  SelectOption,
  SelectSize,
  SelectVariant,
  SelectDropPosition,
  SelectMenuAlign,
  SelectRounded
} from './custom-select.types';

@Component({
  selector: 'app-custom-select, app-select',
  standalone: true,
  imports: [CommonModule, FormsModule, TooltipDirective, IconComponent],
  templateUrl: './custom-select.component.html',
  styleUrl: './custom-select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomSelectComponent),
      multi: true
    }
  ]
})
export class CustomSelectComponent implements OnInit, OnDestroy, ControlValueAccessor {
  @Input() options: SelectOption[] = [];
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
  @Input() maxMenuHeight: string = '340px';
  @Input() menuMinWidth: string = '180px';
  @Input() menuMaxWidth: string = '380px';
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
  @Input() clearable: boolean = false;
  @Input() closeOnScroll: boolean = true;
  @Input() required: boolean = false;
  @Input() ariaLabel?: string;

  @Output() valueChange = new EventEmitter<any>();
  @Output() selectionChange = new EventEmitter<SelectOption>();
  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('searchInput') searchInputElement?: ElementRef<HTMLInputElement>;

  isOpen = false;
  dropUp = false;
  alignRight = false;
  searchTerm = '';
  focusedIndex = -1;

  private onChange: (val: any) => void = () => { };
  private onTouched: () => void = () => { };
  private clickListener: ((event: MouseEvent) => void) | null = null;
  private scrollListener: ((event: Event) => void) | null = null;
  private resizeListener: (() => void) | null = null;

  private elementRef = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  ngOnInit(): void {
    // Capture-phase global click listener to bypass stopPropagation from parents
    this.clickListener = (event: MouseEvent) => {
      if (!this.isOpen) return;
      const target = event.target as Node;
      if (target && !this.elementRef.nativeElement.contains(target)) {
        this.close();
      }
    };
    window.addEventListener('click', this.clickListener, true);

    // Global capture-phase scroll listener: close dropdown when page or any parent container scrolls
    this.scrollListener = (event: Event) => {
      if (!this.isOpen || !this.closeOnScroll) return;
      const target = event.target as Node;
      // If the scroll happened inside the dropdown menu options list itself, do not close
      if (target && this.elementRef.nativeElement.contains(target)) {
        return;
      }
      this.zone.run(() => {
        this.close();
      });
    };
    window.addEventListener('scroll', this.scrollListener, true);

    // Close on window resize
    this.resizeListener = () => {
      if (this.isOpen) {
        this.zone.run(() => {
          this.close();
        });
      }
    };
    window.addEventListener('resize', this.resizeListener, { passive: true });
  }

  ngOnDestroy(): void {
    if (this.clickListener) {
      window.removeEventListener('click', this.clickListener, true);
    }
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener, true);
    }
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }

  // ControlValueAccessor methods
  writeValue(obj: any): void {
    this.value = obj ?? '';
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

  // Filtered options computed getter
  get filteredOptions(): SelectOption[] {
    if (!this.searchable || !this.searchTerm.trim()) {
      return this.options;
    }
    const term = this.searchTerm.toLowerCase().trim();
    return this.options.filter(
      opt =>
        opt.label.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
    );
  }

  get selectedOption(): SelectOption | undefined {
    if (this.value === undefined || this.value === null) return undefined;
    return this.options.find(o => String(o.value ?? '') === String(this.value ?? ''));
  }

  get hasValue(): boolean {
    return (
      this.value !== '' &&
      this.value !== null &&
      this.value !== undefined &&
      this.selectedOption !== undefined &&
      this.selectedOption.value !== ''
    );
  }

  get triggerTooltip(): string {
    if (this.isOpen) return '';
    if (this.tooltip) return this.tooltip;
    if (this.selectedOption) return this.selectedOption.label;
    return this.placeholder || '';
  }

  isSelected(optValue: any): boolean {
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
    this.isOpen = true;
    this.searchTerm = '';
    this.recalculatePosition();
    this.opened.emit();
    this.cdr.markForCheck();

    if (this.searchable) {
      setTimeout(() => {
        this.searchInputElement?.nativeElement?.focus();
      }, 50);
    }
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.searchTerm = '';
    this.focusedIndex = -1;
    this.onTouched();
    this.closed.emit();
    this.cdr.markForCheck();
  }

  selectOption(option: SelectOption, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (option.disabled) return;

    this.value = option.value;
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    this.selectionChange.emit(option);
    this.close();
  }

  clearSelection(event: MouseEvent): void {
    event.stopPropagation();
    if (this.disabled) return;
    this.value = '';
    this.onChange(this.value);
    this.valueChange.emit(this.value);
    this.cdr.markForCheck();
  }

  onSearchInput(term: string): void {
    this.searchTerm = term;
    this.focusedIndex = -1;
    this.cdr.markForCheck();
  }

  private recalculatePosition(): void {
    const rect = this.elementRef.nativeElement.getBoundingClientRect();

    // Vertical position calculation
    if (this.dropPosition === 'up') {
      this.dropUp = true;
    } else if (this.dropPosition === 'down') {
      this.dropUp = false;
    } else {
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      this.dropUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    }

    // Horizontal position calculation
    if (this.menuAlign === 'right') {
      this.alignRight = true;
    } else if (this.menuAlign === 'left') {
      this.alignRight = false;
    } else {
      // Auto-detect if expanding to the right would overflow the viewport or parent
      const spaceRight = window.innerWidth - rect.left;
      this.alignRight = spaceRight < 300 || (rect.right > window.innerWidth - 80);
    }
  }

  @HostListener('keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent): void {
    if (this.disabled) return;

    if (!this.isOpen) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        this.open();
      }
      return;
    }

    const opts = this.filteredOptions.filter(o => !o.disabled);
    if (opts.length === 0 && event.key !== 'Escape') return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;

      case 'ArrowDown': {
        event.preventDefault();
        if (this.focusedIndex < opts.length - 1) {
          this.focusedIndex++;
        } else {
          this.focusedIndex = 0;
        }
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
        this.cdr.markForCheck();
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
    }
  }
}