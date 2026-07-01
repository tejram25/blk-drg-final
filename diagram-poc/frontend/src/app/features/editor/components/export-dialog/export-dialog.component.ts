import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/** One row in the export component list. */
export interface ExportNode {
  id: string;
  label: string;
  visible: boolean;
}

/**
 * Pre-export dialog: pick the image format and hide any components you don't
 * want in the exported picture. Presentational — toggling/showing-all/export are
 * emitted to the editor, which owns the graph and runs the actual export.
 */
@Component({
    selector: 'app-export-dialog',
    imports: [CommonModule, MatButtonModule, MatIconModule],
    templateUrl: './export-dialog.component.html',
    styleUrls: ['./export-dialog.component.css']
})
export class ExportDialogComponent {
  @Input() nodes: ExportNode[] = [];
  @Input() format: 'png' | 'svg' = 'png';
  @Output() toggle = new EventEmitter<string>();
  @Output() showAll = new EventEmitter<void>();
  @Output() run = new EventEmitter<'png' | 'svg'>();
  @Output() close = new EventEmitter<void>();

  get hiddenCount(): number {
    return this.nodes.filter((n) => !n.visible).length;
  }
}
