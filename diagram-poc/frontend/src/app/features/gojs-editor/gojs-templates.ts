import * as go from 'gojs';
import { WireGeometry } from './gojs-wire-geometry';
import {
  DEFAULT_FONT, DrawnLine, isRich, layoutRich, parseRichText, richExtent,
} from './rich-text';
import { richEditing } from './gojs-rich-editor';
import { NAME_FIELD, placeable } from './gojs-label-drag';

/**
 * What the templates need back from the editor.
 *
 * The templates are the bulk of the diagram's behaviour and none of it is
 * Angular, so it lives here rather than in the component. These few callbacks
 * are the whole of the coupling that remains: what a node does on hover, what
 * its tooltip says, and the wire-endpoint arithmetic.
 */
export interface TemplateHooks {
  hoverPorts(obj: go.GraphObject, on: boolean): void;
  /** Where the pointer is on a block, so one edge rail can follow it. */
  hoverEdge(obj: go.GraphObject, pt: go.Point): void;
  showPartsDock(part: go.Part | null, on: boolean): void;
  showAllPins(on: boolean): void;
  updateJunctions(): void;
  nodeTip($: typeof go.GraphObject.make): go.Adornment;
  wires: WireGeometry;
}

/**
 * Install every node, group and link template on a diagram, and the tool
 * customisations that go with them.
 */
/** The mirrored twin of an arrowhead, for the *from* end of a two-way wire. */
function backwardArrow(name: string): string {
  const n = name || 'Standard';
  return n === 'Standard' ? 'Backward' : n.startsWith('Backward') ? n : 'Backward' + n;
}

/** The margin the rich stack sits in, and so the padding a block needs for it. */
const RICH_MARGIN = 6;

/** The thickest an edge rail is ever drawn, and which side it crosses. */
const RAIL_MAX = 14;
const RAIL_DIR = '_rail';
/** The four edge rails, by port id. */
export const RAIL_IDS = new Set(['T', 'R', 'B', 'L']);
/** How close to an edge counts as reaching for it rather than for the block. */
const RAIL_REACH = 4;

/** A rail's thickness on a block of this size: a share of the side it crosses,
 *  never more than RAIL_MAX and never so thin it cannot be hit. */
function railThickness(across: number): number {
  return Math.max(3, Math.min(RAIL_MAX, across * 0.18));
}

/** The body of a block — what its rails are drawn against. A node is as tall as
 *  a caption hanging below it; the box is what the user sees. */
function bodyBounds(node: go.Node): go.Rect {
  return (node.findPort('') ?? node).getDocumentBounds();
}

/**
 * Which edge the pointer is reaching for, or null when it is on the block
 * itself.
 *
 * A rail is the target for starting a wire, so it wants to be easy to hit; but
 * lighting all four at once frames the block in blue, and on a small block that
 * frame is the block. One edge at a time — the nearest, and only when the
 * pointer is actually at it — leaves the middle unmistakably the block's own.
 */
export function railAt(node: go.Node, pt: go.Point): string | null {
  const b = bodyBounds(node);
  if (!b.width || !b.height) return null;
  const gap: Record<string, number> = {
    L: pt.x - b.x, R: b.right - pt.x, T: pt.y - b.y, B: b.bottom - pt.y,
  };
  let near = 'L';
  for (const id of Object.keys(gap)) if (gap[id] < gap[near]) near = id;
  if (gap[near] < 0) return null;
  const across = near === 'L' || near === 'R' ? b.width : b.height;
  return gap[near] <= railThickness(across) + RAIL_REACH ? near : null;
}

/** The dot marking where a wire would leave the block from. */
export const WIRE_DOT = 'WIREDOT';

/**
 * Say where a wire would start — with a dot on the edge, not a band along it.
 *
 * The rails are geometry, not decoration: they are never drawn and never
 * pressable. What decides whether a press starts a wire is the press point
 * itself (see the linking tool's `findLinkablePort`), and the cursor already
 * says which gesture you will get, so a translucent stripe down the edge was
 * ink with no job — on a small block it was most of the block. A single dot at
 * the point the wire would actually attach says the same thing and says it more
 * precisely, since that is exactly where the wire ends up.
 */
export function showRail(node: go.Node, id: string | null, pt: go.Point | null): void {
  const dot = node.findObject(WIRE_DOT);
  if (!dot) return;
  const b = bodyBounds(node);
  if (!id || !pt || !b.width || !b.height) { dot.visible = false; return; }
  const fx = Math.min(1, Math.max(0, (pt.x - b.x) / b.width));
  const fy = Math.min(1, Math.max(0, (pt.y - b.y) / b.height));
  const spot = id === 'L' ? new go.Spot(0, fy) : id === 'R' ? new go.Spot(1, fy)
    : id === 'T' ? new go.Spot(fx, 0) : new go.Spot(fx, 1);
  dot.alignment = spot;
  // Wholly inside the outline: a Spot panel takes the size of everything in it,
  // so a dot straddling the edge would quietly make the block bigger.
  dot.alignmentFocus = spot;
  dot.visible = true;
}

/** Hide the connection dot — the pointer has left, or a picture is being taken. */
export function hideRail(node: go.Node): void {
  const dot = node.findObject(WIRE_DOT);
  if (dot) dot.visible = false;
}

/** The rail a press at this point belongs to, as an object to start a wire on. */
export function railPortAt(node: go.Node, pt: go.Point): go.GraphObject | null {
  const id = railAt(node, pt);
  if (!id) return null;
  let found: go.GraphObject | null = null;
  node.ports.each((p) => { if (p.portId === id) found = p; });
  return found;
}

/**
 * Fit a block's connection rails to the block.
 *
 * A rail spans a whole edge so that several wires leaving one side can spread
 * out along it, and at a fixed 14px that is most of a small block: a part row
 * 16px tall was covered end to end by its own top and bottom rails, so it read
 * as a blue frame with no middle and a press anywhere on it started a wire
 * instead of picking the row up. Each rail is now a share of the side it
 * crosses — a rail can be thin, but the middle of a block always stays the
 * block's own.
 *
 * Called whenever the diagram settles, not on hover: a rail that is still
 * block-wide when the pointer first arrives has already decided the cursor, and
 * on a small block that first impression is a box you cannot pick up.
 */
