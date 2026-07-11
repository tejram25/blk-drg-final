import { isDevMode, provideZoneChangeDetection } from "@angular/core";
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// In development the service worker is intentionally NOT registered. But if this
// origin ever served a *production* build (e.g. a quick `ng build` preview on
// localhost:4200), that worker stays installed and keeps serving its cached app
// shell — which shows up as an endless "loading" loop when you switch back to
// `ng serve`. Proactively unregister any leftover worker and drop its caches so
// dev always loads fresh. (Harmless when nothing is registered.)
if (isDevMode() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .catch(() => {});
  if ('caches' in window) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
  }
}

bootstrapApplication(AppComponent, {...appConfig, providers: [provideZoneChangeDetection(), ...appConfig.providers]}).catch((err) => console.error(err));
