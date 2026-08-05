# Stakeholder diagrams

Two diagrams, authored as GoJS model JSON so they open in the block-diagram
editor itself rather than in a separate drawing tool. They are the visual
companion to [architecture.md](../architecture.md),
[data-model.md](../data-model.md) and [stakeholder-qa.md](../stakeholder-qa.md).

Both are **functional**: they name capabilities and business steps, never
tables, columns, views or endpoints. That detail belongs in
[data-model.md](../data-model.md), and `build.js` fails the build if it leaks
back onto the canvas.

| File | What it shows |
|---|---|
| `01-architecture.gojs.json` | Every system, who owns it, and how they connect |
| `02-end-to-end-flow.gojs.json` | One design from creation to a customer seeing the PDF |

## Opening one

In the editor: **File ▸ Import ▸ Import JSON**, pick the file, then
**zoom to fit** (the button at the bottom-right of the canvas, or Ctrl+Shift+F).

Set the diagram name in the title field before presenting — it is what shows in
the header. Nothing else needs configuring; colours, shapes and wiring all come
from the file.

## Shape vocabulary

Both diagrams use the same figures, so a shape means the same thing in each.

| Figure | Meaning |
|---|---|
| Stadium (terminator) | A person, or the start/end of a flow |
| Display | A screen a user looks at |
| Predefined process (bars on both sides) | A service or deployable component |
| **Cylinder** | Stored data — workspace data, diagram data, the change feed, the lakehouse |
| Cloud | A system outside Arrow's control |
| Parallelogram | A data feed arriving from somewhere else |
| Rectangle | A step in the flow |
| Diamond | A decision |

`01-architecture` carries this legend on the canvas, in the right margin.

## Line vocabulary

| Line | Meaning |
|---|---|
| Solid grey | A call — one component asking another for something |
| Dashed grey | A micro-frontend boundary, a read-only view, or an inbound feed |
| **Amber, thicker** | The Databricks data feed |
| **Orange, thicker** | The customer-facing path — anything on this line is visible outside Arrow |

The orange run is the one to point at in a security conversation: it starts at
the sales rep and every branch of it terminates in a server-side filter, so a
draft cannot be reached even by asking for it directly.

## Colour

Arrow's six brand colours, used consistently across both files:

| Colour | Used for |
|---|---|
| Black `#000000` | People, shared services, titles |
| Sky Blue `#0084D5` | Design Workspace (DWS) |
| Patina Green `#47D7AC` | Block Diagram (BLK) |
| Copper Yellow `#FFC845` | Stored data. Filled copper = Databricks, to mark it as a different system in the same family |
| Solar Orange `#FF8674` | Salesforce and the customer-facing surface |
| White `#FFFFFF` | Shape fills |

## Talk track

**Diagram 1 — architecture.** Read it in four moves:

1. **Top band** — the FAE designs in the workspace; the block diagram editor
   runs *inside* it as a micro-frontend, not as a separate app; the export
   service turns a diagram into a PDF and a preview image.
2. **Middle** — two cylinders, one database. Each side owns its own area and
   writes only that. The diagram side reaches workspace data by handing files
   to the workspace services, never by writing across; the workspace reads
   diagram data read-only.
3. **Analytics** — the change feed is written in the same step as the change,
   so it cannot miss anything. Databricks holds linkage, metadata and meaning —
   never the files. The two parallelograms are feeds the data platform team
   already runs; we neither own nor duplicate them.
4. **Bottom band** — the customer-facing surface, deliberately drawn
   separately, and this is where the **two levels of micro-frontend** are:
   Salesforce hosts the workspace view (level 1), and the workspace view hosts
   the block diagram canvas (level 2). The rep sees a preview image per
   approved design; clicking one opens the canvas read-only, still nested. Both
   the preview list and the canvas are filtered on the server, so an
   unapproved design is not merely hidden — it is never returned.

**Diagram 2 — end-to-end flow.** Five lanes, top to bottom in time. Three
places worth pausing on:

- *"Linked to a Salesforce opportunity?"* — **no** is a valid answer. Ad-hoc
  designs are supported.
- *"Approver publishes it?"* — **no** leaves it a draft, internal forever.
- The tail: **preview image → click → canvas**, both levels nested, both
  server-filtered.

## Regenerating

Both files are generated, not hand-edited:

```
node build.js
```

`build.js` also checks the output and fails on any of three things: two nodes
overlapping, a link pointing at a node that does not exist, or implementation
detail (SQL, schema-qualified names, view names, URL paths, HTTP verbs) leaking
into a label. Edit the script, not the JSON, or the next regeneration will
discard your changes.

Layout is deliberately hand-placed rather than auto-laid-out: an automatic
layout re-flows on every change, which is exactly what you do not want in a
diagram people have already reviewed.
