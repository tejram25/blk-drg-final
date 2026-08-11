import * as go from 'gojs';

/**
 * Where a wire meets a block, and how it gets there.
 *
 * This is the geometry behind "draw a wire from anywhere on an edge and it
 * stays where you dropped it": the connection point belongs to the connection,
 * so it is recorded on the wire (`fromSpotXY` / `toSpotXY`) rather than
 * declared on the block up front. Split out of the editor component because
 * none of it is Angular — it is arithmetic over a GoJS diagram, and it is far
 * easier to reason about (and to fix) on its own.
 */
export class WireGeometry {
  constructor(private readonly diagram: go.Diagram) {}

  /**
   * Where the drag began, in document coordinates. `firstInput` is the
   * mouse-down that started the tool, so it is the point on the block's edge
   * the user actually grabbed.
   */
  linkStart: go.Point | null = null;

  /**
   * Record where a freshly drawn wire meets each block, so it stays where it
   * was dropped instead of sliding to the middle of the edge.
   *
   * This is what removes the need to declare a pin before wiring: drawing the
   * wire *is* how its connection point is created. Only edge rails get a spot —
   * a wire dropped on a named pin should keep that pin's own position.
   */
  static readonly RAIL_IDS = new Set(['T', 'R', 'B', 'L']);

  /**
   * The rail a wire end is on, resolved from the link's *data*.
   *
   * `Link.fromPort` / `toPort` are unreliable at the moment these events fire —
   * mid-relink the moved end is detached, so reading it silently skips the very
   * write we are here to make. The data has already been updated, so go from
   * there.
   */
  private railOf(nodeKey: unknown, portId: unknown): go.GraphObject | null {
    if (!WireGeometry.RAIL_IDS.has(String(portId))) return null;
    const node = this.diagram.findNodeForKey(nodeKey as go.Key);
    let found: go.GraphObject | null = null;
    node?.ports.each((p) => { if (p.portId === portId) found = p; });
    return found;
  }

  /**
   * The edge a wire should meet when it was dropped on a block's face rather
   * than on one of its rails: the one facing where the wire comes from.
   *
   * Nearest-edge-to-the-drop-point is the obvious rule and it is wrong. On a
   * tall block, a wire arriving from the left and released a fifth of the way
   * down is genuinely closer to the top edge, so it wrapped over the top —
   * geometrically right, visibly silly. Which side the wire approaches from is
   * what a reader expects, and the drop point then decides where along that
   * side it lands.
   */
  private facingRail(nodeKey: unknown, otherKey: unknown, pt: go.Point): go.GraphObject | null {
    const node = this.diagram.findNodeForKey(nodeKey as go.Key);
    const other = this.diagram.findNodeForKey(otherKey as go.Key);
    if (!node) return null;

    let side: string;
    if (!other || other === node) {
      // No other end to face (or both ends on one block): fall back to whichever
      // edge the drop point is nearest, measured against the block's own size.
      const b = node.actualBounds;
      const nx = (pt.x - (b.x + b.width / 2)) / (b.width / 2 || 1);
      const ny = (pt.y - (b.y + b.height / 2)) / (b.height / 2 || 1);
      side = Math.abs(nx) >= Math.abs(ny) ? (nx < 0 ? 'L' : 'R') : (ny < 0 ? 'T' : 'B');
    } else {
      const nb = node.actualBounds, ob = other.actualBounds;
      const dx = (ob.x + ob.width / 2) - (nb.x + nb.width / 2);
      const dy = (ob.y + ob.height / 2) - (nb.y + nb.height / 2);
      // Scaled by half-extent so a wide, short block does not always prefer its
      // long edge purely because that distance is larger in absolute terms.
      const nx = dx / (nb.width / 2 || 1), ny = dy / (nb.height / 2 || 1);
      side = Math.abs(nx) >= Math.abs(ny) ? (dx < 0 ? 'L' : 'R') : (dy < 0 ? 'T' : 'B');
    }
    return this.railOf(nodeKey, side);
  }

