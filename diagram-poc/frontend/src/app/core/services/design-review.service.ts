import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

export interface ReviewBlock { name: string; type: string; }
export interface ReviewLink { from: string; to: string; }

export interface ReviewFinding {
  severity: string; // risk | warn | info
  category: string;
  title: string;
  detail: string;
  suggestion: string;
}

export interface DesignReviewResult {
  findings: ReviewFinding[];
  model: string;
  aiGenerated: boolean;
  note?: string;
}

const API = apiBaseUrl();

/** AI (+ rule-based) design review of the current block diagram. */
@Injectable({ providedIn: 'root' })
export class DesignReviewService {
  constructor(private http: HttpClient) {}

  review(goal: string, blocks: ReviewBlock[], links: ReviewLink[]): Observable<DesignReviewResult> {
    return this.http.post<DesignReviewResult>(`${API}/design-review`, { goal, blocks, links });
  }
}
