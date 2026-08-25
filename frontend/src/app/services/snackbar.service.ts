import { Injectable, signal, computed } from '@angular/core';

export type SnackbarType = 'success' | 'error' | 'info' | 'warning';

export interface SnackbarItem {
  id: number;
  message: string;
  type: SnackbarType;
  actionLabel?: string;
  actionCallback?: () => void;
  /** Duration in ms before auto-dismiss. 0 = sticky (manual dismiss only) */
  duration: number;
  /** Timestamp when this toast was created */
  createdAt: number;
  /** Whether this toast is currently exiting (slide-out animation) */
  exiting?: boolean;
}

/** Legacy single-toast interface for backward compatibility */
export interface SnackbarState {
  message: string;
  type: SnackbarType;
  show: boolean;
  actionLabel?: string;
  actionCallback?: () => void;
}

const MAX_VISIBLE = 3;
let nextId = 0;

/**
 * Upgraded SnackbarService — Queue-based with undo pattern.
 *
 * Changes from original:
 * 1. Queue-based: multiple toasts stack (max 3 visible)
 * 2. Undo pattern: show(message, type, duration, 'Undo', undoFn)
 * 3. Slide-out dismiss animation via `exiting` flag
 * 4. Backward-compatible: existing show() calls work unchanged
 * 5. Legacy `snackbar` signal maintained for existing component binding
 */
@Injectable({ providedIn: 'root' })
export class SnackbarService {
  /** Queue of active toast items */
  toasts = signal<SnackbarItem[]>([]);

  /** Visible toasts (max 3) */
  visibleToasts = computed(() => this.toasts().slice(0, MAX_VISIBLE));

  /** Legacy backward-compatible signal — maps to the newest toast */
  snackbar = computed<SnackbarState>(() => {
    const items = this.toasts();
    if (items.length === 0) {
      return { message: '', type: 'info', show: false };
    }
    const latest = items[0];
    return {
      message: latest.message,
      type: latest.type,
      show: true,
      actionLabel: latest.actionLabel,
      actionCallback: latest.actionCallback
    };
  });

  private timeoutMap = new Map<number, ReturnType<typeof setTimeout>>();

  /**
   * Show a toast notification.
   * Backward-compatible with the original API signature.
   */
  show(
    message: string,
    type: SnackbarType = 'info',
    duration: number = 4000,
    actionLabel?: string,
    actionCallback?: () => void
  ) {
    const id = ++nextId;
    const item: SnackbarItem = {
      id,
      message,
      type,
      duration,
      actionLabel,
      actionCallback,
      createdAt: Date.now()
    };

    // Add to front of queue
    this.toasts.update(items => {
      const updated = [item, ...items];
      // Trim excess items beyond max visible
      if (updated.length > MAX_VISIBLE) {
        // Clear timeouts for removed items
        updated.slice(MAX_VISIBLE).forEach(t => this.clearItemTimeout(t.id));
        return updated.slice(0, MAX_VISIBLE);
      }
      return updated;
    });

    // Auto-dismiss after duration
    if (duration > 0) {
      const timeout = setTimeout(() => {
        this.dismiss(id);
      }, duration);
      this.timeoutMap.set(id, timeout);
    }

    return id;
  }

  /**
   * Convenience method for undo-style toasts.
   * Shows a toast with an "Undo" action button.
   */
  showWithUndo(
    message: string,
    undoCallback: () => void,
    type: SnackbarType = 'success',
    duration: number = 5000
  ) {
    return this.show(message, type, duration, 'Undo', undoCallback);
  }

  /**
   * Dismiss a specific toast by id with slide-out animation.
   */
  dismiss(id: number) {
    // Mark as exiting for animation
    this.toasts.update(items =>
      items.map(t => t.id === id ? { ...t, exiting: true } : t)
    );

    // Remove after animation completes
    setTimeout(() => {
      this.toasts.update(items => items.filter(t => t.id !== id));
      this.clearItemTimeout(id);
    }, 200);
  }

  /**
   * Legacy hide() — dismisses the most recent toast.
   */
  hide() {
    const items = this.toasts();
    if (items.length > 0) {
      this.dismiss(items[0].id);
    }
  }

  /**
   * Run the action callback on a specific toast, then dismiss it.
   */
  runAction(id?: number) {
    const items = this.toasts();
    const target = id ? items.find(t => t.id === id) : items[0];
    if (target?.actionCallback) {
      target.actionCallback();
    }
    if (target) {
      this.dismiss(target.id);
    }
  }

  /**
   * Dismiss all toasts.
   */
  dismissAll() {
    this.timeoutMap.forEach((timeout) => clearTimeout(timeout));
    this.timeoutMap.clear();
    this.toasts.set([]);
  }

  private clearItemTimeout(id: number) {
    const timeout = this.timeoutMap.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.timeoutMap.delete(id);
    }
  }
}