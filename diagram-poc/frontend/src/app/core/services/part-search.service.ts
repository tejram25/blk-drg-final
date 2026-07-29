import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

/** Lead times as the catalogue reports them, in weeks. */
export interface PartLeadTime { arrowWeeks: string; supplierWeeks: string; supplierDate: string; }

/** Availability rolled up across every stocking location. */
export interface PartStock {
  totalOnHand: number;
  nextQty: number;
  nextDelivery: string;
  locationCount: number;
  inStockLocations: number;
}

export interface PartPriceBreak { price: string; minQty: string; maxQty: string; }
export interface PartPricing { currency: string; breaks: PartPriceBreak[]; unitPrice: string; }

export interface PartPackaging {
  packageType: string; packageQty: string;
  minOrderQty: number; multipleQty: number; uom: string;
}

/** Regulatory and trade attributes — the late-stage design blockers. */
export interface PartCompliance {
  standards: string[];
  svhc: boolean;
  eccnUs: string;
  eccnWassenaar: string;
  hts: string;
  countryOfOrigin: string;
}

/** One inventory organisation stocking the part. */
export interface PartLocation {
  id: string; code: string; type: string; operatingUnit: string; description: string;
  status: string; onHand: number; nextQty: number; nextDelivery: string;
  minOrderQty: number; preferred: boolean; designWinEligible: boolean;
}

/**
 * A catalogue part, already de-duplicated by the backend.
 *
 * The upstream service returns one row per stocking location, so a search for a
 * common part comes back as dozens of identical-looking rows. The backend groups
 * them (see PartSearchNormalizer) and this is the result: one entry per part
 * with the locations folded into `locations`.
 */
export interface CatalogPart {
  id: string;
  partKey: string;
  partNumber: string;
  supplierPartNumber: string;
  exactMatch: boolean;
  manufacturer: string;
  supplier: string;
  description: string;
  category: string;
  categoryPath: string[];
  status: string;
  imageUrl: string;
  datasheetUrl: string;
  leadTime: PartLeadTime;
  stock: PartStock;
  pricing: PartPricing;
  packaging: PartPackaging;
  compliance: PartCompliance;
  locations: PartLocation[];
  designWinEligible: boolean;
  crossReferenced: boolean;
  crossRefTypes: string[];
  score: number;
}

export interface PartSearchResponse {
  query: string;
  /** First upstream row in this page. */
  start: number;
  /** Rows the upstream returned in this page, before de-duplication. */
  returned: number;
  /** First row of the next page. */
  nextStart: number;
  /** More rows exist upstream — drives "load more". */
  hasMore: boolean;
  total: number;
  exactMatchFound: boolean;
  matchReason: string;
  parts: CatalogPart[];
}

export interface PartSearchFilters { manufacturer?: string; inStock?: boolean; active?: boolean; }

const API = apiBaseUrl();

/**
 * Searches the parts catalogue through the backend proxy, which holds the
 * credentials and does the de-duplication so every caller — the Parts tab and
 * the block-diagram panel — sees the same model.
 */
@Injectable({ providedIn: 'root' })
export class PartSearchService {
  private readonly http = inject(HttpClient);

  search(query: string, filters: PartSearchFilters = {},
         start = 0, limit = 25): Observable<PartSearchResponse> {
    let params = new HttpParams()
      .set('q', query)
      .set('start', String(start))
      .set('limit', String(limit));
    if (filters.manufacturer) params = params.set('manufacturer', filters.manufacturer);
    if (filters.inStock) params = params.set('inStock', 'true');
    if (filters.active) params = params.set('active', 'true');
    return this.http.get<PartSearchResponse>(`${API}/parts/search`, { params });
  }
}

/**
 * Fold a newly-loaded page into the parts already on screen.
 *
 * Paging is over upstream rows, so a later page usually carries *more
 * locations for parts already shown* rather than new parts. Appending pages
 * blindly would list the same part twice, so parts are merged by id and their
 * aggregates recomputed from the combined locations — mirroring what
 * PartSearchNormalizer does server-side for a single page.
 */
export function mergeParts(existing: CatalogPart[], incoming: CatalogPart[]): CatalogPart[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const part of incoming) {
    const seen = byId.get(part.id);
    if (!seen) {
      byId.set(part.id, part);
      continue;
    }
    const known = new Set(seen.locations.map((l) => l.id));
    const locations = [...seen.locations, ...part.locations.filter((l) => !known.has(l.id))];
    byId.set(part.id, { ...seen, locations, stock: rollUp(locations) });
  }
  return [...byId.values()];
}

/** Recompute the stock roll-up from a part's locations. */
function rollUp(locations: PartLocation[]): PartStock {
  let totalOnHand = 0;
  let inStockLocations = 0;
  let nextQty = 0;
  let nextDelivery = '';
  for (const l of locations) {
    totalOnHand += l.onHand;
    if (l.onHand > 0) inStockLocations++;
    if (l.nextDelivery && (!nextDelivery || isEarlier(l.nextDelivery, nextDelivery))) {
      nextDelivery = l.nextDelivery;
      nextQty = l.nextQty;
    }
  }
  return { totalOnHand, nextQty, nextDelivery, locationCount: locations.length, inStockLocations };
}

/** Compare "22-APR-2026" dates by value; lexical order would be wrong. */
function isEarlier(a: string, b: string): boolean {
  const t = (v: string) => {
    const ms = Date.parse(v.replace(/-/g, ' '));
    return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
  };
  return t(a) < t(b);
}

/** Lifecycle tone for a status string, for pills and icons. */
export function statusTone(status: string): 'ok' | 'warn' | 'risk' | '' {
  const s = (status || '').toLowerCase();
  if (!s) return '';
  if (s.includes('obsolete') || s.includes('eol') || s.includes('end of life')
      || s.includes('nrnd') || s.includes('not recommended')
      || s.includes('discontinued') || s.includes('last time buy')) return 'risk';
  if (s.includes('nvr') || s.includes('never')) return 'warn';
  if (s.includes('active') || s.includes('new')) return 'ok';
  return 'warn';
}

/** Format a catalogue price string (".0266") with its currency. */
export function formatPrice(price: string, currency: string): string {
  const n = Number(price);
  if (!price || Number.isNaN(n)) return '—';
  return `${n.toFixed(n < 1 ? 4 : 2)} ${currency || ''}`.trim();
}
