import * as go from 'gojs';
import React, { useEffect, useRef } from 'react';
import { DiagramGraph, linkId } from './model';
import { ANIM_GLYPH, electricalSvgUri, registerFigures, SHAPE_FIGURE } from './gojsAssets';
import { animFrameUri, isDetailedAnim } from './animShapes';

/**
 * Web diagram surface backed by GoJS — the same engine the Angular app uses, so
 * the web build gets premium orthogonal wire routing, native link-drawing and
 * crisp rendering. React Native (iOS/Android) uses the SVG DiagramCanvas.tsx;
 * Metro picks this `.web.tsx` for the web bundle automatically.
 */
interface Props {
  graph: DiagramGraph;
  selectedKey: string | null;
  selectedEdge?: string | null;
  onSelect: (key: string | null) => void;
  onSelectEdge?: (id: string | null) => void;
  onNodeGrab?: (key: string) => void;
  onNodeMove: (key: string, x: number, y: number) => void;
  // Native-only live drag streaming; GoJS reports moves once on drop, so unused here.
  onNodeMoveLive?: (key: string, x: number, y: number) => void;
  onLinkCreate?: (fromKey: string, toKey: string, fromPort?: string, toPort?: string) => void;
}

const $ = go.GraphObject.make;

// Production license key (removes the evaluation watermark). Supply it at build
// time as EXPO_PUBLIC_GOJS_LICENSE — never hard-code a key in the repo.
const LICENSE = process.env.EXPO_PUBLIC_GOJS_LICENSE;
if (LICENSE) (go as unknown as { Diagram: { licenseKey: string } }).Diagram.licenseKey = LICENSE;

