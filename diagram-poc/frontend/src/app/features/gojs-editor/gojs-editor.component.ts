import {
  AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy,
  OnInit, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as go from 'gojs';
import { BlockType, DiagramService, DiagramSummary } from '../../core/services/diagram.service';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { symbolInfo } from './gojs-symbols';

/**
 * GoJS-based diagram editor — the replacement canvas for the electronics-aware
 * block-diagram builder. Renders functional block cards, catalogue part cards,
 * imported images, and the full electrical / animated / basic shape libraries
 * (via {@link symbolInfo}). Provides a grouped drag-and-drop palette, port-based
 * linking, selection → properties editing, undo/redo, zoom, copy/paste,
 * align/distribute, autosave, and PNG / SVG / JSON export.
 *
 * The Diagram is built outside the Angular zone; selection and model changes are
 * synced back in via NgZone. Diagrams persist as `model.toJson()` strings.
 *
 * Migration status: this is the single-user core. Real-time collaboration
 * (Yjs), draw.io round-trip, node-anchored comments and the AI/catalogue dialogs
 * are layered on in subsequent phases.
 */
@Component({
  selector: 'app-gojs-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatTooltipModule],
  templateUrl: './gojs-editor.component.html',
  styleUrls: ['./gojs-editor.component.css'],
  providers: [],
})
export class GojsEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLDivElement>;
  @ViewChild('palette', { static: true }) paletteRef!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('imageInput') imageInput!: ElementRef<HTMLInputElement>;

  private diagram!: go.Diagram;
  private palette!: go.Palette;
  private selectedNode: go.Part | null = null;
  private diagramId: number | null = null;
  private autosaveTimer: any = null;
  private suppressAutosave = false;

  diagramName = 'Untitled diagram';
  status = '';
  saving = false;
  /** Palette block types grouped by category. */
  categories: { name: string; blocks: BlockType[] }[] = [];
  /** Editable properties of the selected node (bound to the panel). */
  sel: {
    text: string; color: string;
    partNumber?: string; supplier?: string; quantity?: number;
    isPart: boolean;
  } | null = null;

  constructor(
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private diagrams: DiagramService,
    private notify: NotificationService,
    private auth: AuthService,
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
    if (this.diagram) this.diagram.div = null;
    if (this.palette) this.palette.div = null;
  }

  // ---- keyboard ----

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); this.save(); }
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
      'clickCreatingTool.archetypeNodeData': null,
    });

    this.buildTemplates($);

    this.diagram.model = this.emptyModel();

    // Sync selection back into Angular for the properties panel.
    this.diagram.addDiagramListener('ChangedSelection', () =>
      this.zone.run(() => this.syncSelection()));
    this.diagram.addDiagramListener('TextEdited', () =>
      this.zone.run(() => this.syncSelection()));
    // Autosave on any model change (add/remove/move/edit).
    this.diagram.addModelChangedListener((e) => {
      if (e.isTransactionFinished) this.scheduleAutosave();
    });

    this.palette = new go.Palette(this.paletteRef.nativeElement, {
      nodeTemplateMap: this.diagram.nodeTemplateMap,
      'contentAlignment': go.Spot.TopCenter,
      layout: $(go.GridLayout, {
        wrappingColumn: 1, cellSize: new go.Size(1, 1), spacing: new go.Size(6, 8),
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

  /** Define all node templates and the link template. */
  private buildTemplates($: typeof go.GraphObject.make): void {
    const portItem = $(
      go.Panel, 'Spot',
      new go.Binding('alignment', 'spot'),
      $(
        go.Shape, 'Circle',
        {
          width: 8, height: 8, fill: '#0f172a', stroke: '#22d3ee', strokeWidth: 1.5,
          cursor: 'crosshair',
          fromLinkable: true, toLinkable: true,
          fromSpot: go.Spot.AllSides, toSpot: go.Spot.AllSides,
        },
        new go.Binding('portId', 'portId'),
      ),
    );

    // -- functional block card (default) --
    const block = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: false },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      $(
        go.Panel, 'Auto',
        {
          portId: '', cursor: 'pointer',
          fromLinkable: true, toLinkable: true,
          fromSpot: go.Spot.AllSides, toSpot: go.Spot.AllSides,
        },
        $(go.Shape, 'RoundedRectangle',
          { parameter1: 10, fill: '#ffffff', stroke: '#d2d6dc', strokeWidth: 1.5, minSize: new go.Size(150, 52) },
          new go.Binding('stroke', 'color')),
        $(
          go.Panel, 'Horizontal',
          { margin: 8 },
          $(go.Panel, 'Auto',
            { width: 36, height: 36, margin: new go.Margin(0, 8, 0, 0) },
            $(go.Shape, 'RoundedRectangle', { parameter1: 8, strokeWidth: 0 },
              new go.Binding('fill', 'color')),
            $(go.TextBlock,
              { font: '20px Material Icons', stroke: '#ffffff' },
              new go.Binding('text', 'icon'))),
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
    this.diagram.nodeTemplate = block; // default

    // -- catalogue part card --
    const part = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      $(
        go.Panel, 'Auto',
        {
          portId: '', cursor: 'pointer',
          fromLinkable: true, toLinkable: true,
          fromSpot: go.Spot.AllSides, toSpot: go.Spot.AllSides,
        },
        $(go.Shape, 'RoundedRectangle',
          { parameter1: 10, fill: '#ffffff', stroke: '#d2d6dc', strokeWidth: 1.5 }),
        $(
          go.Panel, 'Table',
          { margin: 12, minSize: new go.Size(216, 0) },
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
              itemTemplate: $(go.Panel, 'Auto',
                { alignment: go.Spot.Left },
                $(go.TextBlock,
                  { font: '10.5px Roboto, sans-serif', stroke: '#374151', alignment: go.Spot.Left },
                  new go.Binding('text', ''))),
            }),
        ),
      ),
    );
    this.diagram.nodeTemplateMap.set('part', part);

    // -- imported image --
    const image = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify),
      $(
        go.Panel, 'Vertical',
        {
          portId: '', cursor: 'pointer',
          fromLinkable: true, toLinkable: true,
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

    // -- schematic / animated symbol (multi-pin) --
    const symbol = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify),
      $(go.Picture,
        { imageStretch: go.GraphObject.Fill, background: 'transparent' },
        new go.Binding('source', 'source'),
        new go.Binding('desiredSize', 'size', go.Size.parse)),
      // caption below
      $(go.TextBlock,
        {
          alignment: new go.Spot(0.5, 1, 0, 14), alignmentFocus: go.Spot.Top,
          font: '11px Roboto, sans-serif', stroke: '#94a3b8', editable: true,
        },
        new go.Binding('text').makeTwoWay()),
      // pins
      $(go.Panel, 'Spot',
        new go.Binding('itemArray', 'ports'),
        { itemTemplate: portItem }),
    );
    this.diagram.nodeTemplateMap.set('symbol', symbol);

    // -- basic flowchart shape (centered editable label + 4 ports) --
    const basic = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify),
      $(go.Picture,
        { imageStretch: go.GraphObject.Fill, background: 'transparent' },
        new go.Binding('source', 'source'),
        new go.Binding('desiredSize', 'size', go.Size.parse)),
      $(go.TextBlock,
        {
          alignment: go.Spot.Center, font: '13px Roboto, sans-serif', stroke: '#1f2937',
          editable: true, maxSize: new go.Size(160, NaN), textAlign: 'center',
        },
        new go.Binding('text').makeTwoWay()),
      $(go.Panel, 'Spot',
        new go.Binding('itemArray', 'ports'),
        { itemTemplate: portItem }),
    );
    this.diagram.nodeTemplateMap.set('basic', basic);

    // -- link --
    this.diagram.linkTemplate = $(
      go.Link,
      {
        routing: go.Link.AvoidsNodes, corner: 8,
        relinkableFrom: true, relinkableTo: true, reshapable: true, resegmentable: true,
      },
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
      error: () => {
        this.categories = [];
      },
    });
  }

  /** Populate the GoJS palette from the loaded block types. */
  private refreshPaletteModel(): void {
    if (!this.palette) return;
    const data: go.ObjectData[] = [];
    for (const cat of this.categories) {
      for (const b of cat.blocks) {
        data.push(this.paletteNodeData(b));
      }
    }
    this.zone.runOutsideAngular(() => {
      this.palette.model = this.emptyModel();
      (this.palette.model as go.GraphLinksModel).nodeDataArray = data;
    });
  }

  /** Build node data for a palette entry from a BlockType. */
  private paletteNodeData(b: BlockType): go.ObjectData {
    const info = symbolInfo(b.shape);
    if (info) {
      return {
        category: info.basic ? 'basic' : 'symbol',
        text: b.label,
        shape: b.shape,
        source: info.source,
        size: `${info.width} ${info.height}`,
        ports: info.pins.map((p, i) => ({ portId: `p${i}`, spot: new go.Spot(p.fx, p.fy) })),
      };
    }
    // functional block card
    return {
      category: 'block',
      text: b.label,
      subtitle: b.category || 'Module',
      color: b.color || '#1d4ed8',
      icon: b.icon || 'widgets',
    };
  }

  // ---- selection / properties ----

  private syncSelection(): void {
    const n = this.diagram.selection.first();
    if (n instanceof go.Node) {
      this.selectedNode = n;
      const d = n.data;
      const isPart = d.category === 'part';
      this.sel = {
        text: d.text ?? '',
        color: d.color ?? '#1d4ed8',
        isPart,
        partNumber: d.partNumber,
        supplier: d.supplier,
        quantity: d.quantity,
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
    this.zone.runOutsideAngular(() =>
      this.diagram.model.commit((m) => m.set(data, prop, value), 'edit ' + prop));
    if (this.sel) (this.sel as any)[prop] = value;
  }

  setColor(color: string): void { this.setField('color', color); }

  setQuantity(value: any): void {
    const q = Math.max(1, Number(value) || 1);
    this.setField('quantity', q);
  }

  // ---- toolbar / commands ----

  newDiagram(): void {
    this.suppressAutosave = true;
    this.zone.runOutsideAngular(() => { this.diagram.model = this.emptyModel(); });
    this.diagramId = null;
    this.diagramName = 'Untitled diagram';
    this.status = 'New diagram';
    this.suppressAutosave = false;
    this.syncSelection();
  }

  zoomIn(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.increaseZoom()); }
  zoomOut(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.decreaseZoom()); }
  zoomToFit(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.zoomToFit()); }
  zoomReset(): void { this.zone.runOutsideAngular(() => { this.diagram.scale = 1; }); }

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

  /** Align selected nodes along an edge or center. */
  align(mode: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'middle'): void {
    const nodes = this.selectedNodes();
    if (nodes.length < 2) return;
    this.zone.runOutsideAngular(() => {
      this.diagram.commit((d) => {
        const rects = nodes.map((n) => n.actualBounds);
        const minX = Math.min(...rects.map((r) => r.x));
        const maxX = Math.max(...rects.map((r) => r.right));
        const minY = Math.min(...rects.map((r) => r.y));
        const maxY = Math.max(...rects.map((r) => r.bottom));
        const cX = (minX + maxX) / 2;
        const cY = (minY + maxY) / 2;
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
      }, 'align');
    });
  }

  /** Distribute selected nodes evenly along an axis. */
  distribute(axis: 'h' | 'v'): void {
    const nodes = this.selectedNodes();
    if (nodes.length < 3) return;
    this.zone.runOutsideAngular(() => {
      this.diagram.commit(() => {
        const sorted = [...nodes].sort((a, b) =>
          axis === 'h' ? a.actualBounds.x - b.actualBounds.x : a.actualBounds.y - b.actualBounds.y);
        const first = sorted[0].actualBounds;
        const last = sorted[sorted.length - 1].actualBounds;
        const start = axis === 'h' ? first.x : first.y;
        const end = axis === 'h' ? last.x : last.y;
        const step = (end - start) / (sorted.length - 1);
        sorted.forEach((n, i) => {
          const b = n.actualBounds;
          if (axis === 'h') n.move(new go.Point(start + step * i, b.y));
          else n.move(new go.Point(b.x, start + step * i));
        });
      }, 'distribute');
    });
  }

  bringToFront(): void {
    this.zone.runOutsideAngular(() => this.diagram.commit(() => {
      let z = 0;
      this.diagram.nodes.each((n) => { if (n.zOrder != null) z = Math.max(z, n.zOrder); });
      this.selectedNodes().forEach((n) => (n.zOrder = ++z));
    }, 'to front'));
  }

  sendToBack(): void {
    this.zone.runOutsideAngular(() => this.diagram.commit(() => {
      let z = 0;
      this.diagram.nodes.each((n) => { if (n.zOrder != null) z = Math.min(z, n.zOrder); });
      this.selectedNodes().forEach((n) => (n.zOrder = --z));
    }, 'to back'));
  }

  private selectedNodes(): go.Node[] {
    const out: go.Node[] = [];
    this.diagram.selection.each((p) => { if (p instanceof go.Node) out.push(p); });
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
      this.zone.runOutsideAngular(() => {
        this.diagram.model.commit((m) => {
          (m as go.GraphLinksModel).addNodeData({
            category: 'image', img: src, text: file.name.replace(/\.[^.]+$/, ''),
            loc: go.Point.stringify(c), size: '160 120',
          });
        }, 'add image');
      });
    };
    reader.readAsDataURL(file);
    (event.target as HTMLInputElement).value = '';
  }

  // ---- persistence ----

  save(then?: () => void): void {
    const contentJson = this.diagram.model.toJson();
    const dto = { name: this.diagramName || 'Untitled diagram', contentJson };
    this.saving = true;
    const done = (d: DiagramSummary | any) => {
      this.saving = false;
      if (d?.id) this.diagramId = d.id;
      this.status = 'Saved';
      this.cdr.detectChanges();
      then?.();
    };
    if (this.diagramId) {
      this.diagrams.update(this.diagramId, dto).subscribe({ next: done, error: () => this.onSaveError() });
    } else {
      this.diagrams.create(dto).subscribe({ next: done, error: () => this.onSaveError() });
    }
  }

  private onSaveError(): void {
    this.saving = false;
    this.notify.error('Could not save the diagram.');
    this.cdr.detectChanges();
  }

  private doLoad(id: number): void {
    this.diagrams.get(id).subscribe({
      next: (dto) => {
        this.diagramName = dto.name;
        this.diagramId = dto.id ?? id;
        this.applyContent(dto.contentJson);
      },
      error: () => this.notify.error('Could not open that diagram.'),
    });
  }

  /** Load a saved content string into the model, tolerating legacy (X6) files. */
  private applyContent(contentJson: string): void {
    if (!contentJson) { this.newDiagram(); return; }
    let parsed: any;
    try { parsed = JSON.parse(contentJson); } catch { parsed = null; }
    if (parsed && Array.isArray(parsed.cells)) {
      // Legacy X6 format — not renderable by GoJS. Start clean and warn.
      this.zone.run(() =>
        this.notify.info('This diagram was created in the previous editor and cannot be shown here yet.'));
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
    if (this.suppressAutosave) return;
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
    const blob = new Blob([text], { type: 'image/svg+xml' });
    this.download(URL.createObjectURL(blob), this.fileName('svg'));
  }

  exportJson(): void {
    const blob = new Blob([this.diagram.model.toJson()], { type: 'application/json' });
    this.download(URL.createObjectURL(blob), this.fileName('gojs.json'));
  }

  importJson(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.applyContent(String(reader.result));
      this.status = `Imported "${file.name}"`;
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
  }

  private fileName(ext: string): string {
    return (this.diagramName || 'diagram').replace(/[^\w.-]+/g, '_') + '.' + ext;
  }

  private download(href: string, filename: string): void {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
    if (href.startsWith('blob:')) URL.revokeObjectURL(href);
  }
}
