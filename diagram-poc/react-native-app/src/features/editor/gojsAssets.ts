import * as go from 'gojs';
import { ELECTRICAL_SYMBOLS, SymbolDef } from './symbols';

/**
 * Web-only helpers that bridge the shared symbol/shape libraries into GoJS.
 * Electrical symbols become inline-SVG data URIs for a go.Picture (exact same
 * geometry as the mobile SVG renderer); basic shapes map to GoJS figures — core
 * ones where they exist, otherwise custom figure generators registered here.
 */

// Symbol stroke + muted text on the light canvas — exactly matching the Angular
// desktop editor (STROKE_ON_LIGHT / MUTED in its gojs-symbols.ts).
const STROKE = '#334155';
const MUTED = '#94a3b8';

function symbolInnerSvg(def: SymbolDef): string {
  const paths = def.paths
    .map(
      (p) =>
        `<path d="${p.d}" fill="${p.fill ? STROKE : 'none'}" stroke="${STROKE}" ` +
        `stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  const texts = (def.texts ?? [])
    .map(
      (t) =>
        `<text x="${t.x}" y="${t.y}" font-size="${t.size ?? 8}" ` +
        `font-weight="${t.bold ? '700' : '400'}" fill="${t.bold ? STROKE : MUTED}" ` +
        `text-anchor="${t.anchor ?? 'middle'}" font-family="Roboto, sans-serif">${escapeXml(t.text)}</text>`,
    )
    .join('');
  return paths + texts;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&]/g, (c) => (c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;'));
}

const uriCache: Record<string, string> = {};

/** SVG data URI for an electrical symbol, sized to its natural width/height. */
export function electricalSvgUri(shape: string): { uri: string; width: number; height: number } | null {
  const def = ELECTRICAL_SYMBOLS[shape];
  if (!def) return null;
  const pad = 3;
  if (!uriCache[shape]) {
    const w = def.width + pad * 2;
    const h = def.height + pad * 2;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${w} ${h}" width="${w}" height="${h}">` +
      symbolInnerSvg(def) +
      `</svg>`;
    uriCache[shape] = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }
  return { uri: uriCache[shape], width: def.width, height: def.height };
}

// Custom figure geometry authored in a 0..100 box (reused from the Angular app).
const GEO: Record<string, string> = {
  FcParallelogram: 'M20 8 L100 8 L80 92 L0 92 Z',
  FcTrapezoid: 'M22 8 L78 8 L100 92 L0 92 Z',
  FcPentagon: 'M50 4 L96 38 L78 96 L22 96 L4 38 Z',
  FcHexagon: 'M26 6 L74 6 L98 50 L74 94 L26 94 L2 50 Z',
  FcOctagon: 'M32 4 L68 4 L96 32 L96 68 L68 96 L32 96 L4 68 L4 32 Z',
  FcStar: 'M50 4 L61 37 L97 37 L68 59 L79 95 L50 73 L21 95 L32 59 L3 37 L39 37 Z',
  FcCylinder: 'M2 14 A48 12 0 0 1 98 14 L98 86 A48 12 0 0 1 2 86 Z M2 14 A48 12 0 0 0 98 14',
  FcCloud: 'M28 80 C8 80 6 54 24 50 C16 30 46 20 55 34 C62 18 90 24 84 45 C102 48 96 80 76 80 Z',
  FcChevron: 'M0 8 L66 8 L98 50 L66 92 L0 92 L32 50 Z',
  FcCallout: 'M8 6 L92 6 Q100 6 100 16 L100 60 Q100 70 92 70 L44 70 L28 94 L32 70 L8 70 Q0 70 0 60 L0 16 Q0 6 8 6 Z',
  FcDocument: 'M2 6 L98 6 L98 78 Q74 96 50 82 Q26 68 2 84 Z',
  FcCard: 'M22 6 L100 6 L100 94 L0 94 L0 24 Z',
  FcPredefined: 'M0 6 L100 6 L100 94 L0 94 Z M12 6 L12 94 M88 6 L88 94',
};

let registered = false;
/** Register the custom figure generators with GoJS (idempotent). */
export function registerFigures(): void {
  if (registered) return;
  registered = true;
  for (const [name, d] of Object.entries(GEO)) {
    go.Shape.defineFigureGenerator(name, (_s: go.Shape | null, w: number, h: number) => {
      const g = go.Geometry.parse('F ' + d, true);
      g.scale(w / 100, h / 100);
      return g;
    });
  }
}

/** basic-* shape → GoJS figure name (core or custom). */
export const SHAPE_FIGURE: Record<string, string> = {
  'basic-rectangle': 'Rectangle',
  'basic-rounded': 'RoundedRectangle',
  'basic-square': 'Rectangle',
  'basic-circle': 'Circle',
  'basic-ellipse': 'Ellipse',
  'basic-diamond': 'Diamond',
  'basic-triangle': 'Triangle',
  'basic-trapezoid': 'FcTrapezoid',
  'basic-parallelogram': 'FcParallelogram',
  'basic-hexagon': 'FcHexagon',
  'basic-pentagon': 'FcPentagon',
  'basic-star': 'FcStar',
  'basic-cylinder': 'FcCylinder',
  'basic-cloud': 'FcCloud',
  'basic-document': 'FcDocument',
  'basic-note': 'FcCard',
  'basic-callout': 'FcCallout',
  'basic-process': 'FcPredefined',
  'basic-step': 'FcChevron',
};

/** anim-* shape → GoJS figure + accent colour for a compact static glyph. */
export const ANIM_GLYPH: Record<string, { figure: string; color: string }> = {
  'anim-pulse': { figure: 'Circle', color: '#ef4444' },
  'anim-glow': { figure: 'Circle', color: '#f59e0b' },
  'anim-spin': { figure: 'FcOctagon', color: '#334155' },
  'anim-fan': { figure: 'FcStar', color: '#38bdf8' },
  'anim-signal': { figure: 'Triangle', color: '#22c55e' },
  'anim-charge': { figure: 'RoundedRectangle', color: '#22c55e' },
};
