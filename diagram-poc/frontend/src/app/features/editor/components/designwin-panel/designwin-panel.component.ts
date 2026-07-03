import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DesignWinService } from '../../../../core/services/designwin.service';

/** One drill-down level in the explorer. */
interface Level {
  kind: 'customers' | 'projects' | 'boards' | 'detail';
  label: string;
  items: Row[];
}

/** A normalised record from the raw Design Win JSON. */
interface Row {
  title: string;
  subtitle: string;
  fields: { k: string; v: string }[];
  raw: any;
  expanded?: boolean;
}

/**
 * Design Win explorer. Surfaces the full Arrow Design Win API family that the
 * backend proxies: customer search → projects → boards → registration details +
 * customer parts, plus a POS/sales ("field-proven") check for any part number.
 * Responses are raw upstream JSON, so rendering is deliberately tolerant.
 */
@Component({
  selector: 'app-designwin-panel',
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  templateUrl: './designwin-panel.component.html',
  styleUrls: ['./designwin-panel.component.css'],
})
export class DesignwinPanelComponent implements OnInit {
  /** Optional part number to preseed the POS tab with (from a selected part card). */
  @Input() seedPart = '';
  @Output() close = new EventEmitter<void>();

  tab: 'explore' | 'pos' = 'explore';
  /** Show the "what is Design Win?" explainer. */
  helpOpen = false;

  // ---- explore state ----
  query = '';
  loading = false;
  error = '';
  /** Drill-down stack; the last entry is what's shown. */
  stack: Level[] = [];

  // ---- POS state ----
  posPart = '';
  posMfr = '';
  posLoading = false;
  posError = '';
  posResult: { proven: boolean; count: number; rows: Row[] } | null = null;

  constructor(private dw: DesignWinService) {}

  ngOnInit(): void {
    if (this.seedPart) {
      this.tab = 'pos';
      this.posPart = this.seedPart;
      this.checkPos();
    }
  }

  get level(): Level | null { return this.stack.length ? this.stack[this.stack.length - 1] : null; }

  crumbTo(i: number): void { this.stack = this.stack.slice(0, i + 1); }
  back(): void { if (this.stack.length > 1) this.stack.pop(); }

  searchCustomers(): void {
    const q = this.query.trim();
    if (!q) return;
    this.run(this.dw.customers(q), (rows) => {
      this.stack = [{ kind: 'customers', label: `Customers · "${q}"`, items: rows }];
    });
  }

  openCustomer(row: Row): void {
    const name = row.title;
    this.run(this.dw.projects(name), (rows) => {
      this.stack.push({ kind: 'projects', label: name, items: rows });
    });
  }

  openProject(row: Row): void {
    const id = this.pick(row.raw, ['projectId', 'projectID', 'project_id', 'id']);
    const name = this.pick(row.raw, ['projectName', 'project_name', 'name']) || row.title;
    this.run(this.dw.boards(id || undefined, id ? undefined : name), (rows) => {
      this.stack.push({ kind: 'boards', label: name || 'Project', items: rows });
    });
  }

  openBoard(row: Row): void {
    const boardNum = this.pick(row.raw, ['boardNum', 'boardNumber', 'board_num', 'boardId']) || row.title;
    this.loading = true; this.error = '';
    // Registration details + the board's customer parts, merged into one detail level.
    this.dw.registrationDetails({ boardNum }).subscribe({
      next: (reg) => {
        const regRows = this.normalize(reg).map((r) => ({ ...r, subtitle: r.subtitle || 'Registration' }));
        this.dw.custParts({ boardNum }).subscribe({
          next: (parts) => {
            const partRows = this.normalize(parts).map((r) => ({ ...r, subtitle: r.subtitle || 'Customer part' }));
            this.loading = false;
            this.stack.push({ kind: 'detail', label: `Board ${boardNum}`, items: [...regRows, ...partRows] });
          },
          error: (e) => this.fail(e),
        });
      },
      error: (e) => this.fail(e),
    });
  }

  onRowClick(row: Row): void {
    const l = this.level;
    if (!l) return;
    if (l.kind === 'customers') this.openCustomer(row);
    else if (l.kind === 'projects') this.openProject(row);
    else if (l.kind === 'boards') this.openBoard(row);
    else row.expanded = !row.expanded;
  }

  checkPos(): void {
    const pn = this.posPart.trim();
    if (!pn) return;
    this.posLoading = true; this.posError = ''; this.posResult = null;
    this.dw.sales(pn, this.posMfr.trim() || undefined).subscribe({
      next: (json) => {
        this.posLoading = false;
        const rows = this.normalize(json);
        this.posResult = { proven: rows.length > 0, count: rows.length, rows: rows.slice(0, 12) };
      },
      error: (e) => {
        this.posLoading = false;
        this.posError = this.reason(e);
      },
    });
  }

  // ---- plumbing ----

  private run(obs: any, apply: (rows: Row[]) => void): void {
    this.loading = true; this.error = '';
    obs.subscribe({
      next: (json: any) => { this.loading = false; apply(this.normalize(json)); },
      error: (e: any) => this.fail(e),
    });
  }

  private fail(e: any): void {
    this.loading = false;
    this.error = this.reason(e);
  }

  private reason(e: any): string {
    return e?.error?.message || e?.message || 'Design Win request failed — is the Arrow connection configured?';
  }

  /** Deep-find the first meaningful array of objects in an arbitrary payload. */
  private firstArray(node: any, depth = 0): any[] | null {
    if (depth > 5 || node == null) return null;
    if (Array.isArray(node)) return node.length && typeof node[0] === 'object' ? node : null;
    if (typeof node === 'object') {
      for (const v of Object.values(node)) {
        const found = this.firstArray(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  private pick(obj: any, keys: string[]): string {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v);
    }
    return '';
  }

  /** Normalise raw Design Win JSON into displayable rows. */
  private normalize(json: any): Row[] {
    let data = json;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return []; } }
    const arr = this.firstArray(data) ?? (data && typeof data === 'object' && Object.keys(data).length ? [data] : []);
    return arr.slice(0, 50).map((item: any) => {
      const title = this.pick(item, [
        'customerName', 'custName', 'projectName', 'boardNum', 'boardNumber', 'boardName',
        'partNumber', 'mfrPartNum', 'registrationNum', 'arrowUniqueNum', 'name', 'id',
      ]) || 'Record';
      const subtitle = this.pick(item, ['operatingUnit', 'billToNumber', 'custBillTo', 'status', 'stage', 'mfrName', 'trackingNum']);
      const fields = Object.entries(item)
        .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object' && String(v).trim() !== '')
        .slice(0, 10)
        .map(([k, v]) => ({ k, v: String(v) }));
      return { title, subtitle, fields, raw: item };
    });
  }
}
