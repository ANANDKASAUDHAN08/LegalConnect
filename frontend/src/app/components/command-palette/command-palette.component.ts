import { Component, OnInit, OnDestroy, HostListener, ElementRef, ViewChild, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../services/theme.service';
import { CommandPaletteService } from '../../services/command-palette.service';
import { KeyboardShortcutsService } from '../../services/keyboard-shortcuts.service';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon.types';
import { Subscription } from 'rxjs';

/**
 * Command Palette — ⌘K / Ctrl+K modal
 *
 * Inspired by Linear, Vercel, GitHub command palettes.
 * Shows recent searches, quick navigation actions, and allows
 * searching across laws by navigating to /search?q=<query>.
 */

interface PaletteAction {
  id: string;
  label: string;
  description?: string;
  icon: IconName | string;
  category: 'navigation' | 'recent' | 'action';
  route?: string;
  queryParams?: Record<string, string>;
  callback?: () => void;
  shortcut?: string;
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule, FocusTrapDirective, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './command-palette.component.html',
  styleUrls: ['./command-palette.component.scss']
})
export class CommandPaletteComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('palettePanel') palettePanelRef!: ElementRef;

  isOpen = false;
  query = '';
  selectedIndex = 0;

  recentActions: PaletteAction[] = [];
  quickActions: PaletteAction[] = [];
  filteredActions: PaletteAction[] = [];

  private allActions: PaletteAction[] = [];
  private toggleSub!: Subscription;

  constructor(
    private router: Router,
    private cdr: ChangeDetectorRef,
    private themeService: ThemeService,
    private paletteService: CommandPaletteService,
    private shortcutsService: KeyboardShortcutsService
  ) { }

  ngOnInit() {
    this.buildQuickActions();
    this.toggleSub = this.paletteService.toggle$.subscribe(() => this.toggle());
  }

  ngOnDestroy() {
    this.toggleSub?.unsubscribe();
  }

  /** Build the list of static navigation actions using the app icon registry */
  private buildQuickActions() {
    this.allActions = [
      { id: 'search', label: 'Legal Search', description: 'Search across all acts, sections & laws', icon: 'search', category: 'navigation', route: '/search' },
      { id: 'browse-laws', label: 'Browse Bare Acts', description: 'Full library of Indian legal acts', icon: 'book-open', category: 'navigation', route: '/laws' },
      { id: 'find-lawyers', label: 'Find a Lawyer', description: 'Verified advocates near you', icon: 'briefcase', category: 'navigation', route: '/lawyers' },
      { id: 'know-rights', label: 'Know Your Rights', description: 'Rights checker & emergency info', icon: 'shield-check', category: 'navigation', route: '/find-help' },
      { id: 'law-mapper', label: 'IPC ↔ BNS Mapper', description: 'Convert between old & new criminal codes', icon: 'scale', category: 'navigation', route: '/laws/mapper' },
      { id: 'templates', label: 'Legal Templates', description: 'Draft notices, complaints & applications', icon: 'file-text', category: 'navigation', route: '/laws/templates' },
      { id: 'civil-family', label: 'Civil & Family Law', description: 'Property, divorce, inheritance guides', icon: 'users', category: 'navigation', route: '/laws/civil-family' },
      { id: 'legal-resources', label: 'Legal Aid Centers', description: 'Courts, DLSA & free legal aid clinics', icon: 'landmark', category: 'navigation', route: '/legal-resources' },
      { id: 'dashboard', label: 'My Dashboard', description: 'Bookmarks, notes & saved items', icon: 'bookmark', category: 'navigation', route: '/dashboard' },
      { id: 'settings', label: 'Settings', description: 'Theme, accessibility & preferences', icon: 'settings', category: 'navigation', route: '/settings' },
      { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts', description: 'View all keyboard shortcuts & navigation hotkeys', icon: 'command', category: 'action', shortcut: '?', callback: () => this.shortcutsService.open() },
      { id: 'toggle-theme', label: 'Toggle Dark Mode', description: 'Switch between light & dark theme', icon: 'moon', category: 'action', callback: () => this.themeService.toggleTheme() },
      { id: 'home', label: 'Home', description: 'Back to landing page', icon: 'home', category: 'navigation', route: '/home' },
    ];

    this.quickActions = this.allActions;
  }

  /** Load recent searches from localStorage */
  private loadRecents() {
    try {
      const hist = localStorage.getItem('lc_search_history');
      if (hist) {
        const items: string[] = JSON.parse(hist).slice(0, 5);
        this.recentActions = items.map((q, i) => ({
          id: `recent-${i}`,
          label: q,
          icon: 'search' as IconName,
          category: 'recent' as const,
          route: '/search',
          queryParams: { q },
        }));
      }
    } catch {
      this.recentActions = [];
    }
  }

  /** Open the command palette */
  open() {
    this.isOpen = true;
    this.query = '';
    this.selectedIndex = 0;
    this.filteredActions = [];
    this.loadRecents();
    this.cdr.markForCheck();

    // Focus the input after render
    setTimeout(() => {
      this.searchInputRef?.nativeElement?.focus();
    }, 50);

    // Prevent body scrolling
    document.body.style.overflow = 'hidden';
  }

  /** Close the command palette */
  close() {
    this.isOpen = false;
    this.query = '';
    this.cdr.markForCheck();
    document.body.style.overflow = '';
  }

  /** Toggle open/close */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /** Filter actions based on query */
  onQueryChange() {
    const q = this.query.trim().toLowerCase();
    if (!q) {
      this.filteredActions = [];
      this.selectedIndex = 0;
      return;
    }

    this.filteredActions = this.allActions.filter(action => {
      const label = action.label.toLowerCase();
      const desc = (action.description || '').toLowerCase();
      return label.includes(q) || desc.includes(q);
    });
    this.selectedIndex = 0;
  }

  /** Handle keyboard navigation */
  onInputKeydown(event: KeyboardEvent) {
    const totalItems = this.getTotalItems();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % Math.max(totalItems, 1);
        this.scrollActiveIntoView();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1);
        this.scrollActiveIntoView();
        break;

      case 'Enter':
        event.preventDefault();
        this.executeSelectedAction();
        break;

      case 'Escape':
        event.preventDefault();
        this.close();
        break;
    }
    this.cdr.markForCheck();
  }

  /** Get total items count depending on state */
  private getTotalItems(): number {
    if (this.query.trim()) {
      return this.filteredActions.length + 1; // +1 for "Search for..." fallback
    }
    return this.recentActions.length + this.quickActions.length;
  }

  /** Execute action at current selectedIndex */
  private executeSelectedAction() {
    if (this.query.trim()) {
      if (this.selectedIndex < this.filteredActions.length) {
        this.executeAction(this.filteredActions[this.selectedIndex]);
      } else {
        this.searchForQuery();
      }
    } else {
      const allVisible = [...this.recentActions, ...this.quickActions];
      if (this.selectedIndex < allVisible.length) {
        this.executeAction(allVisible[this.selectedIndex]);
      }
    }
  }

  /** Execute a palette action */
  executeAction(action: PaletteAction) {
    this.close();

    if (action.callback) {
      action.callback();
      return;
    }

    if (action.route) {
      if (action.queryParams) {
        this.router.navigate([action.route], { queryParams: action.queryParams });
      } else {
        this.router.navigate([action.route]);
      }
    }
  }

  /** Navigate to search with current query */
  searchForQuery() {
    const q = this.query.trim();
    if (!q) return;
    this.close();
    this.router.navigate(['/search'], { queryParams: { q } });
  }

  /** Clear recent searches */
  clearRecents(event: Event) {
    event.stopPropagation();
    localStorage.removeItem('lc_search_history');
    this.recentActions = [];
    this.selectedIndex = 0;
    this.cdr.markForCheck();
  }

  /** TrackBy function for *ngFor loops */
  trackByActionId(_index: number, action: PaletteAction): string {
    return action.id;
  }

  /** Scroll active item into view */
  private scrollActiveIntoView() {
    setTimeout(() => {
      const activeEl = this.palettePanelRef?.nativeElement?.querySelector('.palette-item-active');
      activeEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 10);
  }
}