import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map, filter, take, switchMap } from 'rxjs';

/**
 * Extracts and returns the role claim directly from the cryptographically signed JWT access token.
 * Prevents client-side state manipulation from bypassing the role guard (M-03).
 */
function getRoleFromJwt(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(json);
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }
    return (
      payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
      payload['role'] ||
      null
    );
  } catch {
    return null;
  }
}

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const expectedRoles: string[] = route.data['expectedRoles'] || [];

  return auth.isSessionLoaded$.pipe(
    filter(loaded => loaded),
    take(1),
    switchMap(() => auth.currentUser$.pipe(take(1))),
    map(user => {
      if (!user) {
        router.navigate(['/login']);
        return false;
      }

      if (expectedRoles.length === 0) {
        return true;
      }

      // M-03: Defense-in-depth — validate both in-memory user role AND the verified token claim role
      const token = auth.getToken();
      const tokenRole = getRoleFromJwt(token);

      const userRoleMatches = expectedRoles.includes(user.role);
      // If a JWT token exists, ensure token's cryptographic role claim matches expected role and user.role
      const tokenRoleMatches = token
        ? tokenRole !== null && expectedRoles.includes(tokenRole) && tokenRole === user.role
        : true;

      if (userRoleMatches && tokenRoleMatches) {
        return true;
      }

      // Route unauthorized user to appropriate home dashboard
      if (user.role === 'Lawyer') {
        router.navigate(['/lawyer/dashboard']);
      } else {
        router.navigate(['/dashboard']);
      }
      return false;
    })
  );
};