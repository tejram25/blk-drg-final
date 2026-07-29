import { ApplicationConfig, APP_INITIALIZER, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/services/auth.service';

/**
 * Root providers. The session is restored once, up front, via APP_INITIALIZER so
 * route guards can synchronously read the auth state instead of racing it.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([credentialsInterceptor, errorInterceptor])),
    // Async: the animations engine is fetched after first paint instead of
    // sitting in the initial bundle. Material components work either way.
    provideAnimationsAsync(),
    {
      provide: APP_INITIALIZER,
      multi: true,
      deps: [AuthService],
      useFactory: (auth: AuthService) => () => auth.restore(),
    },
    // PWA: Angular service worker (production builds only — ngsw-worker.js is
    // emitted by the build when "serviceWorker" is set in angular.json).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
