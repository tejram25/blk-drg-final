import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TemplateDetail, TemplateService, TemplateSummary } from '../../../../core/services/template.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { StarRatingComponent } from '../../../../shared/components/star-rating/star-rating.component';

/**
 * The shared template repository, in a dialog. Three things you can do:
 *  - Use a template  → start a brand-new diagram from it (parent loads it).
 *  - Improve a template → load it to edit and update it back in place.
 *  - Save current as template → publish the current canvas as a new template.
 * The component owns its data (list/create/delete); use/improve are emitted to
 * the parent so it can drive the canvas.
 */
@Component({
  selector: 'app-templates-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, StarRatingComponent],
  templateUrl: './templates-dialog.component.html',
  styleUrls: ['./templates-dialog.component.css'],
})
export class TemplatesDialogComponent implements OnInit {
  /** Current canvas content (X6 graph.toJSON()) for "Save as template". */
  @Input() currentContentJson = '';
  /** Current diagram name, used to prefill the publish form. */
  @Input() currentName = '';

  @Output() close = new EventEmitter<void>();
  @Output() use = new EventEmitter<TemplateDetail>();
  @Output() improve = new EventEmitter<TemplateDetail>();

  templates: TemplateSummary[] = [];
  loading = true;
  busyId: number | null = null;
  /** Free-text filter across name / description / category. */
  query = '';

  /** Templates matching the current search query (case-insensitive). */
  get filtered(): TemplateSummary[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.templates;
    return this.templates.filter((t) =>
      `${t.name} ${t.description ?? ''} ${t.category ?? ''}`.toLowerCase().includes(q));
  }

  /** Publish ("save as template") form. */
  showSave = false;
  saveName = '';
  saveDescription = '';
  saveCategory = '';
  saving = false;

  constructor(private api: TemplateService, private notify: NotificationService) {}

  ngOnInit(): void {
    this.saveName = this.currentName && this.currentName !== 'Untitled diagram' ? this.currentName : '';
    this.refresh();
  }

  private refresh(): void {
    this.loading = true;
    this.api.list().subscribe({
      next: (t) => { this.templates = t; this.loading = false; },
      error: () => (this.loading = false),
    });
  }

  useTemplate(t: TemplateSummary): void {
    if (this.busyId) return;
    this.busyId = t.id;
    this.api.use(t.id).subscribe({
      next: (detail) => {
        this.busyId = null;
        this.use.emit(detail);
        this.notify.success(`Started a new diagram from "${t.name}"`);
        this.close.emit();
      },
      error: () => (this.busyId = null),
    });
  }

  improveTemplate(t: TemplateSummary): void {
    if (this.busyId) return;
    this.busyId = t.id;
    this.api.get(t.id).subscribe({
      next: (detail) => {
        this.busyId = null;
        this.improve.emit(detail);
        this.notify.info(`Improving "${t.name}" — make changes, then Update template`);
        this.close.emit();
      },
      error: () => (this.busyId = null),
    });
  }

  /** Submit/replace the current user's star rating for a template. */
  rate(t: TemplateSummary, stars: number): void {
    this.api.rate(t.id, stars).subscribe({
      next: (detail) => {
        // Reflect the new aggregate + the user's own rating on the card in place.
        t.avgRating = detail.avgRating;
        t.ratingCount = detail.ratingCount;
        t.myRating = detail.myRating;
        this.notify.success(`You rated "${t.name}" ${stars}★`);
      },
    });
  }

  deleteTemplate(t: TemplateSummary, event: MouseEvent): void {
    event.stopPropagation();
    if (!confirm(`Delete the template "${t.name}"? This cannot be undone.`)) return;
    this.api.delete(t.id).subscribe({
      next: () => {
        this.templates = this.templates.filter((x) => x.id !== t.id);
        this.notify.success(`Deleted "${t.name}"`);
      },
    });
  }

  publish(): void {
    if (this.saving) return;
    const name = this.saveName.trim();
    if (!name) { this.notify.error('Give the template a name.'); return; }
    if (!this.currentContentJson) { this.notify.error('Nothing on the canvas to save.'); return; }
    this.saving = true;
    this.api.create({
      name,
      description: this.saveDescription.trim(),
      category: this.saveCategory.trim(),
      contentJson: this.currentContentJson,
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showSave = false;
        this.saveDescription = '';
        this.saveCategory = '';
        this.notify.success(`Published "${name}" to the template repository`);
        this.refresh();
      },
      error: () => (this.saving = false),
    });
  }

  trackById(_: number, t: TemplateSummary): number {
    return t.id;
  }
}
