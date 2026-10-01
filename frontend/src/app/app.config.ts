import { ApplicationConfig, isDevMode, APP_INITIALIZER, ErrorHandler } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withPreloading, PreloadAllModules } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';
import { TokenStorageService } from './services/token-storage.service';
import { GlobalErrorHandler } from './core/global-error-handler';
import { firstValueFrom } from 'rxjs';

import { provideLottieOptions } from 'ngx-lottie';

/**
 * Non-blocking session initializer.
 *
 * Strategy:
 * 1. If a cached user profile AND a non-expired access token exist in localStorage,
 *    resolve immediately (0ms) — Angular boots the app shell with cached data instantly.
 *    The full session verification runs silently in the background.
 * 2. If the token is expired but cached profile exists, still resolve immediately
 *    (mount the shell with stale data) and trigger a silent token refresh in background.
 * 3. Only block Angular bootstrap when there is NO cached state at all (cold first visit
 *    or explicit logout) — in this case, the standard checkSession() flow runs.
 */
function initializeSession(auth: AuthService, tokenStorage: TokenStorageService): () => Promise<boolean> {
  return () => {
    const cachedUser = tokenStorage.getCachedUser();
    const token = tokenStorage.getToken();

    if (cachedUser && token) {
      // Synchronous JWT expiry check (timestamp only, no cryptographic verification)
      let isExpired = false;
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          while (base64.length % 4 !== 0) base64 += '=';
          const payload = JSON.parse(atob(base64));
          isExpired = payload?.exp ? (payload.exp * 1000) <= Date.now() : false;
        }
      } catch {
        isExpired = false;
      }

      // Whether token is valid or expired, we have cached user data —
      // resolve immediately and let checkSession() run in background.
      // This eliminates the splash screen for returning users.
      auth.checkSession().subscribe();
      return Promise.resolve(true);
    }

    // No cached state — must wait for session hydration (guest or first visit)
    return firstValueFrom(auth.checkSession(), { defaultValue: false });
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled',
        anchorScrolling: 'enabled'
      }),
      withPreloading(PreloadAllModules)
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations(),
    provideLottieOptions({
      player: () => import('lottie-web')
    }),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeSession,
      deps: [AuthService, TokenStorageService],
      multi: true
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};