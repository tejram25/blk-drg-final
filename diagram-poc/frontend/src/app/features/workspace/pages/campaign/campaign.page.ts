import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../../services/workspace.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../../ui';
import { NotificationService } from '../../../../core/services/notification.service';

/** Demand-generation campaigns: performance summary plus a create form. */
@Component({
  selector: 'app-ws-campaign',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent,
  ],
  styleUrls: ['../pages.css'],
  templateUrl: './campaign.page.html',
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
