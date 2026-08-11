import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../../core/services/i18n/translate.pipe';

/** One property to set on a wire, as the dock reports it upward. */
export interface WireProp { prop: string; value: unknown; }

/** Everything the dock remembers between wires. */
export interface WireStyle {
  color: string;
  width: number;
  style: 'flow' | 'dashed' | 'solid';
  routing: 'manhattan' | 'normal' | 'smooth';
  arrow: 'Standard' | 'Triangle' | 'none';
  arrowScale: number;
  corner: 'round' | 'square';
  /** An arrowhead at both ends: the connection goes both ways. */
  twoWay: boolean;
  /** How a net name on the wire is drawn. */
  labelColor: string;
  labelSize: number;
  labelBg: string;
}

/** What a wire looks like before anyone has touched the dock. */
export const DEFAULT_WIRE_STYLE: WireStyle = {
  color: '#22d3ee', width: 2, style: 'flow', routing: 'manhattan',
  arrow: 'Standard', arrowScale: 1, corner: 'round', twoWay: false,
  labelColor: '#e2e8f0', labelSize: 10, labelBg: 'rgba(14,15,17,0.75)',
};

/**
 * The wire style dock: colour, line style, width, routing, corners, arrowhead
 * and the net name's own type.
 *
 * It owns the whole wire-style concern, including the part that is easy to get
 * wrong — the difference between *what the selected wire looks like* and *what
 * the next wire should look like*. The controls show the former; `defaults`
 * holds the latter and is only written when a control is actually changed. Read
 * the defaults off the controls instead and clicking an older wire silently
 * resets them, which is what used to make a style change have to be repeated
 * for every single wire.
 *
 * It does not touch the diagram. Each change is emitted as a property to set,
 * and the editor applies it to whichever wire is selected.
 */
