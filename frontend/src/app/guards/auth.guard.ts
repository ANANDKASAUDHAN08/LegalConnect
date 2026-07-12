import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, filter, take, switchMap } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isSessionLoaded$.pipe(
    filter(loaded => loaded),
    take(1),
    switchMap(() => auth.isLoggedIn$.pipe(take(1))),
    map(isLoggedIn => {
      if (isLoggedIn) return true;
      router.navigate(['/login']);
      return false;
    })
  );
};