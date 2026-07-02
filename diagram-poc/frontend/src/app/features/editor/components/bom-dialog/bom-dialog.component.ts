import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { BomRow, BomService } from '../../../../core/services/bom.service';

/** Shows the Bill of Materials as a table with a CSV download. */
@Component({
    selector: 'app-bom-dialog',
    imports: [FormsModule, MatButtonModule, MatIconModule],
    templateUrl: './bom-dialog.component.html',
    styleUrls: ['./bom-dialog.component.css']
})
export class BomDialogComponent {
  @Input() rows: BomRow[] = [];
  @Input() diagramName = 'diagram';
  @Output() close = new EventEmitter<void>();

  constructor(private bom: BomService) {}

  get totalQuantity(): number {
    return this.rows.reduce((sum, r) => sum + r.quantity, 0);
  }

  downloadCsv(): void {
    const blob = new Blob([this.bom.toCsv(this.rows)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.diagramName || 'diagram'}-bom.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
