import { fetch, type RequestInit } from "undici";
import { config } from "./config.js";

/**
 * Thin, typed client over the Spring BFF. Auth is password + session cookie
 * (POST /api/auth/login sets JSESSIONID), so we log in lazily and replay the
 * cookie on every call, re-authenticating once on a 401.
 */
export class Bff {
  private cookie: string | null = null;

  /** Authenticate and cache the session cookie. Safe to call repeatedly. */
  async login(): Promise<void> {
    const res = await fetch(`${config.bffUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: config.email, password: config.password }),
    });
    if (!res.ok) throw new Error(`Login failed (${res.status}). Check DIAGRAM_BFF_EMAIL/PASSWORD.`);
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const jsession = setCookie.map((c) => c.split(";")[0]).find((c) => c.startsWith("JSESSIONID="));
    if (!jsession) throw new Error("Login succeeded but no session cookie was returned.");
    this.cookie = jsession;
  }

  /** Issue a request, logging in first and retrying once on a 401. */
  private async call(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
    if (!this.cookie) await this.login();
    const res = await fetch(`${config.bffUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", cookie: this.cookie ?? "", ...(init.headers ?? {}) },
    });
    if (res.status === 401 && retry) {
      this.cookie = null;
      return this.call(path, init, false);
    }
    return res as unknown as Response;
  }

  /** GET/POST/PUT helpers that parse JSON and surface a useful error on failure. */
  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.call(path, init);
    const text = await res.text();
    if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : null) as T;
  }

  // ---- diagrams -----------------------------------------------------------
  listDiagrams() {
    return this.json<DiagramSummary[]>("/api/diagrams");
  }
  getDiagram(id: number | string) {
    return this.json<DiagramResponse>(`/api/diagrams/${id}`);
  }
  createDiagram(body: DiagramRequest) {
    return this.json<DiagramResponse>("/api/diagrams", { method: "POST", body: JSON.stringify(body) });
  }
  updateDiagram(id: number | string, body: DiagramRequest) {
    return this.json<DiagramResponse>(`/api/diagrams/${id}`, { method: "PUT", body: JSON.stringify(body) });
  }

  // ---- catalogue ----------------------------------------------------------
  blockTypes() {
    return this.json<Record<string, string>[]>("/api/block-types");
  }
  /** Part search returns a raw JSON string from the BFF; parse defensively. */
  async searchParts(query: string): Promise<unknown> {
    const res = await this.call(`/api/parts/search?q=${encodeURIComponent(query)}`);
    const text = await res.text();
    if (!res.ok) throw new Error(`parts/search → ${res.status}: ${text.slice(0, 300)}`);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  // ---- AI endpoints (already exist on the BFF) ----------------------------
  recommend(body: { goal: string; currentParts?: string[] }) {
    return this.json<unknown>("/api/recommendations", { method: "POST", body: JSON.stringify(body) });
  }
  imageToDiagram(imageBase64: string) {
    return this.json<ImageDiagramResult>("/api/image-to-diagram", {
      method: "POST",
      body: JSON.stringify({ image: imageBase64 }),
    });
  }
  designReview(body: { goal: string; blocks: { name: string; type: string }[]; links: { from: string; to: string }[] }) {
    return this.json<unknown>("/api/design-review", { method: "POST", body: JSON.stringify(body) });
  }
  boxSuggestions(body: Record<string, string>) {
    return this.json<unknown>("/api/box-suggestions", { method: "POST", body: JSON.stringify(body) });
  }
}

// ---- BFF DTO shapes (mirror the Spring records) ---------------------------
export interface DiagramSummary {
  id: number;
  name: string;
  classification?: string;
  updatedAt?: string;
}
export interface DiagramResponse {
  id: number;
  name: string;
  contentJson: string;
  classification: string;
  ownerEmail: string;
  updatedAt: string;
}
export interface DiagramRequest {
  name: string;
  contentJson: string;
  classification: string;
}
export interface ImageDiagramResult {
  title: string;
  nodes: { id: string; label: string; sub: string; kind: string; color: string; x: number; y: number }[];
  links: { from: string; to: string; label: string }[];
  model: string;
  note: string;
}

export const bff = new Bff();
