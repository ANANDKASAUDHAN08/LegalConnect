import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './auth.service';
import { filter, take, map } from 'rxjs';

export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  return auth.isLoaded$.pipe(
    filter(loaded => loaded),
    take(1),
    map(() => {
      if (!auth.isAuthenticated) {
        router.navigate(['/login']);
        return false;
      }

      // First-login password rotation enforcement (BE-27)
      if (auth.user?.mustChangePassword) {
        const isAccountPath = state.url.startsWith('/account');
        if (!isAccountPath) {
          router.navigate(['/account'], { queryParams: { promptPasswordChange: 'true' } });
          return false;
        }
      }

      return true;
    })
  );
};