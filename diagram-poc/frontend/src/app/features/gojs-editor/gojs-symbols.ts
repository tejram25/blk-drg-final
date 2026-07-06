/**
 * Bridges the existing shape libraries (electrical schematic symbols, animated
 * components, basic flowchart shapes) into GoJS. Each symbol is rendered as an
 * inline SVG data-URI that a go.Picture displays, plus a list of connection
 * pins (as fractional Spots) that become linkable ports. This reuses the exact
 * path / pin geometry from the X6 shape files so symbols look identical.
 *
 * Note: animated symbols render statically here (CSS @keyframes don't run inside
 * an <img>). Live animation is a later-phase enhancement.
 */
import { ELECTRICAL_SYMBOLS, SymbolDef } from '../editor/electrical-shapes';
import { ANIM_FRAME_COUNT, ANIMATED_SYMBOLS, partsToSvg, partsToSvgFrame } from '../editor/animated-shapes';
import { BASIC_SHAPES, BasicShapeDef } from '../editor/basic-shapes';

/** Stroke colours per canvas theme. Light stroke reads on the dark canvas;
 * dark stroke reads on the white canvas. */
const STROKE_ON_DARK = '#e2e8f0';
const STROKE_ON_LIGHT = '#334155';
const MUTED = '#94a3b8';

export interface SymbolInfo {
  /** SVG data-URI to feed a go.Picture `source`. */
  source: string;
  /** Natural width of the symbol drawing. */
  width: number;
  /** Natural height of the symbol drawing. */
  height: number;
  /** Connection pins as {x,y} fractions of the drawing (0..1). */
  pins: { fx: number; fy: number }[];
  /** True for basic flowchart shapes (get a centered editable label + 4 side ports). */
  basic: boolean;
}

/**
 * Padding around the drawing so strokes on the geometry boundary (stroke-width 2
 * + round caps) aren't clipped by the viewBox — without it, shapes lose their
 * right/bottom edges and wire-end caps get cut off.
 */
const PAD = 3;

function encodeSvg(inner: string, w: number, h: number): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-PAD} ${-PAD} ${w + PAD * 2} ${h + PAD * 2}" ` +
    `width="${w + PAD * 2}" height="${h + PAD * 2}">${inner}</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/** Build the inner SVG for an electrical schematic symbol. */
function electricalInner(def: SymbolDef, dark: boolean): string {
  const s = dark ? STROKE_ON_DARK : STROKE_ON_LIGHT;
  const paths = def.paths
    .map(
      (p) =>
        `<path d="${p.d}" fill="${p.fill ? s : 'none'}" stroke="${s}" ` +
        `stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  const texts = (def.texts ?? [])
    .map(
      (t) =>
        `<text x="${t.x}" y="${t.y}" font-size="${t.size ?? 8}" ` +
        `font-weight="${t.bold ? 700 : 400}" fill="${t.bold ? s : MUTED}" ` +
        `text-anchor="${t.anchor ?? 'middle'}" font-family="Roboto, sans-serif">${t.text}</text>`,
    )
    .join('');
  return paths + texts;
}

/** Build the inner SVG for a basic flowchart shape body (no label — GoJS adds it). */
function basicInner(def: BasicShapeDef, dark: boolean): string {
  const w = def.width;
  const h = def.height;
  // Outline on the dark canvas (transparent fill); white-filled on the light canvas.
  const fill = def.noBox ? 'none' : (dark ? 'none' : '#ffffff');
  const stroke = def.noBox ? 'none' : (dark ? STROKE_ON_DARK : STROKE_ON_LIGHT);
  const sw = def.noBox ? 0 : 2;
  const common = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}"`;
  if (def.tag === 'rect') {
    const rx = def.body['rx'] ?? 0;
    return `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" ry="${rx}" ${common}/>`;
  }
  if (def.tag === 'ellipse') {
    return `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" ${common}/>`;
  }
  // path: refD coordinates are already in the shape's own W×H space
  return `<path d="${def.body['refD']}" ${common} stroke-linejoin="round"/>`;
}

/**
 * Resolve a palette shape name to its GoJS symbol rendering, or null if it's not
 * a symbol. `dark` = rendering on the dark canvas (light strokes); pass false for
 * the white canvas so the symbols get dark strokes and stay legible.
 */
export function symbolInfo(shape: string | undefined, dark = true): SymbolInfo | null {
  if (!shape) return null;

  // Padded dimensions/pin fractions so the drawing (incl. boundary strokes)
  // fits fully inside the picture. Pins shift by PAD in the padded space.
  const dims = (w: number, h: number) => ({ width: w + PAD * 2, height: h + PAD * 2 });
  const pinsOf = (pins: { x: number; y: number }[], w: number, h: number) =>
    pins.map((p) => ({ fx: (p.x + PAD) / (w + PAD * 2), fy: (p.y + PAD) / (h + PAD * 2) }));

  const elec = ELECTRICAL_SYMBOLS[shape];
  if (elec) {
    return {
      source: encodeSvg(electricalInner(elec, dark), elec.width, elec.height),
      ...dims(elec.width, elec.height),
      pins: pinsOf(elec.pins, elec.width, elec.height),
      basic: false,
    };
  }

  const anim = ANIMATED_SYMBOLS[shape];
  if (anim) {
    // Animated components use their own baked mid-tone palette (readable on both).
    return {
      source: encodeSvg(partsToSvg(shape), anim.width, anim.height),
      ...dims(anim.width, anim.height),
      pins: pinsOf(anim.pins, anim.width, anim.height),
      basic: false,
    };
  }

  const basic = BASIC_SHAPES[shape];
  if (basic) {
    return {
      source: encodeSvg(basicInner(basic, dark), basic.width, basic.height),
      ...dims(basic.width, basic.height),
      // basic shapes get four side ports (top/right/bottom/left)
      pins: [
        { fx: 0.5, fy: 0 },
        { fx: 1, fy: 0.5 },
        { fx: 0.5, fy: 1 },
        { fx: 0, fy: 0.5 },
      ],
      basic: true,
    };
  }

  return null;
}

/**
 * Pre-rendered animation loop for an animated symbol: one SVG data-URI per
 * frame, sized exactly like the static `symbolInfo` source so the editor can
 * flip a Picture's `source` through them (GoJS caches each URI after first
 * paint, so a loop costs one decode per frame, once).
 */
export function animFrameSources(shape: string): string[] {
  const def = ANIMATED_SYMBOLS[shape];
  if (!def) return [];
  return Array.from({ length: ANIM_FRAME_COUNT }, (_, i) =>
    encodeSvg(partsToSvgFrame(shape, i / ANIM_FRAME_COUNT), def.width, def.height));
}

/** Small SVG preview string (for palette rendering) for any shape, or ''. */
export function shapePreviewSvg(shape: string | undefined): string {
  if (!shape) return '';
  const info = symbolInfo(shape);
  return info ? info.source : '';
}
