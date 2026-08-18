import { api } from '../../api/client';

export interface VersionSummary {
  id: number;
  label: string;
  authorName: string;
  createdAt?: string;
}

export interface VersionDetail extends VersionSummary {
  contentJson: string;
}

export const versionsApi = {
  list: (diagramId: number) => api.get<VersionSummary[]>(`/diagrams/${diagramId}/versions`),
  snapshot: (diagramId: number, label: string, contentJson: string) =>
    api.post<VersionSummary>(`/diagrams/${diagramId}/versions`, { label, contentJson }),
  get: (versionId: number) => api.get<VersionDetail>(`/versions/${versionId}`),
};
