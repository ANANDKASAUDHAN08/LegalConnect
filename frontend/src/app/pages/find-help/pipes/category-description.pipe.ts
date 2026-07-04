import { Pipe, PipeTransform } from '@angular/core';
import { getCategoryMeta } from '../config/category-data.config';

/**
 * Pure pipe replacing getCategoryDescription(catId, isMobile).
 * 
 * Usage: {{ catId | categoryDescription:isMobile }}
 */
@Pipe({
  name: 'categoryDescription',
  standalone: true,
  pure: true
})
export class CategoryDescriptionPipe implements PipeTransform {
  transform(catId: string, isMobile: boolean = false): string {
    const meta = getCategoryMeta(catId);
    return isMobile ? meta.shortDesc : meta.fullDesc;
  }
}