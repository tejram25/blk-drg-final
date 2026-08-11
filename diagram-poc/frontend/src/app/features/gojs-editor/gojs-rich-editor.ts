import * as go from 'gojs';
import { DEFAULT_FONT, isRich, parseFont, parseRichText, richToHtml, richToPlain } from './rich-text';

/**
 * In-place editing of a formatted label, the way draw.io does it.
 *
 * mxGraph's `mxCellEditor` is a `contenteditable` div laid over the cell on the
 * canvas — you double-click a shape and type on the shape, and the Format
 * panel's B/I/U act on whatever you have selected there. That split is
 * `mxCellEditor.isContentEditing()`, which is true when the cell being edited
 * carries `html=1`:
 *
 *     mxCellEditor.prototype.isContentEditing = function() {
 *       var state = this.graph.view.getState(this.editingCell);
 *       return state != null && state.style['html'] == 1;
 *     };
 *
 * and draw.io's bold action reads:
 *
 *     if (fn != null && graph.cellEditor.isContentEditing()) { fn(); }   // execCommand('bold')
 *     else { graph.stopEditing(false); graph.toggleCellStyleFlags(STYLE_FONTSTYLE, FONT_BOLD, cells); }
 *
 * This is the same arrangement for GoJS: the overlay below is our cell editor,
 * `active` is our `isContentEditing()`, and the Text tab branches on it.
 *
 * A plain label is left to GoJS's own text editor, which is right — that is
 * exactly the case draw.io sends down its non-content-editing branch too.
 */

/** Static styling for the overlay, injected once. */
const STYLE_ID = 'gojs-rich-editor-style';
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
.gojs-rich-editor { box-sizing: border-box; outline: 2px solid #f5a623; outline-offset: 1px;
  background: #ffffff; overflow: visible; cursor: text; z-index: 20;
  /* Stated, not inherited: a browser reports a semibold selection as bold, so
     an inherited heavy face would light the B button on text that is not bold. */
  font-weight: 400; }
.gojs-rich-editor ul, .gojs-rich-editor ol { margin: 0; padding-left: 1.2em; }
.gojs-rich-editor li { margin: 0; }
.gojs-rich-editor b, .gojs-rich-editor strong { font-weight: 700; }`;
  document.head.appendChild(s);
}

class RichInPlaceEditor {
  private div: HTMLDivElement | null = null;
  private node: go.Node | null = null;
  private diagram: go.Diagram | null = null;
  private listeners = new Set<() => void>();

  /** draw.io's `isContentEditing()`: a formatted label is open for editing. */
  get active(): boolean { return this.div !== null; }
  get element(): HTMLElement | null { return this.div; }

  /** Whether double-clicking this node should open the rich editor at all. */
  canEdit(node: go.Node | null | undefined): boolean {
    return !!node && isRich(node.data?.html);
  }

  /** Told when editing starts or stops, so the Text tab can redraw its buttons. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private announce(): void { this.listeners.forEach((f) => f()); }

  start(node: go.Node): void {
    if (this.div) this.finish(true);
    const diagram = node.diagram;
    const host = diagram?.div;
    if (!diagram || !host || !isRich(node.data?.html)) return;
    ensureStyle();
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

    const div = document.createElement('div');
    div.className = 'gojs-rich-editor';
    div.contentEditable = 'true';
    div.spellcheck = false;
    // Through the parser on the way in: whatever the label carries, only the
    // tags we draw ever reach the document.
    div.innerHTML = richToHtml(parseRichText(String(node.data.html ?? '')));

    this.div = div; this.node = node; this.diagram = diagram;
    this.place();
    host.appendChild(div);

    div.addEventListener('blur', this.onBlur);
    div.addEventListener('keydown', this.onKeyDown);
    diagram.addDiagramListener('ViewportBoundsChanged', this.onViewport);

    div.focus();
    // Selected on opening, as mxCellEditor does: a double-click on a label
    // usually means "replace this", and the caret is one keystroke away.
    const range = document.createRange();
    range.selectNodeContents(div);
    const sel = getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    this.announce();
  }

  /** Keep what was typed. */
  commit(): void { this.finish(true); }
  /** Throw it away — Escape, as in draw.io. */
  cancel(): void { this.finish(false); }

  private readonly onBlur = () => this.finish(true);

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); this.finish(false); }
    // Enter makes a new line in a formatted label; Ctrl/Cmd+Enter is done.
    else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.finish(true); }
  };

  private readonly onViewport = () => this.place();

  /** Lay the overlay over the block's outline, at the diagram's current scale. */
  private place(): void {
    const div = this.div, node = this.node, diagram = this.diagram;
    if (!div || !node || !diagram) return;
    const shape = node.findObject('SHAPE') ?? node;
    const b = shape.getDocumentBounds();
    const tl = diagram.transformDocToView(new go.Point(b.x, b.y));
    const scale = diagram.scale;
    const font = parseFont(node.data?.font || DEFAULT_FONT);
    Object.assign(div.style, {
      position: 'absolute',
      left: `${tl.x}px`,
      top: `${tl.y}px`,
      width: `${b.width * scale}px`,
      minHeight: `${b.height * scale}px`,
      padding: `${6 * scale}px`,
      fontSize: `${font.size * scale}px`,
      fontFamily: font.family,
      fontStyle: font.italic ? 'italic' : 'normal',
      lineHeight: '1.35',
      color: String(node.data?.labelColor || '#1f2937'),
      textAlign: String(node.data?.textAlign || 'center'),
    } as CSSStyleDeclaration);
  }

  private finish(save: boolean): void {
    const div = this.div, node = this.node, diagram = this.diagram;
    // Cleared first: removing the element fires blur, which would come straight
    // back in here and commit a second time.
    this.div = null; this.node = null; this.diagram = null;
    if (!div) return;
    div.removeEventListener('blur', this.onBlur);
    div.removeEventListener('keydown', this.onKeyDown);
    diagram?.removeDiagramListener('ViewportBoundsChanged', this.onViewport);
    const html = richToHtml(parseRichText(div.innerHTML));
    div.remove();

    if (save && node && diagram && !diagram.isReadOnly) {
      // An emptied label is still a formatted one, just empty; writing nothing
      // would read as "not formatted" and the block would change kind on the
      // user without being asked.
      const next = html || '<div><br></div>';
      if (next !== node.data.html) {
        diagram.model.commit((m) => {
          m.set(node.data, 'html', next);
          // `text` stays the plain reading, for the BOM, search and tooltips.
          m.set(node.data, 'text', richToPlain(next));
        }, 'edit label');
      }
    }
    this.announce();
  }
}

/** One editor for the app, the way a graph has one cell editor. */
export const richEditing = new RichInPlaceEditor();
