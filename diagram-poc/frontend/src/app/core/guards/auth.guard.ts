import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects authenticated routes. The session is normally restored up front by
 * the APP_INITIALIZER in app.config, but if the guard runs before that has
 * settled we await the restore here so we never redirect a logged-in user by
 * racing the session check. Unauthenticated users are redirected to /login.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.ready()) await auth.restore();
  return auth.user() ? true : router.createUrlTree(['/login']);
};
