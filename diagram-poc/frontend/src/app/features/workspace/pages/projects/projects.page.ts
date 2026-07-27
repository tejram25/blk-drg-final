import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../../services/workspace.service';
import { WsBarComponent, WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../../ui';

/** Design-win pipeline: filterable project list plus a stage summary. */
@Component({
  selector: 'app-ws-projects',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent, WsBarComponent,
  ],
  styleUrls: ['../pages.css'],
  templateUrl: './projects.page.html',
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
