import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CatalogPart, PartSearchService, formatPrice, statusTone,
} from '../../../../core/services/part-search.service';
import { PartCompareComponent } from '../part-compare/part-compare.component';

/**
 * Side dock to search the parts catalogue. Results arrive already grouped per
 * part (the catalogue returns one row per stocking location — see
 * PartSearchNormalizer), so this shows one row per part with its aggregated
 * stock, lead time and price, and adds the chosen part to the canvas or
 * attaches it to the selected block.
 *
 * Parts can also be ticked into a comparison set and opened side by side, so an
 * engineer weighs alternatives (stock, lead, price, lifecycle) in one place
 * instead of jumping between supplier sites.
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
  searched = false;
  /** Manufacturer filter ('' = all). */
  supplierFilter = '';
  /** Chosen order quantity per part id. */
  qtyById: Record<string, number> = {};

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
    this.supplierFilter = '';
    this.api.search(q).subscribe({
      next: (res) => {
        this.results = res.parts;
        for (const p of res.parts) {
          this.qtyById[p.id] = Math.max(1, p.packaging.minOrderQty || 1);
        }
        this.loading = false;
      },
      error: () => { this.results = []; this.loading = false; },
    });
  }

  /** Distinct manufacturers in the current results, for the filter dropdown. */
  get suppliers(): string[] {
    const set = new Set<string>();
    for (const r of this.results) {
      const s = r.manufacturer || r.supplier;
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  get visibleResults(): CatalogPart[] {
    if (!this.supplierFilter) return this.results;
    return this.results.filter((r) => (r.manufacturer || r.supplier) === this.supplierFilter);
  }

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
  alternates(partNumber: string): void {
    this.compareOpen = false;
    this.checkAlternates.emit(partNumber);
  }

  /** CSS modifier for the lifecycle-status pill. */
  statusClass(status: string): string {
    const tone = statusTone(status);
    return tone === 'ok' ? 'ok' : tone === 'risk' ? 'bad' : 'neutral';
  }

  price(p: CatalogPart): string { return formatPrice(p.pricing.unitPrice, p.pricing.currency); }

  add(p: CatalogPart): void { this.addPart.emit(this.forCanvas(p)); }
  attach(p: CatalogPart): void { this.attachPart.emit(this.forCanvas(p)); }

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
      leadTime: { arwLT: p.leadTime.arrowWeeks, suppLT: p.leadTime.supplierWeeks },
      invOrgs: [{
        desc: p.description,
        status: p.status,
        minOrdQty: p.packaging.minOrderQty,
        pkg: p.packaging.packageType,
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
