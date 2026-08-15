import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'highlight',
  standalone: true
})
export class HighlightPipe implements PipeTransform {
  transform(text: string | null | undefined, search: string | null | undefined): string {
    if (!text) return '';
    if (!search || !search.trim()) return text;

    const query = search.trim();
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    try {
      // Split text into HTML tag chunks vs raw text chunks to safely highlight only content text
      const parts = text.split(/(<[^>]+>)/g);
      const regex = new RegExp(`(${escapedQuery})`, 'gi');

      return parts.map(part => {
        if (part.startsWith('<') && part.endsWith('>')) {
          return part; // Retain all valid HTML tags (superscripts, defined terms, spans)
        }
        return part.replace(regex, '<mark class="search-highlight">$1</mark>');
      }).join('');
    } catch {
      return text;
    }
  }
}