import { api } from '../../api/client';

export interface DiagramSummary {
  id: number;
  name: string;
  classification: string;
  ownerEmail: string;
  updatedAt?: string;
}

export interface DiagramDetail extends DiagramSummary {
  contentJson: string;
}

export const diagramsApi = {
  list: () => api.get<DiagramSummary[]>('/diagrams'),
  get: (id: number) => api.get<DiagramDetail>(`/diagrams/${id}`),
  create: (name: string) =>
    api.post<DiagramDetail>('/diagrams', {
      name,
      contentJson: '',
      classification: 'INTERNAL',
    }),
  update: (
    id: number,
    body: { name: string; contentJson: string; classification: string },
  ) => api.put<DiagramDetail>(`/diagrams/${id}`, body),
  del: (id: number) => api.del<void>(`/diagrams/${id}`),
};
