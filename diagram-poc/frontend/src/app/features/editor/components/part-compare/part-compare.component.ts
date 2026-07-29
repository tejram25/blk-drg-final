import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CatalogPart, formatPrice, statusTone } from '../../../../core/services/part-search.service';

/** One comparison row: a label and how to read + rank the value per part. */
interface CompareRow {
  label: string;
  /** Cell text for a part. */
  value: (p: CatalogPart) => string;
  /** Numeric score for best-in-class highlighting (higher = better); null = not ranked. */
  score?: (p: CatalogPart) => number | null;
  /** A pill tone for the cell (lifecycle colouring). */
  tone?: (p: CatalogPart) => 'ok' | 'warn' | 'risk' | '';
}

/**
 * Side-by-side part comparison — MCU vs MCU, LDO vs switching regulator, etc.
 *
 * Puts every catalogue parameter an engineer would otherwise gather by hand
 * from SiliconExpert / Oracle / a supplier site into one grid, and marks the
 * best value per row (cheapest, most stock, shortest lead, active lifecycle) so
 * the trade-off is readable at a glance.
 */
@Component({
  selector: 'app-part-compare',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './part-compare.component.html',
  styleUrls: ['./part-compare.component.css'],
})
export class PartCompareComponent {
  /** Parts to compare, in the order they were added. */
  @Input() set parts(value: CatalogPart[]) { this._parts.set(value ?? []); }
  get parts(): CatalogPart[] { return this._parts(); }
  private readonly _parts = signal<CatalogPart[]>([]);

  @Output() close = new EventEmitter<void>();
  @Output() remove = new EventEmitter<CatalogPart>();
  @Output() addPart = new EventEmitter<CatalogPart>();
  @Output() findAlternates = new EventEmitter<CatalogPart>();

  readonly rows: CompareRow[] = [
    { label: 'Manufacturer', value: (p) => p.manufacturer || '—' },
    { label: 'Category', value: (p) => p.category || '—' },
    { label: 'Description', value: (p) => p.description || '—' },
    { label: 'Lifecycle', value: (p) => p.status || '—',
      tone: (p) => statusTone(p.status),
      score: (p) => statusTone(p.status) === 'ok' ? 2 : statusTone(p.status) === 'warn' ? 1 : 0 },
    { label: 'In stock', value: (p) => this.num(p.stock.totalOnHand),
      score: (p) => p.stock.totalOnHand },
    { label: 'Stocking sites', value: (p) => `${p.stock.inStockLocations}/${p.stock.locationCount}` },
    { label: 'Lead time', value: (p) => p.leadTime.arrowWeeks ? `${p.leadTime.arrowWeeks} wk` : '—',
      // shorter lead is better → negate; blank never wins
      score: (p) => p.leadTime.arrowWeeks ? -Number(p.leadTime.arrowWeeks) : null },
    { label: 'Unit price', value: (p) => formatPrice(p.pricing.unitPrice, p.pricing.currency),
      score: (p) => { const n = Number(p.pricing.unitPrice); return n > 0 ? -n : null; } },
    { label: 'Price breaks', value: (p) => p.pricing.breaks.length ? `${p.pricing.breaks.length}` : '—' },
    { label: 'MOQ', value: (p) => p.packaging.minOrderQty ? this.num(p.packaging.minOrderQty) : '—' },
    { label: 'Package', value: (p) => p.packaging.packageType || '—' },
    { label: 'Compliance', value: (p) => p.compliance.standards.join(', ') || '—' },
    { label: 'SVHC', value: (p) => p.compliance.svhc ? 'Flagged' : 'Clear',
      tone: (p) => p.compliance.svhc ? 'warn' : 'ok' },
    { label: 'ECCN (US)', value: (p) => p.compliance.eccnUs || '—' },
    { label: 'Origin', value: (p) => p.compliance.countryOfOrigin || '—' },
    { label: 'Alternates', value: (p) => p.crossReferenced ? (p.crossRefTypes.join(', ') || 'Available') : 'None',
      tone: (p) => p.crossReferenced ? 'ok' : '' },
  ];

  /** Best part id per ranked row, for highlighting (empty when tied/unranked). */
  bestIdFor(row: CompareRow): string | null {
    if (!row.score) return null;
    let bestId: string | null = null;
    let best = -Infinity;
    let ties = 0;
    for (const p of this.parts) {
      const s = row.score(p);
      if (s === null) continue;
      if (s > best) { best = s; bestId = p.id; ties = 1; }
      else if (s === best) { ties++; }
    }
    return ties === 1 ? bestId : null;   // don't crown a tie
  }

  tone(p: CatalogPart, row: CompareRow): string { return row.tone ? row.tone(p) : ''; }
  private num(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`;
  }
}
