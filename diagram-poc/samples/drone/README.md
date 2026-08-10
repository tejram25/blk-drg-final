# Drone reference block diagrams

Replicas of the diagrams in Arrow's *Design Playbook for Architecting Advanced
Drone Systems*, built as **GoJS models the editor can open** — the point is to
prove the diagramming app can reproduce production artwork with its own
components, not to draw pictures.

| File | What it is |
|---|---|
| `01-drone-top-level.gojs.json` | Diagram 1 — top-level drone + ground controller. Load straight into the editor |
| `build-01-drone-top-level.mjs` | Generator that emits it. Coordinates are measured from the source artwork |
| `render-harness.html` · `render.mjs` · `figures.json` | Headless renderer for verifying a model without the Angular app |
| `01-drone-top-level.png` | Current render |

## Regenerate and render

```bash
cd diagram-poc/samples/drone
node build-01-drone-top-level.mjs                                  # → .gojs.json
node render.mjs 01-drone-top-level.gojs.json 01-drone-top-level.png 2
```

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
   data-driven, along with `font` / `textWidth` / `strokeWidth` on shapes.
