/** One label/value row as the properties panel shows it. */
export interface PartRow { label: string; value: string; }

/** A price, or nothing at all — an empty string renders as no price. */
export function money(n?: number): string { return n ? '$' + Number(n).toFixed(2) : ''; }

/**
 * The catalogue fields worth showing for a part, in reading order.
 *
 * A pure formatter over the catalogue's shape, which is why it lives beside the
 * panel that displays it rather than in the editor. Rows with nothing in them
 * are dropped, so a sparse part shows a short list instead of a column of blanks.
 */
export function partDetails(part: any): PartRow[] {
  if (!part) return [];
  const org = part?.invOrgs?.[0] ?? {}; const avail = org?.avail ?? {};
  const num = (v: any) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString());
  const compliance = (part?.EnvData?.complianceList ?? []).map((c: any) => c?.type).filter(Boolean).join(', ');
  const rows = [
    { label: 'Arrow part #', value: part?.arwPartNum?.name },
    { label: 'Supplier part #', value: part?.suppPartNum?.name },
    { label: 'Manufacturer', value: part?.mfr?.name },
    { label: 'Supplier', value: part?.supp?.name },
    { label: 'Description', value: org?.desc },
    { label: 'Category', value: part?.icc?.tree || part?.icc?.name },
    { label: 'Status', value: org?.status },
    { label: 'In stock', value: num(avail?.totohQty ?? avail?.FOHQty ?? avail?.ACFOHQty) },
    { label: 'Lead time', value: part?.leadTime?.arwLT ? `${part.leadTime.arwLT} wks` : '' },
    { label: 'Package', value: [org?.pkg, org?.pkgQty && `(${org.pkgQty}/pk)`].filter(Boolean).join(' ') },
    { label: 'Compliance', value: compliance },
  ];
  return rows.filter((r) => r.value != null && String(r.value).trim() !== '') as PartRow[];
}

/** The part's parametric data, minus the rows the catalogue fills with filler. */
export function partSpecs(part: any): PartRow[] {
  const pd = Array.isArray(part?.paramData) ? part.paramData : [];
  return pd.map((p: any) => ({
    label: String(p?.name ?? '').trim(),
    value: [String(p?.val ?? '').trim(), String(p?.uom ?? '').trim()].filter((s: string) => s && s !== ' ').join(' '),
  })).filter((r: PartRow) => r.label && r.value && !/^not required$/i.test(r.value));
}
