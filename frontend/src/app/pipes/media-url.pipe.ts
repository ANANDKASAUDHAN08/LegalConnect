import { Pipe, PipeTransform } from '@angular/core';
import { normalizeMediaUrl } from '../core/utils/url-utils';

/**
 * Transforms any avatar or uploaded media URL into a clean, relative path.
 * Automatically strips hardcoded dev/gateway hosts (e.g., http://localhost:8888)
 * and ensures safe resolution through the Angular proxy or production domain.
 */
@Pipe({
  name: 'mediaUrl',
  standalone: true,
  pure: true
})
export class MediaUrlPipe implements PipeTransform {
  transform(url?: string | null): string {
    if (!url) return '';
    return normalizeMediaUrl(url) || '';
  }
}