import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectComponent, SelectOption } from '../select/select.component';
import { TooltipDirective } from '../../directives/tooltip.directive';

@Component({
  selector: 'admin-pagination',
  standalone: true,
  imports: [CommonModule, SelectComponent, TooltipDirective],
  templateUrl: './pagination.component.html'
})
export class PaginationComponent {
  @Input() page = 1;
  @Input() limit = 10;
  @Input() total = 0;
  @Input() pages = 1;
  @Output() pageChange = new EventEmitter<number>();
  @Output() limitChange = new EventEmitter<number>();

  limitOptions: SelectOption[] = [
    { label: '10 per page', value: '10' },
    { label: '25 per page', value: '25' },
    { label: '50 per page', value: '50' },
    { label: '100 per page', value: '100' }
  ];

  get startRecord(): number {
    if (this.total === 0) return 0;
    return (this.page - 1) * this.limit + 1;
  }

  get endRecord(): number {
    return Math.min(this.page * this.limit, this.total);
  }

  changePage(newPage: number): void {
    if (newPage >= 1 && newPage <= this.pages) {
      this.pageChange.emit(newPage);
    }
  }

  onLimitChange(val: any): void {
    const newLimit = Number(val) || 10;
    this.limitChange.emit(newLimit);
  }
}