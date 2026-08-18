import { api } from '../../api/client';

// ---- Recommendations (POST /recommendations) ----
export interface RecommendationItem {
  type: string; // template | part | solution
  title: string;
  detail: string;
  source: string;
  verify: string;
  query?: string;
}
export interface RecommendationResult {
  items: RecommendationItem[];
  model: string;
  aiGenerated: boolean;
  note?: string;
}

// ---- Design review (POST /design-review) ----
export interface ReviewBlock { name: string; type: string }
export interface ReviewLink { from: string; to: string }
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

// ---- Lifecycle (GET /lifecycle?part=) ----
export interface AlternativePart {
  partNumber: string;
  manufacturer: string;
  note: string;
  dropIn: boolean;
}
export interface LifecycleInfo {
  partNumber: string;
  status: string;
  risk: string;
  recommendation: string;
  alternatives: AlternativePart[];
}

// ---- Box suggestions (POST /box-suggestions) ----
export interface SupplierOffer {
  name: string;
  partNumber: string;
  stock: number;
  leadWeeks: string;
  unitPrice?: number;
  moq?: number;
}
export interface BoxSuggestion {
  partNumber: string;
  manufacturer: string;
  description: string;
  category: string;
  status: string;
  stock: number;
  leadWeeks: string;
  fieldProven: boolean;
  customerApproved?: boolean;
  unitPrice?: number;
  moq?: number;
  suppliers: SupplierOffer[];
}
export interface BoxSuggestionResult {
  query: string;
  suggestions: BoxSuggestion[];
  note?: string;
}
export interface DesignWinCtx {
  customerName?: string;
  billTo?: string;
  projectId?: string;
  boardNum?: string;
}

/** AI + rule-based backend features (Claude with a rule fallback server-side). */
export const aiApi = {
  recommend: (goal: string, currentParts: string[]) =>
    api.post<RecommendationResult>('/recommendations', { goal, currentParts }),

  designReview: (goal: string, blocks: ReviewBlock[], links: ReviewLink[]) =>
    api.post<DesignReviewResult>('/design-review', { goal, blocks, links }),

  lifecycle: (partNumber: string) => api.get<LifecycleInfo>('/lifecycle', { part: partNumber }),

  boxSuggest: (label: string, sub: string, kind: string, ctx?: DesignWinCtx | null) =>
    api.post<BoxSuggestionResult>('/box-suggestions', {
      label,
      sub,
      kind,
      customerName: ctx?.customerName,
      custBillTo: ctx?.billTo,
      projectId: ctx?.projectId,
      boardNum: ctx?.boardNum,
    }),
};
