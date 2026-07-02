/**
 * draw.io-style flowchart shapes: rectangle, rounded, square, circle, ellipse,
 * diamond, triangle, parallelogram, cylinder/DB, hexagon, process, step,
 * trapezoid, document, note, cloud, callout, actor and a text label.
 *
 * Each shape is a resizable X6 node with a centered, editable label, four
 * connection ports and a recolorable body (the property panel writes the fill
 * via "body/fill"). Geometry scales with the node:
 *  - rect/ellipse use X6 ref* attributes (refWidth, refRx, …)
 *  - path shapes use `refD`, which rescales the drawing's bounding box to the
 *    node, so the coordinates in `d` are arbitrary (only proportions matter).
 *
 * `drawioStyle` is the equivalent draw.io (mxGraph) style string, used by the
 * draw.io exporter (see drawio.ts) for round-trip fidelity.
 */

export type BasicTag = 'rect' | 'ellipse' | 'path';

export interface BasicShapeDef {
  /** Human label shown in the palette and used as the default node text. */
  label: string;
  width: number;
  height: number;
  /** SVG element used for the body. */
  tag: BasicTag;
  /** Geometry attributes for the body element (ref* values that scale). */
  body: Record<string, any>;
  /** Inner SVG for the 0 0 60 40 palette preview. */
  preview: string;
  /** Lock the aspect ratio while resizing (squares, circles). */
  keepRatio?: boolean;
  /** Text-only node — no visible box (transparent body). */
  noBox?: boolean;
  /** Equivalent draw.io/mxGraph style string for export. */
  drawioStyle: string;
}

