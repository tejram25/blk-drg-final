import { api } from '../../api/client';

export interface ReviewItem {
  userName: string;
  rating: number;
  comment: string;
  updatedAt?: string;
  self: boolean;
}

export interface ReviewSummary {
  average: number;
  count: number;
  distribution: Record<string, number>;
  myRating: number;
  myComment: string;
  reviews: ReviewItem[];
}

function parse(data: any): ReviewSummary {
  return {
    average: Number(data?.average ?? 0),
    count: Number(data?.count ?? 0),
    distribution: (data?.distribution ?? {}) as Record<string, number>,
    myRating: Number(data?.mine?.rating ?? 0),
    myComment: `${data?.mine?.comment ?? ''}`,
    reviews: Array.isArray(data?.reviews) ? (data.reviews as ReviewItem[]) : [],
  };
}

export const reviewsApi = {
  get: async (diagramId: number) => parse(await api.get<any>(`/diagrams/${diagramId}/reviews`)),
  submit: async (diagramId: number, rating: number, comment: string) =>
    parse(await api.post<any>(`/diagrams/${diagramId}/reviews`, { rating, comment })),
};
