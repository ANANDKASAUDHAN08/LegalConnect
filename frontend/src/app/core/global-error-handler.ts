import { ErrorHandler, Injectable, Injector, NgZone } from '@angular/core';
import { SnackbarService } from '../services/snackbar.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  constructor(private injector: Injector, private zone: NgZone) { }

  handleError(error: any): void {
    // Extract error message cleanly
    const message = error?.message || error?.toString() || 'An unexpected application error occurred.';

    // Log complete stack trace in dev console for debugging
    console.error('[GlobalErrorHandler Caught Exception]:', error);

    // Filter out minor chunk load errors, browser aborts, or third-party script DOM noise
    if (
      message.includes('Loading chunk') ||
      message.includes('Script error') ||
      message.includes("reading 'style'") ||
      message.includes('recaptcha') ||
      message.includes('element has been removed')
    ) {
      return;
    }

    // Safely trigger user-friendly toast inside Angular Zone
    this.zone.run(() => {
      try {
        const snackbar = this.injector.get(SnackbarService);
        snackbar.show(`Notice: ${message.length > 120 ? message.substring(0, 120) + '...' : message}`, 'error', 5000);
      } catch {
        // Fallback if snackbar service unavailable during app teardown
      }
    });
  }
}