import { ErrorHandler, Injectable, inject } from '@angular/core';

/**
 * Enterprise Application Error Boundary and Unhandled Exception Dispatcher.
 * 
 * Intercepts uncaught runtime exceptions across the Angular application tree,
 * captures diagnostic context (stack trace, active URL, client environment),
 * and prevents silent application crashes while enabling observability dispatch.
 * 
 * Designed for telemetry integration (Sentry, Datadog RUM, or GCP Error Reporting).
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {

  handleError(error: any): void {
    // Extract meaningful error information
    const errorInfo = {
      timestamp: new Date().toISOString(),
      message: error?.message || 'Unknown error',
      stack: error?.stack || null,
      name: error?.name || 'Error',
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    };

    // Log structured error to console (replaces silent swallowing)
    console.error(
      `[LegalConnect Admin] Unhandled Error:`,
      `\n  Message: ${errorInfo.message}`,
      `\n  Type: ${errorInfo.name}`,
      `\n  URL: ${errorInfo.url}`,
      `\n  Time: ${errorInfo.timestamp}`
    );

    // Log full stack trace separately for debugging
    if (errorInfo.stack) {
      console.error('[LegalConnect Admin] Stack trace:', errorInfo.stack);
    }

    // Future integration point:
    // - Send to Sentry: Sentry.captureException(error);
    // - Send to DataDog: datadogRum.addError(error);
    // - Send to custom endpoint: this.http.post('/api/admin/telemetry/error', errorInfo);
  }
}