function buildDiagram(div: HTMLDivElement): go.Diagram {
  registerFigures();
  const dia = new go.Diagram(div, {
    'undoManager.isEnabled': false,
    'animationManager.isEnabled': false,
    allowDrop: false,
    contentAlignment: go.Spot.Center,
    initialAutoScale: go.Diagram.Uniform,
    padding: 40,
    'linkingTool.isEnabled': true,
    'toolManager.hoverDelay': 300,
    grid: $(
      go.Panel,
      'Grid',
      { gridCellSize: new go.Size(20, 20) },
      $(go.Shape, 'LineH', { stroke: '#ECEEF1', strokeWidth: 1 }),
      $(go.Shape, 'LineH', { stroke: '#DFE3E8', strokeWidth: 1, interval: 5 }),
      $(go.Shape, 'LineV', { stroke: '#ECEEF1', strokeWidth: 1 }),
      $(go.Shape, 'LineV', { stroke: '#DFE3E8', strokeWidth: 1, interval: 5 }),
    ),
    model: new go.GraphLinksModel({ linkKeyProperty: 'key', linkFromPortIdProperty: 'fromPort', linkToPortIdProperty: 'toPort' }),
  });

  const port = {
    portId: '',
    fromLinkable: true,
    toLinkable: true,
    fromSpot: go.Spot.AllSides,
    toSpot: go.Spot.AllSides,
    cursor: 'pointer',
  } as const;

  // One named connection port (from the node's `ports` array) at its spot, so
  // wires that name a fromPort/toPort attach exactly where the model says.
  const portItem = $(
    go.Panel,
    new go.Binding('alignment', 'spot', go.Spot.parse),
    $(
      go.Shape,
      'Circle',
      { desiredSize: new go.Size(8, 8), fill: 'rgba(0,0,0,0)', strokeWidth: 0, fromLinkable: true, toLinkable: true, cursor: 'crosshair' },
      new go.Binding('portId', 'portId'),
      new go.Binding('fromSpot', 'spot', (s: string) => nearestSide(s)),
      new go.Binding('toSpot', 'spot', (s: string) => nearestSide(s)),
    ),
  );
  const portsBind = new go.Binding('itemArray', 'ports');

  // Rounded highlight shared by every node's selection.
  const selAdorn = $(
    go.Adornment,
    'Auto',
    $(go.Shape, 'RoundedRectangle', { fill: null, stroke: '#0084D5', strokeWidth: 2, parameter1: 10 }),
    $(go.Placeholder, { padding: 5 }),
  );

  // Shared hover tooltip — a dark "sticky note" with the node's parts details,
  // mirroring the Angular desktop editor. GoJS copies this template per hover.
  const nodeTip = $(
    'ToolTip',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { 'Border.fill': '#1F1F1F', 'Border.stroke': '#2E2E2E', 'Border.strokeWidth': 1 } as any,
    $(
      go.TextBlock,
      { margin: 8, font: '11px Inter, Roboto, sans-serif', stroke: '#ececef', maxSize: new go.Size(280, NaN) },
      new go.Binding('text', '', tooltipFor),
    ),
  );

  const nodeBase = {
    // Matches the desktop app: loc is the node centre.
    locationSpot: go.Spot.Center,
    selectionAdorned: true,
    selectionAdornmentTemplate: selAdorn,
    toolTip: nodeTip,
    resizable: false,
    isShadowed: true,
    shadowColor: 'rgba(15, 23, 42, 0.16)',
    shadowBlur: 9,
    shadowOffset: new go.Point(0, 3),
  };
  const loc = new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify);
  // Refdes + value on two lines (e.g. "R1" / "10 kΩ"), like the desktop editor.
  const labelText = (d: any) => [d.text, d.value].filter(Boolean).join('\n');

  // Electrical symbol → bare go.Picture (inline-SVG data URI), no box. A boxed
  // shadow would look wrong on a schematic, so symbols aren't shadowed. The
  // graphic is wrapped in a Spot panel that carries the named ports.
  dia.nodeTemplateMap.add(
    'symbol',
    $(
      go.Node,
      'Vertical',
      nodeBase,
      { isShadowed: false },
      loc,
      $(
        go.Panel,
        'Spot',
        portsBind,
        { itemTemplate: portItem },
        $(
          go.Picture,
          { ...port, imageStretch: go.GraphObject.Fill },
          new go.Binding('source', 'shape', (s: string) => electricalSvgUri(s)?.uri ?? ''),
          new go.Binding('desiredSize', 'size', go.Size.parse),
        ),
      ),
      $(
        go.TextBlock,
        { font: '600 11px Inter, sans-serif', stroke: '#5B6470', textAlign: 'center', margin: new go.Margin(3, 0, 0, 0) },
        new go.Binding('text', '', labelText),
      ),
    ),
  );

  // Basic shape → native GoJS figure + centred label + named ports.
  dia.nodeTemplateMap.add(
    'shape',
    $(
      go.Node,
      'Spot',
      nodeBase,
      loc,
      portsBind,
      { itemTemplate: portItem },
      $(
        go.Shape,
        { ...port, strokeWidth: 1.8, stroke: '#475569' },
        new go.Binding('figure', 'shape', (s: string) => SHAPE_FIGURE[s] ?? 'RoundedRectangle'),
        new go.Binding('fill', 'color', (c: string) => c || '#e2e8f0'),
        new go.Binding('desiredSize', 'size', go.Size.parse),
      ),
      $(go.TextBlock, { font: '600 13px Inter, sans-serif', stroke: '#0f172a', textAlign: 'center' }, new go.Binding('text', '', labelText)),
    ),
  );

  // Functional block → gradient rounded rectangle + label + named ports.
  dia.nodeTemplateMap.add(
    'block',
    $(
      go.Node,
      'Spot',
      nodeBase,
      loc,
      portsBind,
      { itemTemplate: portItem },
      $(
        go.Shape,
        'RoundedRectangle',
        { ...port, parameter1: 12, strokeWidth: 0 },
        new go.Binding('fill', 'color', (c: string) => gradient(c || '#4f46e5')),
        new go.Binding('desiredSize', 'size', go.Size.parse),
      ),
      $(go.TextBlock, { margin: 12, stroke: '#ffffff', font: '700 13px Inter, sans-serif', textAlign: 'center' }, new go.Binding('text')),
    ),
  );

  // Catalogue part → white card with a coloured accent bar, bold MPN, supplier
  // line and spec rows — matches the Angular desktop `part` node template.
  dia.nodeTemplateMap.add(
    'part',
    $(
      go.Node,
      'Spot',
      nodeBase,
      loc,
      portsBind,
      { itemTemplate: portItem },
      $(
        go.Panel,
        'Auto',
        $(
          go.Shape,
          'RoundedRectangle',
          { ...port, parameter1: 10, fill: '#ffffff', stroke: '#D2D6DC', strokeWidth: 1.5 },
          new go.Binding('desiredSize', 'size', go.Size.parse),
        ),
        $(
          go.Panel,
          'Table',
          { margin: 12, minSize: new go.Size(200, 0), stretch: go.GraphObject.Fill },
          $(go.RowColumnDefinition, { column: 0, stretch: go.GraphObject.Horizontal }),
          $(go.Shape, 'Rectangle', {
            row: 0,
            column: 0,
            columnSpan: 2,
            height: 4,
            strokeWidth: 0,
            fill: '#0084D5',
            stretch: go.GraphObject.Horizontal,
            margin: new go.Margin(0, 0, 6, 0),
          }),
          $(
            go.TextBlock,
            { row: 1, column: 0, font: '700 13px Inter, sans-serif', stroke: '#111827', alignment: go.Spot.Left },
            new go.Binding('text'),
          ),
          $(
            go.TextBlock,
            { row: 2, column: 0, font: '10.5px Inter, sans-serif', stroke: '#6B7280', alignment: go.Spot.Left },
            new go.Binding('text', 'supplier'),
          ),
          $(
            go.Panel,
            'Vertical',
            { row: 3, column: 0, columnSpan: 2, alignment: go.Spot.Left, margin: new go.Margin(4, 0, 0, 0) },
            new go.Binding('itemArray', 'specs'),
            {
              itemTemplate: $(
                go.Panel,
                'Auto',
                { alignment: go.Spot.Left },
                $(
                  go.TextBlock,
                  { font: '10.5px Inter, sans-serif', stroke: '#374151', alignment: go.Spot.Left },
                  new go.Binding('text', ''),
                ),
              ),
            },
          ),
        ),
      ),
    ),
  );

  // Animated component → detailed animated glyph for the 20+ ported shapes
  // (solar, turbine, robot arm, …), else a compact coloured glyph fallback.
  // The Picture's source is a baked SVG frame refreshed by an animation timer
  // (see the init effect), so it moves just like the Angular desktop editor.
  dia.nodeTemplateMap.add(
    'anim',
    $(
      go.Node,
      'Vertical',
      nodeBase,
      loc,
      $(
        go.Panel,
        'Spot',
        portsBind,
        { itemTemplate: portItem },
        $(
          go.Picture,
          { ...port, imageStretch: go.GraphObject.Fill },
          new go.Binding('visible', 'shape', (s: string) => isDetailedAnim(s)),
          new go.Binding('desiredSize', 'size', go.Size.parse),
          // Static frame 0 — animations are disabled in this app.
          new go.Binding('source', 'shape', (s: string) => (isDetailedAnim(s) ? animFrameUri(s, 0) : '')),
        ),
        $(
          go.Shape,
          { ...port, strokeWidth: 2, desiredSize: new go.Size(52, 52) },
          new go.Binding('visible', 'shape', (s: string) => !isDetailedAnim(s)),
          new go.Binding('figure', 'shape', (s: string) => ANIM_GLYPH[s]?.figure ?? 'Circle'),
          new go.Binding('fill', 'shape', (s: string) => (ANIM_GLYPH[s]?.color ?? '#f59e0b') + '22'),
          new go.Binding('stroke', 'shape', (s: string) => ANIM_GLYPH[s]?.color ?? '#f59e0b'),
        ),
      ),
      $(
        go.TextBlock,
        { font: '600 11px Inter, sans-serif', stroke: '#5B6470', textAlign: 'center', margin: new go.Margin(3, 0, 0, 0) },
        new go.Binding('text', '', labelText),
      ),
    ),
  );

  // Fallback: a simple labelled rounded rectangle + named ports.
  dia.nodeTemplate = $(
    go.Node,
    'Spot',
    nodeBase,
    loc,
    portsBind,
    { itemTemplate: portItem },
    $(go.Shape, 'RoundedRectangle', { ...port, fill: '#e2e8f0', strokeWidth: 1, parameter1: 10 }, new go.Binding('desiredSize', 'size', go.Size.parse)),
    $(go.TextBlock, { margin: 10, font: '600 13px Inter, sans-serif' }, new go.Binding('text')),
  );

  // Orthogonal routing — matches the Angular desktop editor's link template
  // exactly: sharp corners on wires (corner 0), rounded (8) on other links, and
  // no jump-overs (curve None; Bezier only for the smooth router).
  dia.linkTemplate = $(
    go.Link,
    {
      routing: go.Link.Orthogonal,
      corner: 8,
      curve: go.Link.None,
      relinkableFrom: true,
      relinkableTo: true,
      reshapable: true,
      selectable: true,
    },
    new go.Binding('routing', 'routing', (r: string) => (r === 'normal' || r === 'smooth' ? go.Link.Normal : go.Link.Orthogonal)),
    new go.Binding('curve', 'routing', (r: string) => (r === 'smooth' ? go.Link.Bezier : go.Link.None)),
    new go.Binding('corner', 'wire', (w: boolean) => (w ? 0 : 8)),
    $(
      go.Shape,
      { strokeWidth: 2, stroke: '#66707C', strokeCap: 'round', shadowVisible: false },
      new go.Binding('stroke', 'color', (c: string) => c || '#66707C'),
      new go.Binding('strokeWidth', 'width', (w: number) => w || 2),
      new go.Binding('strokeDashArray', 'dash'),
    ),
  );

  return dia;
}

