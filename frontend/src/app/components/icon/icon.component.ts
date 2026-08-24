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
  template: `
    <span
      class="icon-inner"
      [class.icon-spin]="spin"
      [style.color]="color || 'inherit'"
      [innerHTML]="svgContent"
      [attr.aria-label]="ariaLabel"
      [attr.aria-hidden]="!ariaLabel">
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      line-height: 0;
      flex-shrink: 0;
      overflow: hidden;
    }

    .icon-inner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      line-height: 0;
      flex-shrink: 0;

      ::ng-deep svg {
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        max-height: 100% !important;
        display: block;
      }
    }

    .icon-spin {
      animation: icon-spin 1s linear infinite;
    }

    @keyframes icon-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `],
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

  // Enforce host element dimensions so SVGs never stretch or blow up
  @HostBinding('style.width') get hostWidth(): string { return this.formattedSize; }
  @HostBinding('style.height') get hostHeight(): string { return this.formattedSize; }
  @HostBinding('style.min-width') get hostMinWidth(): string { return this.formattedSize; }
  @HostBinding('style.min-height') get hostMinHeight(): string { return this.formattedSize; }
  @HostBinding('style.max-width') get hostMaxWidth(): string { return this.formattedSize; }
  @HostBinding('style.max-height') get hostMaxHeight(): string { return this.formattedSize; }

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