import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../../services/workspace.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../../ui';
import { NotificationService } from '../../../../core/services/notification.service';
import { Priority } from '../../models/workspace.models';

/** Engineering support queue: triage inbound queries and raise new ones. */
@Component({
  selector: 'app-ws-support',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent,
  ],
  styleUrls: ['../pages.css'],
  templateUrl: './support.page.html',
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
