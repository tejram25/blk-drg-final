import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CatalogPart, PartSearchService, formatPrice, mergeParts, statusTone,
} from '../../../../core/services/part-search.service';
import { PartCompareComponent } from '../part-compare/part-compare.component';

/** How the result list is ordered. */
type SortKey = 'relevance' | 'stock' | 'price' | 'lead' | 'moq' | 'part';

/**
 * Full-screen catalogue search.
 *
 * Results arrive already grouped per part (the catalogue returns one row per
 * stocking location — see PartSearchNormalizer), so the list shows one row per
 * part and the detail pane opens everything the catalogue knows about the
 * selected one: every stocking site, the whole price-break ladder, packaging,
 * lead times and compliance. That is the point of the centre-stage layout —
 * an engineer should not have to leave for SiliconExpert / Oracle / a supplier
 * site to answer "can I design this in?".
 *
 * Parts can also be ticked into a comparison set and opened side by side.
 */
@Component({
    selector: 'app-part-search-panel',
    imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule, PartCompareComponent],
    templateUrl: './part-search-panel.component.html',
    styleUrls: ['./part-search-panel.component.css']
})
export class PartSearchPanelComponent implements AfterViewInit {
  private readonly api = inject(PartSearchService);

  @Output() close = new EventEmitter<void>();
  @Output() addPart = new EventEmitter<any>();
  @Output() attachPart = new EventEmitter<any>();
  /** Ask the editor to show lifecycle + alternates (SiliconExpert-style) for a part. */
  @Output() checkAlternates = new EventEmitter<string>();
  /** Optional initial query (e.g. from a recommendation) — auto-searched on open. */
  @Input() seedQuery = '';
  /** Whether a block is currently selected on canvas (enables attach mode) */
  @Input() hasSelection = false;
  @ViewChild('box') boxRef!: ElementRef<HTMLInputElement>;

  query = '';
  results: CatalogPart[] = [];
  loading = false;
  loadingMore = false;
  searched = false;
  /** Total parts upstream matched, and whether another page exists. */
  total = 0;
  hasMore = false;
  private nextStart = 0;

  // ---- filters / sort ----
  /** Manufacturer filter ('' = all). */
  supplierFilter = '';
  /** Category filter ('' = all). */
  categoryFilter = '';
  /** Only parts with stock on hand somewhere. */
  inStockOnly = false;
  /** Only parts with an Active lifecycle status. */
  activeOnly = false;
  /** Hide parts flagged NRND / EOL / obsolete. */
  hideRisk = false;
  /** Only parts whose Arrow lead time is at or under this many weeks (0 = any). */
  maxLeadWeeks = 0;
  sort: SortKey = 'relevance';

  /** Chosen order quantity per part id. */
  qtyById: Record<string, number> = {};
  /** The part shown in the detail pane. */
  selected: CatalogPart | null = null;

  ngAfterViewInit(): void {
    if (this.seedQuery && this.seedQuery.trim()) {
      this.query = this.seedQuery.trim();
      this.search();
    } else {
      setTimeout(() => this.boxRef?.nativeElement.focus());
    }
  }

  search(): void {
    const q = this.query.trim();
    if (!q || this.loading) return;
    this.loading = true;
    this.searched = true;
    this.resetFilters();
    this.selected = null;
    this.api.search(q, { inStock: this.inStockOnly, active: this.activeOnly }, 0).subscribe({
      next: (res) => {
        this.results = res.parts;
        this.total = res.total;
        this.hasMore = res.hasMore;
        this.nextStart = res.nextStart;
        this.seedQuantities(res.parts);
        this.loading = false;
        // Open the best match straight away — the detail pane is the point.
        this.selected = this.visibleResults[0] ?? null;
      },
      error: () => {
        this.results = []; this.total = 0; this.hasMore = false;
        this.loading = false;
      },
    });
  }

  /**
   * Fetch the next upstream page and fold it in. Paging is over upstream rows,
   * so a later page often carries more *locations* for parts already listed
   * rather than new parts — mergeParts handles that.
   */
  loadMore(): void {
    if (!this.hasMore || this.loading || this.loadingMore) return;
    this.loadingMore = true;
    this.api.search(this.query.trim(), { inStock: this.inStockOnly, active: this.activeOnly }, this.nextStart)
      .subscribe({
        next: (res) => {
          this.results = mergeParts(this.results, res.parts);
          this.hasMore = res.hasMore;
          this.nextStart = res.nextStart;
          this.total = res.total;
          this.seedQuantities(res.parts);
          this.loadingMore = false;
        },
        error: () => { this.loadingMore = false; this.hasMore = false; },
      });
  }

