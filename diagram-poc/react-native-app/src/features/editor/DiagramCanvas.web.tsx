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
  onLinkCreate?: (fromKey: string, toKey: string) => void;
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
    model: new go.GraphLinksModel({ linkKeyProperty: 'key' }),
  });

  const port = {
    portId: '',
    fromLinkable: true,
    toLinkable: true,
    fromSpot: go.Spot.AllSides,
    toSpot: go.Spot.AllSides,
    cursor: 'pointer',
  } as const;

  const nodeBase = {
    locationSpot: go.Spot.TopLeft,
    selectionAdorned: true,
    resizable: false,
  };
  const loc = new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify);

  // Electrical symbol → go.Picture from an inline-SVG data URI.
  dia.nodeTemplateMap.add(
    'symbol',
    $(
      go.Node,
      'Vertical',
      nodeBase,
      loc,
      $(
        go.Picture,
        { ...port, imageStretch: go.GraphObject.Fill },
        new go.Binding('source', 'shape', (s: string) => electricalSvgUri(s)?.uri ?? ''),
        new go.Binding('desiredSize', 'size', go.Size.parse),
      ),
      $(go.TextBlock, { font: '600 11px sans-serif', stroke: '#475569', margin: new go.Margin(2, 0, 0, 0) }, new go.Binding('text')),
    ),
  );

  // Basic shape → native GoJS figure + centred label.
  dia.nodeTemplateMap.add(
    'shape',
    $(
      go.Node,
      'Spot',
      nodeBase,
      loc,
      $(
        go.Shape,
        { ...port, strokeWidth: 1.6, stroke: '#475569' },
        new go.Binding('figure', 'shape', (s: string) => SHAPE_FIGURE[s] ?? 'RoundedRectangle'),
        new go.Binding('fill', 'color', (c: string) => c || '#e2e8f0'),
        new go.Binding('desiredSize', 'size', go.Size.parse),
      ),
      $(go.TextBlock, { font: '600 13px sans-serif', stroke: '#0f172a' }, new go.Binding('text')),
    ),
  );

  // Functional block → rounded rectangle + label.
  dia.nodeTemplateMap.add(
    'block',
    $(
      go.Node,
      'Auto',
      nodeBase,
      loc,
      $(
        go.Shape,
        'RoundedRectangle',
        { ...port, parameter1: 10, strokeWidth: 0 },
        new go.Binding('fill', 'color', (c: string) => c || '#1d4ed8'),
        new go.Binding('desiredSize', 'size', go.Size.parse),
      ),
      $(go.TextBlock, { margin: 10, stroke: '#ffffff', font: '600 13px sans-serif', textAlign: 'center' }, new go.Binding('text')),
    ),
  );

  // Animated component → compact static glyph (animation is a mobile-canvas nicety).
  dia.nodeTemplateMap.add(
    'anim',
    $(
      go.Node,
      'Vertical',
      nodeBase,
      loc,
      $(
        go.Shape,
        { ...port, strokeWidth: 2, desiredSize: new go.Size(52, 52) },
        new go.Binding('figure', 'shape', (s: string) => ANIM_GLYPH[s]?.figure ?? 'Circle'),
        new go.Binding('fill', 'shape', (s: string) => (ANIM_GLYPH[s]?.color ?? '#f59e0b') + '33'),
        new go.Binding('stroke', 'shape', (s: string) => ANIM_GLYPH[s]?.color ?? '#f59e0b'),
      ),
      $(go.TextBlock, { font: '600 11px sans-serif', stroke: '#475569', margin: new go.Margin(2, 0, 0, 0) }, new go.Binding('text')),
    ),
  );

  // Fallback: a simple labelled rectangle.
  dia.nodeTemplate = $(
    go.Node,
    'Auto',
    nodeBase,
    loc,
    $(go.Shape, 'RoundedRectangle', { ...port, fill: '#e2e8f0', strokeWidth: 1 }, new go.Binding('desiredSize', 'size', go.Size.parse)),
    $(go.TextBlock, { margin: 8, font: '600 13px sans-serif' }, new go.Binding('text')),
  );

  dia.linkTemplate = $(
    go.Link,
    { routing: go.Link.Orthogonal, corner: 10, relinkableFrom: true, relinkableTo: true, reshapable: true, selectable: true },
    new go.Binding('routing', 'routing', (r: string) => (r === 'normal' || r === 'smooth' ? go.Link.Normal : go.Link.Orthogonal)),
    new go.Binding('curve', 'routing', (r: string) => (r === 'smooth' ? go.Link.Bezier : go.Link.None)),
    $(
      go.Shape,
      { strokeWidth: 2, stroke: '#38bdf8', strokeCap: 'round' },
      new go.Binding('stroke', 'color', (c: string) => c || '#38bdf8'),
      new go.Binding('strokeWidth', 'width', (w: number) => w || 2),
      new go.Binding('strokeDashArray', 'dash'),
    ),
  );

  return dia;
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
      // Remove GoJS's provisional link; the app model re-adds the canonical one.
      (dia.model as go.GraphLinksModel).removeLinkData(link.data);
      if (from != null && to != null && from !== to) propsRef.current.onLinkCreate?.(String(from), String(to));
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
    dia.model = new go.GraphLinksModel({ linkKeyProperty: 'key', nodeDataArray: nodeData, linkDataArray: linkData });
    if (hadContent) {
      dia.position = vpPos;
      dia.scale = vpScale;
    }
    applyingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.graph]);

  // Reflect external selection.
  useEffect(() => {
    const dia = diaRef.current;
    if (!dia) return;
    applyingRef.current = true;
    dia.clearSelection();
    if (props.selectedKey) {
      const n = dia.findNodeForKey(props.selectedKey);
      if (n) n.isSelected = true;
    } else if (props.selectedEdge) {
      const l = dia.findLinkForKey(props.selectedEdge);
      if (l) l.isSelected = true;
    }
    applyingRef.current = false;
  }, [props.selectedKey, props.selectedEdge]);

  return React.createElement('div', {
    ref: hostRef,
    style: { flex: 1, width: '100%', height: '100%', minHeight: 300, background: '#f8fafc' },
  });
}
