import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * Application routes. The editor (GoJS canvas) is lazy-loaded and guarded;
 * `/editor/:id` opens a saved diagram directly. `/gojs` is kept as an alias.
 * Unknown paths fall back to the editor.
 */
const editor = () =>
  import('./features/gojs-editor/gojs-editor.component').then((m) => m.GojsEditorComponent);

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  { path: 'editor', canActivate: [authGuard], loadComponent: editor },
  { path: 'editor/:id', canActivate: [authGuard], loadComponent: editor },
  { path: 'gojs', canActivate: [authGuard], loadComponent: editor },
  { path: 'gojs/:id', canActivate: [authGuard], loadComponent: editor },
  { path: '', pathMatch: 'full', redirectTo: 'editor' },
  {
    path: '**',
    loadComponent: () =>
      import('./features/errors/not-found.component').then((m) => m.NotFoundComponent),
  },
];
