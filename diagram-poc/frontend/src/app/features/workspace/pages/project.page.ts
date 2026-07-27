import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProjectWorkspaceService } from '../project-workspace.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../ui/ws-ui';

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
  styleUrls: ['./pages.css'],
  template: `
    @if (a(); as art) {
      <!-- ── artefact viewer ── -->
      <div class="art">
        <div class="art-head">
          <mat-icon class="art-ico">{{ icon(art.kind) }}</mat-icon>
          <div>
            <h1>{{ art.name }}</h1>
            <p class="detail">{{ art.folder }} · {{ art.author }} · updated {{ art.updated }}
              @if (art.size) { · {{ size(art.size) }} }</p>
          </div>
          @if (art.origin === 'salesforce') {
            <ws-pill tone="accent">Salesforce · read only</ws-pill>
          }
        </div>

        @switch (art.kind) {
          @case ('dataset') {
            <ws-panel [heading]="'Preview — first ' + (art.preview?.rows?.length || 0) + ' rows'" [flush]="true">
              <div class="table-wrap">
                <table class="tbl">
                  <thead><tr>@for (c of art.preview?.columns; track c) { <th>{{ c }}</th> }</tr></thead>
                  <tbody>
                    @for (r of art.preview?.rows; track $index) {
                      <tr>@for (cell of r; track $index) { <td>{{ cell }}</td> }</tr>
                    }
                  </tbody>
                </table>
              </div>
            </ws-panel>
          }
          @case ('bom') {
            <ws-panel heading="Bill of materials">
              <p class="detail">Rolled up from the parts attached across this project's diagrams.
                Open a diagram to edit its parts; the roll-up follows.</p>
            </ws-panel>
          }
          @case ('review') {
            <ws-panel heading="Review">
              <p style="margin:0;color:var(--text);font-size:13px">{{ art.summary }}</p>
            </ws-panel>
          }
          @default {
            <ws-panel heading="Document">
              <p style="margin:0 0 10px;color:var(--text);font-size:13px">{{ art.summary }}</p>
              <p class="detail">Preview is not rendered in this build — the file is stored against the
                project and opens in your document viewer.</p>
            </ws-panel>
          }
        }
      </div>
    } @else {
      <!-- ── project overview ── -->
      <div class="pad">
        <ws-page-header [title]="p().name"
          [subtitle]="p().customer + ' · ' + p().id + ' · Salesforce ' + p().sfdcId">
          <ws-pill [tone]="p().health">{{ p().health }}</ws-pill>
          <ws-pill>{{ p().stage }}</ws-pill>
        </ws-page-header>

        <div class="grid stats">
          <ws-stat label="Diagrams" [value]="count('diagram')" icon="account_tree" tone="accent" />
          <ws-stat label="Documents" [value]="count('document')" icon="description" />
          <ws-stat label="Datasets" [value]="count('dataset')" icon="table_chart" />
          <ws-stat label="Design-win value" [value]="money(p().value)" icon="trending_up" />
        </div>

        <ws-panel heading="Everything in this project" [flush]="true">
          <div class="table-wrap">
            <table class="tbl">
              <thead><tr><th></th><th>Name</th><th>Folder</th><th>Owner</th><th>Source</th><th class="num">Updated</th></tr></thead>
              <tbody>
                @for (art of p().artifacts; track art.id) {
                  <tr (click)="open(art.id)" style="cursor:pointer">
                    <td><mat-icon class="sev-icon">{{ icon(art.kind) }}</mat-icon></td>
                    <td class="ink">{{ art.name }}</td>
                    <td>{{ art.folder }}</td>
                    <td>{{ art.author }}</td>
                    <td>
                      <ws-pill [tone]="art.origin === 'salesforce' ? 'accent' : ''">
                        {{ art.origin === 'salesforce' ? 'Salesforce' : 'Workspace' }}</ws-pill>
                    </td>
                    <td class="num">{{ art.updated }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </ws-panel>

        <p class="detail" style="margin-top:14px">
          Projects and their workflow are owned by Salesforce and mirrored here nightly
          (last run {{ pw.sync().lastSync }}). Engineering artefacts are added in this workspace.
        </p>
      </div>
    }
  `,
  styles: [`
    .pad { padding: 20px 22px 28px; }
    .art { padding: 18px 22px 28px; }
    .art-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
    .art-head h1 { margin: 0; font-size: 18px; font-weight: 600; color: var(--text); }
    .art-ico { font-size: 26px; width: 26px; height: 26px; color: var(--accent-ink); margin-top: 2px; }
    .art-head ws-pill { margin-left: auto; }
  `],
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
    if (art?.kind === 'diagram') this.routeToDiagram(art.diagramId);
  }

  private routeToDiagram(id?: number): void {
    this.router.navigate(['/workspace/block-diagram', id ?? 'new']);
  }

  open(id: string): void {
    const art = this.p().artifacts.find((x) => x.id === id);
    if (!art) return;
    this.pw.open(art);
    if (art.kind === 'diagram') this.routeToDiagram(art.diagramId);
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
