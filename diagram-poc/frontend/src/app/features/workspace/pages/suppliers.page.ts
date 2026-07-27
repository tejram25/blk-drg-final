import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../workspace.service';
import { WsBarComponent, WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../ui/ws-ui';

/** Supplier scorecard: delivery, quality and lead time by franchise tier. */
@Component({
  selector: 'app-ws-suppliers',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent, WsBarComponent,
  ],
  styleUrls: ['./pages.css'],
  template: `
    <ws-page-header title="Suppliers" subtitle="Scorecard for the franchise and approved base." />

    <div class="grid stats">
      <ws-stat label="Suppliers" [value]="ws.suppliers().length" icon="groups" />
      <ws-stat label="Average OTD" [value]="avgOtd() + '%'" icon="local_shipping"
        [tone]="avgOtd() >= 92 ? 'ok' : 'warn'" hint="on-time delivery" />
      <ws-stat label="Average quality" [value]="avgQuality() + '%'" icon="verified" tone="ok" />
      <ws-stat label="Longest lead time" [value]="maxLead() + ' days'" icon="schedule"
        [tone]="maxLead() > 50 ? 'warn' : ''" />
    </div>

    <div class="filters">
      <input [ngModel]="query()" (ngModelChange)="query.set($event)"
        placeholder="Filter by name or category…" aria-label="Filter suppliers" />
      <select [ngModel]="tier()" (ngModelChange)="tier.set($event)" aria-label="Filter by tier">
        <option value="">All tiers</option>
        <option value="Franchise">Franchise</option>
        <option value="Preferred">Preferred</option>
        <option value="Approved">Approved</option>
      </select>
    </div>

    <div class="grid two">
      <ws-panel heading="Supplier scorecard" [flush]="true">
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr><th>Supplier</th><th>Tier</th><th>Categories</th>
                <th class="num">OTD</th><th class="num">Quality</th><th class="num">Lead</th><th class="num">Projects</th></tr>
            </thead>
            <tbody>
              @for (s of filtered(); track s.id) {
                <tr>
                  <td class="ink">{{ s.name }}</td>
                  <td><ws-pill [tone]="s.tier === 'Franchise' ? 'accent' : ''">{{ s.tier }}</ws-pill></td>
                  <td>{{ s.categories.join(' · ') }}</td>
                  <td class="num" [style.color]="s.otd >= 92 ? 'var(--ok)' : 'var(--warn)'">{{ s.otd }}%</td>
                  <td class="num">{{ s.quality }}%</td>
                  <td class="num">{{ s.leadTimeDays }}d</td>
                  <td class="num">{{ s.activeProjects }}</td>
                </tr>
              } @empty { <tr><td colspan="7" class="empty">No suppliers match those filters.</td></tr> }
            </tbody>
          </table>
        </div>
      </ws-panel>

      <ws-panel heading="On-time delivery">
        @for (s of ws.suppliers(); track s.id) {
          <ws-bar [label]="s.name" [value]="s.otd + '%'" [pct]="s.otd" />
        }
        <p class="detail" style="margin-top:12px">
          Anything under 90% is reviewed at the monthly supply meeting.
        </p>
      </ws-panel>
    </div>
  `,
})
export class SuppliersPage {
  readonly ws = inject(WorkspaceService);
  readonly query = signal('');
  readonly tier = signal('');

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase(); const t = this.tier();
    return this.ws.suppliers().filter((s) =>
      (!q || `${s.name} ${s.categories.join(' ')}`.toLowerCase().includes(q)) &&
      (!t || s.tier === t));
  });
  readonly avgOtd = computed(() =>
    Math.round(this.ws.suppliers().reduce((s, x) => s + x.otd, 0) / this.ws.suppliers().length));
  readonly avgQuality = computed(() =>
    Math.round(this.ws.suppliers().reduce((s, x) => s + x.quality, 0) / this.ws.suppliers().length));
  readonly maxLead = computed(() => Math.max(...this.ws.suppliers().map((s) => s.leadTimeDays)));
}
