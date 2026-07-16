import React from 'react';
import { Ellipse, Line, Path, Polygon, Rect } from 'react-native-svg';

/** Basic flowchart / block shapes, drawn to fill a node's w×h box at the origin. */
export const BASIC_SHAPES: Record<string, string> = {
  'basic-rectangle': 'Rectangle',
  'basic-rounded': 'Rounded',
  'basic-square': 'Square',
  'basic-circle': 'Circle',
  'basic-ellipse': 'Ellipse',
  'basic-diamond': 'Diamond',
  'basic-triangle': 'Triangle',
  'basic-trapezoid': 'Trapezoid',
  'basic-parallelogram': 'Parallelogram',
  'basic-hexagon': 'Hexagon',
  'basic-pentagon': 'Pentagon',
  'basic-star': 'Star',
  'basic-cylinder': 'Cylinder',
  'basic-cloud': 'Cloud',
  'basic-document': 'Document',
  'basic-note': 'Note',
  'basic-callout': 'Callout',
  'basic-process': 'Process',
  'basic-step': 'Step',
};

export const isBasicShape = (shape?: string) => !!shape && shape in BASIC_SHAPES;

interface P {
  w: number;
  h: number;
  fill: string;
  stroke: string;
  sw: number;
}

const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${x},${y}`).join(' ');

/** Render one basic shape's SVG geometry (already translated to the node origin). */
export function ShapeGeometry({ shape, w, h, fill, stroke, sw }: P & { shape: string }) {
  const common = { fill, stroke, strokeWidth: sw, strokeLinejoin: 'round' as const };
  switch (shape) {
    case 'basic-rectangle':
    case 'basic-square':
    case 'basic-process':
      return (
        <>
          <Rect x={0} y={0} width={w} height={h} {...common} />
          {shape === 'basic-process' ? (
            <>
              <Line x1={w * 0.1} y1={0} x2={w * 0.1} y2={h} stroke={stroke} strokeWidth={sw} />
              <Line x1={w * 0.9} y1={0} x2={w * 0.9} y2={h} stroke={stroke} strokeWidth={sw} />
            </>
          ) : null}
        </>
      );
    case 'basic-rounded':
      return <Rect x={0} y={0} width={w} height={h} rx={Math.min(w, h) * 0.18} {...common} />;
    case 'basic-circle': {
      const r = Math.min(w, h) / 2;
      return <Ellipse cx={w / 2} cy={h / 2} rx={r} ry={r} {...common} />;
    }
    case 'basic-ellipse':
      return <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...common} />;
    case 'basic-diamond':
      return <Polygon points={poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]])} {...common} />;
    case 'basic-triangle':
      return <Polygon points={poly([[w / 2, 0], [w, h], [0, h]])} {...common} />;
    case 'basic-trapezoid':
      return <Polygon points={poly([[w * 0.2, 0], [w * 0.8, 0], [w, h], [0, h]])} {...common} />;
    case 'basic-parallelogram':
      return <Polygon points={poly([[w * 0.25, 0], [w, 0], [w * 0.75, h], [0, h]])} {...common} />;
    case 'basic-hexagon':
      return (
        <Polygon
          points={poly([[w * 0.25, 0], [w * 0.75, 0], [w, h / 2], [w * 0.75, h], [w * 0.25, h], [0, h / 2]])}
          {...common}
        />
      );
    case 'basic-pentagon':
      return (
        <Polygon points={poly([[w / 2, 0], [w, h * 0.38], [w * 0.82, h], [w * 0.18, h], [0, h * 0.38]])} {...common} />
      );
    case 'basic-star': {
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) / 2;
      const r = R * 0.42;
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const ang = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? R : r;
        pts.push([cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]);
      }
      return <Polygon points={poly(pts)} {...common} />;
    }
    case 'basic-step':
      return (
        <Polygon
          points={poly([[0, 0], [w * 0.75, 0], [w, h / 2], [w * 0.75, h], [0, h], [w * 0.25, h / 2]])}
          {...common}
        />
      );
    case 'basic-cylinder': {
      const ry = h * 0.14;
      return (
        <>
          <Path d={`M0,${ry} A${w / 2},${ry} 0 0 1 ${w},${ry} L${w},${h - ry} A${w / 2},${ry} 0 0 1 0,${h - ry} Z`} {...common} />
          <Path d={`M0,${ry} A${w / 2},${ry} 0 0 0 ${w},${ry}`} fill="none" stroke={stroke} strokeWidth={sw} />
        </>
      );
    }
    case 'basic-document':
      return (
        <Path
          d={`M0,0 L${w},0 L${w},${h * 0.82} C${w * 0.75},${h} ${w * 0.25},${h * 0.64} 0,${h * 0.82} Z`}
          {...common}
        />
      );
    case 'basic-note':
      return (
        <>
          <Path d={`M0,0 L${w * 0.78},0 L${w},${h * 0.22} L${w},${h} L0,${h} Z`} {...common} />
          <Path d={`M${w * 0.78},0 L${w * 0.78},${h * 0.22} L${w},${h * 0.22}`} fill="none" stroke={stroke} strokeWidth={sw} />
        </>
      );
    case 'basic-callout':
      return (
        <Path
          d={`M${Math.min(w, h) * 0.16},0 H${w - Math.min(w, h) * 0.16} A${Math.min(w, h) * 0.16},${Math.min(w, h) * 0.16} 0 0 1 ${w},${Math.min(w, h) * 0.16} V${h * 0.62} A${Math.min(w, h) * 0.16},${Math.min(w, h) * 0.16} 0 0 1 ${w - Math.min(w, h) * 0.16},${h * 0.78} H${w * 0.4} L${w * 0.22},${h} L${w * 0.28},${h * 0.78} H${Math.min(w, h) * 0.16} A${Math.min(w, h) * 0.16},${Math.min(w, h) * 0.16} 0 0 1 0,${h * 0.62} V${Math.min(w, h) * 0.16} A${Math.min(w, h) * 0.16},${Math.min(w, h) * 0.16} 0 0 1 ${Math.min(w, h) * 0.16},0 Z`}
          {...common}
        />
      );
    case 'basic-cloud':
      return (
        <Path
          d={`M${w * 0.25},${h * 0.85} A${w * 0.18},${h * 0.24} 0 0 1 ${w * 0.2},${h * 0.45} A${w * 0.2},${h * 0.28} 0 0 1 ${w * 0.45},${h * 0.25} A${w * 0.22},${h * 0.3} 0 0 1 ${w * 0.8},${h * 0.35} A${w * 0.17},${h * 0.24} 0 0 1 ${w * 0.8},${h * 0.85} Z`}
          {...common}
        />
      );
    default:
      return <Rect x={0} y={0} width={w} height={h} rx={6} {...common} />;
  }
}