export const BASIC_SHAPES: Record<string, BasicShapeDef> = {
  'basic-rectangle': {
    label: 'Rectangle',
    width: 140, height: 80, tag: 'rect',
    body: { refWidth: '100%', refHeight: '100%', rx: 2, ry: 2 },
    preview: '<rect x="6" y="9" width="48" height="22" rx="2" />',
    drawioStyle: 'rounded=0;whiteSpace=wrap;html=1;',
  },
  'basic-square': {
    label: 'Square',
    width: 100, height: 100, tag: 'rect', keepRatio: true,
    body: { refWidth: '100%', refHeight: '100%', rx: 2, ry: 2 },
    preview: '<rect x="14" y="6" width="28" height="28" rx="2" />',
    drawioStyle: 'rounded=0;whiteSpace=wrap;html=1;aspect=fixed;',
  },
  'basic-rounded': {
    label: 'Rounded',
    width: 140, height: 80, tag: 'rect',
    body: { refWidth: '100%', refHeight: '100%', rx: 16, ry: 16 },
    preview: '<rect x="6" y="9" width="48" height="22" rx="9" />',
    drawioStyle: 'rounded=1;whiteSpace=wrap;html=1;',
  },
  'basic-circle': {
    label: 'Circle',
    width: 100, height: 100, tag: 'ellipse', keepRatio: true,
    body: { refCx: '50%', refCy: '50%', refRx: '50%', refRy: '50%' },
    preview: '<circle cx="30" cy="20" r="15" />',
    drawioStyle: 'ellipse;whiteSpace=wrap;html=1;aspect=fixed;',
  },
  'basic-ellipse': {
    label: 'Ellipse',
    width: 140, height: 80, tag: 'ellipse',
    body: { refCx: '50%', refCy: '50%', refRx: '50%', refRy: '50%' },
    preview: '<ellipse cx="30" cy="20" rx="24" ry="13" />',
    drawioStyle: 'ellipse;whiteSpace=wrap;html=1;',
  },
  'basic-diamond': {
    label: 'Diamond',
    width: 120, height: 100, tag: 'path',
    body: { refD: 'M 60 0 L 120 50 L 60 100 L 0 50 Z' },
    preview: '<path d="M 30 5 L 52 20 L 30 35 L 8 20 Z" />',
    drawioStyle: 'rhombus;whiteSpace=wrap;html=1;',
  },
  'basic-triangle': {
    label: 'Triangle',
    width: 120, height: 100, tag: 'path',
    body: { refD: 'M 60 0 L 120 100 L 0 100 Z' },
    preview: '<path d="M 30 5 L 52 35 L 8 35 Z" />',
    drawioStyle: 'triangle;whiteSpace=wrap;html=1;direction=north;',
  },
  'basic-parallelogram': {
    label: 'Parallelogram',
    width: 150, height: 80, tag: 'path',
    body: { refD: 'M 30 0 L 150 0 L 120 80 L 0 80 Z' },
    preview: '<path d="M 16 9 L 54 9 L 44 31 L 6 31 Z" />',
    drawioStyle: 'shape=parallelogram;perimeter=parallelogramPerimeter;whiteSpace=wrap;html=1;',
  },
  'basic-cylinder': {
    label: 'Database',
    width: 110, height: 120, tag: 'path',
    // top ellipse + body + bottom curve — the classic DB cylinder
    body: { refD: 'M 0 14 a 55 14 0 0 0 110 0 a 55 14 0 0 0 -110 0 v 92 a 55 14 0 0 0 110 0 v -92' },
    preview: '<path d="M 18 8 a 12 4 0 0 0 24 0 a 12 4 0 0 0 -24 0 v 24 a 12 4 0 0 0 24 0 v -24" />',
    drawioStyle: 'shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=14;',
  },
  'basic-hexagon': {
    label: 'Hexagon',
    width: 140, height: 90, tag: 'path',
    body: { refD: 'M 0 45 L 35 0 L 105 0 L 140 45 L 105 90 L 35 90 Z' },
    preview: '<path d="M 8 20 L 18 8 L 42 8 L 52 20 L 42 32 L 18 32 Z" />',
    drawioStyle: 'shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;',
  },
  'basic-process': {
    label: 'Process',
    width: 140, height: 80, tag: 'path',
    body: { refD: 'M 0 0 H 140 V 80 H 0 Z M 14 0 V 80 M 126 0 V 80' },
    preview: '<rect x="6" y="10" width="48" height="20" /><path d="M 13 10 V 30 M 47 10 V 30" />',
    drawioStyle: 'shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;',
  },
  'basic-step': {
    label: 'Step',
    width: 140, height: 80, tag: 'path',
    body: { refD: 'M 0 0 L 112 0 L 140 40 L 112 80 L 0 80 L 28 40 Z' },
    preview: '<path d="M 8 12 L 44 12 L 54 20 L 44 28 L 8 28 L 16 20 Z" />',
    drawioStyle: 'shape=step;perimeter=stepPerimeter;whiteSpace=wrap;html=1;',
  },
  'basic-trapezoid': {
    label: 'Trapezoid',
    width: 140, height: 80, tag: 'path',
    body: { refD: 'M 24 0 L 116 0 L 140 80 L 0 80 Z' },
    preview: '<path d="M 16 12 L 44 12 L 52 30 L 8 30 Z" />',
    drawioStyle: 'shape=trapezoid;perimeter=trapezoidPerimeter;whiteSpace=wrap;html=1;',
  },
  'basic-document': {
    label: 'Document',
    width: 140, height: 90, tag: 'path',
    body: { refD: 'M 0 0 L 140 0 L 140 76 C 105 56 35 96 0 76 Z' },
    preview: '<path d="M 8 10 L 52 10 L 52 28 C 40 22 20 34 8 28 Z" />',
    drawioStyle: 'shape=document;whiteSpace=wrap;html=1;boundedLbl=1;',
  },
  'basic-note': {
    label: 'Note',
    width: 110, height: 110, tag: 'path',
    body: { refD: 'M 0 0 L 84 0 L 110 26 L 110 110 L 0 110 Z M 84 0 L 84 26 L 110 26' },
    preview: '<path d="M 8 8 L 42 8 L 52 18 L 52 34 L 8 34 Z M 42 8 L 42 18 L 52 18" />',
    drawioStyle: 'shape=note;whiteSpace=wrap;html=1;',
  },
  'basic-cloud': {
    label: 'Cloud',
    width: 150, height: 100, tag: 'path',
    body: { refD: 'M 37 88 C 12 88 5 64 25 56 C 12 32 45 18 55 36 C 60 12 110 12 116 36 C 142 30 152 60 128 70 C 142 92 105 100 88 90 C 78 100 47 100 37 88 Z' },
    preview: '<path d="M 18 30 C 8 30 6 20 16 18 C 14 10 30 8 33 16 C 36 6 56 6 58 16 C 64 14 68 24 58 27 C 64 34 48 36 42 32 C 38 36 24 36 18 30 Z" />',
    drawioStyle: 'ellipse;shape=cloud;whiteSpace=wrap;html=1;',
  },
  'basic-callout': {
    label: 'Callout',
    width: 140, height: 100, tag: 'path',
    body: { refD: 'M 0 0 L 140 0 L 140 72 L 48 72 L 30 100 L 30 72 L 0 72 Z' },
    preview: '<path d="M 6 8 L 54 8 L 54 26 L 24 26 L 18 34 L 18 26 L 6 26 Z" />',
    drawioStyle: 'shape=callout;whiteSpace=wrap;html=1;perimeter=calloutPerimeter;',
  },
  'basic-actor': {
    label: 'Actor',
    width: 70, height: 110, tag: 'path',
    body: { refD: 'M 35 4 a 14 14 0 1 1 -0.1 0 Z M 35 32 L 35 74 M 35 44 L 6 56 M 35 44 L 64 56 M 35 74 L 8 108 M 35 74 L 62 108' },
    preview: '<path d="M 30 7 a 4.5 4.5 0 1 1 -0.1 0 Z M 30 16 L 30 27 M 30 19 L 21 23 M 30 19 L 39 23 M 30 27 L 22 35 M 30 27 L 38 35" />',
    drawioStyle: 'shape=actor;whiteSpace=wrap;html=1;',
  },
  'basic-text': {
    label: 'Text',
    width: 120, height: 40, tag: 'rect', noBox: true,
    body: { refWidth: '100%', refHeight: '100%' },
    preview: '<text x="30" y="28" text-anchor="middle" font-size="22" fill="#e2e8f0" stroke="none" font-family="Roboto, sans-serif">T</text>',
    drawioStyle: 'text;html=1;align=center;verticalAlign=middle;',
  },
};

export function isBasic(shape: string): boolean {
  return shape.startsWith('basic-');
}
