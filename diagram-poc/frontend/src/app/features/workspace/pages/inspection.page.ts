import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../workspace.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../ui/ws-ui';

/** Continuous compliance sweep: supply, lifecycle and process risks. */
@Component({
  selector: 'app-ws-inspection',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent,
  ],
  styleUrls: ['./pages.css'],
  template: `
    <ws-page-header title="Inspection Loop"
      subtitle="Standing checks across projects — supply risk, lifecycle and process gaps." />

    <div class="grid stats">
      <ws-stat label="Open" [value]="countStatus('open')" icon="error"
        [tone]="countStatus('open') ? 'risk' : 'ok'" />
      <ws-stat label="Acknowledged" [value]="countStatus('acknowledged')" icon="visibility" tone="warn" />
      <ws-stat label="Resolved" [value]="countStatus('resolved')" icon="task_alt" tone="ok" />
      <ws-stat label="Critical" [value]="countSeverity('risk')" icon="priority_high"
        [tone]="countSeverity('risk') ? 'risk' : 'ok'" />
    </div>

    <div class="filters">
      <select [ngModel]="status()" (ngModelChange)="status.set($event)" aria-label="Filter by status">
        <option value="">All statuses</option>
        <option value="open">Open</option><option value="acknowledged">Acknowledged</option>
        <option value="resolved">Resolved</option>
      </select>
      <select [ngModel]="severity()" (ngModelChange)="severity.set($event)" aria-label="Filter by severity">
        <option value="">All severities</option>
        <option value="risk">Critical</option><option value="warn">Warning</option><option value="info">Info</option>
      </select>
      <span class="spacer"></span>
      <span class="link">{{ filtered().length }} of {{ ws.inspections().length }}</span>
    </div>

    <ws-panel heading="Findings" [flush]="true">
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr><th style="width:34px"></th><th>Finding</th><th>Scope</th><th>Owner</th>
              <th>Status</th><th class="num">Age</th></tr>
          </thead>
          <tbody>
            @for (i of filtered(); track i.id) {
              <tr>
                <td><mat-icon class="sev-icon" [attr.data-sev]="i.severity">
                  {{ i.severity === 'risk' ? 'error' : i.severity === 'warn' ? 'warning' : 'info' }}
                </mat-icon></td>
                <td class="ink">{{ i.title }}<div class="detail">{{ i.detail }}</div></td>
                <td>{{ i.scope }}</td>
                <td>{{ i.owner }}</td>
                <td><ws-pill [tone]="i.status === 'resolved' ? 'ok' : i.status === 'open' ? 'risk' : 'warn'">
                  {{ i.status }}</ws-pill></td>
                <td class="num">{{ i.age }}</td>
              </tr>
            } @empty { <tr><td colspan="6" class="empty">Nothing matches those filters.</td></tr> }
          </tbody>
        </table>
      </div>
    </ws-panel>
  `,
})
export class InspectionPage {
  readonly ws = inject(WorkspaceService);
  readonly status = signal('');
  readonly severity = signal('');

  readonly filtered = computed(() => {
    const st = this.status(); const sv = this.severity();
    return this.ws.inspections().filter((i) => (!st || i.status === st) && (!sv || i.severity === sv));
  });
  countStatus(s: string): number { return this.ws.inspections().filter((i) => i.status === s).length; }
  countSeverity(s: string): number {
    return this.ws.inspections().filter((i) => i.severity === s && i.status !== 'resolved').length;
  }
}
