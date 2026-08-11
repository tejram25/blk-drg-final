import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../../core/services/i18n/translate.pipe';
import { BoxSuggestion, LinkedComponent } from '../../../../core/services/box-suggestion.service';
import { PartRow, money, partDetails, partSpecs } from './part-format';

/** A field of the block's own data — part number, category, free-text notes. */
export interface DataFieldChange { key: string; value: string; }
/** A change to one row of a list: which row, and its new value. */
export interface RowChange { index: number; value: number | string; }

/** What the panel needs about the selected block to show its commercial side. */
export interface PartsSelection {
  isPart: boolean;
  quantity?: number;
  details: PartRow[];
  specs: PartRow[];
}

/**
 * What the selected block *is*: its part number, catalogue entry, the parts
 * attached to it, and the components suggested for it.
 *
 * The counterpart to the style panel — that one is how a block looks, this one
 * is what it stands for. Split because they change for different reasons and by
 * different people: the drawing's appearance is settled once, while the parts
 * behind it churn through a design.
 *
 * Presentation only. Every catalogue lookup, AI call and model write stays in
 * the editor; this reports what was asked for.
 */
@Component({
  selector: 'app-block-parts-panel',
  imports: [FormsModule, MatIconModule, MatTooltipModule, TranslatePipe],
  templateUrl: './block-parts-panel.component.html',
  styleUrls: ['../panel-fields.css', './block-parts-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockPartsPanelComponent {
  @Input({ required: true }) sel!: PartsSelection;
  /** The block's own data fields, keyed as the model stores them. */
  @Input() data: Record<string, string> = {};
  /** The category to show when the block has not been given one. */
  @Input() defaultCategory = '';
  /** A block that can carry parts and components, as opposed to a wire label. */
  @Input() box = false;
  @Input() attachedParts: any[] = [];
  @Input() boxComponents: LinkedComponent[] = [];
  @Input() boxSuggestions: BoxSuggestion[] = [];
  @Input() boxSuggestLoading = false;
  @Input() boxSuggestError = '';
  /** Which supplier each suggestion is showing, keyed by part number. */
  @Input() selectedSupplier: Record<string, string> = {};

  @Output() dataChange = new EventEmitter<DataFieldChange>();
  @Output() quantity = new EventEmitter<number>();
  @Output() checkLifecycle = new EventEmitter<void>();
  @Output() checkPos = new EventEmitter<void>();
  @Output() attachedQty = new EventEmitter<RowChange>();
  @Output() removeAttached = new EventEmitter<number>();
  @Output() componentQty = new EventEmitter<RowChange>();
  @Output() componentSupplier = new EventEmitter<RowChange>();
  @Output() removeComponent = new EventEmitter<number>();
  @Output() suggest = new EventEmitter<void>();
  @Output() link = new EventEmitter<BoxSuggestion>();

  readonly partDetails = partDetails;
  readonly partSpecs = partSpecs;
  readonly money = money;
}
