import React from 'react';
import { Animated } from 'react-native';
import { Circle, G, Path, Rect } from 'react-native-svg';
import { DiagramNode } from './model';

const AG = Animated.createAnimatedComponent(G);
const ACircle = Animated.createAnimatedComponent(Circle);

/** Animated component nodes (category 'anim'). Each maps cleanly to an SVG animation. */
export const ANIM_SHAPES: Record<string, string> = {
  'anim-pulse': 'Pulse beacon',
  'anim-glow': 'Glow lamp',
  'anim-spin': 'Rotating gear',
  'anim-fan': 'Fan',
  'anim-signal': 'Signal / antenna',
  'anim-charge': 'Charging cell',
};

export const isAnimShape = (shape?: string) => !!shape && shape in ANIM_SHAPES;

const deg = (phase: Animated.Value) => phase.interpolate({ inputRange: [0, 1], outputRange: [0, 360] });

/** One animated node, driven by a shared 0→1 looping `phase` value. */
export function AnimatedNode({
  node,
  phase,
  selected,
}: {
  node: DiagramNode;
  phase: Animated.Value;
  selected: boolean;
}) {
  const w = node.w;
  const h = node.h;
  const cx = node.x + w / 2;
  const cy = node.y + h / 2;
  const R = Math.min(w, h) / 2 - 3;
  const stroke = selected ? '#0068C9' : '#475569';

  const body = (() => {
    switch (node.shape) {
      case 'anim-pulse': {
        const r = phase.interpolate({ inputRange: [0, 1], outputRange: [R * 0.3, R] });
        const o = phase.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });
        return (
          <>
            <ACircle cx={cx} cy={cy} r={r} fill="none" stroke="#ef4444" strokeWidth={2} opacity={o} />
            <Circle cx={cx} cy={cy} r={R * 0.3} fill="#ef4444" />
          </>
        );
      }
      case 'anim-glow': {
        const o = phase.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 1, 0.25] });
        return (
          <>
            <ACircle cx={cx} cy={cy} r={R} fill="#f59e0b" opacity={o} />
            <Circle cx={cx} cy={cy} r={R * 0.55} fill="#fde68a" />
          </>
        );
      }
      case 'anim-spin': {
        // Gear teeth + hub, rotating.
        const teeth = [];
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI / 4) * i;
          const x = Math.cos(a) * R;
          const y = Math.sin(a) * R;
          teeth.push(<Rect key={i} x={x - 2.5} y={y - 2.5} width={5} height={5} fill={stroke} transform={`rotate(${(180 / Math.PI) * a} ${x} ${y})`} />);
        }
        return (
          <AG rotation={deg(phase)} originX={cx} originY={cy}>
            <G x={cx} y={cy}>
              <Circle cx={0} cy={0} r={R * 0.7} fill="none" stroke={stroke} strokeWidth={3} />
              <Circle cx={0} cy={0} r={R * 0.25} fill={stroke} />
              {teeth}
            </G>
          </AG>
        );
      }
      case 'anim-fan':
        return (
          <AG rotation={deg(phase)} originX={cx} originY={cy}>
            <G x={cx} y={cy}>
              <Circle cx={0} cy={0} r={R * 0.14} fill={stroke} />
              {[0, 120, 240].map((a) => (
                <Path
                  key={a}
                  d={`M0,0 Q ${R * 0.7},${-R * 0.5} ${R},0 Q ${R * 0.5},${R * 0.3} 0,0 Z`}
                  fill="#38bdf8"
                  opacity={0.85}
                  transform={`rotate(${a})`}
                />
              ))}
            </G>
          </AG>
        );
      case 'anim-signal': {
        const arcs = [0.45, 0.72, 1];
        return (
          <G x={cx} y={cy + R * 0.5}>
            <Circle cx={0} cy={0} r={R * 0.16} fill={stroke} />
            {arcs.map((f, i) => {
              const o = phase.interpolate({
                inputRange: [0, 1],
                outputRange: i === 0 ? [1, 0.4] : i === 1 ? [0.4, 1] : [0.7, 0.7],
              });
              const rr = R * f;
              return (
                <AG key={i} opacity={o}>
                  <Path d={`M ${-rr * 0.7},${-rr * 0.7} A ${rr},${rr} 0 0 1 ${rr * 0.7},${-rr * 0.7}`} fill="none" stroke="#22c55e" strokeWidth={2.4} />
                </AG>
              );
            })}
          </G>
        );
      }
      case 'anim-charge': {
        const lvl = phase.interpolate({ inputRange: [0, 1], outputRange: [h - 6, 8] });
        const fillH = phase.interpolate({ inputRange: [0, 1], outputRange: [0, h - 14] });
        return (
          <G x={node.x} y={node.y}>
            <Rect x={w * 0.35} y={0} width={w * 0.3} height={5} rx={1} fill={stroke} />
            <AnimatedRect x={6} width={w - 12} yAnim={lvl} hAnim={fillH} />
            <Rect x={4} y={6} width={w - 8} height={h - 8} rx={4} fill="none" stroke={stroke} strokeWidth={2} />
          </G>
        );
      }
      default:
        return <Circle cx={cx} cy={cy} r={R} fill="#e2e8f0" stroke={stroke} strokeWidth={1.5} />;
    }
  })();

  return (
    <>
      {body}
      {selected ? (
        <Rect x={node.x - 4} y={node.y - 4} width={w + 8} height={h + 8} fill="none" stroke="#3D7BFF" strokeWidth={1.6} rx={6} />
      ) : null}
    </>
  );
}

const ARect = Animated.createAnimatedComponent(Rect);
type AnimNum = Animated.AnimatedInterpolation<string | number>;
function AnimatedRect({ x, width, yAnim, hAnim }: { x: number; width: number; yAnim: AnimNum; hAnim: AnimNum }) {
  return <ARect x={x} width={width} y={yAnim as never} height={hAnim as never} rx={3} fill="#22c55e" opacity={0.7} />;
}
