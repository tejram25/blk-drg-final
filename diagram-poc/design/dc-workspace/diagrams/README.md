# Stakeholder diagrams

Two diagrams, authored as GoJS model JSON so they open in the block-diagram
editor itself rather than in a separate drawing tool. They are the visual
companion to [architecture.md](../architecture.md),
[data-model.md](../data-model.md) and [stakeholder-qa.md](../stakeholder-qa.md).

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
| **Cylinder** | Stored data — an Oracle schema, a table, the lakehouse |
| Cloud | A system outside Arrow's control |
| Parallelogram | A data feed arriving from somewhere else |
| Rectangle | A step in the flow |
| Diamond | A decision |

`01-architecture` carries this legend on the canvas, in the right margin.

## Line vocabulary

| Line | Meaning |
|---|---|
| Solid grey | A call — one component asking another for something |
| Dashed grey | An embed (iframe), a read-only view, or an inbound feed |
| **Amber, thicker** | The Databricks data feed |
| **Orange, thicker** | The customer-facing path — anything on this line is visible outside Arrow |

The orange run is the one to point at in a security conversation: it starts at
the sales rep and ends at a database *view*, never at a table.

## Colour

Arrow's six brand colours, used consistently across both files:

| Colour | Used for |
|---|---|
| Black `#000000` | People, shared services, titles |
| Sky Blue `#0084D5` | Design Workspace (DWS) |
| Patina Green `#47D7AC` | Block Diagram (BLK) |
| Copper Yellow `#FFC845` | Oracle. Filled copper = Databricks, to mark it as a different system in the same family |
| Solar Orange `#FF8674` | Salesforce and the customer-facing surface |
| White `#FFFFFF` | Shape fills |

## Talk track

**Diagram 1 — architecture.** Read it in four moves:

1. **Top band** — the FAE designs in DWS; the BLK editor is embedded in DWS by
   an iframe; the render service turns a diagram into PDF bytes.
2. **Middle** — two cylinders, one Oracle instance. Each service writes only
   its own schema. BLK reaches DWS data by *posting to the API*, never by
   INSERT; DWS reads BLK data through a versioned read-only view.
3. **Analytics** — the outbox is written in the same transaction as the change,
   so the feed cannot miss an event. Databricks holds linkage, metadata and
   semantics — never artifact bytes. The two parallelograms are feeds the data
   platform team already runs; we neither own nor duplicate them.
4. **Bottom band** — the customer-facing path, deliberately drawn separately.
   It flows right to left and terminates in `v_published_artifact_v1`. Three
   things must be true before anything reaches a customer, and the database
   enforces all three.

**Diagram 2 — end-to-end flow.** Five lanes, top to bottom in time. The two
decisions are the ones worth pausing on: *"linked to an opportunity?"* (no is a
valid answer — ad-hoc designs are supported) and *"approver publishes it?"*
(no leaves the artifact DRAFT and internal forever).

## Regenerating

Both files are generated, not hand-edited:

```
node build.js
```

`build.js` also runs a geometry check — it fails if any two nodes overlap or a
link points at a missing node. Edit the script, not the JSON, or the next
regeneration will discard your changes.

Layout is deliberately hand-placed rather than auto-laid-out: an automatic
layout re-flows on every change, which is exactly what you do not want in a
diagram people have already reviewed.
