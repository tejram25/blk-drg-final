import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PartHit, PartSearchService } from '../../../../core/services/part-search.service';

/**
 * Glassmorphic popover anchored to a block. Searches the Arrow catalogue for the
 * block's name, lets the user filter by supplier and pick a real part (with live
 * stock/status) to link to that block. Self-contained: it owns the search.
 */
@Component({
  selector: 'app-block-part-popover',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './block-part-popover.component.html',
  styleUrls: ['./block-part-popover.component.css'],
})
export class BlockPartPopoverComponent implements OnInit {
  /** Block name — seeds the initial catalogue search. */
  @Input() blockName = '';
  /** Screen position (px, relative to the canvas wrap) to anchor at. */
  @Input() x = 0;
  @Input() y = 0;
  @Output() link = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();

  query = '';
  results: PartHit[] = [];
  loading = false;
  searched = false;
  supplierFilter = '';

  constructor(private api: PartSearchService) {}

  ngOnInit(): void {
    this.query = (this.blockName || '').trim();
    if (this.query) this.search();
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

  get suppliers(): string[] {
    const set = new Set<string>();
    for (const r of this.results) {
      const s = r.manufacturer || r.supplier;
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  get visibleResults(): PartHit[] {
    if (!this.supplierFilter) return this.results;
    return this.results.filter((r) => (r.manufacturer || r.supplier) === this.supplierFilter);
  }

  /** Stock-status dot class: green in-stock/active, amber risk, grey dead/none. */
  dotClass(hit: PartHit): string {
    const s = (hit.status || '').toLowerCase();
    const dead = s.includes('nvr') || s.includes('never') || s.includes('obsolete') || s.includes('eol');
    if (dead) return 'grey';
    if (hit.inStock > 0) return 'green';
    return 'amber';
  }

  add(hit: PartHit): void {
    this.link.emit({ ...hit.raw, __bomQty: Math.max(1, hit.qty || 1) });
  }
}
