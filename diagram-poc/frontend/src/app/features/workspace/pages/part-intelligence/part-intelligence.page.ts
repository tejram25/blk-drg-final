import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../../services/workspace.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../../ui';

/** Part search with lifecycle, stock and lead-time signals surfaced up front. */
@Component({
  selector: 'app-ws-part-intelligence',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent,
  ],
  styleUrls: ['../pages.css'],
  templateUrl: './part-intelligence.page.html',
})
export class PartIntelligencePage {
  readonly ws = inject(WorkspaceService);
  readonly query = signal('');
  readonly manufacturer = signal('');
  readonly lifecycle = signal('');

  readonly manufacturers = computed(() => [...new Set(this.ws.parts().map((p) => p.manufacturer))].sort());

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const m = this.manufacturer(); const l = this.lifecycle();
    return this.ws.parts().filter((p) =>
      (!q || `${p.mpn} ${p.description} ${p.category}`.toLowerCase().includes(q)) &&
      (!m || p.manufacturer === m) && (!l || p.lifecycle === l));
  });
  countLifecycle(l: string): number { return this.filtered().filter((p) => p.lifecycle === l).length; }
  readonly maxLead = computed(() => Math.max(...this.filtered().map((p) => p.leadTimeWeeks), 0));
  readonly recommendations = computed(() =>
    [...this.ws.parts()].filter((p) => p.lifecycle === 'Active').sort((a, b) => b.match - a.match).slice(0, 3));
}
