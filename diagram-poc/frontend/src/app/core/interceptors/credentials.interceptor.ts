import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Send credentials (the session cookie) with every request. Required for
 * session-based auth — without it the browser drops the cookie on XHR/fetch.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true }));