  /**
   * Where the preview endpoint belongs while a wire is being drawn: as close as
   * possible to where the finished wire will actually attach.
   *
   * On a rail that is the grabbed point projected onto the block's outline; on a
   * named pin it is the pin, which owns its own position; on a block's face it
   * is simply the point under the pointer.
   */
  tempPortPoint(port: go.GraphObject, ref: go.Point | null): go.Point {
    const b = port.getDocumentBounds();
    const centre = new go.Point(b.x + b.width / 2, b.y + b.height / 2);
    if (!ref || !b.width || !b.height) return centre;
    const x = Math.min(b.x + b.width, Math.max(b.x, ref.x));
    const y = Math.min(b.y + b.height, Math.max(b.y, ref.y));
    switch (String(port.portId ?? '')) {
      case 'L': return new go.Point(b.x, y);
      case 'R': return new go.Point(b.x + b.width, y);
      case 'T': return new go.Point(x, b.y);
      case 'B': return new go.Point(x, b.y + b.height);
      case '': return new go.Point(x, y);
      default: return centre;
    }
  }

  /** The direction a wire leaves a port, for previewing its route. */
  outwardSpot(port: go.GraphObject): go.Spot {
    switch (String(port.portId ?? '')) {
      case 'L': return go.Spot.Left;
      case 'R': return go.Spot.Right;
      case 'T': return go.Spot.Top;
      case 'B': return go.Spot.Bottom;
      default: {
        const s = port.fromSpot;
        return s && !s.isDefault() ? s : go.Spot.Default;
      }
    }
  }

  /** Write one end's attachment point, as a fraction along its rail. */
  private setWireEnd(link: go.Link, which: 'from' | 'to', pt: go.Point | null): void {
    if (!pt) return;
    const portId = String(link.data?.[which + 'Port'] ?? '');
    // A named pin owns its position — that is the whole point of naming it — so
    // leave the wire on it and record nothing. Only a rail or a drop on the
    // block's face is ours to place.
    if (portId && !WireGeometry.RAIL_IDS.has(portId)) return;
    let port = this.railOf(link.data?.[which], portId);
    if (!port) {
      // Dropped on the block's face. Attach to the edge facing the other end of
      // the wire, at the point it was dropped, rather than leaving it on the
      // body port where every such wire would converge.
      const other = which === 'to' ? link.data?.['from'] : link.data?.['to'];
      port = this.facingRail(link.data?.[which], other, pt);
      if (!port) return;
      this.diagram.model.set(link.data, which + 'Port', port.portId);
    }
    const b = port.getDocumentBounds();
    if (!b || !b.width || !b.height) return;
    const fx = Math.min(1, Math.max(0, (pt.x - b.x) / b.width));
    const fy = Math.min(1, Math.max(0, (pt.y - b.y) / b.height));
    // A rail is long in one direction only: pin the wire along that axis, and on
    // the *outer* edge in the other. The outer edge matters as much as the
    // position — a spot on the boundary tells GoJS which way the wire leaves, so
    // it heads straight out. An interior spot (the old 0.5 across) leaves the
    // direction undefined, and orthogonal routing resolves that with a hook.
    const spots: Record<string, go.Spot> = {
      L: new go.Spot(0, fy), R: new go.Spot(1, fy),
      T: new go.Spot(fx, 0), B: new go.Spot(fx, 1),
    };
    const spot = spots[String(port.portId)];
    if (!spot) return;
    this.diagram.model.set(link.data, which + 'SpotXY', go.Spot.stringify(spot));
  }

  /**
   * Where a wire meets a block, in document coordinates, derived from the model
   * rather than from `Link.points` — which has not been recomputed yet at the
   * moment these handlers run.
   */
  private endDocPoint(link: go.Link, which: 'from' | 'to'): go.Point | null {
    const portId = String(link.data?.[which + 'Port'] ?? '');
    const node = this.diagram.findNodeForKey(link.data?.[which] as go.Key);
    let port: go.GraphObject | null = null;
    node?.ports.each((p) => { if (p.portId === portId) port = p; });
    if (!port) return null;
    const b = (port as go.GraphObject).getDocumentBounds();
    if (!b || !b.width || !b.height) return null;
    const raw = link.data?.[which + 'SpotXY'];
    // A named pin has no recorded spot: it *is* the point.
    if (!raw) return new go.Point(b.x + b.width / 2, b.y + b.height / 2);
    const s = go.Spot.parse(String(raw));
    return new go.Point(b.x + b.width * s.x, b.y + b.height * s.y);
  }

