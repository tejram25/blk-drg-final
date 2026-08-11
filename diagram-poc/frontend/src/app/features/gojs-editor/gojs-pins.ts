import * as go from 'gojs';

/** A named connection point on a block, as it is stored in the node's data.
 *  `fixed` means someone placed it, so even spacing leaves it alone. */
export interface Pin { portId: string; spot: string; fixed?: boolean; }

/** A pin being moved: `side` is where it is going, `spot` where it still is. */
export interface PinMove extends Pin { side?: string }

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

/** How far along its side a pin sits, 0 at one end and 1 at the other. */
export function pinAlong(spot: string): number {
  const sp = go.Spot.parse(spot || '0 0');
  const side = pinSide(spot);
  return side === 'left' || side === 'right' ? sp.y : sp.x;
}

/**
 * Space pins evenly along the side they are on — except the ones that have been
 * put somewhere on purpose.
 *
 * Even spacing is the right default: it means adding a pin never lands it on
 * top of another, and moving one to a different side never carries a stale
 * percentage with it. But the source drawings place pins at exact fractions, so
 * a pin marked `fixed` keeps its own position and is simply skipped when the
 * rest are spread out.
 */
export function spaced(pins: PinMove[]): Pin[] {
  const out: Pin[] = [];
  for (const side of PIN_SIDES) {
    const onSide = pins.filter((p) => (p.side ?? pinSide(p.spot)) === side);
    const loose = onSide.filter((p) => !p.fixed);
    let i = 0;
    for (const p of onSide) {
      if (p.fixed) {
        // A fixed pin that changed side keeps how far along it was.
        out.push({ portId: p.portId, spot: spotOn(side, pinAlong(p.spot)), fixed: true });
      } else {
        out.push({ portId: p.portId, spot: spotOn(side, (i + 1) / (loose.length + 1)) });
        i++;
      }
    }
  }
  // Keep the panel's order stable so rows do not jump around as you edit.
  const order = new Map(pins.map((p, i) => [p.portId, i]));
  return out.sort((a, b) => (order.get(a.portId) ?? 0) - (order.get(b.portId) ?? 0));
}
