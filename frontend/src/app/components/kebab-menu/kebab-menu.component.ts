import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  signal,
  computed,
  HostListener,
  ElementRef,
  OnDestroy,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { IconName } from '../icon/icon.types';
import { TooltipDirective } from '../../directives/tooltip.directive';
import { KebabActionGroup, KebabActionItem, KebabActionEvent } from './kebab-menu.types';
import { KebabMenuContract, KebabMenuService } from './kebab-menu.service';

@Component({
  selector: 'app-kebab-menu',
  standalone: true,
  imports: [CommonModule, IconComponent, TooltipDirective],
  templateUrl: './kebab-menu.component.html',
  styleUrls: ['./kebab-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KebabMenuComponent implements KebabMenuContract, OnDestroy {
  private elementRef = inject(ElementRef);
  private kebabService = inject(KebabMenuService);

  // Structured Actions
  @Input() groups: KebabActionGroup[] = [];
  @Input() items: KebabActionItem[] = []; // Flat list alternative

  // Trigger Button Customization
  @Input() buttonClass =
    'w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 select-none hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300';
  @Input() activeClass = '!bg-blue-600 !text-white !border-blue-600 shadow-md';
  @Input() tooltipText = 'Instant Actions Menu';
  @Input() tooltipPlacement: 'top' | 'bottom' | 'left' | 'right' = 'left';
  @Input() icon: IconName = 'more-vertical';
  @Input() iconSize = 14;
  @Input() ariaLabel = 'Actions Menu';

  // Menu Dropdown Customization
  @Input() menuWidth = 'w-72';
  @Input() menuClass = '';
  @Input() closeOnItemClick = true;

  // Events
  @Output() itemClick = new EventEmitter<KebabActionEvent>();
  @Output() openChange = new EventEmitter<boolean>();

  // Internal State
  isOpen = signal<boolean>(false);
  menuStyles = signal<Record<string, string>>({});

  // Computed Groups (combines groups or wraps items in default group)
  effectiveGroups = computed(() => {
    if (this.groups && this.groups.length > 0) {
      return this.groups
        .filter(g => g.visible !== false)
        .map(g => ({
          ...g,
          items: (g.items || []).filter(item => item.visible !== false)
        }))
        .filter(g => g.items.length > 0);
    }
    if (this.items && this.items.length > 0) {
      return [
        {
          items: this.items.filter(item => item.visible !== false)
        }
      ];
    }
    return [];
  });

  toggle(event: Event): void {
    event.stopPropagation();
    if (this.isOpen()) {
      this.close();
    } else {
      this.open(event);
    }
  }

  open(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    // Register with global service (auto-closes any other open kebab menu)
    this.kebabService.registerOpen(this);

    const triggerEl = this.elementRef.nativeElement.querySelector('button');
    if (triggerEl && typeof window !== 'undefined') {
      const rect = triggerEl.getBoundingClientRect();
      // Estimated height: group headers + items + padding
      const totalItems = this.effectiveGroups().reduce((acc, g) => acc + g.items.length, 0);
      const totalGroups = this.effectiveGroups().length;
      const estimatedHeight = Math.min(480, Math.max(160, totalGroups * 26 + totalItems * 50 + 24));

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      const styles: Record<string, string> = {
        position: 'fixed',
        zIndex: '2500',
        right: `${Math.max(16, viewportWidth - rect.right)}px`
      };

      let top: number;
      if (spaceBelow >= estimatedHeight + 12) {
        // Plenty of space below the button -> open downward
        top = rect.bottom + 6;
      } else if (spaceAbove >= estimatedHeight + 12) {
        // Plenty of space above the button -> open upward
        top = rect.top - estimatedHeight - 6;
      } else {
        // Limited space on both ends: center vertically around the button
        const buttonCenterY = rect.top + rect.height / 2;
        top = buttonCenterY - estimatedHeight / 2;
      }

      // Strictly clamp top within visible viewport bounds
      const maxTop = Math.max(16, viewportHeight - estimatedHeight - 16);
      top = Math.max(16, Math.min(top, maxTop));

      styles['top'] = `${Math.round(top)}px`;
      styles['maxHeight'] = 'calc(100vh - 32px)';

      this.menuStyles.set(styles);
    }

    this.isOpen.set(true);
    this.openChange.emit(true);
  }

  close(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      this.kebabService.registerClose(this);
      this.openChange.emit(false);
    }
  }

  onItemClick(item: KebabActionItem, event: Event): void {
    event.stopPropagation();
    if (item.disabled) return;

    if (item.onClick) {
      item.onClick(event);
    }
    this.itemClick.emit({ item, event });

    if (this.closeOnItemClick) {
      this.close();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const target = event.target as Node;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.close();
    }
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onWindowChange(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.isOpen()) {
      this.close();
    }
  }

  ngOnDestroy(): void {
    this.kebabService.registerClose(this);
    if (this.isOpen()) {
      this.openChange.emit(false);
    }
  }
}