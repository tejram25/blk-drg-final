import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { VersionService, VersionSummary } from '../../../../core/services/version.service';
import { NotificationService } from '../../../../core/services/notification.service';

/**
 * Version history for a saved diagram: save a labelled snapshot of the current
 * canvas, and restore any previous snapshot. Restoring emits its content to the
 * parent, which loads it onto the canvas.
 */
@Component({
    selector: 'app-versions-dialog',
    imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule],
    templateUrl: './versions-dialog.component.html',
    styleUrls: ['./versions-dialog.component.css']
})
export class VersionsDialogComponent implements OnInit {
  @Input({ required: true }) diagramId!: number;
  @Input() diagramName = '';
  @Input() currentContentJson = '';
  @Output() close = new EventEmitter<void>();
  @Output() restore = new EventEmitter<string>();

  versions: VersionSummary[] = [];
  label = '';
  saving = false;
  loading = true;

  constructor(private api: VersionService, private notify: NotificationService) {}

  ngOnInit(): void {
    this.api.list(this.diagramId).subscribe({
      next: (v) => { this.versions = v; this.loading = false; },
      error: () => (this.loading = false),
    });
  }

  saveSnapshot(): void {
    if (this.saving) return;
    this.saving = true;
    this.api.snapshot(this.diagramId, this.label.trim(), this.currentContentJson).subscribe({
      next: (v) => {
        this.versions = [v, ...this.versions];
        this.label = '';
        this.saving = false;
        this.notify.success('Snapshot saved');
      },
      error: () => (this.saving = false),
    });
  }

  restoreVersion(v: VersionSummary): void {
    this.api.get(v.id).subscribe({
      next: (detail) => {
        this.restore.emit(detail.contentJson);
        this.notify.success(`Restored "${v.label}"`);
        this.close.emit();
      },
    });
  }
}
