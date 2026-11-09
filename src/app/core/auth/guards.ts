import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import type { UserRole } from '../api/models';
import { AuthService } from './auth.service';

/** Only signed-in users. Everyone else goes to the login page. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? true : inject(Router).createUrlTree(['/login']);
};

/** Keeps signed-in users away from the login page. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.isAuthenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;
};

/** Role check for a route. The server still has the final say; this only hides screens. */
export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    if (!auth.isAuthenticated()) return inject(Router).createUrlTree(['/login']);
    return auth.hasRole(roles) ? true : inject(Router).createUrlTree(['/forbidden']);
  };
}
