# Context brief — Design Workspace × Block Diagram × Salesforce

Paste this into a new session to pick up the design work without re-deriving it.

---

## What is being built

Arrow FAEs design electronics for customer opportunities. Two web apps:

- **Design Workspace (DWS)** — the container. Projects, designs, documents,
  approval. This is where an FAE lives.
- **Block Diagram (BLK)** — a GoJS canvas for drawing the actual circuit /
  system block diagram. It runs **inside** DWS as a micro-frontend, not as a
  separate destination.

Stakeholders want a third surface: the **Salesforce opportunity page** shows an
embedded, read-only view of that opportunity's designs.

## The shape of it — two levels of embedding

This is the single most important idea and the one most often missed:

```
Salesforce opportunity page
└── Design Workspace view          ← embedding level 1, read-only
    └── Block diagram canvas       ← embedding level 2, read-only
```

The rep sees a **preview image per approved design**. Clicking one opens the
canvas, still nested. Both levels are filtered **on the server** — an unapproved
design is not hidden by the UI, it is never returned.

The same pattern already exists internally: the BLK editor is embedded in DWS.
So Salesforce is one more level of something already being built, not a new
architectural risk.

## Decisions already settled

| Question | Answer |
|---|---|
| Can a design exist without an opportunity? | **Yes.** Ad-hoc designs are in scope |
| Does an FAE edit from inside Salesforce? | **No.** Embedded is read-only; editing undocks to a full page |
| Are final artefacts stored in Databricks? | **No** — they stay in the operational database. Databricks holds linkage, metadata and derived meaning only |
| Is user personalisation needed? | **No** — but identity is still stored, for entitlement and the approval audit trail |
| Who pushes to Databricks? | The app writes a change feed in the same transaction as the change; a platform ingest job reads it. Salesforce→Databricks already exists and is owned by the data platform team |

## Still open (biggest first)

1. **Where on the Salesforce page does the embed go?** Nobody named a location.
   A right rail is ~300px; a canvas needs ~900. If it is the right rail, the
   deliverable is a list of links, not a canvas.
2. Is framing an Arrow app inside Salesforce permitted at all? (Security.)
3. EU data residency. GoJS production licence. Independent framework versions
   across the two teams.
4. Do AI summaries/tags flow back into DWS or stay in Databricks?

## Visual language — use this, it is already agreed

**Arrow palette, six colours only:**

| Colour | Hex | Used for |
|---|---|---|
| Arrow Black | `#000000` | People, shared services, titles |
| White | `#FFFFFF` | Fills |
| Sky Blue | `#0084D5` | Design Workspace |
| Patina Green | `#47D7AC` | Block Diagram |
| Copper Yellow | `#FFC845` | Stored data (filled copper = Databricks) |
| Solar Orange | `#FF8674` | Salesforce and the customer-facing surface |

Font: `Arrow Display`, falling back to `Segoe UI`, `system-ui`, sans-serif.
In the deck: Cambria for headings, Calibri for body (both ship with Office).

**Shapes carry meaning** — same vocabulary in every artefact:

| Figure | Means |
|---|---|
| Stadium / terminator | A person, or the start/end of a flow |
| Display | A screen a user looks at |
| Predefined process (bars both sides) | A service or deployable component |
| **Cylinder** | Stored data |
| Cloud | A system outside Arrow's control |
| Parallelogram | A data feed from somewhere else |
| Rectangle | A step in a flow |
| Diamond | A decision |

**Lines:** solid grey = a call · dashed grey = an embedding boundary, a
read-only view, or an inbound feed · thicker amber = the data feed · thicker
orange = the customer-facing path.

## House rule for these artefacts

Diagrams and slides are **functional**. They name capabilities and business
steps — never tables, columns, views, endpoints or SQL. That detail lives in
`data-model.md`. Both generators fail the build if it leaks onto a canvas.

## What already exists

Branch `dc-workspace`, PR #1 on `tejram25/blk-drg-final`.

```
diagram-poc/design/dc-workspace/
├── architecture.md        systems, ownership, flows (mermaid)
├── data-model.md          the schema — implementation detail lives here
├── open-questions.md      grouped by who can answer, blockers marked
├── stakeholder-qa.md      round 1: asked, answered, still unclear
└── diagrams/
    ├── 01-architecture.gojs.json      opens in the BLK editor itself
    ├── 02-end-to-end-flow.gojs.json   (File ▸ Import ▸ Import JSON)
    ├── build.js                       generates both, checks geometry
    ├── flow_diagrams.pptx             4 slides for the stakeholder review
    ├── build-pptx.js                  generates the deck + an HTML preview
    └── README.md                      shape/line/colour vocabulary, talk track
```

Everything is generated, not hand-drawn. Edit the generator, not the output.
Layout is hand-placed on purpose — auto-layout re-flows on every change, which
is the last thing you want in a diagram people have already reviewed.

## Likely next design work

- The Salesforce embed itself: what a rep actually sees at 300px vs 900px.
- The preview-image grid inside the workspace view.
- The undock affordance — what "open in Design Workspace" looks like.
- The approval moment: who sees what before an artefact becomes customer-visible.
