import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { WorkspaceService } from './workspace.service';
import { ProjectWorkspaceService } from './project-workspace.service';
import { Artifact, Region, Role } from './workspace.models';

type SidePanel = 'explorer' | 'search' | 'reviews' | 'business';

/**
 * The IDE shell.
 *
 * Salesforce owns the project workflow and syncs thousands of projects here
 * nightly. This workspace is where a project's engineering artefacts live, so
 * the layout is an IDE rather than a set of nav pages: you open one project and
 * work inside its tree.
 *
 *   activity bar │ tool window │ editor tabs + artefact │ inspector
 *                └──────────── bottom dock ─────────────┘
 *                             status bar
 *
 * The business modules (projects list, campaigns, suppliers, analytics) are not
 * part of a project, so they live behind the "Business" tool window and the
 * command palette instead of competing with the project tree.
 */
@Component({
  selector: 'app-ide-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, MatIconModule, MatTooltipModule],
  templateUrl: './ide-shell.component.html',
  styleUrls: ['./ide-shell.component.css'],
})
export class IdeShellComponent {
  readonly pw = inject(ProjectWorkspaceService);
  readonly ws = inject(WorkspaceService);
  readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  panel = signal<SidePanel>('explorer');
  panelOpen = signal(true);
  projectPickerOpen = signal(false);
  projectQuery = signal('');
  treeFilter = signal('');
  collapsedFolders = signal<Set<string>>(new Set());

  paletteOpen = signal(false);
  paletteQuery = signal('');
  notifyOpen = signal(false);
  profileOpen = signal(false);
  regionOpen = signal(false);

  readonly regions: Region[] = ['AC', 'EMEA', 'AP'];
  readonly roles: Role[] = ['Sales', 'Engineer', 'Leadership'];

  readonly activities: { id: SidePanel; icon: string; label: string }[] = [
    { id: 'explorer', icon: 'folder_open', label: 'Project' },
    { id: 'search', icon: 'search', label: 'Search in project' },
    { id: 'reviews', icon: 'fact_check', label: 'Reviews & risks' },
    { id: 'business', icon: 'insights', label: 'Business' },
  ];

  readonly businessLinks = [
    { label: 'All projects', icon: 'work_outline', path: '/workspace/projects' },
    { label: 'Campaigns', icon: 'campaign', path: '/workspace/campaign' },
    { label: 'Suppliers', icon: 'groups', path: '/workspace/suppliers' },
    { label: 'Support / Query', icon: 'forum', path: '/workspace/support' },
    { label: 'Part Intelligence', icon: 'memory', path: '/workspace/part-intelligence' },
    { label: 'Fast Repository', icon: 'menu_book', path: '/workspace/fast-repository' },
    { label: 'Inspection Loop', icon: 'monitor_heart', path: '/workspace/inspection' },
    { label: 'Analytics', icon: 'query_stats', path: '/workspace/analytics' },
  ];

  constructor() {
    document.addEventListener('keydown', this.onKey, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('keydown', this.onKey, true));
  }

  // ---- project picker ----------------------------------------------------
  readonly projectMatches = computed(() => this.pw.search(this.projectQuery()).slice(0, 40));

  pickProject(id: string): void {
    this.pw.openProjectById(id);
    this.projectPickerOpen.set(false);
    this.projectQuery.set('');
    this.router.navigateByUrl('/workspace/project');
  }

  // ---- explorer ----------------------------------------------------------
  readonly filteredTree = computed(() => {
    const q = this.treeFilter().trim().toLowerCase();
    const tree = this.pw.tree();
    if (!q) return tree;
    return tree
      .map((g) => ({ folder: g.folder, items: g.items.filter((i) => i.name.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length);
  });

  isCollapsed(folder: string): boolean { return this.collapsedFolders().has(folder); }
  toggleFolder(folder: string): void {
    this.collapsedFolders.update((s) => {
      const n = new Set(s);
      n.has(folder) ? n.delete(folder) : n.add(folder);
      return n;
    });
  }

  openArtifact(a: Artifact): void {
    this.pw.open(a);
    this.router.navigateByUrl('/workspace/project');
  }

  artifactIcon(kind: string): string {
    return { diagram: 'account_tree', document: 'description', dataset: 'table_chart',
      bom: 'receipt_long', review: 'fact_check' }[kind] ?? 'insert_drive_file';
  }

  // ---- command palette ---------------------------------------------------
  readonly paletteResults = computed(() => {
    const q = this.paletteQuery().trim().toLowerCase();
    const artifacts = this.pw.openProject().artifacts.map((a) => ({
      kind: a.kind === 'diagram' ? 'Diagram' : a.kind === 'dataset' ? 'Dataset' : 'File',
      label: a.name, detail: a.folder, run: () => this.openArtifact(a),
    }));
    const projects = this.pw.projects().map((p) => ({
      kind: 'Project', label: p.name, detail: `${p.customer} · ${p.id}`,
      run: () => this.pickProject(p.id),
    }));
    const pages = this.businessLinks.map((b) => ({
      kind: 'Go to', label: b.label, detail: b.path, run: () => this.go(b.path),
    }));
    const all = [...artifacts, ...projects, ...pages];
    if (!q) return all.slice(0, 9);
    return all.filter((r) => `${r.label} ${r.detail}`.toLowerCase().includes(q)).slice(0, 12);
  });

  runPalette(r: { run: () => void }): void { this.paletteOpen.set(false); r.run(); }

  // ---- header ------------------------------------------------------------
  readonly themeIsLight = computed(() => this.theme.theme() === 'light');
  toggleTheme(): void { this.theme.toggle(); }
  go(path: string): void { this.router.navigateByUrl(path); }

  selectPanel(p: SidePanel): void {
    if (this.panel() === p) { this.panelOpen.update((v) => !v); return; }
    this.panel.set(p);
    this.panelOpen.set(true);
  }

  closePopovers(): void {
    this.notifyOpen.set(false); this.profileOpen.set(false); this.regionOpen.set(false);
  }
  togglePopover(which: 'notify' | 'profile' | 'region'): void {
    const was = which === 'notify' ? this.notifyOpen()
      : which === 'profile' ? this.profileOpen() : this.regionOpen();
    this.closePopovers();
    if (was) return;
    if (which === 'notify') { this.notifyOpen.set(true); this.ws.markAllRead(); }
    if (which === 'profile') this.profileOpen.set(true);
    if (which === 'region') this.regionOpen.set(true);
  }
  pickRegion(r: Region): void { this.ws.setRegion(r); this.closePopovers(); }
  pickRole(r: Role): void { this.ws.setRole(r); }
  logout(): void { this.auth.logout().then(() => this.router.navigateByUrl('/login')); }

  /**
   * Capture phase: Material's tooltip consumes Escape and stops it propagating,
   * so a bubble-phase listener never sees it.
   */
  private readonly onKey = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'k') {
      e.preventDefault();
      this.paletteOpen.update((v) => !v);
      this.paletteQuery.set('');
    }
    if ((e.ctrlKey || e.metaKey) && k === 'o') {
      e.preventDefault();
      this.projectPickerOpen.set(true);
    }
    if (e.key === 'Escape') {
      this.paletteOpen.set(false);
      this.projectPickerOpen.set(false);
      this.closePopovers();
    }
  };
}
