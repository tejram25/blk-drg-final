import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiBaseUrl } from '../../../core/app-config';
import { CatalogPart } from '../../../core/services/part-search.service';

/** A catalogue part linked to a project, with the quantity the design needs. */
export interface LinkedPart {
  part: CatalogPart;
  qty: number;
  /** Project the part is attached to. */
  projectId: string;
  linkedAt: string;
}

/** Wire shape of a persisted link (see ProjectPartLinkController). */
interface LinkDto {
  partId: string;
  quantity: number;
  linkedBy: string;
  /** The full CatalogPart, stored as JSON so the card rebuilds without re-searching. */
  part: string;
}

const API = apiBaseUrl();

/**
 * The link between catalogue parts and the places they get used — a project's
 * BOM, and blocks on a diagram.
 *
 * Project links are **persisted** (`/api/workspace/projects/{id}/parts`), so a
 * refresh keeps them. The signal is the reactive source of truth the UI reads;
 * writes update it optimistically and then reconcile with the server. Each
 * project's links are loaded once, lazily, the first time they are needed.
 *
 * The diagram hand-off is deliberately in-memory: staging a part for the editor
 * is a within-session gesture, not something to survive a reload.
 */
@Injectable({ providedIn: 'root' })
export class PartLinkService {
  private readonly http = inject(HttpClient);

  // ---- project BOM (persisted) -------------------------------------------
  private readonly links = signal<LinkedPart[]>([]);
  readonly all = this.links.asReadonly();
  /** Projects whose links have been fetched, so we load each only once. */
  private readonly loaded = new Set<string>();

  /** Parts linked to one project. */
  linksFor(projectId: string): LinkedPart[] {
    return this.links().filter((l) => l.projectId === projectId);
  }

  /** Fetch a project's persisted links into the signal (once per project). */
  loadFor(projectId: string): void {
    if (!projectId || this.loaded.has(projectId)) return;
    this.loaded.add(projectId);
    this.http.get<LinkDto[]>(`${API}/workspace/projects/${projectId}/parts`).subscribe({
      next: (dtos) => {
        const loaded = dtos.map((d) => this.fromDto(d, projectId)).filter((l): l is LinkedPart => !!l);
        // Replace this project's rows, keep other projects' rows untouched.
        this.links.update((list) => [...list.filter((l) => l.projectId !== projectId), ...loaded]);
      },
      // Not loaded is not fatal — the user can still link; the write will persist.
      error: () => this.loaded.delete(projectId),
    });
  }

  linkToProject(part: CatalogPart, qty: number, projectId = ''): void {
    const q = Math.max(1, qty);
    // Optimistic: re-linking the same part updates its quantity, never duplicates.
    this.links.update((list) => {
      const existing = list.find((l) => l.part.id === part.id && l.projectId === projectId);
      return existing
        ? list.map((l) => l === existing ? { ...l, qty: q } : l)
        : [...list, { part, qty: q, projectId, linkedAt: 'Just now' }];
    });
    if (!projectId) return;   // no project context: session-only
    this.http.post(`${API}/workspace/projects/${projectId}/parts`, {
      partId: part.id, quantity: q, part: JSON.stringify(part),
      partNumber: part.partNumber, manufacturer: part.manufacturer,
      description: part.description, status: part.status,
      unitPrice: part.pricing?.unitPrice, currency: part.pricing?.currency,
    }).subscribe({ error: () => {} });   // signal already reflects it; server catches up
  }

  unlink(partId: string, projectId = ''): void {
    this.links.update((list) =>
      list.filter((l) => !(l.part.id === partId && l.projectId === projectId)));
    if (!projectId) return;
    this.http.delete(`${API}/workspace/projects/${projectId}/parts/${partId}`).subscribe({ error: () => {} });
  }

  /** Rebuild a LinkedPart from its stored JSON; drops rows that cannot parse. */
  private fromDto(d: LinkDto, projectId: string): LinkedPart | null {
    try {
      const part = JSON.parse(d.part) as CatalogPart;
      if (!part?.id) return null;
      return { part, qty: Math.max(1, d.quantity), projectId, linkedAt: 'Saved' };
    } catch {
      return null;
    }
  }

  // ---- diagram hand-off (in-memory, within-session) ----------------------
  private readonly staged = signal<{ part: CatalogPart; qty: number } | null>(null);
  readonly stagedPart = this.staged.asReadonly();
  readonly hasStaged = computed(() => this.staged() !== null);

  /** Queue a part for the diagram editor to attach to a block. */
  stageForDiagram(part: CatalogPart, qty: number): void {
    this.staged.set({ part, qty: Math.max(1, qty) });
  }

  /** Take the staged part (clears it), for the editor to consume once. */
  takeStaged(): { part: CatalogPart; qty: number } | null {
    const s = this.staged();
    this.staged.set(null);
    return s;
  }
}
