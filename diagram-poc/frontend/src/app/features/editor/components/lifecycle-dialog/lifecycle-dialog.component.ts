import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AlternativePart, LifecycleInfo } from '../../../../core/services/lifecycle.service';

/**
 * Lifecycle status + alternatives for a part (SiliconExpert-style). Presentational:
 * the parent loads the data and drops chosen alternatives onto the canvas.
 */
@Component({
  selector: 'app-lifecycle-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './lifecycle-dialog.component.html',
  styleUrls: ['./lifecycle-dialog.component.css'],
})
export class LifecycleDialogComponent {
  @Input() info: LifecycleInfo | null = null;
  @Input() loading = false;
  @Output() addAlternative = new EventEmitter<AlternativePart>();
  @Output() close = new EventEmitter<void>();

  /** CSS modifier for the status pill. */
  statusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('active')) return 'ok';
    if (s.includes('nrnd') || s.includes('last time') || s.includes('ltb')) return 'warn';
    if (s.includes('obsolete') || s.includes('eol')) return 'bad';
    return 'neutral';
  }
}
