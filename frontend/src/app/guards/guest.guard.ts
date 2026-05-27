import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, filter, take, switchMap } from 'rxjs';

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isSessionLoaded$.pipe(
    filter(loaded => loaded),
    take(1),
    switchMap(() => auth.isLoggedIn$),
    map(isLoggedIn => {
      if (isLoggedIn) {
        router.navigate(['/dashboard']);
        return false;
      }
      return true;
    })
  );
};
