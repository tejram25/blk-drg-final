# Layered block diagram — drill-down POC

Proves the stakeholder ask (Siraj, "FW: Request for Feedback on Block Diagram
Tool POC"): **several layers — system (devices) → subsystem (boards) → board
(components) — connected inside one project**, plus an extended component
library. Built on the same GoJS the app uses.

## What it demonstrates

- **Drill-down.** Double-click a block (or click its ⤢ badge) to open the
  level it owns. The one canvas swaps to that level's model — GoJS is a view
  over a model, so a level *is* a model and drilling is a model swap.
- **Breadcrumb.** The path bar tracks System → Subsystem → Board; click any
  crumb to jump back up. Edits on each level are kept as you navigate.
- **Author layers, don't just navigate them.** Double-click a block with no
  child and it creates a new empty level and drills in — this is how you *build*
  the hierarchy, not only browse a seeded one.
- **Extended library.** A categorised palette (Systems/devices, Boards/
  subsystems, Board components); drag or click to add.

## Run it

```bash
npm install          # pulls gojs only
# then open drill-down-poc.html in a browser
```

`drill-down-poc.html` loads `./node_modules/gojs/release/go.js` relatively, so
`npm install` in this folder is all it needs.

## How it maps to production

Feasible with **no GoJS limitation** — the mechanism is entirely in the model
layer, which the app already swaps on load/import. The real work is app
plumbing: a `childDiagramId` on a block, open-on-double-click, a breadcrumb, and
a *project* that owns the tree of diagrams (persisted server-side). Nothing here
needs a GoJS feature the app doesn't already use.
