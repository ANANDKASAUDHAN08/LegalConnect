import { Component, Input, Output, EventEmitter, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ColumnDef {
  key: string;
  label: string;
}

@Component({
  selector: 'admin-column-customizer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'column-customizer.component.html'
})
export class ColumnCustomizerComponent {
  @Input() columns: ColumnDef[] = [];
  @Input() visibility: Record<string, boolean> = {};
  @Output() visibilityChange = new EventEmitter<Record<string, boolean>>();

  isOpen = false;

  get areAllVisible(): boolean {
    return this.columns.length > 0 && this.columns.every(c => this.visibility[c.key]);
  }

  get areNoneVisible(): boolean {
    return this.columns.length > 0 && this.columns.every(c => !this.visibility[c.key]);
  }

  get isCustomized(): boolean {
    return this.columns.length > 0 && !this.areAllVisible;
  }

  toggleOpen(): void {
    this.isOpen = !this.isOpen;
  }

  toggleColumn(key: string): void {
    const updated = { ...this.visibility, [key]: !this.visibility[key] };
    this.visibilityChange.emit(updated);
  }

  toggleAll(): void {
    const target = !this.areAllVisible;
    const updated: Record<string, boolean> = {};
    this.columns.forEach(c => updated[c.key] = target);
    this.visibilityChange.emit(updated);
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent): void {
    if (this.isOpen && !this.elRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen) {
      this.isOpen = false;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.isOpen) {
      this.isOpen = false;
    }
  }

  constructor(private elRef: ElementRef) { }
}