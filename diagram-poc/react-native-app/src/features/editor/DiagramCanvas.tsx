import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { AnimatedNode, isAnimShape } from './animated';
import { ANIMATED_SYMBOLS, bakeParts, isDetailedAnim, Part } from './animShapes';
import { colors } from '../../theme';
import { attachedCount, linkedComponents } from './editorOps';
import {
  contentBounds,
  DiagramGraph,
  DiagramLink,
  DiagramNode,
  linkId,
  nodeCenter,
} from './model';
import { ELECTRICAL_SYMBOLS } from './symbols';
import { isBasicShape, ShapeGeometry } from './shapes';

interface Props {
  graph: DiagramGraph;
  selectedKey: string | null;
  selectedEdge?: string | null;
  onSelect: (key: string | null) => void;
  onSelectEdge?: (id: string | null) => void;
  onNodeGrab?: (key: string) => void;
  onNodeMove: (key: string, x: number, y: number) => void;
  // Throttled position updates during a drag (for live collaboration); the local
  // canvas still renders the drag itself, so this only feeds the collab room.
  onNodeMoveLive?: (key: string, x: number, y: number) => void;
  // Web (GoJS) only: user drew a wire between two nodes. Ignored by the native SVG canvas.
  onLinkCreate?: (fromKey: string, toKey: string, fromPort?: string, toPort?: string) => void;
}

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

type Vec = { x: number; y: number };

// GoJS defaults we mirror: endSegmentLength (stub) 10, corner 8 on non-wires.
const STUB = 10;
const CORNER = 8;

/** A port's exit side as a unit direction (nearest edge); central ports face `toward` the other end. */
function portDir(n: DiagramNode, portId: string | undefined, toward: Vec): Vec {
  if (portId && n.ports) {
    const p = n.ports.find((pt) => pt.portId === portId);
    if (p) {
      const dl = p.fx;
      const dr = 1 - p.fx;
      const dt = p.fy;
      const db = 1 - p.fy;
      const m = Math.min(dl, dr, dt, db);
      if (m <= 0.25) {
        if (m === dl) return { x: -1, y: 0 };
        if (m === dr) return { x: 1, y: 0 };
        if (m === dt) return { x: 0, y: -1 };
        return { x: 0, y: 1 };
      }
    }
  }
  return Math.abs(toward.x) >= Math.abs(toward.y)
    ? { x: Math.sign(toward.x) || 1, y: 0 }
    : { x: 0, y: Math.sign(toward.y) || 1 };
}

/** Drop coincident and collinear points so the route has clean elbows only. */
function simplify(pts: Vec[]): Vec[] {
  const uniq: Vec[] = [];
  for (const p of pts) {
    const last = uniq[uniq.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) uniq.push(p);
  }
  const out: Vec[] = [];
  for (let i = 0; i < uniq.length; i++) {
    if (i > 0 && i < uniq.length - 1) {
      const a = out[out.length - 1];
      const b = uniq[i];
      const c = uniq[i + 1];
      const collinear =
        (Math.abs(a.x - b.x) < 0.01 && Math.abs(b.x - c.x) < 0.01) ||
        (Math.abs(a.y - b.y) < 0.01 && Math.abs(b.y - c.y) < 0.01);
      if (collinear) continue;
    }
    out.push(uniq[i]);
  }
  return out;
}

/**
 * Orthogonal route between two ports (GoJS-style): leave each perpendicular to
 * its edge, join the stubs with a jog/corner, and never double back over a stub
 * — a port facing away from its target routes around instead.
 */
