import { Injectable, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICON_REGISTRY } from './icon.registry';
import { IconName } from './icon.types';

@Injectable({
  providedIn: 'root'
})
export class IconService {
  private sanitizer = inject(DomSanitizer);
  private customIcons = new Map<string, string>();
  private safeHtmlCache = new Map<string, SafeHtml>();

  /**
   * Register a custom icon or override an existing icon definition
   */
  registerIcon(name: string, svg: string): void {
    this.customIcons.set(name.toLowerCase(), svg);
    this.safeHtmlCache.delete(name.toLowerCase());
  }

  /**
   * Get raw SVG string with guaranteed 100% dimensions
   */
  getSvgString(name: string | IconName): string {
    const key = (name || '').toLowerCase();
    let svg = this.customIcons.get(key) || ICON_REGISTRY[key] || ICON_REGISTRY['help-circle'] || '';
    if (svg && !svg.includes('width=')) {
      svg = svg.replace('<svg', '<svg width="100%" height="100%"');
    }
    return svg;
  }

  /**
   * Get SafeHtml for an icon with caching to avoid repetitive DOM sanitization
   */
  getSafeSvg(name: string | IconName): SafeHtml {
    const key = (name || '').toLowerCase();
    if (this.safeHtmlCache.has(key)) {
      return this.safeHtmlCache.get(key)!;
    }

    const svg = this.getSvgString(key);
    const safeHtml = this.sanitizer.bypassSecurityTrustHtml(svg);
    this.safeHtmlCache.set(key, safeHtml);
    return safeHtml;
  }

  /**
   * Check if icon is registered
   */
  hasIcon(name: string | IconName): boolean {
    const key = (name || '').toLowerCase();
    return this.customIcons.has(key) || key in ICON_REGISTRY;
  }
}