import { api } from '../../api/client';

export interface TemplateSummary {
  id: number;
  name: string;
  description?: string;
  category?: string;
  authorName?: string;
  updatedByName?: string;
  usageCount: number;
  avgRating: number;
  ratingCount: number;
  myRating: number;
  updatedAt: string;
}

export interface TemplateDetail extends TemplateSummary {
  contentJson: string;
  createdAt: string;
}

export interface TemplateRequest {
  name: string;
  description?: string;
  category?: string;
  contentJson: string;
}

/** Shared template repository: browse, use, publish and rate templates. */
export const templatesApi = {
  list: () => api.get<TemplateSummary[]>('/templates'),
  get: (id: number) => api.get<TemplateDetail>(`/templates/${id}`),
  use: (id: number) => api.post<TemplateDetail>(`/templates/${id}/use`, {}),
  create: (req: TemplateRequest) => api.post<TemplateDetail>('/templates', req),
  rate: (id: number, rating: number) => api.post<TemplateDetail>(`/templates/${id}/rating`, { rating }),
};
