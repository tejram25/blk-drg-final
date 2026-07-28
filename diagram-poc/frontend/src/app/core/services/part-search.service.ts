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
  /** Rows the upstream returned, before de-duplication. */
  returned: number;
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

  search(query: string, filters: PartSearchFilters = {}): Observable<PartSearchResponse> {
    let params = new HttpParams().set('q', query);
    if (filters.manufacturer) params = params.set('manufacturer', filters.manufacturer);
    if (filters.inStock) params = params.set('inStock', 'true');
    if (filters.active) params = params.set('active', 'true');
    return this.http.get<PartSearchResponse>(`${API}/parts/search`, { params });
  }
}

/** Lifecycle tone for a status string, for pills and icons. */
export function statusTone(status: string): 'ok' | 'warn' | 'risk' | '' {
  const s = (status || '').toLowerCase();
  if (!s) return '';
  if (s.includes('obsolete') || s.includes('eol')) return 'risk';
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