export function fitPorts(node: go.Node): void {
  // The body, not the node: a node is as tall as its caption hanging below it,
  // and the rails belong to the box.
  const b = (node.findPort('') ?? node).actualBounds;
  const want = railThickness;
  node.ports.each((p) => {
    const dir = (p as unknown as Record<string, unknown>)[RAIL_DIR];
    if (dir !== 'v' && dir !== 'h') return;
    const vertical = dir === 'v';
    const t = want(vertical ? b.width : b.height);
    const now = vertical ? p.desiredSize.width : p.desiredSize.height;
    if (Math.abs(now - t) < 0.5) return;
    p.desiredSize = vertical ? new go.Size(t, NaN) : new go.Size(NaN, t);
  });
}

/** A formatted label, wrapped into the rows the canvas will draw. */
function richLayout(d: go.ObjectData): DrawnLine[] {
  return layoutRich(
    parseRichText(String(d['html'])),
    String(d['font'] || DEFAULT_FONT),
    typeof d['textWidth'] === 'number' ? d['textWidth'] : 150,
  );
}

/** A rich label, as the rows and runs the canvas will draw: one TextBlock per
 *  run, so a mark can cover a selection rather than a whole line. */
function richItems(d: go.ObjectData): go.ObjectData[] {
  if (!isRich(d?.['html'])) return [];
  const stroke = String(d['labelColor'] || '#1f2937');
  return richLayout(d).map((l) => ({
    indent: l.indent,
    runs: l.runs.map((r) => ({ ...r, stroke })),
  }));
}

/** Which way the rows of a formatted label line up. Bullets are always left. */
function richAlignment(d: go.ObjectData): go.Spot {
  if (!isRich(d?.['html'])) return go.Spot.Left;
  if (parseRichText(String(d['html'])).some((l) => l.bullet)) return go.Spot.Left;
  const a = String(d['textAlign'] || 'center');
  return a === 'right' ? go.Spot.Right : a === 'left' ? go.Spot.Left : go.Spot.Center;
}

/**
 * How small a shape may be drawn. A Spot panel takes the size of everything in
 * it, so an oversized label hangs outside the outline instead of clipping — the
 * block grows to hold it. Formatted labels only: a plain one is the size the
 * artwork says, and every reference drawing depends on that.
 *
 * The 48x40 floor stops a careless drag making something too small to click;
 * imported artwork sets `minSize` to opt out.
 */
function shapeMinSize(d: go.ObjectData): go.Size {
  const floor = go.Size.parse(String(d?.['minSize'] ?? '48 40'));
  if (!isRich(d?.['html'])) return floor;
  const ext = richExtent(richLayout(d));
  return new go.Size(
    Math.max(floor.width, ext.width + RICH_MARGIN * 2 + 4),
    Math.max(floor.height, ext.height + RICH_MARGIN * 2 + 4),
  );
}

/** What the Text tab needs to reach a plain label — and what imported artwork
 *  carries, so this is also what makes an imported label look right. */
function labelStyle(): go.Binding[] {
  return [
    new go.Binding('stroke', 'labelColor'),
    new go.Binding('font', 'font'),
    new go.Binding('textAlign', 'textAlign'),
    new go.Binding('isUnderline', 'underline'),
    new go.Binding('maxSize', 'textWidth', (w: number) => new go.Size(w, NaN)),
  ];
}

/** The stack that draws a formatted label. Shared, so the Text tab means the
 *  same thing on a functional block as on a native shape. */
function richStack(
  $: typeof go.GraphObject.make,
  ...extra: (go.Binding | Record<string, unknown>)[]
): go.Panel {
  /** One drawn line: its runs laid side by side, each in its own font. */
  const row = $(
    go.Panel, 'Horizontal',
    {
      itemTemplate: $(go.Panel, 'Auto',
        $(go.TextBlock, { alignment: go.Spot.Left },
          new go.Binding('text'),
          new go.Binding('font'),
          new go.Binding('stroke'),
          new go.Binding('isUnderline', 'underline'),
          new go.Binding('margin', 'gap', (g: number) => new go.Margin(0, g || 0, 0, 0)))),
    },
    // A wrapped bullet indents under its first word, not under the marker.
    new go.Binding('margin', 'indent', (i: number) => new go.Margin(0, 0, 0, i || 0)),
    new go.Binding('itemArray', 'runs'),
  );
  return $(
    go.Panel, 'Vertical',
    { margin: RICH_MARGIN, visible: false, itemTemplate: row },
    new go.Binding('visible', 'html', (h) => isRich(h)),
    new go.Binding('defaultAlignment', '', richAlignment),
    // Whole data object: the layout depends on label, font, width and colour.
    new go.Binding('itemArray', '', richItems),
    ...extra,
  );
}

