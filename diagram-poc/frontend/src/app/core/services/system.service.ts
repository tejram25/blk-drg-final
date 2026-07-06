import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

/** Server status/capabilities the UI reads to adapt (e.g. AI-feature gating). */
export interface SystemInfo {
  name: string;
  version: string;
  partsMode: 'mock' | 'live';
  /** True when the local vision/LLM (Ollama) is turned on server-side. */
  aiEnabled: boolean;
  startedAt: string;
  serverTime: string;
}

const API = apiBaseUrl();

/** Reads {@code /api/system/info} — version, parts mode, and whether AI is on. */
@Injectable({ providedIn: 'root' })
export class SystemService {
  constructor(private http: HttpClient) {}

  info(): Observable<SystemInfo> {
    return this.http.get<SystemInfo>(`${API}/system/info`);
  }
}
