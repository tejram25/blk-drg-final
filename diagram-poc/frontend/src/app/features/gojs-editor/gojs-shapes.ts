/**
 * Native GoJS shape catalogue. Every palette shape is a real `go.Shape` driven by
 * a GoJS figure (built-in or registered here) — no SVG-image bridging. Figures we
 * define ourselves are authored once as a normalised path (a 0..100 box) and reused
 * for both the live `defineFigureGenerator` geometry and the palette thumbnail, so
 * the preview always matches what lands on the canvas.
 */
import * as go from 'gojs';

export interface ShapeDef {
  /** Palette key / node-data `shape` value. */
  key: string;
  label: string;
  /** Palette grouping. */
  category: 'Shapes' | 'Flowchart' | 'Logic';
  /** GoJS figure name the node's main Shape renders. */
  figure: string;
  /** Default node size (px) — sets the aspect ratio. */
  w: number;
  h: number;
}

/**
 * Custom figure geometry, authored as SVG path data inside a 0..100 box. These are
 * registered as GoJS figure generators (scaled to the node's size) and also drawn
 * directly as the palette thumbnail.
 */
const GEO: Record<string, string> = {
  // basic geometry not guaranteed in the GoJS core figure set
  FcParallelogram: 'M20 8 L100 8 L80 92 L0 92 Z',
  FcTrapezoid: 'M22 8 L78 8 L100 92 L0 92 Z',
  FcPentagon: 'M50 4 L96 38 L78 96 L22 96 L4 38 Z',
  FcHexagon: 'M26 6 L74 6 L98 50 L74 94 L26 94 L2 50 Z',
  FcOctagon: 'M32 4 L68 4 L96 32 L96 68 L68 96 L32 96 L4 68 L4 32 Z',
  FcStar: 'M50 4 L61 37 L97 37 L68 59 L79 95 L50 73 L21 95 L32 59 L3 37 L39 37 Z',
  FcCylinder: 'M2 14 A48 12 0 0 1 98 14 L98 86 A48 12 0 0 1 2 86 Z M2 14 A48 12 0 0 0 98 14',
  FcCloud: 'M28 80 C8 80 6 54 24 50 C16 30 46 20 55 34 C62 18 90 24 84 45 C102 48 96 80 76 80 Z',
  FcRightArrow: 'M0 32 L58 32 L58 10 L100 50 L58 90 L58 68 L0 68 Z',
  FcChevron: 'M0 8 L66 8 L98 50 L66 92 L0 92 L32 50 Z',
  FcCallout: 'M8 6 L92 6 Q100 6 100 16 L100 60 Q100 70 92 70 L44 70 L28 94 L32 70 L8 70 Q0 70 0 60 L0 16 Q0 6 8 6 Z',
  // flowchart
  FcTerminator: 'M28 6 L72 6 Q100 6 100 50 Q100 94 72 94 L28 94 Q0 94 0 50 Q0 6 28 6 Z',
  FcDocument: 'M2 6 L98 6 L98 78 Q74 96 50 82 Q26 68 2 84 Z',
  FcPredefined: 'M0 6 L100 6 L100 94 L0 94 Z M12 6 L12 94 M88 6 L88 94',
  FcManualInput: 'M0 24 L100 6 L100 94 L0 94 Z',
  FcManualOp: 'M16 6 L84 6 L100 94 L0 94 Z',
  FcPreparation: 'M22 6 L78 6 L100 50 L78 94 L22 94 L0 50 Z',
  FcDelay: 'M0 6 L68 6 Q100 6 100 50 Q100 94 68 94 L0 94 Z',
  FcDisplay: 'M0 50 L22 6 L82 6 Q100 6 100 50 Q100 94 82 94 L22 94 Z',
  FcCard: 'M22 6 L100 6 L100 94 L0 94 L0 24 Z',
  // logic gates
  FcAnd: 'M6 6 L48 6 A44 44 0 0 1 48 94 L6 94 Z',
  FcNand: 'M6 6 L44 6 A40 40 0 0 1 44 94 L6 94 Z M84 50 A8 8 0 1 1 100 50 A8 8 0 1 1 84 50',
  FcOr: 'M4 6 Q46 6 90 50 Q46 94 4 94 Q30 50 4 6 Z',
  FcNor: 'M4 6 Q42 6 80 50 Q42 94 4 94 Q30 50 4 6 Z M80 50 A8 8 0 1 1 96 50 A8 8 0 1 1 80 50',
  FcNot: 'M6 6 L82 50 L6 94 Z M82 50 A8 8 0 1 1 98 50 A8 8 0 1 1 82 50',
  FcXor: 'M14 6 Q54 6 92 50 Q54 94 14 94 Q40 50 14 6 Z M2 6 Q28 50 2 94',
};