/** Hover "sticky note" body for a node: name, value/type, attached parts, AI comps. */
function tooltipFor(d: any): string {
  const lines: string[] = [];
  const shape = String(d.shape || '');
  if (d.category === 'symbol' && shape.startsWith('elec-')) {
    lines.push([d.text, symbolLabel(shape)].filter(Boolean).join(' — '));
    if (d.value) lines.push(`Value: ${d.value}`);
  } else {
    lines.push(d.text || shape || 'Block');
    if (d.value) lines.push(`Value: ${d.value}`);
  }
  const attached = Array.isArray(d.attachedParts) ? d.attachedParts : [];
  if (attached.length) {
    lines.push(`Attached parts (${attached.length}):`);
    for (const ap of attached) {
      const p = ap?.part ?? ap ?? {};
      const pn = p.partNumber || p.arwPartNum?.name || 'Part';
      const meta = [p.manufacturer, p.supplier].filter(Boolean).join(' · ');
      lines.push(`• ${pn} (×${ap?.quantity ?? 1})${meta ? ` — ${meta}` : ''}`);
    }
  }
  const comps = Array.isArray(d.components) ? d.components : [];
  if (comps.length) lines.push(`AI components: ${comps.map((c: any) => c.partNumber).filter(Boolean).join(', ')}`);
  return lines.filter(Boolean).join('\n');
}