  /**
   * A run within a few pixels of straight is drawn straight.
   *
   * Orthogonal routing turns a 1 px difference between two nearly-aligned ends
   * into a full S-bend, and a dogleg in what reads as a straight line is the
   * single thing that makes an otherwise correct drawing look hand-shaky. Only
   * the end that was just placed moves, and only if it is on a rail — a named
   * pin owns its position, and nudging it would drag every other wire on it.
   */
  static readonly STRAIGHTEN_TOL = 6;

  private straightenRun(link: go.Link, moved: 'from' | 'to'): void {
    const portId = String(link.data?.[moved + 'Port'] ?? '');
    if (!WireGeometry.RAIL_IDS.has(portId)) return;
    const other = moved === 'from' ? 'to' : 'from';
    const otherId = String(link.data?.[other + 'Port'] ?? '');
    const horizontal = portId === 'L' || portId === 'R';
    // Only when both ends face along the same axis; an L-shaped run is meant
    // to bend, and squaring it up would move the wire somewhere else entirely.
    if (horizontal !== (otherId === 'L' || otherId === 'R')) return;
    const a = this.endDocPoint(link, moved), z = this.endDocPoint(link, other);
    if (!a || !z) return;
    const off = horizontal ? z.y - a.y : z.x - a.x;
    if (!off || Math.abs(off) > WireGeometry.STRAIGHTEN_TOL) return;
    const node = this.diagram.findNodeForKey(link.data?.[moved] as go.Key);
    let port: go.GraphObject | null = null;
    node?.ports.each((p) => { if (p.portId === portId) port = p; });
    const b = (port as go.GraphObject | null)?.getDocumentBounds();
    if (!b || !b.width || !b.height) return;
    const s = go.Spot.parse(String(link.data?.[moved + 'SpotXY'] ?? '0.5 0.5'));
    const snapped = horizontal
      ? new go.Spot(s.x, Math.min(1, Math.max(0, (a.y + off - b.y) / b.height)))
      : new go.Spot(Math.min(1, Math.max(0, (a.x + off - b.x) / b.width)), s.y);
    this.diagram.model.set(link.data, moved + 'SpotXY', go.Spot.stringify(snapped));
  }

  /** A newly drawn wire: both ends are being placed, by one drag. */
  pinDrawnEnds(link: go.Link): void {
    if (!link) return;
    const end = this.diagram.lastInput?.documentPoint ?? null;
    this.diagram.model.commit(() => {
      this.setWireEnd(link, 'from', this.linkStart);
      this.setWireEnd(link, 'to', end);
      // The drop end yields to the grabbed one: you aimed with the first click.
      this.straightenRun(link, 'to');
    }, 'pin wire ends');
    this.linkStart = null;
  }

  /**
   * A wire whose end was dragged: exactly one end moved, so only that one may
   * be rewritten. Treating a relink like a fresh draw applied the grab point to
   * the *from* end, which shifted an end the user never touched.
   *
   * Which end moved is decided by proximity to the drop point rather than by
   * the tool's internals, so it holds for both relink handles and for a drop
   * back onto the same block.
   */
  pinRelinkedEnd(link: go.Link): void {
    this.linkStart = null;
    const pt = this.diagram.lastInput?.documentPoint ?? null;
    if (!link || !pt) return;
    const reach = (which: 'from' | 'to') => {
      const port = this.railOf(link.data?.[which], link.data?.[which + 'Port']);
      const b = port?.getDocumentBounds();
      return b ? Math.abs(pt.x - (b.x + b.width / 2)) + Math.abs(pt.y - (b.y + b.height / 2)) : Infinity;
    };
    const moved: 'from' | 'to' = reach('from') <= reach('to') ? 'from' : 'to';
    if (!isFinite(reach(moved))) return;
    this.diagram.model.commit(() => {
      this.setWireEnd(link, moved, pt);
      this.straightenRun(link, moved);
    }, 'move wire end');
  }
}
