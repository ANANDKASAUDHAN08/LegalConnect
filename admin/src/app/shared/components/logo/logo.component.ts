import {
  Component,
  Input,
  ChangeDetectionStrategy,
  HostBinding
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * Canonical LegalConnect Admin Logo Component
 *
 * Single source of truth for the brand logo across the entire admin panel.
 * Uses the same "balance scale" SVG as the frontend for unified branding.
 *
 * @example
 * <!-- Full logo with text and "ADMIN PANEL" badge -->
 * <admin-logo mode="full" size="md" />
 *
 * <!-- Icon only (collapsed sidebar) -->
 * <admin-logo mode="icon" size="md" />
 *
 * <!-- Large logo for login page -->
 * <admin-logo mode="full" size="lg" />
 */
export type AdminLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type AdminLogoMode = 'full' | 'compact' | 'icon' | 'text';
export type AdminLogoOrientation = 'horizontal' | 'vertical';

/** Pixel dimensions mapped to each named size */
const SIZE_MAP: Record<AdminLogoSize, { box: number; icon: number }> = {
  xs: { box: 28, icon: 16 },
  sm: { box: 32, icon: 18 },
  md: { box: 40, icon: 20 },
  lg: { box: 48, icon: 28 },
  xl: { box: 64, icon: 36 },
};

@Component({
  selector: 'admin-logo',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logo.component.html',
  styleUrl: './logo.component.scss',
})
export class AdminLogoComponent {
  /** Named size preset: xs | sm | md | lg | xl */
  @Input() size: AdminLogoSize = 'md';

  /** Display mode: full (icon + text + label), compact (icon + text), icon (icon only), text (text only) */
  @Input() mode: AdminLogoMode = 'full';

  /** Orientation: horizontal (row) | vertical (column) */
  @Input() orientation: AdminLogoOrientation = 'horizontal';

  /** Brand title (defaults to 'LegalConnect') */
  @Input() title = 'LegalConnect';

  /** Optional custom subtitle (defaults to 'ADMIN PANEL' in full mode) */
  @Input() subtitle?: string;

  /** Optional routerLink — wraps logo in an <a> tag */
  @Input() linkTo?: string;

  /** Enable hover scale animation */
  @Input() animated = true;

  @HostBinding('class') hostClass = 'admin-logo-host';

  get boxSize(): number {
    return SIZE_MAP[this.size]?.box ?? SIZE_MAP.md.box;
  }

  get iconSize(): number {
    return SIZE_MAP[this.size]?.icon ?? SIZE_MAP.md.icon;
  }

  get orientationClass(): string {
    return `admin-logo--${this.orientation}`;
  }

  get sizeClass(): string {
    return `admin-logo--size-${this.size}`;
  }
}
