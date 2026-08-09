import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, HostListener, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SelectOption {
  label: string;
  value: any;
  icon?: string;
  color?: string;
  count?: number;
}

@Component({
  selector: 'admin-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss'
})
export class SelectComponent implements OnInit, OnDestroy {
  @Input() options: SelectOption[] = [];
  @Input() value: any = '';
  @Input() placeholder: string = 'Select Option';
  @Input() width: string = 'auto';
  @Input() minWidth: string = '160px';
  @Input() icon?: string;
  @Input() dropPosition: 'down' | 'up' | 'auto' = 'auto';

  @Output() valueChange = new EventEmitter<any>();

  isOpen = false;
  dropUp = false;

  private clickListener: ((event: MouseEvent) => void) | null = null;

  constructor(private elementRef: ElementRef, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    // Capture-phase global click listener (bypasses any parent stopPropagation calls)
    this.clickListener = (event: MouseEvent) => {
      if (!this.isOpen) return;
      const target = event.target as Node;
      if (target && !this.elementRef.nativeElement.contains(target)) {
        this.isOpen = false;
        this.cdr.markForCheck();
      }
    };
    window.addEventListener('click', this.clickListener, true);
  }

  ngOnDestroy(): void {
    if (this.clickListener) {
      window.removeEventListener('click', this.clickListener, true);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.searchTerm = '';
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) return;
    const opts = this.filteredOptions;
    if (opts.length === 0) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const currentIdx = opts.findIndex(o => String(o.value) === String(this.value));
      let nextIdx = 0;
      if (event.key === 'ArrowDown') {
        nextIdx = currentIdx >= 0 && currentIdx < opts.length - 1 ? currentIdx + 1 : 0;
      } else {
        nextIdx = currentIdx > 0 ? currentIdx - 1 : opts.length - 1;
      }
      this.value = opts[nextIdx].value;
      this.valueChange.emit(this.value);
      this.cdr.markForCheck();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.isOpen = false;
      this.searchTerm = '';
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.isOpen) {
      this.isOpen = false;
      this.searchTerm = '';
      this.cdr.markForCheck();
    }
  }

  @Input() showCheckmark: boolean = true;
  @Input() searchable: boolean = false;
  @Input() searchPlaceholder: string = 'Search...';

  searchTerm = '';

  get filteredOptions(): SelectOption[] {
    if (!this.searchable || !this.searchTerm.trim()) {
      return this.options;
    }
    const term = this.searchTerm.toLowerCase().trim();
    return this.options.filter(o => o.label.toLowerCase().includes(term));
  }

  onSearchInput(val: string): void {
    this.searchTerm = val;
    this.cdr.markForCheck();
  }

  get selectedOption(): SelectOption | undefined {
    return this.options.find(o => String(o.value ?? '') === String(this.value ?? ''));
  }

  isSelected(optValue: any): boolean {
    return String(optValue ?? '') === String(this.value ?? '');
  }

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.searchTerm = '';
      if (this.dropPosition === 'up') {
        this.dropUp = true;
      } else if (this.dropPosition === 'down') {
        this.dropUp = false;
      } else {
        // Auto detect viewport space below trigger element
        const rect = this.elementRef.nativeElement.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        this.dropUp = spaceBelow < 220;
      }
    }
    this.cdr.markForCheck();
  }

  selectOption(option: SelectOption, event: MouseEvent): void {
    event.stopPropagation();
    this.value = option.value;
    this.valueChange.emit(option.value);
    this.isOpen = false;
    this.searchTerm = '';
    this.cdr.markForCheck();
  }
}