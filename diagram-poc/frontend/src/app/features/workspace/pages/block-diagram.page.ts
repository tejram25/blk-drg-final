import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DiagramService, DiagramSummary } from '../../../core/services/diagram.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../ui/ws-ui';

/**
 * Block Diagram module landing page: the real saved diagrams from the backend,
 * plus templates to start from. Opening one routes to the editor, which runs
 * inside this workspace shell so the navigation stays put.
 */
@Component({
  selector: 'app-ws-block-diagram',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule,
    WsPageHeaderComponent, WsPanelComponent, WsStatComponent, WsPillComponent,
  ],
  styleUrls: ['./pages.css'],
  template: `
    <ws-page-header title="Block Diagram"
      subtitle="Schematic block diagrams, shared with the team and linked to projects.">
      <button type="button" class="btn primary" (click)="newDiagram()">
        <mat-icon>add</mat-icon> New diagram
      </button>
    </ws-page-header>

    <div class="grid stats">
      <ws-stat label="Diagrams" [value]="diagrams().length" icon="account_tree" />
      <ws-stat label="Shared with team" [value]="sharedCount()" icon="groups" tone="accent" />
      <ws-stat label="Restricted" [value]="restrictedCount()" icon="lock"
        [tone]="restrictedCount() ? 'warn' : ''" hint="export controlled" />
      <ws-stat label="Templates" [value]="templates.length" icon="dashboard_customize" />
    </div>

    <div class="filters">
      <input [ngModel]="query()" (ngModelChange)="query.set($event)"
        placeholder="Search diagrams…" aria-label="Search diagrams" />
      <select [ngModel]="visibility()" (ngModelChange)="visibility.set($event)" aria-label="Filter by classification">
        <option value="">All classifications</option>
        <option value="PUBLIC">Public</option>
        <option value="INTERNAL">Internal</option>
        <option value="RESTRICTED">Restricted</option>
      </select>
      <span class="spacer"></span>
      <span class="link">{{ filtered().length }} of {{ diagrams().length }}</span>
    </div>

    @if (loading()) {
      <p class="empty">Loading diagrams…</p>
    } @else if (!diagrams().length) {
      <ws-panel>
        <div class="empty">
          <p>No diagrams yet. Start from a blank canvas or pick a template below.</p>
          <button type="button" class="btn primary" (click)="newDiagram()">
            <mat-icon>add</mat-icon> New diagram
          </button>
        </div>
      </ws-panel>
    } @else {
      <div class="cards" style="margin-bottom:16px">
        @for (d of filtered(); track d.id) {
          <a class="card" (click)="open(d.id)" tabindex="0" (keydown.enter)="open(d.id)">
            <h3>{{ d.name }}</h3>
            <span class="sub">Updated {{ d.updatedAt | date: 'MMM d, HH:mm' }}</span>
            <div class="meta">
              <ws-pill [tone]="d.classification === 'RESTRICTED' ? 'warn' : 'accent'">
                {{ d.classification || 'INTERNAL' }}</ws-pill>
              @if (d.ownerEmail) { <span>{{ d.ownerEmail }}</span> }
            </div>
          </a>
        } @empty {
          <p class="empty">No diagrams match “{{ query() }}”.</p>
        }
      </div>
    }

    <ws-panel heading="Quick templates">
      <div class="cards">
        @for (t of templates; track t.name) {
          <a class="card" (click)="newDiagram()" tabindex="0" (keydown.enter)="newDiagram()">
            <h3>{{ t.name }}</h3>
            <span class="sub">{{ t.detail }}</span>
            <div class="meta"><span>{{ t.blocks }} blocks</span><span>{{ t.category }}</span></div>
          </a>
        }
      </div>
    </ws-panel>
  `,
})
export class BlockDiagramPage {
  private readonly api = inject(DiagramService);
  private readonly router = inject(Router);

  readonly diagrams = signal<DiagramSummary[]>([]);
  readonly loading = signal(true);
  readonly query = signal('');
  readonly visibility = signal('');

  readonly templates = [
    { name: 'Buck converter', detail: 'Input protection, regulator, feedback divider.', blocks: 8, category: 'Power' },
    { name: 'IoT gateway', detail: 'MCU, radio, PMIC and sensor bus.', blocks: 12, category: 'Industrial IoT' },
    { name: 'Sensor front end', detail: 'Analog conditioning into an ADC.', blocks: 6, category: 'Analog' },
    { name: 'Motor drive', detail: 'Gate driver, bridge and current sense.', blocks: 10, category: 'Energy' },
  ];

  constructor() {
    this.api.list().subscribe({
      next: (d) => { this.diagrams.set(d ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase(); const v = this.visibility();
    return this.diagrams().filter((d) =>
      (!q || d.name.toLowerCase().includes(q)) &&
      (!v || (d.classification || 'INTERNAL') === v));
  });
  readonly sharedCount = computed(() =>
    this.diagrams().filter((d) => (d.classification || 'INTERNAL') !== 'RESTRICTED').length);
  readonly restrictedCount = computed(() =>
    this.diagrams().filter((d) => d.classification === 'RESTRICTED').length);

  open(id: number): void { this.router.navigate(['/workspace/block-diagram', id]); }
  newDiagram(): void { this.router.navigate(['/workspace/block-diagram', 'new']); }
}
