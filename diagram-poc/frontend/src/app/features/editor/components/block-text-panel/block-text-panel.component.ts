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
  /** Set only on a formatted label. */
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
 * The Text tab. Family, size, alignment, colour and wrap width belong to the
 * whole label; B/I/U apply to the selection when the label is open for editing
 * on the block, and to the whole label otherwise. The words themselves are
 * typed on the block, not here.
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
  /** Same as double-clicking the block, for anyone who does not guess that. */
  @Output() editText = new EventEmitter<void>();

  readonly families = FAMILIES;

  private readonly stopWatching: () => void;

  constructor(private cdr: ChangeDetectorRef, private zone: NgZone) {
    // B/I/U track the selection, and neither the editor opening nor the caret
    // moving is an Angular event.
    this.stopWatching = richEditing.subscribe(() => this.refresh());
    this.zone.runOutsideAngular(() => document.addEventListener('selectionchange', this.onSelectionChange));
  }

  ngOnDestroy(): void {
    this.stopWatching();
    document.removeEventListener('selectionchange', this.onSelectionChange);
  }

  private readonly onSelectionChange = () => { if (richEditing.active) this.refresh(); };

  /** detectChanges, not markForCheck: this runs outside Angular. */
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

  /** The label is open for editing on the block, so marks act on the selection. */
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
      // Tags, not inline styles: our parser reads <b>, not font-weight.
      try { document.execCommand('styleWithCSS', false, 'false'); } catch { /* older engine */ }
      document.execCommand(COMMAND[mark]);
      this.refresh();
      return;
    }
    this.set(mark, !this.markOn(mark));
  }

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
