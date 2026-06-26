import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

export interface FeedbackRequest {
  category: string;
  rating: number;
  message: string;
  diagramId?: number | null;
}

export interface FeedbackResponse {
  id: number;
  category: string;
  rating: number;
  message: string;
  userEmail: string;
  diagramId?: number | null;
  createdAt: string;
}

const API = apiBaseUrl();

/** Feedback loop: submit usability/feature/AI-quality feedback and read it back. */
@Injectable({ providedIn: 'root' })
export class FeedbackService {
  constructor(private http: HttpClient) {}

  submit(request: FeedbackRequest): Observable<FeedbackResponse> {
    return this.http.post<FeedbackResponse>(`${API}/feedback`, request);
  }

  list(): Observable<FeedbackResponse[]> {
    return this.http.get<FeedbackResponse[]>(`${API}/feedback`);
  }
}
