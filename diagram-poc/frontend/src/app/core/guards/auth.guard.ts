import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects authenticated routes. The session is restored before the router runs
 * (see the APP_INITIALIZER in app.config), so `auth.user()` is already resolved
 * here. Unauthenticated users are redirected to /login.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.user() ? true : router.createUrlTree(['/login']);
};
