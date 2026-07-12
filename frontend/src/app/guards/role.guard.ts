import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, filter, take, switchMap } from 'rxjs';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const expectedRoles: string[] = route.data['expectedRoles'] || [];

  return auth.isSessionLoaded$.pipe(
    filter(loaded => loaded),
    take(1),
    switchMap(() => auth.currentUser$.pipe(take(1))),
    map(user => {
      if (user && (expectedRoles.length === 0 || expectedRoles.includes(user.role))) {
        return true;
      }
      router.navigate(['/dashboard']);
      return false;
    })
  );
};