/** Thumbnail geometry for figures we render with GoJS core generators. */
const CORE_PREVIEW: Record<string, string> = {
  Rectangle: '<rect x="6" y="26" width="88" height="48"/>',
  RoundedRectangle: '<rect x="6" y="26" width="88" height="48" rx="12" ry="12"/>',
  Square: '<rect x="14" y="14" width="72" height="72"/>',
  Circle: '<circle cx="50" cy="50" r="42"/>',
  Ellipse: '<ellipse cx="50" cy="50" rx="46" ry="30"/>',
  Triangle: '<path d="M50 8 L94 90 L6 90 Z"/>',
  Diamond: '<path d="M50 6 L94 50 L50 94 L6 50 Z"/>',
};

export const SHAPE_DEFS: ShapeDef[] = [
  // Basic geometry
  { key: 'sh-rect', label: 'Rectangle', category: 'Shapes', figure: 'Rectangle', w: 108, h: 60 },
  { key: 'sh-round', label: 'Rounded Rectangle', category: 'Shapes', figure: 'RoundedRectangle', w: 108, h: 60 },
  { key: 'sh-square', label: 'Square', category: 'Shapes', figure: 'Square', w: 80, h: 80 },
  { key: 'sh-circle', label: 'Circle', category: 'Shapes', figure: 'Circle', w: 80, h: 80 },
  { key: 'sh-ellipse', label: 'Ellipse', category: 'Shapes', figure: 'Ellipse', w: 112, h: 72 },
  { key: 'sh-triangle', label: 'Triangle', category: 'Shapes', figure: 'Triangle', w: 88, h: 78 },
  { key: 'sh-diamond', label: 'Diamond', category: 'Shapes', figure: 'Diamond', w: 100, h: 74 },
  { key: 'sh-parallelogram', label: 'Parallelogram', category: 'Shapes', figure: 'FcParallelogram', w: 112, h: 64 },
  { key: 'sh-trapezoid', label: 'Trapezoid', category: 'Shapes', figure: 'FcTrapezoid', w: 108, h: 64 },
  { key: 'sh-pentagon', label: 'Pentagon', category: 'Shapes', figure: 'FcPentagon', w: 88, h: 82 },
  { key: 'sh-hexagon', label: 'Hexagon', category: 'Shapes', figure: 'FcHexagon', w: 100, h: 74 },
  { key: 'sh-octagon', label: 'Octagon', category: 'Shapes', figure: 'FcOctagon', w: 86, h: 82 },
  { key: 'sh-star', label: 'Star', category: 'Shapes', figure: 'FcStar', w: 88, h: 82 },
  { key: 'sh-cylinder', label: 'Cylinder', category: 'Shapes', figure: 'FcCylinder', w: 82, h: 86 },
  { key: 'sh-cloud', label: 'Cloud', category: 'Shapes', figure: 'FcCloud', w: 112, h: 76 },
  { key: 'sh-arrow', label: 'Arrow', category: 'Shapes', figure: 'FcRightArrow', w: 112, h: 64 },
  { key: 'sh-chevron', label: 'Chevron', category: 'Shapes', figure: 'FcChevron', w: 100, h: 64 },
  { key: 'sh-callout', label: 'Callout', category: 'Shapes', figure: 'FcCallout', w: 118, h: 78 },
  // Flowchart
  { key: 'fc-process', label: 'Process', category: 'Flowchart', figure: 'Rectangle', w: 118, h: 58 },
  { key: 'fc-terminator', label: 'Terminator', category: 'Flowchart', figure: 'FcTerminator', w: 118, h: 56 },
  { key: 'fc-decision', label: 'Decision', category: 'Flowchart', figure: 'Diamond', w: 108, h: 76 },
  { key: 'fc-data', label: 'Data (I/O)', category: 'Flowchart', figure: 'FcParallelogram', w: 112, h: 60 },
  { key: 'fc-document', label: 'Document', category: 'Flowchart', figure: 'FcDocument', w: 110, h: 66 },
  { key: 'fc-predefined', label: 'Predefined Process', category: 'Flowchart', figure: 'FcPredefined', w: 118, h: 58 },
  { key: 'fc-manual-input', label: 'Manual Input', category: 'Flowchart', figure: 'FcManualInput', w: 110, h: 58 },
  { key: 'fc-manual-op', label: 'Manual Operation', category: 'Flowchart', figure: 'FcManualOp', w: 110, h: 58 },
  { key: 'fc-preparation', label: 'Preparation', category: 'Flowchart', figure: 'FcPreparation', w: 112, h: 66 },
  { key: 'fc-database', label: 'Database', category: 'Flowchart', figure: 'FcCylinder', w: 82, h: 86 },
  { key: 'fc-delay', label: 'Delay', category: 'Flowchart', figure: 'FcDelay', w: 108, h: 60 },
  { key: 'fc-display', label: 'Display', category: 'Flowchart', figure: 'FcDisplay', w: 116, h: 60 },
  { key: 'fc-card', label: 'Card', category: 'Flowchart', figure: 'FcCard', w: 110, h: 66 },
  { key: 'fc-connector', label: 'Connector', category: 'Flowchart', figure: 'Circle', w: 56, h: 56 },
  // Logic gates
  { key: 'lg-and', label: 'AND', category: 'Logic', figure: 'FcAnd', w: 92, h: 66 },
  { key: 'lg-nand', label: 'NAND', category: 'Logic', figure: 'FcNand', w: 100, h: 66 },
  { key: 'lg-or', label: 'OR', category: 'Logic', figure: 'FcOr', w: 96, h: 66 },
  { key: 'lg-nor', label: 'NOR', category: 'Logic', figure: 'FcNor', w: 104, h: 66 },
  { key: 'lg-not', label: 'NOT / Inverter', category: 'Logic', figure: 'FcNot', w: 96, h: 66 },
  { key: 'lg-xor', label: 'XOR', category: 'Logic', figure: 'FcXor', w: 100, h: 66 },
];

