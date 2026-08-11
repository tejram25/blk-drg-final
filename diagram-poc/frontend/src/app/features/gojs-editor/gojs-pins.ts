import * as go from 'gojs';

/** A named connection point on a block, as it is stored in the node's data. */
export interface Pin { portId: string; spot: string; }

/** A pin being moved: `side` is where it is going, `spot` where it still is. */
export interface PinMove extends Pin { side?: string; }

export type PinSide = 'left' | 'right' | 'top' | 'bottom';

export const PIN_SIDES: readonly PinSide[] = ['left', 'right', 'top', 'bottom'];

/** Which edge a pin sits on, derived from its spot. */
export function pinSide(spot: string): PinSide {
  const sp = go.Spot.parse(spot || '0 0');
  const d: [PinSide, number][] = [['left', sp.x], ['right', 1 - sp.x], ['top', sp.y], ['bottom', 1 - sp.y]];
  return d.sort((a, b) => a[1] - b[1])[0][0];
}

/** The spot string for a pin a given fraction along a given side. */
export function spotOn(side: PinSide, along: number): string {
  return side === 'left' ? `0 ${along}` : side === 'right' ? `1 ${along}`
    : side === 'top' ? `${along} 0` : `${along} 1`;
}

/**
 * Space every pin evenly along the side it is on.
 *
 * Placement is not something to hand-tune. Pins carried an explicit percentage,
 * which meant adding one put it wherever the arithmetic landed and moving one to
 * another side kept its old percentage — so two pins could sit on the same point
 * and the move looked like it had done nothing. Spacing is derived from what is
 * on each side, so it is always right and there is nothing to set.
 */
export function spaced(pins: PinMove[]): Pin[] {
  const out: Pin[] = [];
  for (const side of PIN_SIDES) {
    const onSide = pins.filter((p) => (p.side ?? pinSide(p.spot)) === side);
    onSide.forEach((p, i) => {
      out.push({ portId: p.portId, spot: spotOn(side, (i + 1) / (onSide.length + 1)) });
    });
  }
  // Keep the panel's order stable so rows do not jump around as you edit.
  const order = new Map(pins.map((p, i) => [p.portId, i]));
  return out.sort((a, b) => (order.get(a.portId) ?? 0) - (order.get(b.portId) ?? 0));
}
