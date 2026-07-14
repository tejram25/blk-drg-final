import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DesignWinContext, DesignWinService } from '../../../../core/services/designwin.service';

/** One drill-down level in the explorer. */
interface Level {
  kind: 'customers' | 'projects' | 'boards' | 'detail';
  label: string;
  items: Row[];
  /** The customer/project/board context of this level's ancestors. */
  ctx?: DesignWinContext;
}

/** A normalised record from the raw Design Win JSON. */
interface Row {
  title: string;
  subtitle: string;
  fields: { k: string; v: string }[];
  raw: any;
  expanded?: boolean;
  /** Order quantity chosen for a part row (defaults to its EAU, min 1). */
  qty?: number;
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
  /** Whether a block is selected on the canvas (enables "Link to block"). */
  @Input() hasSelection = false;
  @Output() close = new EventEmitter<void>();
  /** Emitted when the user adds a Design Win part to the diagram as a new card. */
  @Output() addPart = new EventEmitter<{ partNumber: string; manufacturer: string; description: string; quantity: number }>();
  /** Emitted when the user links a Design Win part to the selected block. */
  @Output() attachPart = new EventEmitter<{ partNumber: string; manufacturer: string; description: string; quantity: number }>();
  /** Emitted when the user attaches a customer / project / board to the diagram. */
  @Output() attach = new EventEmitter<DesignWinContext>();

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
    this.run(this.dw.customers(q), 'customers', (rows) => {
      this.stack = [{ kind: 'customers', label: `Customers · "${q}"`, items: rows, ctx: {} }];
    });
  }

  openCustomer(row: Row): void {
    // Search this customer's projects by name AND bill-to (more precise than name alone).
    const name = this.pickDeep(row.raw, ['customerName', 'custName']) || row.title;
    const billTo = this.pickDeep(row.raw, ['billTo', 'billToNumber', 'custBillTo', 'siteNumber']);
    this.run(this.dw.projects(name, undefined, billTo || undefined), 'projects', (rows) => {
      this.stack.push({ kind: 'projects', label: name, items: rows, ctx: { customerName: name, billTo: billTo || undefined } });
    });
  }

  openProject(row: Row): void {
    const id = this.pickDeep(row.raw, ['projectId', 'projectID', 'project_id', 'id']);
    const name = this.pickDeep(row.raw, ['projectName', 'project_name', 'name']) || row.title;
    const parent = this.level?.ctx || {};
    this.run(this.dw.boards(id || undefined, id ? undefined : name), 'boards', (rows) => {
      this.stack.push({ kind: 'boards', label: name || 'Project', items: rows,
        ctx: { ...parent, projectName: name, projectId: id || undefined } });
    });
  }

  openBoard(row: Row): void {
    const boardNum = this.pickDeep(row.raw, ['boardNum', 'boardNumber', 'board_num', 'boardId']) || row.title;
    const parent = this.level?.ctx || {};
    this.loading = true; this.error = '';
    // Registration details + the board's customer parts, merged into one detail level.
    this.dw.registrationDetails({ boardNum }).subscribe({
      next: (reg) => {
        const regRows = this.normalize(reg, 'detail').map((r) => ({ ...r, subtitle: r.subtitle || 'Registration' }));
        const push = (partRows: Row[]) => {
          this.loading = false;
          this.stack.push({ kind: 'detail', label: `Board ${boardNum}`, items: [...regRows, ...partRows],
            ctx: { ...parent, boardNum } });
        };
        // cust-parts needs the customer scope (the backend rejects a bare boardNum).
        this.dw.custParts({ boardNum, customerName: parent.customerName, custBillTo: parent.billTo, projectId: parent.projectId }).subscribe({
          next: (parts) => push(this.normalize(parts, 'detail').map((r) => ({ ...r, subtitle: r.subtitle || 'Registered part' }))),
          error: () => push([]), // still show the registration rows even if parts lookup fails
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

  // ---- using the data: pull registered parts into the diagram ----

  /** A detail row is a "part" if we can find a part number in it. */
  partNumberOf(row: Row): string {
    return this.pickDeep(row.raw, ['partNumber', 'mfrPartNum', 'custPartNum', 'arwPartNum', 'suppPartNum']);
  }
  /** Detail rows that carry a part number (registered / customer parts). */
  get partRows(): Row[] {
    return this.level?.kind === 'detail' ? this.level.items.filter((r) => !!this.partNumberOf(r)) : [];
  }
  /** The chosen quantity for a part row (defaults to its EAU / qty, min 1). */
  qtyOf(row: Row): number {
    if (row.qty == null) {
      row.qty = Math.max(1, Number(this.pickDeep(row.raw, ['eau', 'quantity', 'qty', 'annualUsage'])) || 1);
    }
    return row.qty;
  }
  clampQty(row: Row): void { row.qty = Math.max(1, Math.floor(Number(row.qty) || 1)); }

  private partPayload(row: Row) {
    return {
      partNumber: this.partNumberOf(row),
      manufacturer: this.pickDeep(row.raw, ['mfrName', 'manufacturer', 'mfr']),
      description: this.pickDeep(row.raw, ['description', 'desc']),
      quantity: this.qtyOf(row),
    };
  }
  addRowToDiagram(row: Row): void {
    if (!this.partNumberOf(row)) return;
    this.addPart.emit(this.partPayload(row));
  }
  /** Link this part to the block currently selected on the canvas. */
  attachPartRow(row: Row): void {
    if (!this.partNumberOf(row)) return;
    this.attachPart.emit(this.partPayload(row));
  }
  addAllParts(): void { this.partRows.forEach((r) => this.addRowToDiagram(r)); }

  /** Attach the current customer / project / board (this row + its ancestors) to the diagram. */
  attachRow(row: Row): void {
    const l = this.level;
    if (!l) return;
    const base: DesignWinContext = { ...(l.ctx || {}) };
    let c: DesignWinContext;
    if (l.kind === 'customers') {
      c = { customerName: this.pickDeep(row.raw, ['customerName', 'custName']) || row.title,
            billTo: this.pickDeep(row.raw, ['billTo', 'billToNumber', 'custBillTo', 'siteNumber']) || undefined };
    } else if (l.kind === 'projects') {
      c = { ...base, projectName: this.pickDeep(row.raw, ['projectName', 'project_name', 'name']) || row.title,
            projectId: this.pickDeep(row.raw, ['projectId', 'projectID', 'project_id', 'id']) || undefined };
    } else if (l.kind === 'boards') {
      c = { ...base, boardNum: this.pickDeep(row.raw, ['boardNum', 'boardNumber', 'board_num', 'boardId']) || row.title };
    } else {
      c = base; // detail: attach the board context
    }
    this.attach.emit(c);
  }

  checkPos(): void {
    const pn = this.posPart.trim();
    if (!pn) return;
    this.posLoading = true; this.posError = ''; this.posResult = null;
    this.dw.sales(pn, this.posMfr.trim() || undefined).subscribe({
      next: (json) => {
        this.posLoading = false;
        const rows = this.normalize(json, 'detail');
        this.posResult = { proven: rows.length > 0, count: rows.length, rows: rows.slice(0, 12) };
      },
      error: (e) => {
        this.posLoading = false;
        this.posError = this.reason(e);
      },
    });
  }

  // ---- plumbing ----

  private run(obs: any, kind: Level['kind'], apply: (rows: Row[]) => void): void {
    this.loading = true; this.error = '';
    obs.subscribe({
      next: (json: any) => { this.loading = false; apply(this.normalize(json, kind)); },
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

  /** Like {@link pick} but also reaches into nested `{name}`/`{value}` objects. */
  private pickDeep(obj: any, keys: string[]): string {
    for (const k of keys) {
      let v = obj?.[k];
      if (v && typeof v === 'object') v = v.name ?? v.value ?? v.desc ?? '';
      if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
    }
    return '';
  }

  /** The title field(s), curated field labels, per drill-down level. */
  private static readonly TITLE: Record<string, string[]> = {
    customers: ['customerName', 'custName', 'custSiteName', 'name'],
    projects: ['projectName', 'project_name', 'name'],
    boards: ['boardName', 'boardNum', 'boardNumber', 'board_num', 'name'],
    detail: ['partNumber', 'mfrPartNum', 'custPartNum', 'registrationNum', 'arrowUniqueNum', 'name'],
  };
  private static readonly SUBTITLE: Record<string, string[]> = {
    customers: ['enteringBranch', 'billTo', 'accountNumber', 'type'],
    projects: ['stage', 'projectStatus', 'status', 'phase'],
    boards: ['status', 'boardStatus', 'stage'],
    detail: ['mfrName', 'manufacturer', 'status', 'trackingNum'],
  };
  /** Curated [label, aliases] per level so the important fields always surface. */
  private static readonly FIELDS: Record<string, [string, string[]][]> = {
    customers: [
      ['Account #', ['accountNumber', 'acctNumber']],
      ['Bill-to', ['billTo', 'billToNumber', 'siteNumber']],
      ['Branch', ['enteringBranch', 'branch']],
      ['Site', ['custSiteName', 'internalSiteName']],
      ['FSR / ISR', ['fsrName', 'isrName']],
      ['Status', ['status', 'siteStatus']],
      ['Address', ['address']],
    ],
    projects: [
      ['Project ID', ['projectId', 'projectID', 'project_id', 'id']],
      ['Stage', ['stage', 'phase', 'projectStage']],
      ['Status', ['projectStatus', 'status']],
      ['Est. EAU', ['eau', 'estAnnualUsage', 'annualUsage']],
      ['FAE / FSR', ['fsrName', 'faeName', 'fae']],
      ['Created', ['createDate', 'createdDate', 'startDate']],
    ],
    boards: [
      ['Board #', ['boardNum', 'boardNumber', 'board_num', 'boardId']],
      ['Status', ['status', 'boardStatus', 'stage']],
      ['Registration #', ['registrationNum', 'regNum']],
      ['Arrow #', ['arrowUniqueNum', 'aun']],
      ['Created', ['createDate', 'createdDate']],
    ],
    detail: [
      ['Part #', ['partNumber', 'mfrPartNum', 'custPartNum']],
      ['Manufacturer', ['mfrName', 'manufacturer', 'mfr']],
      ['Description', ['description', 'desc']],
      ['EAU / Qty', ['eau', 'quantity', 'qty', 'annualUsage']],
      ['Status', ['designStatus', 'regStatus', 'status']],
      ['Registration #', ['registrationNum', 'regNum']],
      ['Tracking #', ['trackingNum']],
      ['Last shipment', ['lastShipDate', 'posDate', 'shipDate']],
      ['POS amount', ['posAmount', 'salesAmount']],
    ],
  };

  /** Normalise raw Design Win JSON into displayable rows for a given level. */
  private normalize(json: any, kind: Level['kind']): Row[] {
    let data = json;
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return []; } }
    const arr = this.firstArray(data) ?? (data && typeof data === 'object' && Object.keys(data).length ? [data] : []);
    const titleKeys = DesignwinPanelComponent.TITLE[kind];
    const subKeys = DesignwinPanelComponent.SUBTITLE[kind];
    const fieldDefs = DesignwinPanelComponent.FIELDS[kind];
    return arr.slice(0, 50).map((item: any) => {
      const title = this.pickDeep(item, titleKeys) || 'Record';
      const subtitle = this.pickDeep(item, subKeys);
      // Curated fields first (only those with a value); then any other scalar
      // fields we didn't already show, so nothing is silently dropped.
      const used = new Set<string>();
      const fields: { k: string; v: string }[] = [];
      for (const [label, aliases] of fieldDefs) {
        const v = this.pickDeep(item, aliases);
        if (v) { fields.push({ k: label, v }); aliases.forEach((a) => used.add(a)); }
      }
      for (const [k, v] of Object.entries(item)) {
        if (used.has(k) || fields.length >= 12) continue;
        let sv: any = v;
        if (sv && typeof sv === 'object') sv = sv.name ?? sv.value ?? '';
        if (sv !== null && sv !== undefined && String(sv).trim() !== '' && typeof sv !== 'object') {
          fields.push({ k: this.humanize(k), v: String(sv) });
        }
      }
      const row: Row = { title, subtitle, fields, raw: item };
      // Part rows get a default order quantity (EAU, min 1) the user can edit.
      if (kind === 'detail') row.qty = this.qtyOf(row);
      return row;
    });
  }

  /** camelCase / snake_case → "Title Case" for un-curated field labels. */
  private humanize(k: string): string {
    return k.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