/** Human label for an elec-* symbol id (e.g. "elec-resistor" → "Resistor"). */
function symbolLabel(shape: string): string {
  const base = shape.replace(/^elec-/, '').replace(/[-_]/g, ' ');
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : '';
}

/** Which side a fractional spot ("fx fy") is nearest to, so wires leave the port outward. */
function nearestSide(spot: string): go.Spot {
  const sp = go.Spot.parse(spot);
  if (!sp.isSpot()) return go.Spot.AllSides;
  const dl = sp.x;
  const dr = 1 - sp.x;
  const dt = sp.y;
  const db = 1 - sp.y;
  const m = Math.min(dl, dr, dt, db);
  return m === dl ? go.Spot.Left : m === dr ? go.Spot.Right : m === dt ? go.Spot.Top : go.Spot.Bottom;
}

/** Darken a #rrggbb colour by `amt` (0..1). */
function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return hex;
  const r = Math.round(parseInt(h.slice(0, 2), 16) * (1 - amt));
  const g = Math.round(parseInt(h.slice(2, 4), 16) * (1 - amt));
  const b = Math.round(parseInt(h.slice(4, 6), 16) * (1 - amt));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** A subtle top→bottom gradient brush from a base colour. */
function gradient(base: string): go.Brush {
  const b = new go.Brush('Linear');
  b.start = go.Spot.Top;
  b.end = go.Spot.Bottom;
  b.addColorStop(0, base);
  b.addColorStop(1, shade(base, 0.2));
  return b;
}

