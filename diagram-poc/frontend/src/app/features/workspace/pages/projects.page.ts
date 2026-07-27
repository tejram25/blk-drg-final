import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../workspace.service';
import { WsBarComponent, WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../ui/ws-ui';

/** Design-win pipeline: filterable project list plus a stage summary. */
@Component({
  selector: 'app-ws-projects',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent, WsBarComponent,
  ],
  styleUrls: ['./pages.css'],
  template: `
    <ws-page-header title="Projects" subtitle="Design-win pipeline across every account.">
      <a class="btn" routerLink="/workspace/campaign"><mat-icon>campaign</mat-icon> Campaigns</a>
      <button type="button" class="btn primary"><mat-icon>add</mat-icon> New project</button>
    </ws-page-header>

    <div class="grid stats">
      <ws-stat label="Pipeline value" [value]="money(ws.pipelineValue())" icon="trending_up" tone="accent" />
      <ws-stat label="Open projects" [value]="ws.projects().length" icon="work_outline" />
      <ws-stat label="At risk" [value]="atRisk()" icon="warning"
        [tone]="atRisk() ? 'risk' : 'ok'" hint="need attention" />
      <ws-stat label="Diagrams" [value]="diagramCount()" icon="account_tree" hint="linked to projects" />
    </div>

    <div class="filters">
      <input [ngModel]="query()" (ngModelChange)="query.set($event)"
        placeholder="Filter by name, customer or owner…" aria-label="Filter projects" />
      <select [ngModel]="stage()" (ngModelChange)="stage.set($event)" aria-label="Filter by stage">
        <option value="">All stages</option>
        @for (s of stages; track s) { <option [value]="s">{{ s }}</option> }
      </select>
      <select [ngModel]="category()" (ngModelChange)="category.set($event)" aria-label="Filter by category">
        <option value="">All categories</option>
        @for (c of ws.byCategory(); track c.label) { <option [value]="c.label">{{ c.label }}</option> }
      </select>
      <span class="spacer"></span>
      <span class="link">{{ filtered().length }} of {{ ws.projects().length }}</span>
    </div>

    <div class="grid two">
      <ws-panel heading="Projects" [flush]="true">
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr><th>Project</th><th>Customer</th><th>Stage</th><th>Owner</th>
                <th class="num">Value</th><th class="num">Parts</th><th>Health</th></tr>
            </thead>
            <tbody>
              @for (p of filtered(); track p.id) {
                <tr>
                  <td class="ink">{{ p.name }}<div class="detail">{{ p.id }} · {{ p.category }}</div></td>
                  <td>{{ p.customer }}</td>
                  <td><ws-pill>{{ p.stage }}</ws-pill></td>
                  <td>{{ p.owner }}</td>
                  <td class="num">{{ money(p.value) }}</td>
                  <td class="num">{{ p.parts }}</td>
                  <td><ws-pill [tone]="p.health">{{ p.health }}</ws-pill></td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="empty">No projects match those filters.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </ws-panel>

      <ws-panel heading="Pipeline summary">
        @for (s of ws.byStage(); track s.stage) {
          <ws-bar [label]="s.stage" [value]="money(s.value)" [pct]="(s.count / maxStage()) * 100" />
        }
        <p class="detail" style="margin-top:12px">
          Weighted on stage count. Won business is excluded from the open pipeline figure above.
        </p>
      </ws-panel>
    </div>
  `,
})
export class ProjectsPage {
  readonly ws = inject(WorkspaceService);
  readonly stages = ['Discovery', 'Design', 'Prototype', 'Production', 'Won'];

  // Signals, not plain fields: computed() only recomputes on signal changes.
  readonly query = signal('');
  readonly stage = signal('');
  readonly category = signal('');

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const stage = this.stage(); const category = this.category();
    return this.ws.projects().filter((p) =>
      (!q || `${p.name} ${p.customer} ${p.owner} ${p.id}`.toLowerCase().includes(q)) &&
      (!stage || p.stage === stage) &&
      (!category || p.category === category));
  });

  readonly atRisk = computed(() => this.ws.projects().filter((p) => p.health !== 'ok').length);
  readonly diagramCount = computed(() => this.ws.projects().reduce((s, p) => s + p.diagrams, 0));
  readonly maxStage = computed(() => Math.max(...this.ws.byStage().map((s) => s.count), 1));

  money(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
    return `$${n}`;
  }
}
