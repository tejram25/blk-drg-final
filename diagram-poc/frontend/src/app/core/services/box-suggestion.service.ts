import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

export interface SupplierOffer {
  name: string;
  partNumber: string;
  stock: number;
  leadWeeks: string;
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
  suppliers: SupplierOffer[];
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
  suggest(label: string, sub: string, kind: string): Observable<BoxSuggestionResult> {
    return this.http.post<BoxSuggestionResult>(`${API}/box-suggestions`, { label, sub, kind });
  }
}
