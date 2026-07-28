import { Injectable, computed, signal } from '@angular/core';
import { CatalogPart } from '../../../core/services/part-search.service';

/** A catalogue part linked to a project, with the quantity the design needs. */
export interface LinkedPart {
  part: CatalogPart;
  qty: number;
  /** Project the part is attached to. */
  projectId: string;
  linkedAt: string;
}

/**
 * Holds the link between catalogue parts and the places they get used —
 * a project's BOM, and blocks on a diagram.
 *
 * The Parts tab and the block-diagram editor are separate routes, so a part
 * chosen in one has to reach the other. Rather than passing it through the URL,
 * a part is "staged" here and the editor consumes it when a block is picked —
 * the same hand-off an IDE uses between a search result and the editor.
 */
@Injectable({ providedIn: 'root' })
export class PartLinkService {
  // ---- project BOM -------------------------------------------------------
  private readonly links = signal<LinkedPart[]>([]);
  readonly all = this.links.asReadonly();

  /** Parts linked to one project. */
  linksFor(projectId: string): LinkedPart[] {
    return this.links().filter((l) => l.projectId === projectId);
  }

  linkToProject(part: CatalogPart, qty: number, projectId = ''): void {
    this.links.update((list) => {
      // Re-linking the same part updates its quantity instead of duplicating.
      const existing = list.find((l) => l.part.id === part.id && l.projectId === projectId);
      if (existing) {
        return list.map((l) => l === existing ? { ...l, qty: Math.max(1, qty) } : l);
      }
      return [...list, { part, qty: Math.max(1, qty), projectId, linkedAt: 'Just now' }];
    });
  }

  unlink(partId: string, projectId = ''): void {
    this.links.update((list) => list.filter((l) => !(l.part.id === partId && l.projectId === projectId)));
  }

  // ---- diagram hand-off --------------------------------------------------
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
