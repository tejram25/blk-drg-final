import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppShellComponent } from './app/app-shell.component';
import { credentialsInterceptor } from './app/auth/credentials.interceptor';

bootstrapApplication(AppShellComponent, {
  providers: [
    provideHttpClient(withInterceptors([credentialsInterceptor])),
    provideAnimations(),
  ],
}).catch((err) => console.error(err));
