import { Pipe, PipeTransform } from '@angular/core';
import { getCategoryMeta } from '../config/category-data.config';

/**
 * Pure pipe replacing getCategoryCardClasses(), getCategoryIconClasses(),
 * getCategoryTitleClasses(), getCategoryDescriptionClasses(), getCategoryColorClasses().
 * 
 * Since Angular pure pipes only re-evaluate when inputs change (not every CD cycle),
 * this eliminates the performance cost of calling 5 methods on every *ngFor iteration.
 * 
 * Usage:
 *   [ngClass]="catId | categoryClasses:'card':isActive"
 *   [ngClass]="catId | categoryClasses:'icon':isActive"
 *   [ngClass]="catId | categoryClasses:'title':isActive"
 *   [ngClass]="catId | categoryClasses:'descriptionText':isActive"
 *   [ngClass]="catId | categoryClasses:'color'"
 */
@Pipe({
  name: 'categoryClasses',
  standalone: true,
  pure: true
})
export class CategoryClassesPipe implements PipeTransform {
  transform(catId: string, mode: 'card' | 'icon' | 'title' | 'descriptionText' | 'color', isActive: boolean = false): string {
    const meta = getCategoryMeta(catId);
    const c = meta.colors;

    switch (mode) {
      case 'card':
        if (isActive) {
          return `${c.activeBorder} ${c.activeBg} ring-2 ring-${this.extractColorToken(c.activeBorder)}/10 shadow-sm`;
        }
        return `${c.inactiveBorder} ${c.inactiveBg} hover:${c.activeBorder} ${c.bgHover}`;

      case 'icon':
        if (isActive) return c.activeIconBg;
        // Inactive icon: light bg + color text, hover fills solid
        const hoverClasses = c.activeIconBg.split(' ')
          .map(cls => cls.startsWith('dark:') ? `dark:group-hover:${cls.substring(5)}` : `group-hover:${cls}`)
          .join(' ');
        return `${c.bg} ${c.text} ${hoverClasses}`;


      case 'title':
        if (isActive) return 'font-extrabold text-slate-900 dark:text-white';
        return 'font-bold text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white';

      case 'descriptionText':
        if (isActive) {
          return `${c.text.replace('600', '700').replace('400', '300')} font-semibold`;
        }
        return `${c.text.replace('600', '600').replace('400', '400/80')} group-hover:${c.text.replace('600', '700').replace('400', '300')}`;

      case 'color':
        return c.text;

      default:
        return '';
    }
  }

  private extractColorToken(borderClass: string): string {
    // Extract color from "border-amber-500" → "amber-500"
    const match = borderClass.match(/border-(\w+-\d+)/);
    return match ? match[1] : 'blue-500';
  }
}