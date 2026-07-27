import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../../services/workspace.service';
import { WsBarComponent, WsPageHeaderComponent, WsPanelComponent, WsStatComponent } from '../../ui';

/** Leadership analytics rolled up from the same data the modules use. */
@Component({
  selector: 'app-ws-analytics',
  standalone: true,
  imports: [CommonModule, MatIconModule, WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsBarComponent],
  styleUrls: ['../pages.css'],
  templateUrl: './analytics.page.html',
})
export class AnalyticsPage {
  readonly ws = inject(WorkspaceService);

  readonly wonValue = computed(() =>
    this.ws.projects().filter((p) => p.stage === 'Won').reduce((s, p) => s + p.value, 0));
  readonly spend = computed(() => this.ws.campaigns().reduce((s, c) => s + c.spent, 0));
  readonly conversions = computed(() => this.ws.campaigns().reduce((s, c) => s + c.converted, 0));
  readonly costPerConv = computed(() =>
    this.conversions() ? Math.round(this.spend() / this.conversions()) : 0);

  readonly byCustomer = computed(() => {
    const m = new Map<string, number>();
    this.ws.projects().forEach((p) => m.set(p.customer, (m.get(p.customer) ?? 0) + p.value));
    return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  });
  readonly maxCustomer = computed(() => Math.max(...this.byCustomer().map((c) => c.value), 1));
  readonly maxCategory = computed(() => Math.max(...this.ws.byCategory().map((c) => c.count), 1));
  readonly topProjects = computed(() =>
    [...this.ws.projects()].sort((a, b) => b.value - a.value).slice(0, 5));

  money(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
    return `$${n}`;
  }
}
