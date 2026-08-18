import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { DiagramService, DiagramSummary } from '../../../../core/services/diagram.service';
import { WsPageHeaderComponent, WsPanelComponent, WsPillComponent, WsStatComponent } from '../../ui';

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
  styleUrls: ['../pages.css'],
  templateUrl: './block-diagram.page.html',
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