function orthoRoute(p1: Vec, d1: Vec, p2: Vec, d2: Vec): Vec[] {
  const a = { x: p1.x + d1.x * STUB, y: p1.y + d1.y * STUB };
  const b = { x: p2.x + d2.x * STUB, y: p2.y + d2.y * STUB };
  const h1 = d1.x !== 0;
  const h2 = d2.x !== 0;
  const mid: Vec[] = [];
  if (h1 && h2) {
    if (d1.x === d2.x) {
      const jx = d1.x > 0 ? Math.max(a.x, b.x) : Math.min(a.x, b.x);
      mid.push({ x: jx, y: a.y }, { x: jx, y: b.y });
    } else {
      const ahead = d1.x > 0 ? b.x >= a.x : b.x <= a.x;
      if (ahead) {
        const jx = (a.x + b.x) / 2;
        mid.push({ x: jx, y: a.y }, { x: jx, y: b.y });
      } else {
        const jy = (a.y + b.y) / 2;
        mid.push({ x: a.x, y: jy }, { x: b.x, y: jy });
      }
    }
  } else if (!h1 && !h2) {
    if (d1.y === d2.y) {
      const jy = d1.y > 0 ? Math.max(a.y, b.y) : Math.min(a.y, b.y);
      mid.push({ x: a.x, y: jy }, { x: b.x, y: jy });
    } else {
      const ahead = d1.y > 0 ? b.y >= a.y : b.y <= a.y;
      if (ahead) {
        const jy = (a.y + b.y) / 2;
        mid.push({ x: a.x, y: jy }, { x: b.x, y: jy });
      } else {
        const jx = (a.x + b.x) / 2;
        mid.push({ x: jx, y: a.y }, { x: jx, y: b.y });
      }
    }
  } else if (h1 && !h2) {
    if (b.x === a.x || Math.sign(b.x - a.x) === d1.x) mid.push({ x: b.x, y: a.y });
    else mid.push({ x: a.x, y: b.y });
  } else {
    if (b.y === a.y || Math.sign(b.y - a.y) === d1.y) mid.push({ x: a.x, y: b.y });
    else mid.push({ x: b.x, y: a.y });
  }
  return simplify([p1, a, ...mid, b, p2]);
}

