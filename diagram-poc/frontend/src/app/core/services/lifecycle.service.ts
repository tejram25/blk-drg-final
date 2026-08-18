import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

export interface AlternativePart {
  partNumber: string;
  manufacturer: string;
  note: string;
  dropIn: boolean;
}

export interface LifecycleInfo {
  partNumber: string;
  status: string;
  risk: string;
  recommendation: string;
  alternatives: AlternativePart[];
}

const API = apiBaseUrl();

/** Lifecycle risk + alternatives lookup (SiliconExpert-style, via our backend). */
@Injectable({ providedIn: 'root' })
export class LifecycleService {
  constructor(private http: HttpClient) {}

  lookup(partNumber: string): Observable<LifecycleInfo> {
    const params = new HttpParams().set('part', partNumber);
    return this.http.get<LifecycleInfo>(`${API}/lifecycle`, { params });
  }
}
