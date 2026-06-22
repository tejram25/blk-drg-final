import {
  AfterViewChecked, AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Cell, Edge, Graph, Node } from '@antv/x6';
import { Dnd } from '@antv/x6-plugin-dnd';
import { Snapline } from '@antv/x6-plugin-snapline';
import { Selection } from '@antv/x6-plugin-selection';
import { Keyboard } from '@antv/x6-plugin-keyboard';
import { History } from '@antv/x6-plugin-history';
import { Transform } from '@antv/x6-plugin-transform';
import { Export } from '@antv/x6-plugin-export';
import { MiniMap } from '@antv/x6-plugin-minimap';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { BlockType, DiagramService, DiagramSummary } from '../../core/services/diagram.service';
import { ReviewService } from '../../core/services/review.service';
import { NotificationService } from '../../core/services/notification.service';
import { GraphService } from '../../core/services/graph.service';
import { BomRow, BomService } from '../../core/services/bom.service';
import { AuthService } from '../../core/services/auth.service';
import { CollabService, ChatMessage } from '../../core/services/collab.service';
import { TranslateService } from '../../core/services/i18n/translate.service';
import { TranslatePipe } from '../../core/services/i18n/translate.pipe';
import { MessageTranslateService } from '../../core/services/i18n/message-translate.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ReviewsDialogComponent } from './components/reviews-dialog/reviews-dialog.component';
import { StatusBarComponent } from './components/status-bar/status-bar.component';
import { ZoomDockComponent } from './components/zoom-dock/zoom-dock.component';
import { BomDialogComponent } from './components/bom-dialog/bom-dialog.component';
import { VersionsDialogComponent } from './components/versions-dialog/versions-dialog.component';
import { CommentsPanelComponent } from './components/comments-panel/comments-panel.component';
import { PartSearchPanelComponent } from './components/part-search-panel/part-search-panel.component';
import { TemplatesDialogComponent } from './components/templates-dialog/templates-dialog.component';
import { TemplateDetail, TemplateService } from '../../core/services/template.service';
import { Command, CommandPaletteComponent } from '../../shared/components/command-palette/command-palette.component';
import { ELECTRICAL_SYMBOLS, registerElectricalShapes } from './electrical-shapes';
import { ANIMATED_SYMBOLS, partsToSvg, registerAnimatedShapes } from './animated-shapes';
import { BASIC_SHAPES, isBasic, registerBasicShapes } from './basic-shapes';
import { importDrawio, exportDrawio } from './drawio';

/** Node shape for imported images: picture + ports + caption. */
function registerImageNode(): void {
  Graph.registerNode('img-node', {
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'image', selector: 'img' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: { refWidth: '100%', refHeight: '100%', fill: 'transparent', stroke: 'none' },
      img: { refWidth: '100%', refHeight: '100%', preserveAspectRatio: 'xMidYMid meet' },
      label: {
        textAnchor: 'middle', textVerticalAnchor: 'top',
        refX: 0.5, refY: '100%', refY2: 6, fontSize: 11, fill: '#94a3b8',
      },
    },
    ports: {
      groups: {
        top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
        right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
        bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
        left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
      },
      items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
    },
  }, true);
}

/** FAST-style card node for functional blocks: white card, icon badge, title. */
function registerBlockCard(): void {
  Graph.registerNode('block-card', {
    width: 160, height: 56,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'rect', selector: 'badge' },
      { tagName: 'text', selector: 'icon' },
      { tagName: 'text', selector: 'title' },
      { tagName: 'text', selector: 'subtitle' },
    ],
    attrs: {
      body: {
        refWidth: '100%', refHeight: '100%', rx: 10, ry: 10,
        fill: '#ffffff', stroke: '#d2d6dc', strokeWidth: 1.5,
      },
      badge: { x: 10, y: 10, width: 36, height: 36, rx: 8, fill: '#1d4ed8' },
      icon: {
        x: 28, y: 35, text: 'widgets', fontFamily: 'Material Icons',
        fontSize: 20, fill: '#ffffff', textAnchor: 'middle',
      },
      title: {
        x: 56, y: 27, text: '', fontSize: 12.5, fontWeight: 600,
        fill: '#1f2937', textAnchor: 'start', fontFamily: 'Roboto, sans-serif',
      },
      subtitle: {
        x: 56, y: 42, text: 'Module', fontSize: 10,
        fill: '#9aa0a8', textAnchor: 'start', fontFamily: 'Roboto, sans-serif',
      },
    },
    ports: PORT_GROUPS,
  }, true);
}

/**
 * Rich card for an imported catalogue part: package thumbnail, part number,
 * supplier, and up to four key-spec lines. A native <title> gives a hover
 * tooltip with the full part description. Spec/image text is filled in per
 * part by the importer (see partsResultToCells).
 */
function registerPartCard(): void {
  Graph.registerNode('part-card', {
    width: 240, height: 140,
    markup: [
      { tagName: 'title', selector: 'tip' },
      { tagName: 'rect', selector: 'body' },
      { tagName: 'rect', selector: 'accent' },
      { tagName: 'image', selector: 'img' },
      { tagName: 'text', selector: 'title' },
      { tagName: 'text', selector: 'supplier' },
      { tagName: 'text', selector: 'spec0' },
      { tagName: 'text', selector: 'spec1' },
      { tagName: 'text', selector: 'spec2' },
      { tagName: 'text', selector: 'spec3' },
    ],
    attrs: {
      body: {
        refWidth: '100%', refHeight: '100%', rx: 10, ry: 10,
        fill: '#ffffff', stroke: '#d2d6dc', strokeWidth: 1.5,
      },
      accent: { x: 0, y: 0, refWidth: '100%', height: 6, rx: 3, fill: '#1d4ed8' },
      img: {
        refX: 1, refX2: -64, y: 16, width: 52, height: 52,
        preserveAspectRatio: 'xMidYMid meet',
      },
      title: {
        x: 14, y: 30, fontSize: 13, fontWeight: 700,
        fill: '#111827', textAnchor: 'start', fontFamily: 'Roboto, sans-serif',
      },
      supplier: {
        x: 14, y: 48, fontSize: 10.5,
        fill: '#6b7280', textAnchor: 'start', fontFamily: 'Roboto, sans-serif',
      },
      spec0: { x: 14, y: 72, fontSize: 10.5, fill: '#374151', textAnchor: 'start', fontFamily: 'Roboto, sans-serif' },
      spec1: { x: 14, y: 90, fontSize: 10.5, fill: '#374151', textAnchor: 'start', fontFamily: 'Roboto, sans-serif' },
      spec2: { x: 14, y: 108, fontSize: 10.5, fill: '#374151', textAnchor: 'start', fontFamily: 'Roboto, sans-serif' },
      spec3: { x: 14, y: 126, fontSize: 10.5, fill: '#374151', textAnchor: 'start', fontFamily: 'Roboto, sans-serif' },
    },
    ports: PORT_GROUPS,
  }, true);
}

