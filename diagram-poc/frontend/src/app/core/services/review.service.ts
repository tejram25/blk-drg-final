import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

export interface ReviewItem {
  userName: string;
  rating: number;
  comment: string;
  updatedAt: string;
  self: boolean;
}

export interface ReviewData {
  average: number;
  count: number;
  distribution: Record<string, number>;
  mine: { rating: number; comment: string } | null;
  reviews: ReviewItem[];
}

export interface ReviewSummary {
  diagramId: number;
  average: number;
  count: number;
}

/**
 * A pluggable backing for the reviews modal so the same component can show
 * reviews for any subject (diagrams, templates, …) — Dependency Inversion: the
 * dialog depends on this abstraction, not on a concrete service.
 */
export interface ReviewSource {
  load(): Observable<ReviewData>;
  submit(rating: number, comment: string): Observable<ReviewData>;
}

const API = apiBaseUrl();

/** Ratings & comments for saved diagrams (kept separate from diagram CRUD). */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  constructor(private http: HttpClient) {}

  /** Average rating + count for every diagram, for the Open-list badges. */
  summary(): Observable<ReviewSummary[]> {
    return this.http.get<ReviewSummary[]>(`${API}/reviews/summary`);
  }

  /** Full review data (aggregate + your review + list) for one diagram. */
  forDiagram(id: number): Observable<ReviewData> {
    return this.http.get<ReviewData>(`${API}/diagrams/${id}/reviews`);
  }

  /** Create or update the current user's review for a diagram. */
  submit(id: number, rating: number, comment: string): Observable<ReviewData> {
    return this.http.post<ReviewData>(`${API}/diagrams/${id}/reviews`, { rating, comment });
  }
}
