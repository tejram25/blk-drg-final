import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CatalogPart, PartSearchResponse, PartSearchService, formatPrice, mergeParts, statusTone,
} from '../../../../core/services/part-search.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { Artifact } from '../../models/workspace.models';
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
  private readonly router = inject(Router);
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
  /** Attach the part to the open project's BOM — it shows up in the project. */
  linkToProject(p: CatalogPart): void {
    this.links.linkToProject(p, this.qty(), this.pw.openProject().id);
    // The workspace reactively grows a BOM line and a Linked-parts dataset.
    this.notify.success(`${p.partNumber} linked to ${this.pw.openProject().name}.`);
  }

  // ---- diagram picker ----------------------------------------------------
  /** Diagrams in the open project — the choices for "Use in diagram". */
  readonly diagrams = computed(() =>
    this.pw.openProject().artifacts.filter((a) => a.kind === 'diagram'));
  /** The part awaiting a diagram choice; opens the picker when set. */
  readonly pendingPart = signal<CatalogPart | null>(null);

  /**
   * "Use in diagram". With one diagram, go straight there; with several, ask
   * which; with none, offer to start one. Either way the part is staged so the
   * editor can attach it to a block once you pick one.
   */
  linkToDiagram(p: CatalogPart): void {
    const diagrams = this.diagrams();
    if (diagrams.length === 0) {
      const created = this.pw.newDiagram();
      this.stageAndOpen(p, created);
      return;
    }
    if (diagrams.length === 1) {
      this.stageAndOpen(p, diagrams[0]);
      return;
    }
    this.pendingPart.set(p);   // several: show the picker
  }

  /** A diagram was chosen from the picker. */
  chooseDiagram(artifact: Artifact): void {
    const p = this.pendingPart();
    this.pendingPart.set(null);
    if (p) this.stageAndOpen(p, artifact);
  }

  cancelPicker(): void { this.pendingPart.set(null); }

  /** Stage the part for the editor, then open the chosen diagram for block selection. */
  private stageAndOpen(p: CatalogPart, artifact: Artifact): void {
    this.links.stageForDiagram(p, this.qty());
    // A part used on a project's diagram is part of that project — link it and
    // give it a BOM home so it appears in the workspace either way.
    this.links.linkToProject(p, this.qty(), this.pw.openProject().id);
    this.pw.open(artifact);
    this.notify.info(`${p.partNumber} staged — pick a block in “${artifact.name}” to attach it.`);
    this.pw.resolveDiagram(artifact).subscribe({
      next: (id) => this.router.navigate(['/workspace/block-diagram', id]),
      error: () => this.router.navigate(['/workspace/block-diagram', 'new']),
    });
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