const PORT_GROUPS = {
  groups: {
    top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
    right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
    bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
    left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
  },
  items: [
    { group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' },
  ],
};

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe,
    ConfirmDialogComponent, ReviewsDialogComponent, StatusBarComponent, ZoomDockComponent,
    BomDialogComponent, CommandPaletteComponent, VersionsDialogComponent, CommentsPanelComponent,
    PartSearchPanelComponent, TemplatesDialogComponent,
  ],
  templateUrl: './editor.component.html',
  styleUrls: ['./editor.component.css'],
  providers: [GraphService],
})
export class EditorComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLDivElement>;
  @ViewChild('chatLog') chatLogRef?: ElementRef<HTMLDivElement>;
  @ViewChild('minimap') minimapRef!: ElementRef<HTMLDivElement>;

  /** Whether the minimap overlay is shown. */
  minimapOpen = false;
  /** Whether the Ctrl/Cmd+K command palette is open. */
  commandPaletteOpen = false;

  /** Actions exposed in the command palette. */
  get commands(): Command[] {
    return [
      { label: 'New diagram', icon: 'note_add', run: () => this.newDiagram() },
      { label: 'Save', icon: 'save', hint: 'Ctrl+S', run: () => this.save() },
      { label: 'Template repository', icon: 'dashboard_customize', run: () => this.openTemplates() },
      { label: 'Save as template', icon: 'bookmark_add', run: () => this.openTemplates() },
      { label: 'Search parts', icon: 'travel_explore', run: () => (this.partSearchOpen = true) },
      { label: 'Version history', icon: 'history', run: () => this.openVersions() },
      { label: 'Comments', icon: 'comment', run: () => this.toggleComments() },
      { label: 'Duplicate selection', icon: 'content_copy', hint: 'Ctrl+D', run: () => this.duplicateSelection() },
      { label: 'Bring to front', icon: 'flip_to_front', run: () => this.bringToFront() },
      { label: 'Send to back', icon: 'flip_to_back', run: () => this.sendToBack() },
      { label: 'Align left', icon: 'align_horizontal_left', run: () => this.align('left') },
      { label: 'Align right', icon: 'align_horizontal_right', run: () => this.align('right') },
      { label: 'Align horizontal centers', icon: 'align_horizontal_center', run: () => this.align('center') },
      { label: 'Align top', icon: 'align_vertical_top', run: () => this.align('top') },
      { label: 'Align bottom', icon: 'align_vertical_bottom', run: () => this.align('bottom') },
      { label: 'Align vertical centers', icon: 'align_vertical_center', run: () => this.align('middle') },
      { label: 'Distribute horizontally', icon: 'horizontal_distribute', run: () => this.distribute('h') },
      { label: 'Distribute vertically', icon: 'vertical_distribute', run: () => this.distribute('v') },
      { label: 'Zoom to fit', icon: 'fit_screen', run: () => this.zoomFit() },
      { label: 'Toggle minimap', icon: 'map', run: () => (this.minimapOpen = !this.minimapOpen) },
      { label: 'Undo', icon: 'undo', run: () => this.undo() },
      { label: 'Redo', icon: 'redo', run: () => this.redo() },
      { label: 'Export as PNG', icon: 'image', run: () => this.exportPng() },
      { label: 'Export as SVG', icon: 'shape_line', run: () => this.exportSvg() },
      { label: 'Export as JSON', icon: 'data_object', run: () => this.exportJson() },
      { label: 'Export to draw.io', icon: 'account_tree', run: () => this.exportDrawioFile() },
      { label: 'Bill of Materials (CSV)', icon: 'receipt_long', run: () => this.exportBom() },
    ];
  }

  /** Open/close the command palette with Ctrl/Cmd+K. */
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.commandPaletteOpen = !this.commandPaletteOpen;
    }
    if (event.key === 'Escape') {
      this.closeMenus();
    }
  }

  /** A click anywhere else closes any open header dropdown. Toggles and menu
   * panels stopPropagation, so this only fires for "outside" clicks. */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenus();
  }

  /** Close every header dropdown. */
  closeMenus(): void {
    this.openMenuOpen = false;
    this.importMenuOpen = false;
    this.exportMenuOpen = false;
    this.langMenuOpen = false;
    this.accountMenuOpen = false;
    this.presenceOpen = false;
  }

  /** Toggle a header dropdown, closing any other that was open. */
  toggleMenu(menu: 'open' | 'import' | 'export' | 'lang' | 'account' | 'presence', event: Event): void {
    event.stopPropagation();
    const isOpen = {
      open: this.openMenuOpen, import: this.importMenuOpen, export: this.exportMenuOpen,
      lang: this.langMenuOpen, account: this.accountMenuOpen, presence: this.presenceOpen,
    }[menu];
    this.closeMenus();
    if (isOpen) return; // it was open → leave it closed
    switch (menu) {
      case 'open': this.openMenuOpen = true; break;
      case 'import': this.importMenuOpen = true; break;
      case 'export': this.exportMenuOpen = true; break;
      case 'lang': this.langMenuOpen = true; break;
      case 'account': this.accountMenuOpen = true; break;
      case 'presence': this.presenceOpen = true; break;
    }
  }

  /** The X6 graph lives in GraphService (shared with child components via DI). */
  get graph(): Graph {
    return this.graphSvc.graph;
  }
  dnd!: Dnd;

  blockTypes: BlockType[] = [];
  savedDiagrams: DiagramSummary[] = [];
  selectedDiagramId: number | null = null;
  currentId: number | null = null;
  diagramName = 'Untitled diagram';
  selectedNode: Node | null = null;
  selectedEdge: Edge | null = null;
  status = '';
  lightCanvas = true; // white canvas matches the light workspace; toggle for dark
  paletteQuery = '';
  activeCategory = 'Blocks';
  catMenuOpen = false;
  openMenuOpen = false;
  /** Saved diagram awaiting delete confirmation (drives the confirm dialog). */
  pendingDelete: DiagramSummary | null = null;
  /** Saved diagram whose reviews dialog is open (null when closed). */
  reviewTarget: DiagramSummary | null = null;
  /** Bill-of-materials rows for the open BOM dialog (null when closed). */
  bomRows: BomRow[] | null = null;
  /** Version-history dialog state. */
  versionsOpen = false;
  versionsSnapshot = '';
  /** Comments panel state. */
  commentsOpen = false;
  /** Parts search panel state. */
  partSearchOpen = false;
  /** Template repository dialog state. */
  templatesOpen = false;
  /** Canvas snapshot captured when the templates dialog opens (for "Save as template"). */
  templatesSnapshot = '';
  /** The template currently being improved (Improve flow), or null. */
  editingTemplate: TemplateDetail | null = null;
  /** True while an "Update template" save is in flight. */
  savingTemplate = false;
  /** Compact-screen drawers: palette and properties auto-hide behind toolbar toggles. */
  paletteOpen = false;
  propsOpen = false;

  constructor(
    private api: DiagramService,
    private reviews: ReviewService,
    private notify: NotificationService,
    private graphSvc: GraphService,
    private bomService: BomService,
    private templateApi: TemplateService,
    private sanitizer: DomSanitizer,
    public collab: CollabService,
    public i18n: TranslateService,
    public msgTranslate: MessageTranslateService,
    public auth: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  /** Route id (/editor/:id) that should be opened once the graph is ready. */
  private pendingRouteId: number | null = null;

  ngOnInit(): void {
    // Open a diagram straight from the URL (/editor/:id); the actual load runs
    // in ngAfterViewInit once the graph exists.
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? Number(idParam) : NaN;
    this.pendingRouteId = Number.isFinite(id) ? id : null;
  }

  /** End the session and return to the login screen. */
  logout(): void {
    // Drop out of any collaboration room first, so we're removed from the room's
    // presence right away instead of waiting for the async sign-out call and the
    // subsequent component teardown (ngOnDestroy also calls leave() as a backstop).
    this.resetCollab();
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  // ---------- Language (i18n) ----------

  langMenuOpen = false;
  exportMenuOpen = false;
  importMenuOpen = false;
  accountMenuOpen = false;

  /** Languages offered in the switcher (from the translation table). */
  get languages() {
    return this.i18n.languages;
  }

  get currentLang(): string {
    return this.i18n.lang;
  }

  get currentLangLabel(): string {
    return this.i18n.currentLabel;
  }

  /** Switch the UI language instantly (persisted across reloads). */
  switchLang(code: string): void {
    this.langMenuOpen = false;
    this.i18n.setLang(code);
  }

  // ---------- Chat message translation (on-device) ----------

  /** Per-message translation state, keyed by message id. */
  private msgTx = new Map<string, {
    state: 'loading' | 'done' | 'same' | 'error' | 'unsupported';
    text?: string;
    showOriginal?: boolean;
  }>();

  msgState(id: string) {
    return this.msgTx.get(id);
  }

  /** Translate a message into the current UI language (or re-show its translation). */
  async translateMessage(m: ChatMessage): Promise<void> {
    const cur = this.msgTx.get(m.id);
    if (cur?.state === 'done') { this.msgTx.set(m.id, { ...cur, showOriginal: false }); return; }
    if (!this.msgTranslate.supported) { this.msgTx.set(m.id, { state: 'unsupported' }); return; }
    this.msgTx.set(m.id, { state: 'loading' });
    try {
      const r = await this.msgTranslate.translate(m.text, m.lang ?? '', this.i18n.lang);
      this.msgTx.set(m.id, r.same
        ? { state: 'same' }
        : { state: 'done', text: r.text, showOriginal: false });
    } catch {
      this.msgTx.set(m.id, { state: 'error' });
    }
  }

  /** Toggle a translated message back to its original text. */
  revertMessage(m: ChatMessage): void {
    const cur = this.msgTx.get(m.id);
    if (cur?.state === 'done') this.msgTx.set(m.id, { ...cur, showOriginal: true });
  }

  ngAfterViewInit(): void {
    registerElectricalShapes();
    registerAnimatedShapes();
    registerBasicShapes();
    registerImageNode();
    registerBlockCard();
    registerPartCard();
    this.initGraph();
    this.canvasRef.nativeElement.classList.toggle('canvas-light', this.lightCanvas);
    this.loadPalette();
    this.refreshList();
    // Deep-link: /editor/:id opens that diagram on load.
    if (this.pendingRouteId != null) {
      this.selectedDiagramId = this.pendingRouteId;
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.collab.leave();
    this.graphSvc.dispose();
  }

  // ---------- Collaboration (automatic, per file) ----------

  /** Roster popover open state. */
  presenceOpen = false;
  /** The file id whose collab room we're currently joined to (null = none). */
  collabFileId: number | null = null;

  /** Display name for collaboration: the signed-in user's name (or email). */
  get myDisplayName(): string {
    const u = this.auth.user();
    return u?.name?.trim() || u?.email || 'User';
  }

  /** Stable identity (account email) so all of a user's tabs count as one person. */
  get myUserId(): string {
    return this.auth.user()?.email || '';
  }

  /**
   * Keep collaboration in sync with the open file. The room is the diagram id, so
   * everyone viewing the same saved file shares one room. A new/unsaved diagram
   * (no id) isn't shared until it's saved.
   */
  private syncCollab(): void {
    const fileId = this.currentId;
    if (fileId == null) {
      this.resetCollab();
      return;
    }
    if (this.collab.active && this.collabFileId === fileId) return;
    this.resetCollab();
    this.collab.join(this.graph, String(fileId), this.myDisplayName, this.myUserId);
    this.collabFileId = fileId;
    this.status = 'Collaborating on this file';
  }

  /** Leave the current room and reset the collab/chat UI state. */
  private resetCollab(): void {
    if (this.collab.active) this.collab.leave();
    this.collabFileId = null;
    this.presenceOpen = false;
    this.chatOpen = false;
    this.chatDraft = '';
    this.lastSeenChatCount = 0;
  }

  participantTrack(_i: number, p: { id: number }): number {
    return p.id;
  }

  // ---- live cursors ----

  onCanvasMouseMove(e: MouseEvent): void {
    if (!this.collab.active) return;
    const p = this.graph.clientToLocal(e.clientX, e.clientY);
    this.collab.setLocalCursor({ x: p.x, y: p.y });
  }

  onCanvasMouseLeave(): void {
    if (this.collab.active) this.collab.setLocalCursor(null);
  }

  /** Remote cursors mapped from graph coordinates to pixels inside the canvas wrap. */
  remoteCursors(): { id: number; name: string; color: string; sx: number; sy: number }[] {
    if (!this.collab.active || !this.graph || !this.canvasRef) return [];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return this.collab.cursors.map((c) => {
      const client = this.graph.localToClient(c.x, c.y);
      return { id: c.id, name: c.name, color: c.color, sx: client.x - rect.left, sy: client.y - rect.top };
    }).filter((c) => c.sx >= -20 && c.sy >= -20 && c.sx <= rect.width + 20 && c.sy <= rect.height + 20);
  }

  cursorTrack(_i: number, c: { id: number }): number {
    return c.id;
  }

  // ---------- Session chat ----------

  chatOpen = false;
  chatDraft = '';
  /** how many messages had been seen last time the chat was open (for the unread badge). */
  lastSeenChatCount = 0;
  private lastRenderedChatCount = 0;

  /** Unread = messages that arrived while the chat panel was closed. */
  get unreadChat(): number {
    if (!this.collab.active || this.chatOpen) return 0;
    return Math.max(0, this.collab.messages.length - this.lastSeenChatCount);
  }

  toggleChat(): void {
    this.chatOpen = !this.chatOpen;
    if (this.chatOpen) {
      this.lastSeenChatCount = this.collab.messages.length;
      setTimeout(() => this.scrollChatToBottom());
    }
  }

  sendChat(): void {
    const text = this.chatDraft.trim();
    if (!text) return;
    this.collab.sendChat(text, this.i18n.lang);
    this.chatDraft = '';
    this.lastSeenChatCount = this.collab.messages.length;
    setTimeout(() => this.scrollChatToBottom());
  }

  chatTrack(_i: number, m: { id: string }): string {
    return m.id;
  }

  /** Short HH:MM timestamp for a message. */
  fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private scrollChatToBottom(): void {
    const el = this.chatLogRef?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // Keep the chat scrolled to the newest message, and mark messages read while open.
  ngAfterViewChecked(): void {
    if (this.chatOpen && this.collab.messages.length !== this.lastRenderedChatCount) {
      this.lastRenderedChatCount = this.collab.messages.length;
      this.lastSeenChatCount = this.collab.messages.length;
      this.scrollChatToBottom();
    }
  }

  // ---------- Graph setup ----------

  private initGraph(): void {
    this.graphSvc.graph = new Graph({
      container: this.canvasRef.nativeElement,
      autoResize: true,
      background: { color: '#ffffff' },
      grid: { size: 10, visible: true, type: 'dot', args: { color: '#cbd5e1', thickness: 1 } },
      panning: { enabled: true, eventTypes: ['rightMouseDown'] },
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] },
      connecting: {
        router: 'manhattan',
        connector: { name: 'rounded', args: { radius: 8 } },
        anchor: 'center',
        connectionPoint: 'boundary',
        snap: { radius: 20 },
        allowBlank: false,
        allowLoop: false,
        allowNode: false, // must connect port-to-port
        highlight: true,
        // New wires take whatever is selected in the wire dock
        createEdge: () =>
          this.graph.createEdge({
            attrs: { line: this.wireLineAttrs() },
            router: this.wireRouterCfg(),
            connector: this.wireConnectorCfg(),
            zIndex: -1,
          }),
      },
      highlighting: {
        magnetAvailable: {
          name: 'stroke',
          args: { attrs: { stroke: '#22d3ee', 'stroke-width': 2 } },
        },
      },
    });

    this.graph
      .use(new Snapline({ enabled: true }))
      .use(new Selection({
        enabled: true,
        multiple: true,
        rubberband: true,        // drag on blank canvas to lasso-select
        movable: true,           // dragging one selected node moves the whole selection
        strict: false,           // rubberband selects nodes it touches, not only fully-contained
        showNodeSelectionBox: false,
      }))
      .use(new Keyboard({ enabled: true }))
      .use(new History({
        enabled: true,
        // Don't record changes applied from collaborators — otherwise local
        // Undo would silently revert other people's work.
        beforeAddCommand: () => !this.collab.isApplyingRemote,
      }))
      .use(new Transform({
        resizing: {
          enabled: true, minWidth: 30, minHeight: 24,
          // keep imported pictures (and squares/circles) from being squashed
          preserveAspectRatio: (node: Node) =>
            node.shape === 'img-node' || !!BASIC_SHAPES[node.shape]?.keepRatio,
        },
        rotating: { enabled: true, grid: 15 },
      }))
      .use(new Export())
      .use(new MiniMap({
        container: this.minimapRef.nativeElement,
        width: 200,
        height: 140,
        padding: 8,
      }));

    // Symbol drawings (elec-*/anim-*) use fixed coordinates, so scale the
    // wrapper group whenever the node is resized.
    this.graph.on('node:change:size', ({ node }) => { this.syncSymbolScale(node); this.scaleCard(node); });

    this.dnd = new Dnd({ target: this.graph });

    // Delete with keyboard — covers plugin selection AND the clicked
    // node/edge (edges aren't part of the Selection plugin's set).
    this.graph.bindKey(['delete', 'backspace'], () => {
      const cells = [...this.graph.getSelectedCells()];
      if (this.selectedNode && !cells.includes(this.selectedNode)) cells.push(this.selectedNode);
      if (this.selectedEdge && !cells.includes(this.selectedEdge)) cells.push(this.selectedEdge);
      if (cells.length) this.graph.removeCells(cells);
      this.selectedNode = null;
      this.selectedEdge = null;
      return false;
    });

    // Select everything
    this.graph.bindKey(['ctrl+a', 'meta+a'], () => {
      this.graph.resetSelection(this.graph.getNodes());
      return false;
    });
    // Clear selection / close panels
    this.graph.bindKey('esc', () => {
      this.graph.cleanSelection();
      this.selectedNode = null;
      this.selectedEdge = null;
      this.highlightWire(null);
      return false;
    });
    // Keyboard zoom
    this.graph.bindKey(['ctrl+=', 'meta+='], () => { this.zoomIn(); return false; });
    this.graph.bindKey(['ctrl+-', 'meta+-'], () => { this.zoomOut(); return false; });

    // Clipboard + duplicate
    this.graph.bindKey(['ctrl+c', 'meta+c'], () => { this.copySelection(); return false; });
    this.graph.bindKey(['ctrl+x', 'meta+x'], () => { this.cutSelection(); return false; });
    this.graph.bindKey(['ctrl+v', 'meta+v'], () => { this.pasteClipboard(); return false; });
    this.graph.bindKey(['ctrl+d', 'meta+d'], () => { this.duplicateSelection(); return false; });
    this.graph.bindKey(['ctrl+shift+f', 'meta+shift+f'], () => { this.bringToFront(); return false; });
    this.graph.bindKey(['ctrl+shift+b', 'meta+shift+b'], () => { this.sendToBack(); return false; });

    // Share our viewport so followers can mirror it (follow-mode).
    this.graph.on('scale', () => this.broadcastViewport());
    this.graph.on('translate', () => this.broadcastViewport());

    // Track selection for the property panels
    this.graph.on('node:click', ({ node }) => {
      this.selectedNode = node;
      this.selectedEdge = null;
      this.highlightWire(null);
    });
    this.graph.on('edge:click', ({ edge }) => {
      this.selectedEdge = edge;
      this.selectedNode = null;
      this.syncWireDock(edge);
      this.highlightWire(edge);
    });
    this.graph.on('blank:click', () => {
      this.selectedNode = null;
      this.selectedEdge = null;
      this.highlightWire(null);
    });
    // If the selected cell vanishes (Del key, collaborator deleted it,
    // diagram load), close its property panel instead of editing a ghost.
    this.graph.on('cell:removed', ({ cell }) => {
      if (cell === this.selectedNode) this.selectedNode = null;
      if (cell === this.selectedEdge) this.selectedEdge = null;
    });
  }

  // ---------- Palette ----------

  private loadPalette(): void {
    this.api.getBlockTypes().subscribe({
      next: (types) => (this.blockTypes = this.mergeShapeTypes(types)),
      error: () => {
        this.status = 'Backend offline - using local palette';
        this.blockTypes = [
          { key: 'processor', label: 'Main Processor', color: '#1d4ed8', icon: 'developer_board' },
          { key: 'sensor', label: 'Sensor', color: '#15803d', icon: 'sensors' },
          { key: 'motor', label: 'Motor Control', color: '#b45309', icon: 'rotate_right' },
          { key: 'battery', label: 'Battery / BMS', color: '#a16207', icon: 'battery_charging_full' },
          { key: 'comms', label: 'Comm Module', color: '#6d28d9', icon: 'wifi' },
          ...Object.entries(BASIC_SHAPES).map(([shape, def]) => ({
            key: shape.replace('basic-', ''),
            label: def.label,
            color: '#ffffff',
            category: 'Shapes',
            shape,
          })),
          ...Object.keys(ELECTRICAL_SYMBOLS).map((shape) => ({
            key: shape.replace('elec-', ''),
            label: this.symbolLabel(shape),
            color: '#e2e8f0',
            category: 'Electrical',
            shape,
          })),
          ...Object.keys(ANIMATED_SYMBOLS).map((shape) => ({
            key: shape.replace('anim-', ''),
            label: this.symbolLabel(shape),
            color: '#e2e8f0',
            category: 'Animated',
            shape,
          })),
        ];
      },
    });
  }

  // Palette helpers ----------------------------------------------------

  /** Ensure every registered basic shape shows in the palette, even if the
   *  backend's block-types list predates them (keeps shapes client-driven). */
  private mergeShapeTypes(types: BlockType[]): BlockType[] {
    const present = new Set(types.map((t) => t.shape).filter(Boolean));
    const extra: BlockType[] = Object.entries(BASIC_SHAPES)
      .filter(([shape]) => !present.has(shape))
      .map(([shape, def]) => ({
        key: shape.replace('basic-', ''),
        label: def.label,
        color: '#ffffff',
        category: 'Shapes',
        shape,
      }));
    return [...types, ...extra];
  }

  get selectedDiagramName(): string {
    return this.savedDiagrams.find((d) => d.id === this.selectedDiagramId)?.name ?? '';
  }

  get categories(): string[] {
    const cats = new Set(this.blockTypes.map((b) => b.category ?? 'Blocks'));
    return [...cats];
  }

  byCategory(cat: string): BlockType[] {
    return this.blockTypes.filter((b) => (b.category ?? 'Blocks') === cat);
  }

  /** Items for the palette: search across everything, otherwise the active tab. */
  get visibleItems(): BlockType[] {
    const q = this.paletteQuery.trim().toLowerCase();
    if (q) {
      return this.blockTypes.filter((b) =>
        b.label.toLowerCase().includes(q) || this.i18n.td(b.label).toLowerCase().includes(q));
    }
    return this.byCategory(this.activeCategory);
  }

  isElectrical(shape: string): boolean {
    return shape.startsWith('elec-');
  }

  isBasic(shape: string): boolean {
    return isBasic(shape);
  }

  /** Outline preview for a basic geometric shape in the palette. */
  basicPreview(shape: string): SafeHtml {
    let html = this.previewCache.get(shape);
    if (!html) {
      html = this.sanitizer.bypassSecurityTrustHtml(BASIC_SHAPES[shape]?.preview ?? '');
      this.previewCache.set(shape, html);
    }
    return html;
  }

  private syncSymbolScale(node: Node): void {
    const def = ELECTRICAL_SYMBOLS[node.shape] ?? ANIMATED_SYMBOLS[node.shape];
    if (!def) return;
    const { width, height } = node.getSize();
    node.attr('wrap/transform', `scale(${width / def.width},${height / def.height})`);
  }

  /**
   * Scale a structured card's text/image with the box so resizing grows the
   * content too, instead of clipping it. Positions/sizes are derived from the
   * card's design size (part-card 240x140, block-card 160x56).
   */
  private scaleCard(node: Node): void {
    const { width, height } = node.getSize();
    if (node.shape === 'part-card') {
      const sx = width / 240, sy = height / 140, s = Math.min(sx, sy);
      node.attr('accent/height', 6 * sy);
      node.attr('img/y', 16 * sy);
      node.attr('img/width', 52 * s);
      node.attr('img/height', 52 * s);
      node.attr('img/refX2', -64 * sx);
      node.attr('title/x', 14 * sx); node.attr('title/y', 30 * sy); node.attr('title/fontSize', 13 * s);
      node.attr('supplier/x', 14 * sx); node.attr('supplier/y', 48 * sy); node.attr('supplier/fontSize', 10.5 * s);
      [72, 90, 108, 126].forEach((y, i) => {
        node.attr(`spec${i}/x`, 14 * sx);
        node.attr(`spec${i}/y`, y * sy);
        node.attr(`spec${i}/fontSize`, 10.5 * s);
      });
    } else if (node.shape === 'block-card') {
      const sx = width / 160, sy = height / 56, s = Math.min(sx, sy);
      node.attr('badge/x', 10 * sx); node.attr('badge/y', 10 * sy);
      node.attr('badge/width', 36 * s); node.attr('badge/height', 36 * s);
      node.attr('icon/x', 28 * sx); node.attr('icon/y', 35 * sy); node.attr('icon/fontSize', 20 * s);
      node.attr('title/x', 56 * sx); node.attr('title/y', 27 * sy); node.attr('title/fontSize', 12.5 * s);
      node.attr('subtitle/x', 56 * sx); node.attr('subtitle/y', 42 * sy); node.attr('subtitle/fontSize', 10 * s);
    }
  }

  symbolViewBox(shape: string): string {
    const def = ELECTRICAL_SYMBOLS[shape] ?? ANIMATED_SYMBOLS[shape];
    return def ? `-4 -4 ${def.width + 8} ${def.height + 8}` : '0 0 100 40';
  }

  symbolPaths(shape: string) {
    return ELECTRICAL_SYMBOLS[shape]?.paths ?? [];
  }

  isIc(shape: string): boolean {
    return (ELECTRICAL_SYMBOLS[shape]?.texts?.length ?? 0) > 0;
  }

  /** Bold texts only (the IC title) — pin labels are too small for previews. */
  symbolTitleTexts(shape: string) {
    return (ELECTRICAL_SYMBOLS[shape]?.texts ?? []).filter((t) => t.bold);
  }

  private previewCache = new Map<string, SafeHtml>();

  animatedPreview(shape: string): SafeHtml {
    let html = this.previewCache.get(shape);
    if (!html) {
      html = this.sanitizer.bypassSecurityTrustHtml(partsToSvg(shape));
      this.previewCache.set(shape, html);
    }
    return html;
  }

  private symbolLabel(shape: string): string {
    const k = shape.replace(/^(elec|anim)-/, '');
    const names: Record<string, string> = {
      resistor: 'Resistor', capacitor: 'Capacitor', inductor: 'Inductor',
      diode: 'Diode', led: 'LED', npn: 'NPN Transistor', ground: 'Ground',
      vdc: 'DC Source', vac: 'AC Source', switch: 'Switch', fuse: 'Fuse',
      pnp: 'PNP Transistor', nmos: 'N-MOSFET', zener: 'Zener Diode',
      pot: 'Potentiometer', 'cap-pol': 'Polarized Cap', cell: 'Battery Cell',
      opamp: 'Op-Amp', crystal: 'Crystal', pushbutton: 'Push Button',
      lamp: 'Lamp', ammeter: 'Ammeter', voltmeter: 'Voltmeter', motor: 'DC Motor',
      ic555: '555 Timer IC', lm741: 'LM741 Op-Amp', '7805': '7805 Regulator',
      lm317: 'LM317 Regulator', '7400': '7400 NAND', '7404': '7404 Inverter',
      '74hc595': '74HC595 Shift Reg', l293d: 'L293D Motor Drv',
      pc817: 'PC817 Optocoupler', mcu: 'ATmega328 MCU', esp32: 'ESP32 Module',
      'robot-arm': 'Robotic Arm', siren: 'Siren Light', fan: 'Fan',
      conveyor: 'Conveyor', gear: 'Gear Motor', antenna: 'Antenna Tower',
      pump: 'Pump', 'stack-light': 'Stack Light', piston: 'Piston',
      tank: 'Liquid Tank', drone: 'Drone', 'glow-battery': 'Battery (Charging)',
      inverter: 'Inverter', transformer: 'Transformer', solar: 'Solar Panel',
      'wind-turbine': 'Wind Turbine', generator: 'Generator',
      'ev-charger': 'EV Charger', pylon: 'Power Pylon', relay: 'Relay',
      heater: 'Heater', bulb: 'Bulb',
    };
    return names[k] ?? k;
  }

  // Property panel helpers ----------------------------------------------

  /** Electrical symbols are recolored via stroke; cards via badge; rest via body fill. */
  get colorAttrPath(): string {
    const shape = this.selectedNode?.shape ?? '';
    if (shape.startsWith('elec-')) return 'sym/stroke';
    if (shape === 'block-card') return 'badge/fill';
    return 'body/fill';
  }

  /** Card blocks keep their name in 'title'; everything else uses 'label'. */
  get labelAttrPath(): string {
    return this.selectedNode?.shape === 'block-card' ? 'title/text' : 'label/text';
  }

  get nodeTypeName(): string {
    const shape = this.selectedNode?.shape ?? '';
    if (shape === 'block-card') return this.i18n.td('Functional block');
    if (shape === 'img-node') return this.i18n.td('Image');
    if (shape.startsWith('elec-')) return `${this.i18n.td('Electrical')} · ${this.i18n.td(this.symbolLabel(shape))}`;
    if (shape.startsWith('anim-')) return `${this.i18n.td('Animated')} · ${this.i18n.td(this.symbolLabel(shape))}`;
    if (isBasic(shape)) return `${this.i18n.td('Shapes')} · ${this.i18n.td(BASIC_SHAPES[shape]?.label ?? 'Shape')}`;
    return this.i18n.td('Component');
  }

  get isCard(): boolean { return this.selectedNode?.shape === 'block-card'; }

  get isSymbol(): boolean {
    const s = this.selectedNode?.shape ?? '';
    return s.startsWith('elec-') || s.startsWith('anim-');
  }

  get defaultCategory(): string {
    const shape = this.selectedNode?.shape ?? '';
    if (shape.startsWith('elec-')) return 'Electrical';
    if (shape.startsWith('anim-')) return 'Animated';
    if (isBasic(shape)) return 'Shapes';
    if (shape === 'img-node') return 'Image';
    return 'Blocks';
  }

  /** Custom metadata (part number, category, notes) lives in node data and saves with the diagram. */
  dataField(key: string): string {
    return this.selectedNode?.getData()?.[key] ?? '';
  }

  setDataField(key: string, value: string): void {
    this.selectedNode?.setData({ [key]: value });
  }

  setNodeColor(color: string): void {
    if (!this.selectedNode) return;
    this.selectedNode.attr(this.colorAttrPath, color);
    if (this.colorAttrPath === 'sym/stroke') {
      // keep filled parts (diode triangle, arrows) in sync with the stroke
      const def = ELECTRICAL_SYMBOLS[this.selectedNode.shape];
      def?.paths.forEach((p, i) => {
        if (p.fill) this.selectedNode!.attr(`p${i}/fill`, color);
      });
    }
  }

  startDrag(block: BlockType, e: MouseEvent): void {
    if (block.shape) {
      // Schematic symbol / basic shape — no default name label (start blank).
      const node = this.graph.createNode({
        shape: block.shape,
        data: { typeKey: block.key },
        attrs: { label: { text: '' } },
      });
      this.dnd.start(node, e);
      return;
    }
    // Functional block → FAST-style card with icon badge
    const node = this.graph.createNode({
      shape: 'block-card',
      data: { typeKey: block.key },
      attrs: {
        badge: { fill: block.color },
        icon: { text: block.icon || 'widgets' },
        title: { text: block.label },
        subtitle: { text: 'Module' },
      },
    });
    this.dnd.start(node, e);
  }

  // ---------- Toolbar actions ----------

  save(): void {
    const dto = {
      name: this.diagramName || 'Untitled diagram',
      contentJson: JSON.stringify(this.graph.toJSON()),
    };
    const req = this.currentId
      ? this.api.update(this.currentId, dto)
      : this.api.create(dto);

    req.subscribe({
      next: (saved) => {
        this.currentId = saved.id ?? this.currentId;
        this.status = `Saved "${saved.name}"`;
        this.notify.success(`Saved "${saved.name}"`);
        this.refreshList();
        // A brand-new diagram now has an id — connect it to its room.
        this.syncCollab();
      },
      error: () => (this.status = 'Save failed'), // error toast shown globally
    });
  }

  load(): void {
    if (this.selectedDiagramId == null) return;
    this.api.get(this.selectedDiagramId).subscribe({
      next: (d) => {
        // Leave the previously open file's room FIRST: drops our presence there
        // immediately and prevents the incoming canvas from bleeding into the old
        // room. We then join the new file's room via syncCollab() below.
        this.resetCollab();
        this.graph.fromJSON(JSON.parse(d.contentJson));
        this.currentId = d.id ?? null;
        this.diagramName = d.name;
        this.selectedNode = null;
        this.selectedEdge = null;
        this.editingTemplate = null;
        this.status = `Opened "${d.name}"`;
        // Connect to this file's collaboration room (seeds it or adopts live state).
        this.syncCollab();
      },
      error: () => (this.status = 'Load failed'),
    });
  }

  newDiagram(): void {
    // Leave the current file's room BEFORE clearing the canvas. clearCells()
    // emits a per-cell 'removed' event for every cell; while still joined, the
    // collab service broadcasts those as deletions and wipes the diagram for
    // everyone collaborating on the file we were just viewing. (A new, unsaved
    // diagram has no id, so it isn't shared again until it's saved.)
    this.resetCollab();
    this.graph.clearCells();
    this.currentId = null;
    this.selectedDiagramId = null;
    this.diagramName = 'Untitled diagram';
    this.selectedNode = null;
    this.selectedEdge = null;
    this.status = '';
    this.editingTemplate = null;
  }

  refreshList(): void {
    this.api.list().subscribe({
      next: (list) => {
        this.savedDiagrams = list;
        // Merge in rating badges (best-effort; failure just leaves them blank).
        this.reviews.summary().subscribe({
          next: (sums) => {
            const byId = new Map(sums.map((s) => [s.diagramId, s]));
            this.savedDiagrams.forEach((d) => {
              const s = byId.get(d.id);
              d.avgRating = s?.average ?? 0;
              d.reviewCount = s?.count ?? 0;
            });
          },
          error: () => {},
        });
      },
      error: () => {},
    });
  }

  // ---------- Reviews ----------

  /** Open the reviews dialog for a saved diagram (the dialog loads its own data). */
  openReviews(d: DiagramSummary, event?: Event): void {
    event?.stopPropagation();
    this.reviewTarget = d;
    this.openMenuOpen = false;
  }

  closeReviews(): void {
    this.reviewTarget = null;
  }

  /** Confirmation message for the delete dialog. */
  get deleteMessage(): string {
    return `"${this.pendingDelete?.name}" will be permanently deleted. This can't be undone.`;
  }

  /** Open the confirmation dialog for deleting a saved file. */
  askDeleteDiagram(d: DiagramSummary, event?: Event): void {
    event?.stopPropagation();
    this.pendingDelete = d;
    this.openMenuOpen = false;
  }

  /** Dismiss the delete confirmation without deleting. */
  cancelDelete(): void {
    this.pendingDelete = null;
  }

  /** Delete the file confirmed in the dialog, then refresh the saved list. */
  confirmDelete(): void {
    const target = this.pendingDelete;
    this.pendingDelete = null;
    if (!target) return;
    this.api.delete(target.id).subscribe({
      next: () => {
        // If the deleted file is the one open on the canvas, drop to a blank
        // diagram (this also leaves its collab room) so we're not editing a
        // file that no longer exists.
        if (this.currentId === target.id) {
          this.newDiagram();
        } else if (this.selectedDiagramId === target.id) {
          this.selectedDiagramId = null;
        }
        this.refreshList();
        this.status = `Deleted "${target.name}"`;
        this.notify.success(`Deleted "${target.name}"`);
      },
      error: () => (this.status = 'Delete failed'), // error toast shown globally
    });
  }

  undo(): void { this.graph.canUndo() && this.graph.undo(); }
  redo(): void { this.graph.canRedo() && this.graph.redo(); }

  // ---------- Clipboard & duplicate ----------

  /** Snapshot copies of the cut/copied cells (simple in-app clipboard). */
  private clipboardCells: Cell[] = [];

  copySelection(): void {
    const cells = this.graph.getSelectedCells();
    if (cells.length) this.clipboardCells = cells.map((c) => c.clone());
  }

  cutSelection(): void {
    const cells = this.graph.getSelectedCells();
    if (!cells.length) return;
    this.clipboardCells = cells.map((c) => c.clone());
    this.graph.removeCells(cells);
  }

  pasteClipboard(): void {
    if (!this.clipboardCells.length) return;
    const copies = this.clipboardCells.map((c) => {
      const k = c.clone();
      k.translate(24, 24);
      return k;
    });
    this.graph.addCell(copies);
    this.graph.resetSelection(copies);
  }

  /** Clone the selected blocks in place (offset slightly). */
  duplicateSelection(): void {
    const nodes = this.graph.getSelectedCells().filter((c): c is Node => c.isNode());
    if (!nodes.length) {
      this.notify.info('Select a block to duplicate.');
      return;
    }
    this.graph.startBatch('duplicate');
    const clones = nodes.map((n) => {
      const clone = n.clone();
      clone.translate(24, 24);
      this.graph.addCell(clone);
      return clone;
    });
    this.graph.stopBatch('duplicate');
    this.graph.resetSelection(clones);
  }

  // ---------- Alignment ----------

  /** Align the selected blocks along an edge or centre. */
  align(mode: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'middle'): void {
    const nodes = this.graph.getSelectedCells().filter((c): c is Node => c.isNode());
    if (nodes.length < 2) {
      this.notify.info('Select at least two blocks to align.');
      return;
    }
    const boxes = nodes.map((n) => ({ n, b: n.getBBox() }));
    const minX = Math.min(...boxes.map((o) => o.b.x));
    const maxX = Math.max(...boxes.map((o) => o.b.x + o.b.width));
    const minY = Math.min(...boxes.map((o) => o.b.y));
    const maxY = Math.max(...boxes.map((o) => o.b.y + o.b.height));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    this.graph.startBatch('align');
    boxes.forEach(({ n, b }) => {
      switch (mode) {
        case 'left': n.setPosition(minX, b.y); break;
        case 'right': n.setPosition(maxX - b.width, b.y); break;
        case 'top': n.setPosition(b.x, minY); break;
        case 'bottom': n.setPosition(b.x, maxY - b.height); break;
        case 'center': n.setPosition(cx - b.width / 2, b.y); break;
        case 'middle': n.setPosition(b.x, cy - b.height / 2); break;
      }
    });
    this.graph.stopBatch('align');
  }

  /** Distribute the selected blocks so the gaps between their centres are equal. */
  distribute(axis: 'h' | 'v'): void {
    const nodes = this.graph.getSelectedCells().filter((c): c is Node => c.isNode());
    if (nodes.length < 3) {
      this.notify.info('Select at least three blocks to distribute.');
      return;
    }
    const boxes = nodes
      .map((n) => ({ n, b: n.getBBox() }))
      .sort((a, b) => (axis === 'h' ? a.b.center.x - b.b.center.x : a.b.center.y - b.b.center.y));
    const first = boxes[0].b.center;
    const last = boxes[boxes.length - 1].b.center;
    const step = (axis === 'h' ? last.x - first.x : last.y - first.y) / (boxes.length - 1);

    this.graph.startBatch('distribute');
    boxes.forEach(({ n, b }, i) => {
      if (i === 0 || i === boxes.length - 1) return;
      if (axis === 'h') n.setPosition(first.x + step * i - b.width / 2, b.y);
      else n.setPosition(b.x, first.y + step * i - b.height / 2);
    });
    this.graph.stopBatch('distribute');
  }

  // ---------- Zoom ----------

  get zoomPct(): number {
    return this.graph ? Math.round(this.graph.zoom() * 100) : 100;
  }

  zoomIn(): void {
    this.graph.zoom(0.2);
    if (this.graph.zoom() > 3) this.graph.zoomTo(3);
  }

  zoomOut(): void {
    this.graph.zoom(-0.2);
    if (this.graph.zoom() < 0.2) this.graph.zoomTo(0.2);
  }

  zoomFit(): void {
    this.graph.zoomToFit({ padding: 24, maxScale: 1.5 });
  }

  zoomReset(): void {
    this.graph.zoomTo(1);
    this.graph.centerContent();
  }

  /** Publish our current pan/zoom to the session for follow-mode. */
  private broadcastViewport(): void {
    if (!this.collab.active) return;
    const { tx, ty } = this.graph.translate();
    this.collab.setLocalViewport({ tx, ty, zoom: this.graph.zoom() });
  }

  toggleCanvasTheme(): void {
    this.lightCanvas = !this.lightCanvas;
    // CSS class drives recoloring of light strokes so symbols stay readable
    this.canvasRef.nativeElement.classList.toggle('canvas-light', this.lightCanvas);
    this.graph.drawBackground({ color: this.lightCanvas ? '#ffffff' : '#0f172a' });
    this.graph.drawGrid({
      type: 'dot',
      args: { color: this.lightCanvas ? '#cbd5e1' : '#334155', thickness: 1 },
    });
  }

  deleteSelected(): void {
    if (this.selectedNode) {
      this.graph.removeCell(this.selectedNode);
      this.selectedNode = null;
    }
  }

  // ---------- Image import ----------

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      // place at the center of the visible canvas
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      const p = this.graph.clientToLocal(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.addImageNode(file, p.x, p.y);
    }
    input.value = ''; // allow re-selecting the same file
  }

  onCanvasDrop(event: DragEvent): void {
    const file = Array.from(event.dataTransfer?.files ?? [])
      .find((f) => f.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    const p = this.graph.clientToLocal(event.clientX, event.clientY);
    this.addImageNode(file, p.x, p.y);
  }

  private addImageNode(file: File, cx: number, cy: number): void {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const probe = new Image();
      probe.onload = () => {
        const max = 220;
        const scale = Math.min(1, max / Math.max(probe.width, probe.height));
        const w = Math.max(40, Math.round(probe.width * scale));
        const h = Math.max(40, Math.round(probe.height * scale));
        this.graph.addNode({
          shape: 'img-node',
          x: cx - w / 2, y: cy - h / 2, width: w, height: h,
          attrs: {
            img: { 'xlink:href': url },
            label: { text: file.name.replace(/\.[^.]+$/, '') },
          },
        });
        this.status = `Added image "${file.name}"`;
      };
      probe.src = url;
    };
    reader.readAsDataURL(file);
  }

  deleteSelectedEdge(): void {
    if (this.selectedEdge) {
      this.graph.removeCell(this.selectedEdge);
      this.selectedEdge = null;
    }
  }

  /**
   * Visual cue for the selected wire. Done with a DOM class (not model attrs)
   * so the highlight is local-only and never syncs to collaborators.
   */
  private highlightWire(edge: Edge | null): void {
    this.canvasRef.nativeElement
      .querySelectorAll('.wire-selected')
      .forEach((el) => el.classList.remove('wire-selected'));
    if (edge) {
      const view = this.graph.findViewByCell(edge) as any;
      view?.container?.classList.add('wire-selected');
    }
  }

  // ---------- Wire dock ----------

  wireColors = ['#22d3ee', '#22c55e', '#f5a623', '#ef4444', '#a78bfa', '#64748b'];
  wireColor = '#22d3ee';
  wireStyle: 'flow' | 'dashed' | 'solid' = 'flow'; // animated dashes by default; dock can switch
  wireWidth = 2;
  wireRouter: 'manhattan' | 'normal' | 'smooth' = 'manhattan';
  /** which wire popover is open (compact dock): color, style, or none. */
  wirePop: 'color' | 'style' | null = null;

  toggleWirePop(which: 'color' | 'style'): void {
    this.wirePop = this.wirePop === which ? null : which;
  }

  wireLineAttrs(): any {
    return {
      stroke: this.wireColor,
      strokeWidth: this.wireWidth,
      strokeDasharray: this.wireStyle === 'solid' ? 'none' : 6,
      targetMarker: { name: 'block', width: 9, height: 7 },
      style: { animation: this.wireStyle === 'flow' ? 'flowing-line 30s infinite linear' : 'none' },
    };
  }

  wireRouterCfg(): any {
    return { name: this.wireRouter === 'manhattan' ? 'manhattan' : 'normal' };
  }

  wireConnectorCfg(): any {
    return this.wireRouter === 'smooth'
      ? { name: 'smooth' }
      : { name: 'rounded', args: { radius: 8 } };
  }

  setWireColor(c: string): void {
    this.wireColor = c;
    this.selectedEdge?.attr('line/stroke', c);
  }

  setWireStyle(s: 'flow' | 'dashed' | 'solid'): void {
    this.wireStyle = s;
    if (this.selectedEdge) {
      this.selectedEdge.attr('line/strokeDasharray', s === 'solid' ? 'none' : 6);
      this.selectedEdge.attr('line/style/animation', s === 'flow' ? 'flowing-line 30s infinite linear' : 'none');
    }
  }

  setWireWidth(w: number): void {
    this.wireWidth = w;
    this.selectedEdge?.attr('line/strokeWidth', w);
  }

  setWireRouter(r: 'manhattan' | 'normal' | 'smooth'): void {
    this.wireRouter = r;
    if (this.selectedEdge) {
      this.selectedEdge.setRouter(this.wireRouterCfg());
      this.selectedEdge.setConnector(this.wireConnectorCfg());
    }
  }

  /** Reflect a clicked wire's current style in the dock. */
  private syncWireDock(edge: Edge): void {
    const stroke = edge.attr('line/stroke') as any;
    if (stroke) this.wireColor = String(stroke);
    const w = edge.attr('line/strokeWidth') as any;
    if (w) this.wireWidth = Number(w);
    const dash = edge.attr('line/strokeDasharray') as any;
    const anim = edge.attr('line/style/animation') as any;
    this.wireStyle = !dash || dash === 'none'
      ? 'solid'
      : (anim && anim !== 'none' ? 'flow' : 'dashed');
    const router = edge.getRouter() as any;
    const connector = edge.getConnector() as any;
    this.wireRouter = connector?.name === 'smooth'
      ? 'smooth'
      : (router?.name === 'normal' ? 'normal' : 'manhattan');
  }

  exportJson(): void {
    const blob = new Blob([JSON.stringify(this.graph.toJSON(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.diagramName || 'diagram'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** Export the canvas as a PNG image (white background, trimmed to content). */
  exportPng(): void {
    const name = `${this.diagramName || 'diagram'}.png`;
    (this.graph as any).toPNG((dataUri: string) => this.downloadDataUri(dataUri, name), {
      padding: 20,
      backgroundColor: this.lightCanvas ? '#ffffff' : '#0f172a',
      quality: 1,
    });
  }

  /** Export the canvas as a vector SVG. */
  exportSvg(): void {
    const name = `${this.diagramName || 'diagram'}.svg`;
    (this.graph as any).toSVG((svg: string) => {
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      this.downloadDataUri(url, name);
      URL.revokeObjectURL(url);
    }, { preserveDimensions: true });
  }

  private downloadDataUri(href: string, filename: string): void {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
  }

  /** Build a Bill of Materials from catalogue part cards on the canvas. */
  exportBom(): void {
    const parts = this.graph.getNodes()
      .filter((n) => n.shape === 'part-card')
      .map((n) => (n.getData() as { part?: unknown } | undefined)?.part)
      .filter((p): p is object => !!p);
    if (!parts.length) {
      this.notify.info('No catalogue parts on the canvas to build a BOM from. Import a parts file first.');
      return;
    }
    this.bomRows = this.bomService.build(parts);
  }

  closeBom(): void {
    this.bomRows = null;
  }

  // ---------- Template repository ----------

  /** Open the shared template repository dialog. */
  openTemplates(): void {
    this.templatesSnapshot = JSON.stringify(this.graph.toJSON());
    this.templatesOpen = true;
  }

  /** Use a template: start a fresh, unsaved diagram from its content. */
  onUseTemplate(detail: TemplateDetail): void {
    this.editingTemplate = null; // a "use" is a new diagram, not a template edit
    this.loadTemplateContent(detail);
  }

  /** Improve a template: load it onto the canvas and remember it for update. */
  onImproveTemplate(detail: TemplateDetail): void {
    this.loadTemplateContent(detail);
    this.editingTemplate = detail; // show the "Update template" banner
  }

  /** Save the current canvas back over the template being improved. */
  saveTemplateUpdate(): void {
    const t = this.editingTemplate;
    if (!t || this.savingTemplate) return;
    this.savingTemplate = true;
    this.templateApi.update(t.id, {
      name: t.name,
      description: t.description,
      category: t.category,
      contentJson: JSON.stringify(this.graph.toJSON()),
    }).subscribe({
      next: (updated) => {
        this.savingTemplate = false;
        this.editingTemplate = updated;
        this.notify.success(`Updated template "${updated.name}"`);
      },
      error: () => (this.savingTemplate = false),
    });
  }

  /** Stop editing the template (leaves the canvas as-is). */
  cancelTemplateEdit(): void {
    this.editingTemplate = null;
  }

  /** Load template content as a brand-new, unsaved diagram (like an import). */
  private loadTemplateContent(detail: TemplateDetail): void {
    this.resetCollab();
    this.currentId = null;
    this.selectedDiagramId = null;
    this.selectedNode = null;
    this.selectedEdge = null;
    try {
      this.graph.fromJSON(JSON.parse(detail.contentJson));
    } catch {
      this.notify.error('That template could not be loaded.');
      return;
    }
    this.diagramName = detail.name;
    try { this.graph.zoomToFit({ padding: 24, maxScale: 1.5 }); } catch { /* best effort */ }
  }

  // ---------- Version history ----------

  /** Open the version-history dialog (requires a saved diagram). */
  openVersions(): void {
    if (this.currentId == null) {
      this.notify.info('Save the diagram first to use version history.');
      return;
    }
    this.versionsSnapshot = JSON.stringify(this.graph.toJSON());
    this.versionsOpen = true;
  }

  /** Load a restored snapshot's content onto the canvas. */
  onRestoreVersion(contentJson: string): void {
    try {
      this.graph.fromJSON(JSON.parse(contentJson));
      this.selectedNode = null;
      this.selectedEdge = null;
      try { this.graph.zoomToFit({ padding: 24, maxScale: 1.5 }); } catch { /* best effort */ }
    } catch {
      this.notify.error('That snapshot could not be loaded.');
    }
  }

  // ---------- Comments ----------

  /** Toggle the comments panel (requires a saved diagram). */
  toggleComments(): void {
    if (!this.commentsOpen && this.currentId == null) {
      this.notify.info('Save the diagram first to add comments.');
      return;
    }
    this.commentsOpen = !this.commentsOpen;
  }

  get selectedNodeId(): string | null {
    return this.selectedNode?.id ?? null;
  }

  /** Best-effort display name for the selected block (for the comment target). */
  get selectedNodeLabel(): string {
    const node = this.selectedNode;
    if (!node) return '';
    return (
      node.attr('label/text') as string ||
      node.attr('title/text') as string ||
      node.shape || 'block'
    );
  }

  /** Select and center the block a comment is pinned to. */
  onFocusNode(nodeId: string): void {
    const cell = this.graph.getCellById(nodeId);
    if (cell?.isNode()) {
      this.graph.resetSelection([cell]);
      try { this.graph.centerCell(cell); } catch { /* best effort */ }
    } else {
      this.notify.info('That block is no longer on the canvas.');
    }
  }

  onJsonSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.importJsonText(String(reader.result), file.name);
      reader.readAsText(file);
    }
    input.value = ''; // allow re-selecting the same file
  }

  /** Load a previously exported diagram JSON (X6 graph.toJSON() shape) onto the canvas. */
  private importJsonText(text: string, fileName: string): void {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (err: any) {
      this.status = `JSON import failed: ${err?.message || 'file is not valid JSON'}`;
      return;
    }

    // Accept the exported { cells: [...] } shape, or a bare array of cells.
    const rawCells: any[] | null =
      Array.isArray(data?.cells) ? data.cells : (Array.isArray(data) ? data : null);

    let cells: any[];
    let skipped = 0;
    let isPartsCatalog = false;

    if (rawCells) {
      // X6's fromJSON throws on the FIRST cell whose `shape` isn't registered, which
      // rejects the entire file. Keep only the cells this app knows how to render, so a
      // file with a stray/foreign cell still imports everything else instead of nothing.
      const isKnown = (shape: unknown): boolean => {
        if (typeof shape !== 'string') return false;
        try { return Node.registry.exist(shape) || Edge.registry.exist(shape); }
        catch { return true; } // registry API unavailable: don't over-filter
      };
      cells = rawCells.filter((c) => c && isKnown(c.shape));
      skipped = rawCells.length - cells.length;
      if (cells.length === 0) {
        this.status = rawCells.length
          ? `Import failed: none of the ${rawCells.length} cells use a shape this app supports`
          : 'That file contains no diagram cells';
        return;
      }
    } else {
      // Not a diagram export — try a parts-catalog API response (partserviceresult),
      // turning each catalogued part into a functional-block card on the canvas.
      const partCells = this.partsResultToCells(data);
      if (!partCells) {
        this.status = 'That file is not a valid diagram JSON';
        return;
      }
      if (partCells.length === 0) {
        this.status = 'No parts found in this catalog file';
        return;
      }
      cells = partCells;
      isPartsCatalog = true;
    }

    // An imported diagram is a fresh, unsaved document. Leave any current collab room
    // first (so the import can't overwrite the file we were viewing for other people)
    // and clear the saved-file id so Save creates a new diagram instead of overwriting.
    this.resetCollab();
    this.currentId = null;
    this.selectedDiagramId = null;
    this.selectedNode = null;
    this.selectedEdge = null;
    this.editingTemplate = null;

    try {
      this.graph.fromJSON({ cells });
    } catch (err: any) {
      this.status = `JSON import failed: ${err?.message || err}`;
      return;
    }

    this.diagramName = fileName.replace(/\.[^.]+$/, '') || 'Imported diagram';
    try { this.graph.zoomToFit({ padding: 24, maxScale: 1.5 }); } catch { /* framing is best-effort */ }
    if (isPartsCatalog) {
      this.status = `Imported ${cells.length} part${cells.length === 1 ? '' : 's'} from catalog`;
    } else {
      this.status = skipped
        ? `Imported ${cells.length} cells (skipped ${skipped} with unsupported shapes)`
        : `Imported ${cells.length} cells from JSON`;
    }
  }

  /**
   * Convert a parts-catalog API response (the `partserviceresult` shape produced by
   * the part-search service) into block-card node metadata, one card per part, laid
   * out in a grid. Returns `null` when the payload isn't a parts catalog so the
   * caller can fall through to its generic "not a diagram" handling.
   */
  private partsResultToCells(data: any): any[] | null {
    const parts = data?.partserviceresult?.parts;
    if (!Array.isArray(parts)) return null;

    const CARD_W = 240;
    const CARD_H = 140;
    const GAP_X = 32;
    const GAP_Y = 40;
    const cols = Math.max(1, Math.min(parts.length, 4));

    return parts.map((part: any, i: number) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      return this.buildPartCardCell(part, 40 + col * (CARD_W + GAP_X), 40 + row * (CARD_H + GAP_Y));
    });
  }

  /** Build a single part-card cell (shape + attrs) for a catalogue part object. */
  private buildPartCardCell(part: any, x: number, y: number): any {
    const CARD_W = 240;
    const CARD_H = 140;
    const title = part?.arwPartNum?.name || part?.suppPartNum?.name || part?.partKey || 'Part';
    const supplier = part?.supp?.name || part?.mfr?.name || part?.icc?.name || 'Component';

    // Index paramData by name so we can pull specs regardless of param slot order.
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
    const supply =
      supplyMin && supplyMax ? `${supplyMin} – ${supplyMax}`
        : (supplyMin || supplyMax || spec('Single Supply Voltage (Typ)'));
    const pkg = [spec('Pin Count') && `${spec('Pin Count')}-pin`, spec('Package Type')]
      .filter(Boolean).join(' ');
    const lines = [
      spec('Type') && `Type: ${spec('Type')}`,
      supply && `Supply: ${supply}`,
      spec('Number of Channels') && `Channels: ${spec('Number of Channels')}`,
      spec('Operating Temp Range') && `Temp: ${spec('Operating Temp Range')}`,
      pkg && `Pkg: ${pkg}`,
    ].filter(Boolean).slice(0, 4) as string[];

    const urls: any[] = Array.isArray(part?.urls) ? part.urls : [];
    const imgUrl =
      urls.find((u) => /image small/i.test(u?.type))?.URL ||
      urls.find((u) => /image/i.test(u?.type))?.URL || '';

    const tip = part?.invOrgs?.[0]?.desc || `${title} — ${supplier}`;
    return {
      shape: 'part-card',
      x, y, width: CARD_W, height: CARD_H,
      data: { typeKey: 'part', part },
      attrs: {
        tip: { text: String(tip) },
        img: imgUrl ? { 'xlink:href': imgUrl } : { 'xlink:href': '', opacity: 0 },
        title: { text: String(title) },
        supplier: { text: String(supplier) },
        spec0: { text: lines[0] || '' },
        spec1: { text: lines[1] || '' },
        spec2: { text: lines[2] || '' },
        spec3: { text: lines[3] || '' },
      },
    };
  }

  /** Drop a single searched part onto the canvas as a part card (at the centre). */
  addPartToCanvas(part: any): void {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const p = this.graph.clientToLocal(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const node = this.graph.addNode(this.buildPartCardCell(part, p.x - 120, p.y - 70));
    node.toFront(); // keep it on top of any block it's dropped over
    this.graph.resetSelection([node]);
    const name = part?.arwPartNum?.name || part?.suppPartNum?.name || 'part';
    this.notify.success(`Added "${name}"`);
  }

  /** Raise the selected cells above everything else. */
  bringToFront(): void {
    this.graph.getSelectedCells().forEach((c) => c.toFront());
  }

  /** Drop the selected cells behind everything else. */
  sendToBack(): void {
    this.graph.getSelectedCells().forEach((c) => c.toBack());
  }

  // ---------- draw.io interop ----------

  onDrawioSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.importDrawioXml(String(reader.result), file.name);
      reader.readAsText(file);
    }
    input.value = ''; // allow re-selecting the same file
  }

  /** Parse a .drawio/.xml file into editable nodes + edges on the canvas. */
  private async importDrawioXml(xml: string, fileName: string): Promise<void> {
    try {
      const { nodes, edges } = await importDrawio(xml);
      if (nodes.length === 0) {
        this.status = 'No shapes found in that draw.io file';
        return;
      }
      this.graph.startBatch('import-drawio');
      nodes.forEach((n) => this.graph.addNode(n));
      edges.forEach((e) => { try { this.graph.addEdge(e); } catch { /* skip dangling edge */ } });
      this.graph.stopBatch('import-drawio');

      if (!this.diagramName) this.diagramName = fileName.replace(/\.[^.]+$/, '');
      this.graph.zoomToFit({ padding: 24, maxScale: 1.5 });
      this.status = `Imported ${nodes.length} shapes from draw.io`;
      // fromJSON-style bulk add emits per-cell events, but push the whole canvas
      // to any active session so guests get the import in one shot.
      if (this.collab.active) this.collab.publishAll();
    } catch (err: any) {
      this.status = `draw.io import failed: ${err?.message || err}`;
    }
  }

  exportDrawioFile(): void {
    const xml = exportDrawio(this.graph, this.diagramName || 'diagram');
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.diagramName || 'diagram'}.drawio`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
