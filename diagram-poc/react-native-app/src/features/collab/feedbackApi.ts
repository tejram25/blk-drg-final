import { api } from '../../api/client';

export interface FeedbackEntry {
  id: number;
  authorName: string;
  role: string;
  decision: string; // comment | request-changes | approve | close
  text: string;
  createdAt: string;
  mine: boolean;
}

export interface FeedbackThread {
  id: number;
  title: string;
  nodeId?: string | null;
  status: string; // open | changes-requested | approved | closed
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  entries: FeedbackEntry[];
}

export interface FeedbackBoard {
  threads: FeedbackThread[];
  roles: string[];
}

/** Feedback loop between the people working a diagram (free-form role tags). */
export const feedbackApi = {
  board: (diagramId: number) => api.get<FeedbackBoard>(`/diagrams/${diagramId}/feedback-loop`),
  create: (diagramId: number, req: { title: string; nodeId?: string | null; role: string; text: string }) =>
    api.post<FeedbackThread>(`/diagrams/${diagramId}/feedback-loop`, req),
  reply: (threadId: number, req: { role: string; decision: string; text: string }) =>
    api.post<FeedbackThread>(`/feedback-loop/${threadId}/entries`, req),
};
