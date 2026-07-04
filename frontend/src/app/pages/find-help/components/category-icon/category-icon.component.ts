import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable SVG icon renderer for legal categories.
 * Replaces 4 separate duplicated icon blocks (mobile grid, desktop sidebar, detail card, autocomplete).
 * 
 * Usage: <app-category-icon [icon]="cat.icon" [size]="'md'" />
 */
@Component({
  selector: 'app-category-icon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './category-icon.component.html',
  styleUrls: ['./category-icon.component.scss']
})
export class CategoryIconComponent {
  @Input() icon: string = 'question';
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'md';

  get sizeClass(): string {
    switch (this.size) {
      case 'xs': return 'w-3 h-3';
      case 'sm': return 'w-4 h-4';
      case 'md': return 'w-5 h-5';
      case 'lg': return 'w-8 h-8';
      default: return 'w-5 h-5';
    }
  }

  get strokeWidth(): string {
    return this.size === 'xs' || this.size === 'sm' ? '2.5' : '2';
  }
}