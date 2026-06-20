import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

export interface VersionSummary {
  id: number;
  label: string;
  authorName: string;
  createdAt: string;
}

export interface VersionDetail extends VersionSummary {
  contentJson: string;
}

const API = apiBaseUrl();

/** Version history (snapshots) for a saved diagram. */
@Injectable({ providedIn: 'root' })
export class VersionService {
  constructor(private http: HttpClient) {}

  list(diagramId: number): Observable<VersionSummary[]> {
    return this.http.get<VersionSummary[]>(`${API}/diagrams/${diagramId}/versions`);
  }

  snapshot(diagramId: number, label: string, contentJson: string): Observable<VersionSummary> {
    return this.http.post<VersionSummary>(`${API}/diagrams/${diagramId}/versions`, { label, contentJson });
  }

  get(versionId: number): Observable<VersionDetail> {
    return this.http.get<VersionDetail>(`${API}/versions/${versionId}`);
  }
}
