import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * Application routes.
 *
 * This is the standalone Block Diagram app: after login, everything is the
 * editor. It carries its own toolbar, palette, part search and dialogs — there
 * is no workspace shell. (The dc-workspace shell lives on a separate branch;
 * this app is meant to be embedded there later as a micro-frontend.)
 */
const editor = () =>
  import('./features/gojs-editor/gojs-editor.component').then((m) => m.GojsEditorComponent);

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },

  // The editor is the app. `new` (or no id) starts a blank diagram; the Open
  // menu inside the editor lists saved diagrams.
  { path: 'editor/:id', canActivate: [authGuard], loadComponent: editor },
  { path: 'editor', canActivate: [authGuard], loadComponent: editor },

  // Legacy links keep working.
  { path: 'gojs/:id', redirectTo: 'editor/:id' },
  { path: 'gojs', pathMatch: 'full', redirectTo: 'editor' },
  { path: 'workspace/block-diagram/:id', redirectTo: 'editor/:id' },
  { path: 'workspace', pathMatch: 'full', redirectTo: 'editor' },

  { path: '', pathMatch: 'full', redirectTo: 'editor' },
  {
    path: '**',
    loadComponent: () => import('./features/errors/not-found.component').then((m) => m.NotFoundComponent),
  },
];
