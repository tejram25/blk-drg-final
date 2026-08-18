import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../../services/workspace.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../../ui';

/** Cross references and parametric search over the reference library. */
@Component({
  selector: 'app-ws-fast-repository',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent,
  ],
  styleUrls: ['../pages.css'],
  templateUrl: './fast-repository.page.html',
})
export class FastRepositoryPage {
  readonly ws = inject(WorkspaceService);
  readonly xrefQuery = signal('');
  readonly category = signal('');
  readonly minStock = signal(0);
  readonly maxLead = signal(26);

  readonly xrefs = computed(() => {
    const q = this.xrefQuery().trim().toLowerCase();
    return this.ws.crossRefs().filter((x) =>
      !q || `${x.original} ${x.alternate}`.toLowerCase().includes(q));
  });
  countKind(k: string): number { return this.ws.crossRefs().filter((x) => x.kind === k).length; }
  readonly categories = computed(() => [...new Set(this.ws.parts().map((p) => p.category))].sort());
  readonly parametric = computed(() => {
    const c = this.category();
    return this.ws.parts().filter((p) =>
      (!c || p.category === c) && p.stock >= this.minStock() && p.leadTimeWeeks <= this.maxLead());
  });
}
