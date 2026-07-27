import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

/**
 * Application routes.
 *
 * Everything signed-in lives under `/workspace`, which renders the IDE shell
 * (activity bar + project tree + editor tabs) around an outlet. `project` is the
 * default: you open a Salesforce-synced project and work inside its artefacts.
 * The block-diagram editor is one artefact type, so the shell stays put while a
 * diagram is open.
 *
 * `/editor/...` is kept as a deep-link alias so existing links keep working.
 */
const editor = () =>
  import('./features/gojs-editor/gojs-editor.component').then((m) => m.GojsEditorComponent);

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'workspace',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/workspace/ide-shell.component').then((m) => m.IdeShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'project' },
      {
        path: 'project',
        loadComponent: () => import('./features/workspace/pages/project.page').then((m) => m.ProjectPage),
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/workspace/pages/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'projects',
        loadComponent: () => import('./features/workspace/pages/projects.page').then((m) => m.ProjectsPage),
      },
      {
        path: 'campaign',
        loadComponent: () => import('./features/workspace/pages/campaign.page').then((m) => m.CampaignPage),
      },
      {
        path: 'suppliers',
        loadComponent: () => import('./features/workspace/pages/suppliers.page').then((m) => m.SuppliersPage),
      },
      {
        path: 'support',
        loadComponent: () => import('./features/workspace/pages/support.page').then((m) => m.SupportPage),
      },
      {
        path: 'block-diagram',
        loadComponent: () =>
          import('./features/workspace/pages/block-diagram.page').then((m) => m.BlockDiagramPage),
      },
      // The editor, embedded in the shell. `new` starts a blank diagram.
      { path: 'block-diagram/:id', loadComponent: editor },
      {
        path: 'part-intelligence',
        loadComponent: () =>
          import('./features/workspace/pages/part-intelligence.page').then((m) => m.PartIntelligencePage),
      },
      {
        path: 'fast-repository',
        loadComponent: () =>
          import('./features/workspace/pages/fast-repository.page').then((m) => m.FastRepositoryPage),
      },
      {
        path: 'inspection',
        loadComponent: () => import('./features/workspace/pages/inspection.page').then((m) => m.InspectionPage),
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/workspace/pages/analytics.page').then((m) => m.AnalyticsPage),
      },
    ],
  },

  // Deep-link aliases so existing bookmarks keep working.
  { path: 'editor', pathMatch: 'full', redirectTo: 'workspace/block-diagram' },
  { path: 'editor/:id', redirectTo: 'workspace/block-diagram/:id' },
  { path: 'gojs', pathMatch: 'full', redirectTo: 'workspace/block-diagram' },
  { path: 'gojs/:id', redirectTo: 'workspace/block-diagram/:id' },

  { path: '', pathMatch: 'full', redirectTo: 'workspace/project' },
  {
    path: '**',
    loadComponent: () => import('./features/errors/not-found.component').then((m) => m.NotFoundComponent),
  },
];
