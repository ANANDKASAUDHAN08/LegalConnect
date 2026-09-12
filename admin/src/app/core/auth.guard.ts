import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './auth.service';
import { filter, take, map } from 'rxjs';

/**
 * Validates the role claim directly from the cryptographically signed JWT admin token.
 * Prevents client-side state manipulation from bypassing the admin route guard (M-03).
 */
function isTokenRoleAdmin(token: string | null): boolean {
  if (!token) return true; // If cookie-only session, server /me validates role
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonPayload);
    if (payload.exp && Date.now() >= payload.exp * 1000) return false;
    const role =
      payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
      payload['role'];
    return role === 'Admin' || role === 'SuperAdmin';
  } catch {
    return false;
  }
}

export const adminAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);

  return auth.isLoaded$.pipe(
    filter(loaded => loaded),
    take(1),
    map(() => {
      const user = auth.user;
      const isAdminRole = user && (user.role === 'Admin' || user.role === 'SuperAdmin');
      const isTokenAdmin = isTokenRoleAdmin(auth.token);

      if (!auth.isAuthenticated || !isAdminRole || !isTokenAdmin) {
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