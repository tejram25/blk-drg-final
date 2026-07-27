import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { WorkspaceService } from './workspace.service';
import { Region, Role } from './workspace.models';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  /** Badge count, when the item needs attention. */
  badge?: () => number;
}
interface NavGroup { title: string; items: NavItem[]; }

/**
 * The Smart Ehub application shell: collapsible sidebar, header, and the
 * router outlet every module renders into. Modules are routes under
 * `/workspace`, so the chrome stays put while the content changes.
 */
@Component({
  selector: 'app-workspace-shell',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatTooltipModule,
  ],
  templateUrl: './workspace-shell.component.html',
  styleUrls: ['./workspace-shell.component.css'],
})
export class WorkspaceShellComponent {
  readonly ws = inject(WorkspaceService);
  readonly auth = inject(AuthService);
  private readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  constructor() {
    document.addEventListener('keydown', this.onKey, true);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('keydown', this.onKey, true));
  }

  collapsed = signal(false);
  searchOpen = signal(false);
  searchQuery = signal('');
  notifyOpen = signal(false);
  profileOpen = signal(false);
  regionOpen = signal(false);

  readonly regions: Region[] = ['AC', 'EMEA', 'AP'];
  readonly roles: Role[] = ['Sales', 'Engineer', 'Leadership'];

  readonly groups: NavGroup[] = [
    { title: '', items: [{ label: 'Dashboard', icon: 'dashboard', path: 'dashboard' }] },
    {
      title: 'Project', items: [
        { label: 'Projects', icon: 'work_outline', path: 'projects' },
        { label: 'Campaign', icon: 'campaign', path: 'campaign' },
        { label: 'Suppliers', icon: 'groups', path: 'suppliers' },
      ],
    },
    {
      title: 'Engineering Hub', items: [
        { label: 'Support / Query', icon: 'forum', path: 'support' },
        { label: 'Block Diagram', icon: 'account_tree', path: 'block-diagram' },
      ],
    },
    {
      title: 'Intelligence', items: [
        { label: 'Part Intelligence', icon: 'search', path: 'part-intelligence' },
        { label: 'Fast Repository', icon: 'menu_book', path: 'fast-repository' },
      ],
    },
    {
      title: 'Oversight', items: [
        {
          label: 'Inspection Loop', icon: 'monitor_heart', path: 'inspection',
          badge: () => this.ws.inspections().filter((i) => i.status === 'open').length,
        },
        { label: 'Power BI', icon: 'insights', path: 'analytics' },
      ],
    },
  ];

  /** Everything the command palette can jump to, filtered by the query. */
  readonly searchResults = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const pages = this.groups.flatMap((g) => g.items).map((i) => ({
      kind: 'Page', label: i.label, detail: `/workspace/${i.path}`, path: `/workspace/${i.path}`,
    }));
    const projects = this.ws.projects().map((p) => ({
      kind: 'Project', label: p.name, detail: `${p.customer} · ${p.stage}`, path: '/workspace/projects',
    }));
    const parts = this.ws.parts().map((p) => ({
      kind: 'Part', label: p.mpn, detail: p.description, path: '/workspace/part-intelligence',
    }));
    const all = [...pages, ...projects, ...parts];
    if (!q) return all.slice(0, 8);
    return all.filter((r) => `${r.label} ${r.detail}`.toLowerCase().includes(q)).slice(0, 10);
  });

  readonly themeIsLight = computed(() => this.theme.theme() === 'light');

  /** The editor fills the content area itself, so drop the page padding for it. */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url)),
    { initialValue: this.router.url });
  readonly flushContent = computed(() => /\/workspace\/block-diagram\/[^/]+$/.test(this.url()));

  toggleSidebar(): void { this.collapsed.update((v) => !v); }
  toggleTheme(): void { this.theme.toggle(); }

  openSearch(): void { this.searchOpen.set(true); this.searchQuery.set(''); }
  closeSearch(): void { this.searchOpen.set(false); }

  go(path: string): void {
    this.closeSearch();
    this.router.navigateByUrl(path);
  }

  /** Close every popover; used by the backdrop and by opening another one. */
  closePopovers(): void {
    this.notifyOpen.set(false);
    this.profileOpen.set(false);
    this.regionOpen.set(false);
  }
  togglePopover(which: 'notify' | 'profile' | 'region'): void {
    const was = which === 'notify' ? this.notifyOpen() : which === 'profile' ? this.profileOpen() : this.regionOpen();
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
   * Registered in the capture phase, not via @HostListener. Material's tooltip
   * consumes Escape and stops it propagating, so a bubble-phase listener on
   * document never sees it and popovers could not be dismissed with the keyboard.
   */
  private readonly onKey = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.searchOpen() ? this.closeSearch() : this.openSearch();
    }
    if (e.key === 'Escape') { this.closeSearch(); this.closePopovers(); }
  };
}
