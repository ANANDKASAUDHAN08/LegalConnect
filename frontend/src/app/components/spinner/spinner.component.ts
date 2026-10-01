import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';
export type SpinnerColor = 'accent' | 'primary' | 'white' | 'muted';

@Component({
  selector: 'app-spinner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './spinner.component.html',
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      line-height: 0;
    }
  `]
})
export class SpinnerComponent {
  @Input() size: SpinnerSize = 'md';
  @Input() color: SpinnerColor = 'accent';
  @Input() label: string = 'Loading...';

  getSizeClass(): string {
    switch (this.size) {
      case 'xs':
        return 'w-3 h-3';
      case 'sm':
        return 'w-4 h-4';
      case 'lg':
        return 'w-8 h-8';
      case 'md':
      default:
        return 'w-5 h-5';
    }
  }

  getColorClass(): string {
    switch (this.color) {
      case 'white':
        return 'text-white';
      case 'primary':
        return 'text-slate-800 dark:text-slate-200';
      case 'muted':
        return 'text-slate-400 dark:text-slate-500';
      case 'accent':
      default:
        return 'text-[hsl(35,92%,47%)]';
    }
  }
}