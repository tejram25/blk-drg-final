/**
 * Animated components (robotic arm, siren light, fan, conveyor,
 * gear motor). Each is a tree of SVG parts; moving parts carry CSS classes
 * whose @keyframes live in styles.css, so they animate both in the palette
 * preview and on the canvas.
 *
 * Shape names ("anim-*") match the "shape" field from GET /api/block-types.
 */

export interface Part {
  tag: string;
  attrs: Record<string, string>;
  children?: Part[];
}

export interface AnimDef {
  width: number;
  height: number;
  parts: Part[];
  pins: { x: number; y: number }[];
}

const METAL = '#94a3b8';
const DARK = '#475569';
const LIGHT = '#e2e8f0';

export const ANIMATED_SYMBOLS: Record<string, AnimDef> = {
  'anim-robot-arm': {
    width: 80, height: 80,
    parts: [
      { tag: 'path', attrs: { d: 'M 24 80 L 56 80 L 52 68 L 28 68 Z', fill: DARK, stroke: METAL, 'stroke-width': '1.5' } },
      { tag: 'path', attrs: { d: 'M 40 68 L 40 44', stroke: LIGHT, 'stroke-width': '6', 'stroke-linecap': 'round', fill: 'none' } },
      {
        tag: 'g', attrs: { class: 'anim-arm-upper' },
        children: [
          { tag: 'path', attrs: { d: 'M 40 44 L 66 24', stroke: LIGHT, 'stroke-width': '5', 'stroke-linecap': 'round', fill: 'none' } },
          { tag: 'circle', attrs: { cx: '66', cy: '24', r: '3', fill: METAL } },
          { tag: 'path', attrs: { d: 'M 66 24 L 75 17 M 66 24 L 76 25', stroke: '#22d3ee', 'stroke-width': '3', 'stroke-linecap': 'round', fill: 'none' } },
        ],
      },
      { tag: 'circle', attrs: { cx: '40', cy: '44', r: '4.5', fill: METAL } },
    ],
    pins: [{ x: 0, y: 72 }, { x: 80, y: 72 }],
  },
  'anim-siren': {
    width: 60, height: 56,
    parts: [
      { tag: 'path', attrs: { d: 'M 14 46 A 16 16 0 0 1 46 46 Z', fill: '#ef4444', stroke: '#fca5a5', 'stroke-width': '1.5', class: 'anim-pulse' } },
      { tag: 'path', attrs: { d: 'M 30 22 L 30 12 M 13 32 L 4 26 M 47 32 L 56 26', stroke: '#fbbf24', 'stroke-width': '2.5', 'stroke-linecap': 'round', fill: 'none', class: 'anim-pulse-alt' } },
      { tag: 'path', attrs: { d: 'M 14 56 L 46 56 L 43 46 L 17 46 Z', fill: DARK, stroke: METAL, 'stroke-width': '1.5' } },
    ],
    pins: [{ x: 0, y: 50 }, { x: 60, y: 50 }],
  },
  'anim-fan': {
    width: 60, height: 60,
    parts: [
      { tag: 'circle', attrs: { cx: '30', cy: '30', r: '26', fill: 'none', stroke: METAL, 'stroke-width': '2' } },
      {
        tag: 'g', attrs: { class: 'anim-spin' },
        children: [
          { tag: 'path', attrs: { d: 'M 30 30 C 24 20 24 12 30 8 C 36 12 36 20 30 30 Z', fill: '#22d3ee' } },
          { tag: 'path', attrs: { d: 'M 30 30 C 24 20 24 12 30 8 C 36 12 36 20 30 30 Z', fill: '#22d3ee', transform: 'rotate(120 30 30)' } },
          { tag: 'path', attrs: { d: 'M 30 30 C 24 20 24 12 30 8 C 36 12 36 20 30 30 Z', fill: '#22d3ee', transform: 'rotate(240 30 30)' } },
        ],
      },
      { tag: 'circle', attrs: { cx: '30', cy: '30', r: '3.5', fill: LIGHT } },
    ],
    pins: [{ x: 0, y: 30 }, { x: 60, y: 30 }],
  },
  'anim-conveyor': {
    width: 110, height: 48,
    parts: [
      { tag: 'path', attrs: { d: 'M 15 20 L 95 20 A 12 12 0 1 1 95 44 L 15 44 A 12 12 0 1 1 15 20 Z', fill: 'none', stroke: METAL, 'stroke-width': '2' } },
      { tag: 'path', attrs: { d: 'M 15 32 L 95 32', stroke: '#22d3ee', 'stroke-width': '2', 'stroke-dasharray': '6 6', fill: 'none', class: 'anim-belt' } },
      {
        tag: 'g', attrs: { class: 'anim-spin' },
        children: [{ tag: 'path', attrs: { d: 'M 15 25 L 15 39 M 8 32 L 22 32', stroke: METAL, 'stroke-width': '2', fill: 'none' } }],
      },
      {
        tag: 'g', attrs: { class: 'anim-spin' },
        children: [{ tag: 'path', attrs: { d: 'M 95 25 L 95 39 M 88 32 L 102 32', stroke: METAL, 'stroke-width': '2', fill: 'none' } }],
      },
    ],
    pins: [{ x: 0, y: 32 }, { x: 110, y: 32 }],
  },
  'anim-gear': {
    width: 60, height: 60,
    parts: [
      {
        tag: 'g', attrs: { class: 'anim-spin-slow' },
        children: [
          { tag: 'circle', attrs: { cx: '30', cy: '30', r: '14', fill: 'none', stroke: LIGHT, 'stroke-width': '3' } },
          {
            tag: 'path', attrs: {
              d: 'M 44 30 L 52 30 M 39.9 39.9 L 45.6 45.6 M 30 44 L 30 52 M 20.1 39.9 L 14.4 45.6 ' +
                 'M 16 30 L 8 30 M 20.1 20.1 L 14.4 14.4 M 30 16 L 30 8 M 39.9 20.1 L 45.6 14.4',
              stroke: LIGHT, 'stroke-width': '5', 'stroke-linecap': 'round', fill: 'none',
            },
          },
        ],
      },
      { tag: 'circle', attrs: { cx: '30', cy: '30', r: '4', fill: '#22d3ee' } },
    ],
    pins: [{ x: 0, y: 30 }, { x: 60, y: 30 }],
  },
  'anim-antenna': {
    width: 70, height: 70,
    parts: [
      { tag: 'path', attrs: { d: 'M 30 64 L 35 20 L 40 64 Z M 31.5 50 L 38.5 50 M 32.5 36 L 37.5 36', fill: 'none', stroke: METAL, 'stroke-width': '2' } },
      { tag: 'path', attrs: { d: 'M 22 70 L 48 70 L 44 64 L 26 64 Z', fill: DARK, stroke: METAL, 'stroke-width': '1.5' } },
      { tag: 'circle', attrs: { cx: '35', cy: '18', r: '3', fill: '#f87171', class: 'anim-pulse' } },
      { tag: 'path', attrs: { d: 'M 43 25 A 10 10 0 0 0 43 11 M 27 25 A 10 10 0 0 1 27 11', fill: 'none', stroke: '#22d3ee', 'stroke-width': '2.5', 'stroke-linecap': 'round', class: 'anim-pulse' } },
      { tag: 'path', attrs: { d: 'M 49 30 A 17 17 0 0 0 49 6 M 21 30 A 17 17 0 0 1 21 6', fill: 'none', stroke: '#22d3ee', 'stroke-width': '2.5', 'stroke-linecap': 'round', class: 'anim-pulse-alt' } },
    ],
    pins: [{ x: 0, y: 64 }, { x: 70, y: 64 }],
  },
  'anim-pump': {
    width: 80, height: 60,
    parts: [
      { tag: 'path', attrs: { d: 'M 0 38 L 20 38', stroke: METAL, 'stroke-width': '7', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 53 23 L 68 8', stroke: METAL, 'stroke-width': '7', fill: 'none', 'stroke-linecap': 'round' } },
      { tag: 'circle', attrs: { cx: '40', cy: '38', r: '20', fill: '#1e293b', stroke: METAL, 'stroke-width': '2' } },
      {
        tag: 'g', attrs: { class: 'anim-spin' },
        children: [
          { tag: 'path', attrs: { d: 'M 40 38 L 40 23 M 40 38 L 53 45 M 40 38 L 27 45', stroke: '#22d3ee', 'stroke-width': '4', 'stroke-linecap': 'round', fill: 'none' } },
        ],
      },
      { tag: 'circle', attrs: { cx: '40', cy: '38', r: '3.5', fill: LIGHT } },
    ],
    pins: [{ x: 0, y: 38 }, { x: 70, y: 6 }],
  },
  'anim-stack-light': {
    width: 44, height: 64,
    parts: [
      { tag: 'path', attrs: { d: 'M 10 64 L 34 64 L 31 56 L 13 56 Z', fill: DARK, stroke: METAL, 'stroke-width': '1.5' } },
      { tag: 'path', attrs: { d: 'M 22 56 L 22 50', stroke: METAL, 'stroke-width': '4', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 12 14 Q 12 6 22 6 Q 32 6 32 14 Z', fill: METAL } },
      { tag: 'rect', attrs: { x: '12', y: '14', width: '20', height: '12', fill: '#ef4444', class: 'anim-cycle-1' } },
      { tag: 'rect', attrs: { x: '12', y: '26', width: '20', height: '12', fill: '#facc15', class: 'anim-cycle-2' } },
      { tag: 'rect', attrs: { x: '12', y: '38', width: '20', height: '12', fill: '#22c55e', class: 'anim-cycle-3' } },
      { tag: 'rect', attrs: { x: '12', y: '14', width: '20', height: '36', fill: 'none', stroke: '#1e293b', 'stroke-width': '1.5' } },
    ],
    pins: [{ x: 0, y: 58 }, { x: 44, y: 58 }],
  },
  'anim-piston': {
    width: 80, height: 60,
    parts: [
      {
        tag: 'g', attrs: { class: 'anim-piston' },
        children: [
          { tag: 'path', attrs: { d: 'M 46 30 L 74 30', stroke: LIGHT, 'stroke-width': '5', 'stroke-linecap': 'round', fill: 'none' } },
          { tag: 'rect', attrs: { x: '38', y: '20', width: '9', height: '20', fill: '#22d3ee', rx: '1.5' } },
        ],
      },
      { tag: 'path', attrs: { d: 'M 50 18 L 8 18 L 8 42 L 50 42', fill: 'none', stroke: METAL, 'stroke-width': '2.5' } },
      { tag: 'path', attrs: { d: 'M 14 42 L 14 50 M 42 42 L 42 50', stroke: METAL, 'stroke-width': '2.5', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 8 50 L 48 50', stroke: DARK, 'stroke-width': '3', fill: 'none' } },
    ],
    pins: [{ x: 0, y: 30 }, { x: 80, y: 30 }],
  },
  'anim-tank': {
    width: 60, height: 70,
    parts: [
      { tag: 'rect', attrs: { x: '12', y: '28', width: '36', height: '32', fill: '#0ea5e9', opacity: '0.75', class: 'anim-level' } },
      { tag: 'rect', attrs: { x: '10', y: '6', width: '40', height: '56', rx: '6', fill: 'none', stroke: METAL, 'stroke-width': '2.5' } },
      { tag: 'path', attrs: { d: 'M 17 62 L 17 70 M 43 62 L 43 70', stroke: METAL, 'stroke-width': '3', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 26 6 L 34 6', stroke: DARK, 'stroke-width': '5', fill: 'none' } },
    ],
    pins: [{ x: 0, y: 34 }, { x: 60, y: 34 }],
  },
  'anim-drone': {
    width: 80, height: 50,
    parts: [
      { tag: 'path', attrs: { d: 'M 16 14 L 16 24 M 64 14 L 64 24', stroke: METAL, 'stroke-width': '3', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 16 24 L 32 30 M 64 24 L 48 30', stroke: METAL, 'stroke-width': '3', 'stroke-linecap': 'round', fill: 'none' } },
      { tag: 'rect', attrs: { x: '28', y: '24', width: '24', height: '14', rx: '7', fill: DARK, stroke: METAL, 'stroke-width': '1.5' } },
      { tag: 'circle', attrs: { cx: '40', cy: '38', r: '2.5', fill: '#22d3ee' } },
      {
        tag: 'g', attrs: { class: 'anim-spin' },
        children: [{ tag: 'path', attrs: { d: 'M 4 14 L 28 14', stroke: LIGHT, 'stroke-width': '3', 'stroke-linecap': 'round', fill: 'none' } }],
      },
      {
        tag: 'g', attrs: { class: 'anim-spin' },
        children: [{ tag: 'path', attrs: { d: 'M 52 14 L 76 14', stroke: LIGHT, 'stroke-width': '3', 'stroke-linecap': 'round', fill: 'none' } }],
      },
    ],
    pins: [{ x: 0, y: 28 }, { x: 80, y: 28 }],
  },
  // ---- Power / energy set ----
  'anim-glow-battery': {
    width: 70, height: 44,
    parts: [
      { tag: 'rect', attrs: { x: '6', y: '8', width: '54', height: '28', rx: '5', fill: 'none', stroke: '#22c55e', 'stroke-width': '2', opacity: '0.4', class: 'anim-pulse' } },
      { tag: 'rect', attrs: { x: '8', y: '10', width: '50', height: '24', rx: '3', fill: 'none', stroke: METAL, 'stroke-width': '2' } },
      { tag: 'rect', attrs: { x: '58', y: '17', width: '6', height: '10', fill: METAL } },
      { tag: 'rect', attrs: { x: '13', y: '15', width: '10', height: '14', fill: '#22c55e', class: 'anim-charge-1' } },
      { tag: 'rect', attrs: { x: '27', y: '15', width: '10', height: '14', fill: '#22c55e', class: 'anim-charge-2' } },
      { tag: 'rect', attrs: { x: '41', y: '15', width: '10', height: '14', fill: '#22c55e', class: 'anim-charge-3' } },
    ],
    pins: [{ x: 0, y: 22 }, { x: 70, y: 22 }],
  },
  'anim-inverter': {
    width: 80, height: 60,
    parts: [
      { tag: 'path', attrs: { d: 'M 0 30 L 10 30 M 70 30 L 80 30', stroke: METAL, 'stroke-width': '4', fill: 'none' } },
      { tag: 'rect', attrs: { x: '10', y: '10', width: '60', height: '40', rx: '4', fill: '#1e293b', stroke: METAL, 'stroke-width': '2' } },
      { tag: 'path', attrs: { d: 'M 10 50 L 70 10', stroke: METAL, 'stroke-width': '1.5', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 18 22 L 32 22 M 18 27 L 22 27 M 25 27 L 29 27', stroke: LIGHT, 'stroke-width': '2', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 44 40 Q 49 30 54 40 Q 59 50 64 40', stroke: '#22d3ee', 'stroke-width': '2.5', 'stroke-dasharray': '4 4', fill: 'none', class: 'anim-belt' } },
    ],
    pins: [{ x: 0, y: 30 }, { x: 80, y: 30 }],
  },
  'anim-transformer': {
    width: 90, height: 60,
    parts: [
      { tag: 'path', attrs: { d: 'M 0 30 L 27 30 M 63 30 L 90 30', stroke: METAL, 'stroke-width': '3', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 34 12 A 7 6 0 0 0 34 24 A 7 6 0 0 0 34 36 A 7 6 0 0 0 34 48', stroke: LIGHT, 'stroke-width': '2.5', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 56 12 A 7 6 0 0 1 56 24 A 7 6 0 0 1 56 36 A 7 6 0 0 1 56 48', stroke: LIGHT, 'stroke-width': '2.5', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 43 10 L 43 50 M 47 10 L 47 50', stroke: METAL, 'stroke-width': '2', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 40 7 A 6 4 0 0 1 50 7', stroke: '#22d3ee', 'stroke-width': '2', fill: 'none', 'stroke-linecap': 'round', class: 'anim-pulse' } },
      { tag: 'path', attrs: { d: 'M 40 53 A 6 4 0 0 0 50 53', stroke: '#22d3ee', 'stroke-width': '2', fill: 'none', 'stroke-linecap': 'round', class: 'anim-pulse-alt' } },
    ],
    pins: [{ x: 0, y: 30 }, { x: 90, y: 30 }],
  },
  'anim-solar': {
    width: 80, height: 60,
    parts: [
      { tag: 'circle', attrs: { cx: '62', cy: '11', r: '6', fill: '#facc15', class: 'anim-pulse' } },
      { tag: 'path', attrs: { d: 'M 62 3 L 62 1 M 54 6 L 52.5 4.5 M 70 6 L 71.5 4.5', stroke: '#facc15', 'stroke-width': '2', 'stroke-linecap': 'round', fill: 'none', class: 'anim-pulse-alt' } },
      { tag: 'path', attrs: { d: 'M 16 24 L 64 24 L 72 44 L 8 44 Z', fill: '#1d4ed8', stroke: METAL, 'stroke-width': '2' } },
      { tag: 'path', attrs: { d: 'M 31 24 L 28 44 M 47 24 L 49 44 M 12 34 L 68 34', stroke: '#93c5fd', 'stroke-width': '1', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 40 44 L 40 54 M 28 54 L 52 54', stroke: METAL, 'stroke-width': '3', fill: 'none' } },
    ],
    pins: [{ x: 0, y: 40 }, { x: 80, y: 40 }],
  },
  'anim-wind-turbine': {
    width: 70, height: 80,
    parts: [
      { tag: 'path', attrs: { d: 'M 33 76 L 34.5 28 L 35.5 28 L 37 76 Z', fill: METAL } },
      { tag: 'path', attrs: { d: 'M 24 80 L 46 80 L 43 76 L 27 76 Z', fill: DARK, stroke: METAL, 'stroke-width': '1.5' } },
      {
        tag: 'g', attrs: { class: 'anim-spin-wind' },
        children: [
          { tag: 'path', attrs: { d: 'M 35 26 Q 38 16 35 4 Q 32 16 35 26 Z', fill: LIGHT } },
          { tag: 'path', attrs: { d: 'M 35 26 Q 38 16 35 4 Q 32 16 35 26 Z', fill: LIGHT, transform: 'rotate(120 35 26)' } },
          { tag: 'path', attrs: { d: 'M 35 26 Q 38 16 35 4 Q 32 16 35 26 Z', fill: LIGHT, transform: 'rotate(240 35 26)' } },
        ],
      },
      { tag: 'circle', attrs: { cx: '35', cy: '26', r: '3', fill: '#22d3ee' } },
    ],
    pins: [{ x: 0, y: 72 }, { x: 70, y: 72 }],
  },
  'anim-generator': {
    width: 70, height: 60,
    parts: [
      { tag: 'path', attrs: { d: 'M 0 30 L 13 30 M 57 30 L 70 30', stroke: METAL, 'stroke-width': '4', fill: 'none' } },
      { tag: 'circle', attrs: { cx: '35', cy: '30', r: '22', fill: '#1e293b', stroke: METAL, 'stroke-width': '2' } },
      {
        tag: 'g', attrs: { class: 'anim-spin-slow' },
        children: [{ tag: 'path', attrs: { d: 'M 35 14 L 35 46 M 19 30 L 51 30 M 24 19 L 46 41 M 46 19 L 24 41', stroke: '#22d3ee', 'stroke-width': '3', 'stroke-linecap': 'round', fill: 'none' } }],
      },
      { tag: 'circle', attrs: { cx: '35', cy: '30', r: '4', fill: LIGHT } },
    ],
    pins: [{ x: 0, y: 30 }, { x: 70, y: 30 }],
  },
  'anim-ev-charger': {
    width: 60, height: 70,
    parts: [
      { tag: 'rect', attrs: { x: '14', y: '10', width: '28', height: '52', rx: '4', fill: '#1e293b', stroke: METAL, 'stroke-width': '2' } },
      { tag: 'rect', attrs: { x: '20', y: '16', width: '16', height: '10', fill: '#0ea5e9', opacity: '0.7' } },
      { tag: 'path', attrs: { d: 'M 30 32 L 24 44 L 29 44 L 26 56 L 36 42 L 30 42 L 34 32 Z', fill: '#facc15', class: 'anim-pulse' } },
      { tag: 'path', attrs: { d: 'M 42 30 Q 54 34 50 48', stroke: METAL, 'stroke-width': '3', fill: 'none' } },
      { tag: 'circle', attrs: { cx: '50', cy: '51', r: '3', fill: METAL } },
    ],
    pins: [{ x: 0, y: 40 }, { x: 60, y: 40 }],
  },
  'anim-pylon': {
    width: 80, height: 80,
    parts: [
      { tag: 'path', attrs: { d: 'M 30 76 L 40 12 L 50 76 M 33 60 L 47 60 M 35 44 L 45 44 M 36 30 L 44 30 M 20 28 L 60 28', fill: 'none', stroke: METAL, 'stroke-width': '2' } },
      { tag: 'path', attrs: { d: 'M 24 28 L 24 34 M 56 28 L 56 34', stroke: METAL, 'stroke-width': '2', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 0 36 Q 12 42 24 34 M 56 34 Q 68 42 80 36', stroke: '#22d3ee', 'stroke-width': '2', 'stroke-dasharray': '5 5', fill: 'none', class: 'anim-belt' } },
    ],
    pins: [{ x: 0, y: 36 }, { x: 80, y: 36 }],
  },
  'anim-relay': {
    width: 90, height: 50,
    parts: [
      { tag: 'path', attrs: { d: 'M 0 25 L 26 25 M 64 25 L 90 25', stroke: LIGHT, 'stroke-width': '2.5', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 23 25 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0 M 61 25 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: LIGHT } },
      {
        tag: 'g', attrs: { class: 'anim-relay-lever' },
        children: [{ tag: 'path', attrs: { d: 'M 26 25 L 62 12', stroke: LIGHT, 'stroke-width': '3', 'stroke-linecap': 'round', fill: 'none' } }],
      },
      { tag: 'rect', attrs: { x: '36', y: '32', width: '18', height: '12', fill: 'none', stroke: METAL, 'stroke-width': '2' } },
      { tag: 'path', attrs: { d: 'M 36 44 L 54 32', stroke: METAL, 'stroke-width': '1.5', fill: 'none' } },
    ],
    pins: [{ x: 0, y: 25 }, { x: 90, y: 25 }],
  },
  'anim-heater': {
    width: 70, height: 50,
    parts: [
      { tag: 'path', attrs: { d: 'M 0 25 L 8 25 M 62 25 L 70 25', stroke: METAL, 'stroke-width': '3', fill: 'none' } },
      { tag: 'rect', attrs: { x: '8', y: '8', width: '54', height: '34', rx: '4', fill: 'none', stroke: METAL, 'stroke-width': '2' } },
      { tag: 'path', attrs: { d: 'M 16 14 L 16 36 M 25 14 L 25 36 M 34 14 L 34 36 M 43 14 L 43 36 M 52 14 L 52 36', stroke: '#f87171', 'stroke-width': '4', 'stroke-linecap': 'round', fill: 'none', class: 'anim-glow' } },
    ],
    pins: [{ x: 0, y: 25 }, { x: 70, y: 25 }],
  },
  'anim-bulb': {
    width: 50, height: 60,
    parts: [
      { tag: 'circle', attrs: { cx: '25', cy: '22', r: '17', fill: '#fde68a', opacity: '0.3', class: 'anim-pulse' } },
      { tag: 'circle', attrs: { cx: '25', cy: '22', r: '12', fill: 'none', stroke: METAL, 'stroke-width': '2' } },
      { tag: 'path', attrs: { d: 'M 19 26 L 22 19 L 25 26 L 28 19 L 31 26', stroke: '#f59e0b', 'stroke-width': '2', 'stroke-linecap': 'round', fill: 'none', class: 'anim-glow' } },
      { tag: 'path', attrs: { d: 'M 19 38 L 31 38 M 20 42 L 30 42 M 21 46 L 29 46 M 23 50 L 27 50', stroke: METAL, 'stroke-width': '2.5', fill: 'none' } },
      { tag: 'path', attrs: { d: 'M 20 34 L 30 34', stroke: METAL, 'stroke-width': '3', fill: 'none' } },
    ],
    pins: [{ x: 0, y: 42 }, { x: 50, y: 42 }],
  },
};

/** Serialize a part tree to an SVG string (used for the palette preview). */
export function partsToSvg(shape: string): string {
  const def = ANIMATED_SYMBOLS[shape];
  if (!def) return '';
  const ser = (p: Part): string => {
    const a = Object.entries(p.attrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    return p.children?.length
      ? `<${p.tag} ${a}>${p.children.map(ser).join('')}</${p.tag}>`
      : `<${p.tag} ${a}/>`;
  };
  return def.parts.map(ser).join('');
}

