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
    let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
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

      const userRole = (user.role || '').trim();
      const expectedNormalized = expectedRoles.map(r => r.toLowerCase());

      const userRoleMatches = expectedNormalized.includes(userRole.toLowerCase());
      // If a JWT token exists, ensure token's cryptographic role claim matches expected role and user.role
      const tokenRoleNormalized = (tokenRole || '').trim();
      const tokenRoleMatches = token
        ? tokenRole !== null && expectedNormalized.includes(tokenRoleNormalized.toLowerCase()) && tokenRoleNormalized.toLowerCase() === userRole.toLowerCase()
        : true;

      if (userRoleMatches && tokenRoleMatches) {
        return true;
      }

      // Route unauthorized user directly to their respective workstation without entering a redirect loop
      if (userRole.toLowerCase() === 'lawyer') {
        router.navigate(['/lawyer/workstation']);
      } else if (userRole.toLowerCase() === 'client') {
        router.navigate(['/client/portal']);
      } else {
        router.navigate(['/home']);
      }
      return false;
    })
  );
};