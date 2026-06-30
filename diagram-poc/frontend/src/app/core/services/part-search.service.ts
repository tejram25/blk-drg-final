import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

/** A search hit, extracted from the partserviceresult the backend proxies. */
export interface PartHit {
  /** The raw catalogue part object (stored on the node for the BOM). */
  raw: any;
  partNumber: string;
  supplierPartNumber: string;
  supplier: string;
  manufacturer: string;
  description: string;
  /** Lifecycle status, e.g. "Nvr.Active" / "New". */
  status: string;
  /** Arrow lead time (as supplied, typically weeks). */
  leadTime: string;
  /** Total on-hand inventory quantity. */
  inStock: number;
  /** Minimum order quantity. */
  minOrderQty: number;
  /** Compliance flags, e.g. ["EU ROHS", "CHINA ROHS"]. */
  compliance: string[];
  /** Order quantity chosen in the UI (defaults to 1); travels to the BOM. */
  qty: number;
}

const API = apiBaseUrl();

/**
 * Searches the Arrow Part catalogue via our backend proxy (which holds the
 * OAuth credentials). Returns flattened hits ready for the search UI.
 */
@Injectable({ providedIn: 'root' })
export class PartSearchService {
  constructor(private http: HttpClient) {}

  search(query: string, supplier?: string): Observable<PartHit[]> {
    let params = new HttpParams().set('q', query);
    if (supplier) params = params.set('supplier', supplier);
    return new Observable<PartHit[]>((subscriber) => {
      this.http.get(`${API}/parts/search`, { params, responseType: 'json' }).subscribe({
        next: (res: any) => {
          subscriber.next(this.flatten(res));
          subscriber.complete();
        },
        error: (e) => subscriber.error(e),
      });
    });
  }

  /** Pull the parts array out of the partserviceresult and flatten each one. */
  private flatten(res: any): PartHit[] {
    const parts: any[] = res?.partserviceresult?.parts ?? [];
    return parts.map((part) => {
      const org = part?.invOrgs?.[0] ?? {};
      const avail = org?.avail ?? {};
      const compliance: string[] = (part?.EnvData?.complianceList ?? [])
        .map((c: any) => c?.type)
        .filter((t: any) => !!t);
      return {
        raw: part,
        partNumber: part?.arwPartNum?.name || part?.suppPartNum?.name || part?.partKey || 'Unknown',
        supplierPartNumber: part?.suppPartNum?.name || '',
        supplier: part?.supp?.name || '',
        manufacturer: part?.mfr?.name || '',
        description: org?.desc || part?.icc?.name || '',
        status: org?.status || '',
        leadTime: part?.leadTime?.arwLT ? String(part.leadTime.arwLT) : '',
        inStock: Number(avail?.totohQty ?? avail?.FOHQty ?? avail?.ACFOHQty ?? 0),
        minOrderQty: Number(org?.minOrdQty ?? 1),
        compliance,
        qty: 1,
      };
    });
  }
}
