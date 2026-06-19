import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from './app-config';

export interface BlockType {
  key: string;
  label: string;
  color: string;
  /** palette section, e.g. "Blocks" or "Electrical" (defaults to "Blocks") */
  category?: string;
  /** registered X6 shape name for schematic symbols, e.g. "elec-resistor" */
  shape?: string;
  /** Material icon name for card-style blocks */
  icon?: string;
}

export interface DiagramSummary {
  id: number;
  name: string;
  updatedAt: string;
  /** Average star rating (0 when no reviews yet), merged in from /reviews/summary. */
  avgRating?: number;
  /** Number of reviews. */
  reviewCount?: number;
}

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

export interface DiagramDto {
  id?: number;
  name: string;
  contentJson: string;
}

// Resolved from the current page (protocol-matched) or an environment override,
// so it works over both HTTP dev and HTTPS deployments. See app-config.ts.
const API = apiBaseUrl();

@Injectable({ providedIn: 'root' })
export class DiagramService {
  constructor(private http: HttpClient) {}

  getBlockTypes(): Observable<BlockType[]> {
    return this.http.get<BlockType[]>(`${API}/block-types`);
  }

  list(): Observable<DiagramSummary[]> {
    return this.http.get<DiagramSummary[]>(`${API}/diagrams`);
  }

  get(id: number): Observable<DiagramDto> {
    return this.http.get<DiagramDto>(`${API}/diagrams/${id}`);
  }

  create(diagram: DiagramDto): Observable<DiagramDto> {
    return this.http.post<DiagramDto>(`${API}/diagrams`, diagram);
  }

  update(id: number, diagram: DiagramDto): Observable<DiagramDto> {
    return this.http.put<DiagramDto>(`${API}/diagrams/${id}`, diagram);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/diagrams/${id}`);
  }

  // ---------- Reviews ----------

  /** Average rating + count for every diagram, for the Open-list badges. */
  reviewSummary(): Observable<ReviewSummary[]> {
    return this.http.get<ReviewSummary[]>(`${API}/reviews/summary`);
  }

  /** Full review data (aggregate + your review + list) for one diagram. */
  getReviews(id: number): Observable<ReviewData> {
    return this.http.get<ReviewData>(`${API}/diagrams/${id}/reviews`);
  }

  /** Create or update the current user's review for a diagram. */
  postReview(id: number, rating: number, comment: string): Observable<ReviewData> {
    return this.http.post<ReviewData>(`${API}/diagrams/${id}/reviews`, { rating, comment });
  }
}
