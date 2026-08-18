import { Component, EventEmitter, OnInit, Output } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { IntegrationService, ProjectDetail, ProjectPart, ProjectSummary } from '../../../../core/services/integration.service';

/**
 * Project workspace panel: search the Salesforce Design/Deal Workspace, open a
 * project to see its opportunity, stage, lead-time and BOM, attach it to the
 * diagram, and drop its parts onto the canvas.
 */
@Component({
    selector: 'app-project-panel',
    imports: [FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './project-panel.component.html',
    styleUrls: ['./project-panel.component.css']
})
export class ProjectPanelComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() addPart = new EventEmitter<ProjectPart>();
  @Output() attach = new EventEmitter<ProjectDetail>();

  query = '';
  projects: ProjectSummary[] = [];
  selected: ProjectDetail | null = null;
  loading = false;

  constructor(private api: IntegrationService) {}

  ngOnInit(): void {
    this.search();
  }

  search(): void {
    this.loading = true;
    this.api.searchProjects(this.query).subscribe({
      next: (p) => { this.projects = p; this.loading = false; },
      error: () => (this.loading = false),
    });
  }

  open(p: ProjectSummary): void {
    this.api.getProject(p.id).subscribe({ next: (d) => (this.selected = d) });
  }

  back(): void {
    this.selected = null;
  }
}
