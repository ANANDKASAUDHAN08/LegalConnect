import {
  Component,
  Input,
  ChangeDetectionStrategy,
  HostBinding
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * Canonical LegalConnect Logo Component
 *
 * Single source of truth for the application logo across the entire frontend.
 * Supports multiple sizes, display modes, and theme variants.
 *
 * @example
 * <!-- Full logo with text and tagline -->
 * <app-logo mode="full" size="md" linkTo="/home" />
 *
 * <!-- Icon only -->
 * <app-logo mode="icon" size="sm" />
 *
 * <!-- Compact (icon + name, no tagline) -->
 * <app-logo mode="compact" size="lg" theme="dark" />
 */
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type LogoMode = 'full' | 'compact' | 'icon' | 'text';
export type LogoTheme = 'auto' | 'light' | 'dark';
export type LogoOrientation = 'horizontal' | 'vertical';

/** Pixel dimensions mapped to each named size */
const SIZE_MAP: Record<LogoSize, { box: number; icon: number }> = {
  xs: { box: 28, icon: 16 },
  sm: { box: 32, icon: 18 },
  md: { box: 40, icon: 24 },
  lg: { box: 48, icon: 28 },
  xl: { box: 64, icon: 36 },
};

@Component({
  selector: 'app-logo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logo.component.html',
  styleUrl: './logo.component.scss',
})
export class LogoComponent {
  /** Named size preset: xs | sm | md | lg | xl */
  @Input() size: LogoSize = 'md';

  /** Display mode: full (icon+text+tagline), compact (icon+text), icon (icon only), text (text only) */
  @Input() mode: LogoMode = 'full';

  /** Color theme: auto (inherits from page), light, dark */
  @Input() theme: LogoTheme = 'auto';

  /** Orientation: horizontal (row) | vertical (column) */
  @Input() orientation: LogoOrientation = 'horizontal';

  /** Optional routerLink — wraps logo in an <a> tag */
  @Input() linkTo?: string;

  /** Enable hover scale animation on the icon badge */
  @Input() animated = true;

  @HostBinding('class') hostClass = 'lc-logo-host';

  get boxSize(): number {
    return SIZE_MAP[this.size]?.box ?? SIZE_MAP.md.box;
  }

  get iconSize(): number {
    return SIZE_MAP[this.size]?.icon ?? SIZE_MAP.md.icon;
  }

  get themeClass(): string {
    return `lc-logo--${this.theme}`;
  }

  get orientationClass(): string {
    return `lc-logo--${this.orientation}`;
  }

  get sizeClass(): string {
    return `lc-logo--size-${this.size}`;
  }
}