import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, NgZone,
  OnDestroy, Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DEFAULT_FONT, isBoldWeight, isRich, parseFont } from '../../../gojs-editor/rich-text';
import { richEditing } from '../../../gojs-editor/gojs-rich-editor';

/** A text property the tab can change, named for what it means to a reader. */
export type TextProp =
  'fontFamily' | 'labelSize' | 'bold' | 'italic' | 'underline'
  | 'textAlign' | 'labelColor' | 'textWidth' | 'formatted';

export interface TextChange { prop: TextProp; value: string | number | boolean; }

/** A mark that can cover part of a label. */
type Mark = 'bold' | 'italic' | 'underline';

/** What the tab needs to know about the selected block's label. */
export interface TextSelection {
  text: string;
  /** The label as draw.io stores a formatted one; absent for a plain label. */
  html?: string;
  font?: string;
  labelColor?: string;
  textAlign?: string;
  textWidth?: number;
  underline?: boolean;
}

/** Families offered by name, so a label can be given a face without typing CSS. */
const FAMILIES: { label: string; value: string }[] = [
  { label: 'Default', value: '"Arrow Display", Roboto, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

const COMMAND: Record<Mark, string> = { bold: 'bold', italic: 'italic', underline: 'underline' };

/**
 * draw.io's Text tab: how the selected block's label reads.
 *
 * Family, size, alignment, colour and wrap width belong to the whole label, the
 * way they do on a draw.io cell. **B**, **I** and **U** are the ones that change
 * meaning: on a plain label they set the whole thing, and on a formatted one
 * they apply to whatever is selected in the editor below — which is what
 * "Formatted text" (mxGraph's `html=1`) buys you.
 *
 * The words themselves are edited on the block, not in here: double-click and a
 * `contenteditable` opens over the shape. That is where draw.io puts its editor
 * too, and its Format panel makes the same branch this one does —
 * `graph.cellEditor.isContentEditing()` there, `richEditing.active` here:
 *
 *     if (fn != null && graph.cellEditor.isContentEditing()) { fn(); }
 *     else { graph.stopEditing(false); graph.toggleCellStyleFlags(...); }
 *
 * Presentation only: it reports what the user asked for and the editor decides
 * what that means for the model.
 */
@Component({
  selector: 'app-block-text-panel',
  imports: [FormsModule, MatIconModule, MatTooltipModule],
  templateUrl: './block-text-panel.component.html',
  styleUrls: ['../panel-fields.css', './block-text-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockTextPanelComponent implements OnDestroy {
  @Input({ required: true }) sel!: TextSelection;

  @Output() text = new EventEmitter<TextChange>();
  /** Open the label for editing on the block, for people who do not guess that
   *  double-clicking it does the same thing. */
  @Output() editText = new EventEmitter<void>();

  readonly families = FAMILIES;

  private readonly stopWatching: () => void;

  constructor(private cdr: ChangeDetectorRef, private zone: NgZone) {
    // Two things change what B/I/U should say without Angular hearing about it:
    // the in-place editor opening or closing, and the caret moving inside it.
    // draw.io redraws the same buttons off `input`, `mouseup` and `keyup` on its
    // cell editor; `selectionchange` covers all of that and the caret keys too.
    this.stopWatching = richEditing.subscribe(() => this.refresh());
    this.zone.runOutsideAngular(() => document.addEventListener('selectionchange', this.onSelectionChange));
  }

  ngOnDestroy(): void {
    this.stopWatching();
    document.removeEventListener('selectionchange', this.onSelectionChange);
  }

  private readonly onSelectionChange = () => { if (richEditing.active) this.refresh(); };

  /** detectChanges, not markForCheck: this runs outside Angular, where marking
   *  alone would sit there until something else happened to tick. */
  private refresh(): void { try { this.cdr.detectChanges(); } catch { /* torn down */ } }

  // ---- whole-label state, read back out of the font shorthand ----

  private get font() { return parseFont(this.sel?.font || DEFAULT_FONT); }

  /** The dropdown's value: the family we recognise, or a bare "Custom" entry. */
  get family(): string {
    const f = this.font.family;
    return this.families.some((o) => o.value === f) ? f : '';
  }
  get size(): number { return this.font.size; }
  get align(): string { return this.sel?.textAlign || 'center'; }
  get wrapWidth(): number { return typeof this.sel?.textWidth === 'number' ? this.sel.textWidth : 150; }

  /** True once the label is HTML rather than a plain string. */
  get formatted(): boolean { return isRich(this.sel?.html); }

  /** draw.io's `isContentEditing()`: the label is open on the block, and it is
   *  a formatted one, so the marks below act on the selection inside it. */
  get contentEditing(): boolean { return richEditing.active; }

  set(prop: TextProp, value: string | number | boolean): void { this.text.emit({ prop, value }); }

  // ---- marks: the selection being edited, or the whole label ----

  markOn(mark: Mark): boolean {
    if (this.contentEditing) {
      try { return document.queryCommandState(COMMAND[mark]); } catch { /* not editing after all */ }
    }
    if (mark === 'underline') return this.sel?.underline === true;
    return mark === 'bold' ? isBoldWeight(this.font.weight) : this.font.italic;
  }

  toggleMark(mark: Mark): void {
    if (this.contentEditing) {
      // Tag-based markup, not inline styles: `<b>` is what draw.io writes and
      // what our parser reads, whereas `style="font-weight:bold"` would be
      // dropped on the way back in.
      try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* older engine */ }
      document.execCommand(COMMAND[mark]);
      this.refresh();
      return;
    }
    this.set(mark, !this.markOn(mark));
  }

  /**
   * Turn the line the caret is on into a bullet, or back out of one.
   *
   * Ours, not draw.io's — draw.io has no list button, only a block-style menu,
   * and a bulleted list there comes from typing or pasting one. A block diagram
   * is mostly bulleted notes, so the button earns its place.
   */
  toggleBullet(): void {
    if (!this.contentEditing) return;
    document.execCommand('insertUnorderedList');
    this.refresh();
  }

  get bulletOn(): boolean {
    if (!this.contentEditing) return false;
    try { return document.queryCommandState('insertUnorderedList'); } catch { return false; }
  }

  /** Keep the caret where it is when a toolbar button is pressed. */
  keepSelection(e: Event): void { e.preventDefault(); }
}
