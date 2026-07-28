import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CatalogPart, PartSearchResponse, PartSearchService, formatPrice, mergeParts, statusTone,
} from '../../../../core/services/part-search.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PartLinkService } from '../../services/part-link.service';
import { ProjectWorkspaceService } from '../../services/project-workspace.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../../ui';

/** Upstream rows per request — the catalogue's own page size. */
const PAGE_SIZE = 25;

/**
 * Part search.
 *
 * The catalogue returns one row per stocking location, so the backend groups
 * them into parts before they get here (see PartSearchNormalizer) — this page
 * shows one card per part and puts the locations behind a detail view, rather
 * than the same part repeated 25 times.
 *
 * A found part can be linked straight onto the open project, or onto a selected
 * block in the diagram, which is the whole point of searching from here.
 */
@Component({
  selector: 'app-ws-parts',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatTooltipModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent,
  ],
  templateUrl: './parts.page.html',
  styleUrls: ['../pages.css', './parts.page.css'],
})
export class PartsPage {
  private readonly api = inject(PartSearchService);
  private readonly notify = inject(NotificationService);
  private readonly links = inject(PartLinkService);
  readonly pw = inject(ProjectWorkspaceService);

  // Signals, not plain fields: the computed views below only track signals.
  readonly query = signal('');
  readonly manufacturer = signal('');
  readonly inStockOnly = signal(false);
  readonly activeOnly = signal(false);

  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly searched = signal(false);
  readonly result = signal<PartSearchResponse | null>(null);
  readonly selected = signal<CatalogPart | null>(null);
  readonly qty = signal(1);

  /** Parts accumulated across pages — see mergeParts for why this is not a concat. */
  readonly parts = signal<CatalogPart[]>([]);
  /** Upstream rows loaded so far, which is what the catalogue actually pages. */
  readonly rowsLoaded = signal(0);
  readonly hasMore = computed(() => this.result()?.hasMore ?? false);

  /** Manufacturers present in the current result, for the narrowing filter. */
  readonly manufacturers = computed(() =>
    [...new Set(this.parts().map((p) => p.manufacturer).filter(Boolean))].sort());

  /** Headline figures for the current result. */
  readonly inStockCount = computed(() => this.parts().filter((p) => p.stock.totalOnHand > 0).length);
  readonly activeCount = computed(() => this.parts().filter((p) => statusTone(p.status) === 'ok').length);
  readonly locationCount = computed(() =>
    this.parts().reduce((sum, p) => sum + p.stock.locationCount, 0));

  private filters() {
    return {
      manufacturer: this.manufacturer() || undefined,
      inStock: this.inStockOnly(),
      active: this.activeOnly(),
    };
  }

  search(): void {
    const q = this.query().trim();
    if (!q) return;
    this.loading.set(true);
    this.selected.set(null);
    this.parts.set([]);
    this.rowsLoaded.set(0);
    this.api.search(q, this.filters(), 0, PAGE_SIZE).subscribe({
      next: (r) => {
        this.result.set(r);
        this.parts.set(r.parts);
        this.rowsLoaded.set(r.returned);
        this.loading.set(false);
        this.searched.set(true);
      },
      error: () => {
        this.loading.set(false); this.searched.set(true);
        this.result.set(null); this.parts.set([]);
      },
    });
  }

  /**
   * Load the next page of upstream rows and fold it in. A page often adds
   * locations to parts already listed rather than new parts, which is why the
   * button reports rows loaded rather than promising more results.
   */
  loadMore(): void {
    const r = this.result();
    if (!r || !r.hasMore || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.api.search(r.query, this.filters(), r.nextStart, PAGE_SIZE).subscribe({
      next: (next) => {
        this.parts.set(mergeParts(this.parts(), next.parts));
        this.rowsLoaded.update((n) => n + next.returned);
        this.result.set(next);
        this.loadingMore.set(false);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  select(p: CatalogPart): void {
    this.selected.set(this.selected()?.id === p.id ? null : p);
  }

  // ---- linking -----------------------------------------------------------
  /** Attach the part to the open project's BOM. */
  linkToProject(p: CatalogPart): void {
    this.links.linkToProject(p, this.qty());
    this.notify.success(`${p.partNumber} linked to ${this.pw.openProject().name}.`);
  }

  /**
   * Stage the part for the diagram: the editor picks it up and attaches it to
   * the selected block (or drops it on the canvas when nothing is selected).
   */
  linkToDiagram(p: CatalogPart): void {
    this.links.stageForDiagram(p, this.qty());
    this.notify.info(`${p.partNumber} staged — open a diagram and pick a block to attach it.`);
  }

  // ---- display helpers ---------------------------------------------------
  tone(status: string) { return statusTone(status); }
  price(p: CatalogPart): string { return formatPrice(p.pricing.unitPrice, p.pricing.currency); }
  qtyLabel(n: number): string { return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`; }
  lead(p: CatalogPart): string {
    const w = p.leadTime.arrowWeeks;
    return w ? `${w} wk` : '—';
  }
}
