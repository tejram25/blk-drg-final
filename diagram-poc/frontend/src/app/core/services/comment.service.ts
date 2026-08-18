import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

export interface CommentItem {
  id: number;
  nodeId: string | null;
  authorName: string;
  text: string;
  createdAt: string;
  self: boolean;
}

const API = apiBaseUrl();

/** Comments on a diagram, optionally pinned to a block. */
@Injectable({ providedIn: 'root' })
export class CommentService {
  constructor(private http: HttpClient) {}

  list(diagramId: number): Observable<CommentItem[]> {
    return this.http.get<CommentItem[]>(`${API}/diagrams/${diagramId}/comments`);
  }

  add(diagramId: number, nodeId: string | null, text: string): Observable<CommentItem> {
    return this.http.post<CommentItem>(`${API}/diagrams/${diagramId}/comments`, { nodeId, text });
  }

  delete(commentId: number): Observable<void> {
    return this.http.delete<void>(`${API}/comments/${commentId}`);
  }
}
