import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../workspace.service';
import { WsBarComponent, WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../ui/ws-ui';

/**
 * Landing page. The headline figures change with the role picked in the header
 * — Sales sees pipeline, Engineering sees design load, Leadership sees both
 * plus risk — because the same numbers matter differently to each.
 */
@Component({
  selector: 'app-ws-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent, WsBarComponent,
  ],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./pages.css'],
})
export class DashboardPage {
  readonly ws = inject(WorkspaceService);

  readonly openTickets = computed(() => this.ws.tickets().filter((t) => t.status !== 'closed').length);
  readonly openRisks = computed(() => this.ws.inspections().filter((i) => i.status === 'open').length);
  readonly activeCampaigns = computed(() => this.ws.campaigns().filter((c) => c.status === 'active').length);
  readonly totalDiagrams = computed(() => this.ws.projects().reduce((s, p) => s + p.diagrams, 0));

  readonly maxCategory = computed(() => Math.max(...this.ws.byCategory().map((c) => c.count), 1));
  readonly maxStage = computed(() => Math.max(...this.ws.byStage().map((s) => s.count), 1));

  /** Projects needing attention first — risk, then warn, then most recent. */
  readonly queue = computed(() => {
    const rank = { risk: 0, warn: 1, ok: 2 } as const;
    return [...this.ws.projects()].sort((a, b) => rank[a.health] - rank[b.health]).slice(0, 5);
  });

  money(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
    return `$${n}`;
  }
  healthTone(h: string): 'ok' | 'warn' | 'risk' { return h as 'ok' | 'warn' | 'risk'; }
  activityIcon(kind: string): string {
    return { diagram: 'account_tree', project: 'work_outline', part: 'memory', review: 'fact_check', campaign: 'campaign' }[kind] ?? 'circle';
  }
}
