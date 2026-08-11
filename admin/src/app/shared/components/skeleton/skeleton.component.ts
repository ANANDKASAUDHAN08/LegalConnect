import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'admin-skeleton',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.scss'
})
export class SkeletonComponent {
  @Input() type: 'line' | 'card' | 'table' | 'grid' | 'reader' | 'stat' = 'line';
  @Input() width = '100%';
  @Input() height = '20px';
  @Input() borderRadius = '12px';
  @Input() count = 3;

  get countArray(): number[] {
    return Array.from({ length: this.count }, (_, i) => i);
  }
}