import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  View,
} from 'react-native';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { AnimatedNode, isAnimShape } from './animated';

const AnimatedPath = Animated.createAnimatedComponent(Path);
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
  // Web (GoJS) only: user drew a wire between two nodes. Ignored by the native SVG canvas.
  onLinkCreate?: (fromKey: string, toKey: string) => void;
}

interface Transform {
  scale: number;
  tx: number;
  ty: number;
}

const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

export default function DiagramCanvas({
  graph,
  selectedKey,
  selectedEdge,
  onSelect,
  onSelectEdge,
  onNodeGrab,
  onNodeMove,
}: Props) {
  // Seed from window dimensions so the SVG has a size even before onLayout.
  const win = Dimensions.get('window');
  const [size, setSize] = useState({ w: win.width, h: Math.max(300, win.height - 160) });
  const [t, setT] = useState<Transform>({ scale: 1, tx: 0, ty: 0 });

  // A single 0→1 looping value drives every animation (flow wires + anim nodes).
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(phase, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: false }),
    );
    loop.start();
    return () => loop.stop();
  }, [phase]);
  const dashOffset = phase.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const fitted = useRef(false);

  // Fit-to-content once we know the viewport and have nodes.
  useEffect(() => {
    if (fitted.current || size.w <= 0 || graph.nodes.length === 0) return;
    const b = contentBounds(graph);
    const pad = 40;
    const scale = Math.max(
      MIN_SCALE,
      Math.min((size.w - pad) / b.w, (size.h - pad) / b.h, MAX_SCALE),
    );
    setT({
      scale,
      tx: (size.w - b.w * scale) / 2 - b.x * scale,
      ty: (size.h - b.h * scale) / 2 - b.y * scale,
    });
    fitted.current = true;
  }, [graph, size]);

  // Gesture bookkeeping (kept in refs so PanResponder closures stay stable).
  const start = useRef({ t, dist: 0, focal: { x: 0, y: 0 }, dragKey: null as string | null, grab: { x: 0, y: 0 }, moved: false });

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

  // Polyline for a link: explicit points, else an orthogonal route between the
  // two nodes' proper connection points (pin/edge, not centre).
  const linkPoints = (l: DiagramLink): { x: number; y: number }[] => {
    const a = nodesByKey[l.from];
    const b = nodesByKey[l.to];
    if (!a || !b) return [];
    if (l.points.length >= 2) return l.points;
    const ac = nodeCenter(a);
    const bc = nodeCenter(b);
    const p1 = connectionPoint(a, bc.x, bc.y);
    const p2 = connectionPoint(b, ac.x, ac.y);
    if (Math.abs(p2.x - p1.x) >= Math.abs(p2.y - p1.y)) {
      const mx = (p1.x + p2.x) / 2;
      return [p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2];
    }
    const my = (p1.y + p2.y) / 2;
    return [p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2];
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
    if (touches.length >= 2) {
      start.current.dist = dist(touches[0], touches[1]);
      start.current.dragKey = null;
    } else {
      const { locationX, locationY } = e.nativeEvent;
      const d = toDiagram(locationX, locationY, t);
      const key = hitTest(d.x, d.y);
      start.current.dragKey = key;
      if (key) {
        const n = nodesByKey[key];
        start.current.grab = { x: d.x - n.x, y: d.y - n.y };
        onSelect(key);
        onSelectEdge?.(null);
        onNodeGrab?.(key);
      }
    }
  };
  const move = (e: GestureResponderEvent, gesture: { dx: number; dy: number }) => {
    start.current.moved = start.current.moved || Math.hypot(gesture.dx, gesture.dy) > 4;
    const touches = e.nativeEvent.touches;
    const s0 = start.current.t;
    if (touches.length >= 2) {
      const d = dist(touches[0], touches[1]);
      const ratio = start.current.dist ? d / start.current.dist : 1;
      const scale = Math.max(MIN_SCALE, Math.min(s0.scale * ratio, MAX_SCALE));
      const midX = (touches[0].locationX + touches[1].locationX) / 2;
      const midY = (touches[0].locationY + touches[1].locationY) / 2;
      const focal = toDiagram(midX, midY, s0);
      setT({ scale, tx: midX - focal.x * scale, ty: midY - focal.y * scale });
    } else if (start.current.dragKey) {
      const d = toDiagram(e.nativeEvent.locationX, e.nativeEvent.locationY, s0);
      onNodeMove(start.current.dragKey, d.x - start.current.grab.x, d.y - start.current.grab.y);
    } else {
      setT({ scale: s0.scale, tx: s0.tx + gesture.dx, ty: s0.ty + gesture.dy });
    }
  };
  const release = (e: GestureResponderEvent) => {
    if (!start.current.moved && !start.current.dragKey) {
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

  return (
    <View style={{ flex: 1 }} onLayout={onLayout} {...responder.panHandlers}>
      <Svg width={size.w} height={size.h}>
        <G transform={`translate(${t.tx},${t.ty}) scale(${t.scale})`}>
          {graph.links.map((l, i) => {
            const pts = linkPoints(l);
            if (pts.length < 2) return null;
            const d = `M ${pts.map((p) => `${p.x} ${p.y}`).join(' L ')}`;
            const sel = selectedEdge != null && linkId(l) === selectedEdge;
            const base = l.isWire ? colors.wire : colors.canvasSubtext;
            const stroke = sel ? '#f5a623' : l.color ?? base;
            const width = (l.width ?? (l.isWire ? 1.8 : 2)) + (sel ? 1 : 0);
            // "flow" wires animate current with moving dashes.
            if (l.raw.flow === true) {
              return (
                <AnimatedPath
                  key={`l${i}`}
                  d={d}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={width}
                  strokeDasharray="8,6"
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                />
              );
            }
            return (
              <Path
                key={`l${i}`}
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={width}
                strokeDasharray={l.dashed ? '6,3' : undefined}
                strokeLinecap="round"
              />
            );
          })}
          {graph.nodes.map((n) =>
            isAnimShape(n.shape) ? (
              <AnimatedNode key={n.key} node={n} phase={phase} selected={n.key === selectedKey} />
            ) : (
              <NodeShape key={n.key} node={n} selected={n.key === selectedKey} />
            ),
          )}
        </G>
      </Svg>
    </View>
  );
}

function NodeShape({ node, selected }: { node: DiagramNode; selected: boolean }) {
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
          <SvgText x={node.x} y={node.y + node.h + 12} fill={colors.canvasSubtext} fontSize={11}>
            {node.text}
          </SvgText>
        ) : null}
        <PartBadge node={node} />
      </>
    );
  }

  const fill = node.color ?? colors.canvasSurface;
  const readable = isLight(fill) ? '#111827' : '#ffffff';
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

function PartBadge({ node }: { node: DiagramNode }) {
  const count = attachedCount(node.raw) + linkedComponents(node.raw).length;
  if (count === 0) return null;
  const cx = node.x + node.w;
  const cy = node.y;
  return (
    <>
      <Circle cx={cx} cy={cy} r={9} fill="#f5a623" stroke={colors.canvasSurface} strokeWidth={1.5} />
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
