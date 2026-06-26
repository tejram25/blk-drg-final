import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

export interface ProjectSummary {
  id: string;
  name: string;
  customer: string;
  opportunity: string;
  stage: string;
  leadTimeWeeks: number;
}

export interface ProjectPart {
  partNumber: string;
  manufacturer: string;
  description: string;
  quantity: number;
  leadTimeWeeks: number;
  lifecycle: string;
}

export interface ProjectDetail extends ProjectSummary {
  owner: string;
  region: string;
  parts: ProjectPart[];
}

const API = apiBaseUrl();

/**
 * Workflow/data integration: pull project, opportunity, lead-time and part data
 * from the Salesforce Design/Deal Workspace via our backend (mock-backed for now).
 */
@Injectable({ providedIn: 'root' })
export class IntegrationService {
  constructor(private http: HttpClient) {}

  searchProjects(query: string): Observable<ProjectSummary[]> {
    const params = new HttpParams().set('q', query || '');
    return this.http.get<ProjectSummary[]>(`${API}/integrations/projects`, { params });
  }

  getProject(id: string): Observable<ProjectDetail> {
    return this.http.get<ProjectDetail>(`${API}/integrations/projects/${id}`);
  }
}
