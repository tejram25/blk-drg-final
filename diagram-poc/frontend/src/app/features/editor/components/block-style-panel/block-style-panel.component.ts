import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../../core/services/i18n/translate.pipe';
import { Pin, PinSide, pinSide } from '../../../gojs-editor/gojs-pins';

/** A style property the panel can change, named for what it means, not for how
 *  it is stored — the editor decides which model field each one writes. */
export type StyleProp =
  'fill' | 'stroke' | 'borderWidth' | 'titleColor' | 'titlePlacement' | 'width' | 'height';

export interface StyleChange { prop: StyleProp; value: string | number; }
export interface PinSideChange { index: number; side: PinSide; }

/** What the panel needs to know about the selected block to draw its controls. */
export interface StyleSelection {
  text: string;
  color: string;
  isPart: boolean;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  labelColor?: string;
  titleColor?: string;
  textAlign?: string;
  dashPattern?: unknown;
  dashed?: boolean;
}

/**
 * How the selected block looks: its name, colours, outline, size and pins.
 *
 * Presentation only — it reports what the user asked for and the editor decides
 * what that means for the model. Grouping the colour and size controls behind
 * one `style` output rather than a dozen keeps that contract readable; the
 * genuinely distinct actions (renaming, the pins) stay separate because they
 * are separate intents, not one intent with a parameter.
 */
@Component({
  selector: 'app-block-style-panel',
  imports: [FormsModule, MatIconModule, MatTooltipModule, TranslatePipe],
  templateUrl: './block-style-panel.component.html',
  styleUrls: ['../panel-fields.css', './block-style-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockStylePanelComponent {
  @Input({ required: true }) sel!: StyleSelection;
  /** A shape or container, i.e. something whose fill and border are editable. */
  @Input() styled = false;
  /** A container styles its title rather than a label, and has no size fields. */
  @Input() container = false;
  /** The label is HTML, so its words are edited under Text and not here. */
  @Input() formatted = false;
  @Input() titlePlacement = '0 0';
  @Input() width: number | null = null;
  @Input() height: number | null = null;
  @Input() pins: Pin[] = [];

  @Output() rename = new EventEmitter<string>();
  @Output() colorChange = new EventEmitter<string>();
  @Output() style = new EventEmitter<StyleChange>();
  @Output() toggleDashed = new EventEmitter<void>();
  @Output() addPin = new EventEmitter<void>();
  @Output() removePin = new EventEmitter<number>();
  @Output() pinSide = new EventEmitter<PinSideChange>();

  /** Which edge a pin's spot puts it on, for its row's dropdown. */
  sideOf(spot: string): PinSide { return pinSide(spot); }
}
