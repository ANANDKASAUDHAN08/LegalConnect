import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './auth.service';
import { filter, take, map } from 'rxjs';

export const adminGuestGuard: CanActivateFn = () => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  return auth.isLoaded$.pipe(
    filter(loaded => loaded),
    take(1),
    map(() => {
      if (!auth.isAuthenticated) return true;
      router.navigate(['/dashboard']);
      return false;
    })
  );
};