import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

export interface RecommendationItem {
  type: string; // template | part | solution
  title: string;
  detail: string;
  source: string;
  verify: string;
}

export interface RecommendationResult {
  items: RecommendationItem[];
  model: string;
  aiGenerated: boolean;
  note?: string;
}

const API = apiBaseUrl();

/**
 * AI recommendations (Claude) with source traceability + verify prompts.
 * Falls back to a rule-based engine server-side when no API key is configured.
 */
@Injectable({ providedIn: 'root' })
export class RecommendationService {
  constructor(private http: HttpClient) {}

  recommend(goal: string, currentParts: string[]): Observable<RecommendationResult> {
    return this.http.post<RecommendationResult>(`${API}/recommendations`, { goal, currentParts });
  }
}
