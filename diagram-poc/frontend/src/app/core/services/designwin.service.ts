import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

/**
 * Arrow Design Win data, proxied by the backend (/api/designwin/*) so the OAuth
 * credentials stay server-side. Responses are the raw Design Win JSON; the
 * panel normalises them tolerantly since field names vary across environments.
 */
@Injectable({ providedIn: 'root' })
export class DesignWinService {
  private readonly api = apiBaseUrl();

  constructor(private http: HttpClient) {}

  private get(path: string, params: Record<string, string | undefined>): Observable<any> {
    let hp = new HttpParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && String(v).trim() !== '') hp = hp.set(k, String(v).trim());
    }
    return this.http.get<any>(`${this.api}/designwin/${path}`, { params: hp });
  }

  customers(customerName?: string, billToNumber?: string): Observable<any> {
    return this.get('customers', { customerName, billToNumber });
  }

  projects(customerName?: string, projectName?: string, billToNumber?: string): Observable<any> {
    return this.get('projects', { customerName, projectName, billToNumber });
  }

  boards(projectId?: string, projectName?: string): Observable<any> {
    return this.get('boards', { projectId, projectName });
  }

  registrationDetails(opts: {
    arrowUniqueNum?: string; registrationNum?: string; boardNum?: string; trackingNum?: string;
  }): Observable<any> {
    return this.get('registration-details', opts);
  }

  custParts(opts: {
    customerName?: string; custBillTo?: string; projectId?: string; boardNum?: string; projectName?: string;
  }): Observable<any> {
    return this.get('cust-parts', opts);
  }

  /** POS / sales history for a part — "field-proven" signal. */
  sales(partNumber: string, mfrName?: string): Observable<any> {
    return this.get('sales', { partNumber, mfrName });
  }
}