  private seedQuantities(parts: CatalogPart[]): void {
    for (const p of parts) {
      if (this.qtyById[p.id] == null) this.qtyById[p.id] = Math.max(1, p.packaging.minOrderQty || 1);
    }
  }
  private resetFilters(): void {
    this.supplierFilter = ''; this.categoryFilter = '';
    this.hideRisk = false; this.maxLeadWeeks = 0; this.sort = 'relevance';
  }
  /** Re-run the search when a filter the backend applies changes. */
  reSearch(): void { if (this.searched) this.search(); }

  // In-stock and Active are applied upstream, so flipping them re-queries.
  toggleInStock(): void { this.inStockOnly = !this.inStockOnly; this.reSearch(); }
  toggleActive(): void { this.activeOnly = !this.activeOnly; this.reSearch(); }

  /** Distinct manufacturers in the current results, for the filter dropdown. */
  get suppliers(): string[] {
    const set = new Set<string>();
    for (const r of this.results) {
      const s = r.manufacturer || r.supplier;
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  /** Distinct categories in the current results. */
  get categories(): string[] {
    const set = new Set<string>();
    for (const r of this.results) if (r.category) set.add(r.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  get visibleResults(): CatalogPart[] {
    const out = this.results.filter((r) => {
      if (this.supplierFilter && (r.manufacturer || r.supplier) !== this.supplierFilter) return false;
      if (this.categoryFilter && r.category !== this.categoryFilter) return false;
      if (this.inStockOnly && !r.stock.totalOnHand) return false;
      if (this.activeOnly && statusTone(r.status) !== 'ok') return false;
      if (this.hideRisk && statusTone(r.status) === 'risk') return false;
      if (this.maxLeadWeeks > 0) {
        const wk = Number(r.leadTime.arrowWeeks);
        if (!Number.isFinite(wk) || wk <= 0 || wk > this.maxLeadWeeks) return false;
      }
      return true;
    });
    return this.sortResults(out);
  }

  /** Ties keep the upstream (relevance) order, so sorting is stable. */
  private sortResults(list: CatalogPart[]): CatalogPart[] {
    if (this.sort === 'relevance') return list;
    const rank = (p: CatalogPart): number => {
      switch (this.sort) {
        case 'stock': return -p.stock.totalOnHand;               // most first
        case 'price': return this.numOr(p.pricing.unitPrice, Infinity);
        case 'lead': return this.numOr(p.leadTime.arrowWeeks, Infinity);
        case 'moq': return p.packaging.minOrderQty || Infinity;
        default: return 0;
      }
    };
    return [...list].sort((a, b) =>
      this.sort === 'part' ? a.partNumber.localeCompare(b.partNumber) : rank(a) - rank(b));
  }
  private numOr(v: string | number, fallback: number): number {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  /** True when any client-side filter is narrowing the list. */
  get filtered(): boolean {
    return !!(this.supplierFilter || this.categoryFilter || this.hideRisk || this.maxLeadWeeks);
  }
  clearFilters(): void {
    this.supplierFilter = ''; this.categoryFilter = '';
    this.hideRisk = false; this.maxLeadWeeks = 0;
  }

  select(p: CatalogPart): void { this.selected = p; }
  isSelected(p: CatalogPart): boolean { return this.selected?.id === p.id; }

  qtyOf(p: CatalogPart): number { return this.qtyById[p.id] ?? 1; }
  setQty(p: CatalogPart, value: number): void {
    this.qtyById[p.id] = Math.max(1, Number(value) || 1);
  }

  // ---- comparison --------------------------------------------------------
  /** Parts ticked for comparison, keyed by id, kept in insertion order. */
  private readonly compareMap = new Map<string, CatalogPart>();
  compareOpen = false;

  get compareList(): CatalogPart[] { return [...this.compareMap.values()]; }
  get compareCount(): number { return this.compareMap.size; }
  inCompare(p: CatalogPart): boolean { return this.compareMap.has(p.id); }

  toggleCompare(p: CatalogPart, event?: Event): void {
    event?.stopPropagation();
    if (this.compareMap.has(p.id)) this.compareMap.delete(p.id);
    else this.compareMap.set(p.id, p);
  }
  removeFromCompare(p: CatalogPart): void {
    this.compareMap.delete(p.id);
    if (!this.compareMap.size) this.compareOpen = false;
  }
  openCompare(): void { if (this.compareMap.size) this.compareOpen = true; }
  addFromCompare(p: CatalogPart): void { this.add(p); }

  /** Show real alternates (and EOL/lifecycle risk) for a part, via the editor. */
  alternates(partNumber: string, event?: Event): void {
    event?.stopPropagation();
    this.compareOpen = false;
    this.checkAlternates.emit(partNumber);
  }

  /** CSS modifier for the lifecycle-status pill. */
  statusClass(status: string): string {
    const tone = statusTone(status);
    return tone === 'ok' ? 'ok' : tone === 'risk' ? 'bad' : 'neutral';
  }
  /** True when a part carries a lifecycle risk worth flagging in the list. */
  atRisk(p: CatalogPart): boolean { return statusTone(p.status) === 'risk'; }

  /**
   * Supply is constrained. The upstream writes "NONE" for unconstrained, so an
   * absent value is treated as unconstrained rather than as allocation.
   */
  allocated(p: CatalogPart): boolean {
    const a = (p.sourcing?.allocation || '').trim().toUpperCase();
    return !!a && a !== 'NONE';
  }
  /** Any supply-risk signal, for the one-glance flag on a result row. */
  supplyRisk(p: CatalogPart): boolean {
    return this.allocated(p) || !!p.sourcing?.changeNotice || !!p.sourcing?.soleSource;
  }

  price(p: CatalogPart): string { return formatPrice(p.pricing.unitPrice, p.pricing.currency); }
  priceOf(value: string, currency: string): string { return formatPrice(value, currency); }

  add(p: CatalogPart, event?: Event): void { event?.stopPropagation(); this.addPart.emit(this.forCanvas(p)); }
  attach(p: CatalogPart, event?: Event): void { event?.stopPropagation(); this.attachPart.emit(this.forCanvas(p)); }

  /**
   * The object stored on the diagram node.
   *
   * Carries the normalised part *and* the catalogue-shaped fields the canvas,
   * properties panel and saved diagrams have always read
   * ({@code arwPartNum.name}, {@code invOrgs[0].desc}, …). Adapting once here
   * keeps the persisted diagram format unchanged — so diagrams saved before and
   * after this change stay interchangeable — instead of rewriting a dozen
   * readers and breaking existing files.
   */
  private forCanvas(p: CatalogPart): any {
    const best = p.locations[0];
    return {
      ...p,
      __bomQty: this.qtyOf(p),
      arwPartNum: { name: p.partNumber },
      suppPartNum: { name: p.supplierPartNumber || p.partNumber },
      mfr: { name: p.manufacturer },
      supp: { name: p.supplier },
      icc: { name: p.category, tree: p.categoryPath.join('|') },
      leadTime: {
        arwLT: p.leadTime.arrowWeeks, suppLT: p.leadTime.supplierWeeks,
        suppAvail: p.leadTime.supplierAvailable, factStkDate: p.leadTime.factoryStockDate,
      },
      invOrgs: [{
        desc: p.description,
        status: p.status,
        minOrdQty: p.packaging.minOrderQty,
        pkg: p.packaging.packageType,
        // Mirrored into the catalogue shape too, so a saved diagram carries the
        // supply signals in the same place every other reader expects them.
        suppAlloc: p.sourcing?.allocation ?? '',
        pcn: { ind: p.sourcing?.changeNotice ? 'Yes' : 'No' },
        soleSrc: p.sourcing?.soleSource ? 'Yes' : 'No',
        avail: { totohQty: p.stock.totalOnHand, nextDelivery: p.stock.nextDelivery },
        webPrice: { currency: p.pricing.currency, resalelist: p.pricing.breaks },
        coo: p.compliance.countryOfOrigin,
        ...(best ? { IODesc: best.description } : {}),
      }],
      EnvData: { complianceList: p.compliance.standards.map((type) => ({ type })) },
      paramData: [],
    };
  }
}
