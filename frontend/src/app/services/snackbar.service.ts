import { Injectable, signal } from '@angular/core';

export type SnackbarType = 'success' | 'error' | 'info' | 'warning';

export interface SnackbarState {
  message: string;
  type: SnackbarType;
  show: boolean;
  actionLabel?: string;
  actionCallback?: () => void;
}

@Injectable({ providedIn: 'root' })
export class SnackbarService {
  snackbar = signal<SnackbarState>({
    message: '',
    type: 'info',
    show: false
  });

  private timeoutRef: any;

  show(
    message: string,
    type: SnackbarType = 'info',
    duration: number = 4000,
    actionLabel?: string,
    actionCallback?: () => void
  ) {
    if (this.timeoutRef) clearTimeout(this.timeoutRef);

    this.snackbar.set({ message, type, show: true, actionLabel, actionCallback });

    // Auto-hide after duration
    this.timeoutRef = setTimeout(() => {
      this.hide();
    }, duration);
  }

  hide() {
    this.snackbar.update(state => ({ ...state, show: false }));
  }

  runAction() {
    const cb = this.snackbar().actionCallback;
    if (cb) cb();
    this.hide();
  }
}