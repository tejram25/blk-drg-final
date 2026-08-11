import * as go from 'gojs';

/**
 * Marks an element as a part's movable name and names the model field that
 * records where it was put. Underscore-prefixed, which is GoJS's own escape
 * hatch for data of ours hung on a GraphObject.
 */
export const NAME_FIELD = '_nameField';

/** What a template adds to make its label placeable: the marker, and the two
 *  bindings that read the recorded spot back. A missing spot means the centre,
 *  which is where every label sat before there was anywhere else to put one. */
export function placeable(field: string): (go.Binding | Record<string, unknown>)[] {
  return [
    { [NAME_FIELD]: field },
    new go.Binding('alignment', field, nameSpot),
    new go.Binding('alignmentFocus', field, nameFocus),
  ];
}

/** Where in the block the label goes. */
export function nameSpot(s: unknown): go.Spot {
  return typeof s === 'string' && s.trim() ? go.Spot.parse(s) : go.Spot.Center;
}

/**
 * Which point *of the label* lands there.
 *
 * The fractional part of the spot, always: at "0 0" the label's top-left corner
 * goes to the block's top-left corner, so a corner preset tucks the name into
 * the corner instead of hanging it half outside. A dragged spot is "0.5 0.5"
 * plus an offset, so this gives back the centre and the offset does the work.
 */
export function nameFocus(s: unknown): go.Spot {
  const sp = nameSpot(s);
  return new go.Spot(sp.x, sp.y);
}

/**
 * Drag a block's name to anywhere inside it.
 *
 * Alt is what separates the two gestures. A plain drag on a block moves the
 * block, and the name usually sits in the middle of it, so without a modifier
 * the most natural way to pick a block up would instead pick its label up.
 * Holding Alt anywhere on the block moves that block's name — anywhere, not
 * only on the words, because a short name in a wide block is a small target.
 *
 * What it writes is a spot: the centre of the block plus an offset in pixels.
 * That keeps the name where it was put when the block is resized, and it is the
 * same field the position presets in the properties panel write, so the two
 * ways of placing a label cannot disagree.
 */
export class LabelDragTool extends go.Tool {
  private label: go.GraphObject | null = null;
  /** Where the label's focus point sat relative to the pointer at mouse-down,
   *  so the name does not jump to the cursor when the drag starts. */
  private grab = new go.Point();
  private original: go.Spot = go.Spot.Center;

  constructor() {
    super();
    this.name = 'LabelDrag';
  }

  private fieldOf(o: go.GraphObject | null | undefined): string {
    const f = o ? (o as unknown as Record<string, unknown>)[NAME_FIELD] : null;
    return typeof f === 'string' ? f : '';
  }

  /** The marked element at or above whatever the pointer is over. */
  private above(o: go.GraphObject | null): go.GraphObject | null {
    for (let x: go.GraphObject | null = o; x; x = x.panel) if (this.fieldOf(x)) return x;
    return null;
  }

  /** The part's own name, for a press that landed on its fill rather than its
   *  words. The visible one: a block draws either a plain label or a formatted
   *  one, and both are marked. */
  private within(part: go.Part): go.GraphObject | null {
    let found: go.GraphObject | null = null;
    const walk = (p: go.Panel) => {
      p.elements.each((el) => {
        if (found || !el.visible) return;
        if (this.fieldOf(el)) found = el;
        else if (el instanceof go.Panel) walk(el);
      });
    };
    walk(part);
    return found;
  }

  private findLabel(at: go.Point | null): go.GraphObject | null {
    const d = this.diagram;
    if (!d || !at) return null;
    const hit = d.findObjectAt(at, null, null);
    const direct = this.above(hit);
    if (direct) return direct;
    const part = hit?.part;
    return part instanceof go.Node ? this.within(part) : null;
  }

  override canStart(): boolean {
    const d = this.diagram;
    if (!this.isEnabled || !d || !d.allowMove) return false;
    const e = d.lastInput;
    if (!e.left || !e.alt || e.isTouchEvent) return false;
    if (!this.isBeyondDragSize()) return false;
    return this.findLabel(d.firstInput.documentPoint) !== null;
  }

  override doActivate(): void {
    const d = this.diagram;
    if (!d) return;
    this.label = this.findLabel(d.firstInput.documentPoint);
    if (!this.label || !this.label.panel) { this.stopTool(); return; }
    this.original = this.label.alignment;
    this.grab = this.focusPoint(this.label).subtract(d.firstInput.documentPoint);
    this.startTransaction('move name');
    d.isMouseCaptured = true;
    this.isActive = true;
  }

  override doMouseMove(): void {
    if (this.isActive) this.place();
  }

  override doMouseUp(): void {
    if (!this.isActive) { this.stopTool(); return; }
    const spot = this.place();
    const label = this.label;
    const part = label?.part;
    const field = this.fieldOf(label);
    if (spot && part && field) this.diagram?.model.set(part.data, field, go.Spot.stringify(spot));
    this.transactionResult = 'move name';
    this.stopTool();
  }

  override doCancel(): void {
    if (this.label) this.label.alignment = this.original;
    this.stopTool();
  }

  override doDeactivate(): void {
    const d = this.diagram;
    this.stopTransaction();
    if (d) d.isMouseCaptured = false;
    this.label = null;
    super.doDeactivate();
  }

  /** Which point of the label the drag holds on to, and where it is now. */
  private focus(label: go.GraphObject): go.Spot {
    const f = label.alignmentFocus;
    return f.isDefault() ? go.Spot.Center : f;
  }
  private focusPoint(label: go.GraphObject): go.Point {
    return label.getDocumentPoint(this.focus(label));
  }

  /**
   * Put the label under the pointer, kept inside the block.
   *
   * Clamping is not only tidiness: the panel a label sits in grows to hold
   * whatever is in it, so a label dragged past the edge would push the edge out
   * and move the very centre this offset is measured from.
   */
  private place(): go.Spot | null {
    const label = this.label;
    const panel = label?.panel;
    const at = this.diagram?.lastInput.documentPoint;
    if (!label || !panel || !at) return null;
    const box = panel.getDocumentBounds();
    const size = label.actualBounds;
    const f = this.focus(label);
    // Where the held point sits inside the label itself.
    const fx = f.x * size.width + f.offsetX;
    const fy = f.y * size.height + f.offsetY;
    const fit = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
    const x = fit(at.x + this.grab.x, box.x + fx, box.right - (size.width - fx));
    const y = fit(at.y + this.grab.y, box.y + fy, box.bottom - (size.height - fy));
    const spot = new go.Spot(0.5, 0.5,
      Math.round(x - box.center.x), Math.round(y - box.center.y));
    label.alignment = spot;
    return spot;
  }
}
