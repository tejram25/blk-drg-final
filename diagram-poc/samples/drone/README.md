# Drone reference block diagrams

Replicas of the diagrams in Arrow's *Design Playbook for Architecting Advanced
Drone Systems*, built as **GoJS models the editor can open** — the point is to
prove the diagramming app can reproduce production artwork with its own
components, not to draw pictures.

| File | What it is |
|---|---|
| `01-drone-top-level.gojs.json` | Diagram 1 — top-level drone + ground controller. Load straight into the editor |
| `02-battery-charger.gojs.json` | Diagram 2 — battery with charger |
| `03-flight-controller.gojs.json` | Diagram 3 — flight controller (70 blocks, 57 nets) |
| `04-key-suppliers.gojs.json` | Diagram 4 — resources from key suppliers (90 blocks, 55 nets) |
| `build-01-…mjs` · `build-02-…mjs` | Generators. Coordinates are measured from the source artwork |
| `add-pins.mjs` | Turns the routed wire endpoints into named pins. Run after a generator |
| `tidy-wires.mjs` | Straightens near-straight runs and pulls apart overlapping wires |
| `render-harness.html` · `render.mjs` · `figures.json` | Headless renderer for verifying a model without the Angular app |
| `01-drone-top-level.png` | Current render |

## Regenerate and render

```bash
cd diagram-poc/samples/drone
node build-01-drone-top-level.mjs                                  # → .gojs.json
node add-pins.mjs 01-drone-top-level.gojs.json --write             # endpoints → pins
node tidy-wires.mjs 01-drone-top-level.gojs.json --write           # straighten + separate
node render.mjs 01-drone-top-level.gojs.json 01-drone-top-level.png 2
```

A generator writes wires against the **edge rails** — "leave from the right
side" — and lets GoJS spread however many share a side along it. That routes
correctly but leaves nothing to grab: the connection points are computed, not
stored. `add-pins.mjs` reads back the geometry GoJS produced and writes it into
the model, so every wire ends on a pin that can be seen, dragged or deleted.
Nothing moves — it is checked by rendering before and after and diffing every
endpoint — and it is safe to re-run, since ends already on a pin are left alone.

`tidy-wires.mjs` then fixes the two things that make correct wiring still look
hand-made, both of which come from the router rather than the layout:

- **Doglegs.** Orthogonal routing turns a 1 px difference between two nearly
  aligned pins into a full S-bend. A wobble in a line that is meant to be
  straight is the single most obvious tell. Runs within 6 units of straight get
  one pin nudged so they are exactly straight; an L-shaped run, whose ends face
  along different axes, is left alone because it is *meant* to bend.
- **Wires drawn as one.** Two wires making the same journey get the same
  crossbar position and overlap for part of their length, reading as one line
  that somehow has two arrowheads. The source artwork nests them — of two wires
  between the same pair of columns, the one travelling furthest turns first — so
  this writes `fromEnd` (`Link.fromEndSegmentLength`) to do the same.

Across the four diagrams that was 45 doglegs and 11 overlapping pairs; both are
now zero, and a second run finds nothing to do.

### Wire geometry, measured against the source

The numbers below are read out of the PDF's own drawing operators, not
eyeballed:

| | Source artwork | Ours |
|---|---|---|
| Stroke | `w=1.50`, `#B3B3B3` | `width: 1.5`, `#A6AAAD` |
| Corners | miter join, no curves | `corner: 0` |
| Arrowhead | plain 3-point triangle, 10.4 × 12.0 pt | `Triangle`, 9.2 × 10.6 units — the same, to within 3% of block width |
| Route | `M L L L`: out, across, in | identical, two bends |

The renderer needs a Chromium and a Playwright install; override the built-in
paths with `CHROMIUM_PATH` / `PLAYWRIGHT_PATH` if yours differ.

## Why the generator, not hand-written JSON

The model is ~30 nodes and ~16 links whose positions all derive from one set of
measurements. Editing that by hand means re-deriving every centre point when a
box moves. The generator takes the measured rectangle (`x, y, w, h` straight off
the artwork) and does the centre/size conversion, so a correction is a one-line
change.

## Fidelity notes

**Type.** The source PDF is set in **ArrowDisplay** (confirmed from its embedded
font table). The renderer inlines the tracked `react-native-app/assets/fonts`
copies. Without the real face the headless browser falls back silently and every
label comes out the wrong width — the failure is easy to miss because it still
looks like a diagram.

