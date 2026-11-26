import {
  Component,
  Input,
  ChangeDetectionStrategy,
  HostBinding,
  inject,
  OnChanges,
  SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IconService } from './icon.service';
import { IconName, IconSize } from './icon.types';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon.component.html',
  styleUrls: ['./icon.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class IconComponent implements OnChanges {
  @Input() name: IconName | string = '';
  @Input() size: IconSize = 16;
  @Input() color?: string;
  @Input() strokeWidth?: number | string;
  @Input() ariaLabel?: string;
  @Input() rawSvg?: string;
  @Input() spin = false;

  @HostBinding('class') @Input() class = '';

  // Host size variable allows clean, responsive Tailwind override (w-*, h-*, sm:w-*, etc.)
  @HostBinding('style.--app-icon-size') get hostIconSize(): string {
    return this.formattedSize;
  }

  private iconService = inject(IconService);
  private sanitizer = inject(DomSanitizer);
  svgContent: SafeHtml = '';

  ngOnChanges(changes: SimpleChanges): void {
    this.updateSvgContent();
  }

  get formattedSize(): string {
    if (typeof this.size === 'number') {
      return `${this.size}px`;
    }
    switch (this.size) {
      case 'xs': return '12px';
      case 'sm': return '14px';
      case 'md': return '18px';
      case 'lg': return '24px';
      case 'xl': return '32px';
      default: {
        const str = String(this.size || '16px').trim();
        if (/^\d+(\.\d+)?$/.test(str)) {
          return `${str}px`;
        }
        return str || '16px';
      }
    }
  }

  private updateSvgContent(): void {
    if (this.rawSvg) {
      this.svgContent = this.sanitizer.bypassSecurityTrustHtml(this.rawSvg);
    } else if (this.name) {
      this.svgContent = this.iconService.getSafeSvg(this.name);
    } else {
      this.svgContent = '';
    }
  }
}