import {
  AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy,
  OnInit, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import * as go from 'gojs';
import { BlockType, Classification, DiagramService, DiagramSummary } from '../../core/services/diagram.service';
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
import { TranslateService } from '../../core/services/i18n/translate.service';
import { TranslatePipe } from '../../core/services/i18n/translate.pipe';
import { exportDrawio, importDrawio } from './gojs-drawio';
import {
  SHAPE_DEFS, shapeDef, isShapeKey, registerShapeFigures, shapePreviewInner,
} from './gojs-shapes';
import { LEGACY_FIGURE } from './gojs-legacy';
import { symbolInfo } from './gojs-symbols';
import { BASIC_SHAPES, isBasic } from '../editor/basic-shapes';
import { ELECTRICAL_SYMBOLS } from '../editor/electrical-shapes';
import { ANIMATED_SYMBOLS, partsToSvg } from '../editor/animated-shapes';
import { BomDialogComponent } from '../editor/components/bom-dialog/bom-dialog.component';
import { RecommendationsDialogComponent } from '../editor/components/recommendations-dialog/recommendations-dialog.component';
import { DesignReviewDialogComponent } from '../editor/components/design-review-dialog/design-review-dialog.component';
import { LifecycleDialogComponent } from '../editor/components/lifecycle-dialog/lifecycle-dialog.component';
import { FeedbackDialogComponent } from '../editor/components/feedback-dialog/feedback-dialog.component';
import { ProjectPanelComponent } from '../editor/components/project-panel/project-panel.component';
import { PartSearchPanelComponent } from '../editor/components/part-search-panel/part-search-panel.component';
import { DesignwinPanelComponent } from '../editor/components/designwin-panel/designwin-panel.component';
import { VersionsDialogComponent } from '../editor/components/versions-dialog/versions-dialog.component';
import { CommentsPanelComponent } from '../editor/components/comments-panel/comments-panel.component';
import { TemplatesDialogComponent } from '../editor/components/templates-dialog/templates-dialog.component';
import { ExportDialogComponent, ExportNode } from '../editor/components/export-dialog/export-dialog.component';
import { ReviewsDialogComponent } from '../editor/components/reviews-dialog/reviews-dialog.component';
import { ZoomDockComponent } from '../editor/components/zoom-dock/zoom-dock.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { Command, CommandPaletteComponent } from '../../shared/components/command-palette/command-palette.component';

/**
 * GoJS-based diagram editor — the electronics-aware block-diagram builder.
 * The canvas runs on GoJS + Yjs (collaboration). The chrome (3-zone header with
 * File/Insert/View menus, palette with search + category, wire dock, properties,
 * presence, language, account) matches the established workspace design.
 */
@Component({
    selector: 'app-gojs-editor',
    imports: [
        CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe,
        BomDialogComponent, RecommendationsDialogComponent, DesignReviewDialogComponent,
        LifecycleDialogComponent, FeedbackDialogComponent, ProjectPanelComponent,
        PartSearchPanelComponent, DesignwinPanelComponent, VersionsDialogComponent, CommentsPanelComponent,
        TemplatesDialogComponent, ExportDialogComponent, CommandPaletteComponent,
        ReviewsDialogComponent, ZoomDockComponent, ConfirmDialogComponent,
    ],
    templateUrl: './gojs-editor.component.html',
    styleUrls: ['./gojs-editor.component.css']
})
export class GojsEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLDivElement>;
  @ViewChild('minimap', { static: true }) minimapRef!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('jsonInput') jsonInput!: ElementRef<HTMLInputElement>;
  @ViewChild('drawioInput') drawioInput!: ElementRef<HTMLInputElement>;

  private diagram!: go.Diagram;
  private overview: go.Overview | null = null;
  selectedNode: go.Node | null = null;
  selectedEdge: go.Link | null = null;
  private diagramId: number | null = null;
  private autosaveTimer: any = null;
  private suppressAutosave = false;
  private draggedBlock: BlockType | null = null;
  private previewCache = new Map<string, SafeHtml>();

  diagramName = 'Untitled diagram';
  status = '';
  saving = false;
  showChat = false;
  chatDraft = '';
  minimapOpen = false;
  lightCanvas = true;
  paletteOpen = true;
  propsOpen = true;
  private viewportTick: any = null;

  // palette
  blockTypes: BlockType[] = [];
  paletteQuery = '';
  activeCategory = 'Blocks';
  catMenuOpen = false;

  // header menus
  fileMenuOpen = false;
  insertMenuOpen = false;
  viewMenuOpen = false;
  openMenuOpen = false;
  accountMenuOpen = false;
  langMenuOpen = false;
  presenceOpen = false;

  // saved files + classification
  savedDiagrams: DiagramSummary[] = [];
  selectedDiagramId: number | null = null;
  classification: Classification = 'INTERNAL';
  readonly classificationLevels: Classification[] = ['PUBLIC', 'INTERNAL', 'RESTRICTED'];
  pendingDelete: DiagramSummary | null = null;
  reviewTarget: DiagramSummary | null = null;

  // wire dock
  readonly wireColors = ['#22d3ee', '#22c55e', '#f5a623', '#ef4444', '#a78bfa', '#64748b'];
  wireColor = '#22d3ee';
  /** Animated "flowing current" dashes by default, matching the classic editor. */
  wireStyle: 'flow' | 'dashed' | 'solid' = 'flow';
  wireWidth = 2;
  wireRouter: 'manhattan' | 'normal' | 'smooth' = 'manhattan';
  wirePop: 'color' | 'style' | null = null;

  sel: {
    text: string; color: string;
    partNumber?: string; supplier?: string; quantity?: number;
    isPart: boolean; details: { label: string; value: string }[]; specs: { label: string; value: string }[];
  } | null = null;

  // dialog state
  partSearchOpen = false; partSearchSeed = '';
  designWinOpen = false; designWinSeed = '';
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
    public auth: AuthService,
    public collab: GojsCollabService,
    public i18n: TranslateService,
    private sanitizer: DomSanitizer,
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
    this.refreshList();
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.initDiagram());
    const id = this.route.snapshot.paramMap.get('id');
    if (id) { this.selectedDiagramId = Number(id); this.doLoad(Number(id)); }
  }

  ngOnDestroy(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.collab.leave();
    if (this.overview) this.overview.div = null;
    if (this.diagram) this.diagram.div = null;
  }

  // ---- menus / keyboard ----

  @HostListener('document:click')
  onDocumentClick(): void { this.closeMenus(); }

  closeMenus(): void {
    this.openMenuOpen = this.fileMenuOpen = this.insertMenuOpen = this.viewMenuOpen =
      this.langMenuOpen = this.accountMenuOpen = this.presenceOpen = this.catMenuOpen = false;
  }

  toggleMenu(menu: 'open' | 'file' | 'insert' | 'view' | 'lang' | 'account' | 'presence', event: Event): void {
    event.stopPropagation();
    const wasOpen = {
      open: this.openMenuOpen, file: this.fileMenuOpen, insert: this.insertMenuOpen,
      view: this.viewMenuOpen, lang: this.langMenuOpen, account: this.accountMenuOpen, presence: this.presenceOpen,
    }[menu];
    this.closeMenus();
    if (wasOpen) return;
    ({
      open: () => (this.openMenuOpen = true), file: () => (this.fileMenuOpen = true),
      insert: () => (this.insertMenuOpen = true), view: () => (this.viewMenuOpen = true),
      lang: () => (this.langMenuOpen = true), account: () => (this.accountMenuOpen = true),
      presence: () => (this.presenceOpen = true),
    }[menu])();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); this.save(); }
    else if (k === 'k') { e.preventDefault(); this.commandPaletteOpen = true; this.cdr.detectChanges(); }
  }

  // ---- language ----

  get languages() { return this.i18n.languages; }
  get currentLang(): string { return this.i18n.lang; }
  get currentLangLabel(): string { return this.i18n.currentLabel; }
  switchLang(code: string): void { this.langMenuOpen = false; this.i18n.setLang(code); }

  logout(): void { this.auth.logout().then(() => this.router.navigateByUrl('/login')); }

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
  onCanvasMouseLeave(): void { if (this.collab.active) this.collab.setLocalCursor(null); }

  private onViewport(): void {
    if (this.collab.active) {
      const pos = this.diagram.position;
      this.collab.setLocalViewport({ x: pos.x, y: pos.y, scale: this.diagram.scale });
    }
    if (this.viewportTick) return;
    this.viewportTick = setTimeout(() => { this.viewportTick = null; this.zone.run(() => this.cdr.detectChanges()); }, 50);
  }

  remoteCursors(): { id: number; name: string; color: string; sx: number; sy: number }[] {
    if (!this.diagram || !this.collab.cursors.length) return [];
    return this.collab.cursors.map((c) => {
      const v = this.diagram.transformDocToView(new go.Point(c.x, c.y));
      return { id: c.id, name: c.name, color: c.color, sx: v.x, sy: v.y };
    });
  }
  cursorTrack(_i: number, c: { id: number }): number { return c.id; }
  participantTrack(_i: number, p: { id: number }): number { return p.id; }

  toggleChat(): void { this.showChat = !this.showChat; }
  get chatOpen(): boolean { return this.showChat; }
  get unreadChat(): number { return 0; }
  sendChat(): void {
    const text = this.chatDraft.trim();
    if (!text) return;
    this.collab.sendChat(text);
    this.chatDraft = '';
  }
  initials(name: string): string {
    return (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  }
  fmtTime(ts: number): string { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  // ---- diagram setup ----

  private initDiagram(): void {
    registerShapeFigures();
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
      minScale: 0.15, maxScale: 4,
    });
    // A single, coarse, subtle grid (the default GoJS grid draws several dense
    // line sets that look noisy on the dark canvas).
    this.diagram.grid =
      $(go.Panel, 'Grid', { gridCellSize: new go.Size(24, 24) },
        $(go.Shape, 'LineH', { strokeWidth: 0.5 }),
        $(go.Shape, 'LineV', { strokeWidth: 0.5 }));
    this.applyGridTheme();
    this.buildTemplates($);
    this.diagram.model = this.emptyModel();

    this.diagram.addDiagramListener('ChangedSelection', () => this.zone.run(() => this.syncSelection()));
    this.diagram.addDiagramListener('TextEdited', () => this.zone.run(() => this.syncSelection()));
    this.diagram.addModelChangedListener((e) => {
      if (e.isTransactionFinished) this.zone.run(() => { this.updateCanvasEmpty(); this.scheduleAutosave(); });
    });
    this.diagram.addDiagramListener('ViewportBoundsChanged', () => this.onViewport());
    // apply current wire style to newly drawn links
    this.diagram.addDiagramListener('LinkDrawn', (e) => {
      const link = e.subject as go.Link;
      this.diagram.model.commit((m) => {
        m.set(link.data, 'color', this.wireColor);
        m.set(link.data, 'width', this.wireWidth);
        m.set(link.data, 'dash', this.wireStyle === 'solid' ? null : [6, 3]);
        m.set(link.data, 'flow', this.wireStyle === 'flow');
        m.set(link.data, 'routing', this.wireRouter);
      }, 'style link');
    });
    this.canvasRef.nativeElement.classList.toggle('canvas-light', this.lightCanvas);
    this.startAnimations();
  }

  /** Rotary animated symbols spin; the rest pulse — GoJS canvas can't run the
   * original CSS keyframes, so motion is driven here instead. */
  private readonly spinShapes = new Set(['anim-fan', 'anim-gear', 'anim-generator', 'anim-wind-turbine']);
  private raf = 0;
  private startAnimations(): void {
    let t = 0;
    const loop = () => {
      t += 1;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t / 22));
      const angle = (t * 3) % 360;
      if (this.diagram) {
        this.diagram.nodes.each((n) => {
          const shape = n.data?.shape;
          if (typeof shape !== 'string' || !shape.startsWith('anim-')) return;
          const main = n.findMainElement();
          if (!main) return;
          if (this.spinShapes.has(shape)) main.angle = angle;
          else main.opacity = pulse;
        });
        // "Flowing current" wires: march the dash pattern along flow-style links.
        // strokeDashOffset must be non-negative in GoJS, so run a decreasing
        // positive sawtooth over one dash period (6 + 3) — dashes flow forward.
        const dashOffset = 9 - ((t * 0.6) % 9);
        this.diagram.links.each((l) => {
          if (l.data?.flow && l.path) l.path.strokeDashOffset = dashOffset;
        });
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.zone.runOutsideAngular(() => { this.raf = requestAnimationFrame(loop); });
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

  /** Show/hide a node's link ports on hover (the body itself stays movable). */
  private hoverPorts(obj: go.GraphObject, on: boolean): void {
    const node = obj.part;
    if (node instanceof go.Node) node.ports.each((p) => { if (p.portId) p.opacity = on ? 1 : 0; });
  }

  private buildTemplates($: typeof go.GraphObject.make): void {
    // A small edge port (hidden until hover) used as a link handle.
    const sidePort = (id: string, spot: go.Spot) => $(
      go.Shape, 'Circle',
      {
        desiredSize: new go.Size(9, 9), fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 1.5,
        cursor: 'crosshair', opacity: 0, alignment: spot, alignmentFocus: go.Spot.Center,
        portId: id, fromLinkable: true, toLinkable: true, fromSpot: spot, toSpot: spot,
      });
    const sidePorts = () => [
      sidePort('T', go.Spot.Top), sidePort('R', go.Spot.Right),
      sidePort('B', go.Spot.Bottom), sidePort('L', go.Spot.Left),
    ];
    // Data-driven pin port for schematic / basic symbol shapes (hidden until hover).
    const pinPort = $(
      go.Panel, 'Spot',
      new go.Binding('alignment', 'spot', go.Spot.parse),
      $(go.Shape, 'Circle',
        { desiredSize: new go.Size(9, 9), fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 1.5,
          cursor: 'crosshair', opacity: 0, fromLinkable: true, toLinkable: true },
        new go.Binding('portId', 'portId')),
    );
    // Common node options: hover reveals ports; body is movable (not a link starter).
    const hover = {
      mouseEnter: (_e: go.InputEvent, o: go.GraphObject) => this.hoverPorts(o, true),
      mouseLeave: (_e: go.InputEvent, o: go.GraphObject) => this.hoverPorts(o, false),
    };
    // The body is a non-linkable port "" so imported links can still attach to it,
    // while dragging the body moves the node instead of drawing a link.
    const body = { portId: '', fromLinkable: false, toLinkable: false, cursor: 'move' };
    // Two-way size binding that leaves un-resized nodes at their natural (auto) size.
    const sizeBind = () => new go.Binding('desiredSize', 'size',
      (s: string) => (s ? go.Size.parse(s) : new go.Size(NaN, NaN))).makeTwoWay((sz: go.Size) => go.Size.stringify(sz));

    const block = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, resizeObjectName: 'BODY', ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Panel, 'Auto', body, { name: 'BODY' }, sizeBind(),
        $(go.Shape, 'RoundedRectangle',
          { parameter1: 10, fill: '#ffffff', stroke: '#d2d6dc', strokeWidth: 1.5, minSize: new go.Size(150, 52) },
          new go.Binding('stroke', 'color')),
        $(go.Panel, 'Horizontal', { margin: 8 },
          $(go.Panel, 'Auto', { width: 36, height: 36, margin: new go.Margin(0, 8, 0, 0) },
            $(go.Shape, 'RoundedRectangle', { parameter1: 8, strokeWidth: 0 }, new go.Binding('fill', 'color')),
            $(go.TextBlock, { font: '20px Material Icons', stroke: '#ffffff' }, new go.Binding('text', 'icon'))),
          $(go.Panel, 'Vertical', { alignment: go.Spot.Left },
            $(go.TextBlock,
              { font: '600 12.5px Roboto, sans-serif', stroke: '#1f2937', editable: true, alignment: go.Spot.Left },
              new go.Binding('text').makeTwoWay()),
            $(go.TextBlock, { font: '10px Roboto, sans-serif', stroke: '#9aa0a8', alignment: go.Spot.Left },
              new go.Binding('text', 'subtitle'))))),
      ...sidePorts(),
    );
    this.diagram.nodeTemplateMap.set('block', block);
    this.diagram.nodeTemplate = block;

    const part = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, resizeObjectName: 'BODY', ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Panel, 'Auto', body, { name: 'BODY' }, sizeBind(),
        $(go.Shape, 'RoundedRectangle', { parameter1: 10, fill: '#ffffff', stroke: '#d2d6dc', strokeWidth: 1.5 }),
        $(go.Panel, 'Table', { margin: 12, minSize: new go.Size(216, 0) },
          $(go.RowColumnDefinition, { column: 0, stretch: go.GraphObject.Horizontal }),
          $(go.Shape, 'Rectangle',
            { row: 0, column: 0, columnSpan: 2, height: 4, strokeWidth: 0, fill: '#1d4ed8', stretch: go.GraphObject.Horizontal, margin: new go.Margin(0, 0, 6, 0) }),
          $(go.TextBlock,
            { row: 1, column: 0, font: '700 13px Roboto, sans-serif', stroke: '#111827', editable: true, alignment: go.Spot.Left },
            new go.Binding('text').makeTwoWay()),
          $(go.Picture, { row: 1, column: 1, rowSpan: 2, width: 48, height: 48, imageStretch: go.GraphObject.Uniform },
            new go.Binding('source', 'img')),
          $(go.TextBlock, { row: 2, column: 0, font: '10.5px Roboto, sans-serif', stroke: '#6b7280', alignment: go.Spot.Left },
            new go.Binding('text', 'supplier')),
          $(go.Panel, 'Vertical', { row: 3, column: 0, columnSpan: 2, alignment: go.Spot.Left, margin: new go.Margin(4, 0, 0, 0) },
            new go.Binding('itemArray', 'specs'),
            { itemTemplate: $(go.Panel, 'Auto', { alignment: go.Spot.Left },
                $(go.TextBlock, { font: '10.5px Roboto, sans-serif', stroke: '#374151', alignment: go.Spot.Left },
                  new go.Binding('text', ''))) }))),
      ...sidePorts(),
    );
    this.diagram.nodeTemplateMap.set('part', part);

    const image = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, resizeObjectName: 'PIC', ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Panel, 'Vertical', body,
        $(go.Picture, { name: 'PIC', width: 120, height: 90, imageStretch: go.GraphObject.Uniform },
          new go.Binding('source', 'img'),
          sizeBind()),
        $(go.TextBlock, { font: '11px Roboto, sans-serif', stroke: '#94a3b8', editable: true, margin: new go.Margin(4, 0, 0, 0) },
          new go.Binding('text').makeTwoWay())),
      ...sidePorts(),
    );
    this.diagram.nodeTemplateMap.set('image', image);

    // Native GoJS figure shape (basic geometry, flowchart, logic gates). The main
    // element is a real go.Shape driven by a `figure` name — resizable, theme-aware
    // fill/stroke, with a centred editable label. Four hover edge-ports for wiring.
    const shape = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, resizeObjectName: 'SHAPE', ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Panel, 'Spot', body,
        $(go.Shape, 'Rectangle',
          { name: 'SHAPE', isPanelMain: true, strokeWidth: 2, fill: '#ffffff', stroke: '#334155',
            minSize: new go.Size(48, 40) },
          new go.Binding('figure', 'figure'),
          sizeBind(),
          new go.Binding('fill', 'fill'),
          new go.Binding('stroke', 'stroke')),
        $(go.TextBlock,
          { editable: true, font: '600 12.5px Roboto, sans-serif', stroke: '#1f2937',
            textAlign: 'center', maxSize: new go.Size(150, NaN), margin: 6 },
          new go.Binding('text').makeTwoWay(),
          new go.Binding('stroke', 'labelColor'))),
      ...sidePorts(),
    );
    this.diagram.nodeTemplateMap.set('shape', shape);

    // Electrical schematic / animated symbols: an SVG picture (from the symbol
    // libraries) with data-driven connection pins. Kept alongside the native
    // GoJS figures so the full component palette and legacy diagrams render.
    const symbol = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, itemTemplate: pinPort, ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      new go.Binding('itemArray', 'ports'),
      $(go.Picture, { isPanelMain: true, imageStretch: go.GraphObject.Fill, background: 'transparent', ...body },
        new go.Binding('source', 'source'),
        new go.Binding('desiredSize', 'size', go.Size.parse)),
      $(go.TextBlock, { alignment: new go.Spot(0.5, 1, 0, 14), alignmentFocus: go.Spot.Top,
        font: '11px Roboto, sans-serif', stroke: '#94a3b8', editable: true },
        new go.Binding('text').makeTwoWay(),
        new go.Binding('stroke', 'labelColor')),
    );
    this.diagram.nodeTemplateMap.set('symbol', symbol);

    const basicSym = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, itemTemplate: pinPort, ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      new go.Binding('itemArray', 'ports'),
      $(go.Picture, { isPanelMain: true, imageStretch: go.GraphObject.Fill, background: 'transparent', ...body },
        new go.Binding('source', 'source'),
        new go.Binding('desiredSize', 'size', go.Size.parse)),
      $(go.TextBlock, { alignment: go.Spot.Center, font: '13px Roboto, sans-serif', stroke: '#1f2937',
        editable: true, maxSize: new go.Size(160, NaN), textAlign: 'center' },
        new go.Binding('text').makeTwoWay(),
        new go.Binding('stroke', 'labelColor')),
    );
    this.diagram.nodeTemplateMap.set('basic', basicSym);

    this.diagram.linkTemplate = $(
      go.Link,
      { routing: go.Link.AvoidsNodes, corner: 8, relinkableFrom: true, relinkableTo: true, reshapable: true, resegmentable: true },
      new go.Binding('routing', 'routing', (r) => r === 'normal' || r === 'smooth' ? go.Link.Normal : go.Link.AvoidsNodes),
      new go.Binding('curve', 'routing', (r) => r === 'smooth' ? go.Link.Bezier : go.Link.None),
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
      next: (types) => { this.blockTypes = this.mergeShapeTypes(types); this.cdr.detectChanges(); },
      error: () => {
        this.status = 'Backend offline — using local palette';
        this.blockTypes = this.mergeShapeTypes([
          { key: 'processor', label: 'Main Processor', color: '#1d4ed8', icon: 'developer_board' },
          { key: 'sensor', label: 'Sensor', color: '#15803d', icon: 'sensors' },
          { key: 'motor', label: 'Motor Control', color: '#b45309', icon: 'rotate_right' },
          { key: 'battery', label: 'Battery / BMS', color: '#a16207', icon: 'battery_charging_full' },
          { key: 'comms', label: 'Comm Module', color: '#6d28d9', icon: 'wifi' },
        ]);
        this.cdr.detectChanges();
      },
    });
  }

  /** Append the native GoJS figures (Shapes / Flowchart / Logic) plus the
   * electrical and animated symbol libraries to the palette. */
  private mergeShapeTypes(types: BlockType[]): BlockType[] {
    const present = new Set(types.map((t) => t.shape).filter(Boolean));
    const add = (entries: [string, string][], cat: string, color: string): BlockType[] =>
      entries.filter(([shape]) => !present.has(shape))
        .map(([shape, label]) => ({ key: shape, label, color, category: cat, shape }));
    const shapes: BlockType[] = SHAPE_DEFS.filter((d) => !present.has(d.key)).map((d) => ({
      key: d.key, label: d.label, color: '#e2e8f0', category: d.category, shape: d.key,
    }));
    const elec = add(Object.keys(ELECTRICAL_SYMBOLS).map((s) => [s, this.symbolLabel(s)]), 'Electrical', '#e2e8f0');
    const anim = add(Object.keys(ANIMATED_SYMBOLS).map((s) => [s, this.symbolLabel(s)]), 'Animated', '#e2e8f0');
    return [...types, ...shapes, ...elec, ...anim];
  }

  get categories(): string[] {
    return [...new Set(this.blockTypes.map((b) => b.category ?? 'Blocks'))];
  }
  byCategory(cat: string): BlockType[] {
    return this.blockTypes.filter((b) => (b.category ?? 'Blocks') === cat);
  }
  get visibleItems(): BlockType[] {
    const q = this.paletteQuery.trim().toLowerCase();
    if (q) return this.blockTypes.filter((b) =>
      b.label.toLowerCase().includes(q) || this.i18n.td(b.label).toLowerCase().includes(q));
    return this.byCategory(this.activeCategory);
  }

  isShape(shape: string | undefined): boolean { return isShapeKey(shape); }
  /** Palette thumbnail (inner SVG) for a native GoJS figure, cached. */
  shapePreview(shape: string): SafeHtml {
    let html = this.previewCache.get(shape);
    if (!html) { html = this.sanitizer.bypassSecurityTrustHtml(shapePreviewInner(shape)); this.previewCache.set(shape, html); }
    return html;
  }

  isElectrical(shape: string): boolean { return shape.startsWith('elec-'); }
  isBasicShape(shape: string): boolean { return isBasic(shape); }
  isIc(shape: string): boolean { return (ELECTRICAL_SYMBOLS[shape]?.texts?.length ?? 0) > 0; }
  symbolViewBox(shape: string): string {
    const def = ELECTRICAL_SYMBOLS[shape] ?? ANIMATED_SYMBOLS[shape];
    return def ? `-4 -4 ${def.width + 8} ${def.height + 8}` : '0 0 100 40';
  }
  symbolPaths(shape: string) { return ELECTRICAL_SYMBOLS[shape]?.paths ?? []; }
  symbolTitleTexts(shape: string) { return (ELECTRICAL_SYMBOLS[shape]?.texts ?? []).filter((t) => t.bold); }
  animatedPreview(shape: string): SafeHtml { return this.cachedSvg(shape, () => partsToSvg(shape)); }
  private cachedSvg(key: string, make: () => string): SafeHtml {
    let html = this.previewCache.get(key);
    if (!html) { html = this.sanitizer.bypassSecurityTrustHtml(make()); this.previewCache.set(key, html); }
    return html;
  }
  private symbolLabel(shape: string): string {
    const k = shape.replace(/^(elec|anim)-/, '');
    const names: Record<string, string> = {
      resistor: 'Resistor', capacitor: 'Capacitor', inductor: 'Inductor', diode: 'Diode', led: 'LED',
      npn: 'NPN Transistor', ground: 'Ground', vdc: 'DC Source', vac: 'AC Source', switch: 'Switch', fuse: 'Fuse',
      pnp: 'PNP Transistor', nmos: 'N-MOSFET', zener: 'Zener Diode', pot: 'Potentiometer', 'cap-pol': 'Polarized Cap',
      cell: 'Battery Cell', opamp: 'Op-Amp', crystal: 'Crystal', pushbutton: 'Push Button', lamp: 'Lamp',
      ammeter: 'Ammeter', voltmeter: 'Voltmeter', motor: 'DC Motor', ic555: '555 Timer IC', lm741: 'LM741 Op-Amp',
      '7805': '7805 Regulator', lm317: 'LM317 Regulator', '7400': '7400 NAND', '7404': '7404 Inverter',
      '74hc595': '74HC595 Shift Reg', l293d: 'L293D Motor Drv', pc817: 'PC817 Optocoupler', mcu: 'ATmega328 MCU',
      esp32: 'ESP32 Module', 'robot-arm': 'Robotic Arm', siren: 'Siren Light', fan: 'Fan', conveyor: 'Conveyor',
      gear: 'Gear Motor', antenna: 'Antenna Tower', pump: 'Pump', 'stack-light': 'Stack Light', piston: 'Piston',
      tank: 'Liquid Tank', drone: 'Drone', 'glow-battery': 'Battery (Charging)', inverter: 'Inverter',
      transformer: 'Transformer', solar: 'Solar Panel', 'wind-turbine': 'Wind Turbine', generator: 'Generator',
      'ev-charger': 'EV Charger', pylon: 'Power Pylon', relay: 'Relay', heater: 'Heater', bulb: 'Bulb',
    };
    return names[k] ?? k;
  }

  /** Label colour for shape captions, tuned to the current canvas theme. */
  private get labelColor(): string { return this.lightCanvas ? '#1f2937' : '#e2e8f0'; }

  /** Fill / stroke / label colours for native shapes on the current canvas theme. */
  private shapeTheme(): { fill: string; stroke: string; labelColor: string } {
    return this.lightCanvas
      ? { fill: '#ffffff', stroke: '#334155', labelColor: '#1f2937' }
      : { fill: 'rgba(148,163,184,0.12)', stroke: '#e2e8f0', labelColor: '#e2e8f0' };
  }

  /** Node data for a palette entry, positioned at `loc`. */
  private nodeDataFor(b: BlockType, loc: go.Point): go.ObjectData {
    const def = shapeDef(b.shape);
    if (def) {
      return {
        category: 'shape', text: def.label, shape: def.key, figure: def.figure,
        size: `${def.w} ${def.h}`, loc: go.Point.stringify(loc), ...this.shapeTheme(),
      };
    }
    const info = symbolInfo(b.shape, !this.lightCanvas);
    if (info) {
      return {
        category: info.basic ? 'basic' : 'symbol', text: b.label, shape: b.shape, source: info.source,
        size: `${info.width} ${info.height}`, loc: go.Point.stringify(loc), labelColor: this.labelColor,
        ports: info.pins.map((p, i) => ({ portId: `p${i}`, spot: `${p.fx} ${p.fy}` })),
      };
    }
    return { category: 'block', text: b.label, subtitle: b.category || 'Module',
      color: b.color || '#1d4ed8', icon: b.icon || 'widgets', loc: go.Point.stringify(loc) };
  }

  /** Recolour native shapes and regenerate symbol pictures for the canvas theme. */
  private retheme(): void {
    if (!this.diagram) return;
    const dark = !this.lightCanvas;
    const theme = this.shapeTheme();
    this.zone.runOutsideAngular(() => this.diagram.commit((d) => {
      d.nodes.each((n) => {
        const data = n.data;
        if (data?.category === 'shape') {
          // Palette shapes follow the theme; imported shapes keep their own colour.
          if (!data.fixedColor) {
            d.model.set(data, 'fill', theme.fill);
            d.model.set(data, 'stroke', theme.stroke);
          }
          d.model.set(data, 'labelColor', theme.labelColor);
          return;
        }
        const shape = data?.shape;
        if (typeof shape !== 'string') return;
        const info = symbolInfo(shape, dark);
        if (!info) return;
        d.model.set(data, 'source', info.source);
        d.model.set(data, 'labelColor', theme.labelColor);
      });
    }, 'retheme'));
  }

  startDrag(b: BlockType, event: DragEvent): void {
    this.draggedBlock = b;
    event.dataTransfer?.setData('text/plain', b.key);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }
  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    const b = this.draggedBlock;
    this.draggedBlock = null;
    if (!b || !this.diagram) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const pt = this.diagram.transformViewToDoc(new go.Point(event.clientX - rect.left, event.clientY - rect.top));
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) =>
      (m as go.GraphLinksModel).addNodeData(this.nodeDataFor(b, pt)), 'add node'));
  }

  /** Cached (not a live getter) so template change-detection stays stable even
   * when the model mutates from collaboration/imports mid-cycle. */
  canvasEmpty = true;
  private updateCanvasEmpty(): void {
    this.canvasEmpty = !this.diagram || this.diagram.model.nodeDataArray.length === 0;
  }

  // ---- selection / properties ----

  private syncSelection(): void {
    const first = this.diagram.selection.first();
    this.selectedNode = first instanceof go.Node ? first : null;
    this.selectedEdge = first instanceof go.Link ? first : null;
    if (this.selectedEdge) this.syncWireDock(this.selectedEdge);
    if (this.selectedNode) {
      const d = this.selectedNode.data;
      const isPart = d.category === 'part';
      this.sel = {
        text: d.text ?? '', color: d.color ?? '#1d4ed8', isPart,
        partNumber: d.partNumber, supplier: d.supplier, quantity: d.quantity,
        details: isPart ? this.partDetails(d.part) : [], specs: isPart ? this.partSpecs(d.part) : [],
      };
    } else {
      this.sel = null;
    }
    this.updateCanvasEmpty();
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
  dataField(key: string): string { return this.selectedNode?.data?.[key] ?? ''; }
  setDataField(key: string, value: string): void { this.setField(key, value); }

  get nodeTypeName(): string {
    const d = this.selectedNode?.data; const shape = d?.shape ?? '';
    if (d?.category === 'part') return 'Catalogue part';
    if (d?.category === 'block') return this.i18n.td('Functional block');
    if (d?.category === 'image') return this.i18n.td('Image');
    const def = shapeDef(shape);
    if (def) return `${this.i18n.td(def.category)} · ${def.label}`;
    if (shape.startsWith('elec-')) return `${this.i18n.td('Electrical')} · ${this.symbolLabel(shape)}`;
    if (shape.startsWith('anim-')) return `${this.i18n.td('Animated')} · ${this.symbolLabel(shape)}`;
    if (isBasic(shape)) return `${this.i18n.td('Shapes')} · ${BASIC_SHAPES[shape]?.label ?? 'Shape'}`;
    return this.i18n.td('Component');
  }
  get defaultCategory(): string {
    const d = this.selectedNode?.data; const shape = d?.shape ?? '';
    const def = shapeDef(shape);
    if (def) return def.category;
    if (shape.startsWith('elec-')) return 'Electrical';
    if (shape.startsWith('anim-')) return 'Animated';
    if (d?.category === 'image') return 'Image';
    return 'Blocks';
  }
  get isPartCard(): boolean { return this.selectedNode?.data?.category === 'part'; }

  private partDetails(part: any): { label: string; value: string }[] {
    if (!part) return [];
    const org = part?.invOrgs?.[0] ?? {}; const avail = org?.avail ?? {};
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
  private partSpecs(part: any): { label: string; value: string }[] {
    const pd = Array.isArray(part?.paramData) ? part.paramData : [];
    return pd.map((p: any) => ({
      label: String(p?.name ?? '').trim(),
      value: [String(p?.val ?? '').trim(), String(p?.uom ?? '').trim()].filter((s) => s && s !== ' ').join(' '),
    })).filter((r: any) => r.label && r.value && !/^not required$/i.test(r.value));
  }

  // ---- wire dock ----

  wireLineDash(): number[] | null { return this.wireStyle === 'solid' ? null : [6, 3]; }
  private applyWire(prop: string, value: any): void {
    if (this.selectedEdge) {
      const data = this.selectedEdge.data;
      this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => m.set(data, prop, value), 'wire ' + prop));
    }
  }
  setWireColor(c: string): void { this.wireColor = c; this.applyWire('color', c); }
  setWireStyle(s: 'flow' | 'dashed' | 'solid'): void {
    this.wireStyle = s;
    this.applyWire('dash', this.wireLineDash());
    this.applyWire('flow', s === 'flow');
  }
  setWireWidth(w: number): void { this.wireWidth = w; this.applyWire('width', w); }
  setWireRouter(r: 'manhattan' | 'normal' | 'smooth'): void { this.wireRouter = r; this.applyWire('routing', r); }
  toggleWirePop(which: 'color' | 'style'): void { this.wirePop = this.wirePop === which ? null : which; }
  deleteSelectedEdge(): void {
    this.zone.runOutsideAngular(() => this.diagram.commandHandler.deleteSelection());
    this.selectedEdge = null; this.cdr.detectChanges();
  }
  private syncWireDock(link: go.Link): void {
    const d = link.data || {};
    this.wireColor = d.color || this.wireColor;
    this.wireWidth = d.width || this.wireWidth;
    this.wireStyle = !d.dash ? 'solid' : (d.flow ? 'flow' : 'dashed');
    this.wireRouter = d.routing || this.wireRouter;
  }

  // ---- editing commands ----

  newDiagram(): void {
    this.suppressAutosave = true;
    this.collab.leave();
    this.zone.runOutsideAngular(() => { this.diagram.model = this.emptyModel(); });
    this.diagramId = null; this.selectedDiagramId = null;
    this.diagramName = 'Untitled diagram';
    this.classification = 'INTERNAL';
    this.linkedProject = null;
    this.status = 'New diagram';
    this.suppressAutosave = false;
    this.syncSelection();
  }

  zoomIn(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.increaseZoom()); }
  zoomOut(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.decreaseZoom()); }
  zoomFit(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.zoomToFit()); }
  zoomReset(): void { this.zone.runOutsideAngular(() => { this.diagram.scale = 1; }); }
  get zoomPct(): number { return this.diagram ? Math.round(this.diagram.scale * 100) : 100; }

  deleteSelection(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.deleteSelection()); this.syncSelection(); }
  undo(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.undo()); }
  redo(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.redo()); }

  toggleCanvasTheme(): void {
    this.lightCanvas = !this.lightCanvas;
    this.canvasRef.nativeElement.classList.toggle('canvas-light', this.lightCanvas);
    this.applyGridTheme();
    this.retheme();
  }

  /** Subtle grid line colour tuned per canvas theme. */
  private applyGridTheme(): void {
    if (!this.diagram || !this.diagram.grid) return;
    const color = this.lightCanvas ? 'rgba(2,6,23,0.06)' : 'rgba(148,163,184,0.10)';
    this.zone.runOutsideAngular(() => this.diagram.grid.elements.each((e) => {
      if (e instanceof go.Shape) e.stroke = color;
    }));
  }
  toggleMinimap(): void {
    this.minimapOpen = !this.minimapOpen;
    this.cdr.detectChanges();
    if (this.minimapOpen && !this.overview) {
      this.zone.runOutsideAngular(() =>
        this.overview = new go.Overview(this.minimapRef.nativeElement, { observed: this.diagram, contentAlignment: go.Spot.Center }));
    }
  }

  private selectedNodes(): go.Node[] {
    const out: go.Node[] = [];
    this.diagram.selection.each((p) => { if (p instanceof go.Node) out.push(p); });
    return out;
  }
  private partNodes(): go.Node[] {
    const out: go.Node[] = [];
    this.diagram.nodes.each((n) => { if (n.data?.category === 'part') out.push(n); });
    return out;
  }
  align(mode: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'middle'): void {
    const nodes = this.selectedNodes(); if (nodes.length < 2) return;
    this.zone.runOutsideAngular(() => this.diagram.commit(() => {
      const rects = nodes.map((n) => n.actualBounds);
      const minX = Math.min(...rects.map((r) => r.x)), maxX = Math.max(...rects.map((r) => r.right));
      const minY = Math.min(...rects.map((r) => r.y)), maxY = Math.max(...rects.map((r) => r.bottom));
      const cX = (minX + maxX) / 2, cY = (minY + maxY) / 2;
      for (const n of nodes) {
        const b = n.actualBounds; let x = b.x, y = b.y;
        if (mode === 'left') x = minX; else if (mode === 'right') x = maxX - b.width; else if (mode === 'center') x = cX - b.width / 2;
        else if (mode === 'top') y = minY; else if (mode === 'bottom') y = maxY - b.height; else if (mode === 'middle') y = cY - b.height / 2;
        n.move(new go.Point(x, y));
      }
    }, 'align'));
  }
  distribute(axis: 'h' | 'v'): void {
    const nodes = this.selectedNodes(); if (nodes.length < 3) return;
    this.zone.runOutsideAngular(() => this.diagram.commit(() => {
      const sorted = [...nodes].sort((a, b) => axis === 'h' ? a.actualBounds.x - b.actualBounds.x : a.actualBounds.y - b.actualBounds.y);
      const start = axis === 'h' ? sorted[0].actualBounds.x : sorted[0].actualBounds.y;
      const end = axis === 'h' ? sorted[sorted.length - 1].actualBounds.x : sorted[sorted.length - 1].actualBounds.y;
      const step = (end - start) / (sorted.length - 1);
      sorted.forEach((n, i) => { const b = n.actualBounds;
        if (axis === 'h') n.move(new go.Point(start + step * i, b.y)); else n.move(new go.Point(b.x, start + step * i)); });
    }, 'distribute'));
  }
  bringToFront(): void {
    this.zone.runOutsideAngular(() => this.diagram.commit(() => {
      let z = 0; this.diagram.nodes.each((n) => { if (n.zOrder != null) z = Math.max(z, n.zOrder); });
      this.selectedNodes().forEach((n) => (n.zOrder = ++z));
    }, 'front'));
  }
  sendToBack(): void {
    this.zone.runOutsideAngular(() => this.diagram.commit(() => {
      let z = 0; this.diagram.nodes.each((n) => { if (n.zOrder != null) z = Math.min(z, n.zOrder); });
      this.selectedNodes().forEach((n) => (n.zOrder = --z));
    }, 'back'));
  }

  // ---- image ----

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result); const c = this.diagram.viewportBounds.center;
      this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => (m as go.GraphLinksModel).addNodeData({
        category: 'image', img: src, text: file.name.replace(/\.[^.]+$/, ''), loc: go.Point.stringify(c), size: '160 120',
      }), 'add image'));
    };
    reader.readAsDataURL(file);
    (event.target as HTMLInputElement).value = '';
  }

  // ---- catalogue parts ----

  private buildPartData(part: any, loc?: go.Point): go.ObjectData {
    const title = part?.arwPartNum?.name || part?.suppPartNum?.name || part?.partKey || 'Part';
    const supplier = part?.supp?.name || part?.mfr?.name || part?.icc?.name || 'Component';
    const byName: Record<string, { val: string; uom: string }> = {};
    for (const p of Array.isArray(part?.paramData) ? part.paramData : [])
      if (p?.name) byName[String(p.name).trim()] = { val: String(p.val ?? '').trim(), uom: String(p.uom ?? '').trim() };
    const spec = (name: string): string => {
      const p = byName[name]; if (!p || !p.val || /^not required$/i.test(p.val)) return '';
      return p.uom && p.uom !== ' ' ? `${p.val} ${p.uom}`.trim() : p.val;
    };
    const supplyMin = spec('Single Supply Voltage (Min)'), supplyMax = spec('Single Supply Voltage (Max)');
    const supply = supplyMin && supplyMax ? `${supplyMin} – ${supplyMax}` : (supplyMin || supplyMax || spec('Single Supply Voltage (Typ)'));
    const pkg = [spec('Pin Count') && `${spec('Pin Count')}-pin`, spec('Package Type')].filter(Boolean).join(' ');
    const org = part?.invOrgs?.[0] ?? {}; const avail = org?.avail ?? {};
    const stock = Number(avail?.totohQty ?? avail?.FOHQty ?? avail?.ACFOHQty ?? 0);
    const lead = part?.leadTime?.arwLT ? String(part.leadTime.arwLT).trim() : '';
    const invLines = [[`Stock ${stock.toLocaleString()}`, lead && `Lead ${lead} wks`].filter(Boolean).join('  ·  '),
      org?.status && `Status: ${org.status}`].filter(Boolean) as string[];
    const specLines = [spec('Type') && `Type: ${spec('Type')}`, supply && `Supply: ${supply}`,
      spec('Number of Channels') && `Channels: ${spec('Number of Channels')}`,
      spec('Operating Temp Range') && `Temp: ${spec('Operating Temp Range')}`, pkg && `Pkg: ${pkg}`].filter(Boolean) as string[];
    const urls: any[] = Array.isArray(part?.urls) ? part.urls : [];
    const imgUrl = urls.find((u) => /image small/i.test(u?.type))?.URL || urls.find((u) => /image/i.test(u?.type))?.URL || '';
    return { category: 'part', text: title, supplier, img: imgUrl, specs: [...invLines, ...specLines].slice(0, 4),
      part, partNumber: title, quantity: 1, loc: loc ? go.Point.stringify(loc) : undefined };
  }
  addPartToCanvas(part: any): void {
    const c = this.diagram.viewportBounds.center;
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) =>
      (m as go.GraphLinksModel).addNodeData(this.buildPartData(part, c)), 'add part'));
    this.notify.success(`Added "${part?.arwPartNum?.name || part?.suppPartNum?.name || 'part'}"`);
  }
  private partNumberOfData(d: any): string | null {
    if (!d || d.category !== 'part') return null;
    return d.part?.arwPartNum?.name || d.part?.suppPartNum?.name || d.partNumber || null;
  }

  // ---- BOM / AI / lifecycle / feedback / project ----

  exportBom(): void {
    const parts = this.partNodes().map((n) => ({ ...n.data.part, __bomQty: n.data.quantity || 1 })).filter((p) => p && Object.keys(p).length > 1);
    if (!parts.length) { this.notify.info('No catalogue parts on the canvas to build a BOM from. Search and add parts first.'); return; }
    this.bomRows = this.bomService.build(parts);
  }
  closeBom(): void { this.bomRows = null; }

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
    this.recsOpen = false; this.partSearchSeed = q; this.partSearchOpen = false;
    setTimeout(() => { this.partSearchOpen = true; }, 0);
    this.notify.info(`Catalogue options for "${q}" — choose a supplier and add.`);
  }

  openDesignReview(): void {
    const blocks: ReviewBlock[] = []; const keyToName = new Map<go.Key, string>();
    this.diagram.nodes.each((n) => {
      const d = n.data; if (d.category === 'image') return;
      const name = String(d.text || '').trim(); keyToName.set(n.key, name);
      if (name) blocks.push({ name, type: String(d.shape || d.category || '') });
    });
    const links: ReviewLink[] = [];
    this.diagram.links.each((l) => {
      const from = keyToName.get(l.fromNode?.key ?? '') || '', to = keyToName.get(l.toNode?.key ?? '') || '';
      if (from && to) links.push({ from, to });
    });
    if (!blocks.length) { this.notify.info('Add some blocks to the canvas first, then run a design review.'); return; }
    const goal = this.diagramName && this.diagramName !== 'Untitled diagram' ? this.diagramName : '';
    this.reviewResult = null; this.reviewLoading = true; this.reviewOpen = true;
    this.reviewApi.review(goal, blocks, links).subscribe({
      next: (res) => { this.reviewResult = res; this.reviewLoading = false; },
      error: () => { this.reviewLoading = false; this.reviewOpen = false; },
    });
  }

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

  /** Open the Design Win explorer, optionally seeding the POS tab with a part. */
  openDesignWin(seedPart = ''): void {
    this.designWinSeed = seedPart;
    this.designWinOpen = false;
    setTimeout(() => { this.designWinOpen = true; this.cdr.detectChanges(); }, 0);
  }
  /** POS ("field-proven") check for the selected catalogue part. */
  checkSelectedPos(): void {
    const pn = this.selectedNode ? this.partNumberOfData(this.selectedNode.data) : null;
    if (pn) this.openDesignWin(pn); else this.notify.info('Select a catalogue part first.');
  }
  onAddAlternative(alt: AlternativePart): void {
    this.addPartToCanvas({ arwPartNum: { name: alt.partNumber }, suppPartNum: { name: alt.partNumber },
      supp: { name: alt.manufacturer }, mfr: { name: alt.manufacturer }, invOrgs: [{ desc: alt.note }],
      paramData: [{ name: 'Type', val: alt.dropIn ? 'Drop-in alternative' : 'Approved substitute' }] });
  }

  openFeedback(): void { this.feedbackOpen = true; }
  onSubmitFeedback(req: FeedbackRequest): void {
    this.feedbackSubmitting = true;
    this.feedbackApi.submit({ ...req, diagramId: this.diagramId ?? undefined }).subscribe({
      next: () => { this.feedbackSubmitting = false; this.feedbackOpen = false; this.notify.success('Thanks! Your feedback was sent.'); },
      error: () => { this.feedbackSubmitting = false; this.notify.error('Could not send feedback. Please try again.'); },
    });
  }

  onAttachProject(project: ProjectDetail): void {
    this.linkedProject = project; this.projectPanelOpen = false;
    this.notify.success(`Linked to ${project.id} · ${project.customer}`);
  }
  onAddProjectPart(part: ProjectPart): void {
    this.addPartToCanvas({ arwPartNum: { name: part.partNumber }, suppPartNum: { name: part.partNumber },
      supp: { name: part.manufacturer }, mfr: { name: part.manufacturer }, invOrgs: [{ desc: part.description }], paramData: [] });
  }

  // ---- versions / comments / templates / export dialog ----

  get currentContentJson(): string { return this.diagram ? this.diagram.model.toJson() : ''; }
  openVersions(): void {
    if (this.diagramId == null) { this.notify.info('Save the diagram first to use version history.'); return; }
    this.versionsOpen = true;
  }
  onRestoreVersion(contentJson: string): void { this.applyContent(contentJson); this.zone.runOutsideAngular(() => this.diagram.commandHandler.zoomToFit()); }

  toggleComments(): void {
    if (!this.commentsOpen && this.diagramId == null) { this.notify.info('Save the diagram first to add comments.'); return; }
    this.commentsOpen = !this.commentsOpen;
  }
  get diagramIdValue(): number { return this.diagramId ?? 0; }
  get selectedNodeId(): string | null { return this.selectedNode ? String(this.selectedNode.key) : null; }
  get selectedNodeLabel(): string { const d = this.selectedNode?.data; return d ? (d.text || d.shape || d.category || 'block') : ''; }
  onFocusNode(nodeId: string): void {
    const node = this.diagram.findNodeForKey(this.coerceKey(nodeId));
    if (node) this.zone.runOutsideAngular(() => { this.diagram.select(node); this.diagram.centerRect(node.actualBounds); });
    else this.notify.info('That block is no longer on the canvas.');
  }
  private coerceKey(raw: string): go.Key { const n = Number(raw); return raw !== '' && !isNaN(n) ? n : raw; }

  openTemplates(): void { this.templatesOpen = true; }
  onUseTemplate(detail: TemplateDetail): void {
    this.templatesOpen = false; this.newDiagram(); this.diagramName = detail.name || 'From template';
    this.applyContent(detail.contentJson); this.zone.runOutsideAngular(() => this.diagram.commandHandler.zoomToFit());
  }
  onImproveTemplate(detail: TemplateDetail): void {
    this.templatesOpen = false; this.applyContent(detail.contentJson); this.diagramName = detail.name || this.diagramName;
    this.notify.info('Loaded template content — edit and save as a new diagram or template.');
  }

  openExport(format: 'png' | 'svg'): void {
    this.exportFormat = format; this.exportNodes = [];
    this.diagram.nodes.each((n) => this.exportNodes.push({ id: String(n.key), label: n.data?.text || n.data?.shape || 'node', visible: !this.exportHidden.has(String(n.key)) }));
    this.exportOpen = true;
  }
  onExportToggle(nodeId: string): void {
    if (this.exportHidden.has(nodeId)) this.exportHidden.delete(nodeId); else this.exportHidden.add(nodeId);
    this.applyHidden();
    this.exportNodes = this.exportNodes.map((n) => n.id === nodeId ? { ...n, visible: !this.exportHidden.has(nodeId) } : n);
  }
  showAllHidden(): void { this.exportHidden.clear(); this.applyHidden(); this.exportNodes = this.exportNodes.map((n) => ({ ...n, visible: true })); }
  private applyHidden(): void {
    this.zone.runOutsideAngular(() => this.diagram.commit(() =>
      this.diagram.nodes.each((n) => this.diagram.model.set(n.data, 'hidden', this.exportHidden.has(String(n.key)))), 'toggle hidden'));
  }
  runExport(format: 'png' | 'svg'): void { this.exportOpen = false; if (format === 'png') this.exportPng(); else this.exportSvg(); }

  // ---- saved files / classification / reviews / delete ----

  refreshList(): void { this.diagrams.list().subscribe({ next: (l) => { this.savedDiagrams = l; this.cdr.detectChanges(); }, error: () => {} }); }
  get selectedDiagramName(): string { return this.savedDiagrams.find((d) => d.id === this.selectedDiagramId)?.name ?? ''; }
  load(): void {
    if (this.selectedDiagramId == null) { this.newDiagram(); return; }
    this.doLoad(this.selectedDiagramId);
  }
  cycleClassification(): void {
    const i = this.classificationLevels.indexOf(this.classification);
    this.classification = this.classificationLevels[(i + 1) % this.classificationLevels.length];
    this.notify.info(`Classification set to ${this.classification}. Save to apply.`);
  }
  classificationClass(level: Classification = this.classification): string {
    return level === 'RESTRICTED' ? 'restricted' : level === 'PUBLIC' ? 'public' : 'internal';
  }
  openReviews(d: DiagramSummary, event?: Event): void { event?.stopPropagation(); this.reviewTarget = d; this.openMenuOpen = false; }
  askDeleteDiagram(d: DiagramSummary, event?: Event): void { event?.stopPropagation(); this.pendingDelete = d; }
  cancelDelete(): void { this.pendingDelete = null; }
  get deleteMessage(): string { return `"${this.pendingDelete?.name}" will be permanently deleted. This can't be undone.`; }
  confirmDelete(): void {
    const target = this.pendingDelete; this.pendingDelete = null;
    if (!target) return;
    this.diagrams.delete(target.id).subscribe({
      next: () => {
        this.refreshList();
        if (this.diagramId === target.id) this.newDiagram();
        this.notify.success('Diagram deleted.');
      },
      error: () => this.notify.error('Could not delete that diagram.'),
    });
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
      { label: 'Design Win explorer', icon: 'emoji_events', run: () => this.openDesignWin() },
      { label: 'Field-proven check (POS)', icon: 'verified', run: () => this.checkSelectedPos() },
      { label: 'Project workspace', icon: 'work', run: () => (this.projectPanelOpen = true) },
      { label: 'Check part lifecycle', icon: 'fact_check', run: () => this.checkSelectedLifecycle() },
      { label: 'Version history', icon: 'history', run: () => this.openVersions() },
      { label: 'Comments', icon: 'comment', run: () => this.toggleComments() },
      { label: 'Bring to front', icon: 'flip_to_front', run: () => this.bringToFront() },
      { label: 'Send to back', icon: 'flip_to_back', run: () => this.sendToBack() },
      { label: 'Align left', icon: 'align_horizontal_left', run: () => this.align('left') },
      { label: 'Distribute horizontally', icon: 'horizontal_distribute', run: () => this.distribute('h') },
      { label: 'Zoom to fit', icon: 'fit_screen', run: () => this.zoomFit() },
      { label: 'Toggle minimap', icon: 'map', run: () => this.toggleMinimap() },
      { label: 'Export as PNG', icon: 'image', run: () => this.openExport('png') },
      { label: 'Export as SVG', icon: 'shape_line', run: () => this.openExport('svg') },
      { label: 'Export as JSON', icon: 'data_object', run: () => this.exportJson() },
      { label: 'Export to draw.io', icon: 'account_tree', run: () => this.exportDrawioFile() },
      { label: 'Bill of Materials (CSV)', icon: 'receipt_long', run: () => this.exportBom() },
      { label: 'Send feedback', icon: 'feedback', run: () => this.openFeedback() },
    ];
  }

  // ---- persistence ----

  save(then?: () => void): void {
    const dto: any = { name: this.diagramName || 'Untitled diagram', contentJson: this.diagram.model.toJson(), classification: this.classification };
    if (this.diagramId) dto.id = this.diagramId;
    this.saving = true;
    const done = (d: any) => {
      this.saving = false;
      if (d?.id) { this.diagramId = d.id; this.selectedDiagramId = d.id; }
      this.status = 'Saved'; this.joinCollab(); this.refreshList(); this.cdr.detectChanges(); then?.();
    };
    if (this.diagramId) this.diagrams.update(this.diagramId, dto).subscribe({ next: done, error: () => this.onSaveError() });
    else this.diagrams.create(dto).subscribe({ next: done, error: () => this.onSaveError() });
  }
  private onSaveError(): void { this.saving = false; this.notify.error('Could not save the diagram.'); this.cdr.detectChanges(); }

  private doLoad(id: number): void {
    this.diagrams.get(id).subscribe({
      next: (dto) => {
        this.diagramName = dto.name; this.diagramId = dto.id ?? id; this.selectedDiagramId = dto.id ?? id;
        this.classification = dto.classification ?? 'INTERNAL';
        this.applyContent(dto.contentJson); this.joinCollab();
      },
      error: () => this.notify.error('Could not open that diagram.'),
    });
  }
  private applyContent(contentJson: string): void {
    if (!contentJson) { this.newDiagram(); return; }
    let parsed: any; try { parsed = JSON.parse(contentJson); } catch { parsed = null; }
    // Legacy X6 diagrams ({cells:[...]}) are converted to the GoJS model.
    if (parsed && Array.isArray(parsed.cells)) {
      const { nodes, links } = this.convertX6(parsed.cells);
      this.suppressAutosave = true;
      this.zone.runOutsideAngular(() => {
        const gm = this.emptyModel();
        gm.nodeDataArray = nodes; gm.linkDataArray = links;
        this.diagram.model = gm;
        this.diagram.commandHandler.zoomToFit();
      });
      this.suppressAutosave = false;
      this.retheme();
      this.syncSelection();
      return;
    }
    this.suppressAutosave = true;
    this.zone.runOutsideAngular(() => {
      try {
        const model = go.Model.fromJson(contentJson) as go.GraphLinksModel;
        model.linkFromPortIdProperty = 'fromPort'; model.linkToPortIdProperty = 'toPort';
        this.diagram.model = model;
      } catch { this.zone.run(() => this.notify.error('That diagram could not be loaded.')); }
    });
    this.retheme();
    this.suppressAutosave = false;
    this.syncSelection();
  }

  /** Convert a legacy AntV X6 graph.toJSON() ({cells:[...]}) into GoJS data. */
  private convertX6(cells: any[]): { nodes: go.ObjectData[]; links: go.ObjectData[] } {
    const nodes: go.ObjectData[] = [];
    const links: go.ObjectData[] = [];
    for (const c of cells || []) {
      const isEdge = c?.shape === 'edge' || c?.source || c?.target;
      if (isEdge) {
        const from = c.source?.cell ?? (typeof c.source === 'string' ? c.source : null);
        const to = c.target?.cell ?? (typeof c.target === 'string' ? c.target : null);
        if (from && to) links.push({ category: 'link', from, to, fromPort: '', toPort: '' });
        continue;
      }
      const pos = c.position ?? { x: c.x ?? 0, y: c.y ?? 0 };
      const size = c.size ?? { width: c.width ?? 140, height: c.height ?? 60 };
      const loc = go.Point.stringify(new go.Point(pos.x + size.width / 2, pos.y + size.height / 2));
      const a = c.attrs ?? {};
      const key = c.id;
      const shape: string = c.shape ?? '';
      if (shape === 'block-card') {
        nodes.push({ key, category: 'block', loc, text: a.title?.text ?? '',
          color: a.badge?.fill ?? '#1d4ed8', icon: a.icon?.text ?? 'widgets', subtitle: a.subtitle?.text ?? 'Module' });
      } else if (shape === 'part-card') {
        const part = c.data?.part;
        const base = part ? this.buildPartData(part) : { category: 'part', text: a.title?.text ?? 'Part', supplier: a.supplier?.text ?? '', specs: [], quantity: 1 };
        nodes.push({ ...base, key, loc });
      } else if (shape === 'img-node') {
        nodes.push({ key, category: 'image', loc, size: `${size.width} ${size.height}`,
          img: a.img?.['xlink:href'] ?? a.img?.xlinkHref ?? '', text: a.label?.text ?? '' });
      } else {
        const info = symbolInfo(shape);
        if (info) {
          // Electrical / animated / basic symbols → SVG-picture symbol nodes.
          nodes.push({ key, category: info.basic ? 'basic' : 'symbol', shape, source: info.source,
            size: `${info.width} ${info.height}`, loc, text: a.label?.text ?? '',
            ports: info.pins.map((p, i) => ({ portId: `p${i}`, spot: `${p.fx} ${p.fy}` })) });
        } else {
          // Plain rectangles / geometry → native figure carrying the cell's colours.
          const bodyAttr = a.body ?? a.rect ?? {};
          const fill = bodyAttr.fill && bodyAttr.fill !== 'none' ? bodyAttr.fill : null;
          const stroke = bodyAttr.stroke && bodyAttr.stroke !== 'none' ? bodyAttr.stroke : null;
          if (LEGACY_FIGURE[shape] || fill || stroke) {
            const figure = (bodyAttr.rx ?? 0) > 0 ? 'RoundedRectangle' : (LEGACY_FIGURE[shape] ?? 'Rectangle');
            const t = this.shapeTheme();
            nodes.push({ key, category: 'shape', figure, loc, size: `${size.width} ${size.height}`,
              text: a.label?.text ?? '', fill: fill ?? t.fill, stroke: stroke ?? t.stroke,
              labelColor: t.labelColor, fixedColor: !!(fill || stroke) });
          } else {
            nodes.push({ key, category: 'block', loc, text: a.label?.text ?? a.title?.text ?? shape ?? 'Node',
              color: '#64748b', icon: 'crop_square', subtitle: 'Imported' });
          }
        }
      }
    }
    return { nodes, links };
  }
  private scheduleAutosave(): void {
    if (this.suppressAutosave || this.collab.isApplyingRemote) return;
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => this.zone.run(() => { if (this.diagramId) this.save(); }), 1500);
  }

  // ---- export / import ----

  exportPng(): void {
    const data = this.diagram.makeImageData({ background: this.lightCanvas ? '#ffffff' : '#0e0f11', scale: 2, type: 'image/png' });
    if (typeof data === 'string') this.download(data, this.fileName('png'));
  }
  exportSvg(): void {
    const svg = this.diagram.makeSvg({ scale: 1, background: this.lightCanvas ? '#ffffff' : '#0e0f11' });
    if (!svg) return;
    this.download(URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })), this.fileName('svg'));
  }
  exportJson(): void { this.download(URL.createObjectURL(new Blob([this.diagram.model.toJson()], { type: 'application/json' })), this.fileName('gojs.json')); }
  onJsonSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result); let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = null; }
      if (parsed?.partserviceresult?.parts) this.importPartsCatalog(parsed);
      else { this.applyContent(text); this.status = `Imported "${file.name}"`; }
      this.cdr.detectChanges();
    };
    reader.readAsText(file); (event.target as HTMLInputElement).value = '';
  }
  private importPartsCatalog(data: any): void {
    const parts = data.partserviceresult.parts as any[]; const cols = Math.max(1, Math.min(parts.length, 4));
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => parts.forEach((part, i) =>
      (m as go.GraphLinksModel).addNodeData(this.buildPartData(part, new go.Point(40 + (i % cols) * 280, 40 + Math.floor(i / cols) * 180)))), 'import catalog'));
    this.status = `Imported ${parts.length} part${parts.length === 1 ? '' : 's'} from catalog`;
  }

  onDrawioSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
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
      } catch (err: any) { this.status = `draw.io import failed: ${err?.message || err}`; }
      this.cdr.detectChanges();
    };
    reader.readAsText(file); (event.target as HTMLInputElement).value = '';
  }
  exportDrawioFile(): void {
    this.download(URL.createObjectURL(new Blob([exportDrawio(this.diagram, this.diagramName || 'diagram')], { type: 'application/xml' })), this.fileName('drawio'));
  }

  private fileName(ext: string): string { return (this.diagramName || 'diagram').replace(/[^\w.-]+/g, '_') + '.' + ext; }
  private download(href: string, filename: string): void {
    const a = document.createElement('a'); a.href = href; a.download = filename; a.click();
    if (href.startsWith('blob:')) URL.revokeObjectURL(href);
  }
}
