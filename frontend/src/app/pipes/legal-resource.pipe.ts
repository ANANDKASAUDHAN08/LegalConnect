import { Pipe, PipeTransform } from '@angular/core';
import { getResourceTypeLabel, getResourceTypeBadgeClass } from '../core/constants/legal-resource.constants';

@Pipe({
  name: 'resourceTypeLabel',
  standalone: true,
  pure: true
})
export class ResourceTypeLabelPipe implements PipeTransform {
  transform(type?: string | null, lang: 'en' | 'hi' = 'en'): string {
    return getResourceTypeLabel(type, lang);
  }
}

@Pipe({
  name: 'resourceTypeBadge',
  standalone: true,
  pure: true
})
export class ResourceTypeBadgePipe implements PipeTransform {
  transform(type?: string | null): string {
    return getResourceTypeBadgeClass(type);
  }
}

/** Convenience bundle array for Angular standalone component imports */
export const LEGAL_RESOURCE_PIPES = [
  ResourceTypeLabelPipe,
  ResourceTypeBadgePipe
] as const;