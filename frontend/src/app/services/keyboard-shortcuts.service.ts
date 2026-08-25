import { Injectable, signal } from '@angular/core';

export interface ShortcutGroup {
  name: string;
  shortcuts: { keys: string[]; description: string }[];
}

@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  isOpen = signal<boolean>(false);

  readonly shortcutGroups: ShortcutGroup[] = [
    {
      name: 'Global Navigation',
      shortcuts: [
        { keys: ['Ctrl', 'K'], description: 'Open Command Palette & search' },
        { keys: ['?'], description: 'Show keyboard shortcuts helper' },
        { keys: ['Esc'], description: 'Close any active modal or menu' },
        { keys: ['t'], description: 'Toggle Dark / Light theme' },
        { keys: ['h'], description: 'Navigate to Home' }
      ]
    },
    {
      name: 'Search Hub',
      shortcuts: [
        { keys: ['/'], description: 'Focus search input' },
        { keys: ['j', '↓'], description: 'Navigate to next result card' },
        { keys: ['k', '↑'], description: 'Navigate to previous result card' },
        { keys: ['Enter'], description: 'Open or expand selected result' }
      ]
    },
    {
      name: 'Law Reader & Viewer',
      shortcuts: [
        { keys: ['b'], description: 'Toggle bookmark on current section' },
        { keys: ['c'], description: 'Open IPC ↔ BNS comparison modal' },
        { keys: ['r'], description: 'Toggle distraction-free reader mode' },
        { keys: ['['], description: 'Jump to previous section' },
        { keys: [']'], description: 'Jump to next section' }
      ]
    }
  ];

  open() {
    this.isOpen.set(true);
  }

  close() {
    this.isOpen.set(false);
  }

  toggle() {
    this.isOpen.update(v => !v);
  }
}