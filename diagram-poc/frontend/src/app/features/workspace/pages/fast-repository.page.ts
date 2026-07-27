import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceService } from '../workspace.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../ui/ws-ui';

/** Cross references and parametric search over the reference library. */
@Component({
  selector: 'app-ws-fast-repository',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent,
  ],
  styleUrls: ['./pages.css'],
  template: `
    <ws-page-header title="Fast Repository"
      subtitle="Cross references and parametric lookups for design-in and rescue work." />

    <div class="grid stats">
      <ws-stat label="Cross references" [value]="ws.crossRefs().length" icon="swap_horiz" />
      <ws-stat label="Exact matches" [value]="countKind('exact')" icon="check_circle" tone="ok" />
      <ws-stat label="Needs review" [value]="countKind('parametric')" icon="rule"
        [tone]="countKind('parametric') ? 'warn' : ''" hint="verify before use" />
      <ws-stat label="Parts indexed" [value]="ws.parts().length" icon="inventory_2" />
    </div>

    <div class="grid two">
      <ws-panel heading="Cross reference" [flush]="true">
        <div style="padding:12px 15px">
          <input class="filters" style="width:100%;margin:0"
            [ngModel]="xrefQuery()" (ngModelChange)="xrefQuery.set($event)"
            placeholder="Enter a part number to cross reference…" aria-label="Cross reference search" />
        </div>
        <div class="table-wrap">
          <table class="tbl">
            <thead><tr><th>Original</th><th>Alternate</th><th>Type</th><th class="num">Confidence</th></tr></thead>
            <tbody>
              @for (x of xrefs(); track x.original + x.alternate) {
                <tr>
                  <td class="mono">{{ x.original }}<div class="detail">{{ x.originalMfr }}</div></td>
                  <td class="mono">{{ x.alternate }}<div class="detail">{{ x.alternateMfr }}</div></td>
                  <td><ws-pill [tone]="x.kind === 'exact' ? 'ok' : x.kind === 'functional' ? 'accent' : 'warn'">
                    {{ x.kind }}</ws-pill>
                    <div class="detail">{{ x.note }}</div></td>
                  <td class="num">{{ x.confidence }}%</td>
                </tr>
              } @empty { <tr><td colspan="4" class="empty">No cross references for that part.</td></tr> }
            </tbody>
          </table>
        </div>
      </ws-panel>

      <ws-panel heading="Parametric search">
        <form class="form" (ngSubmit)="$event.preventDefault()">
          <div class="field">
            <label for="pcat">Category</label>
            <select id="pcat" [ngModel]="category()" (ngModelChange)="category.set($event)" name="cat">
              <option value="">Any</option>
              @for (c of categories(); track c) { <option [value]="c">{{ c }}</option> }
            </select>
          </div>
          <div class="field-row">
            <div class="field">
              <label for="pstock">Minimum stock</label>
              <input id="pstock" type="number" min="0" [ngModel]="minStock()"
                (ngModelChange)="minStock.set(+$event)" name="stock" />
            </div>
            <div class="field">
              <label for="plead">Max lead (weeks)</label>
              <input id="plead" type="number" min="0" [ngModel]="maxLead()"
                (ngModelChange)="maxLead.set(+$event)" name="lead" />
            </div>
          </div>
        </form>
        <div class="table-wrap" style="margin-top:12px">
          <table class="tbl">
            <thead><tr><th>Part</th><th class="num">Stock</th><th class="num">Lead</th></tr></thead>
            <tbody>
              @for (p of parametric(); track p.mpn) {
                <tr><td class="mono">{{ p.mpn }}</td><td class="num">{{ p.stock | number }}</td>
                  <td class="num">{{ p.leadTimeWeeks }}w</td></tr>
              } @empty { <tr><td colspan="3" class="empty">Nothing meets those constraints.</td></tr> }
            </tbody>
          </table>
        </div>
      </ws-panel>
    </div>
  `,
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
