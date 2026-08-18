import { api } from '../../api/client';

export interface Part {
  partNumber: string;
  manufacturer: string;
  supplier: string;
  description: string;
}

function name(node: unknown): string {
  if (node && typeof node === 'object' && 'name' in node) {
    const n = (node as { name?: unknown }).name;
    return typeof n === 'string' ? n : '';
  }
  return '';
}

/** Flatten one entry of `partserviceresult.parts[]` (the web client's mapping). */
export function flattenPart(p: Record<string, any>): Part {
  const org = Array.isArray(p.invOrgs) && p.invOrgs[0] ? p.invOrgs[0] : {};
  const partNumber = name(p.arwPartNum) || name(p.suppPartNum) || `${p.partKey ?? 'Unknown'}`;
  return {
    partNumber,
    manufacturer: name(p.mfr),
    supplier: name(p.supp),
    description: (org.desc as string) || name(p.icc),
  };
}

export async function searchParts(query: string): Promise<Part[]> {
  if (!query.trim()) return [];
  const res = await api.get<Record<string, any>>('/parts/search', { q: query });
  const parts = res?.partserviceresult?.parts;
  return Array.isArray(parts) ? parts.map(flattenPart) : [];
}
