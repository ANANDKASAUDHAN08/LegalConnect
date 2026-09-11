import { ApplicationConfig, ErrorHandler } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { adminAuthInterceptor } from './core/auth.interceptor';
import { adminSecurityInterceptor } from './core/security.interceptor';
import { GlobalErrorHandler } from './core/global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([adminAuthInterceptor, adminSecurityInterceptor])),
    provideAnimations(),
    // Centralized error boundary for application-wide unhandled exceptions
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ]
};