**Two figures were added to the palette** because nothing in the library was
close: `FcPropMotor` (motor with propeller) and `FcAntennaCurl` (antenna). These
are our geometry approximating the original art, not traced vectors.

**Colours are `fixedColor: true`.** The editor's `retheme()` rewrites `fill`,
`stroke` and `labelColor` on every `shape` node when the canvas theme changes;
without the flag the imported palette is overwritten the moment the model loads.

## Editor changes this work required

Reproducing the artwork exposed four places where the templates assumed a
diagram was drawn by hand rather than imported:

1. **`minSize: 48x40` on the shape template** silently stretched every 30 px
   chip to 40 px, and inflated the containers around them. Now bindable.
2. **Groups had no ports.** A link addressed to `T`/`R`/`B`/`L` on a container
   fell back to the group's bounds, so container wiring routed at random.
   Groups now carry the same four ports as nodes.
3. **One hard-coded group style** (dashed amber). Containers are now
   data-driven — fill, border, solid/dashed, title colour, font and placement —
   so a solid black "Power System" and a blue "Flight Controller" are
   expressible. Groups with no styling data keep the old dashed look.
4. **Arrowheads were fixed.** `arrow`, `arrowScale` and link `corner` are now
   data-driven, along with `font` / `textAlign` / `textWidth` / `strokeWidth` on
   shapes, and `textFont` / `textBg` on link labels.
5. **A shape had exactly four ports.** A block diagram routinely needs more — a
   connector with three signal rows, an SoC with a dozen interfaces — so a shape
   can now declare pins at arbitrary spots via `ports`, like the symbol
   template. They live on their own overlay panel: a GoJS panel with an
   `itemArray` keeps only its `isPanelMain` element when it rebuilds, so putting
   the pins beside the label silently deletes the label.
6. **Dashed outlines** (`dashPattern`) — "not fitted / optional" on a schematic
   is meaning, not decoration, and has to survive a round trip.

## Doing this by hand

Everything these generators write is also reachable from the editor's UI — the
JSON is a shortcut, not a separate authoring path. With a block selected, the
properties panel carries:

| Control | Writes | Used by |
|---|---|---|
| Fill · Border · Border width | `fill` `stroke` `strokeWidth` | every coloured block |
| Solid / dashed outline | `dashPattern` (`dashed` on a container) | Test Points, LEDs, the DRONE boundary |
| Label colour · size · align | `labelColor` `font` `textAlign` | every label; align matters for the protection list |
| Width · Height | `size` (+ `minSize`) | the exact block dimensions the artwork uses |
| Title colour · position | `titleColor` `titleAlign` | "Power System" bottom-centre, "Flight Controller" centred |
| Connection pins | `ports` | the Type-C signal rows, the processor's memory buses |

and the wire dock carries colour, style, width, routing, **corners**,
**arrowhead** and **arrow size** (`corner`, `arrow`, `arrowScale`).

Whatever you set on the wire dock becomes the style **every wire drawn after it**
is given, and it survives a reload. Selecting an existing wire still shows that
wire's own settings — so editing it is accurate — but it does not change what the
next wire you draw looks like.

Pins are shown on every kind of node: shapes, blocks, parts, images and
containers. A container's pins matter as much as a block's — diagram 1 wires the
antenna into the "Communication Systems" box, not into anything inside it. A pin
marker sits wholly *inside* the block with its outer edge on the outline, so the
wire meets the block; centred on the outline, as it used to be, every wire on a
pin stopped half a marker short of the block it was drawn to.

A run drawn within a few pixels of straight is snapped straight as you release
it. A run that genuinely bends is left alone — the two ends have to face along
the same axis for the snap to apply at all.

Each side of a block is a **connection rail**, not a single point. Drag from
anywhere on an edge and the wire keeps the point you dropped it on — the
connection point is created by drawing it, and is stored on the wire
(`fromSpotXY` / `toSpotXY`) rather than declared on the block. Nothing has to be
set up first, and two wires on one edge cannot land on top of each other.

`ports` on a block is now only for **named** pins — a connection that has to
stay put and be referred to, like the labelled interfaces on the processor in
diagram 3. A wire dropped on one of those keeps the pin's position instead of
its own.

Two behaviours worth knowing:

- Setting any colour by hand also sets `fixedColor`. `retheme()` rewrites
  fill/stroke on every shape when the canvas theme flips, so without it your
  choice would silently revert the next time someone toggled the theme.
- Removing a pin repoints any wire that was landing on it to the nearest side,
  rather than letting the link detach to the node's centre.
