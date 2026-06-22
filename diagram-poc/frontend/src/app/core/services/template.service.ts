import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';
import { ReviewData } from './review.service';

/** Lightweight template listing for the gallery (no heavy contentJson). */
export interface TemplateSummary {
  id: number;
  name: string;
  description?: string;
  category?: string;
  authorName?: string;
  updatedByName?: string;
  usageCount: number;
  /** Average star rating (0 when unrated). */
  avgRating: number;
  /** Number of ratings. */
  ratingCount: number;
  /** The current user's own rating (0 if they haven't rated it). */
  myRating: number;
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

  /** Rate a template 1-5 stars (quick rate, no comment). */
  rate(id: number, rating: number): Observable<TemplateDetail> {
    return this.http.post<TemplateDetail>(`${API}/templates/${id}/rating`, { rating });
  }

  /** Full review data (aggregate + your review + list) for one template. */
  reviews(id: number): Observable<ReviewData> {
    return this.http.get<ReviewData>(`${API}/templates/${id}/reviews`);
  }

  /** Create or update the current user's review (rating + comment) of a template. */
  submitReview(id: number, rating: number, comment: string): Observable<ReviewData> {
    return this.http.post<ReviewData>(`${API}/templates/${id}/reviews`, { rating, comment });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/templates/${id}`);
  }
}
