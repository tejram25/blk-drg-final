import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../workspace.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../ui/ws-ui';
import { NotificationService } from '../../../core/services/notification.service';

/** Demand-generation campaigns: performance summary plus a create form. */
@Component({
  selector: 'app-ws-campaign',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent,
  ],
  styleUrls: ['./pages.css'],
  template: `
    <ws-page-header title="Campaign management"
      subtitle="Demand generation feeding the design-win pipeline." />

    <div class="grid stats">
      <ws-stat label="Total budget" [value]="money(totalBudget())" icon="savings" />
      <ws-stat label="Spent" [value]="money(totalSpent())" [hint]="spentPct() + '% of budget'"
        icon="payments" [tone]="spentPct() > 85 ? 'warn' : ''" />
      <ws-stat label="Leads" [value]="totalLeads()" icon="person_add" />
      <ws-stat label="Converted" [value]="totalConverted()" [hint]="convRate() + '% conversion'"
        icon="check_circle" tone="ok" />
    </div>

    <div class="grid two">
      <ws-panel heading="Campaigns" [flush]="true">
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr><th>Campaign</th><th>Status</th><th>Window</th>
                <th class="num">Budget</th><th class="num">Leads</th><th class="num">Conv.</th></tr>
            </thead>
            <tbody>
              @for (c of ws.campaigns(); track c.id) {
                <tr>
                  <td class="ink">{{ c.name }}<div class="detail">{{ c.description }}</div></td>
                  <td><ws-pill [tone]="c.status === 'active' ? 'ok' : c.status === 'draft' ? 'accent' : ''">
                    {{ c.status }}</ws-pill></td>
                  <td>{{ c.start }} → {{ c.end }}</td>
                  <td class="num">{{ money(c.budget) }}<div class="detail">{{ money(c.spent) }} spent</div></td>
                  <td class="num">{{ c.leads }}</td>
                  <td class="num">{{ c.converted }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </ws-panel>

      <ws-panel heading="New campaign">
        <form class="form" (ngSubmit)="create()">
          <div class="field">
            <label for="cn">Name</label>
            <input id="cn" [ngModel]="name()" (ngModelChange)="name.set($event)" name="name"
              placeholder="e.g. Q4 Industrial Sensing" required />
          </div>
          <div class="field">
            <label for="cd">Description</label>
            <textarea id="cd" [ngModel]="desc()" (ngModelChange)="desc.set($event)" name="desc"
              placeholder="Who are we targeting, and with what?"></textarea>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="cb">Budget (USD)</label>
              <input id="cb" type="number" min="0" [ngModel]="budget()"
                (ngModelChange)="budget.set(+$event)" name="budget" />
            </div>
            <div class="field">
              <label for="cs">Start</label>
              <input id="cs" type="date" [ngModel]="start()" (ngModelChange)="start.set($event)" name="start" />
            </div>
          </div>
          <div class="field">
            <label for="ce">End</label>
            <input id="ce" type="date" [ngModel]="end()" (ngModelChange)="end.set($event)" name="end" />
          </div>
          <div>
            <button type="submit" class="btn primary" [disabled]="!name().trim()">
              <mat-icon>add</mat-icon> Create campaign
            </button>
          </div>
        </form>
      </ws-panel>
    </div>
  `,
})
export class CampaignPage {
  readonly ws = inject(WorkspaceService);
  private readonly notify = inject(NotificationService);

  readonly name = signal('');
  readonly desc = signal('');
  readonly budget = signal(50_000);
  readonly start = signal('');
  readonly end = signal('');

  readonly totalBudget = computed(() => this.ws.campaigns().reduce((s, c) => s + c.budget, 0));
  readonly totalSpent = computed(() => this.ws.campaigns().reduce((s, c) => s + c.spent, 0));
  readonly totalLeads = computed(() => this.ws.campaigns().reduce((s, c) => s + c.leads, 0));
  readonly totalConverted = computed(() => this.ws.campaigns().reduce((s, c) => s + c.converted, 0));
  readonly spentPct = computed(() =>
    this.totalBudget() ? Math.round((this.totalSpent() / this.totalBudget()) * 100) : 0);
  readonly convRate = computed(() =>
    this.totalLeads() ? Math.round((this.totalConverted() / this.totalLeads()) * 100) : 0);

  create(): void {
    if (!this.name().trim()) return;
    this.ws.addCampaign({
      name: this.name().trim(), description: this.desc().trim(),
      budget: this.budget(), start: this.start() || '—', end: this.end() || '—',
    });
    this.notify.success(`Campaign “${this.name().trim()}” created as a draft.`);
    this.name.set(''); this.desc.set(''); this.budget.set(50_000);
    this.start.set(''); this.end.set('');
  }

  money(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
    return `$${n}`;
  }
}
