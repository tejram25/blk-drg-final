import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../workspace.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../ui/ws-ui';
import { NotificationService } from '../../../core/services/notification.service';
import { Priority } from '../workspace.models';

/** Engineering support queue: triage inbound queries and raise new ones. */
@Component({
  selector: 'app-ws-support',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent,
  ],
  styleUrls: ['./pages.css'],
  template: `
    <ws-page-header title="Support / Query"
      subtitle="Design-in questions routed to the engineering team." />

    <div class="grid stats">
      <ws-stat label="Open" [value]="countBy('open')" icon="inbox" tone="accent" />
      <ws-stat label="In progress" [value]="countBy('in-progress')" icon="pending_actions" />
      <ws-stat label="Waiting" [value]="countBy('waiting')" icon="hourglass_empty" tone="warn" />
      <ws-stat label="High priority" [value]="highPriority()" icon="priority_high"
        [tone]="highPriority() ? 'risk' : 'ok'" />
    </div>

    <div class="filters">
      <input [ngModel]="query()" (ngModelChange)="query.set($event)"
        placeholder="Filter by title, project or part…" aria-label="Filter queries" />
      <select [ngModel]="status()" (ngModelChange)="status.set($event)" aria-label="Filter by status">
        <option value="">All statuses</option>
        <option value="open">Open</option>
        <option value="in-progress">In progress</option>
        <option value="waiting">Waiting</option>
        <option value="closed">Closed</option>
      </select>
    </div>

    <div class="grid two">
      <ws-panel heading="Query queue" [flush]="true">
        <div class="table-wrap">
          <table class="tbl">
            <thead>
              <tr><th>Query</th><th>Project</th><th>Part</th><th>Priority</th><th>Status</th><th>Assignee</th><th class="num">Age</th></tr>
            </thead>
            <tbody>
              @for (t of filtered(); track t.id) {
                <tr>
                  <td class="ink">{{ t.title }}<div class="detail">{{ t.id }} · {{ t.requester }}</div></td>
                  <td>{{ t.project }}</td>
                  <td class="mono">{{ t.part }}</td>
                  <td><ws-pill [tone]="t.priority === 'high' ? 'risk' : t.priority === 'medium' ? 'warn' : ''">
                    {{ t.priority }}</ws-pill></td>
                  <td><ws-pill [tone]="t.status === 'closed' ? 'ok' : t.status === 'waiting' ? 'warn' : 'accent'">
                    {{ t.status }}</ws-pill></td>
                  <td>{{ t.assignee }}</td>
                  <td class="num">{{ t.age }}</td>
                </tr>
              } @empty { <tr><td colspan="7" class="empty">Nothing in the queue matches those filters.</td></tr> }
            </tbody>
          </table>
        </div>
      </ws-panel>

      <ws-panel heading="Raise a query">
        <form class="form" (ngSubmit)="submit()">
          <div class="field">
            <label for="qt">Title</label>
            <input id="qt" [ngModel]="title()" (ngModelChange)="title.set($event)" name="title"
              placeholder="e.g. Alternate for EOL buck regulator" required />
          </div>
          <div class="field-row">
            <div class="field">
              <label for="qp">Project</label>
              <select id="qp" [ngModel]="project()" (ngModelChange)="project.set($event)" name="project">
                @for (p of ws.projects(); track p.id) { <option [value]="p.name">{{ p.name }}</option> }
              </select>
            </div>
            <div class="field">
              <label for="qpr">Priority</label>
              <select id="qpr" [ngModel]="priority()" (ngModelChange)="priority.set($event)" name="priority">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </select>
            </div>
          </div>
          <div class="field">
            <label for="qpart">Part number (optional)</label>
            <input id="qpart" [ngModel]="part()" (ngModelChange)="part.set($event)" name="part"
              placeholder="e.g. LM2596S-5.0" />
          </div>
          <div>
            <button type="submit" class="btn primary" [disabled]="!title().trim()">
              <mat-icon>send</mat-icon> Submit query
            </button>
          </div>
        </form>
      </ws-panel>
    </div>
  `,
})
export class SupportPage {
  readonly ws = inject(WorkspaceService);
  private readonly notify = inject(NotificationService);

  readonly query = signal('');
  readonly status = signal('');
  readonly title = signal('');
  readonly project = signal('');
  readonly priority = signal<Priority>('medium');
  readonly part = signal('');

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase(); const st = this.status();
    return this.ws.tickets().filter((t) =>
      (!q || `${t.title} ${t.project} ${t.part} ${t.id}`.toLowerCase().includes(q)) &&
      (!st || t.status === st));
  });
  countBy(s: string): number { return this.ws.tickets().filter((t) => t.status === s).length; }
  readonly highPriority = computed(() =>
    this.ws.tickets().filter((t) => t.priority === 'high' && t.status !== 'closed').length);

  submit(): void {
    if (!this.title().trim()) return;
    this.ws.addTicket({
      title: this.title().trim(),
      project: this.project() || this.ws.projects()[0].name,
      part: this.part().trim() || '—',
      priority: this.priority(),
    });
    this.notify.success('Query submitted to the engineering queue.');
    this.title.set(''); this.part.set(''); this.priority.set('medium');
  }
}
