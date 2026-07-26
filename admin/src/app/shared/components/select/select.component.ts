import { Component, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SelectOption {
  label: string;
  value: any;
  icon?: string;
}

@Component({
  selector: 'admin-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss'
})
export class SelectComponent {
  @Input() options: SelectOption[] = [];
  @Input() value: any = '';
  @Input() placeholder: string = 'Select Option';
  @Input() width: string = 'auto';
  @Input() minWidth: string = '160px';
  @Input() icon?: string;

  @Output() valueChange = new EventEmitter<any>();

  isOpen = false;

  constructor(private elementRef: ElementRef) { }

  get selectedOption(): SelectOption | undefined {
    return this.options.find(o => String(o.value ?? '') === String(this.value ?? ''));
  }

  isSelected(optValue: any): boolean {
    return String(optValue ?? '') === String(this.value ?? '');
  }

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  selectOption(option: SelectOption, event: MouseEvent): void {
    event.stopPropagation();
    this.value = option.value;
    this.valueChange.emit(option.value);
    this.isOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }
}
