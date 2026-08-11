/**
 * Rich labels, stored the way draw.io stores them.
 *
 * draw.io's "Formatted Text" checkbox is mxGraph's `html=1` flag: the label
 * stops being plain text and becomes an HTML string. We keep that same
 * representation so a `.drawio` label round-trips as data rather than being
 * flattened on the way in — our importer used to strip every tag, which turned
 * a heading and five bullets into one squashed line.
 *
 * GoJS cannot render HTML in a node (a TextBlock is plain text; its only HTML
 * hook is the editor used while typing), so rendering is done by parsing the
 * HTML into lines and drawing each as its own TextBlock. That keeps the label
 * part of the canvas — it zooms, hit-tests and appears in an exported picture,
 * none of which is true of an HTML element floated over the diagram.
 *
 * Deliberately a small subset: bold, italic, underline, line breaks and bullet
 * lists, which is what a block diagram's labels actually use. Anything else is
 * kept verbatim in the data and shown as its text, so nothing is destroyed by a
 * round trip through the editor.
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
 * Parse a draw.io/mxGraph HTML label into lines.
 *
 * Hand-rolled over a fixed tag list rather than DOMParser: it runs the same in
 * a browser, in the render harness and in a plain node test, and it can never
 * put an attacker-supplied string anywhere near the document.
 */
export function parseRichText(html: string): RichLine[] {
  const lines: RichLine[] = [];
  let runs: RichRun[] = [];
  let bullet = false;
  const marks = { bold: 0, italic: 0, underline: 0 };

  /**
   * End a line. `force` emits it even when it is empty, which is what a `<br>`
   * means — a blank line someone put there on purpose. Without it, whitespace
   * between two pretty-printed `<div>`s would read as a line of its own while a
   * deliberately empty one would vanish, which is exactly backwards.
   */
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
  // Nothing here reaches the DOM, so nothing can execute — but a label is no
  // place to show the text of a <script> either.
  let muted = 0;
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

/** Serialise lines back to the HTML draw.io would have written. */
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
    // Emptiness is judged on the text, not the markup: a line the user cleared
    // may still carry its marks, and `<div><b></b></div>` would parse back as
    // nothing at all, so the line would disappear as they typed.
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
 * Split a CSS font shorthand into the pieces the Text tab edits.
 *
 * The leading style/weight words come off first, then the size, leaving the
 * family — which is the one part that may legitimately contain spaces, quotes
 * and commas (`"Arrow Display", Roboto, sans-serif`), so it is whatever is left
 * rather than something matched.
 *
 * `oblique` is reported as italic. It is a distinction almost no font actually
 * draws differently, and collapsing it is what lets the tab offer one toggle.
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

/**
 * The weight a label carries when it is not bold.
 *
 * Every template draws its label at 600 — that is what an ordinary block label
 * looks like here, not a bold one. So 600 is the resting weight and the bold
 * threshold sits above it; otherwise the Text tab's B button would be pressed
 * on every block the moment it was selected.
 */
export const NORMAL_WEIGHT = '600';
export const BOLD_WEIGHT = '700';

/** True when a weight reads as bold rather than as an ordinary label. */
export function isBoldWeight(weight: string): boolean {
  return /^(bold|bolder)$/i.test(weight) || Number(weight) >= 700;
}

/**
 * A CSS font string for one line, from the node's base font.
 *
 * Marks are applied per line rather than per run: a GoJS TextBlock has one font,
 * and wrapping a mixed-format line across several TextBlocks would break word
 * wrap. A line that is entirely bold — a heading — is the case that matters in a
 * block diagram, and it is handled exactly. A line with bold in the middle of it
 * renders in the line's dominant marks; the original HTML is kept either way.
 */
export function lineFont(base: string, line: RichLine): string {
  const total = line.runs.reduce((n, r) => n + r.text.length, 0) || 1;
  const share = (k: 'bold' | 'italic') =>
    line.runs.reduce((n, r) => n + (r[k] ? r.text.length : 0), 0) / total;
  const p = parseFont(base);
  // A bold line is forced to 700 rather than left at the base weight: the shape
  // template's base is 600, which already reads as "bold" to a naive test — that
  // is why a heading came out identical to the bullets under it.
  return formatFont({
    ...p,
    italic: p.italic || share('italic') > 0.5,
    weight: share('bold') > 0.5 ? '700' : p.weight,
  });
}

/** True when the whole line is underlined, which a TextBlock can draw. */
export function lineUnderlined(line: RichLine): boolean {
  return line.runs.length > 0 && line.runs.every((r) => !r.text.trim() || r.underline);
}