/** SVG path from a polyline; rounds interior corners when `corner > 0`, else sharp. */
function svgPath(pts: Vec[], corner: number): string {
  if (pts.length < 2) return '';
  if (corner <= 0 || pts.length === 2) {
    return `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const r = Math.min(corner, l1 / 2, l2 / 2);
    const c1 = { x: p1.x - ((p1.x - p0.x) / l1) * r, y: p1.y - ((p1.y - p0.y) / l1) * r };
    const c2 = { x: p1.x + ((p2.x - p1.x) / l2) * r, y: p1.y + ((p2.y - p1.y) / l2) * r };
    d += ` L ${c1.x} ${c1.y} Q ${p1.x} ${p1.y} ${c2.x} ${c2.y}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export default function DiagramCanvas({
  graph,
  selectedKey,
  selectedEdge,
  onSelect,
  onSelectEdge,
  onNodeGrab,
  onNodeMove,
  onNodeMoveLive,
}: Props) {
  // Seed from window dimensions so the SVG has a size even before onLayout.
  const win = Dimensions.get('window');
  const [size, setSize] = useState({ w: win.width, h: Math.max(300, win.height - 160) });
  const [t, setT] = useState<Transform>({ scale: 1, tx: 0, ty: 0 });
  // Live drag position of the node being moved. While dragging we keep this
  // LOCAL (don't touch `graph`) so the big memoised scene stays frozen and only
  // the dragged node + its wires re-render each frame — smooth on large diagrams.
  // The move is committed to the graph once, on release.
  const [drag, setDrag] = useState<{ key: string; cx: number; cy: number } | null>(null);
  const dragKey = drag?.key ?? null;

  // Animations are intentionally disabled: everything renders as a single static
  // frame. `phase` is a frozen 0 value so the (now motionless) anim node and flow
  // wire renderers keep working without a running loop.
  const phase = useRef(new Animated.Value(0)).current;
  const fitted = useRef(false);

  // Scale/translate the view so all content fits the viewport.
  const fitContent = () => {
    if (size.w <= 0 || graph.nodes.length === 0) return;
    const b = contentBounds(graph);
    const pad = 48;
    const scale = Math.max(MIN_SCALE, Math.min((size.w - pad) / b.w, (size.h - pad) / b.h, MAX_SCALE));
    setT({
      scale,
      tx: (size.w - b.w * scale) / 2 - b.x * scale,
      ty: (size.h - b.h * scale) / 2 - b.y * scale,
    });
  };

  // Fit-to-content once we know the viewport and have nodes.
  useEffect(() => {
    if (fitted.current || size.w <= 0 || graph.nodes.length === 0) return;
    fitContent();
    fitted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, size]);

  // Zoom about the viewport centre (for the +/− buttons).
  const zoomBy = (factor: number) =>
    setT((s0) => {
      const scale = Math.max(MIN_SCALE, Math.min(s0.scale * factor, MAX_SCALE));
      const cx = size.w / 2;
      const cy = size.h / 2;
      const fx = (cx - s0.tx) / s0.scale;
      const fy = (cy - s0.ty) / s0.scale;
      return { scale, tx: cx - fx * scale, ty: cy - fy * scale };
    });

  // Gesture bookkeeping (kept in refs so PanResponder closures stay stable).
  const start = useRef({
    t,
    dist: 0,
    focal: { x: 0, y: 0 },
    dragKey: null as string | null,
    grab: { x: 0, y: 0 },
    moved: false,
    dragCenter: { x: 0, y: 0 },
    pinching: false,
    hadPinch: false,
    liveTs: 0,
  });

  const nodesByKey = useMemo(() => {
    const m: Record<string, DiagramNode> = {};
    for (const n of graph.nodes) m[n.key] = n;
    return m;
  }, [graph]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ w: width, h: height });
  };

  const toDiagram = (sx: number, sy: number, tr: Transform) => ({
    x: (sx - tr.tx) / tr.scale,
    y: (sy - tr.ty) / tr.scale,
  });

  const hitTest = (dx: number, dy: number): string | null => {
    for (let i = graph.nodes.length - 1; i >= 0; i--) {
      const n = graph.nodes[i];
      if (dx >= n.x && dx <= n.x + n.w && dy >= n.y && dy <= n.y + n.h) return n.key;
    }
    return null;
  };

  // Where a wire meets a node: the nearest pin for electrical symbols, else the
  // point where the line toward (tx,ty) crosses the node's boundary box.
  const connectionPoint = (n: DiagramNode, tx: number, ty: number): { x: number; y: number } => {
    const sym = n.shape ? ELECTRICAL_SYMBOLS[n.shape] : undefined;
    if (sym && sym.pins && sym.pins.length) {
      const sx = n.w / sym.width;
      const sy = n.h / sym.height;
      let best = { x: n.x, y: n.y };
      let bd = Infinity;
      for (const p of sym.pins) {
        const ax = n.x + p.x * sx;
        const ay = n.y + p.y * sy;
        const d = (ax - tx) ** 2 + (ay - ty) ** 2;
        if (d < bd) {
          bd = d;
          best = { x: ax, y: ay };
        }
      }
      return best;
    }
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;
    const dx = tx - cx;
    const dy = ty - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };
    const scale = 1 / Math.max(Math.abs(dx) / (n.w / 2), Math.abs(dy) / (n.h / 2));
    return { x: cx + dx * scale, y: cy + dy * scale };
  };

  // The exact position of a named port on a node, if defined in the model.
  const portPoint = (n: DiagramNode, portId?: string): { x: number; y: number } | null => {
    if (!portId || !n.ports) return null;
    const p = n.ports.find((pt) => pt.portId === portId);
    return p ? { x: n.x + p.fx * n.w, y: n.y + p.fy * n.h } : null;
  };

  /** Polyline for a link: explicit points, else an orthogonal route between its port points. */
  const linkPoints = (l: DiagramLink, moved?: DiagramNode | null): { x: number; y: number }[] => {
    const a = moved && moved.key === l.from ? moved : nodesByKey[l.from];
    const b = moved && moved.key === l.to ? moved : nodesByKey[l.to];
    if (!a || !b) return [];
    if (l.points.length >= 2) return l.points;
    const ac = nodeCenter(a);
    const bc = nodeCenter(b);
    const p1 = portPoint(a, l.fromPort) ?? connectionPoint(a, bc.x, bc.y);
    const p2 = portPoint(b, l.toPort) ?? connectionPoint(b, ac.x, ac.y);
    if (l.routing === 'normal' || l.routing === 'smooth') return [p1, p2];
    const d1 = portDir(a, l.fromPort, { x: p2.x - p1.x, y: p2.y - p1.y });
    const d2 = portDir(b, l.toPort, { x: p1.x - p2.x, y: p1.y - p2.y });
    return orthoRoute(p1, d1, p2, d2);
  };

  // Nearest link within `tol` diagram units of (dx,dy), else null.
  const hitEdge = (dx: number, dy: number): string | null => {
    const tol = 10 / t.scale;
    let best: { id: string; d: number } | null = null;
    for (const l of graph.links) {
      const pts = linkPoints(l);
      for (let i = 0; i + 1 < pts.length; i++) {
        const d = distToSeg(dx, dy, pts[i], pts[i + 1]);
        if (d <= tol && (!best || d < best.d)) best = { id: linkId(l), d };
      }
    }
    return best?.id ?? null;
  };

  const pickAt = (sx: number, sy: number) => {
    const d = toDiagram(sx, sy, start.current.t);
    const node = hitTest(d.x, d.y);
    if (node) {
      onSelect(node);
      return;
    }
    const edge = hitEdge(d.x, d.y);
    if (edge && onSelectEdge) {
      onSelectEdge(edge);
      return;
    }
    onSelect(null);
    onSelectEdge?.(null);
  };

  const dist = (t0: any, t1: any) =>
    Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);

  // The responder is created once, so it must read the latest closures (graph,
  // transform, callbacks) through this ref rather than capturing first render.
  const grant = (e: GestureResponderEvent) => {
    const touches = e.nativeEvent.touches;
    start.current.t = t;
    start.current.moved = false;
    start.current.pinching = false;
    start.current.hadPinch = false;
    start.current.dist = 0;
    if (touches.length >= 2) {
      start.current.dragKey = null;
    } else {
      const { locationX, locationY } = e.nativeEvent;
      const d = toDiagram(locationX, locationY, t);
      const key = hitTest(d.x, d.y);
      start.current.dragKey = key;
      if (key) {
        const n = nodesByKey[key];
        start.current.grab = { x: d.x - n.x, y: d.y - n.y };
        start.current.dragCenter = nodeCenter(n);
        onSelect(key);
        onSelectEdge?.(null);
        onNodeGrab?.(key);
      }
    }
  };
  const move = (e: GestureResponderEvent, gesture: { dx: number; dy: number }) => {
    start.current.moved = start.current.moved || Math.hypot(gesture.dx, gesture.dy) > 4;
    const touches = e.nativeEvent.touches;
    if (touches.length >= 2) {
      // Pinch-zoom. A pinch usually begins as one finger, so the second finger
      // lands mid-gesture (no fresh grant) — capture the baseline distance and
      // transform on the first two-finger frame. Cancel any node drag in flight.
      if (!start.current.pinching) {
        start.current.pinching = true;
        start.current.hadPinch = true;
        start.current.dist = dist(touches[0], touches[1]);
        start.current.t = t;
        if (start.current.dragKey) {
          start.current.dragKey = null;
          setDrag(null);
        }
      }
      const s0 = start.current.t;
      const d = dist(touches[0], touches[1]);
      const ratio = start.current.dist ? d / start.current.dist : 1;
      const scale = Math.max(MIN_SCALE, Math.min(s0.scale * ratio, MAX_SCALE));
      const midX = (touches[0].locationX + touches[1].locationX) / 2;
      const midY = (touches[0].locationY + touches[1].locationY) / 2;
      const focal = toDiagram(midX, midY, s0);
      setT({ scale, tx: midX - focal.x * scale, ty: midY - focal.y * scale });
      return;
    }
    start.current.pinching = false;
    // After a pinch, the leftover single finger has an unreliable gesture delta,
    // so don't pan until the user lifts and starts a fresh gesture.
    if (start.current.hadPinch) return;
    const s0 = start.current.t;
    if (start.current.dragKey) {
      const d = toDiagram(e.nativeEvent.locationX, e.nativeEvent.locationY, s0);
      const n = nodesByKey[start.current.dragKey];
      const tlx = d.x - start.current.grab.x;
      const tly = d.y - start.current.grab.y;
      // Track the node CENTRE (loc convention) locally; commit on release so the
      // heavy scene isn't rebuilt on every drag frame.
      const cx = tlx + (n?.w ?? 0) / 2;
      const cy = tly + (n?.h ?? 0) / 2;
      start.current.dragCenter = { x: cx, y: cy };
      setDrag({ key: start.current.dragKey, cx, cy });
      // Stream the position to collaborators, throttled (~20/s).
      if (onNodeMoveLive) {
        const now = Date.now();
        if (now - start.current.liveTs > 50) {
          start.current.liveTs = now;
          onNodeMoveLive(start.current.dragKey, cx, cy);
        }
      }
    } else {
      setT({ scale: s0.scale, tx: s0.tx + gesture.dx, ty: s0.ty + gesture.dy });
    }
  };
  const release = (e: GestureResponderEvent) => {
    if (start.current.dragKey) {
      // Commit the drag once (moved nodes only, so a tap doesn't dirty the doc).
      if (start.current.moved) {
        const c = start.current.dragCenter;
        onNodeMove(start.current.dragKey, c.x, c.y);
      }
      start.current.dragKey = null;
      setDrag(null);
      return;
    }
    if (!start.current.moved && !start.current.hadPinch) {
      pickAt(e.nativeEvent.locationX, e.nativeEvent.locationY);
    }
  };

  const handlersRef = useRef({ grant, move, release });
  handlersRef.current = { grant, move, release };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => handlersRef.current.grant(e),
      onPanResponderMove: (e, g) => handlersRef.current.move(e, g),
      onPanResponderRelease: (e) => handlersRef.current.release(e),
    }),
  ).current;

  /** One wire's SVG element (shared by the frozen scene and the drag overlay). */
  const linkElement = (l: DiagramLink, k: string, pts: { x: number; y: number }[]) => {
    if (pts.length < 2) return null;
    const d = svgPath(pts, l.isWire ? 0 : CORNER);
    const sel = selectedEdge != null && linkId(l) === selectedEdge;
    const base = l.isWire ? colors.wire : colors.canvasSubtext;
    const stroke = sel ? '#f5a623' : l.color ?? base;
    const width = (l.width ?? (l.isWire ? 1.8 : 2)) + (sel ? 1 : 0);
    // Flow links keep their dashed look but no longer march (animations disabled).
    const dash = l.raw.flow === true ? '8,6' : l.dashed ? '6,3' : undefined;
    return (
      <Path key={k} d={d} fill="none" stroke={stroke} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
    );
  };

  const nodeElement = (n: DiagramNode) =>
    isDetailedAnim(n.shape) ? (
      <AnimComponentNode key={n.key} node={n} selected={n.key === selectedKey} />
    ) : isAnimShape(n.shape) ? (
      <AnimatedNode key={n.key} node={n} phase={phase} selected={n.key === selectedKey} />
    ) : (
      <NodeShape key={n.key} node={n} selected={n.key === selectedKey} />
    );

  // Build the scene once per graph/selection change — NOT on every pan/zoom or
  // drag frame. Panning only changes the parent <G> transform; the dragged node
  // and its wires are excluded here and drawn live in the overlay below.
  const scene = useMemo(() => {
    const links = graph.links.map((l, i) =>
      dragKey && (l.from === dragKey || l.to === dragKey) ? null : linkElement(l, `l${i}`, linkPoints(l)),
    );
    const nodes = graph.nodes.map((n) => (n.key === dragKey ? null : nodeElement(n)));
    return (
      <>
        {links}
        {nodes}
      </>
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, selectedKey, selectedEdge, dragKey]);

  // Live overlay: the dragged node at its current position + its incident wires.
  // Re-renders each drag frame, but it's only one node and a few links.
  const overlay = (() => {
    if (!drag) return null;
    const src = nodesByKey[drag.key];
    if (!src) return null;
    const moved: DiagramNode = { ...src, x: drag.cx - src.w / 2, y: drag.cy - src.h / 2 };
    const wires = graph.links
      .filter((l) => l.from === drag.key || l.to === drag.key)
      .map((l, i) => linkElement(l, `dl${i}`, linkPoints(l, moved)));
    return (
      <>
        {wires}
        {nodeElement(moved)}
      </>
    );
  })();

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }} onLayout={onLayout} {...responder.panHandlers}>
        <Svg width={size.w} height={size.h}>
          <G transform={`translate(${t.tx},${t.ty}) scale(${t.scale})`}>
            {scene}
            {overlay}
          </G>
        </Svg>
      </View>
      <View style={zoomStyles.dock} pointerEvents="box-none">
        <ZoomButton label="+" onPress={() => zoomBy(1.25)} />
        <ZoomButton label="−" onPress={() => zoomBy(0.8)} />
        <ZoomButton label="⤢" onPress={fitContent} />
      </View>
    </View>
  );
}

function ZoomButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [zoomStyles.btn, pressed && { opacity: 0.7 }]}>
      <Text style={zoomStyles.btnText}>{label}</Text>
    </Pressable>
  );
}

const zoomStyles = StyleSheet.create({
  dock: { position: 'absolute', right: 12, bottom: 12, flexDirection: 'column', gap: 8 },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.chrome,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.chromeBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  btnText: { color: colors.chromeText, fontSize: 22, fontWeight: '600', lineHeight: 26 },
});

const NodeShape = React.memo(function NodeShape({ node, selected }: { node: DiagramNode; selected: boolean }) {
  // Catalogue part card — mirrors the Angular part node template.
  if (node.category === 'part') {
    const raw = node.raw as any;
    const specs: string[] = Array.isArray(raw.specs) ? raw.specs.filter((s: unknown) => typeof s === 'string' && s) : [];
    const supplier = typeof raw.supplier === 'string' ? raw.supplier : '';
    const padX = 14;
    return (
      <>
        <Rect
          x={node.x}
          y={node.y}
          width={node.w}
          height={node.h}
          rx={10}
          fill="#ffffff"
          stroke={selected ? colors.primary : '#D2D6DC'}
          strokeWidth={selected ? 2.5 : 1.5}
        />
        <Rect x={node.x + padX} y={node.y + 12} width={node.w - padX * 2} height={4} rx={2} fill={colors.primary} />
        <SvgText x={node.x + padX} y={node.y + 36} fill="#111827" fontSize={13} fontWeight="700" textAnchor="start">
          {node.text.length > 26 ? node.text.slice(0, 25) + '…' : node.text}
        </SvgText>
        {supplier ? (
          <SvgText x={node.x + padX} y={node.y + 52} fill="#6B7280" fontSize={10.5} textAnchor="start">
            {supplier.length > 32 ? supplier.slice(0, 31) + '…' : supplier}
          </SvgText>
        ) : null}
        {specs.slice(0, node.h >= 96 ? 2 : 1).map((s, i) => (
          <SvgText
            key={i}
            x={node.x + padX}
            y={node.y + 70 + i * 15}
            fill="#374151"
            fontSize={10.5}
            textAnchor="start"
          >
            {s.length > 34 ? s.slice(0, 33) + '…' : s}
          </SvgText>
        ))}
      </>
    );
  }

  // Basic geometric shapes (rectangle, diamond, cylinder, …).
  if (isBasicShape(node.shape)) {
    const fill = node.color ?? '#ffffff';
    const readable = isLight(fill) ? '#111827' : '#ffffff';
    return (
      <>
        <G transform={`translate(${node.x},${node.y})`}>
          <ShapeGeometry
            shape={node.shape as string}
            w={node.w}
            h={node.h}
            fill={fill}
            stroke={selected ? colors.primary : '#334155'}
            sw={selected ? 2.5 : 1.6}
          />
        </G>
        {node.text ? (
          <SvgText
            x={node.x + node.w / 2}
            y={node.y + node.h / 2 + 4}
            fill={readable}
            fontSize={13}
            fontWeight="600"
            textAnchor="middle"
          >
            {node.text}
          </SvgText>
        ) : null}
        <PartBadge node={node} />
      </>
    );
  }

  const sym = node.shape ? ELECTRICAL_SYMBOLS[node.shape] : undefined;
  if (sym) {
    const sx = node.w / sym.width;
    const sy = node.h / sym.height;
    return (
      <>
        <G transform={`translate(${node.x},${node.y}) scale(${sx},${sy})`}>
          {sym.paths.map((p, i) => (
            <Path
              key={i}
              d={p.d}
              fill={p.fill ? colors.canvasText : 'none'}
              stroke={colors.canvasText}
              strokeWidth={1.6 / ((sx + sy) / 2)}
            />
          ))}
          {(sym.texts ?? []).map((tx, i) => (
            <SvgText
              key={`t${i}`}
              x={tx.x}
              y={tx.y}
              fill={colors.canvasText}
              fontSize={tx.size ?? 8}
              fontWeight={tx.bold ? '700' : '400'}
              textAnchor={tx.anchor === 'start' ? 'start' : tx.anchor === 'end' ? 'end' : 'middle'}
            >
              {tx.text}
            </SvgText>
          ))}
        </G>
        {selected ? (
          <Rect
            x={node.x - 4}
            y={node.y - 4}
            width={node.w + 8}
            height={node.h + 8}
            fill="none"
            stroke={colors.primary}
            strokeWidth={1.6}
          />
        ) : null}
        {node.text ? (
          <SvgText x={node.x + node.w / 2} y={node.y + node.h + 12} fill={colors.canvasText} fontSize={11} fontWeight="600" textAnchor="middle">
            {node.text}
          </SvgText>
        ) : null}
        {node.value ? (
          <SvgText x={node.x + node.w / 2} y={node.y + node.h + (node.text ? 24 : 12)} fill={colors.canvasSubtext} fontSize={10} textAnchor="middle">
            {node.value}
          </SvgText>
        ) : null}
        <PartBadge node={node} />
      </>
    );
  }

  const fill = node.color ?? colors.surface;
  const readable = isLight(fill) ? '#111827' : '#ffffff';
  const muted = isLight(fill) ? '#475569' : 'rgba(255,255,255,0.82)';
  const subtitle = blockSubtitle(node);
  const twoLine = !!subtitle && node.h >= 42;
  return (
    <>
      <Rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={10}
        fill={fill}
        stroke={selected ? colors.primary : colors.border}
        strokeWidth={selected ? 2.5 : 1.4}
      />
      {node.text ? (
        <SvgText
          x={node.x + node.w / 2}
          y={node.y + node.h / 2 + (twoLine ? -3 : 4)}
          fill={readable}
          fontSize={13}
          fontWeight="700"
          textAnchor="middle"
        >
          {node.text}
        </SvgText>
      ) : null}
      {twoLine ? (
        <SvgText
          x={node.x + node.w / 2}
          y={node.y + node.h / 2 + 13}
          fill={muted}
          fontSize={9}
          fontWeight="500"
          textAnchor="middle"
        >
          {subtitle!.length > 22 ? subtitle!.slice(0, 21) + '…' : subtitle}
        </SvgText>
      ) : null}
      <PartBadge node={node} />
    </>
  );
});

