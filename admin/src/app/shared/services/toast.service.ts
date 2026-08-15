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

  /**
   * Universal Frontend Error Message Sanitizer.
   * Converts any raw backend error, HTTP error response, or exception into clean, human-friendly text.
   */
  private sanitizeMessage(input: any): string {
    if (!input) return 'An unexpected error occurred. Please try again.';

    // 1. If passed an Angular HttpErrorResponse or Object
    if (typeof input === 'object' && !(typeof input === 'string')) {
      if (input.status === 0) {
        return 'Unable to reach the server. Please check your internet connection or backend server status.';
      }
      if (input.status === 401) {
        return 'Your session has expired. Please sign in again.';
      }
      if (input.status === 403) {
        return 'Access denied. You do not have permission to perform this action.';
      }
      if (input.status === 404) {
        return input.error?.message || 'The requested resource could not be found.';
      }
      if (input.status === 413) {
        return 'Uploaded data or file exceeds the maximum allowed size limit.';
      }
      if (input.status === 429) {
        return 'Too many requests. Please wait a few moments and try again.';
      }
      if (input.status >= 500) {
        const backendMsg = input.error?.message;
        if (backendMsg && typeof backendMsg === 'string' && !backendMsg.includes('Internal server error') && backendMsg.length < 120) {
          return this.sanitizeMessage(backendMsg);
        }
        return 'A server error occurred while processing your request. Please try again later.';
      }

      const extracted = input.error?.message || input.error?.error?.message || input.message || input.statusText;
      if (extracted && typeof extracted === 'string') {
        return this.sanitizeMessage(extracted);
      }
    }

    if (typeof input === 'string') {
      let msg = input.trim();

      // Extract nested JSON error if present in string
      if (msg.includes('{') && msg.includes('}')) {
        try {
          const jsonMatch = msg.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            const nested = parsed.message || parsed.error?.message || parsed.error;
            if (nested && typeof nested === 'string' && nested !== msg) {
              return this.sanitizeMessage(nested);
            }
          }
        } catch { }
      }

      const lower = msg.toLowerCase();

      // Authentication & Session
      if (lower.includes('jwt expired') || lower.includes('token expired')) {
        return 'Your session has expired. Please sign in again.';
      }
      if (lower.includes('jwt malformed') || lower.includes('invalid token') || lower.includes('unauthorized')) {
        return 'Authentication required. Please sign in to continue.';
      }
      if (lower.includes('forbidden') || lower.includes('insufficient permissions')) {
        return 'You do not have permission to perform this action.';
      }

      // AI Provider Errors
      if (lower.includes('402') || lower.includes('requires more credits') || lower.includes('can only afford')) {
        return 'AI provider requires account credits or a free model. Please configure a free model (e.g. google/gemini-2.0-flash-exp:free) or add credits in your AI settings.';
      }
      if (lower.includes('invalid api key') || lower.includes('api_key_invalid') || lower.includes('incorrect api key')) {
        return 'AI API key is invalid or unauthorized. Please verify your .env settings.';
      }
      if (lower.includes('429') || lower.includes('rate limit') || lower.includes('quota exceeded')) {
        return 'AI rate limit reached. Please wait a few moments and try again.';
      }

      // Network & Connection
      if (lower.includes('econnrefused') || lower.includes('etimedout') || lower.includes('fetch failed') || lower.includes('network error')) {
        return 'Network connection failed. Please check your internet connection and try again.';
      }

      // Clean tech prefixes
      msg = msg
        .replace(/^Error:\s*/i, '')
        .replace(/^Failed to [^:]+:\s*/i, '')
        .replace(/^OpenRouter Error\s*\(\d+\):\s*/i, '')
        .replace(/^Http failure response for [^:]+:\s*/i, '')
        .replace(/at\s+.+\(.*:\d+:\d+\)/g, '')
        .trim();

      // Avoid ugly raw code / stack trace dumps
      if (msg.includes('Cannot read properties') || msg.includes('is not a function') || msg.includes('Unexpected token')) {
        return 'An unexpected application error occurred. Please try again.';
      }

      // Cap toast length
      if (msg.length > 180) {
        msg = msg.substring(0, 177) + '...';
      }

      return msg;
    }

    return 'An unexpected error occurred. Please try again.';
  }

  show(toast: Omit<ToastNotification, 'id'>): void {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastNotification = {
      id,
      duration: 4000,
      ...toast,
      message: this.sanitizeMessage(toast.message)
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

  error(message: any, title?: string, actionText?: string, onAction?: () => void): void {
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