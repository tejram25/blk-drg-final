import { Component, EventEmitter, Input, Output } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RecommendationItem, RecommendationResult } from '../../../../core/services/recommendation.service';

/**
 * Shows AI/rule-based recommendations: templates, parts and solution options,
 * each with a source‑traceability badge and a "verify the spec/datasheet" prompt.
 * Presentational — the editor owns the data and adds chosen parts to the canvas.
 */
@Component({
    selector: 'app-recommendations-dialog',
    imports: [MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './recommendations-dialog.component.html',
    styleUrls: ['./recommendations-dialog.component.css']
})
export class RecommendationsDialogComponent {
  @Input() result: RecommendationResult | null = null;
  @Input() loading = false;
  @Output() addPart = new EventEmitter<RecommendationItem>();
  @Output() close = new EventEmitter<void>();

  icon(type: string): string {
    if (type === 'template') return 'dashboard_customize';
    if (type === 'part') return 'memory';
    return 'lightbulb';
  }
}
