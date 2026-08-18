import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../../services/workspace.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../../ui';

/** Continuous compliance sweep: supply, lifecycle and process risks. */
@Component({
  selector: 'app-ws-inspection',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent,
  ],
  styleUrls: ['../pages.css'],
  templateUrl: './inspection.page.html',
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
