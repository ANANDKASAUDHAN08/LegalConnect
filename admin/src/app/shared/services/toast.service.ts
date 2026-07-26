import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
  duration?: number;
  actionText?: string;
  onAction?: () => void;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toastsSubject = new BehaviorSubject<ToastNotification[]>([]);
  toasts$ = this.toastsSubject.asObservable();

  show(toast: Omit<ToastNotification, 'id'>): void {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastNotification = {
      id,
      duration: 4000,
      ...toast
    };

    const currentToasts = this.toastsSubject.value;
    this.toastsSubject.next([...currentToasts, newToast]);

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => this.remove(id), newToast.duration);
    }
  }

  success(message: string, title?: string, actionText?: string, onAction?: () => void): void {
    this.show({ type: 'success', message, title, actionText, onAction });
  }

  error(message: string, title?: string, actionText?: string, onAction?: () => void): void {
    this.show({ type: 'error', message, title, actionText, onAction });
  }

  info(message: string, title?: string, actionText?: string, onAction?: () => void): void {
    this.show({ type: 'info', message, title, actionText, onAction });
  }

  warning(message: string, title?: string, actionText?: string, onAction?: () => void): void {
    this.show({ type: 'warning', message, title, actionText, onAction });
  }

  remove(id: string): void {
    this.toastsSubject.next(this.toastsSubject.value.filter(t => t.id !== id));
  }
}