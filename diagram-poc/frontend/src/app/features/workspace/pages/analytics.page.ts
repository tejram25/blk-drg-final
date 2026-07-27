import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../workspace.service';
import { WsBarComponent, WsPageHeaderComponent, WsPanelComponent, WsStatComponent } from '../ui/ws-ui';

/** Leadership analytics rolled up from the same data the modules use. */
@Component({
  selector: 'app-ws-analytics',
  standalone: true,
  imports: [CommonModule, MatIconModule, WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsBarComponent],
  styleUrls: ['./pages.css'],
  template: `
    <ws-page-header title="Power BI" subtitle="Roll-up across pipeline, demand generation and supply." />

    <div class="grid stats">
      <ws-stat label="Pipeline" [value]="money(ws.pipelineValue())" icon="trending_up" tone="accent" />
      <ws-stat label="Won this period" [value]="money(wonValue())" icon="emoji_events" tone="ok" />
      <ws-stat label="Campaign spend" [value]="money(spend())" icon="payments" />
      <ws-stat label="Cost per conversion" [value]="money(costPerConv())" icon="calculate"
        hint="campaign spend ÷ conversions" />
    </div>

    <div class="grid two">
      <ws-panel heading="Pipeline by customer">
        @for (c of byCustomer(); track c.label) {
          <ws-bar [label]="c.label" [value]="money(c.value)" [pct]="(c.value / maxCustomer()) * 100" />
        }
      </ws-panel>

      <ws-panel heading="Projects by category">
        @for (c of ws.byCategory(); track c.label) {
          <ws-bar [label]="c.label" [value]="c.count" [pct]="(c.count / maxCategory()) * 100" />
        }
      </ws-panel>
    </div>

    <div class="grid two">
      <ws-panel heading="Top projects by value" [flush]="true">
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Project</th><th>Customer</th><th>Stage</th><th class="num">Value</th></tr></thead>
            <tbody>
              @for (p of topProjects(); track p.id) {
                <tr><td class="ink">{{ p.name }}</td><td>{{ p.customer }}</td>
                  <td>{{ p.stage }}</td><td class="num">{{ money(p.value) }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </ws-panel>

      <ws-panel heading="Campaign efficiency" [flush]="true">
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Campaign</th><th class="num">Spend</th><th class="num">Leads</th><th class="num">Conv.</th></tr></thead>
            <tbody>
              @for (c of ws.campaigns(); track c.id) {
                <tr><td class="ink">{{ c.name }}</td><td class="num">{{ money(c.spent) }}</td>
                  <td class="num">{{ c.leads }}</td><td class="num">{{ c.converted }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </ws-panel>
    </div>
  `,
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
