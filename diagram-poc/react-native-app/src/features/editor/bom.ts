import { DiagramGraph } from './model';
import { attachedParts, linkedComponents } from './editorOps';

/** One line of a Bill of Materials (one distinct part, with its tallied quantity). */
export interface BomRow {
  partNumber: string;
  manufacturer: string;
  supplier: string;
  description: string;
  quantity: number;
  unitPrice?: number;
  moq?: number;
}

const num = (v: unknown, min = 0) => Math.max(min, Number(v) || 0);

/**
 * Roll a Bill of Materials up from the canvas: every node's attached parts and
 * linked components, grouped by part number and tallied. Mirrors BomService.
 */
export function buildBom(g: DiagramGraph): BomRow[] {
  const byKey = new Map<string, BomRow>();
  const add = (row: BomRow) => {
    if (!row.partNumber) return;
    const existing = byKey.get(row.partNumber);
    if (existing) {
      existing.quantity += row.quantity;
      if (!existing.supplier && row.supplier) existing.supplier = row.supplier;
      if (!existing.unitPrice && row.unitPrice) existing.unitPrice = row.unitPrice;
      return;
    }
    byKey.set(row.partNumber, { ...row });
  };

  for (const n of g.nodes) {
    for (const p of attachedParts(n.raw)) {
      const a = p as any;
      add({
        partNumber: a.partNumber || '',
        manufacturer: a.manufacturer || '',
        supplier: a.supplier || '',
        description: a.partDesc || a.description || '',
        quantity: num(a.quantity ?? (p as any).__qty ?? 1, 1),
      });
    }
    for (const c of linkedComponents(n.raw)) {
      const l = c as any;
      add({
        partNumber: l.partNumber || '',
        manufacturer: l.manufacturer || '',
        supplier: l.supplier || (Array.isArray(l.suppliers) ? l.suppliers[0]?.name : '') || '',
        description: l.description || l.partDesc || '',
        quantity: num(l.quantity ?? 1, 1),
        unitPrice: num(l.unitPrice),
        moq: num(l.moq),
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.partNumber.localeCompare(b.partNumber));
}

export const extPrice = (r: BomRow) => num(r.unitPrice) * num(r.quantity);
export const totalCost = (rows: BomRow[]) => rows.reduce((s, r) => s + extPrice(r), 0);

function esc(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Render rows as CSV with a leading line-item column (matches the web export). */
export function toCsv(rows: BomRow[]): string {
  const header = ['#', 'Part Number', 'Manufacturer', 'Supplier', 'Description', 'Qty', 'MOQ', 'Unit Price', 'Ext Price'];
  const money = (n: number) => (n ? n.toFixed(4) : '');
  const lines = [header.join(',')];
  rows.forEach((r, i) => {
    lines.push(
      [i + 1, r.partNumber, r.manufacturer, r.supplier, r.description, r.quantity, r.moq || '', money(num(r.unitPrice)), money(extPrice(r))]
        .map((v) => esc(String(v)))
        .join(','),
    );
  });
  return lines.join('\n');
}