@Component({
  selector: 'app-wire-dock',
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, TranslatePipe],
  templateUrl: './wire-dock.component.html',
  styleUrls: ['./wire-dock.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WireDockComponent {
  /** True when a wire is selected, so the controls edit that wire. */
  @Input() selected = false;
  /** The selected wire's net/signal name. */
  @Input() label = '';
  /** On a narrow screen the dock only appears once a wire is selected. */
  @Input() compact = false;

  @Output() apply = new EventEmitter<WireProp>();
  @Output() labelChange = new EventEmitter<string>();
  @Output() remove = new EventEmitter<void>();

  readonly wireColors = ['#22d3ee', '#22c55e', '#f5a623', '#ef4444', '#a78bfa', '#64748b'];

  wireColor = '#22d3ee';
  /** Animated "flowing current" dashes by default, matching the classic editor. */
  wireStyle: WireStyle['style'] = 'flow';
  wireWidth = 2;
  wireRouter: WireStyle['routing'] = 'manhattan';
  wireArrow: WireStyle['arrow'] = 'Standard';
  wireArrowScale = 1;
  wireCorner: WireStyle['corner'] = 'round';
  wireTwoWay = false;
  wireLabelColor = '#e2e8f0';
  wireLabelSize = 10;
  wireLabelBg = 'rgba(14,15,17,0.75)';
  /** Where the label sits along the run, 0 at one end and 1 at the other. */
  wireLabelAt = 0.5;
  /** How far the label is lifted clear of the wire. */
  wireLabelLift = 0;
  wirePop: 'color' | 'style' | 'label' | null = null;

  private static readonly KEY = 'diagram.wireDefaults';

  /** The style the next wire is drawn in. See the class comment. */
  private remembered: WireStyle = this.snapshot();

  constructor() { this.restore(); }

  /** What a new wire should be drawn in. */
  get defaults(): WireStyle { return this.remembered; }

  wireLineDash(): number[] | null { return this.wireStyle === 'solid' ? null : [6, 3]; }

  setWireColor(c: string): void { this.wireColor = c; this.remember(); this.emit('color', c); }
  setWireStyle(s: WireStyle['style']): void {
    this.wireStyle = s;
    this.remember();
    this.emit('dash', this.wireLineDash());
    this.emit('flow', s === 'flow');
  }
  setWireWidth(w: number): void {
    const v = Math.min(20, Math.max(0.2, Number(w) || 2));
    this.wireWidth = v; this.remember(); this.emit('width', v);
  }
  setWireRouter(r: WireStyle['routing']): void { this.wireRouter = r; this.remember(); this.emit('routing', r); }
  setWireArrow(a: WireStyle['arrow']): void {
    this.wireArrow = a;
    this.remember();
    // `wire: true` is what hides the arrowhead; the figure is irrelevant then.
    this.emit('wire', a === 'none');
    if (a !== 'none') this.emit('arrow', a);
  }
  setWireArrowScale(s: number): void {
    // Clamped, not snapped: the reference drawings use 0.8 and 1.15, which no
    // list of presets was ever going to contain.
    const v = Math.min(4, Math.max(0.1, Number(s) || 1));
    this.wireArrowScale = v; this.remember(); this.emit('arrowScale', v);
  }
  setWireCorner(c: WireStyle['corner']): void { this.wireCorner = c; this.remember(); this.emit('corner', c === 'square' ? 0 : 8); }
  setWireTwoWay(v: boolean): void { this.wireTwoWay = v; this.remember(); this.emit('twoWay', v); }

  // ---- the net name on the wire ----
  setLabelColor(c: string): void { this.wireLabelColor = c; this.remember(); this.emit('textColor', c); }
  setLabelSize(n: any): void {
    const v = Math.min(48, Math.max(4, Number(n) || 10));
    this.wireLabelSize = v; this.remember();
    this.emit('textFont', `600 ${v}px Roboto, sans-serif`);
  }
  setLabelBg(c: string): void { this.wireLabelBg = c; this.remember(); this.emit('textBg', c); }
  /** No background at all — a net name on a schematic sits on the wire. */
  clearLabelBg(): void { this.wireLabelBg = 'transparent'; this.remember(); this.emit('textBg', 'transparent'); }
  setLabelAt(n: any): void {
    const v = Math.min(1, Math.max(0, Number(n)));
    this.wireLabelAt = v; this.emit('textFraction', v);
  }
  setLabelLift(n: any): void {
    const v = Math.min(60, Math.max(-60, Number(n) || 0));
    this.wireLabelLift = v; this.emit('textOffset', `0 ${-v}`);
  }

  toggleWirePop(which: 'color' | 'style' | 'label'): void { this.wirePop = this.wirePop === which ? null : which; }

  /** Show what the newly selected wire actually looks like. */
  syncFrom(data: Record<string, any> | null | undefined): void {
    const d = data || {};
    this.wireColor = d['color'] || this.wireColor;
    this.wireWidth = d['width'] || this.wireWidth;
    this.wireStyle = !d['dash'] ? 'solid' : (d['flow'] ? 'flow' : 'dashed');
    this.wireRouter = d['routing'] || this.wireRouter;
    this.wireArrow = d['wire'] ? 'none' : (d['arrow'] === 'Triangle' ? 'Triangle' : 'Standard');
    this.wireArrowScale = typeof d['arrowScale'] === 'number' ? d['arrowScale'] : 1;
    this.wireCorner = d['corner'] === 0 ? 'square' : 'round';
    this.wireTwoWay = !!d['twoWay'];
    this.wireLabelColor = d['textColor'] || this.wireLabelColor;
    this.wireLabelSize = Number(/(\d+(?:\.\d+)?)px/.exec(String(d['textFont'] || ''))?.[1]) || this.wireLabelSize;
    this.wireLabelBg = d['textBg'] || this.wireLabelBg;
    this.wireLabelAt = typeof d['textFraction'] === 'number' ? d['textFraction'] : 0.5;
    this.wireLabelLift = -Number(String(d['textOffset'] || '0 0').split(/\s+/)[1] || 0);
  }

  private emit(prop: string, value: unknown): void { this.apply.emit({ prop, value }); }

  private snapshot(): WireStyle {
    return {
      color: this.wireColor, width: this.wireWidth, style: this.wireStyle, routing: this.wireRouter,
      arrow: this.wireArrow, arrowScale: this.wireArrowScale, corner: this.wireCorner,
      twoWay: this.wireTwoWay, labelColor: this.wireLabelColor,
      labelSize: this.wireLabelSize, labelBg: this.wireLabelBg,
    };
  }

  /** Adopt the current settings as the default for new wires, and persist them. */
  private remember(): void {
    this.remembered = this.snapshot();
    try { localStorage.setItem(WireDockComponent.KEY, JSON.stringify(this.remembered)); } catch { /* private mode */ }
  }

  /** Restore the remembered style, so it outlives a reload as well. */
  private restore(): void {
    let saved: unknown;
    try { saved = JSON.parse(localStorage.getItem(WireDockComponent.KEY) || 'null'); } catch { saved = null; }
    if (!saved || typeof saved !== 'object') return;
    const d = { ...this.remembered, ...(saved as Partial<WireStyle>) };
    this.remembered = d;
    this.wireColor = d.color; this.wireWidth = d.width; this.wireStyle = d.style;
    this.wireRouter = d.routing; this.wireArrow = d.arrow; this.wireArrowScale = d.arrowScale;
    this.wireCorner = d.corner; this.wireTwoWay = !!d.twoWay;
    this.wireLabelColor = d.labelColor ?? this.wireLabelColor;
    this.wireLabelSize = d.labelSize ?? this.wireLabelSize;
    this.wireLabelBg = d.labelBg ?? this.wireLabelBg;
  }
}
