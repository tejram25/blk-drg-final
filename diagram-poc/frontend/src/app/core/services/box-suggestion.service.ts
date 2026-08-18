import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';
import { DesignWinContext } from './designwin.service';

export interface SupplierOffer {
  name: string;
  partNumber: string;
  stock: number;
  leadWeeks: string;
  unitPrice?: number;
  moq?: number;
}
export interface BoxSuggestion {
  partNumber: string;
  manufacturer: string;
  description: string;
  category: string;
  status: string;
  stock: number;
  leadWeeks: string;
  fieldProven: boolean;
  customerApproved?: boolean;
  unitPrice?: number;
  moq?: number;
  suppliers: SupplierOffer[];
}

/** A component linked onto a box (a box can hold several). */
export interface LinkedComponent {
  partNumber: string;
  manufacturer: string;
  description: string;
  supplier: string;
  suppliers: SupplierOffer[];
  quantity: number;
  fieldProven: boolean;
  unitPrice?: number;
  moq?: number;
}
export interface BoxSuggestionResult {
  query: string;
  suggestions: BoxSuggestion[];
  note?: string;
}

const API = apiBaseUrl();

/** AI component suggestion for a diagram box, grounded in the catalogue + Design Win POS. */
@Injectable({ providedIn: 'root' })
export class BoxSuggestionService {
  constructor(private http: HttpClient) {}
  suggest(label: string, sub: string, kind: string, ctx?: DesignWinContext | null): Observable<BoxSuggestionResult> {
    return this.http.post<BoxSuggestionResult>(`${API}/box-suggestions`, {
      label, sub, kind,
      customerName: ctx?.customerName, custBillTo: ctx?.billTo,
      projectId: ctx?.projectId, boardNum: ctx?.boardNum,
    });
  }
}
