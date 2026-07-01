import { Component, EventEmitter, Input, Output } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DesignReviewResult } from '../../../../core/services/design-review.service';

/**
 * Shows AI/rule-based design-review findings for the current diagram, grouped by
 * severity (risk / warn / info) with a suggested fix. Presentational.
 */
@Component({
    selector: 'app-design-review-dialog',
    imports: [MatIconModule, MatTooltipModule],
    templateUrl: './design-review-dialog.component.html',
    styleUrls: ['./design-review-dialog.component.css']
})
export class DesignReviewDialogComponent {
  @Input() result: DesignReviewResult | null = null;
  @Input() loading = false;
  @Output() close = new EventEmitter<void>();

  icon(severity: string): string {
    if (severity === 'risk') return 'error';
    if (severity === 'warn') return 'warning';
    return 'info';
  }

  get riskCount(): number {
    return (this.result?.findings ?? []).filter((f) => f.severity === 'risk').length;
  }
}
