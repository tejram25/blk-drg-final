import {
  AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy,
  OnInit, ViewChild,
} from '@angular/core';
import { CommonModule, Location } from '@angular/common';
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
import { ChatMessage, GojsCollabService } from '../../core/services/gojs-collab.service';
import { BomRow, BomService } from '../../core/services/bom.service';
import {
  RecommendationItem, RecommendationResult, RecommendationService,
} from '../../core/services/recommendation.service';
import {
  DesignReviewResult, DesignReviewService, ReviewBlock, ReviewLink,
} from '../../core/services/design-review.service';
import { AlternativePart, LifecycleInfo, LifecycleService } from '../../core/services/lifecycle.service';
import { FeedbackRequest, FeedbackService } from '../../core/services/feedback.service';
import { FeedbackLoopService } from '../../core/services/feedback-loop.service';
import { ImageDiagramResult, ImageDiagramService } from '../../core/services/image-diagram.service';
import { BoxSuggestion, BoxSuggestionService, LinkedComponent } from '../../core/services/box-suggestion.service';
import { forkJoin, of, Subscription, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { SystemService } from '../../core/services/system.service';
import { ProjectDetail, ProjectPart } from '../../core/services/integration.service';
import { DesignWinContext } from '../../core/services/designwin.service';
import { TemplateDetail } from '../../core/services/template.service';
import { TranslateService } from '../../core/services/i18n/translate.service';
import { TranslatePipe } from '../../core/services/i18n/translate.pipe';
import { exportDrawio, importDrawio } from './gojs-drawio';
import {
  SHAPE_DEFS, shapeDef, isShapeKey, registerShapeFigures, shapePreviewInner,
} from './gojs-shapes';
import { LEGACY_FIGURE } from './gojs-legacy';
import { animFrameSources, symbolInfo } from './gojs-symbols';
import { BASIC_SHAPES, isBasic } from '../editor/basic-shapes';
import { ELECTRICAL_SYMBOLS, elecMeta, elecPinName } from '../editor/electrical-shapes';
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
import { FeedbackLoopPanelComponent } from '../editor/components/feedback-loop-panel/feedback-loop-panel.component';
import { TemplatesDialogComponent } from '../editor/components/templates-dialog/templates-dialog.component';
import { ExportDialogComponent, ExportNode } from '../editor/components/export-dialog/export-dialog.component';
import { ReviewsDialogComponent } from '../editor/components/reviews-dialog/reviews-dialog.component';
import { ReviewService, ReviewSummary } from '../../core/services/review.service';
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
        FeedbackLoopPanelComponent,
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
  @ViewChild('imageGenInput') imageGenInput!: ElementRef<HTMLInputElement>;

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

  // ---- mobile / responsive ----
  /** ≤768px: bottom app bar + sheet panels replace the desktop chrome. */
  isMobile = false;
  /** The mobile "More" bottom sheet (everything that isn't in the app bar). */
  mobileMoreOpen = false;
  private mobileMq?: MediaQueryList;
  private mobileMqListener?: (e: MediaQueryListEvent) => void;
  /** Tap-to-connect mode (mobile): tap one component, then another, to wire them. */
  connectMode = false;
  private connectFrom: go.Node | null = null;
  /** Template-safe read of whether a first component has been picked. */
  get connectArmed(): boolean { return !!this.connectFrom; }

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
  feedbackLoopOpen = false; feedbackLoopCount = 0;
  recsOpen = false; recsLoading = false; recsResult: RecommendationResult | null = null;
  reviewOpen = false; reviewLoading = false; reviewResult: DesignReviewResult | null = null;
  bomRows: BomRow[] | null = null;
  lifecycleOpen = false; lifecycleLoading = false; lifecycleInfo: LifecycleInfo | null = null;
  feedbackOpen = false; feedbackSubmitting = false;
  projectPanelOpen = false; linkedProject: ProjectDetail | null = null;
  designWinContext: DesignWinContext | null = null;
  versionsOpen = false;
  commentsOpen = false;
  templatesOpen = false;
  exportOpen = false; exportFormat: 'png' | 'svg' = 'png'; exportNodes: ExportNode[] = [];
  private exportHidden = new Set<string>();
  commandPaletteOpen = false;
  imageGenLoading = false;
  /** Message shown under the AI spinner overlay (the action varies). */
  imageGenMessage = 'Reading your diagram…';
  /** Whether the server's local AI (Ollama) is on. Assume on until told
   * otherwise so a failed status fetch never wrongly blocks a working feature. */
  aiEnabled = true;
  /** Tooltip for AI-only actions when the server has AI turned off. */
  readonly aiOffTip = 'AI is turned off on the server. Set OLLAMA_ENABLED=true (and pull a vision model) to use this.';
  // per-box AI component suggestion
  boxSuggestLoading = false;
  boxSuggestions: BoxSuggestion[] = [];
  boxSuggestError = '';
  selectedSupplier: Record<string, string> = {};

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
    private reviewSvc: ReviewService,
    private lifecycleApi: LifecycleService,
    private feedbackApi: FeedbackService,
    private feedbackLoop: FeedbackLoopService,
    private imageDiagram: ImageDiagramService,
    private system: SystemService,
    private boxSuggest: BoxSuggestionService,
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
  ) {}

  /** Keep the URL in sync with the open diagram so a refresh reopens it. */
  private syncUrl(): void {
    this.location.replaceState(this.diagramId != null ? `/editor/${this.diagramId}` : '/editor');
  }

  ngOnInit(): void {
    this.loadPalette();
    this.refreshList();
    // Mobile layout: track the breakpoint live (rotation, window resize).
    this.mobileMq = window.matchMedia('(max-width: 768px)');
    this.applyMobile(this.mobileMq.matches);
    this.mobileMqListener = (e) => this.zone.run(() => { this.applyMobile(e.matches); this.cdr.detectChanges(); });
    this.mobileMq.addEventListener('change', this.mobileMqListener);
    // Learn whether the server's local AI is on, to gate AI-only actions.
    this.system.info().subscribe({
      next: (i) => { this.aiEnabled = i.aiEnabled !== false; this.cdr.detectChanges(); },
      error: () => {}, // leave aiEnabled=true; the action still errors clearly if used
    });
    // Live chat: badge + toast for messages that arrive while the dock is closed.
    this.chatSub = this.collab.chatNew$.subscribe((m) => this.onChatArrived(m));
  }

  /** Entering phone layout: start with the canvas, not an open drawer. */
  private applyMobile(matches: boolean): void {
    if (this.isMobile === matches) return;
    this.isMobile = matches;
    if (matches) { this.paletteOpen = false; this.propsOpen = false; }
    else {
      this.paletteOpen = true; this.propsOpen = true; this.mobileMoreOpen = false;
      if (this.connectMode) this.toggleConnectMode();   // connect mode is mobile-only
    }
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.initDiagram());
    const id = this.route.snapshot.paramMap.get('id');
    if (id) { this.selectedDiagramId = Number(id); this.doLoad(Number(id)); }
  }

  ngOnDestroy(): void {
    if (this.mobileMq && this.mobileMqListener) this.mobileMq.removeEventListener('change', this.mobileMqListener);
    this.chatSub?.unsubscribe();
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
    if (this.diagramId == null) return;
    const room = String(this.diagramId);
    // Already live in THIS diagram's room → nothing to do. But if a different
    // diagram was opened, we must re-join: staying in the old room leaves the
    // outbound listener on a discarded model (edits stop syncing) and would
    // apply the old room's remote events to the wrong canvas.
    if (this.collab.active && this.collab.currentRoom === room) return;
    const u = this.auth.user();
    const name = u?.name || u?.email || 'You';
    const uid = u?.email || `anon-${Math.random().toString(36).slice(2)}`;
    this.chatUnreadCount = 0; // fresh room, fresh unread baseline
    this.zone.runOutsideAngular(() => this.collab.join(this.diagram, room, name, uid));
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

  toggleChat(): void {
    this.showChat = !this.showChat;
    // Opening OR closing marks everything currently in the room as seen.
    this.chatUnreadCount = 0;
  }
  get chatOpen(): boolean { return this.showChat; }
  /** Live messages from others that arrived while the chat dock was closed
   * (persisted history replayed at join is never counted — only new traffic). */
  private chatUnreadCount = 0;
  private chatSub?: Subscription;
  get chatUnread(): number { return this.showChat ? 0 : this.chatUnreadCount; }
  get unreadChat(): number { return 0; }
  /** A chat message from another participant just arrived in the live session. */
  private onChatArrived(m: ChatMessage): void {
    if (this.showChat) { this.cdr.detectChanges(); return; } // dock open — visible already
    this.chatUnreadCount++;
    const text = (m.text || '').length > 70 ? m.text.slice(0, 67) + '…' : m.text;
    this.notify.info(`💬 ${m.name}: ${text}`);
    this.cdr.detectChanges();
  }
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
    // apply current wire style to newly drawn links; pin-to-pin connections
    // between electrical symbols become schematic wires (solid, no arrowhead)
    // and snap the just-connected part into line so the wire draws straight.
    this.diagram.addDiagramListener('LinkDrawn', (e) => this.styleDrawnLink(e.subject as go.Link));
    this.diagram.addDiagramListener('LinkRelinked', (e) => {
      const link = e.subject as go.Link;
      if (link?.data?.wire) this.straightenWire(link);
    });
    // Mobile tap-to-connect: while connect mode is on, tapping a component picks
    // it, and tapping a second component wires the two together (dragging a thin
    // port with a finger is far too fiddly on touch).
    this.diagram.addDiagramListener('ObjectSingleClicked', (e) => {
      if (!this.connectMode) return;
      const node = e.subject?.part;
      if (node instanceof go.Node) this.zone.run(() => this.onConnectTap(node));
    });
    this.diagram.addDiagramListener('BackgroundSingleClicked', () => {
      if (this.connectMode && this.connectFrom) this.zone.run(() => this.clearConnectArm());
    });
    this.canvasRef.nativeElement.classList.toggle('canvas-light', this.lightCanvas);
    this.startAnimations();
  }

  /** Animated symbols play a pre-rendered SVG frame loop (the palette's CSS
   * keyframes can't run inside a GoJS Picture). Frames are flipped directly on
   * the Picture — never through bound properties like the BODY's two-way
   * `angle`, which would write the model (and flood the collab room) 60×/s. */
  private raf = 0;
  private animFrameCache = new Map<string, string[]>();
  private animFramesFor(shape: string): string[] {
    let f = this.animFrameCache.get(shape);
    if (!f) { f = animFrameSources(shape); this.animFrameCache.set(shape, f); }
    return f;
  }
  private startAnimations(): void {
    let tick = 0;
    const loop = () => {
      tick += 1;
      // Flip every 3rd rAF (~20 fps) — smooth motion at a third of the paints.
      if (tick % 3 === 0 && this.diagram) {
        const frame = tick / 3;
        // These are pure per-frame RENDER mutations (Picture.source, wire dash
        // offset). GoJS records GraphObject property changes in the UndoManager,
        // so without this guard every animation frame injects changes into the
        // user's open transaction — corrupting undo (Ctrl+Z reverts dash offsets,
        // not the actual edit) and bloating it with hundreds of entries.
        const prevSkip = this.diagram.skipsUndoManager;
        this.diagram.skipsUndoManager = true;
        try {
          this.diagram.nodes.each((n) => {
            const shape = n.data?.shape;
            if (typeof shape !== 'string' || !shape.startsWith('anim-')) return;
            const frames = this.animFramesFor(shape);
            if (!frames.length) return;
            const body = n.findMainElement();
            const pic = body instanceof go.Panel ? body.findMainElement() : null;
            if (pic instanceof go.Picture) pic.source = frames[frame % frames.length];
          });
          // "Flowing current" wires: march the dash pattern along flow-style links.
          // strokeDashOffset must be non-negative in GoJS, so run a decreasing
          // positive sawtooth over one dash period (6 + 3) — dashes flow forward.
          const dashOffset = 9 - ((frame * 1.8) % 9);
          this.diagram.links.each((l) => {
            if (l.data?.flow && l.path) l.path.strokeDashOffset = dashOffset;
          });
        } finally {
          this.diagram.skipsUndoManager = prevSkip;
        }
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

  /** Restore a node's pins to their resting look: schematic/basic symbols keep
   * a faint dot on every pin (so connection points are always visible);
   * block/shape side handles rest hidden until hover. */
  private resetPins(node: go.Node): void {
    const c = node.data?.category;
    const rest = c === 'symbol' || c === 'basic' ? 0.45 : 0;
    node.ports.each((p) => { if (p.portId) p.opacity = rest; });
  }

  /**
   * Magnetic pin alignment: if a freshly drawn wire connects two pins that are
   * ALMOST collinear (within {@link ALIGN_SNAP}px), nudge the newly connected
   * part so the pins line up exactly — the wire then renders as one straight
   * run instead of a tiny Z-bend.
   */
  private static readonly ALIGN_SNAP = 14;
  private straightenWire(link: go.Link): void {
    const fp = link.fromPort, tp = link.toPort, tn = link.toNode;
    if (!fp || !tp || !tn || link.fromNode === tn) return;
    const a = fp.getDocumentPoint(go.Spot.Center);
    const b = tp.getDocumentPoint(go.Spot.Center);
    const dx = b.x - a.x, dy = b.y - a.y;
    const T = GojsEditorComponent.ALIGN_SNAP;
    let moveX = 0, moveY = 0;
    if (Math.abs(dy) > 0 && Math.abs(dy) <= T && Math.abs(dx) > T) moveY = -dy;       // near-horizontal run
    else if (Math.abs(dx) > 0 && Math.abs(dx) <= T && Math.abs(dy) > T) moveX = -dx;  // near-vertical run
    if (!moveX && !moveY) return;
    const loc = tn.location.copy();
    loc.x += moveX; loc.y += moveY;
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) =>
      m.set(tn.data, 'loc', go.Point.stringify(loc)), 'align wire'));
  }

  /** Brighten a node's link ports on hover (the body itself stays movable). */
  private hoverPorts(obj: go.GraphObject, on: boolean): void {
    const node = obj.part;
    if (!(node instanceof go.Node)) return;
    if (on) node.ports.each((p) => { if (p.portId) p.opacity = 1; });
    else this.resetPins(node);
  }

  /** Light every pin on the canvas (used while a wire drag is in progress). */
  private showAllPins(on: boolean): void {
    if (!this.diagram) return;
    this.diagram.nodes.each((n) => {
      if (on) n.ports.each((p) => { if (p.portId) p.opacity = 1; });
      else this.resetPins(n);
    });
  }

  /** Reveal a junction dot on every symbol pin where 2+ wires meet (schematic
   * convention), and refresh resting pin dots (connected pins hide theirs). */
  private updateJunctions(): void {
    if (!this.diagram) return;
    this.diagram.nodes.each((n) => {
      const c = n.data?.category;
      if (c !== 'symbol' && c !== 'basic') return;
      n.ports.each((p) => {
        if (!p.portId) return;
        const jct = p.panel?.findObject('JCT');
        if (!jct) return;
        let count = 0;
        n.findLinksConnected(p.portId).each(() => count++);
        jct.opacity = count >= 2 ? 1 : 0;
      });
      this.resetPins(n);
    });
  }

  /** Shared hover tooltip: name, value/type and linked component MPNs. */
  private nodeTip($: typeof go.GraphObject.make): go.Adornment {
    return $('ToolTip',
      { 'Border.fill': '#1d1e23', 'Border.stroke': '#34353c' } as any,
      $(go.TextBlock,
        { margin: 7, font: '11px Roboto, sans-serif', stroke: '#ececef', maxSize: new go.Size(260, NaN) },
        new go.Binding('text', '', (d: any) => this.tooltipFor(d)))) as go.Adornment;
  }

  /** Tooltip body for any node's data. */
  private tooltipFor(d: any): string {
    const lines: string[] = [];
    if (d.category === 'part') {
      lines.push(d.text || 'Part');
      if (d.supplier) lines.push(d.supplier);
    } else if (d.category === 'symbol' && String(d.shape || '').startsWith('elec-')) {
      lines.push(`${d.text || ''} — ${this.symbolLabel(d.shape)}`.replace(/^ — /, ''));
      if (d.value) lines.push(`Value: ${d.value}`);
    } else {
      lines.push(d.text || d.shape || 'Block');
      if (d.sub || d.subtitle) lines.push(d.sub || d.subtitle);
    }
    // Show attached parts (new multi-part approach)
    const attachedParts = Array.isArray(d.attachedParts) ? d.attachedParts : [];
    if (attachedParts.length) {
      const partNames = attachedParts.map((ap: any) => {
        const pn = ap.part?.arwPartNum?.name || ap.part?.suppPartNum?.name || 'Part';
        return `${pn} (×${ap.quantity})`;
      });
      lines.push(`Attached Parts (${attachedParts.length}):`);
      lines.push(...partNames);
    }
    // Show old-style linked components (AI suggestions)
    const comps = Array.isArray(d.components) ? d.components : [];
    if (comps.length) lines.push(`AI Components: ${comps.map((c: any) => c.partNumber).join(', ')}`);
    return lines.filter(Boolean).join('\n');
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
    // Wires must LEAVE a pin outward (a left-edge pin exits left, a top pin exits
    // up…); without a directional spot the router may run the first segment back
    // across the symbol body. Derive the exit side from the pin's spot fraction.
    const sideSpot = (s: string) => {
      const sp = go.Spot.parse(s);
      const dl = sp.x, dr = 1 - sp.x, dt = sp.y, db = 1 - sp.y;
      const m = Math.min(dl, dr, dt, db);
      return m === dl ? go.Spot.Left : m === dr ? go.Spot.Right : m === dt ? go.Spot.Top : go.Spot.Bottom;
    };
    // Data-driven pin port for schematic / basic symbol shapes. Pins stay faintly
    // visible so users can see where wires attach; they brighten on hover and
    // while a wire is being dragged (showAllPins). The JCT dot is revealed by
    // updateJunctions() wherever 2+ wires meet on a pin.
    const pinPort = $(
      go.Panel, 'Spot',
      new go.Binding('alignment', 'spot', go.Spot.parse),
      $(go.Shape, 'Circle',
        { desiredSize: new go.Size(11, 11), fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 1.5,
          cursor: 'crosshair', opacity: 0.45, fromLinkable: true, toLinkable: true },
        new go.Binding('portId', 'portId'),
        new go.Binding('fromSpot', 'spot', sideSpot),
        new go.Binding('toSpot', 'spot', sideSpot)),
      $(go.Shape, 'Circle',
        { name: 'JCT', desiredSize: new go.Size(7, 7), fill: '#94a3b8', strokeWidth: 0,
          opacity: 0, pickable: false }),
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
      { locationSpot: go.Spot.Center, resizable: true, resizeObjectName: 'BODY', toolTip: this.nodeTip($), ...hover },
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
      { locationSpot: go.Spot.Center, resizable: true, resizeObjectName: 'BODY', toolTip: this.nodeTip($), ...hover },
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
      { locationSpot: go.Spot.Center, resizable: true, resizeObjectName: 'SHAPE', toolTip: this.nodeTip($), ...hover },
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
          new go.Binding('stroke', 'labelColor')),
        // Linked-component chip (top-right): part number when one is linked, or a
        // count when several are.
        $(go.Panel, 'Auto', { alignment: go.Spot.TopRight, alignmentFocus: go.Spot.TopRight, margin: 3, visible: false },
          new go.Binding('visible', 'components', (c) => Array.isArray(c) && c.length > 0),
          $(go.Shape, 'RoundedRectangle', { parameter1: 4, fill: '#f5a623', stroke: null }),
          $(go.TextBlock, { font: '700 9px Roboto, sans-serif', stroke: '#1a1303', margin: new go.Margin(1, 5, 1, 5) },
            new go.Binding('text', 'components',
              (c) => !Array.isArray(c) || !c.length ? '' : (c.length === 1 ? c[0].partNumber : c.length + ' parts'))))),
      // Role caption below the box (e.g. "Digital Processing"). Follows the canvas
      // theme (capColor), independent of the label colour inside a coloured box.
      $(go.TextBlock, { alignment: new go.Spot(0.5, 1, 0, 7), alignmentFocus: go.Spot.Top,
        font: '10.5px Roboto, sans-serif', stroke: '#94a3b8', editable: true, textAlign: 'center', maxSize: new go.Size(170, NaN) },
        new go.Binding('text', 'sub').makeTwoWay(),
        new go.Binding('stroke', 'capColor'),
        new go.Binding('visible', 'sub', (s) => !!s && String(s).length > 0)),
      ...sidePorts(),
    );
    this.diagram.nodeTemplateMap.set('shape', shape);

    // Electrical schematic / animated symbols: an SVG picture (from the symbol
    // libraries) with data-driven connection pins. NOTE: a panel with an
    // itemArray keeps only its main element + the item panels, so the refdes /
    // value labels live OUTSIDE the port-bearing BODY panel. The node itself is
    // a Spot panel (no itemArray) so the labels can be PLACED AROUND the body:
    // symbols with a centre-bottom pin (sources, flags, ICs with a GND stub)
    // put their labels beside the body so the exiting wire never strikes the
    // text; everything else keeps them underneath.
    // Pin spot fractions ROTATED by the symbol's angle, so label placement keeps
    // avoiding the real wire exits after a 90°/180°/270° rotation.
    const rotatedSpots = (d: any): { x: number; y: number }[] => {
      const ports = Array.isArray(d?.ports) ? d.ports : [];
      const a = ((d?.angle || 0) % 360 + 360) % 360;
      return ports.map((p: any) => {
        const sp = go.Spot.parse(p?.spot || '0 0');
        if (a === 90) return { x: 1 - sp.y, y: sp.x };
        if (a === 180) return { x: 1 - sp.x, y: 1 - sp.y };
        if (a === 270) return { x: sp.y, y: 1 - sp.x };
        return { x: sp.x, y: sp.y };
      });
    };
    // below when the bottom edge is free; beside when only the bottom is busy
    // (sources, flags, grounds); bottom-left quadrant when bottom AND right are
    // busy (ICs, thyristor gates) so no exiting wire ever strikes the text.
    const placement = (d: any): 'below' | 'side' | 'below-left' => {
      const spots = rotatedSpots(d);
      const bottomBusy = spots.some((sp) => sp.y > 0.85 && sp.x > 0.2 && sp.x < 0.8);
      if (!bottomBusy) return 'below';
      return spots.some((sp) => sp.x > 0.85) ? 'below-left' : 'side';
    };
    const labelAlign = (line: number) => (d: any) => {
      const pl = placement(d);
      if (pl === 'side') return new go.Spot(1, 0.5, 7, line === 0 ? -8 : 8);
      return new go.Spot(pl === 'below-left' ? 0.18 : 0.5, 1, 0, 5 + line * 14);
    };
    const labelFocus = (d: any) => placement(d) === 'side' ? go.Spot.Left : go.Spot.Top;
    const symbol = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, locationObjectName: 'BODY', selectionObjectName: 'BODY',
        resizable: true, resizeObjectName: 'BODY',
        toolTip: this.nodeTip($), ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Panel, 'Spot',
        { name: 'BODY', isPanelMain: true, itemTemplate: pinPort, ...body },
        new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify),
        // Legacy 90°-step rotations still render; anything else is junk an old
        // build's animation ticker autosaved into the data — displays as 0°.
        new go.Binding('angle', 'angle', (a) => (typeof a === 'number' && a % 90 === 0 ? a : 0)).makeTwoWay(),
        new go.Binding('itemArray', 'ports'),
        $(go.Picture, { isPanelMain: true, stretch: go.GraphObject.Fill,
          imageStretch: go.GraphObject.Fill, background: 'transparent' },
          new go.Binding('source', 'source'))),
      // Reference designator (R1, C1, U1…); editable in place.
      $(go.TextBlock, { font: 'bold 11px Roboto, sans-serif', stroke: '#94a3b8', editable: true },
        new go.Binding('text').makeTwoWay(),
        new go.Binding('stroke', 'labelColor'),
        new go.Binding('alignment', '', labelAlign(0)),
        new go.Binding('alignmentFocus', '', labelFocus)),
      // Value / part number; hidden when blank.
      $(go.TextBlock, { font: '10px Roboto, sans-serif', stroke: '#94a3b8', editable: true },
        new go.Binding('text', 'value').makeTwoWay(),
        new go.Binding('visible', 'value', (v) => !!v),
        new go.Binding('stroke', 'labelColor'),
        new go.Binding('alignment', '', labelAlign(1)),
        new go.Binding('alignmentFocus', '', labelFocus)),
    );
    this.diagram.nodeTemplateMap.set('symbol', symbol);

    // Basic flowchart shapes keep their centered label by nesting it inside the
    // main element (picture + label), which itemArray panels do retain.
    const basicSym = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, itemTemplate: pinPort, ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      new go.Binding('itemArray', 'ports'),
      $(go.Panel, 'Spot', { isPanelMain: true, stretch: go.GraphObject.Fill, ...body },
        $(go.Picture, { isPanelMain: true, stretch: go.GraphObject.Fill,
          imageStretch: go.GraphObject.Fill, background: 'transparent' },
          new go.Binding('source', 'source')),
        $(go.TextBlock, { alignment: go.Spot.Center, font: '13px Roboto, sans-serif', stroke: '#1f2937',
          editable: true, maxSize: new go.Size(160, NaN), textAlign: 'center' },
          new go.Binding('text').makeTwoWay(),
          new go.Binding('stroke', 'labelColor'))),
    );
    this.diagram.nodeTemplateMap.set('basic', basicSym);

    this.diagram.linkTemplate = $(
      go.Link,
      { routing: go.Link.AvoidsNodes, corner: 8, relinkableFrom: true, relinkableTo: true, reshapable: true, resegmentable: true },
      new go.Binding('routing', 'routing', (r) => r === 'normal' || r === 'smooth' ? go.Link.Normal : go.Link.AvoidsNodes),
      new go.Binding('curve', 'routing', (r) => r === 'smooth' ? go.Link.Bezier : go.Link.None),
      // Schematic wires (pin-to-pin between electrical symbols) bend square.
      new go.Binding('corner', 'wire', (w) => (w ? 0 : 8)),
      // Fat, invisible path that widens the tap/click target — a 2px wire is
      // almost impossible to hit with a finger, so this gives ~18px of slack.
      $(go.Shape, { isPanelMain: true, stroke: 'transparent', strokeWidth: 18 }),
      $(go.Shape, { isPanelMain: true, strokeWidth: 2, stroke: '#94a3b8' },
        new go.Binding('stroke', 'color'),
        new go.Binding('strokeWidth', 'width'),
        new go.Binding('strokeDashArray', 'dash')),
      // …and carry no direction arrow (wires aren't flows).
      $(go.Shape, { toArrow: 'Standard', fill: '#94a3b8', stroke: null },
        new go.Binding('fill', 'color'),
        new go.Binding('visible', 'wire', (w) => !w)),
      // Wire / connection label (net name, signal, "+6V"…). Editable in place;
      // hidden while blank (set it from the selected-wire toolbar).
      $(go.Panel, 'Auto',
        { segmentIndex: NaN, segmentFraction: 0.5, visible: false },
        new go.Binding('visible', 'text', (t) => !!t),
        $(go.Shape, 'RoundedRectangle', { parameter1: 4, fill: 'rgba(14,15,17,0.75)', stroke: null }),
        $(go.TextBlock, { font: '600 10px Roboto, sans-serif', stroke: '#e2e8f0', editable: true,
          margin: new go.Margin(1.5, 5, 1.5, 5) },
          new go.Binding('text').makeTwoWay(),
          new go.Binding('stroke', 'color'))),
    );

    // Junction dots follow the wiring: recompute after every committed change
    // (draw/relink/delete/undo/collab), so they stay correct from any source.
    this.diagram.addModelChangedListener((e) => { if (e.isTransactionFinished) this.updateJunctions(); });

    // Wire-drawing feel: drag an orthogonal wire (not a straight rubber band),
    // show cyan snap rings on the candidate pins, and light every pin on the
    // canvas while the drag is in progress so targets are obvious.
    const styleLinking = (tool: go.LinkingBaseTool) => {
      tool.temporaryLink = $(go.Link,
        { routing: go.Link.Orthogonal, layerName: 'Tool' },
        $(go.Shape, { stroke: '#22d3ee', strokeWidth: 2 }));
      for (const port of [tool.temporaryFromPort, tool.temporaryToPort]) {
        if (!(port instanceof go.Shape)) continue;
        port.figure = 'Circle';
        port.desiredSize = new go.Size(14, 14);
        port.stroke = '#22d3ee';
        port.strokeWidth = 2;
        port.fill = null;
      }
      const act = tool.doActivate.bind(tool);
      const deact = tool.doDeactivate.bind(tool);
      tool.doActivate = () => { act(); this.showAllPins(true); };
      tool.doDeactivate = () => { deact(); this.showAllPins(false); };
    };
    styleLinking(this.diagram.toolManager.linkingTool);
    styleLinking(this.diagram.toolManager.relinkingTool);

    // Subsystem groups: a collapsible dashed container around selected parts
    // (Ctrl+G / command palette). Collapse hides internals — handy when sharing
    // a diagram with non-engineers.
    this.diagram.groupTemplate = $(
      go.Group, 'Auto',
      { locationSpot: go.Spot.Center, ungroupable: true, computesBoundsAfterDrag: true,
        handlesDragDropForMembers: true },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('isSubGraphExpanded', 'expanded').makeTwoWay(),
      $(go.Shape, 'RoundedRectangle',
        { parameter1: 12, fill: 'rgba(148,163,184,0.05)', stroke: '#f5a623',
          strokeWidth: 1.2, strokeDashArray: [7, 4] }),
      $(go.Panel, 'Vertical', { defaultAlignment: go.Spot.Left },
        $(go.Panel, 'Horizontal', { margin: new go.Margin(6, 8, 0, 6) },
          $('SubGraphExpanderButton', { margin: new go.Margin(0, 6, 0, 0) }),
          $(go.TextBlock, { font: 'bold 12px Roboto, sans-serif', stroke: '#f5a623', editable: true },
            new go.Binding('text').makeTwoWay())),
        $(go.Placeholder, { padding: 14 })),
    );
    this.diagram.commandHandler.archetypeGroupData = { isGroup: true, text: 'Subsystem' };
  }

  /** Set the label (net / signal name) on the selected wire. */
  setWireLabel(v: string): void {
    const l = this.selectedEdge;
    if (!l) return;
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => m.set(l.data, 'text', v), 'wire label'));
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
    // The backend still lists the legacy X6 "basic-*" shapes; they're superseded
    // by the native GoJS figures (and have no palette preview → blank cards), so
    // drop them from the palette. Old diagrams that reference them still render.
    const base = types.filter((t) => !(t.shape && t.shape.startsWith('basic-')));
    const present = new Set(base.map((t) => t.shape).filter(Boolean));
    const add = (entries: [string, string][], cat: string, color: string): BlockType[] =>
      entries.filter(([shape]) => !present.has(shape))
        .map(([shape, label]) => ({ key: shape, label, color, category: cat, shape }));
    const shapes: BlockType[] = SHAPE_DEFS.filter((d) => !present.has(d.key)).map((d) => ({
      key: d.key, label: d.label, color: '#e2e8f0', category: d.category, shape: d.key,
    }));
    const elec = add(Object.keys(ELECTRICAL_SYMBOLS).map((s) => [s, this.symbolLabel(s)]), 'Electrical', '#e2e8f0');
    const anim = add(Object.keys(ANIMATED_SYMBOLS).map((s) => [s, this.symbolLabel(s)]), 'Animated', '#e2e8f0');
    return [...base, ...shapes, ...elec, ...anim];
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
      and: 'AND Gate', or: 'OR Gate', not: 'NOT Gate', nand: 'NAND Gate', nor: 'NOR Gate',
      xor: 'XOR Gate', xnor: 'XNOR Gate', buffer: 'Buffer', schottky: 'Schottky Diode',
      photodiode: 'Photodiode', thermistor: 'Thermistor', varistor: 'Varistor', jfet: 'JFET',
      pmos: 'P-MOSFET', battery: 'Battery', isrc: 'Current Source', spdt: 'SPDT Switch',
      speaker: 'Speaker', buzzer: 'Buzzer', mic: 'Microphone', header4: '4-Pin Header',
      conn2: 'Terminal Block', testpoint: 'Test Point', ldr: 'LDR (Photoresistor)',
      bridge: 'Bridge Rectifier', scr: 'SCR (Thyristor)', triac: 'TRIAC', tvs: 'TVS Diode',
      '7seg': '7-Segment Display', comparator: 'LM393 Comparator', usb: 'USB Connector',
      barrel: 'DC Barrel Jack', oled: 'OLED Display', arduino: 'Arduino UNO', stm32: 'STM32 MCU',
      vcc: 'VCC Power Flag', netflag: 'Net Label',
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
      const data: go.ObjectData = {
        category: info.basic ? 'basic' : 'symbol', text: b.label, shape: b.shape, source: info.source,
        size: `${info.width} ${info.height}`, loc: go.Point.stringify(loc), labelColor: this.labelColor,
        ports: info.pins.map((p, i) => ({ portId: `p${i}`, spot: `${p.fx} ${p.fy}` })),
      };
      // Electrical symbols become real parts: auto reference designator + value label.
      if (b.shape?.startsWith('elec-')) {
        const meta = elecMeta(b.shape);
        if (meta.ref) data['text'] = this.nextRefdes(meta.ref);
        // Net flags show their net name instead (rename to join pins by name).
        else if (GojsEditorComponent.NET_FLAG_TEXT[b.shape]) data['text'] = GojsEditorComponent.NET_FLAG_TEXT[b.shape];
        data['value'] = meta.value;
      }
      return data;
    }
    return { category: 'block', text: b.label, subtitle: b.category || 'Module',
      color: b.color || '#1d4ed8', icon: b.icon || 'widgets', loc: go.Point.stringify(loc) };
  }

  /** Default net name shown on a freshly dropped net-flag symbol. */
  private static readonly NET_FLAG_TEXT: Record<string, string> = {
    'elec-vcc': 'VCC', 'elec-netflag': 'NET',
  };

  /** Next free reference designator for a prefix (R → R1, R2…), scanning the canvas. */
  private nextRefdes(prefix: string): string {
    let max = 0;
    const re = new RegExp('^' + prefix + '(\\d+)$');
    this.diagram?.nodes.each((n) => {
      const t = n.data?.text;
      if (typeof t === 'string') { const m = re.exec(t); if (m) max = Math.max(max, +m[1]); }
    });
    return `${prefix}${max + 1}`;
  }

  /** Recolour native shapes and regenerate symbol pictures for the canvas theme. */
  private retheme(): void {
    if (!this.diagram) return;
    const dark = !this.lightCanvas;
    const theme = this.shapeTheme();
    // Re-theming only refreshes DERIVED render props (SVG source, colours) — it
    // is not a user edit, so it must never enter the undo stack. Otherwise the
    // first Ctrl+Z after opening a diagram undoes the retheme and strips every
    // symbol's artwork instead of reverting an actual change.
    this.runSilently(() => this.diagram.commit((d) => {
      d.nodes.each((n) => {
        const data = n.data;
        if (data?.category === 'shape') {
          // Palette shapes follow the theme; colour-imported boxes keep their fill
          // and their contrast label, but the caption under the box tracks the theme.
          d.model.set(data, 'capColor', theme.labelColor);
          if (!data.fixedColor) {
            d.model.set(data, 'fill', theme.fill);
            d.model.set(data, 'stroke', theme.stroke);
            d.model.set(data, 'labelColor', theme.labelColor);
          }
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

  /** Run a model mutation that is a derived/rendering concern (retheme, export
   * masking) so it neither pollutes the undo stack nor autosaves. */
  private runSilently(fn: () => void): void {
    if (!this.diagram) { fn(); return; }
    const prevSkip = this.diagram.skipsUndoManager;
    const prevSuppress = this.suppressAutosave;
    this.diagram.skipsUndoManager = true;
    this.suppressAutosave = true;
    this.zone.runOutsideAngular(() => { try { fn(); } finally {
      this.diagram.skipsUndoManager = prevSkip;
      this.suppressAutosave = prevSuppress;
    } });
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

  /** Mobile: tap a palette item to place it at the viewport centre (HTML5
   * drag-and-drop does not exist on touch). No-op on desktop, where drag wins. */
  tapPlace(b: BlockType): void {
    if (!this.isMobile || !this.diagram) return;
    const pt = this.diagram.viewportBounds.center.copy();
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) =>
      (m as go.GraphLinksModel).addNodeData(this.nodeDataFor(b, pt)), 'add node'));
    this.paletteOpen = false;
    this.notify.success(`${this.i18n.td(b.label)} added to the canvas.`);
  }

  // ---- mobile tap-to-connect ----

  /** Toggle tap-to-connect. While on, node dragging is suspended so a tap picks
   * a component instead of moving it; panning/zoom still work. */
  toggleConnectMode(): void {
    this.connectMode = !this.connectMode;
    this.clearConnectArm();
    if (this.diagram) this.diagram.toolManager.draggingTool.isEnabled = !this.connectMode;
    if (this.connectMode) this.notify.info('Tap a component, then tap another to wire them.');
  }

  private clearConnectArm(): void {
    this.connectFrom = null;
    this.showAllPins(false);
    this.cdr.detectChanges();
  }

  /** A component was tapped while in connect mode. */
  private onConnectTap(node: go.Node): void {
    if (!this.connectFrom) {
      this.connectFrom = node;          // arm: remember the first component
      this.showAllPins(true);           // reveal every pin as a connection hint
      this.diagram.select(node);
      this.cdr.detectChanges();
      return;
    }
    if (node === this.connectFrom) { this.clearConnectArm(); return; }  // tapped same → cancel
    this.connectNodes(this.connectFrom, node);
    this.clearConnectArm();
  }

  /** Wire two components together, joining their nearest pins. */
  private connectNodes(a: go.Node, b: go.Node): void {
    const pair = this.nearestPortPair(a, b);
    if (!pair) { this.notify.error('These components can’t be wired directly.'); return; }
    const data: go.ObjectData = { from: a.key, to: b.key, fromPort: pair.from, toPort: pair.to };
    this.zone.runOutsideAngular(() => {
      this.diagram.model.commit((m) => (m as go.GraphLinksModel).addLinkData(data), 'connect');
      const link = this.diagram.findLinkForData(data);
      if (link) this.styleDrawnLink(link);
    });
    this.notify.success('Wire added.');
  }

  /** Pick the closest linkable-pin pair between two components (least finger
   * work — the wire lands where the components already face each other). */
  private nearestPortPair(a: go.Node, b: go.Node): { from: string; to: string } | null {
    const pinsOf = (n: go.Node): go.GraphObject[] => {
      const out: go.GraphObject[] = [];
      n.ports.each((p) => { if (p.portId) out.push(p); });
      return out;
    };
    const ap = pinsOf(a), bp = pinsOf(b);
    if (!ap.length || !bp.length) return null;
    let best: { from: string; to: string } | null = null;
    let bestD = Infinity;
    for (const pa of ap) {
      const da = pa.getDocumentPoint(go.Spot.Center);
      for (const pb of bp) {
        const d = da.distanceSquaredPoint(pb.getDocumentPoint(go.Spot.Center));
        if (d < bestD) { bestD = d; best = { from: pa.portId!, to: pb.portId! }; }
      }
    }
    return best;
  }

  /** Apply the current wire style to a freshly created link (drawn by drag or by
   * tap-to-connect); pin-to-pin links between electrical symbols become
   * schematic wires and snap straight. */
  private styleDrawnLink(link: go.Link): void {
    const elec = (n: go.Node | null) =>
      !!n && n.data?.category === 'symbol' && String(n.data.shape || '').startsWith('elec-');
    const wire = elec(link.fromNode) && elec(link.toNode);
    this.diagram.model.commit((m) => {
      m.set(link.data, 'color', this.wireColor);
      m.set(link.data, 'width', this.wireWidth);
      m.set(link.data, 'dash', wire || this.wireStyle === 'solid' ? null : [6, 3]);
      m.set(link.data, 'flow', !wire && this.wireStyle === 'flow');
      m.set(link.data, 'routing', this.wireRouter);
      m.set(link.data, 'wire', wire);
    }, 'style link');
    if (wire) this.straightenWire(link);
  }

  /** Cached (not a live getter) so template change-detection stays stable even
   * when the model mutates from collaboration/imports mid-cycle. */
  canvasEmpty = true;
  private updateCanvasEmpty(): void {
    this.canvasEmpty = !this.diagram || this.diagram.model.nodeDataArray.length === 0;
  }

  // ---- selection / properties ----

  private lastSelKey: go.Key | null = null;
  private syncSelection(): void {
    const first = this.diagram.selection.first();
    this.selectedNode = first instanceof go.Node ? first : null;
    this.selectedEdge = first instanceof go.Link ? first : null;
    // Reset AI suggestions when the selected node changes.
    const key = this.selectedNode ? this.selectedNode.key : null;
    if (key !== this.lastSelKey) { this.boxSuggestions = []; this.boxSuggestError = ''; this.lastSelKey = key; }
    if (this.selectedEdge) this.syncWireDock(this.selectedEdge);
    if (this.selectedNode) {
      const d = this.selectedNode.data;
      const isPart = d.category === 'part';
      const hasAttachedPart = d.attachedPart != null;
      // Show part details for both part cards AND blocks with attached parts
      const partToShow = isPart ? d.part : (hasAttachedPart ? d.attachedPart : null);
      this.sel = {
        text: d.text ?? '', color: d.color ?? '#1d4ed8', isPart: isPart || hasAttachedPart,
        partNumber: d.partNumber, supplier: d.supplier, quantity: d.quantity,
        details: partToShow ? this.partDetails(partToShow) : [],
        specs: partToShow ? this.partSpecs(partToShow) : [],
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

  partDetails(part: any): { label: string; value: string }[] {
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
  partSpecs(part: any): { label: string; value: string }[] {
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
    this.syncUrl();
    this.feedbackLoopCount = 0;
    this.diagramName = 'Untitled diagram';
    this.classification = 'INTERNAL';
    this.linkedProject = null;
    this.designWinContext = null;
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

  // ---- generate a block diagram from an image (AI vision) ----

  /** kind keyword (from the vision model) → block icon + accent colour. */
  private static readonly KIND_STYLE: Record<string, { icon: string; color: string }> = {
    processor: { icon: 'developer_board', color: '#1d4ed8' }, mcu: { icon: 'developer_board', color: '#1d4ed8' },
    ai: { icon: 'psychology', color: '#3730a3' }, memory: { icon: 'memory', color: '#0e7490' },
    sensor: { icon: 'sensors', color: '#15803d' }, camera: { icon: 'photo_camera', color: '#166534' },
    motor: { icon: 'rotate_right', color: '#b45309' }, battery: { icon: 'battery_charging_full', color: '#a16207' },
    power: { icon: 'bolt', color: '#a16207' }, dcdc: { icon: 'electrical_services', color: '#c2410c' },
    regulator: { icon: 'electrical_services', color: '#c2410c' }, comms: { icon: 'wifi', color: '#6d28d9' },
    wifi: { icon: 'wifi', color: '#6d28d9' }, antenna: { icon: 'cell_tower', color: '#7c3aed' },
    display: { icon: 'monitor', color: '#0891b2' }, storage: { icon: 'storage', color: '#0e7490' },
    data: { icon: 'storage', color: '#0e7490' }, connector: { icon: 'cable', color: '#64748b' },
    logic: { icon: 'account_tree', color: '#7c3aed' }, input: { icon: 'input', color: '#15803d' },
    output: { icon: 'output', color: '#b45309' }, clock: { icon: 'schedule', color: '#0891b2' },
    amplifier: { icon: 'graphic_eq', color: '#c2410c' }, process: { icon: 'settings', color: '#475569' },
    decision: { icon: 'help', color: '#b45309' }, generic: { icon: 'widgets', color: '#475569' },
  };

  /** Open the file picker to generate a diagram from a photo/screenshot. */
  generateFromImage(): void {
    this.closeMenus();
    // Image-to-diagram has no non-AI fallback, so short-circuit with a clear
    // message when the server has AI off — never open the picker or the overlay.
    if (!this.aiEnabled) { this.notify.info(this.aiOffTip); return; }
    this.imageGenInput?.nativeElement.click();
  }

  onGenerateImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.notify.error('Please choose an image file (PNG, JPG…).'); return; }
    if (!this.aiEnabled) { this.notify.info(this.aiOffTip); return; }
    this.imageGenMessage = 'Reading your diagram…';
    this.imageGenLoading = true;
    this.status = 'Analysing image…';
    this.cdr.detectChanges();
    this.downscaleImage(file).then((dataUrl) => {
      // Client-side safety net: never let the overlay hang if the server stalls.
      this.imageDiagram.extract(dataUrl).pipe(
        timeout(120000),
        catchError((e) => throwError(() => e)),
      ).subscribe({
        next: (res) => { this.imageGenLoading = false; this.applyExtractedDiagram(res); this.cdr.detectChanges(); },
        error: (err) => {
          this.imageGenLoading = false;
          this.status = '';
          const msg = err instanceof TimeoutError
            ? 'The AI took too long to respond. Check that Ollama is running and the model is pulled.'
            : (err?.error?.message || err?.error?.reason || 'Could not generate a diagram from that image.');
          this.notify.error(msg);
          this.cdr.detectChanges();
        },
      });
    }).catch(() => { this.imageGenLoading = false; this.notify.error('Could not read that image.'); this.cdr.detectChanges(); });
  }

  /** Downscale the image (longest side ≤ 1280px) to keep the upload small and the model fast. */
  private downscaleImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('decode failed'));
        img.onload = () => {
          const max = 1280;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(String(reader.result)); return; }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/png'));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  /** Build a live diagram of coloured shapes from the extracted nodes/links. */
  private applyExtractedDiagram(res: ImageDiagramResult): void {
    const stamp = Date.now().toString(36);
    const cap = this.labelColor;
    const idMap = new Map<string, string>();
    const nodes: go.ObjectData[] = (res.nodes || []).map((n) => {
      const key = `img-${stamp}-${n.id}`;
      idMap.set(n.id, key);
      const style = GojsEditorComponent.KIND_STYLE[(n.kind || 'generic').toLowerCase()]
        ?? GojsEditorComponent.KIND_STYLE['generic'];
      const fill = this.normalizeColor(n.color) ?? style.color;
      const loc = go.Point.stringify(new go.Point((n.x ?? 0) * 1.5, (n.y ?? 0) * 1.7));
      // Coloured rounded-rectangle "box" — a real shape node, editable and linkable,
      // that can later carry an AI-suggested component (partNumber chip).
      return { key, category: 'shape', figure: 'RoundedRectangle', shape: 'sh-round',
        text: n.label || this.prettyKind(n.kind), sub: (n.sub && n.sub.trim()) || '',
        kind: (n.kind || 'generic').toLowerCase(), size: '176 62', loc,
        fill, stroke: this.shadeStroke(fill), labelColor: this.contrastText(fill), capColor: cap,
        fixedColor: true };
    });
    const links: go.ObjectData[] = (res.links || [])
      .map((l) => ({ from: idMap.get(l.from), to: idMap.get(l.to), label: l.label }))
      .filter((l) => l.from && l.to)
      .map((l) => ({ category: 'link', from: l.from, to: l.to, fromPort: '', toPort: '',
        color: this.wireColor, width: this.wireWidth, dash: [6, 3], flow: true }));

    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => {
      const gm = m as go.GraphLinksModel;
      nodes.forEach((d) => gm.addNodeData(d));
      links.forEach((d) => gm.addLinkData(d));
    }, 'generate from image'));
    this.zone.runOutsideAngular(() => this.diagram.commandHandler.zoomToFit());
    if (this.canvasEmpty || this.diagramName === 'Untitled diagram') this.diagramName = res.title || 'Imported diagram';
    this.updateCanvasEmpty();
    this.status = `Generated ${nodes.length} box${nodes.length === 1 ? '' : 'es'} from image · ${res.model}`;
    this.notify.success(`Generated ${nodes.length} boxes and ${links.length} connections from your image.`);
  }

  private prettyKind(kind?: string): string {
    if (!kind) return 'Box';
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
  /** Format a unit price for the properties panel (empty when unknown). */
  money(n?: number): string { return n ? '$' + Number(n).toFixed(2) : ''; }

  /** Parse #rgb / #rrggbb / rgb(...) to [r,g,b], or null. */
  private parseColor(color?: string): [number, number, number] | null {
    if (!color) return null;
    const s = color.trim();
    let m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
    m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
    if (m) return [+m[1], +m[2], +m[3]];
    return null;
  }
  private normalizeColor(color?: string): string | null {
    const rgb = this.parseColor(color);
    if (!rgb) return null;
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  }
  /** Readable label colour (dark or white) for text on the given fill. */
  private contrastText(color: string): string {
    const rgb = this.parseColor(color);
    if (!rgb) return '#1f2937';
    const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    return lum > 160 ? '#1f2937' : '#ffffff';
  }
  /** A border colour: a subtle grey on near-white fills, a darker shade otherwise. */
  private shadeStroke(color: string): string {
    const rgb = this.parseColor(color);
    if (!rgb) return '#334155';
    const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
    if (lum > 225) return '#cbd5e1';
    const d = rgb.map((c) => Math.round(c * 0.72));
    return `rgb(${d[0]},${d[1]},${d[2]})`;
  }

  // ---- per-box AI component suggestion (catalogue + Design Win) ----

  /** True for a box node (functional block or shape) that can carry a component. */
  get isBox(): boolean {
    const d = this.selectedNode?.data;
    const c = d?.category;
    // Electrical schematic symbols are components too: they can carry a real MPN.
    return c === 'shape' || c === 'block' || (c === 'symbol' && String(d?.shape || '').startsWith('elec-'));
  }

  /** Ask the AI for the component this box needs (grounded in catalogue + POS). */
  suggestComponent(): void {
    const d = this.selectedNode?.data;
    if (!d) return;
    // Schematic symbols search by value/type (the refdes "R1" is useless as a query).
    const q = this.suggestQueryFor(d);
    this.boxSuggestions = [];
    this.boxSuggestError = '';
    this.boxSuggestLoading = true;
    this.cdr.detectChanges();
    this.boxSuggest.suggest(q.label, q.sub, d.kind || '', this.designWinContext).subscribe({
      next: (res) => {
        this.boxSuggestLoading = false;
        this.boxSuggestions = res.suggestions || [];
        if (!this.boxSuggestions.length) this.boxSuggestError = res.note || 'No component matches found.';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.boxSuggestLoading = false;
        this.boxSuggestError = err?.error?.message || err?.error?.reason || 'Could not suggest a component (is the catalogue reachable?).';
        this.cdr.detectChanges();
      },
    });
  }

  /** Components linked to the selected box (a box can hold several). */
  get boxComponents(): LinkedComponent[] {
    const c = this.selectedNode?.data?.components;
    return Array.isArray(c) ? c : [];
  }

  /** True if the selected box can have a part attached (allows replacement). */
  get canAttachPart(): boolean {
    return this.isBox; // Allow attach for all blocks (empty or with existing part)
  }

  /** Turn a suggestion + chosen supplier into a linked component. */
  private toComponent(s: BoxSuggestion): LinkedComponent {
    const name = this.selectedSupplier[s.partNumber] || s.suppliers?.[0]?.name || s.manufacturer;
    const offer = (s.suppliers || []).find((o) => o.name === name);
    return {
      partNumber: s.partNumber, manufacturer: s.manufacturer, description: s.description,
      supplier: name, suppliers: s.suppliers || [], quantity: 1, fieldProven: s.fieldProven,
      unitPrice: offer?.unitPrice ?? s.unitPrice, moq: offer?.moq ?? s.moq,
    };
  }

  /** Add a component to the given node's components list (deduped by part number). */
  private addComponent(node: go.Node, comp: LinkedComponent): boolean {
    const data = node.data;
    const list: LinkedComponent[] = Array.isArray(data.components) ? [...data.components] : [];
    if (list.some((c) => c.partNumber === comp.partNumber)) return false;
    list.push(comp);
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => m.set(data, 'components', list), 'link component'));
    return true;
  }

  /** Link a suggested component (and chosen supplier) to the selected box. */
  linkSuggestion(s: BoxSuggestion): void {
    if (!this.selectedNode) return;
    const comp = this.toComponent(s);
    const added = this.addComponent(this.selectedNode, comp);
    this.boxSuggestions = [];
    this.notify[added ? 'success' : 'info'](
      added ? `Linked ${comp.partNumber} (${comp.supplier}) to "${this.selectedNode.data.text}".`
            : `${comp.partNumber} is already linked to this box.`);
    this.syncSelection();
  }

  /** Remove one linked component from the selected box. */
  removeComponent(index: number): void {
    if (!this.selectedNode) return;
    const data = this.selectedNode.data;
    const list: LinkedComponent[] = Array.isArray(data.components) ? [...data.components] : [];
    if (index < 0 || index >= list.length) return;
    const [removed] = list.splice(index, 1);
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => m.set(data, 'components', list), 'unlink component'));
    this.notify.info(`Unlinked ${removed?.partNumber}.`);
    this.syncSelection();
  }

  /** Change a linked component's supplier. */
  setComponentSupplier(index: number, supplier: string): void {
    if (!this.selectedNode) return;
    const data = this.selectedNode.data;
    const list: LinkedComponent[] = Array.isArray(data.components) ? data.components.map((c: LinkedComponent) => ({ ...c })) : [];
    if (!list[index]) return;
    const offer = (list[index].suppliers || []).find((o) => o.name === supplier);
    list[index].supplier = supplier;
    if (offer) { list[index].unitPrice = offer.unitPrice ?? list[index].unitPrice; list[index].moq = offer.moq ?? list[index].moq; }
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => m.set(data, 'components', list), 'set supplier'));
  }

  /** Change a linked component's quantity. */
  setComponentQty(index: number, qty: any): void {
    if (!this.selectedNode) return;
    const data = this.selectedNode.data;
    const list: LinkedComponent[] = Array.isArray(data.components) ? data.components.map((c: LinkedComponent) => ({ ...c })) : [];
    if (!list[index]) return;
    list[index].quantity = Math.max(1, Number(qty) || 1);
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => m.set(data, 'components', list), 'set qty'));
  }

  /** Nodes that are boxes (functional block / shape), i.e. can carry components. */
  private boxNodes(): go.Node[] {
    const out: go.Node[] = [];
    this.diagram.nodes.each((n) => {
      const c = n.data?.category;
      if (c === 'shape' || c === 'block') out.push(n);
      // Electrical schematic symbols with a refdes are components too (ground
      // and other net markers are skipped — they never carry an MPN).
      else if (c === 'symbol' && elecMeta(n.data?.shape).ref) out.push(n);
    });
    return out;
  }

  /** Catalogue-search label/sub for a node: schematic symbols search by value
   * (when part-number-like) or type; boxes search by their label/role. */
  private suggestQueryFor(d: go.ObjectData): { label: string; sub: string } {
    if (d['category'] === 'symbol' && String(d['shape'] || '').startsWith('elec-')) {
      const type = this.symbolLabel(d['shape']);
      const value = String(d['value'] || '');
      const pnLike = /[A-Za-z]/.test(value) && /\d/.test(value) && value.length >= 4;
      return { label: pnLike ? value : type, sub: type };
    }
    return { label: d['text'] || '', sub: d['sub'] || '' };
  }

  /** One-click: AI-suggest and auto-link the top component for every empty box. */
  suggestAllBoxes(): void {
    this.closeMenus();
    const boxes = this.boxNodes().filter((n) => !(Array.isArray(n.data.components) && n.data.components.length));
    if (!boxes.length) { this.notify.info('Every box already has a component (or there are no boxes yet).'); return; }
    this.imageGenMessage = `Finding components for ${boxes.length} ${boxes.length === 1 ? 'box' : 'boxes'}…`;
    this.imageGenLoading = true;
    this.status = `Finding components for ${boxes.length} boxes…`;
    this.cdr.detectChanges();
    const calls = boxes.map((n) => {
      const q = this.suggestQueryFor(n.data);
      return this.boxSuggest
        .suggest(q.label, q.sub, n.data.kind || '', this.designWinContext)
        // Never let one slow/hung catalogue call keep the overlay up forever.
        .pipe(timeout(60000), catchError(() => of({ query: '', suggestions: [] as BoxSuggestion[] })));
    });
    forkJoin(calls).subscribe({
      next: (results) => {
        let linked = 0;
        results.forEach((res, i) => {
          const top = res.suggestions?.[0];
          if (top && this.addComponent(boxes[i], this.toComponent(top))) linked++;
        });
        this.imageGenLoading = false;
        this.status = `Linked components to ${linked} of ${boxes.length} boxes.`;
        if (linked) this.notify.success(`AI linked components to ${linked} of ${boxes.length} boxes.`);
        else this.notify.info('No component matches were found (is the catalogue reachable?).');
        this.syncSelection();
        this.cdr.detectChanges();
      },
      error: () => {
        this.imageGenLoading = false;
        this.notify.error('Could not suggest components (is the catalogue reachable?).');
        this.cdr.detectChanges();
      },
    });
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

  attachPartToSelected(part: any): void {
    if (!this.selectedNode || !this.isBox) {
      this.notify.info('Select a block on the canvas first to attach a part.');
      return;
    }

    const data = this.selectedNode.data;
    const partNumber = part?.arwPartNum?.name || part?.suppPartNum?.name || 'Unknown';
    const qty = part?.__bomQty || 1;

    // Get existing attached parts array (or create new one)
    const attachedParts = Array.isArray(data.attachedParts) ? [...data.attachedParts] : [];

    // Check if this part is already attached
    const existingIndex = attachedParts.findIndex((p: any) => {
      const pn = p.part?.arwPartNum?.name || p.part?.suppPartNum?.name;
      return pn === partNumber;
    });

    if (existingIndex >= 0) {
      this.notify.info(`${partNumber} is already attached to this block.`);
      return;
    }

    // Add new part to the array
    attachedParts.push({ part, quantity: qty });

    // Update the block data
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => {
      m.set(data, 'attachedParts', attachedParts);
    }, 'attach part'));

    this.notify.success(`Attached ${partNumber} to "${data.text}" (${attachedParts.length} parts total)`);
    this.syncSelection(); // Refresh property panel to show all attached parts
  }

  /** Get all attached parts for the selected block */
  get attachedParts(): Array<{ part: any; quantity: number }> {
    const parts = this.selectedNode?.data?.attachedParts;
    return Array.isArray(parts) ? parts : [];
  }

  /** Remove an attached part by index */
  removeAttachedPart(index: number): void {
    if (!this.selectedNode) return;
    const data = this.selectedNode.data;
    const attachedParts = Array.isArray(data.attachedParts) ? [...data.attachedParts] : [];

    if (index < 0 || index >= attachedParts.length) return;

    const removed = attachedParts[index];
    const partNumber = removed.part?.arwPartNum?.name || removed.part?.suppPartNum?.name || 'part';
    attachedParts.splice(index, 1);

    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => {
      m.set(data, 'attachedParts', attachedParts);
    }, 'remove attached part'));

    this.notify.success(`Removed ${partNumber} from "${data.text}"`);
    this.syncSelection();
  }

  /** Update quantity for an attached part */
  setAttachedPartQty(index: number, qty: any): void {
    if (!this.selectedNode) return;
    const data = this.selectedNode.data;
    const attachedParts = Array.isArray(data.attachedParts) ? [...data.attachedParts] : [];

    if (index < 0 || index >= attachedParts.length) return;

    attachedParts[index] = { ...attachedParts[index], quantity: Math.max(1, Number(qty) || 1) };

    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => {
      m.set(data, 'attachedParts', attachedParts);
    }, 'set attached part qty'));

    this.syncSelection();
  }

  private partNumberOfData(d: any): string | null {
    if (!d) return null;
    // Part card nodes
    if (d.category === 'part') {
      return d.part?.arwPartNum?.name || d.part?.suppPartNum?.name || d.partNumber || null;
    }
    // Blocks with attached parts
    if (d.attachedPart) {
      return d.attachedPart?.arwPartNum?.name || d.attachedPart?.suppPartNum?.name || d.partNumber || null;
    }
    return null;
  }

  // ---- BOM / AI / lifecycle / feedback / project ----

  exportBom(): void {
    const parts = this.partNodes().map((n) => ({ ...n.data.part, __bomQty: n.data.quantity || 1 })).filter((p) => p && Object.keys(p).length > 1);
    const linked: any[] = [];
    this.boxNodes().forEach((n) => {
      // Include old-style linked components (from AI suggestions)
      const comps = n.data.components;
      if (Array.isArray(comps)) comps.forEach((c: LinkedComponent) => linked.push(c));
      // Include new-style attached parts (from Attach button) - multiple parts support
      const attachedParts = n.data.attachedParts;
      if (Array.isArray(attachedParts)) {
        attachedParts.forEach((ap: any) => {
          parts.push({ ...ap.part, __bomQty: ap.quantity || 1 });
        });
      }
    });
    if (!parts.length && !linked.length) {
      this.notify.info('No parts to build a BOM from. Add catalogue parts, or attach parts to blocks.');
      return;
    }
    this.bomRows = this.bomService.buildCombined(parts, linked);
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
    this.recsOpen = false; this.partSearchSeed = q; this.partSearchOpen = false; this.designWinOpen = false;
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
    if (pn) this.checkLifecycle(pn); else this.notify.info('Select a part card or block with attached part first.');
  }

  /** Open the Design Win explorer, optionally seeding the POS tab with a part.
   * The right-side docks share one slot, so opening one closes the other. */
  openDesignWin(seedPart = ''): void {
    this.designWinSeed = seedPart;
    this.partSearchOpen = false;
    this.feedbackLoopOpen = false;
    this.designWinOpen = false;
    setTimeout(() => { this.designWinOpen = true; this.cdr.detectChanges(); }, 0);
  }
  /** Toggle the part-search dock (closes the other right-side docks — same slot). */
  togglePartSearch(): void {
    this.partSearchOpen = !this.partSearchOpen;
    if (this.partSearchOpen) { this.designWinOpen = false; this.feedbackLoopOpen = false; }
  }
  /** POS ("field-proven") check for the selected catalogue part. */
  checkSelectedPos(): void {
    const pn = this.selectedNode ? this.partNumberOfData(this.selectedNode.data) : null;
    if (pn) this.openDesignWin(pn); else this.notify.info('Select a part card or block with attached part first.');
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

  /** Attach a Design Win customer/project/board to the diagram (persisted in the model). */
  onAttachDesignWin(ctx: DesignWinContext): void {
    this.designWinContext = ctx;
    this.persistDesignWin();
    const label = [ctx.customerName, ctx.projectName, ctx.boardNum].filter(Boolean).join(' · ');
    this.notify.success(`Diagram attached to ${label || 'Design Win record'}.`);
    this.scheduleAutosave();
  }
  clearDesignWin(): void {
    this.designWinContext = null;
    this.persistDesignWin();
    this.scheduleAutosave();
  }
  get designWinLabel(): string {
    const c = this.designWinContext; if (!c) return '';
    return [c.customerName, c.projectName, c.boardNum ? `Board ${c.boardNum}` : ''].filter(Boolean).join(' · ');
  }
  /** Store the context in the GoJS model so it saves/loads with the diagram. */
  private persistDesignWin(): void {
    if (!this.diagram) return;
    this.zone.runOutsideAngular(() => this.diagram.model.commit((m) => {
      m.set(m.modelData, 'designWin', this.designWinContext || null);
    }, 'design-win context'));
  }

  /** Add a part pulled from the Design Win explorer (a registered/POS part) to the canvas. */
  onDesignWinAddPart(part: { partNumber: string; manufacturer: string; description: string; quantity: number }): void {
    this.addPartToCanvas({ arwPartNum: { name: part.partNumber }, suppPartNum: { name: part.partNumber },
      supp: { name: part.manufacturer }, mfr: { name: part.manufacturer },
      invOrgs: [{ desc: part.description || 'Design Win registered part' }], paramData: [],
      __designWin: true });
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

  /** Toggle the feedback-loop dock (shares the right-side slot with DW / part search). */
  toggleFeedbackLoop(): void {
    if (!this.feedbackLoopOpen && this.diagramId == null) {
      this.notify.info('Save the diagram first — discussions live on saved diagrams.');
      return;
    }
    this.feedbackLoopOpen = !this.feedbackLoopOpen;
    if (this.feedbackLoopOpen) { this.designWinOpen = false; this.partSearchOpen = false; }
  }
  /** Open threads (open / changes-requested) — shown as the header badge. */
  refreshFeedbackLoopCount(): void {
    if (this.diagramId == null) { this.feedbackLoopCount = 0; return; }
    this.feedbackLoop.board(this.diagramId).subscribe({
      next: (b) => {
        this.feedbackLoopCount = b.threads.filter((t) => t.status === 'open' || t.status === 'changes-requested').length;
        this.cdr.detectChanges();
      },
      error: () => {},
    });
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
    // Exclusion is only recorded here — the canvas is left untouched so nodes
    // never vanish from the working diagram. The mask is applied briefly at
    // capture time (runExport) and then removed.
    if (this.exportHidden.has(nodeId)) this.exportHidden.delete(nodeId); else this.exportHidden.add(nodeId);
    this.exportNodes = this.exportNodes.map((n) => n.id === nodeId ? { ...n, visible: !this.exportHidden.has(nodeId) } : n);
  }
  showAllHidden(): void {
    this.exportHidden.clear();
    this.exportNodes = this.exportNodes.map((n) => ({ ...n, visible: true }));
  }
  runExport(format: 'png' | 'svg'): void {
    this.exportOpen = false;
    this.withExportMask(() => { if (format === 'png') this.exportPng(); else this.exportSvg(); });
  }
  /** Hide the excluded nodes just for the image capture, then restore them.
   * The mask is silent (no undo entry, no autosave) and `hidden` never syncs to
   * collaborators, so excluding a component from a picture can't make it vanish
   * from anyone's canvas or from the saved diagram. */
  private withExportMask(capture: () => void): void {
    const hide = this.exportHidden;
    if (!hide.size) { capture(); return; }
    const setHidden = (v: boolean) => this.runSilently(() => this.diagram.commit((d) =>
      d.nodes.each((n) => { if (hide.has(String(n.key))) d.model.set(n.data, 'hidden', v); }), 'export-mask'));
    setHidden(true);
    try { capture(); } finally { setHidden(false); }
  }

  // ---- saved files / classification / reviews / delete ----

  refreshList(): void {
    this.diagrams.list().subscribe({ next: (l) => { this.savedDiagrams = l; this.applyReviewBadges(); this.cdr.detectChanges(); }, error: () => {} });
    this.reviewSvc.summary().subscribe({ next: (s) => { this.reviewSummaries = s; this.applyReviewBadges(); this.cdr.detectChanges(); }, error: () => {} });
  }
  private reviewSummaries: ReviewSummary[] = [];
  /** Stamp avg rating + review count onto the Open-list rows (star chips). */
  private applyReviewBadges(): void {
    if (!this.reviewSummaries.length) return;
    const byId = new Map(this.reviewSummaries.map((s) => [s.diagramId, s]));
    for (const d of this.savedDiagrams) {
      const s = byId.get(d.id);
      if (s) { d.avgRating = s.average; d.reviewCount = s.count; }
    }
  }
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
      { label: 'Generate from image (AI)', icon: 'auto_fix_high', run: () => this.generateFromImage() },
      { label: 'Suggest components for all boxes (AI)', icon: 'auto_awesome_motion', run: () => this.suggestAllBoxes() },
      { label: 'Template repository', icon: 'dashboard_customize', run: () => this.openTemplates() },
      { label: 'Recommendations (AI)', icon: 'auto_awesome', run: () => this.openRecommendations() },
      { label: 'Design review (AI)', icon: 'rule', run: () => this.openDesignReview() },
      { label: 'Search parts', icon: 'travel_explore', run: () => { this.partSearchOpen = true; this.designWinOpen = false; } },
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
      this.syncUrl();
      this.refreshFeedbackLoopCount();
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
        this.syncUrl();
        this.applyContent(dto.contentJson); this.joinCollab();
        this.refreshFeedbackLoopCount();
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
      this.loadDesignWin();
      this.syncSelection();
      this.resetUndoAfterLoad();
      return;
    }
    this.suppressAutosave = true;
    this.zone.runOutsideAngular(() => {
      try {
        const model = go.Model.fromJson(contentJson) as go.GraphLinksModel;
        model.linkFromPortIdProperty = 'fromPort'; model.linkToPortIdProperty = 'toPort';
        for (const d of model.nodeDataArray as any[]) {
          // Scrub angles an old build's animation ticker autosaved mid-spin (any
          // non-90°-step value) so the junk can't re-publish into collab rooms.
          if (typeof d.angle === 'number' && d.angle % 90 !== 0) d.angle = 0;
          // 'hidden' is a transient export-masking flag; an old build persisted it,
          // which left nodes permanently invisible with no way to restore them.
          if (d.hidden) d.hidden = false;
        }
        this.diagram.model = model;
      } catch { this.zone.run(() => this.notify.error('That diagram could not be loaded.')); }
    });
    this.retheme();
    this.loadDesignWin();
    this.suppressAutosave = false;
    this.syncSelection();
    this.resetUndoAfterLoad();
  }

  /** A freshly loaded diagram is the baseline — clear undo/redo so the first
   * Ctrl+Z reverts the user's first real edit, not any load-time setup. */
  private resetUndoAfterLoad(): void {
    this.zone.runOutsideAngular(() => this.diagram?.undoManager.clear());
  }

  /** Read the attached Design Win context stored in the model. */
  private loadDesignWin(): void {
    const md: any = this.diagram?.model?.modelData;
    const c = md && md.designWin;
    this.designWinContext = c && (c.customerName || c.projectName || c.boardNum) ? c : null;
  }

  /** Convert a legacy AntV X6 graph.toJSON() ({cells:[...]}) into GoJS data. */
  private convertX6(cells: any[]): { nodes: go.ObjectData[]; links: go.ObjectData[] } {
    const nodes: go.ObjectData[] = [];
    const links: go.ObjectData[] = [];
    // Two passes: nodes first (so edges can tell which endpoints are electrical
    // symbols), then edges.
    const elecKeys = new Set<string>();
    const edgeCells: any[] = [];
    for (const c of cells || []) {
      const isEdge = c?.shape === 'edge' || c?.source || c?.target;
      if (isEdge) {
        edgeCells.push(c);
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
          if (shape.startsWith('elec-')) elecKeys.add(key);
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
    // Edges: keep the X6 pin ports (pinN → pN) so wires land on real pins, and
    // preserve the edge's stroke/width/dash. Pin-to-pin connections between
    // electrical symbols become schematic wires (square corners, no arrowhead).
    for (const c of edgeCells) {
      const from = c.source?.cell ?? (typeof c.source === 'string' ? c.source : null);
      const to = c.target?.cell ?? (typeof c.target === 'string' ? c.target : null);
      if (!from || !to) continue;
      const port = (end: any) => {
        const p = end?.port;
        return typeof p === 'string' ? p.replace(/^pin(\d+)$/, 'p$1') : '';
      };
      const line = c.attrs?.line ?? {};
      const wire = elecKeys.has(from) && elecKeys.has(to);
      const link: go.ObjectData = { category: 'link', from, to, fromPort: port(c.source), toPort: port(c.target), wire };
      if (line.stroke) link['color'] = line.stroke;
      if (line.strokeWidth) link['width'] = line.strokeWidth;
      if (line.strokeDasharray) { link['dash'] = [6, 3]; link['flow'] = true; }
      links.push(link);
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

  /**
   * Nets + parts derived from the electrical schematic: pins wired together form
   * nets (union-find over each link's endpoints); every pin of every Ground
   * symbol is merged into one GND net. Returns null when there are no
   * electrical symbols on the canvas.
   */
  private computeSchematic(): {
    parts: go.Node[];
    nets: { name: string; ids: string[] }[];
    pinInfo: Map<string, { ref: string; pin: string; marker: boolean }>;
  } | null {
    const parts: go.Node[] = [];
    this.diagram.nodes.each((n) => {
      if (n.data?.category === 'symbol' && String(n.data.shape || '').startsWith('elec-')) parts.push(n);
    });
    if (!parts.length) return null;

    const pinId = (key: any, port: string) => `${key}/${port}`;
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) { parent.set(x, x); return x; }
      let root = x; while (parent.get(root)! !== root) root = parent.get(root)!;
      let cur = x; while (parent.get(cur)! !== root) { const nxt = parent.get(cur)!; parent.set(cur, root); cur = nxt; }
      return root;
    };
    const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

    // Register every pin so unconnected pins still appear; net markers (ground,
    // VCC / net-label flags) carry no refdes and are excluded from component
    // listings. Named flags give their net its name — and every flag with the
    // same name joins one net ("connect by name"), like a real schematic.
    const pinInfo = new Map<string, { ref: string; pin: string; marker: boolean }>();
    const flagPins = new Map<string, string[]>(); // net name → marker pin ids
    parts.forEach((n) => {
      const ref = n.data.text || n.data.shape;
      const marker = !elecMeta(n.data.shape).ref;
      const netName = n.data.shape === 'elec-ground'
        ? 'GND'
        : (marker ? String(n.data.text || 'NET').trim().toUpperCase() || 'NET' : '');
      (n.data.ports || []).forEach((p: any, i: number) => {
        const id = pinId(n.data.key, p.portId); find(id);
        pinInfo.set(id, { ref, pin: elecPinName(n.data.shape, i), marker });
        if (netName) (flagPins.get(netName) ?? flagPins.set(netName, []).get(netName)!).push(id);
      });
    });
    // Same-named flags are electrically the same net.
    flagPins.forEach((ids) => { for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]); });
    // Wire endpoints into nets.
    this.diagram.links.each((lk) => {
      const fk = lk.data?.from, tk = lk.data?.to;
      if (fk == null || tk == null) return;
      union(pinId(fk, lk.data?.fromPort ?? ''), pinId(tk, lk.data?.toPort ?? ''));
    });

    // Root → flag name (GND applied last so it wins if someone shorts flags).
    const rootName = new Map<string, string>();
    [...flagPins.entries()]
      .sort((a, b) => (a[0] === 'GND' ? 1 : 0) - (b[0] === 'GND' ? 1 : 0))
      .forEach(([name, ids]) => rootName.set(find(ids[0]), name));
    const byRoot = new Map<string, string[]>();
    pinInfo.forEach((_, id) => {
      const r = find(id);
      (byRoot.get(r) ?? byRoot.set(r, []).get(r)!).push(id);
    });
    let n = 0;
    const nets: { name: string; ids: string[] }[] = [];
    const weight = (root: string) => rootName.get(root) === 'GND' ? 2 : (rootName.has(root) ? 1 : 0);
    [...byRoot.entries()]
      .sort((a, b) => weight(b[0]) - weight(a[0]))
      .forEach(([root, ids]) => {
        if (ids.length < 2 && !rootName.has(root)) return; // dangling single pin
        nets.push({ name: rootName.get(root) ?? `N${++n}`, ids });
      });
    return { parts, nets, pinInfo };
  }

  /** BOM lines grouped by component type + value (net markers excluded). */
  private schematicBom(parts: go.Node[]): { qty: number; refs: string[]; name: string; value: string }[] {
    const bom = new Map<string, { qty: number; refs: string[]; name: string; value: string }>();
    parts.forEach((nd) => {
      const meta = elecMeta(nd.data.shape);
      if (!meta.ref) return;
      const name = this.symbolLabel(nd.data.shape);
      const value = nd.data.value || meta.value || '';
      const k = `${name}|${value}`;
      const e = bom.get(k) ?? bom.set(k, { qty: 0, refs: [], name, value }).get(k)!;
      e.qty++; e.refs.push(nd.data.text || meta.ref);
    });
    return [...bom.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Human-readable netlist + BOM (.txt) derived from the schematic wiring. */
  exportNetlist(): void {
    this.closeMenus();
    const sch = this.computeSchematic();
    if (!sch) {
      this.notify.info('Add components from the Electrical palette and wire their pins to build a netlist.');
      return;
    }
    const label = (id: string) => { const p = sch.pinInfo.get(id)!; return `${p.ref}.${p.pin}`; };
    const lines: string[] = ['NETLIST', '======='];
    sch.nets.forEach((net) => lines.push(`${net.name.padEnd(6)} ${[...new Set(net.ids.map(label))].sort().join(', ')}`));
    const inNet = new Set(sch.nets.flatMap((x) => x.ids));
    const unconnected = [...sch.pinInfo.keys()].filter((id) => !inNet.has(id)).map(label);
    if (unconnected.length) lines.push('', `Unconnected pins: ${unconnected.sort().join(', ')}`);

    const bom = this.schematicBom(sch.parts);
    lines.push('', 'BILL OF MATERIALS', '=================', 'Qty  Value        Component            References');
    bom.forEach((e) => lines.push(`${String(e.qty).padEnd(4)} ${(e.value || '-').padEnd(12)} ${e.name.padEnd(20)} ${e.refs.sort().join(', ')}`));

    const text = `${this.diagramName || 'Schematic'} — netlist & BOM\n\n${lines.join('\n')}\n`;
    this.download(URL.createObjectURL(new Blob([text], { type: 'text/plain' })), this.fileName('netlist.txt'));
    this.notify.success(`Netlist: ${sch.nets.length} net${sch.nets.length === 1 ? '' : 's'}, ${bom.length} BOM line${bom.length === 1 ? '' : 's'}.`);
  }

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
    // Symbols export as their real artwork, drawn for draw.io's white page.
    const src = (shape: string) => symbolInfo(shape, false)?.source ?? null;
    this.download(URL.createObjectURL(new Blob([exportDrawio(this.diagram, this.diagramName || 'diagram', src)], { type: 'application/xml' })), this.fileName('drawio'));
  }

  private fileName(ext: string): string { return (this.diagramName || 'diagram').replace(/[^\w.-]+/g, '_') + '.' + ext; }
  private download(href: string, filename: string): void {
    const a = document.createElement('a'); a.href = href; a.download = filename; a.click();
    if (href.startsWith('blob:')) URL.revokeObjectURL(href);
  }
}
