import {
  AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy,
  OnInit, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as go from 'gojs';
import { BlockType, DiagramService, DiagramSummary } from '../../core/services/diagram.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { GojsCollabService } from '../../core/services/gojs-collab.service';
import { BomRow, BomService } from '../../core/services/bom.service';
import {
  RecommendationItem, RecommendationResult, RecommendationService,
} from '../../core/services/recommendation.service';
import {
  DesignReviewResult, DesignReviewService, ReviewBlock, ReviewLink,
} from '../../core/services/design-review.service';
import { AlternativePart, LifecycleInfo, LifecycleService } from '../../core/services/lifecycle.service';
import { FeedbackRequest, FeedbackService } from '../../core/services/feedback.service';
import { ProjectDetail, ProjectPart } from '../../core/services/integration.service';
import { TemplateDetail } from '../../core/services/template.service';
import { symbolInfo } from './gojs-symbols';
import { exportDrawio, importDrawio } from './gojs-drawio';
import { BomDialogComponent } from '../editor/components/bom-dialog/bom-dialog.component';
import { RecommendationsDialogComponent } from '../editor/components/recommendations-dialog/recommendations-dialog.component';
import { DesignReviewDialogComponent } from '../editor/components/design-review-dialog/design-review-dialog.component';
import { LifecycleDialogComponent } from '../editor/components/lifecycle-dialog/lifecycle-dialog.component';
import { FeedbackDialogComponent } from '../editor/components/feedback-dialog/feedback-dialog.component';
import { ProjectPanelComponent } from '../editor/components/project-panel/project-panel.component';
import { PartSearchPanelComponent } from '../editor/components/part-search-panel/part-search-panel.component';
import { VersionsDialogComponent } from '../editor/components/versions-dialog/versions-dialog.component';
import { CommentsPanelComponent } from '../editor/components/comments-panel/comments-panel.component';
import { TemplatesDialogComponent } from '../editor/components/templates-dialog/templates-dialog.component';
import { ExportDialogComponent, ExportNode } from '../editor/components/export-dialog/export-dialog.component';
import { Command, CommandPaletteComponent } from '../../shared/components/command-palette/command-palette.component';

/**
 * GoJS-based diagram editor — the electronics-aware block-diagram builder.
 * Replaces the previous AntV X6 canvas. Renders functional block cards,
 * catalogue part cards, images, and the electrical / animated / basic shape
 * libraries; supports port-based linking, a grouped palette, properties editing,
 * real-time collaboration (Yjs), undo/redo, zoom, align/distribute, and the full
 * AI + catalogue tool-set (part search, recommendations, design review, BOM,
 * lifecycle, versions, comments, templates, project workspace, exports).
 */
@Component({
  selector: 'app-gojs-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatTooltipModule,
    BomDialogComponent, RecommendationsDialogComponent, DesignReviewDialogComponent,
    LifecycleDialogComponent, FeedbackDialogComponent, ProjectPanelComponent,
    PartSearchPanelComponent, VersionsDialogComponent, CommentsPanelComponent,
    TemplatesDialogComponent, ExportDialogComponent, CommandPaletteComponent,
  ],
  templateUrl: './gojs-editor.component.html',
  styleUrls: ['./gojs-editor.component.css'],
})
export class GojsEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLDivElement>;
  @ViewChild('palette', { static: true }) paletteRef!: ElementRef<HTMLDivElement>;
  @ViewChild('minimap', { static: true }) minimapRef!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;
  @ViewChild('drawioInput') drawioInput!: ElementRef<HTMLInputElement>;

  private diagram!: go.Diagram;
  private palette!: go.Palette;
  private overview: go.Overview | null = null;
  private selectedNode: go.Node | null = null;
  private diagramId: number | null = null;
  private autosaveTimer: any = null;
  private suppressAutosave = false;

  diagramName = 'Untitled diagram';
  status = '';
  saving = false;
  showChat = false;
  chatDraft = '';
  minimapOpen = false;
  private viewportTick: any = null;

  categories: { name: string; blocks: BlockType[] }[] = [];
  sel: {
    text: string; color: string;
    partNumber?: string; supplier?: string; quantity?: number;
    isPart: boolean; details: { label: string; value: string }[];
  } | null = null;

  // ---- dialog / panel state ----
  partSearchOpen = false;
  partSearchSeed = '';
  recsOpen = false; recsLoading = false; recsResult: RecommendationResult | null = null;
  reviewOpen = false; reviewLoading = false; reviewResult: DesignReviewResult | null = null;
  bomRows: BomRow[] | null = null;
  lifecycleOpen = false; lifecycleLoading = false; lifecycleInfo: LifecycleInfo | null = null;
  feedbackOpen = false; feedbackSubmitting = false;
  projectPanelOpen = false; linkedProject: ProjectDetail | null = null;
  versionsOpen = false;
  commentsOpen = false;
  templatesOpen = false;
  exportOpen = false; exportFormat: 'png' | 'svg' = 'png'; exportNodes: ExportNode[] = [];
  private exportHidden = new Set<string>();
  commandPaletteOpen = false;

  constructor(
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private diagrams: DiagramService,
    private notify: NotificationService,
    private auth: AuthService,
    public collab: GojsCollabService,
    private bomService: BomService,
    private recsApi: RecommendationService,
    private reviewApi: DesignReviewService,
    private lifecycleApi: LifecycleService,
    private feedbackApi: FeedbackService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadPalette();
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.initDiagram());
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.doLoad(Number(id));
  }

  ngOnDestroy(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.collab.leave();
    if (this.overview) this.overview.div = null;
    if (this.diagram) this.diagram.div = null;
    if (this.palette) this.palette.div = null;
  }

  // ---- keyboard ----

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); this.save(); }
    else if (k === 'k') { e.preventDefault(); this.commandPaletteOpen = true; this.cdr.detectChanges(); }
  }

  // ---- collaboration ----

  private joinCollab(): void {
    if (this.diagramId == null || this.collab.active) return;
    const u = this.auth.user();
    const name = u?.name || u?.email || 'You';
    const uid = u?.email || `anon-${Math.random().toString(36).slice(2)}`;
    this.zone.runOutsideAngular(() => this.collab.join(this.diagram, String(this.diagramId), name, uid));
  }

  onCanvasMouseMove(e: MouseEvent): void {
    if (!this.collab.active || !this.diagram) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const pt = this.diagram.transformViewToDoc(new go.Point(e.clientX - rect.left, e.clientY - rect.top));
    this.collab.setLocalCursor({ x: pt.x, y: pt.y });
  }

  onCanvasMouseLeave(): void {
    if (this.collab.active) this.collab.setLocalCursor(null);
  }

  private onViewport(): void {
    if (this.collab.active) {
      const pos = this.diagram.position;
      this.collab.setLocalViewport({ x: pos.x, y: pos.y, scale: this.diagram.scale });
    }
    if (this.viewportTick) return;
    this.viewportTick = setTimeout(() => {
      this.viewportTick = null;
      this.zone.run(() => this.cdr.detectChanges());
    }, 50);
  }

  remoteCursors(): { id: number; name: string; color: string; sx: number; sy: number }[] {
    if (!this.diagram || !this.collab.cursors.length) return [];
    return this.collab.cursors.map((c) => {
      const v = this.diagram.transformDocToView(new go.Point(c.x, c.y));
      return { id: c.id, name: c.name, color: c.color, sx: v.x, sy: v.y };
    });
  }

  toggleChat(): void { this.showChat = !this.showChat; }
  sendChat(): void {
    const text = this.chatDraft.trim();
    if (!text) return;
    this.collab.sendChat(text);
    this.chatDraft = '';
  }
  initials(name: string): string {
    return (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }
  fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ---- diagram setup ----

  private initDiagram(): void {
    const $ = go.GraphObject.make;

    this.diagram = new go.Diagram(this.canvasRef.nativeElement, {
      'undoManager.isEnabled': true,
      'grid.visible': true,
      allowDrop: true,
      'draggingTool.isGridSnapEnabled': true,
      'draggingTool.gridSnapCellSize': new go.Size(8, 8),
      'linkingTool.isUnconnectedLinkValid': false,
      'linkingTool.portGravity': 20,
      'relinkingTool.portGravity': 20,
      minScale: 0.15,
      maxScale: 4,
    });

    this.buildTemplates($);
    this.diagram.model = this.emptyModel();

    this.diagram.addDiagramListener('ChangedSelection', () => this.zone.run(() => this.syncSelection()));
    this.diagram.addDiagramListener('TextEdited', () => this.zone.run(() => this.syncSelection()));
    this.diagram.addModelChangedListener((e) => { if (e.isTransactionFinished) this.scheduleAutosave(); });
    this.diagram.addDiagramListener('ViewportBoundsChanged', () => this.onViewport());

    this.palette = new go.Palette(this.paletteRef.nativeElement, {
      nodeTemplateMap: this.diagram.nodeTemplateMap,
      contentAlignment: go.Spot.TopCenter,
      layout: $(go.GridLayout, {
        wrappingColumn: 1, cellSize: new go.Size(1, 1), spacing: new go.Size(6, 10),
        alignment: go.GridLayout.Position,
      }),
    });
    this.palette.model = this.emptyModel();
    this.refreshPaletteModel();
  }

  private emptyModel(): go.GraphLinksModel {
    const m = new go.GraphLinksModel<go.ObjectData, go.ObjectData>([], []);
    m.linkFromPortIdProperty = 'fromPort';
    m.linkToPortIdProperty = 'toPort';
    m.linkKeyProperty = 'key';
    m.copiesArrays = true;
    m.copiesArrayObjects = true;
    return m;
  }

  private buildTemplates($: typeof go.GraphObject.make): void {
    const portItem = $(
      go.Panel, 'Spot',
      new go.Binding('alignment', 'spot', go.Spot.parse),
      $(
        go.Shape, 'Circle',
        {
          width: 8, height: 8, fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 1.5,
          cursor: 'crosshair', fromLinkable: true, toLinkable: true,
          fromSpot: go.Spot.AllSides, toSpot: go.Spot.AllSides,
        },
        new go.Binding('portId', 'portId'),
      ),
    );

    // functional block card (default)
    const block = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(
        go.Panel, 'Auto',
        {
          portId: '', cursor: 'pointer', fromLinkable: true, toLinkable: true,
          fromSpot: go.Spot.AllSides, toSpot: go.Spot.AllSides,
        },
        $(go.Shape, 'RoundedRectangle',
          { parameter1: 10, fill: '#ffffff', stroke: '#d2d6dc', strokeWidth: 1.5, minSize: new go.Size(150, 52) },
          new go.Binding('stroke', 'color')),
        $(
          go.Panel, 'Horizontal', { margin: 8 },
          $(go.Panel, 'Auto', { width: 36, height: 36, margin: new go.Margin(0, 8, 0, 0) },
            $(go.Shape, 'RoundedRectangle', { parameter1: 8, strokeWidth: 0 }, new go.Binding('fill', 'color')),
            $(go.TextBlock, { font: '20px Material Icons', stroke: '#ffffff' }, new go.Binding('text', 'icon'))),
          $(go.Panel, 'Vertical', { alignment: go.Spot.Left },
            $(go.TextBlock,
              { font: '600 12.5px Roboto, sans-serif', stroke: '#1f2937', editable: true, alignment: go.Spot.Left },
              new go.Binding('text').makeTwoWay()),
            $(go.TextBlock,
              { font: '10px Roboto, sans-serif', stroke: '#9aa0a8', alignment: go.Spot.Left },
              new go.Binding('text', 'subtitle'))),
        ),
      ),
    );
    this.diagram.nodeTemplateMap.set('block', block);
    this.diagram.nodeTemplate = block;

    // catalogue part card
    const part = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(
        go.Panel, 'Auto',
        {
          portId: '', cursor: 'pointer', fromLinkable: true, toLinkable: true,
          fromSpot: go.Spot.AllSides, toSpot: go.Spot.AllSides,
        },
        $(go.Shape, 'RoundedRectangle', { parameter1: 10, fill: '#ffffff', stroke: '#d2d6dc', strokeWidth: 1.5 }),
        $(
          go.Panel, 'Table', { margin: 12, minSize: new go.Size(216, 0) },
          $(go.RowColumnDefinition, { column: 0, stretch: go.GraphObject.Horizontal }),
          $(go.Shape, 'Rectangle',
            { row: 0, column: 0, columnSpan: 2, height: 4, strokeWidth: 0, fill: '#1d4ed8', stretch: go.GraphObject.Horizontal, margin: new go.Margin(0, 0, 6, 0) }),
          $(go.TextBlock,
            { row: 1, column: 0, font: '700 13px Roboto, sans-serif', stroke: '#111827', editable: true, alignment: go.Spot.Left },
            new go.Binding('text').makeTwoWay()),
          $(go.Picture,
            { row: 1, column: 1, rowSpan: 2, width: 48, height: 48, imageStretch: go.GraphObject.Uniform },
            new go.Binding('source', 'img')),
          $(go.TextBlock,
            { row: 2, column: 0, font: '10.5px Roboto, sans-serif', stroke: '#6b7280', alignment: go.Spot.Left },
            new go.Binding('text', 'supplier')),
          $(go.Panel, 'Vertical',
            { row: 3, column: 0, columnSpan: 2, alignment: go.Spot.Left, margin: new go.Margin(4, 0, 0, 0) },
            new go.Binding('itemArray', 'specs'),
            {
              itemTemplate: $(go.Panel, 'Auto', { alignment: go.Spot.Left },
                $(go.TextBlock,
                  { font: '10.5px Roboto, sans-serif', stroke: '#374151', alignment: go.Spot.Left },
                  new go.Binding('text', ''))),
            }),
        ),
      ),
    );
    this.diagram.nodeTemplateMap.set('part', part);

    // imported image
    const image = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(
        go.Panel, 'Vertical',
        {
          portId: '', cursor: 'pointer', fromLinkable: true, toLinkable: true,
          fromSpot: go.Spot.AllSides, toSpot: go.Spot.AllSides,
        },
        $(go.Picture,
          { width: 120, height: 90, imageStretch: go.GraphObject.Uniform },
          new go.Binding('source', 'img'),
          new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify)),
        $(go.TextBlock,
          { font: '11px Roboto, sans-serif', stroke: '#94a3b8', editable: true, margin: new go.Margin(4, 0, 0, 0) },
          new go.Binding('text').makeTwoWay()),
      ),
    );
    this.diagram.nodeTemplateMap.set('image', image);

    // schematic / animated symbol
    const symbol = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Picture, { imageStretch: go.GraphObject.Fill, background: 'transparent' },
        new go.Binding('source', 'source'),
        new go.Binding('desiredSize', 'size', go.Size.parse)),
      $(go.TextBlock,
        { alignment: new go.Spot(0.5, 1, 0, 14), alignmentFocus: go.Spot.Top,
          font: '11px Roboto, sans-serif', stroke: '#94a3b8', editable: true },
        new go.Binding('text').makeTwoWay()),
      $(go.Panel, 'Spot', new go.Binding('itemArray', 'ports'), { itemTemplate: portItem }),
    );
    this.diagram.nodeTemplateMap.set('symbol', symbol);

    // basic flowchart shape
    const basic = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Picture, { imageStretch: go.GraphObject.Fill, background: 'transparent' },
        new go.Binding('source', 'source'),
        new go.Binding('desiredSize', 'size', go.Size.parse)),
      $(go.TextBlock,
        { alignment: go.Spot.Center, font: '13px Roboto, sans-serif', stroke: '#1f2937',
          editable: true, maxSize: new go.Size(160, NaN), textAlign: 'center' },
        new go.Binding('text').makeTwoWay()),
      $(go.Panel, 'Spot', new go.Binding('itemArray', 'ports'), { itemTemplate: portItem }),
    );
    this.diagram.nodeTemplateMap.set('basic', basic);

    // link
    this.diagram.linkTemplate = $(
      go.Link,
      { routing: go.Link.AvoidsNodes, corner: 8, relinkableFrom: true, relinkableTo: true, reshapable: true, resegmentable: true },
      new go.Binding('routing', 'routing', (r) =>
        r === 'normal' ? go.Link.Normal : r === 'smooth' ? go.Link.Orthogonal : go.Link.AvoidsNodes),
      $(go.Shape, { strokeWidth: 2, stroke: '#94a3b8' },
        new go.Binding('stroke', 'color'),
        new go.Binding('strokeWidth', 'width'),
        new go.Binding('strokeDashArray', 'dash')),
      $(go.Shape, { toArrow: 'Standard', fill: '#94a3b8', stroke: null },
        new go.Binding('fill', 'color')),
    );
  }

  // ---- palette ----

  private loadPalette(): void {
    this.diagrams.getBlockTypes().subscribe({
      next: (types) => {
        const byCat = new Map<string, BlockType[]>();
        for (const t of types) {
          const cat = t.category || 'Blocks';
          if (!byCat.has(cat)) byCat.set(cat, []);
          byCat.get(cat)!.push(t);
        }
        this.categories = Array.from(byCat.entries()).map(([name, blocks]) => ({ name, blocks }));
        this.refreshPaletteModel();
        this.cdr.detectChanges();
      },
      error: () => { this.categories = []; },
    });
  }

  private refreshPaletteModel(): void {
    if (!this.palette) return;
    const data: go.ObjectData[] = [];
    for (const cat of this.categories) for (const b of cat.blocks) data.push(this.paletteNodeData(b));
    this.zone.runOutsideAngular(() => {
      const m = this.emptyModel();
      m.nodeDataArray = data;
      this.palette.model = m;
    });
  }

  private paletteNodeData(b: BlockType): go.ObjectData {
    const info = symbolInfo(b.shape);
    if (info) {
      return {
        category: info.basic ? 'basic' : 'symbol',
        text: b.label, shape: b.shape, source: info.source,
        size: `${info.width} ${info.height}`,
        ports: info.pins.map((p, i) => ({ portId: `p${i}`, spot: `${p.fx} ${p.fy}` })),
      };
    }
    return { category: 'block', text: b.label, subtitle: b.category || 'Module', color: b.color || '#1d4ed8', icon: b.icon || 'widgets' };
  }

  // ---- selection / properties ----

  private syncSelection(): void {
    const n = this.diagram.selection.first();
    if (n instanceof go.Node) {
      this.selectedNode = n;
      const d = n.data;
      const isPart = d.category === 'part';
      this.sel = {
        text: d.text ?? '', color: d.color ?? '#1d4ed8', isPart,
        partNumber: d.partNumber, supplier: d.supplier, quantity: d.quantity,
        details: isPart ? this.partDetails(d.part) : [],
      };
    } else {
      this.selectedNode = null;
      this.sel = null;
    }
    this.cdr.detectChanges();
  }

  setField(prop: string, value: any): void {
    if (!this.selectedNode) return;
    const data = this.selectedNode.data;
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => m.set(data, prop, value), 'edit ' + prop));
    if (this.sel) (this.sel as any)[prop] = value;
  }

  setColor(color: string): void { this.setField('color', color); }
  setQuantity(value: any): void { this.setField('quantity', Math.max(1, Number(value) || 1)); }

  /** Full catalogue + inventory info for the Properties panel. */
  private partDetails(part: any): { label: string; value: string }[] {
    if (!part) return [];
    const org = part?.invOrgs?.[0] ?? {};
    const avail = org?.avail ?? {};
    const num = (v: any) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString());
    const compliance = (part?.EnvData?.complianceList ?? []).map((c: any) => c?.type).filter(Boolean).join(', ');
    const rows = [
      { label: 'Arrow part #', value: part?.arwPartNum?.name },
      { label: 'Supplier part #', value: part?.suppPartNum?.name },
      { label: 'Manufacturer', value: part?.mfr?.name },
      { label: 'Supplier', value: part?.supp?.name },
      { label: 'Description', value: org?.desc },
      { label: 'Category', value: part?.icc?.tree || part?.icc?.name },
      { label: 'Status', value: org?.status },
      { label: 'In stock', value: num(avail?.totohQty ?? avail?.FOHQty ?? avail?.ACFOHQty) },
      { label: 'Lead time', value: part?.leadTime?.arwLT ? `${part.leadTime.arwLT} wks` : '' },
      { label: 'Package', value: [org?.pkg, org?.pkgQty && `(${org.pkgQty}/pk)`].filter(Boolean).join(' ') },
      { label: 'Compliance', value: compliance },
    ];
    return rows.filter((r) => r.value != null && String(r.value).trim() !== '') as { label: string; value: string }[];
  }

  // ---- editing commands ----

  newDiagram(): void {
    this.suppressAutosave = true;
    this.collab.leave();
    this.zone.runOutsideAngular(() => { this.diagram.model = this.emptyModel(); });
    this.diagramId = null;
    this.diagramName = 'Untitled diagram';
    this.linkedProject = null;
    this.status = 'New diagram';
    this.suppressAutosave = false;
    this.syncSelection();
  }

  zoomIn(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.increaseZoom()); }
  zoomOut(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.decreaseZoom()); }
  zoomToFit(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.zoomToFit()); }
  get zoomPct(): number { return this.diagram ? Math.round(this.diagram.scale * 100) : 100; }

  deleteSelection(): void {
    this.zone.runOutsideAngular(() => this.diagram.commandHandler.deleteSelection());
    this.syncSelection();
  }
  undo(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.undo()); }
  redo(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.redo()); }
  copySelection(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.copySelection()); }
  pasteClipboard(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.pasteSelection()); }
  duplicateSelection(): void {
    this.zone.runOutsideAngular(() => {
      this.diagram.commandHandler.copySelection();
      this.diagram.commandHandler.pasteSelection();
    });
  }

  align(mode: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'middle'): void {
    const nodes = this.selectedNodes();
    if (nodes.length < 2) return;
    this.zone.runOutsideAngular(() => this.diagram.commit(() => {
      const rects = nodes.map((n) => n.actualBounds);
      const minX = Math.min(...rects.map((r) => r.x));
      const maxX = Math.max(...rects.map((r) => r.right));
      const minY = Math.min(...rects.map((r) => r.y));
      const maxY = Math.max(...rects.map((r) => r.bottom));
      const cX = (minX + maxX) / 2, cY = (minY + maxY) / 2;
      for (const n of nodes) {
        const b = n.actualBounds;
        let x = b.x, y = b.y;
        if (mode === 'left') x = minX;
        else if (mode === 'right') x = maxX - b.width;
        else if (mode === 'center') x = cX - b.width / 2;
        else if (mode === 'top') y = minY;
        else if (mode === 'bottom') y = maxY - b.height;
        else if (mode === 'middle') y = cY - b.height / 2;
        n.move(new go.Point(x, y));
      }
    }, 'align'));
  }

  distribute(axis: 'h' | 'v'): void {
    const nodes = this.selectedNodes();
    if (nodes.length < 3) return;
    this.zone.runOutsideAngular(() => this.diagram.commit(() => {
      const sorted = [...nodes].sort((a, b) =>
        axis === 'h' ? a.actualBounds.x - b.actualBounds.x : a.actualBounds.y - b.actualBounds.y);
      const start = axis === 'h' ? sorted[0].actualBounds.x : sorted[0].actualBounds.y;
      const end = axis === 'h' ? sorted[sorted.length - 1].actualBounds.x : sorted[sorted.length - 1].actualBounds.y;
      const step = (end - start) / (sorted.length - 1);
      sorted.forEach((n, i) => {
        const b = n.actualBounds;
        if (axis === 'h') n.move(new go.Point(start + step * i, b.y));
        else n.move(new go.Point(b.x, start + step * i));
      });
    }, 'distribute'));
  }

  bringToFront(): void {
    this.zone.runOutsideAngular(() => this.diagram.commit(() => {
      let z = 0; this.diagram.nodes.each((n) => { if (n.zOrder != null) z = Math.max(z, n.zOrder); });
      this.selectedNodes().forEach((n) => (n.zOrder = ++z));
    }, 'to front'));
  }
  sendToBack(): void {
    this.zone.runOutsideAngular(() => this.diagram.commit(() => {
      let z = 0; this.diagram.nodes.each((n) => { if (n.zOrder != null) z = Math.min(z, n.zOrder); });
      this.selectedNodes().forEach((n) => (n.zOrder = --z));
    }, 'to back'));
  }

  private selectedNodes(): go.Node[] {
    const out: go.Node[] = [];
    this.diagram.selection.each((p) => { if (p instanceof go.Node) out.push(p); });
    return out;
  }

  private partNodes(): go.Node[] {
    return this.selectedAll((n) => n.data?.category === 'part');
  }
  private selectedAll(pred: (n: go.Node) => boolean): go.Node[] {
    const out: go.Node[] = [];
    this.diagram.nodes.each((n) => { if (pred(n)) out.push(n); });
    return out;
  }

  // ---- image import ----

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      const c = this.diagram.viewportBounds.center;
      this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => {
        (m as go.GraphLinksModel).addNodeData({
          category: 'image', img: src, text: file.name.replace(/\.[^.]+$/, ''),
          loc: go.Point.stringify(c), size: '160 120',
        });
      }, 'add image'));
    };
    reader.readAsDataURL(file);
    (event.target as HTMLInputElement).value = '';
  }

  // ---- catalogue parts ----

  /** Build GoJS node data for a catalogue part object. */
  private buildPartData(part: any, loc?: go.Point): go.ObjectData {
    const title = part?.arwPartNum?.name || part?.suppPartNum?.name || part?.partKey || 'Part';
    const supplier = part?.supp?.name || part?.mfr?.name || part?.icc?.name || 'Component';
    const byName: Record<string, { val: string; uom: string }> = {};
    for (const p of Array.isArray(part?.paramData) ? part.paramData : []) {
      if (p?.name) byName[String(p.name).trim()] = { val: String(p.val ?? '').trim(), uom: String(p.uom ?? '').trim() };
    }
    const spec = (name: string): string => {
      const p = byName[name];
      if (!p || !p.val || /^not required$/i.test(p.val)) return '';
      return p.uom && p.uom !== ' ' ? `${p.val} ${p.uom}`.trim() : p.val;
    };
    const supplyMin = spec('Single Supply Voltage (Min)');
    const supplyMax = spec('Single Supply Voltage (Max)');
    const supply = supplyMin && supplyMax ? `${supplyMin} – ${supplyMax}` : (supplyMin || supplyMax || spec('Single Supply Voltage (Typ)'));
    const pkg = [spec('Pin Count') && `${spec('Pin Count')}-pin`, spec('Package Type')].filter(Boolean).join(' ');
    const org = part?.invOrgs?.[0] ?? {};
    const avail = org?.avail ?? {};
    const stock = Number(avail?.totohQty ?? avail?.FOHQty ?? avail?.ACFOHQty ?? 0);
    const lead = part?.leadTime?.arwLT ? String(part.leadTime.arwLT).trim() : '';
    const stockLead = [`Stock ${stock.toLocaleString()}`, lead && `Lead ${lead} wks`].filter(Boolean).join('  ·  ');
    const invLines = [stockLead, org?.status && `Status: ${org.status}`].filter(Boolean) as string[];
    const specLines = [
      spec('Type') && `Type: ${spec('Type')}`,
      supply && `Supply: ${supply}`,
      spec('Number of Channels') && `Channels: ${spec('Number of Channels')}`,
      spec('Operating Temp Range') && `Temp: ${spec('Operating Temp Range')}`,
      pkg && `Pkg: ${pkg}`,
    ].filter(Boolean) as string[];
    const lines = [...invLines, ...specLines].slice(0, 4);
    const urls: any[] = Array.isArray(part?.urls) ? part.urls : [];
    const imgUrl = urls.find((u) => /image small/i.test(u?.type))?.URL || urls.find((u) => /image/i.test(u?.type))?.URL || '';
    const category = part?.icc?.tree ? String(part.icc.tree).split('|')[0].trim() : (part?.icc?.name || 'Component');
    return {
      category: 'part', text: title, supplier, img: imgUrl, specs: lines,
      part, partNumber: title, catName: category, quantity: 1,
      loc: loc ? go.Point.stringify(loc) : undefined,
    };
  }

  /** Drop a searched/selected part onto the canvas at the viewport centre. */
  addPartToCanvas(part: any): void {
    const c = this.diagram.viewportBounds.center;
    let added: go.ObjectData;
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => {
      added = this.buildPartData(part, c);
      (m as go.GraphLinksModel).addNodeData(added);
    }, 'add part'));
    const name = part?.arwPartNum?.name || part?.suppPartNum?.name || 'part';
    this.notify.success(`Added "${name}"`);
  }

  private partNumberOfData(d: any): string | null {
    if (!d || d.category !== 'part') return null;
    return d.part?.arwPartNum?.name || d.part?.suppPartNum?.name || d.partNumber || null;
  }

  // ---- BOM ----

  exportBom(): void {
    const parts = this.partNodes()
      .filter((n) => !this.exportHidden.has(String(n.key)))
      .map((n) => ({ ...n.data.part, __bomQty: n.data.quantity || 1 }))
      .filter((p) => p && Object.keys(p).length > 1);
    if (!parts.length) {
      this.notify.info('No catalogue parts on the canvas to build a BOM from. Search and add parts first.');
      return;
    }
    this.bomRows = this.bomService.build(parts);
  }
  closeBom(): void { this.bomRows = null; }

  // ---- AI recommendations ----

  openRecommendations(): void {
    this.recsResult = null; this.recsLoading = true; this.recsOpen = true;
    const parts = this.partNodes().map((n) => this.partNumberOfData(n.data)).filter((p): p is string => !!p);
    const goal = this.diagramName && this.diagramName !== 'Untitled diagram' ? this.diagramName : '';
    this.recsApi.recommend(goal, parts).subscribe({
      next: (res) => { this.recsResult = res; this.recsLoading = false; },
      error: () => { this.recsLoading = false; this.recsOpen = false; },
    });
  }

  onRecAddPart(item: RecommendationItem): void {
    const q = (item.query && item.query.trim()) ? item.query.trim() : item.title;
    this.recsOpen = false;
    this.partSearchSeed = q;
    this.partSearchOpen = false;
    setTimeout(() => { this.partSearchOpen = true; }, 0);
    this.notify.info(`Catalogue options for "${q}" — choose a supplier and add.`);
  }

  // ---- AI design review ----

  openDesignReview(): void {
    const blocks: ReviewBlock[] = [];
    const keyToName = new Map<go.Key, string>();
    this.diagram.nodes.each((n) => {
      const d = n.data;
      if (d.category === 'image') return;
      const name = String(d.text || '').trim();
      keyToName.set(n.key, name);
      if (name) blocks.push({ name, type: String(d.shape || d.category || '') });
    });
    const links: ReviewLink[] = [];
    this.diagram.links.each((l) => {
      const from = keyToName.get(l.fromNode?.key ?? '') || '';
      const to = keyToName.get(l.toNode?.key ?? '') || '';
      if (from && to) links.push({ from, to });
    });
    if (!blocks.length) {
      this.notify.info('Add some blocks to the canvas first, then run a design review.');
      return;
    }
    const goal = this.diagramName && this.diagramName !== 'Untitled diagram' ? this.diagramName : '';
    this.reviewResult = null; this.reviewLoading = true; this.reviewOpen = true;
    this.reviewApi.review(goal, blocks, links).subscribe({
      next: (res) => { this.reviewResult = res; this.reviewLoading = false; },
      error: () => { this.reviewLoading = false; this.reviewOpen = false; },
    });
  }

  // ---- lifecycle ----

  checkLifecycle(partNumber: string): void {
    if (!partNumber) return;
    this.lifecycleInfo = null; this.lifecycleLoading = true; this.lifecycleOpen = true;
    this.lifecycleApi.lookup(partNumber).subscribe({
      next: (info) => { this.lifecycleInfo = info; this.lifecycleLoading = false; },
      error: () => { this.lifecycleLoading = false; this.lifecycleOpen = false; },
    });
  }
  checkSelectedLifecycle(): void {
    const pn = this.selectedNode ? this.partNumberOfData(this.selectedNode.data) : null;
    if (pn) this.checkLifecycle(pn); else this.notify.info('Select a catalogue part first.');
  }
  onAddAlternative(alt: AlternativePart): void {
    this.addPartToCanvas({
      arwPartNum: { name: alt.partNumber }, suppPartNum: { name: alt.partNumber },
      supp: { name: alt.manufacturer }, mfr: { name: alt.manufacturer },
      invOrgs: [{ desc: alt.note }],
      paramData: [{ name: 'Type', val: alt.dropIn ? 'Drop-in alternative' : 'Approved substitute' }],
    });
  }

  // ---- feedback ----

  openFeedback(): void { this.feedbackOpen = true; }
  onSubmitFeedback(req: FeedbackRequest): void {
    this.feedbackSubmitting = true;
    this.feedbackApi.submit({ ...req, diagramId: this.diagramId ?? undefined }).subscribe({
      next: () => { this.feedbackSubmitting = false; this.feedbackOpen = false; this.notify.success('Thanks! Your feedback was sent.'); },
      error: () => { this.feedbackSubmitting = false; this.notify.error('Could not send feedback. Please try again.'); },
    });
  }

  // ---- project workspace ----

  onAttachProject(project: ProjectDetail): void {
    this.linkedProject = project;
    this.projectPanelOpen = false;
    this.notify.success(`Linked to ${project.id} · ${project.customer}`);
  }
  onAddProjectPart(part: ProjectPart): void {
    this.addPartToCanvas({
      arwPartNum: { name: part.partNumber }, suppPartNum: { name: part.partNumber },
      supp: { name: part.manufacturer }, mfr: { name: part.manufacturer },
      invOrgs: [{ desc: part.description }],
      paramData: [],
    });
  }

  // ---- versions ----

  get currentContentJson(): string { return this.diagram ? this.diagram.model.toJson() : ''; }
  openVersions(): void {
    if (this.diagramId == null) { this.notify.info('Save the diagram first to use version history.'); return; }
    this.versionsOpen = true;
  }
  onRestoreVersion(contentJson: string): void {
    this.applyContent(contentJson);
    this.zone.runOutsideAngular(() => this.diagram.commandHandler.zoomToFit());
  }

  // ---- comments ----

  toggleComments(): void {
    if (!this.commentsOpen && this.diagramId == null) { this.notify.info('Save the diagram first to add comments.'); return; }
    this.commentsOpen = !this.commentsOpen;
  }
  get diagramIdValue(): number { return this.diagramId ?? 0; }
  get selectedNodeId(): string | null { return this.selectedNode ? String(this.selectedNode.key) : null; }
  get selectedNodeLabel(): string {
    const d = this.selectedNode?.data;
    return d ? (d.text || d.shape || d.category || 'block') : '';
  }
  onFocusNode(nodeId: string): void {
    const node = this.diagram.findNodeForKey(this.coerceKey(nodeId));
    if (node) {
      this.zone.runOutsideAngular(() => {
        this.diagram.select(node);
        this.diagram.centerRect(node.actualBounds);
      });
    } else {
      this.notify.info('That block is no longer on the canvas.');
    }
  }
  private coerceKey(raw: string): go.Key {
    const n = Number(raw);
    return raw !== '' && !isNaN(n) ? n : raw;
  }

  // ---- templates ----

  openTemplates(): void { this.templatesOpen = true; }
  onUseTemplate(detail: TemplateDetail): void {
    this.templatesOpen = false;
    this.newDiagram();
    this.diagramName = detail.name || 'From template';
    this.applyContent(detail.contentJson);
    this.zone.runOutsideAngular(() => this.diagram.commandHandler.zoomToFit());
  }
  onImproveTemplate(detail: TemplateDetail): void {
    this.templatesOpen = false;
    this.applyContent(detail.contentJson);
    this.diagramName = detail.name || this.diagramName;
    this.notify.info('Loaded template content — edit and save as a new diagram or template.');
  }

  // ---- export dialog ----

  openExport(format: 'png' | 'svg'): void {
    this.exportFormat = format;
    this.exportNodes = [];
    this.diagram.nodes.each((n) => {
      this.exportNodes.push({ id: String(n.key), label: n.data?.text || n.data?.shape || 'node', visible: !this.exportHidden.has(String(n.key)) });
    });
    this.exportOpen = true;
  }
  onExportToggle(nodeId: string): void {
    if (this.exportHidden.has(nodeId)) this.exportHidden.delete(nodeId);
    else this.exportHidden.add(nodeId);
    this.applyHidden();
    this.exportNodes = this.exportNodes.map((n) => n.id === nodeId ? { ...n, visible: !this.exportHidden.has(nodeId) } : n);
  }
  showAllHidden(): void {
    this.exportHidden.clear();
    this.applyHidden();
    this.exportNodes = this.exportNodes.map((n) => ({ ...n, visible: true }));
  }
  private applyHidden(): void {
    this.zone.runOutsideAngular(() => this.diagram.commit(() => {
      this.diagram.nodes.each((n) => this.diagram.model.set(n.data, 'hidden', this.exportHidden.has(String(n.key))));
    }, 'toggle hidden'));
  }
  runExport(format: 'png' | 'svg'): void {
    this.exportOpen = false;
    if (format === 'png') this.exportPng(); else this.exportSvg();
  }

  // ---- command palette ----

  get commands(): Command[] {
    return [
      { label: 'New diagram', icon: 'note_add', run: () => this.newDiagram() },
      { label: 'Save', icon: 'save', hint: 'Ctrl+S', run: () => this.save() },
      { label: 'Template repository', icon: 'dashboard_customize', run: () => this.openTemplates() },
      { label: 'Recommendations (AI)', icon: 'auto_awesome', run: () => this.openRecommendations() },
      { label: 'Design review (AI)', icon: 'rule', run: () => this.openDesignReview() },
      { label: 'Search parts', icon: 'travel_explore', run: () => (this.partSearchOpen = true) },
      { label: 'Project workspace', icon: 'work', run: () => (this.projectPanelOpen = true) },
      { label: 'Check part lifecycle', icon: 'fact_check', run: () => this.checkSelectedLifecycle() },
      { label: 'Version history', icon: 'history', run: () => this.openVersions() },
      { label: 'Comments', icon: 'comment', run: () => this.toggleComments() },
      { label: 'Duplicate selection', icon: 'library_add', hint: 'Ctrl+D', run: () => this.duplicateSelection() },
      { label: 'Bring to front', icon: 'flip_to_front', run: () => this.bringToFront() },
      { label: 'Send to back', icon: 'flip_to_back', run: () => this.sendToBack() },
      { label: 'Align left', icon: 'align_horizontal_left', run: () => this.align('left') },
      { label: 'Align horizontal centers', icon: 'align_horizontal_center', run: () => this.align('center') },
      { label: 'Distribute horizontally', icon: 'horizontal_distribute', run: () => this.distribute('h') },
      { label: 'Distribute vertically', icon: 'vertical_distribute', run: () => this.distribute('v') },
      { label: 'Zoom to fit', icon: 'fit_screen', run: () => this.zoomToFit() },
      { label: 'Toggle minimap', icon: 'map', run: () => this.toggleMinimap() },
      { label: 'Undo', icon: 'undo', run: () => this.undo() },
      { label: 'Redo', icon: 'redo', run: () => this.redo() },
      { label: 'Export as PNG', icon: 'image', run: () => this.openExport('png') },
      { label: 'Export as SVG', icon: 'shape_line', run: () => this.openExport('svg') },
      { label: 'Export as JSON', icon: 'data_object', run: () => this.exportJson() },
      { label: 'Export to draw.io', icon: 'account_tree', run: () => this.exportDrawioFile() },
      { label: 'Bill of Materials (CSV)', icon: 'receipt_long', run: () => this.exportBom() },
      { label: 'Send feedback', icon: 'feedback', run: () => this.openFeedback() },
    ];
  }

  // ---- minimap ----

  toggleMinimap(): void {
    this.minimapOpen = !this.minimapOpen;
    this.cdr.detectChanges();
    if (this.minimapOpen && !this.overview) {
      this.zone.runOutsideAngular(() => {
        this.overview = new go.Overview(this.minimapRef.nativeElement, { observed: this.diagram, contentAlignment: go.Spot.Center });
      });
    }
  }

  // ---- persistence ----

  save(then?: () => void): void {
    const contentJson = this.diagram.model.toJson();
    const dto: any = { name: this.diagramName || 'Untitled diagram', contentJson };
    if (this.diagramId) dto.id = this.diagramId;
    this.saving = true;
    const done = (d: DiagramSummary | any) => {
      this.saving = false;
      if (d?.id) this.diagramId = d.id;
      this.status = 'Saved';
      this.joinCollab();
      this.cdr.detectChanges();
      then?.();
    };
    if (this.diagramId) this.diagrams.update(this.diagramId, dto).subscribe({ next: done, error: () => this.onSaveError() });
    else this.diagrams.create(dto).subscribe({ next: done, error: () => this.onSaveError() });
  }
  private onSaveError(): void { this.saving = false; this.notify.error('Could not save the diagram.'); this.cdr.detectChanges(); }

  private doLoad(id: number): void {
    this.diagrams.get(id).subscribe({
      next: (dto) => {
        this.diagramName = dto.name;
        this.diagramId = dto.id ?? id;
        this.applyContent(dto.contentJson);
        this.joinCollab();
      },
      error: () => this.notify.error('Could not open that diagram.'),
    });
  }

  private applyContent(contentJson: string): void {
    if (!contentJson) { this.newDiagram(); return; }
    let parsed: any;
    try { parsed = JSON.parse(contentJson); } catch { parsed = null; }
    if (parsed && Array.isArray(parsed.cells)) {
      this.zone.run(() => this.notify.info('This diagram was created in the previous editor and cannot be shown here yet.'));
      this.newDiagram();
      return;
    }
    this.suppressAutosave = true;
    this.zone.runOutsideAngular(() => {
      try {
        const model = go.Model.fromJson(contentJson) as go.GraphLinksModel;
        model.linkFromPortIdProperty = 'fromPort';
        model.linkToPortIdProperty = 'toPort';
        this.diagram.model = model;
      } catch {
        this.zone.run(() => this.notify.error('That diagram could not be loaded.'));
      }
    });
    this.suppressAutosave = false;
    this.syncSelection();
  }

  private scheduleAutosave(): void {
    if (this.suppressAutosave || this.collab.isApplyingRemote) return;
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => this.zone.run(() => this.save()), 1500);
  }

  // ---- export ----

  exportPng(): void {
    const data = this.diagram.makeImageData({ background: '#0e0f11', scale: 2, type: 'image/png' });
    if (typeof data === 'string') this.download(data, this.fileName('png'));
  }
  exportSvg(): void {
    const svg = this.diagram.makeSvg({ scale: 1, background: '#0e0f11' });
    if (!svg) return;
    const text = new XMLSerializer().serializeToString(svg);
    this.download(URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })), this.fileName('svg'));
  }
  exportJson(): void {
    this.download(URL.createObjectURL(new Blob([this.diagram.model.toJson()], { type: 'application/json' })), this.fileName('gojs.json'));
  }
  importJson(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      if (parsed?.partserviceresult?.parts) this.importPartsCatalog(parsed);
      else { this.applyContent(text); this.status = `Imported "${file.name}"`; }
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
  }

  /** Turn a parts-catalogue API response into part cards laid out in a grid. */
  private importPartsCatalog(data: any): void {
    const parts = data.partserviceresult.parts as any[];
    const cols = Math.max(1, Math.min(parts.length, 4));
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => {
      parts.forEach((part, i) => {
        const loc = new go.Point(40 + (i % cols) * 280, 40 + Math.floor(i / cols) * 180);
        (m as go.GraphLinksModel).addNodeData(this.buildPartData(part, loc));
      });
    }, 'import catalog'));
    this.status = `Imported ${parts.length} part${parts.length === 1 ? '' : 's'} from catalog`;
  }

  // ---- draw.io interop ----

  onDrawioSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const nodes = importDrawio(String(reader.result));
        if (!nodes.length) { this.status = 'No shapes found in that draw.io file'; this.cdr.detectChanges(); return; }
        this.newDiagram();
        this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => {
          const gm = m as go.GraphLinksModel;
          nodes.forEach((n) => { if (n.category === 'link') gm.addLinkData(n); else gm.addNodeData(n); });
        }, 'import drawio'));
        this.diagramName = file.name.replace(/\.[^.]+$/, '');
        this.zone.runOutsideAngular(() => this.diagram.commandHandler.zoomToFit());
        this.status = `Imported ${nodes.length} shapes from draw.io`;
      } catch (err: any) {
        this.status = `draw.io import failed: ${err?.message || err}`;
      }
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
  }
  exportDrawioFile(): void {
    const xml = exportDrawio(this.diagram, this.diagramName || 'diagram');
    this.download(URL.createObjectURL(new Blob([xml], { type: 'application/xml' })), this.fileName('drawio'));
  }

  private fileName(ext: string): string {
    return (this.diagramName || 'diagram').replace(/[^\w.-]+/g, '_') + '.' + ext;
  }
  private download(href: string, filename: string): void {
    const a = document.createElement('a');
    a.href = href; a.download = filename; a.click();
    if (href.startsWith('blob:')) URL.revokeObjectURL(href);
  }
}
