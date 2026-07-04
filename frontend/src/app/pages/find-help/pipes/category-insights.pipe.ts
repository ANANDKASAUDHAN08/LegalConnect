import { Pipe, PipeTransform } from '@angular/core';
import { getCategoryMeta, CategoryInsight } from '../config/category-data.config';

/**
 * Pure pipe replacing getCategoryInsights(activeCategory).
 * The original method returned a fresh object on every call, forcing
 * Angular to re-create bindings. This pipe caches by catId.
 * 
 * Usage: 
 *   *ngFor="let faq of (activeCategory | categoryInsights).faqs"
 *   *ngFor="let prompt of (activeCategory | categoryInsights).prompts"
 */
@Pipe({
  name: 'categoryInsights',
  standalone: true,
  pure: true
})
export class CategoryInsightsPipe implements PipeTransform {
  transform(catId: string): CategoryInsight {
    return getCategoryMeta(catId).insights;
  }
}