import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '../../../../core/services/i18n/translate.pipe';
import { BoxSuggestion, LinkedComponent } from '../../../../core/services/box-suggestion.service';
import { Pin } from '../../../gojs-editor/gojs-pins';
import {
  BlockStylePanelComponent, PinAlongChange, PinSideChange, StyleChange, StyleSelection,
} from '../block-style-panel/block-style-panel.component';
import {
  BlockPartsPanelComponent, DataFieldChange, PartsSelection, RowChange,
} from '../block-parts-panel/block-parts-panel.component';
import {
  BlockTextPanelComponent, TextChange, TextSelection,
} from '../block-text-panel/block-text-panel.component';

export type { PinSideChange, PinAlongChange, StyleChange, DataFieldChange, RowChange, TextChange };

/** Everything the panel shows about the selected block. */
export type PanelSelection = StyleSelection & PartsSelection & TextSelection;

/**
 * The right-hand inspector for the selected block.
 *
 * Three panels under one shell, because a block has independent lives: how it
 * looks on the drawing, how its label reads, and what part it stands for. They
 * change for different reasons and often by different people, so they are
 * separate components rather than one long form; this shell is what gives them
 * a common frame, a heading and the delete button.
 *
 * It holds no state and never touches the diagram — it passes what it is given
 * down and passes intent back up.
 */
@Component({
  selector: 'app-properties-panel',
  imports: [MatIconModule, TranslatePipe, BlockStylePanelComponent, BlockTextPanelComponent, BlockPartsPanelComponent],
  templateUrl: './properties-panel.component.html',
  styleUrls: ['./properties-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesPanelComponent {
  @Input({ required: true }) sel!: PanelSelection;
  @Input() open = true;
  @Input() typeName = '';

  // ---- style side ----
  @Input() styled = false;
  @Input() container = false;
  @Input() titlePlacement = '0 0';
  @Input() titleSize: number | null = null;
  @Input() pad: number | null = null;
  @Input() corner: number | null = null;
  @Input() titleBg = '';
  @Input() titleBandBorder = '';
  @Input() titleBandWidth: number | null = null;
  @Input() badgeable = false;
  @Input() placeable = false;
  @Input() labelSpot = '0.5 0.5';
  @Input() badge = '';
  @Input() badgeFill = '#f5a623';
  @Input() badgeColor = '#ffffff';
  @Input() badgeSize: number | null = null;
  @Input() width: number | null = null;
  @Input() height: number | null = null;
  @Input() pins: Pin[] = [];

  // ---- text side ----
  /** Whether the block's label is one the Text tab can format at all. */
  @Input() textual = false;
  /** Whether it already is formatted, which moves its words out of Style. */
  @Input() formatted = false;

  // ---- parts side ----
  @Input() data: Record<string, string> = {};
  @Input() defaultCategory = '';
  @Input() box = false;
  @Input() attachedParts: any[] = [];
  @Input() boxComponents: LinkedComponent[] = [];
  @Input() boxSuggestions: BoxSuggestion[] = [];
  @Input() boxSuggestLoading = false;
  @Input() boxSuggestError = '';
  @Input() selectedSupplier: Record<string, string> = {};

  @Output() rename = new EventEmitter<string>();
  @Output() colorChange = new EventEmitter<string>();
  @Output() style = new EventEmitter<StyleChange>();
  @Output() toggleDashed = new EventEmitter<void>();
  @Output() addPin = new EventEmitter<void>();
  @Output() removePin = new EventEmitter<number>();
  @Output() pinSide = new EventEmitter<PinSideChange>();
  @Output() pinAlong = new EventEmitter<PinAlongChange>();
  @Output() text = new EventEmitter<TextChange>();
  @Output() editText = new EventEmitter<void>();

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

  @Output() remove = new EventEmitter<void>();
}
