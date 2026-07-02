import { Injectable } from '@angular/core';

/** One line of a Bill of Materials (one distinct part, with its quantity). */
export interface BomRow {
  partNumber: string;
  manufacturer: string;
  supplier: string;
  description: string;
  quantity: number;
  /** Supplier offers to choose from at export (from an AI-linked component). */
  suppliers?: { name: string }[];
}

/**
 * Builds a Bill of Materials from catalogue part-card data placed on the canvas.
 * Pure/stateless: callers pass the raw `data.part` objects from part-card nodes.
 */
@Injectable({ providedIn: 'root' })
export class BomService {
  /** Group part objects by part number and tally quantities. */
  build(parts: any[]): BomRow[] {
    const byKey = new Map<string, BomRow>();
    for (const part of parts) {
      const partNumber =
        part?.arwPartNum?.name || part?.suppPartNum?.name || part?.partKey || 'Unknown';
      // Quantity chosen in the search panel (__bomQty); otherwise one per card.
      const qty = Math.max(1, Number(part?.__bomQty ?? 1));
      const existing = byKey.get(partNumber);
      if (existing) {
        existing.quantity += qty;
        continue;
      }
      byKey.set(partNumber, {
        partNumber,
        manufacturer: part?.mfr?.name || '',
        supplier: part?.supp?.name || '',
        description: part?.invOrgs?.[0]?.desc || part?.icc?.name || '',
        quantity: qty,
      });
    }
    return [...byKey.values()].sort((a, b) => a.partNumber.localeCompare(b.partNumber));
  }

  /**
   * Build a BOM from catalogue part cards AND boxes with an AI-linked component.
   * Linked items carry {partNumber, manufacturer, partDesc, supplier, suppliers,
   * quantity}; quantities for the same part number are tallied together.
   */
  buildCombined(parts: any[], linked: any[]): BomRow[] {
    const byKey = new Map<string, BomRow>();
    for (const r of this.build(parts)) byKey.set(r.partNumber, r);
    for (const l of linked || []) {
      const partNumber = l?.partNumber;
      if (!partNumber) continue;
      const qty = Math.max(1, Number(l?.quantity ?? 1));
      const existing = byKey.get(partNumber);
      if (existing) {
        existing.quantity += qty;
        if (!existing.supplier && l?.supplier) existing.supplier = l.supplier;
        if ((!existing.suppliers || !existing.suppliers.length) && Array.isArray(l?.suppliers)) {
          existing.suppliers = l.suppliers.map((s: any) => ({ name: s?.name })).filter((s: any) => s.name);
        }
        continue;
      }
      const suppliers = Array.isArray(l?.suppliers)
        ? l.suppliers.map((s: any) => ({ name: s?.name })).filter((s: any) => s.name) : [];
      byKey.set(partNumber, {
        partNumber,
        manufacturer: l?.manufacturer || '',
        supplier: l?.supplier || suppliers[0]?.name || '',
        description: l?.partDesc || l?.description || '',
        quantity: qty,
        suppliers,
      });
    }
    return [...byKey.values()].sort((a, b) => a.partNumber.localeCompare(b.partNumber));
  }

  /** Render rows as CSV (with a leading line-item number column). */
  toCsv(rows: BomRow[]): string {
    const header = ['#', 'Part Number', 'Manufacturer', 'Supplier', 'Description', 'Qty'];
    const lines = [header.join(',')];
    rows.forEach((r, i) => {
      lines.push([i + 1, r.partNumber, r.manufacturer, r.supplier, r.description, r.quantity]
        .map((v) => this.escape(String(v)))
        .join(','));
    });
    return lines.join('\n');
  }

  private escape(value: string): string {
    return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }
}
