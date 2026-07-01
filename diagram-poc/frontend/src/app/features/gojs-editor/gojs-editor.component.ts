import {
  AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import * as go from 'gojs';

interface PaletteBlock { text: string; color: string; }

/**
 * GoJS-based diagram editor (migration foundation). Provides a freeform canvas
 * with a drag-and-drop palette, node linking, selection → properties editing,
 * zoom, and PNG / JSON export. Built following the GoJS + Angular pattern: the
 * Diagram is created outside the Angular zone, and selection is synced back in.
 *
 * This is phase 1 of the X6→GoJS migration — the core canvas. Peripheral
 * features from the X6 editor (collaboration, electrical-symbol library, part
 * catalogue, exports to draw.io, AI panels) are migrated in later phases.
 */
@Component({
  selector: 'app-gojs-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatTooltipModule],
  templateUrl: './gojs-editor.component.html',
  styleUrls: ['./gojs-editor.component.css'],
})
export class GojsEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLDivElement>;
  @ViewChild('palette', { static: true }) paletteRef!: ElementRef<HTMLDivElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private diagram!: go.Diagram;
  private palette!: go.Palette;
  private selectedNode: go.Node | null = null;

  diagramName = 'Untitled diagram';
  status = '';
  /** Editable properties of the selected node (bound to the panel). */
  sel: { text: string; color: string } | null = null;

  /** Palette block types (freeform functional blocks). */
  readonly blocks: PaletteBlock[] = [
    { text: 'Processor', color: '#2563eb' },
    { text: 'Power', color: '#f59e0b' },
    { text: 'Sensor', color: '#22c55e' },
    { text: 'Memory', color: '#8b5cf6' },
    { text: 'Interface', color: '#ef4444' },
    { text: 'Module', color: '#0ea5e9' },
    { text: 'Block', color: '#334155' },
  ];

  constructor(private zone: NgZone, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.initDiagram());
  }

  ngOnDestroy(): void {
    if (this.diagram) this.diagram.div = null;
    if (this.palette) this.palette.div = null;
  }

  private initDiagram(): void {
    const $ = go.GraphObject.make;

    this.diagram = new go.Diagram(this.canvasRef.nativeElement, {
      'undoManager.isEnabled': true,
      'grid.visible': true,
      allowDrop: true,
      'draggingTool.isGridSnapEnabled': true,
      'linkingTool.isUnconnectedLinkValid': false,
      initialContentAlignment: go.Spot.Center,
      minScale: 0.2,
      maxScale: 3,
    });

    // Node: rounded card with an editable label; whole node is a link port.
    this.diagram.nodeTemplate = $(
      go.Node, 'Auto',
      { locationSpot: go.Spot.Center },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      $(go.Shape, 'RoundedRectangle',
        {
          strokeWidth: 2, portId: '', cursor: 'pointer',
          fromLinkable: true, toLinkable: true,
          fromLinkableSelfNode: false, toLinkableSelfNode: false,
          fromSpot: go.Spot.AllSides, toSpot: go.Spot.AllSides,
        },
        new go.Binding('fill', 'color'),
        new go.Binding('stroke', 'color')),
      $(go.TextBlock,
        { margin: 12, editable: true, font: '600 13px Roboto, sans-serif', stroke: '#ffffff',
          maxSize: new go.Size(160, NaN), textAlign: 'center' },
        new go.Binding('text').makeTwoWay()),
    );

    // Orthogonal links with an arrowhead.
    this.diagram.linkTemplate = $(
      go.Link,
      { routing: go.Link.Orthogonal, corner: 8, relinkableFrom: true, relinkableTo: true, reshapable: true },
      $(go.Shape, { strokeWidth: 2, stroke: '#94a3b8' }),
      $(go.Shape, { toArrow: 'Standard', fill: '#94a3b8', stroke: null }),
    );

    this.diagram.model = new go.GraphLinksModel<go.ObjectData, go.ObjectData>([], []);

    // Sync selection back into Angular for the properties panel.
    this.diagram.addDiagramListener('ChangedSelection', () =>
      this.zone.run(() => this.syncSelection()));
    // Reflect inline label edits in the panel.
    this.diagram.addDiagramListener('TextEdited', () =>
      this.zone.run(() => this.syncSelection()));

    // Palette shares the node template so drags land as real nodes.
    this.palette = new go.Palette(this.paletteRef.nativeElement, {
      nodeTemplateMap: this.diagram.nodeTemplateMap,
      model: new go.GraphLinksModel<go.ObjectData, go.ObjectData>(
        this.blocks.map((b) => ({ text: b.text, color: b.color })),
      ),
    });
  }

  private syncSelection(): void {
    const n = this.diagram.selection.first();
    if (n instanceof go.Node) {
      this.selectedNode = n;
      this.sel = { text: n.data.text ?? '', color: n.data.color ?? '#334155' };
    } else {
      this.selectedNode = null;
      this.sel = null;
    }
    this.cdr.detectChanges();
  }

  // ---- properties ----

  setField(prop: 'text' | 'color', value: string): void {
    if (!this.selectedNode) return;
    const data = this.selectedNode.data;
    this.zone.runOutsideAngular(() =>
      this.diagram.model.commit((m) => m.set(data, prop, value), 'edit ' + prop));
    if (this.sel) this.sel[prop] = value;
  }

  // ---- toolbar ----

  newDiagram(): void {
    this.zone.runOutsideAngular(() => {
      this.diagram.model = new go.GraphLinksModel<go.ObjectData, go.ObjectData>([], []);
    });
    this.diagramName = 'Untitled diagram';
    this.status = 'New diagram';
    this.syncSelection();
  }

  zoomIn(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.increaseZoom()); }
  zoomOut(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.decreaseZoom()); }
  zoomToFit(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.zoomToFit()); }
  deleteSelection(): void {
    this.zone.runOutsideAngular(() => this.diagram.commandHandler.deleteSelection());
    this.syncSelection();
  }
  undo(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.undo()); }
  redo(): void { this.zone.runOutsideAngular(() => this.diagram.commandHandler.redo()); }

  exportPng(): void {
    const data = this.diagram.makeImageData({ background: '#0e0f11', scale: 2, type: 'image/png' });
    if (typeof data === 'string') this.download(data, (this.diagramName || 'diagram') + '.png');
  }

  exportJson(): void {
    const blob = new Blob([this.diagram.model.toJson()], { type: 'application/json' });
    this.download(URL.createObjectURL(blob), (this.diagramName || 'diagram') + '.gojs.json');
  }

  importJson(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const model = go.Model.fromJson(String(reader.result)) as go.GraphLinksModel;
        this.zone.runOutsideAngular(() => { this.diagram.model = model; });
        this.status = `Imported "${file.name}"`;
      } catch {
        this.status = 'Could not read that file';
      }
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
  }

  private download(href: string, filename: string): void {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
    if (href.startsWith('blob:')) URL.revokeObjectURL(href);
  }
}
