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

  const flush = () => {
    const kept = runs.filter((r) => r.text.length);
    if (kept.length || bullet) lines.push({ runs: kept.length ? kept : [{ text: '' }], ...(bullet ? { bullet: true } : {}) });
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
      case 'br': flush(); break;
      case 'li': if (closing) flush(); else { flush(); bullet = true; } break;
      case 'div': case 'p': if (closing) flush(); else flush(); break;
      default: break;                       // ul/ol/font/span: structure we ignore
    }
    for (const k of Object.keys(marks) as (keyof typeof marks)[]) if (marks[k] < 0) marks[k] = 0;
  }
  flush();
  // trailing blank lines from a closing </div> say nothing
  while (lines.length && !lines[lines.length - 1].bullet && !lines[lines.length - 1].runs.some((r) => r.text.trim())) lines.pop();
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
    const body = l.runs.map(run).join('');
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
  const f = String(base || '600 12.5px Roboto, sans-serif').trim();
  // Split the leading style/weight words off the size-and-family remainder, so a
  // bold line can be made genuinely heavier. The shape template's base is 600,
  // which already reads as "bold" to a naive test — that is why a heading came
  // out identical to the bullets under it.
  const m = /^((?:(?:normal|italic|oblique|bold|bolder|lighter|[1-9]00)\s+)*)(.*)$/.exec(f);
  const lead = (m?.[1] ?? '').trim().split(/\s+/).filter(Boolean);
  const rest = m?.[2] || f;
  const weight = lead.find((t) => /^(bold|bolder|lighter|[1-9]00)$/i.test(t));
  const slant = share('italic') > 0.5 ? 'italic' : lead.find((t) => /^(italic|oblique)$/i.test(t));
  const out = [slant, share('bold') > 0.5 ? '700' : weight, rest].filter(Boolean);
  return out.join(' ');
}

/** True when the whole line is underlined, which a TextBlock can draw. */
export function lineUnderlined(line: RichLine): boolean {
  return line.runs.length > 0 && line.runs.every((r) => !r.text.trim() || r.underline);
}
