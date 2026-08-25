import { Component, ChangeDetectionStrategy, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeyboardShortcutsService } from '../../services/keyboard-shortcuts.service';
import { FocusTrapDirective } from '../../directives/focus-trap.directive';

@Component({
  selector: 'app-keyboard-shortcuts-modal',
  standalone: true,
  imports: [CommonModule, FocusTrapDirective],
  templateUrl: './keyboard-shortcuts-modal.component.html',
  styleUrls: ['./keyboard-shortcuts-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KeyboardShortcutsModalComponent {
  shortcutService = inject(KeyboardShortcutsService);

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    const isEditing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || target.tagName === 'SELECT';

    if (event.key === '?' && !isEditing) {
      event.preventDefault();
      this.shortcutService.toggle();
    } else if (event.key === 'Escape' && this.shortcutService.isOpen()) {
      event.preventDefault();
      this.shortcutService.close();
    }
  }

  close() {
    this.shortcutService.close();
  }
}