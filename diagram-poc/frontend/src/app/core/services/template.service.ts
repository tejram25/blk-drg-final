import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

/** Lightweight template listing for the gallery (no heavy contentJson). */
export interface TemplateSummary {
  id: number;
  name: string;
  description?: string;
  category?: string;
  authorName?: string;
  updatedByName?: string;
  usageCount: number;
  updatedAt: string;
}

/** Full template including its diagram content (returned on get/use/create/update). */
export interface TemplateDetail extends TemplateSummary {
  contentJson: string;
  createdAt: string;
}

/** Create/update payload (author/editor is taken from the session server-side). */
export interface TemplateRequest {
  name: string;
  description?: string;
  category?: string;
  contentJson: string;
}

const API = apiBaseUrl();

/**
 * The shared template repository: browse, use, improve and publish templates.
 * A "dynamic" library — every saved diagram can become a reusable starting point
 * that anyone can pick up and improve.
 */
@Injectable({ providedIn: 'root' })
export class TemplateService {
  constructor(private http: HttpClient) {}

  list(): Observable<TemplateSummary[]> {
    return this.http.get<TemplateSummary[]>(`${API}/templates`);
  }

  get(id: number): Observable<TemplateDetail> {
    return this.http.get<TemplateDetail>(`${API}/templates/${id}`);
  }

  /** Use a template to start a diagram — returns its content and bumps usage. */
  use(id: number): Observable<TemplateDetail> {
    return this.http.post<TemplateDetail>(`${API}/templates/${id}/use`, {});
  }

  /** Publish the current canvas as a new template. */
  create(request: TemplateRequest): Observable<TemplateDetail> {
    return this.http.post<TemplateDetail>(`${API}/templates`, request);
  }

  /** Improve an existing template in place. */
  update(id: number, request: TemplateRequest): Observable<TemplateDetail> {
    return this.http.put<TemplateDetail>(`${API}/templates/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/templates/${id}`);
  }
}