/** Second-line label for a block card: its subtitle, or an attached part's mfr. */
function blockSubtitle(node: DiagramNode): string | null {
  const raw = node.raw as any;
  if (typeof raw.subtitle === 'string' && raw.subtitle.trim()) return raw.subtitle.trim();
  const ap = Array.isArray(raw.attachedParts) ? raw.attachedParts[0] : null;
  const p = ap?.part ?? ap;
  if (p) return p.manufacturer || p.supplier || p.partDesc || null;
  return null;
}

// ---- Detailed animated component (solar, turbine, robot arm, …) -------------
// Maps a baked SVG part tree (from animShapes.bakeParts) to react-native-svg,
// scaled into the node's box. Re-rendered each animation tick.
function mapKey(k: string): string {
  return k.includes('-') ? k.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase()) : k;
}
function partProps(attrs: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) out[mapKey(k)] = v;
  return out;
}
function renderPart(p: Part, key: string): React.ReactNode {
  const props = partProps(p.attrs);
  const kids = p.children?.map((c, i) => renderPart(c, `${key}.${i}`));
  switch (p.tag) {
    case 'g':
      return (
        <G key={key} {...props}>
          {kids}
        </G>
      );
    case 'path':
      return <Path key={key} {...props} />;
    case 'circle':
      return <Circle key={key} {...props} />;
    case 'rect':
      return <Rect key={key} {...props} />;
    default:
      return null;
  }
}

