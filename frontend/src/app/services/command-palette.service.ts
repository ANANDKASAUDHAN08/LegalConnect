import { Injectable, inject } from '@angular/core';
import { GlobalSearchService } from './global-search.service';

/**
 * CommandPaletteService — Backward-compatible wrapper delegating to GlobalSearchService.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  private globalSearch = inject(GlobalSearchService);

  toggle$ = this.globalSearch.isOpen$;

  open(query = '') {
    this.globalSearch.open(query);
  }

  close() {
    this.globalSearch.close();
  }

  toggle() {
    this.globalSearch.toggle();
  }
}