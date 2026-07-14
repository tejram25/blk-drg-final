import { Component, EventEmitter, Input, Output, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PartHit, PartSearchService } from '../../../../core/services/part-search.service';

/**
 * Side dock to search the Arrow parts catalogue (via the backend proxy). Shows
 * all results with inventory info, lets the user filter by supplier and pick an
 * order quantity, then adds a chosen part to the canvas as a part card.
 */
@Component({
    selector: 'app-part-search-panel',
    imports: [CommonModule, FormsModule, MatIconModule],
    templateUrl: './part-search-panel.component.html',
    styleUrls: ['./part-search-panel.component.css']
})
export class PartSearchPanelComponent implements AfterViewInit {
  @Output() close = new EventEmitter<void>();
  @Output() addPart = new EventEmitter<any>();
  @Output() attachPart = new EventEmitter<any>();
  /** Optional initial query (e.g. from a recommendation) — auto-searched on open. */
  @Input() seedQuery = '';
  /** Whether a block is currently selected on canvas (enables attach mode) */
  @Input() hasSelection = false;
  @ViewChild('box') boxRef!: ElementRef<HTMLInputElement>;

  query = '';
  results: PartHit[] = [];
  loading = false;
  searched = false;
  /** Selected supplier filter ('' = all suppliers). */
  supplierFilter = '';

  constructor(private api: PartSearchService) {}

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
      next: (hits) => { this.results = hits; this.loading = false; },
      error: () => { this.results = []; this.loading = false; },
    });
  }

  /** Distinct suppliers in the current results, for the filter dropdown. */
  get suppliers(): string[] {
    const set = new Set<string>();
    for (const r of this.results) {
      const s = r.manufacturer || r.supplier;
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  /** Results after applying the supplier filter. */
  get visibleResults(): PartHit[] {
    if (!this.supplierFilter) return this.results;
    return this.results.filter(
      (r) => (r.manufacturer || r.supplier) === this.supplierFilter,
    );
  }

  /** Clamp a hit's quantity to a sane minimum (its MOQ, or 1). */
  clampQty(hit: PartHit): void {
    const min = Math.max(1, hit.minOrderQty || 1);
    if (!hit.qty || hit.qty < min) hit.qty = min;
  }

  /** CSS modifier for the lifecycle-status pill. */
  statusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('nvr')) return 'neutral';
    if (s.includes('active') || s.includes('new')) return 'ok';
    if (s.includes('nrnd') || s.includes('eol') || s.includes('obsolete')) return 'bad';
    return 'neutral';
  }

  add(hit: PartHit): void {
    const part = { ...hit.raw, __bomQty: Math.max(1, hit.qty || 1) };
    this.addPart.emit(part);
  }

  attach(hit: PartHit): void {
    const part = { ...hit.raw, __bomQty: Math.max(1, hit.qty || 1) };
    this.attachPart.emit(part);
  }
}