// Detailed component glyph (solar, turbine, robot arm, …), rendered as a single
// static frame — animations are disabled in this app.
const AnimComponentNode = React.memo(function AnimComponentNode({
  node,
  selected,
}: {
  node: DiagramNode;
  selected: boolean;
}) {
  const def = node.shape ? ANIMATED_SYMBOLS[node.shape] : undefined;
  if (!def) return <NodeShape node={node} selected={selected} />;
  const sx = node.w / def.width;
  const sy = node.h / def.height;
  const parts = bakeParts(node.shape as string, 0);
  return (
    <>
      <G transform={`translate(${node.x},${node.y}) scale(${sx},${sy})`}>
        {parts.map((p, i) => renderPart(p, `${node.key}-${i}`))}
      </G>
      {selected ? (
        <Rect x={node.x - 4} y={node.y - 4} width={node.w + 8} height={node.h + 8} fill="none" stroke={colors.primary} strokeWidth={1.6} rx={6} />
      ) : null}
      {node.text ? (
        <SvgText x={node.x + node.w / 2} y={node.y + node.h + 12} fill={colors.canvasText} fontSize={11} fontWeight="600" textAnchor="middle">
          {node.text}
        </SvgText>
      ) : null}
      <PartBadge node={node} />
    </>
  );
});

function PartBadge({ node }: { node: DiagramNode }) {
  const count = attachedCount(node.raw) + linkedComponents(node.raw).length;
  if (count === 0) return null;
  const cx = node.x + node.w;
  const cy = node.y;
  return (
    <>
      <Circle cx={cx} cy={cy} r={9} fill="#f5a623" stroke={colors.canvasBg} strokeWidth={1.5} />
      <SvgText x={cx} y={cy + 4} fill="#1a1303" fontSize={11} fontWeight="800" textAnchor="middle">
        {`${count}`}
      </SvgText>
    </>
  );
}

/** Distance from point (px,py) to segment a–b, in diagram units. */
function distToSeg(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
