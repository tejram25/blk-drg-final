/**
 * A formatted label is stored as an HTML string, which is what a .drawio file
 * carries, so one round-trips as data instead of being flattened on import.
 *
 * A GoJS TextBlock is plain text, so rendering means parsing that HTML and
 * drawing each run as its own TextBlock — which keeps the label on the canvas,
 * where it zooms, hit-tests and lands in an exported picture.
 *
 * Deliberately a small subset: bold, italic, underline, line breaks and bullet
 * lists. Anything else is kept verbatim in the data and shown as its text.
 */

/** A stretch of text sharing one set of marks. */
export interface RichRun { text: string; bold?: boolean; italic?: boolean; underline?: boolean; }

/** One rendered line: a bullet, or a paragraph. */
export interface RichLine { runs: RichRun[]; bullet?: boolean; }

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#160': ' ',
};

function decode(s: string): string {
  return s.replace(/&(#?\w+);/g, (m, e) => {
    const key = String(e).toLowerCase();
    if (ENTITIES[key] !== undefined) return ENTITIES[key];
    if (/^#\d+$/.test(e)) return String.fromCharCode(Number(e.slice(1)));
    return m;
  });
}

export function escapeHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** True when a label carries markup worth parsing rather than showing as-is. */
export function isRich(html: unknown): boolean {
  return typeof html === 'string' && /<(b|strong|i|em|u|br|div|p|li|ul|ol)\b/i.test(html);
}

/**
 * Parse an HTML label into lines. Hand-rolled over a fixed tag list rather than
 * DOMParser: it runs the same in a browser, the render harness and a node test,
 * and it can never put an untrusted string near the document.
 */
export function parseRichText(html: string): RichLine[] {
  const lines: RichLine[] = [];
  let runs: RichRun[] = [];
  let bullet = false;
  const marks = { bold: 0, italic: 0, underline: 0 };

  /** End a line. `force` emits an empty one, which is what a `<br>` means. */
  const flush = (force = false) => {
    const kept = runs.filter((r) => r.text.length);
    if (kept.some((r) => r.text.trim()) || bullet || force) {
      lines.push({ runs: kept.length ? kept : [{ text: '' }], ...(bullet ? { bullet: true } : {}) });
    }
    runs = []; bullet = false;
  };
  const push = (text: string) => {
    if (!text) return;
    runs.push({
      text,
      ...(marks.bold ? { bold: true } : {}),
      ...(marks.italic ? { italic: true } : {}),
      ...(marks.underline ? { underline: true } : {}),
    });
  };

  const token = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>|([^<]+)/g;
  let m: RegExpExecArray | null;
  let muted = 0;   // a label is no place to show the text of a <script>
  while ((m = token.exec(html)) !== null) {
    if (m[2] !== undefined) { if (!muted) push(decode(m[2]).replace(/\s+/g, ' ')); continue; }
    const tag = m[1].toLowerCase();
    const closing = m[0][1] === '/';
    if (tag === 'script' || tag === 'style') { muted = Math.max(0, muted + (closing ? -1 : 1)); continue; }
    if (muted) continue;
    switch (tag) {
      case 'b': case 'strong': marks.bold += closing ? -1 : 1; break;
      case 'i': case 'em': marks.italic += closing ? -1 : 1; break;
      case 'u': marks.underline += closing ? -1 : 1; break;
      case 'br': flush(true); break;
      case 'li': if (closing) flush(); else { flush(); bullet = true; } break;
      case 'div': case 'p': if (closing) flush(); else flush(); break;
      default: break;                       // ul/ol/font/span: structure we ignore
    }
    for (const k of Object.keys(marks) as (keyof typeof marks)[]) if (marks[k] < 0) marks[k] = 0;
  }
  flush();
  return lines;
}

/** Serialise lines back to HTML. */
export function richToHtml(lines: RichLine[]): string {
  const run = (r: RichRun) => {
    let t = escapeHtml(r.text);
    if (r.bold) t = `<b>${t}</b>`;
    if (r.italic) t = `<i>${t}</i>`;
    if (r.underline) t = `<u>${t}</u>`;
    return t;
  };
  const out: string[] = [];
  let inList = false;
  for (const l of lines) {
    // Judged on the text, not the markup: `<div><b></b></div>` parses to nothing.
    const body = l.runs.some((r) => r.text) ? l.runs.map(run).join('') : '';
    if (l.bullet && !inList) { out.push('<ul>'); inList = true; }
    if (!l.bullet && inList) { out.push('</ul>'); inList = false; }
    out.push(l.bullet ? `<li>${body}</li>` : `<div>${body || '<br>'}</div>`);
  }
  if (inList) out.push('</ul>');
  return out.join('');
}

/** The label as plain text, for search, tooltips and a non-rich fallback. */
export function richToPlain(html: string): string {
  return parseRichText(html)
    .map((l) => (l.bullet ? '• ' : '') + l.runs.map((r) => r.text).join(''))
    .join('\n')
    .trim();
}

/** Turn a plain multi-line label into the same structure, so one code path draws both. */
export function plainToLines(text: string): RichLine[] {
  return String(text ?? '').split('\n').map((t) => ({ runs: [{ text: t }] }));
}

/** The font a label falls back to when the data does not name one. */
export const DEFAULT_FONT = '600 12.5px Roboto, sans-serif';

/** A CSS font shorthand, taken apart so a control can edit one piece of it. */
export interface FontParts { italic: boolean; weight: string; size: number; family: string; }

/**
 * Split a CSS font shorthand into the pieces the Text tab edits. Style/weight
 * come off first, then the size; the family is whatever is left, since it is
 * the part that may hold spaces, quotes and commas. `oblique` reads as italic.
 */
export function parseFont(base: unknown): FontParts {
  const f = String(base || DEFAULT_FONT).trim();
  const m = /^((?:(?:normal|italic|oblique|bold|bolder|lighter|[1-9]00)\s+)*)(?:(\d+(?:\.\d+)?)px\s+)?(.*)$/.exec(f);
  const lead = (m?.[1] ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    italic: lead.some((t) => /^(italic|oblique)$/i.test(t)),
    weight: lead.find((t) => /^(bold|bolder|lighter|[1-9]00)$/i.test(t)) ?? '',
    size: m?.[2] ? Number(m[2]) : 12.5,
    family: (m?.[3] || '').trim() || 'Roboto, sans-serif',
  };
}

/** Put a font shorthand back together. */
export function formatFont(p: FontParts): string {
  return [p.italic ? 'italic' : '', p.weight, `${p.size}px`, p.family].filter(Boolean).join(' ');
}

/** Templates draw labels at 600, so that is the resting weight, not a bold one. */
export const NORMAL_WEIGHT = '600';
export const BOLD_WEIGHT = '700';

/** True when a weight reads as bold rather than as an ordinary label. */
export function isBoldWeight(weight: string): boolean {
  return /^(bold|bolder)$/i.test(weight) || Number(weight) >= 700;
}

/** The font one run is drawn in, from the label's base font plus its marks. */
export function runFont(base: string, r: RichRun): string {
  const p = parseFont(base);
  // Forced to 700, not left at the base: 600 would read the same as its bullets.
  return formatFont({ ...p, italic: p.italic || !!r.italic, weight: r.bold ? BOLD_WEIGHT : p.weight });
}

// ---- laying a formatted label out for the canvas ----

/** The marker drawn in front of a bullet, and the gap between it and the text. */
export const BULLET = '\u2022';
export const BULLET_GAP = 6;

/** One run as it will actually be drawn. `gap` is the space after it, used for
 *  the bullet marker — a TextBlock trims trailing whitespace, so it cannot be one. */
export interface DrawnRun { text: string; font: string; underline: boolean; gap?: number; }

/** One line of the drawn label: a row of runs, already wrapped to fit. */
export interface DrawnLine {
  runs: DrawnRun[];
  /** Left inset, so a bullet's wrapped remainder lines up under its first word. */
  indent: number;
  width: number;
  height: number;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** Width of a string, on the same 2D engine the canvas draws with. Outside a
 *  browser it estimates, which is enough for the tests that run there. */
export function measureText(text: string, font: string): number {
  if (measureCtx === undefined) {
    measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  if (!measureCtx) return text.length * parseFont(font).size * 0.55;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/** The font's own line box. Slightly taller than GoJS's, which is the safe way
 *  round: a block sized from it has slack rather than a label creeping out. */
export function fontLineHeight(font: string): number {
  measureText('Mg', font);                       // sets the context's font
  const m = measureCtx?.measureText('Mg') as TextMetrics | undefined;
  const h = (m?.fontBoundingBoxAscent ?? 0) + (m?.fontBoundingBoxDescent ?? 0);
  return h > 0 ? h : parseFont(font).size * 1.4;
}

/**
 * Wrap a formatted label into the lines and runs the canvas will draw.
 *
 * A TextBlock holds one font, so a line with bold in the middle is several of
 * them side by side — and GoJS cannot wrap what it cannot see as one line, so
 * the wrapping is done here. A word longer than the width overhangs rather than
 * breaking, which is what a part number wants.
 */
export function layoutRich(lines: RichLine[], base: string, maxWidth: number): DrawnLine[] {
  const out: DrawnLine[] = [];
  const plainFont = runFont(base, { text: '' });
  const height = Math.ceil(fontLineHeight(plainFont));
  const bulletWidth = measureText(BULLET, plainFont) + BULLET_GAP;

  /** Adjacent words in one font become one TextBlock. */
  const merge = (toks: { text: string; font: string; underline: boolean }[]): DrawnRun[] => {
    const runs: DrawnRun[] = [];
    for (const t of toks) {
      const last = runs[runs.length - 1];
      if (last && last.font === t.font && last.underline === t.underline) last.text += t.text;
      else runs.push({ text: t.text, font: t.font, underline: t.underline });
    }
    return runs;
  };

  for (const line of lines) {
    const limit = Math.max(20, maxWidth - (line.bullet ? bulletWidth : 0));
    const tokens: { text: string; font: string; underline: boolean; w: number }[] = [];
    for (const r of line.runs) {
      const font = runFont(base, r);
      for (const t of String(r.text).split(/(\s+)/)) {
        if (t) tokens.push({ text: t, font, underline: !!r.underline, w: measureText(t, font) });
      }
    }

    let cur: typeof tokens = [], curW = 0, first = true;
    const emit = () => {
      while (cur.length && !cur[cur.length - 1].text.trim()) { curW -= cur[cur.length - 1].w; cur.pop(); }
      const lead: DrawnRun[] = line.bullet && first
        ? [{ text: BULLET, font: plainFont, underline: false, gap: BULLET_GAP }] : [];
      out.push({
        runs: [...lead, ...merge(cur)],
        indent: line.bullet && !first ? bulletWidth : 0,
        width: curW + (line.bullet ? bulletWidth : 0),
        height,
      });
      cur = []; curW = 0; first = false;
    };

    if (!tokens.length) { emit(); continue; }        // a blank line still takes a line
    for (const t of tokens) {
      if (cur.length && curW + t.w > limit && t.text.trim()) emit();
      if (!cur.length && !t.text.trim()) continue;   // no leading space on a wrapped line
      cur.push(t); curW += t.w;
    }
    if (cur.length) emit();
  }
  return out;
}

/** How much room a laid-out label needs, so a block can be grown to hold it. */
export function richExtent(lines: DrawnLine[]): { width: number; height: number } {
  return {
    width: Math.ceil(lines.reduce((w, l) => Math.max(w, l.width), 0)),
    height: Math.ceil(lines.reduce((h, l) => h + l.height, 0)),
  };
}