const BY_KEY = new Map(SHAPE_DEFS.map((d) => [d.key, d]));

/** Look up a shape definition by its palette key. */
export function shapeDef(key: string | undefined): ShapeDef | undefined {
  return key ? BY_KEY.get(key) : undefined;
}
export function isShapeKey(key: string | undefined): boolean {
  return !!key && BY_KEY.has(key);
}

let registered = false;
/** Register the custom figure generators with GoJS (idempotent). */
export function registerShapeFigures(): void {
  if (registered) return;
  registered = true;
  for (const [name, d] of Object.entries(GEO)) {
    go.Shape.defineFigureGenerator(name, (_shape: go.Shape | null, w: number, h: number) => {
      const g = go.Geometry.parse('F ' + d, true);
      g.scale(w / 100, h / 100);
      return g;
    });
  }
}

/**
 * Inner SVG (path/rect/…) for a shape's palette thumbnail, drawn in a 0..100
 * viewBox. Matches the figure that will be placed on the canvas.
 */
export function shapePreviewInner(key: string | undefined): string {
  const def = shapeDef(key);
  if (!def) return '';
  if (GEO[def.figure]) return `<path d="${GEO[def.figure]}"/>`;
  return CORE_PREVIEW[def.figure] ?? '<rect x="6" y="26" width="88" height="48"/>';
}