/** Push the app's selection into the diagram (used after reload and on change). */
function applySelection(dia: go.Diagram, p: Props) {
  dia.clearSelection();
  if (p.selectedKey) {
    const n = dia.findNodeForKey(p.selectedKey);
    if (n) n.isSelected = true;
  } else if (p.selectedEdge) {
    const l = dia.findLinkForKey(p.selectedEdge);
    if (l) l.isSelected = true;
  }
}

export default function DiagramCanvasWeb(props: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const diaRef = useRef<go.Diagram | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const applyingRef = useRef(false);

  // Init once.
  useEffect(() => {
    if (!hostRef.current) return;
    const dia = buildDiagram(hostRef.current);
    diaRef.current = dia;

    dia.addDiagramListener('ChangedSelection', () => {
      if (applyingRef.current) return;
      const p = propsRef.current;
      const sel = dia.selection.first();
      if (sel instanceof go.Node) {
        p.onSelect(String(sel.data.key));
        p.onSelectEdge?.(null);
      } else if (sel instanceof go.Link) {
        p.onSelectEdge?.(String(sel.data.key));
        p.onSelect(null);
      } else {
        p.onSelect(null);
        p.onSelectEdge?.(null);
      }
    });

    dia.addDiagramListener('SelectionMoved', () => {
      const p = propsRef.current;
      const moved = dia.selection.toArray().filter((x) => x instanceof go.Node) as go.Node[];
      if (moved.length) p.onNodeGrab?.(String(moved[0].data.key));
      for (const n of moved) {
        const loc = n.location;
        p.onNodeMove(String(n.data.key), Math.round(loc.x), Math.round(loc.y));
      }
    });

    dia.addDiagramListener('LinkDrawn', (e) => {
      const link = e.subject as go.Link;
      const from = link.fromNode?.data?.key;
      const to = link.toNode?.data?.key;
      const fromPort = link.data?.fromPort;
      const toPort = link.data?.toPort;
      // Remove GoJS's provisional link; the app model re-adds the canonical one.
      (dia.model as go.GraphLinksModel).removeLinkData(link.data);
      if (from != null && to != null && from !== to) {
        propsRef.current.onLinkCreate?.(String(from), String(to), fromPort != null ? String(fromPort) : '', toPort != null ? String(toPort) : '');
      }
    });

    return () => {
      dia.div = null;
      diaRef.current = null;
    };
  }, []);

  // Sync the graph into the model whenever it changes.
  useEffect(() => {
    const dia = diaRef.current;
    if (!dia) return;
    const nodeData = props.graph.nodes.map((n) => ({
      ...n.raw,
      key: n.key,
      category: n.category || 'block',
      loc: `${n.x + n.w / 2} ${n.y + n.h / 2}`,
      size: `${n.w} ${n.h}`,
    }));
    const linkData = props.graph.links.map((l) => ({
      ...l.raw,
      key: linkId(l),
      from: l.from,
      to: l.to,
    }));
    applyingRef.current = true;
    const vpPos = dia.position.copy();
    const vpScale = dia.scale;
    const hadContent = dia.model.nodeDataArray.length > 0;
    dia.model = new go.GraphLinksModel({
      linkKeyProperty: 'key',
      linkFromPortIdProperty: 'fromPort',
      linkToPortIdProperty: 'toPort',
      nodeDataArray: nodeData,
      linkDataArray: linkData,
    });
    if (hadContent) {
      dia.position = vpPos;
      dia.scale = vpScale;
    }
    applySelection(dia, propsRef.current);
    applyingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.graph]);

  // Reflect external selection (rebuilding the model above also clears it).
  useEffect(() => {
    const dia = diaRef.current;
    if (!dia) return;
    applyingRef.current = true;
    applySelection(dia, props);
    applyingRef.current = false;
  }, [props.selectedKey, props.selectedEdge]);

  return React.createElement('div', {
    ref: hostRef,
    style: { flex: 1, width: '100%', height: '100%', minHeight: 300, background: '#F7F8F9' },
  });
}
