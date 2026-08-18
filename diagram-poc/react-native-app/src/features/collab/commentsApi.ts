import { api } from '../../api/client';

export interface Comment {
  id: number;
  nodeId?: string;
  authorName: string;
  text: string;
  createdAt?: string;
  self: boolean;
}

export const commentsApi = {
  list: (diagramId: number) => api.get<Comment[]>(`/diagrams/${diagramId}/comments`),
  add: (diagramId: number, text: string) =>
    api.post<Comment>(`/diagrams/${diagramId}/comments`, { text }),
  remove: (commentId: number) => api.del<void>(`/comments/${commentId}`),
};