export function buildTemplates(diagram: go.Diagram, $: typeof go.GraphObject.make, hooks: TemplateHooks): void {
    /**
     * A connection rail down a whole edge, not a dot in the middle of it.
     *
     * As a 9px dot with `fromSpot: Spot.Right`, a side accepted any number of
     * wires but attached every one of them to the same point — four wires out
     * of a distribution board left as one line and split further out, which is
     * not what the block diagram shows. The `*Side` spots plus
     * `portSpreading` let GoJS distribute them, but it distributes across the
     * *port's* extent, so the port has to span the edge for that to mean
     * anything.
     */
    const sidePort = (id: string, spot: go.Spot, side: go.Spot, vertical: boolean) => $(
      go.Shape, 'RoundedRectangle',
      {
        parameter1: 4, fill: 'rgba(34,211,238,0.30)', stroke: '#22d3ee', strokeWidth: 1,
        // RAIL_MAX, not 9: this is the grab target for starting a wire, and a
        // 9px stripe is a fiddly thing to hit on a first attempt. It is a
        // ceiling rather than a constant — see `fitPorts`.
        desiredSize: vertical ? new go.Size(RAIL_MAX, NaN) : new go.Size(NaN, RAIL_MAX),
        [RAIL_DIR]: vertical ? 'v' : 'h',
        stretch: vertical ? go.GraphObject.Vertical : go.GraphObject.Horizontal,
        // `alignmentFocus: spot` keeps the rail wholly inside the block, with its
        // outer edge on the outline. Centred on the outline it straddled it, and
        // a connection point half a rail outside the block is what put the little
        // hook at the start of every wire: the spot recorded for it was interior,
        // so GoJS had no outward direction to leave in and doubled back.
        // Never drawn and not pickable at rest: a rail is the arithmetic of
        // where a wire may attach, not a thing lying over the block waiting to
        // take the press meant for it. A wire in flight turns them all on, so
        // the whole canvas becomes a set of places to drop it.
        cursor: 'crosshair', opacity: 0, pickable: false, alignment: spot, alignmentFocus: spot,
        portId: id, fromLinkable: true, toLinkable: true, fromSpot: side, toSpot: side,
      });
    const sidePorts = () => [
      sidePort('T', go.Spot.Top, go.Spot.TopSide, false),
      sidePort('R', go.Spot.Right, go.Spot.RightSide, true),
      sidePort('B', go.Spot.Bottom, go.Spot.BottomSide, false),
      sidePort('L', go.Spot.Left, go.Spot.LeftSide, true),
    ];
    /** Where the wire would leave from, shown while the pointer is at an edge. */
    const wireDot = () => $(go.Shape, 'Circle',
      { name: WIRE_DOT, desiredSize: new go.Size(9, 9), fill: '#22d3ee', stroke: '#ffffff',
        strokeWidth: 1.5, visible: false, pickable: false });
    const sideSpot = (s: string) => {
      const sp = go.Spot.parse(s);
      const dl = sp.x, dr = 1 - sp.x, dt = sp.y, db = 1 - sp.y;
      const m = Math.min(dl, dr, dt, db);
      return m === dl ? go.Spot.Left : m === dr ? go.Spot.Right : m === dt ? go.Spot.Top : go.Spot.Bottom;
    };
    const pinPort = $(
      go.Panel, 'Spot',
      new go.Binding('alignment', 'spot', go.Spot.parse),
      // Sit the marker *inside* the block with its outer edge on the outline,
      // exactly as the rails do. Centred on the outline it did two bad things:
      // the wire attached to the marker's outer edge and so stopped half a
      // marker short of the block, and — because a Spot panel takes the size of
      // everything in it — pins on one side only made the whole overlay
      // lopsided, which shifted every pin on that node by half a marker.
      new go.Binding('alignmentFocus', 'spot', sideSpot),
      // Shaped like the selection handles, deliberately: a small opaque square
      // on the outline. The translucent circle this replaces was 11px and drawn
      // through the border, so a row of them read as a smudge along the edge
      // rather than as a row of connection points.
      $(go.Shape, 'Rectangle',
        // Hidden at rest, exactly like the edge rails: a connection point is
        // editing furniture, and left showing it speckles every block with
        // markers that then follow the drawing into an exported picture.
        // Hovering the block brings them all back.
        { desiredSize: new go.Size(9, 9), fill: '#0084D5', stroke: '#ffffff', strokeWidth: 1,
          cursor: 'crosshair', opacity: 0, fromLinkable: true, toLinkable: true },
        new go.Binding('portId', 'portId'),
        new go.Binding('fromSpot', 'spot', sideSpot),
        new go.Binding('toSpot', 'spot', sideSpot)),
      $(go.Shape, 'Circle',
        { name: 'JCT', desiredSize: new go.Size(7, 7), fill: '#94a3b8', strokeWidth: 0,
          opacity: 0, pickable: false }),
    );
    const hover = {
      mouseEnter: (_e: go.InputEvent, o: go.GraphObject) => { hooks.hoverPorts(o, true); hooks.showPartsDock(o.part, true); },
      mouseLeave: (_e: go.InputEvent, o: go.GraphObject) => { hooks.hoverPorts(o, false); hooks.showPartsDock(o.part, false); },
      // Which edge is live follows the pointer across the block, so the rails
      // are never a frame around it.
      mouseOver: (e: go.InputEvent, o: go.GraphObject) => hooks.hoverEdge(o, e.documentPoint),
    };

    /**
     * Double-click edits the label on the block: the rich overlay if it is
     * formatted, GoJS's own editor if it is plain. The plain case is opened by
     * hand because the label sits behind the body port that makes a block a
     * wire drop-target, so `TextEditingTool.canStart()` never becomes true.
     */
    const editLabel = {
      doubleClick: (e: go.InputEvent, o: go.GraphObject) => {
        const n = o.part;
        if (!(n instanceof go.Node)) return;
        e.handled = true;
        if (richEditing.canEdit(n)) { richEditing.start(n); return; }
        const label = n.findObject('LABEL');
        if (label instanceof go.TextBlock) n.diagram?.commandHandler.editTextBlock(label);
      },
    };
    // `toLinkable` so a wire can be dropped anywhere on a block, not only on the
    // 9px rail at its edge — miss the rail and the drop used to fall back to
    // gravity-snapping, which is why several wires ended up sharing one point.
    // The drop is projected onto the nearest edge afterwards (see setWireEnd).
    //
    // `fromLinkable` stays false: the body is what you grab to move the block,
    // and making it a source would start a wire instead of a drag.
    const body = { portId: '', fromLinkable: false, toLinkable: true, cursor: 'move' };
    const sizeBind = () => new go.Binding('desiredSize', 'size',
      (s: string) => (s ? go.Size.parse(s) : new go.Size(NaN, NaN))).makeTwoWay((sz: go.Size) => go.Size.stringify(sz));

    /**
     * Named pins, on their own overlay stretched across the node's body.
     *
     * They cannot share the panel that holds the label: a panel with an
     * itemArray keeps only its isPanelMain element when it rebuilds, so putting
     * them there deletes the label.
     *
     * Use it *after* the side rails. Both are hit targets and a rail spans the
     * whole edge, so whichever is declared last wins the hit test — with the
     * pins first, a drag that started on a pin produced a wire from the side
     * instead. The overlay must also stay pickable: it is the pins' own hit
     * area, and `pickable: false` on the panel silences the entire subtree,
     * which is what stopped a wire being drawn from a pin at all.
     *
     * A Spot panel positions its children against its *main* element, so the
     * overlay needs one the size of the body — without it every pin lands near
     * the middle of the block, which reads as wires escaping from inside a chip
     * rather than from its edge. `stretch: Fill` is what lets one overlay serve
     * every template: it takes the size of the node's own main element. Sizing
     * it from `data.size` instead only works for nodes that carry an explicit
     * size, which a group — sized by its members — never does.
     */
    const pinOverlay = () => $(
      go.Panel, 'Spot',
      { itemTemplate: pinPort, stretch: go.GraphObject.Fill },
      new go.Binding('itemArray', 'ports'),
      $(go.Shape, 'Rectangle',
        { isPanelMain: true, fill: null, stroke: null, strokeWidth: 0, pickable: false,
          stretch: go.GraphObject.Fill }));

    const block = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, resizeObjectName: 'BODY', toolTip: hooks.nodeTip($),
        portSpreading: go.PortSpreading.Evenly, ...hover, ...editLabel },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Panel, 'Auto', body, { name: 'BODY' }, sizeBind(),
        $(go.Shape, 'RoundedRectangle',
          { parameter1: 10, fill: '#ffffff', stroke: '#d2d6dc', strokeWidth: 1.5, minSize: new go.Size(150, 52) },
          new go.Binding('stroke', 'color')),
        // The name and its icon are one lockup, and Alt-dragging moves it as
        // one — a block's icon belongs beside its name, wherever that is put.
        $(go.Panel, 'Horizontal', { margin: 8 }, ...placeable('labelSpot'),
          $(go.Panel, 'Auto', { width: 36, height: 36, margin: new go.Margin(0, 8, 0, 0) },
            $(go.Shape, 'RoundedRectangle', { parameter1: 8, strokeWidth: 0 }, new go.Binding('fill', 'color')),
            $(go.TextBlock, { font: '20px Material Icons', stroke: '#ffffff' }, new go.Binding('text', 'icon'))),
          $(go.Panel, 'Vertical', { alignment: go.Spot.Left },
            // A formatted label is drawn by the stack below instead.
            $(go.TextBlock,
              { name: 'LABEL', font: '600 12.5px Roboto, sans-serif', stroke: '#1f2937',
                editable: true, alignment: go.Spot.Left },
              new go.Binding('visible', 'html', (h) => !isRich(h)),
              new go.Binding('text').makeTwoWay(),
              ...labelStyle()),
            richStack($),
            $(go.TextBlock, { font: '10px Roboto, sans-serif', stroke: '#9aa0a8', alignment: go.Spot.Left },
              new go.Binding('text', 'subtitle')))),
        // A status marker on the block: the drawings put a round badge at the end
        // of every part-number row.
        $(go.Panel, 'Spot', { visible: false, alignment: new go.Spot(1, 0.5, -13, 0) },
          new go.Binding('visible', 'badge', (b) => !!b),
          new go.Binding('alignment', 'badgeSpot', go.Spot.parse),
          $(go.Shape, 'Circle', { width: 18, height: 18, fill: '#f5a623', stroke: null },
            new go.Binding('fill', 'badgeFill'),
            new go.Binding('desiredSize', 'badgeSize', go.Size.parse)),
          $(go.TextBlock, { font: '700 11px Roboto, sans-serif', stroke: '#ffffff' },
            new go.Binding('text', 'badge'),
            new go.Binding('stroke', 'badgeColor'),
            new go.Binding('font', 'badgeFont')))),
      ...sidePorts(),
      pinOverlay(),
      wireDot(),
    );
    diagram.nodeTemplateMap.set('block', block);
    diagram.nodeTemplate = block;

    const part = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, resizeObjectName: 'BODY', toolTip: hooks.nodeTip($),
        portSpreading: go.PortSpreading.Evenly, ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Panel, 'Auto', body, { name: 'BODY' }, sizeBind(),
        $(go.Shape, 'RoundedRectangle', { parameter1: 10, fill: '#ffffff', stroke: '#d2d6dc', strokeWidth: 1.5 }),
        $(go.Panel, 'Table', { margin: 12, minSize: new go.Size(216, 0) },
          $(go.RowColumnDefinition, { column: 0, stretch: go.GraphObject.Horizontal }),
          $(go.Shape, 'Rectangle',
            { row: 0, column: 0, columnSpan: 2, height: 4, strokeWidth: 0, fill: '#1d4ed8', stretch: go.GraphObject.Horizontal, margin: new go.Margin(0, 0, 6, 0) }),
          $(go.TextBlock,
            { row: 1, column: 0, font: '700 13px Roboto, sans-serif', stroke: '#111827', editable: true, alignment: go.Spot.Left },
            new go.Binding('text').makeTwoWay()),
          $(go.Picture, { row: 1, column: 1, rowSpan: 2, width: 48, height: 48, imageStretch: go.GraphObject.Uniform },
            new go.Binding('source', 'img')),
          $(go.TextBlock, { row: 2, column: 0, font: '10.5px Roboto, sans-serif', stroke: '#6b7280', alignment: go.Spot.Left },
            new go.Binding('text', 'supplier')),
          $(go.Panel, 'Vertical', { row: 3, column: 0, columnSpan: 2, alignment: go.Spot.Left, margin: new go.Margin(4, 0, 0, 0) },
            new go.Binding('itemArray', 'specs'),
            { itemTemplate: $(go.Panel, 'Auto', { alignment: go.Spot.Left },
                $(go.TextBlock, { font: '10.5px Roboto, sans-serif', stroke: '#374151', alignment: go.Spot.Left },
                  new go.Binding('text', ''))) }))),
      ...sidePorts(),
      pinOverlay(),
      wireDot(),
    );
    diagram.nodeTemplateMap.set('part', part);

    const image = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, resizeObjectName: 'PIC', portSpreading: go.PortSpreading.Evenly, ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Panel, 'Vertical', body,
        $(go.Picture, { name: 'PIC', width: 120, height: 90, imageStretch: go.GraphObject.Uniform },
          new go.Binding('source', 'img'),
          sizeBind()),
        $(go.TextBlock, { font: '11px Roboto, sans-serif', stroke: '#94a3b8', editable: true, margin: new go.Margin(4, 0, 0, 0) },
          new go.Binding('text').makeTwoWay())),
      ...sidePorts(),
      pinOverlay(),
      wireDot(),
    );
    diagram.nodeTemplateMap.set('image', image);

    const shape = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, resizeObjectName: 'SHAPE', toolTip: hooks.nodeTip($),
        portSpreading: go.PortSpreading.Evenly, ...hover, ...editLabel },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Panel, 'Spot', body,
        $(go.Shape, 'Rectangle',
          { name: 'SHAPE', isPanelMain: true, strokeWidth: 2, fill: '#ffffff', stroke: '#334155',
            minSize: new go.Size(48, 40) },
          new go.Binding('figure', 'figure'),
          sizeBind(),
          new go.Binding('fill', 'fill'),
          new go.Binding('stroke', 'stroke'),
          // Whole data object, not `minSize`: a formatted label raises the floor.
          new go.Binding('minSize', '', shapeMinSize),
          new go.Binding('strokeWidth', 'strokeWidth'),
          // A dashed outline means "not fitted / optional" on a schematic —
          // test points, a debug LED string — so it carries meaning and has to
          // survive a round trip through the model.
          new go.Binding('strokeDashArray', 'dashPattern',
            (v) => (v === true ? [5, 4] : Array.isArray(v) ? v : null))),
        // A formatted label is drawn by the stack below instead.
        $(go.TextBlock,
          { name: 'LABEL', editable: true, font: '600 12.5px Roboto, sans-serif', stroke: '#1f2937',
            textAlign: 'center', maxSize: new go.Size(150, NaN), margin: 6 },
          new go.Binding('visible', 'html', (h) => !isRich(h)),
          new go.Binding('text').makeTwoWay(),
          ...labelStyle(),
          ...placeable('labelSpot')),
        richStack($, ...placeable('labelSpot')),
        // A status marker on the block: the drawings put a round badge at the end
        // of every part-number row.
        $(go.Panel, 'Spot', { visible: false, alignment: new go.Spot(1, 0.5, -13, 0) },
          new go.Binding('visible', 'badge', (b) => !!b),
          new go.Binding('alignment', 'badgeSpot', go.Spot.parse),
          $(go.Shape, 'Circle', { width: 18, height: 18, fill: '#f5a623', stroke: null },
            new go.Binding('fill', 'badgeFill'),
            new go.Binding('desiredSize', 'badgeSize', go.Size.parse)),
          $(go.TextBlock, { font: '700 11px Roboto, sans-serif', stroke: '#ffffff' },
            new go.Binding('text', 'badge'),
            new go.Binding('stroke', 'badgeColor'),
            new go.Binding('font', 'badgeFont'))),
        $(go.Panel, 'Auto', { alignment: go.Spot.TopRight, alignmentFocus: go.Spot.TopRight, margin: 3, visible: false },
          new go.Binding('visible', 'components', (c) => Array.isArray(c) && c.length > 0),
          $(go.Shape, 'RoundedRectangle', { parameter1: 4, fill: '#f5a623', stroke: null }),
          $(go.TextBlock, { font: '700 9px Roboto, sans-serif', stroke: '#1a1303', margin: new go.Margin(1, 5, 1, 5) },
            new go.Binding('text', 'components',
              (c) => !Array.isArray(c) || !c.length ? '' : (c.length === 1 ? c[0].partNumber : c.length + ' parts'))))),
      // Hidden until there is a caption to show. An empty TextBlock still
      // measures a line high, and this one hangs below the shape, so leaving it
      // on stretched every block's bounds ~19px past its own outline — which is
      // what put the selection outline and the hover markers off the box.
      $(go.TextBlock, { alignment: new go.Spot(0.5, 1, 0, 7), alignmentFocus: go.Spot.Top, visible: false,
        font: '10.5px Roboto, sans-serif', stroke: '#94a3b8', editable: true, textAlign: 'center', maxSize: new go.Size(170, NaN) },
        new go.Binding('text', 'sub').makeTwoWay(),
        new go.Binding('stroke', 'capColor'),
        new go.Binding('visible', 'sub', (s) => !!s && String(s).length > 0)),
      ...sidePorts(),
      pinOverlay(),
      wireDot(),
    );
    diagram.nodeTemplateMap.set('shape', shape);

    const rotatedSpots = (d: any): { x: number; y: number }[] => {
      const ports = Array.isArray(d?.ports) ? d.ports : [];
      const a = ((d?.angle || 0) % 360 + 360) % 360;
      return ports.map((p: any) => {
        const sp = go.Spot.parse(p?.spot || '0 0');
        if (a === 90) return { x: 1 - sp.y, y: sp.x };
        if (a === 180) return { x: 1 - sp.x, y: 1 - sp.y };
        if (a === 270) return { x: sp.y, y: 1 - sp.x };
        return { x: sp.x, y: sp.y };
      });
    };
    const placement = (d: any): 'below' | 'side' | 'below-left' => {
      const spots = rotatedSpots(d);
      const bottomBusy = spots.some((sp) => sp.y > 0.85 && sp.x > 0.2 && sp.x < 0.8);
      if (!bottomBusy) return 'below';
      return spots.some((sp) => sp.x > 0.85) ? 'below-left' : 'side';
    };
    const labelAlign = (line: number) => (d: any) => {
      const pl = placement(d);
      if (pl === 'side') return new go.Spot(1, 0.5, 7, line === 0 ? -8 : 8);
      return new go.Spot(pl === 'below-left' ? 0.18 : 0.5, 1, 0, 5 + line * 14);
    };
    const labelFocus = (d: any) => placement(d) === 'side' ? go.Spot.Left : go.Spot.Top;
    const symbol = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, locationObjectName: 'BODY', selectionObjectName: 'BODY',
        resizable: true, resizeObjectName: 'BODY',
        toolTip: hooks.nodeTip($), ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      $(go.Panel, 'Spot',
        { name: 'BODY', isPanelMain: true, itemTemplate: pinPort, ...body },
        new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify),
        new go.Binding('angle', 'angle', (a) => (typeof a === 'number' && a % 90 === 0 ? a : 0)).makeTwoWay(),
        new go.Binding('itemArray', 'ports'),
        $(go.Picture, { isPanelMain: true, stretch: go.GraphObject.Fill,
          imageStretch: go.GraphObject.Fill, background: 'transparent' },
          new go.Binding('source', 'source'))),
      $(go.TextBlock, { font: 'bold 11px Roboto, sans-serif', stroke: '#94a3b8', editable: true },
        new go.Binding('text').makeTwoWay(),
        new go.Binding('stroke', 'labelColor'),
        new go.Binding('alignment', '', labelAlign(0)),
        new go.Binding('alignmentFocus', '', labelFocus)),
      $(go.TextBlock, { font: '10px Roboto, sans-serif', stroke: '#94a3b8', editable: true },
        new go.Binding('text', 'value').makeTwoWay(),
        new go.Binding('visible', 'value', (v) => !!v),
        new go.Binding('stroke', 'labelColor'),
        new go.Binding('alignment', '', labelAlign(1)),
        new go.Binding('alignmentFocus', '', labelFocus)),
    );
    diagram.nodeTemplateMap.set('symbol', symbol);

    const basicSym = $(
      go.Node, 'Spot',
      { locationSpot: go.Spot.Center, resizable: true, itemTemplate: pinPort, ...hover },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('desiredSize', 'size', go.Size.parse).makeTwoWay(go.Size.stringify),
      new go.Binding('visible', 'hidden', (h) => !h),
      new go.Binding('itemArray', 'ports'),
      $(go.Panel, 'Spot', { isPanelMain: true, stretch: go.GraphObject.Fill, ...body },
        $(go.Picture, { isPanelMain: true, stretch: go.GraphObject.Fill,
          imageStretch: go.GraphObject.Fill, background: 'transparent' },
          new go.Binding('source', 'source')),
        $(go.TextBlock, { alignment: go.Spot.Center, font: '13px Roboto, sans-serif', stroke: '#1f2937',
          editable: true, maxSize: new go.Size(160, NaN), textAlign: 'center' },
          new go.Binding('text').makeTwoWay(),
          new go.Binding('stroke', 'labelColor'),
          ...placeable('labelSpot'))),
    );
    diagram.nodeTemplateMap.set('basic', basicSym);

    diagram.linkTemplate = $(
      go.Link,
      // Wires render ABOVE blocks. A block diagram routinely puts a wire across
      // something: diagram 3 hangs its interface chips on the face of the
      // processor, so the last stretch of every wire into one crosses the
      // processor's fill, and underneath it the wire and its arrowhead simply
      // disappeared. Containers sit lower still (see the 'Containers' layer), so
      // a wire crossing a subsystem box is drawn over it, as the artwork does.
      //
      // What made this look unsafe before was hit testing, not drawing: a wire
      // lying across the edge it attaches to swallowed the drag that starts the
      // next wire from that point. That is fixed where it belongs, in the
      // linking tool's search for a port (see `findLinkablePort`).
      { layerName: 'Foreground',
        routing: go.Link.Orthogonal, corner: 8, relinkableFrom: true, relinkableTo: true, reshapable: true, resegmentable: true },
      // A hand-drawn wire says `manhattan` and goes *around* what is in its way:
      // a wire drawn straight through a block it has nothing to do with is the
      // one routing mistake a reader cannot forgive. An imported drawing carries
      // no routing at all and keeps plain orthogonal, so its wires stay exactly
      // where the artwork put them.
      new go.Binding('routing', 'routing', (r) => (r === 'normal' || r === 'smooth' ? go.Link.Normal
        : r === 'manhattan' || r === 'avoid' ? go.Link.AvoidsNodes : go.Link.Orthogonal)),
      new go.Binding('curve', 'routing', (r) => r === 'smooth' ? go.Link.Bezier : go.Link.None),
      new go.Binding('corner', 'wire', (w) => (w ? 0 : 8)),
      new go.Binding('corner', 'corner'),
      // Where this wire meets each block. Held on the wire, not on the block:
      // a connection point belongs to the connection, so drawing one is enough
      // to create it and nobody has to declare a pin up front. Absent, the
      // block's own port decides, which is what an imported drawing wants.
      // Spot.Default when absent, which hands the decision back to the port —
      // an imported drawing carries no per-wire spots and must keep using them.
      new go.Binding('fromSpot', 'fromSpotXY', (s) => (s ? go.Spot.parse(s) : go.Spot.Default)),
      new go.Binding('toSpot', 'toSpotXY', (s) => (s ? go.Spot.parse(s) : go.Spot.Default)),
      // How far a wire runs straight out of a block before it turns. It also
      // decides where the turn happens — orthogonal routing puts the crossbar
      // midway between the two end segments — so it is how two wires making the
      // same journey are kept off each other rather than drawn as one line.
      new go.Binding('fromEndSegmentLength', 'fromEnd'),
      new go.Binding('toEndSegmentLength', 'toEnd'),
      // The invisible grab area. 10, not 18: a wire is now drawn above the
      // blocks, so every pixel of this is a pixel of block you cannot press on.
      $(go.Shape, { isPanelMain: true, stroke: 'transparent', strokeWidth: 10 }),
      $(go.Shape, { isPanelMain: true, strokeWidth: 2, stroke: '#94a3b8' },
        new go.Binding('stroke', 'color'),
        new go.Binding('strokeWidth', 'width'),
        new go.Binding('strokeDashArray', 'dash')),
      $(go.Shape, { toArrow: 'Standard', fill: '#94a3b8', stroke: null },
        new go.Binding('fill', 'color'),
        new go.Binding('visible', 'wire', (w) => !w),
        // Arrowhead shape and size are part of a drawing's style, not a
        // constant. Without these an imported diagram gets this template's
        // arrowhead at whatever size the stroke happens to make it.
        new go.Binding('toArrow', 'arrow'),
        new go.Binding('scale', 'arrowScale')),
      // A second arrowhead at the *from* end, for a two-way connection. A bus
      // is bidirectional far more often than not — the source artwork draws 35
      // of its wires with 63 arrowheads between them — and with only one
      // arrowhead the reader is told a direction that is not true.
      $(go.Shape, { fromArrow: 'Backward', fill: '#94a3b8', stroke: null, visible: false },
        new go.Binding('fill', 'color'),
        new go.Binding('visible', 'twoWay', (t) => !!t),
        // GoJS orients a `fromArrow` along the link, so the same figure at both
        // ends gives two heads pointing the same way. The mirrored "Backward"
        // family is what makes it point outwards.
        new go.Binding('fromArrow', 'arrow', backwardArrow),
        new go.Binding('scale', 'arrowScale')),
      $(go.Panel, 'Auto',
        { segmentIndex: NaN, segmentFraction: 0.5, visible: false },
        new go.Binding('visible', 'text', (t) => !!t),
        // Where the label sits on the wire. A net name centred on a short
        // segment lands on top of the blocks at either end, so an imported
        // drawing needs to be able to slide it along the run and lift it clear.
        new go.Binding('segmentFraction', 'textFraction'),
        new go.Binding('segmentIndex', 'textSegment'),
        new go.Binding('segmentOffset', 'textOffset', go.Point.parse),
        $(go.Shape, 'RoundedRectangle', { parameter1: 4, fill: 'rgba(14,15,17,0.75)', stroke: null },
          new go.Binding('fill', 'textBg')),
        $(go.TextBlock, { font: '600 10px Roboto, sans-serif', stroke: '#e2e8f0', editable: true,
          margin: new go.Margin(1.5, 5, 1.5, 5) },
          new go.Binding('text').makeTwoWay(),
          new go.Binding('stroke', 'color'),
          // A net name on a schematic is plain text on the wire, not a chip.
          new go.Binding('stroke', 'textColor'),
          new go.Binding('font', 'textFont'))),
    );

    // Dropped on nothing: the block leaves whatever container it was in.
    diagram.mouseDrop = (e: go.InputEvent) => {
      const d = e.diagram;
      if (!d.commandHandler.addTopLevelParts(d.selection, true)) d.currentTool.doCancel();
    };

    diagram.addModelChangedListener((e) => { if (e.isTransactionFinished) hooks.updateJunctions(); });

    const styleLinking = (tool: go.LinkingBaseTool) => {
      tool.temporaryLink = $(go.Link,
        { routing: go.Link.Orthogonal, layerName: 'Tool' },
        $(go.Shape, { stroke: '#22d3ee', strokeWidth: 2 }));
      for (const port of [tool.temporaryFromPort, tool.temporaryToPort]) {
        if (!(port instanceof go.Shape)) continue;
        port.figure = 'Circle';
        port.desiredSize = new go.Size(14, 14);
        port.stroke = '#22d3ee';
        port.strokeWidth = 2;
        port.fill = null;
      }
      /**
       * Place the preview endpoints ourselves.
       *
       * The stock implementation copies the real port's size onto the temporary
       * one, which was fine while every port was a 9px dot. Now that a block's
       * whole face is a drop target, that meant a block-sized circle drawn on top
       * of the block you were dragging over. It also parks the preview at the
       * port's *centre*, so a wire drawn from the bottom of a tall block's edge
       * previewed from the middle and then jumped on release.
       */
      tool.portTargeted = (_node, port, temporarynode, temporaryport, toend) => {
        const link = tool.temporaryLink;
        const setSpot = (s: go.Spot) => { if (!link) return; if (toend) link.toSpot = s; else link.fromSpot = s; };
        if (!port || !temporarynode || !temporaryport) { setSpot(go.Spot.Default); return; }
        // Which end is under the pointer: the other one is anchored, either at
        // the point the drag started from or at the wire's existing endpoint.
        const moving = tool.isForwards === toend;
        const orig = tool.originalLink;
        let ref: go.Point | null;
        if (moving) {
          ref = diagram.lastInput?.documentPoint ?? null;
        } else if (orig && orig.pointsCount > 1) {
          ref = orig.getPoint(toend ? orig.pointsCount - 1 : 0).copy();
        } else {
          ref = hooks.wires.linkStart;
        }
        temporaryport.desiredSize = new go.Size(14, 14);
        temporarynode.locationSpot = go.Spot.Center;
        temporarynode.location = hooks.wires.tempPortPoint(port, ref);
        // Leave the preview in the same direction the finished wire will, so the
        // route does not change shape the instant the mouse comes up.
        setSpot(hooks.wires.outwardSpot(port));
      };

      const act = tool.doActivate.bind(tool);
      const deact = tool.doDeactivate.bind(tool);
      tool.doActivate = () => {
        // The mouse-down that started the drag: the exact point on the edge the
        // user grabbed, which becomes this wire's connection point.
        hooks.wires.linkStart = diagram.firstInput?.documentPoint?.copy() ?? null;
        if (tool.temporaryLink) { tool.temporaryLink.fromSpot = go.Spot.Default; tool.temporaryLink.toSpot = go.Spot.Default; }
        act();
        hooks.showAllPins(true);
      };
      tool.doDeactivate = () => { deact(); hooks.showAllPins(false); };
    };
    styleLinking(diagram.toolManager.linkingTool);
    styleLinking(diagram.toolManager.relinkingTool);

    const linkTool = diagram.toolManager.linkingTool;

    /**
     * A wire can only be *started* from something marked `fromLinkable`.
     *
     * GoJS defaults to `Either`, which also lets a drag begin on a to-linkable
     * port and draw the link backwards. A block's body is deliberately
     * to-linkable — that is what lets a wire be dropped anywhere on it — so with
     * the default, pressing a block anywhere started a backwards wire instead of
     * picking the block up, and nothing on the canvas could be moved. Nothing is
     * lost by forbidding it: every port here is linkable in both directions, so
     * any wire you could draw backwards you can draw forwards.
     */
    linkTool.direction = go.LinkingDirection.ForwardsOnly;

    /**
     * Whether a press starts a wire is decided by where it landed, not by what
     * happens to be pickable there.
     *
     * The rails are not pickable, deliberately: an invisible stripe lying over
     * a block took the press meant for the block, and on a small block that is
     * every press. So the search is done by arithmetic instead — a press within
     * reach of an edge starts a wire from that edge, and a press anywhere else
     * on the block is the block being picked up. It also steps past a wire
     * lying over the very point you grabbed, which used to make the second wire
     * out of a point silently do nothing.
     */
    const findPort = linkTool.findLinkablePort.bind(linkTool);
    linkTool.findLinkablePort = () => {
      const direct = findPort();
      if (direct && direct.fromLinkable === true) return direct;
      const pt = diagram.firstInput?.documentPoint;
      if (!pt) return null;
      const node = diagram.findObjectAt(pt, (x: go.GraphObject) => x.part,
        (q: go.GraphObject) => q instanceof go.Node) as go.Node | null;
      return node ? railPortAt(node, pt) : null;
    };

    // A subsystem container. The defaults are the dashed amber box the palette
    // creates; every visual is overridable from the data so an imported drawing
    // can carry its own containers (a solid black "Power System", a blue
    // "Flight Controller"), which one hard-coded style cannot express.
    // Containers go below the wires, which are themselves below the blocks.
    //
    // A wire crossing a subsystem box is drawn over it in every block diagram
    // there is — the source artwork runs four wires straight across a black
    // "Power System" panel and a grey ESC enclosure. With containers in the same
    // layer as blocks, the container's fill painted over the wires inside it and
    // the last stretch of each wire, arrowhead included, simply vanished.
    //
    // Wires still sit below *blocks*, which is what stops a wire's invisible
    // hit stroke stealing the drag that starts the next wire from the same edge.
    const bg = diagram.findLayer('Background');
    if (bg && !diagram.findLayer('Containers')) {
      diagram.addLayerBefore(new go.Layer({ name: 'Containers' }), bg);
    }
    diagram.groupTemplate = $(
      go.Group, 'Spot',
      { layerName: 'Containers',
        // A wire routing around blocks must still be free to cross a subsystem
        // box — every block diagram runs wires straight across one, and a wire
        // detouring around a whole enclosure to reach something inside it would
        // be far worse than the crossing it avoided.
        avoidable: false,
        locationSpot: go.Spot.Center, ungroupable: true, computesBoundsAfterDrag: true,
        handlesDragDropForMembers: true, portSpreading: go.PortSpreading.Evenly,
        // Dropping a block on a container puts it inside. `handlesDragDropForMembers`
        // only says the group handles the gesture; something still has to add the
        // member. GoJS routes a drop that lands on a part to that part's handler,
        // so this is where it arrives — `diagram.mouseDrop` only sees the misses.
        mouseDrop: (_e: go.InputEvent, grp: go.GraphObject) => {
          if (!(grp instanceof go.Group) || !grp.diagram) return;
          if (!grp.addMembers(grp.diagram.selection, true)) grp.diagram.currentTool.doCancel();
        } },
      new go.Binding('location', 'loc', go.Point.parse).makeTwoWay(go.Point.stringify),
      new go.Binding('isSubGraphExpanded', 'expanded').makeTwoWay(),
      $(go.Panel, 'Auto',
        $(go.Shape, 'RoundedRectangle',
          { parameter1: 12, fill: 'rgba(148,163,184,0.05)', stroke: '#f5a623',
            strokeWidth: 1.2, strokeDashArray: [7, 4] },
          new go.Binding('parameter1', 'corner'),
          new go.Binding('fill', 'fill'),
          new go.Binding('stroke', 'stroke'),
          new go.Binding('strokeWidth', 'borderWidth'),
          // A container is sized by what is inside it, which leaves one you
          // have just drawn — and so has nothing inside — a box too small to
          // aim at. A floor gives it a size of its own until it has members,
          // and is what the Width and Height fields write.
          new go.Binding('minSize', 'minSize', go.Size.parse),
          // Only an explicit `dashed: false` makes the border solid, so an
          // existing group with no styling data keeps its dashed look.
          new go.Binding('strokeDashArray', 'dashed', (v) => (v === false ? null : [7, 4]))),
        $(go.Placeholder, { padding: new go.Margin(30, 16, 16, 16) },
          new go.Binding('padding', 'pad', (p: string) => go.Margin.parse(p)))),
      $(go.Panel, 'Auto',
        // A container's title is placeable the same way a block's name is, and
        // writes the same field the Title position control does.
        { alignment: new go.Spot(0, 0, 10, 8), alignmentFocus: go.Spot.TopLeft, [NAME_FIELD]: 'titleAlign' },
        new go.Binding('alignment', 'titleAlign', (s: string) => go.Spot.parse(s)),
        new go.Binding('alignmentFocus', 'titleFocus', (s: string) => go.Spot.parse(s)),
        // A band behind the title, for the drawings that give a subsystem a
        // coloured header strip rather than bare text on the fill.
        $(go.Shape, 'Rectangle', { fill: null, stroke: null, strokeWidth: 0 },
          new go.Binding('fill', 'titleBg'),
          new go.Binding('stroke', 'titleBorder'),
          new go.Binding('strokeWidth', 'titleBorder', (b) => (b ? 1 : 0)),
          new go.Binding('desiredSize', 'titleSize2', go.Size.parse)),
        // No padding by default, so a container with no band keeps its title
        // exactly where it was; `titlePad` is what opens the band out.
        $(go.Panel, 'Horizontal', { margin: new go.Margin(0, 0, 0, 0) },
          new go.Binding('margin', 'titlePad', (p: string) => go.Margin.parse(p)),
          $('SubGraphExpanderButton', { margin: new go.Margin(0, 6, 0, 0), visible: false },
            new go.Binding('visible', 'collapsible')),
          $(go.TextBlock, { font: 'bold 12px Roboto, sans-serif', stroke: '#f5a623', editable: true },
            new go.Binding('text').makeTwoWay(),
            new go.Binding('stroke', 'titleColor'),
            new go.Binding('font', 'titleFont')))),
      // Containers are wired to in a block diagram ("power in on the left"), so
      // they need the same four ports every node has.
      ...sidePorts(),
      pinOverlay(),
      wireDot(),
    );
    diagram.commandHandler.archetypeGroupData = { isGroup: true, text: 'Subsystem' };
}
