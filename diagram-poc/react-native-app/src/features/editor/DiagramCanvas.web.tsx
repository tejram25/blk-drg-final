import * as go from 'gojs';
import React, { useEffect, useRef } from 'react';
import { DiagramGraph, linkId } from './model';
import { ANIM_GLYPH, electricalSvgUri, registerFigures, SHAPE_FIGURE } from './gojsAssets';

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
      $(go.Shape, 'LineH', { stroke: '#eef1f6', strokeWidth: 1 }),
      $(go.Shape, 'LineH', { stroke: '#e2e8f0', strokeWidth: 1, interval: 5 }),
      $(go.Shape, 'LineV', { stroke: '#eef1f6', strokeWidth: 1 }),
      $(go.Shape, 'LineV', { stroke: '#e2e8f0', strokeWidth: 1, interval: 5 }),
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
    $(go.Shape, 'RoundedRectangle', { fill: null, stroke: '#4f46e5', strokeWidth: 2, parameter1: 10 }),
    $(go.Placeholder, { padding: 5 }),
  );

  const nodeBase = {
    locationSpot: go.Spot.TopLeft,
    selectionAdorned: true,
    selectionAdornmentTemplate: selAdorn,
    resizable: false,
    isShadowed: true,
    shadowColor: 'rgba(15, 23, 42, 0.18)',
    shadowBlur: 9,
    shadowOffset: new go.Point(0, 3),
  };
  const loc = new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify);

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
      $(go.TextBlock, { font: '600 11px Inter, sans-serif', stroke: '#475569', margin: new go.Margin(3, 0, 0, 0) }, new go.Binding('text')),
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
      $(go.TextBlock, { font: '600 13px Inter, sans-serif', stroke: '#0f172a' }, new go.Binding('text')),
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

  // Animated component → bare coloured glyph (no box) + named ports.
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
          go.Shape,
          { ...port, strokeWidth: 2, desiredSize: new go.Size(52, 52) },
          new go.Binding('figure', 'shape', (s: string) => ANIM_GLYPH[s]?.figure ?? 'Circle'),
          new go.Binding('fill', 'shape', (s: string) => (ANIM_GLYPH[s]?.color ?? '#f59e0b') + '22'),
          new go.Binding('stroke', 'shape', (s: string) => ANIM_GLYPH[s]?.color ?? '#f59e0b'),
        ),
      ),
      $(go.TextBlock, { font: '600 11px Inter, sans-serif', stroke: '#475569', margin: new go.Margin(3, 0, 0, 0) }, new go.Binding('text')),
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

  // Node-avoiding orthogonal routing so wires never cut through components.
  dia.linkTemplate = $(
    go.Link,
    {
      routing: go.Link.AvoidsNodes,
      corner: 8,
      curve: go.Link.JumpOver,
      relinkableFrom: true,
      relinkableTo: true,
      reshapable: true,
      selectable: true,
    },
    new go.Binding('routing', 'routing', (r: string) => (r === 'normal' || r === 'smooth' ? go.Link.Normal : go.Link.AvoidsNodes)),
    new go.Binding('curve', 'routing', (r: string) => (r === 'smooth' ? go.Link.Bezier : go.Link.JumpOver)),
    $(
      go.Shape,
      { strokeWidth: 2.4, stroke: '#0ea5e9', strokeCap: 'round', shadowVisible: false },
      new go.Binding('stroke', 'color', (c: string) => c || '#0ea5e9'),
      new go.Binding('strokeWidth', 'width', (w: number) => (w || 2) + 0.4),
      new go.Binding('strokeDashArray', 'dash'),
    ),
  );

  return dia;
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
      loc: `${n.x} ${n.y}`,
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
    style: { flex: 1, width: '100%', height: '100%', minHeight: 300, background: '#f8fafc' },
  });
}
