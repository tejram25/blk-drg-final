import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../services/notification.service';

/**
 * Turns failed HTTP responses into clear, user-facing error toasts and re-throws
 * so callers can still react. Auth endpoints are skipped (the login screen shows
 * its own messages, and an unauthenticated /auth/me on startup is expected).
 * A 401 elsewhere means the session lapsed mid-use, so we bounce to /login.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notify = inject(NotificationService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (!req.url.includes('/auth/')) {
        notify.error(friendlyMessage(err));
        if (err.status === 401) {
          router.navigateByUrl('/login');
        }
      }
      return throwError(() => err);
    }),
  );
};

/** Map an HTTP error to a human-readable message (backend message wins). */
function friendlyMessage(err: HttpErrorResponse): string {
  const backendMessage = err?.error?.message;
  if (typeof backendMessage === 'string' && backendMessage.trim()) {
    return backendMessage;
  }
  switch (err.status) {
    case 0:
      return 'Cannot reach the server. Check your connection and try again.';
    case 400:
      return 'That request was invalid.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return 'The requested item was not found.';
    case 409:
      return 'That conflicts with existing data.';
    case 413:
      return 'That file is too large to upload.';
    default:
      return err.status >= 500
        ? 'Something went wrong on the server. Please try again.'
        : 'Something went wrong. Please try again.';
  }
}
