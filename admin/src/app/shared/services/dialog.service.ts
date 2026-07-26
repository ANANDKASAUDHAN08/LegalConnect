import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface DialogOptions {
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
}

export interface ActiveDialog extends DialogOptions {
  resolve: (result: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  private dialogSubject = new BehaviorSubject<ActiveDialog | null>(null);
  dialog$ = this.dialogSubject.asObservable();

  get activeDialog(): ActiveDialog | null {
    return this.dialogSubject.value;
  }

  confirm(options: DialogOptions | string, message?: string, confirmText = 'Confirm', cancelText = 'Cancel'): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let opts: DialogOptions;
      if (typeof options === 'string') {
        opts = {
          title: options,
          message: message || '',
          confirmText,
          cancelText,
          type: 'warning',
          isAlert: false
        };
      } else {
        opts = {
          confirmText: options.confirmText || 'Confirm',
          cancelText: options.cancelText || 'Cancel',
          type: options.type || 'warning',
          isAlert: false,
          ...options
        };
      }

      this.dialogSubject.next({
        ...opts,
        resolve
      });
    });
  }

  danger(title: string, message: string, confirmText = 'Delete Permanently', cancelText = 'Cancel'): Promise<boolean> {
    return this.confirm({
      title,
      message,
      confirmText,
      cancelText,
      type: 'danger'
    });
  }

  warning(title: string, message: string, confirmText = 'Proceed', cancelText = 'Cancel'): Promise<boolean> {
    return this.confirm({
      title,
      message,
      confirmText,
      cancelText,
      type: 'warning'
    });
  }

  alert(title: string, message: string, buttonText = 'Understand', type: 'info' | 'success' | 'warning' | 'danger' = 'info'): Promise<void> {
    return new Promise<void>((resolve) => {
      this.dialogSubject.next({
        title,
        message,
        confirmText: buttonText,
        type,
        isAlert: true,
        resolve: () => resolve()
      });
    });
  }

  respond(result: boolean): void {
    const current = this.dialogSubject.value;
    if (current) {
      current.resolve(result);
      this.dialogSubject.next(null);
    }
  }
}