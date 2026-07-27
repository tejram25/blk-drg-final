import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProjectWorkspaceService } from '../../services/project-workspace.service';
import { Artifact } from '../../models/workspace.models';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../../ui';

/**
 * The editor area. Shows the open artefact, or the project overview when no tab
 * is open — the equivalent of an IDE's "no file selected" landing view.
 *
 * Diagrams route out to the GoJS editor; documents and datasets render here.
 */
@Component({
  selector: 'app-ws-project',
  standalone: true,
  imports: [CommonModule, MatIconModule, WsPageHeaderComponent, WsPanelComponent,
            WsStatComponent, WsPillComponent],
  templateUrl: './project.page.html',
  styleUrls: ['../pages.css', './project.page.css'],
})
export class ProjectPage {
  readonly pw = inject(ProjectWorkspaceService);
  private readonly router = inject(Router);

  readonly p = computed(() => this.pw.openProject());
  /** The open artefact, unless it is a diagram — those route to the canvas editor. */
  readonly a = computed(() => {
    const art = this.pw.activeArtifact();
    return art && art.kind !== 'diagram' ? art : null;
  });

  constructor() {
    // A diagram tab means the canvas, which is a different route.
    const art = this.pw.activeArtifact();
    if (art?.kind === 'diagram') this.routeToDiagram(art);
  }

  /** Resolve the artefact to its saved diagram (creating it if new), then open. */
  private routeToDiagram(art: Artifact): void {
    this.pw.resolveDiagram(art).subscribe({
      next: (id) => this.router.navigate(['/workspace/block-diagram', id]),
      error: () => this.router.navigate(['/workspace/block-diagram', 'new']),
    });
  }

  /** Start a diagram on this project and open it straight away. */
  newDiagram(): void {
    const artifact = this.pw.newDiagram();
    this.pw.open(artifact);
    this.routeToDiagram(artifact);
  }

  open(id: string): void {
    const art = this.p().artifacts.find((x) => x.id === id);
    if (!art) return;
    this.pw.open(art);
    if (art.kind === 'diagram') this.routeToDiagram(art);
  }

  count(kind: string): number { return this.p().artifacts.filter((x) => x.kind === kind).length; }
  icon(kind: string): string {
    return { diagram: 'account_tree', document: 'description', dataset: 'table_chart',
      bom: 'receipt_long', review: 'fact_check' }[kind] ?? 'insert_drive_file';
  }
  size(b: number): string {
    return b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1)} MB` : `${Math.round(b / 1000)} kB`;
  }
  money(n: number): string {
    return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}k`;
  }
}
