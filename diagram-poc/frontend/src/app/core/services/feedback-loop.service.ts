import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

/** One turn of a feedback loop. */
export interface FeedbackEntry {
  id: number;
  authorName: string;
  role: string;
  decision: 'comment' | 'request-changes' | 'approve' | 'close' | string;
  text: string;
  createdAt: string;
  mine: boolean;
}

/** A feedback thread (loop) on a diagram, optionally anchored to a block. */
export interface FeedbackThread {
  id: number;
  title: string;
  nodeId?: string | null;
  status: 'open' | 'changes-requested' | 'approved' | 'closed' | string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  entries: FeedbackEntry[];
}

/** All threads + the role tags already used on this diagram (suggestions). */
export interface FeedbackBoard {
  threads: FeedbackThread[];
  roles: string[];
}

const API = apiBaseUrl();

/**
 * Feedback loop between the people working a diagram. Roles are free-form tags
 * chosen by each participant (sales / engineering / customer / anything) — the
 * backend never restricts who the actors are.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackLoopService {
  constructor(private http: HttpClient) {}

  board(diagramId: number): Observable<FeedbackBoard> {
    return this.http.get<FeedbackBoard>(`${API}/diagrams/${diagramId}/feedback-loop`);
  }

  create(diagramId: number, req: { title: string; nodeId?: string | null; role: string; text: string }): Observable<FeedbackThread> {
    return this.http.post<FeedbackThread>(`${API}/diagrams/${diagramId}/feedback-loop`, req);
  }

  reply(threadId: number, req: { role: string; decision: string; text: string }): Observable<FeedbackThread> {
    return this.http.post<FeedbackThread>(`${API}/feedback-loop/${threadId}/entries`, req);
  }
}
