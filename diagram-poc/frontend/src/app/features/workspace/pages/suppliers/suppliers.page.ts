import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../../services/workspace.service';
import { WsBarComponent, WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../../ui';

/** Supplier scorecard: delivery, quality and lead time by franchise tier. */
@Component({
  selector: 'app-ws-suppliers',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent, WsBarComponent,
  ],
  styleUrls: ['../pages.css'],
  templateUrl: './suppliers.page.html',
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
