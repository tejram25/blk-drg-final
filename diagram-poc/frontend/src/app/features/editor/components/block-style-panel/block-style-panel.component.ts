import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../../core/services/i18n/translate.pipe';
import { Pin, PinSide, pinAlong, pinSide } from '../../../gojs-editor/gojs-pins';

/** A style property the panel can change, named for what it means, not for how
 *  it is stored — the editor decides which model field each one writes. */
export type StyleProp =
  'fill' | 'stroke' | 'borderWidth' | 'titleColor' | 'titlePlacement' | 'width' | 'height'
  | 'titleX' | 'titleY' | 'titleSize' | 'pad' | 'corner' | 'noFill' | 'noBorder'
  | 'titleBg' | 'noTitleBg' | 'titleBandBorder' | 'titleBandWidth'
  | 'badge' | 'badgeFill' | 'badgeColor' | 'badgeSize' | 'labelSpot' | 'labelX' | 'labelY'
  | 'labelColor' | 'labelSize';

export interface StyleChange { prop: StyleProp; value: string | number | boolean; }
export interface PinSideChange { index: number; side: PinSide; }
export interface PinAlongChange { index: number; along: number; }

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
  /** Anything that can carry a status badge — a shape or a functional block. */
  @Input() badgeable = false;
  /** Anything whose name can be moved around inside it: the same set. A
   *  container places its title with the Title position control instead. */
  @Input() placeable = false;
  @Input() titlePlacement = '0 0';
  @Input() titleSize: number | null = null;
  @Input() pad: number | null = null;
  @Input() corner: number | null = null;
  /** The band behind a container's title, and the badge on a block. */
  @Input() titleBg = '';
  @Input() titleBandBorder = '';
  @Input() titleBandWidth: number | null = null;
  @Input() badge = '';
  @Input() badgeFill = '#f5a623';
  @Input() badgeColor = '#ffffff';
  @Input() badgeSize: number | null = null;
  /** Where the block's name sits inside it, as a spot, and as the two
   *  fractions the number boxes show — a dragged name is stored as an offset
   *  in pixels, so the editor works those out against the block's own size. */
  @Input() labelSpot = '0.5 0.5';
  @Input() labelX = 0.5;
  @Input() labelY = 0.5;
  /** The name's own colour and type size — the pair a container spells as
   *  Title colour and Title size. */
  @Input() labelColor = '#1f2937';
  @Input() labelSize: number | null = null;
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
  @Output() pinAlong = new EventEmitter<PinAlongChange>();

  /** Which edge a pin's spot puts it on, for its row's dropdown. */
  sideOf(spot: string): PinSide { return pinSide(spot); }
  /** How far along that edge it sits, as a percentage for its row's box. */
  alongOf(spot: string): number { return Math.round(pinAlong(spot) * 100); }

  /** The title spot as two numbers, so it can be nudged off the presets. */
  private part(i: 0 | 1): number {
    const n = Number(String(this.titlePlacement).trim().split(/\s+/)[i]);
    return isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }
  get titleX(): number { return this.part(0); }
  get titleY(): number { return this.part(1); }
  /** True when the spot is not one of the four offered, so the select says so. */
  get titleCustom(): boolean {
    return !['0 0', '0.5 0.06', '0.5 0.5', '0.5 0.94'].includes(String(this.titlePlacement));
  }

  /** The nine places a name can be put by name. Anything else — which is what
   *  dragging it on the canvas produces — reads as "dragged". */
  static readonly NAME_SPOTS = [
    '0 0', '0.5 0', '1 0', '0 0.5', '0.5 0.5', '1 0.5', '0 1', '0.5 1', '1 1',
  ];
  get labelCustom(): boolean {
    return !BlockStylePanelComponent.NAME_SPOTS.includes(String(this.labelSpot).trim());
  }
}
