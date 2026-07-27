import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ReviewFinding } from '../../../../core/services/design-review.service';
import { BomRow } from '../../../../core/services/bom.service';
import { Participant } from '../../../../core/services/gojs-collab.service';

type DockTab = 'problems' | 'bom' | 'collab';

/**
 * Bottom tool window, in the IntelliJ mould: a docked strip under the canvas
 * that keeps review findings, the bill of materials and the live session roster
 * one click away instead of behind modal dialogs.
 *
 * It owns no data — the editor passes what it already has, and the dock emits
 * when the user asks for something that has not been loaded yet.
 */
@Component({
  selector: 'app-workspace-dock',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './workspace-dock.component.html',
  styleUrls: ['./workspace-dock.component.css'],
})
export class WorkspaceDockComponent {
  @Input() findings: ReviewFinding[] | null = null;
  @Input() reviewLoading = false;
  @Input() bomRows: BomRow[] | null = null;
  @Input() participants: Participant[] = [];

  /** Ask the editor to run the design review / build the BOM on demand. */
  @Output() runReview = new EventEmitter<void>();
  @Output() buildBom = new EventEmitter<void>();
  @Output() collapsedChange = new EventEmitter<boolean>();

  tab: DockTab = 'problems';
  collapsed = false;

  select(tab: DockTab): void {
    // Clicking the active tab collapses the dock, as tool windows normally do.
    if (this.tab === tab && !this.collapsed) {
      this.setCollapsed(true);
      return;
    }
    this.tab = tab;
    this.setCollapsed(false);
  }

  toggleCollapsed(): void {
    this.setCollapsed(!this.collapsed);
  }

  private setCollapsed(v: boolean): void {
    this.collapsed = v;
    this.collapsedChange.emit(v);
  }

  /** Counts shown on the tabs; null means "not loaded yet", so show nothing. */
  get problemCount(): number | null {
    return this.findings ? this.findings.filter((f) => f.severity !== 'info').length : null;
  }
  get bomCount(): number | null {
    return this.bomRows ? this.bomRows.length : null;
  }

  /** Glyph + colour per severity, so state reads without relying on colour. */
  severityIcon(sev: string): string {
    if (sev === 'risk') return 'error';
    if (sev === 'warn') return 'warning';
    return 'info';
  }

  trackFinding = (i: number, f: ReviewFinding) => `${f.category}:${f.title}:${i}`;
  trackRow = (i: number, r: BomRow) => `${r.partNumber}:${i}`;
  trackPeer = (_: number, p: Participant) => p.uid;
}
