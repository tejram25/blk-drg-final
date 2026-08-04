# DWS + Block Diagram + Salesforce — who does what

Companion to [data-model.md](./data-model.md). That one covers the tables; this
one covers the systems, the people, and the flows between them.

---

## 1. The landscape

```mermaid
flowchart LR
  subgraph people[People]
    FAE[FAE<br/>designs]
    APR[FAE manager<br/>approves]
    REP[Sales rep<br/>shares with customer]
  end

  subgraph sfdc[Salesforce]
    OPP[Opportunity page<br/>+ View Design button]
  end

  subgraph dws[Design Workspace ‒ DWS]
    DWSUI[DWS UI<br/>workspace + embed view]
    DWSAPI[DWS API<br/>designs · artifacts · publish]
  end

  subgraph blk[Block Diagram ‒ BLK]
    BLKUI[Editor UI<br/>GoJS canvas]
    BLKAPI[BLK API<br/>diagrams · versions · export]
  end

  subgraph data[Data]
    ORA[(Oracle<br/>DWS schema · BLK schema)]
    DBX[(Databricks<br/>context layer — metadata,<br/>linkage, semantics)]
  end

  subgraph ext[Shared services]
    IDP[Arrow IdP<br/>SSO]
    CAT[Part catalogue<br/>eu · ap · ac]
    RELAY[Collab relay<br/>y-websocket]
  end

  FAE --> DWSUI
  APR --> DWSUI
  REP --> OPP
  OPP -.iframe.-> DWSUI
  DWSUI -.iframe.-> BLKUI

  DWSUI --> DWSAPI
  BLKUI --> BLKAPI
  BLKAPI -- register artifact --> DWSAPI
  DWSAPI --> ORA
  BLKAPI --> ORA
  DWSAPI -- outbox --> DBX
  BLKAPI --> CAT
  BLKUI -.live edit.-> RELAY
  DWSUI --> IDP
  BLKUI --> IDP
```

Solid arrows are calls. Dotted arrows are embeds or sockets.

---

## 2. Who owns what

| Concern | Owner | Notes |
|---|---|---|
| Opportunity data (account, amount, stage) | **Salesforce** | Never copied into DWS |
| Opportunity ↔ design link | **DWS** | `design.opportunity_id`, the single link |
| Design record and its categories | **DWS** | Point 6 |
| Artifacts, publish state, approval | **DWS** | Point 5 |
| Artifact bytes | **DWS** | `artifact_file` |
| Diagram JSON and versions | **BLK** | BLK never sees an opportunity id |
| Canvas rendering, export | **BLK** | GoJS |
| Part catalogue lookups | **Arrow catalogue** | Per region: eu / ap / ac |
| Live collaboration | **Collab relay** | Off in the SFDC embed |
| AI context + recommendations | **Databricks + agent** | Points 3 and 4 |
| Design metadata, linkage, AI summaries/tags | **Databricks** | Copies, for retrieval — not the record |
| Identity | **Arrow IdP** | Both apps, same SSO |

The rule from the data model, restated: **each service writes only its own
schema.** BLK registers artifacts by calling the DWS API, never by INSERT.

**Databricks is not the artifact store.** The stakeholder review corrected this
explicitly: diagram JSON, canvas objects, versions and attachment bytes stay in
Oracle. What flows to Databricks is *linkage* (design ↔ opportunity ↔ artifact
ids), *design metadata* (name, brief, customer, region, stage) and *derived
semantics* (AI summaries, tags, embeddings). Databricks is the unified business
context layer the agent retrieves from — aggregating Salesforce, FAST,
SiliconExpert and the engineering knowledge base alongside this feed. `dws.design`
and `dws.design_artifact` remain the system of record; if Databricks were
rebuilt from scratch tomorrow, no design would be lost.

---

## 3. Flow — FAE links an opportunity

The only proactive Salesforce call in the whole system, and it happens once.

```mermaid
sequenceDiagram
  actor FAE
  participant DWS as DWS API
  participant SF as Salesforce API
  participant ORA as Oracle (DWS)
  participant DBX as Databricks

  FAE->>DWS: create design "48V BMS"
  DWS->>ORA: INSERT design (no opportunity yet)
  FAE->>DWS: link opportunity 0064x…
  DWS->>SF: GET opportunity 0064x…  (validate it exists)
  SF-->>DWS: 200 name, stage
  DWS->>ORA: UPDATE design SET opportunity_id
  DWS->>ORA: INSERT outbox_event
  ORA-->>DBX: DESIGN/LINKED
  Note over DWS,DBX: Only the id is stored.<br/>Account, amount, close date stay in SFDC;<br/>the agent resolves them from Databricks.
```

---

## 4. Flow — FAE builds the design

```mermaid
sequenceDiagram
  actor FAE
  participant DWS as DWS UI
  participant BLK as BLK editor
  participant BAPI as BLK API
  participant CAT as Part catalogue
  participant ORA as Oracle (BLK)

  FAE->>DWS: open design DSN-4788
  DWS->>DWS: /designs/DSN-4788 (all artifacts, drafts included)
  FAE->>DWS: Block diagrams ▸ open "Power stage"
  DWS->>BLK: iframe /editor/118?embed=1
  BLK->>BAPI: GET diagram 118
  BAPI->>ORA: diagram + diagram_content
  FAE->>BLK: search a part
  BLK->>BAPI: /api/parts/search?q=…&region=eu
  BAPI->>CAT: /eupartservice/search
  FAE->>BLK: place, wire, edit
  BLK->>BAPI: autosave
  BAPI->>ORA: UPDATE diagram_content
```

Region matters here: the same part number gives different stock, lead time and
price per region, so the catalogue call carries the design's region.

---

## 5. Flow — export, then publish

Two separate steps, deliberately. Exporting produces a draft; only a person with
the approver role makes it customer-visible.

```mermaid
sequenceDiagram
  actor FAE
  actor APR as FAE manager
  participant BLK as BLK API
  participant DWS as DWS API
  participant ORA as Oracle (DWS)
  participant DBX as Databricks

  FAE->>BLK: export diagram to PDF
  BLK->>BLK: render (server-side)
  BLK->>DWS: POST /designs/42/artifacts<br/>kind DIAGRAM_EXPORT
  DWS->>ORA: INSERT design_artifact (DRAFT, external N)
  DWS->>ORA: INSERT artifact_file (bytes, size, sha256)

  APR->>DWS: POST /artifacts/900/publish
  DWS->>ORA: check design_member.role = APPROVER
  DWS->>ORA: UPDATE status PUBLISHED, external_visible Y
  Note right of ORA: trigger rejects the update if<br/>artifact_kind.external_eligible = 'N'
  DWS->>ORA: INSERT artifact_publication (who, when, which file)
  DWS->>ORA: INSERT outbox_event
  ORA-->>DBX: ARTIFACT/PUBLISHED
```

The diagram **JSON** is kind `BLOCK_DIAGRAM`, which is `external_eligible = 'N'`
— it can never be published outward. The **PDF** is `DIAGRAM_EXPORT`, which can.
That is point 5, enforced by the database rather than by convention.

---

## 6. Flow — sales rep views it from Salesforce

Three calls, each one triggered by a click. Nothing happens until the rep asks.

```mermaid
sequenceDiagram
  actor REP as Sales rep
  participant SF as Salesforce
  participant DWS as DWS embed
  participant API as /api/sfdc/**
  participant ORA as Oracle (DWS)

  REP->>SF: open Opportunity 0064x…
  Note over SF: no call yet — the button is just rendered
  REP->>SF: click View Design
  SF->>DWS: iframe /embed/opportunity/0064x…
  DWS->>API: GET /opportunities/0064x…/designs
  API->>ORA: SELECT design WHERE opportunity_id = …
  Note over API,ORA: all linked designs, not filtered
  REP->>DWS: click design DSN-4788
  DWS->>API: GET /designs/DSN-4788/artifacts
  API->>ORA: SELECT FROM v_published_artifact_v1
  Note over API,ORA: published + externally eligible ONLY
  REP->>DWS: click "Power stage.pdf"
  DWS->>API: GET /artifacts/900/content
  API-->>REP: file stream
```

If the rep is an FAE who wants to edit, the embed offers **Open in Design
Workspace**, which opens `dws.arrow.com/designs/DSN-4788` in a new top-level
tab — outside the iframe entirely. The stakeholder review confirmed this:
embedded = read-only summary, editing happens undocked. Salesforce has no
floating-dock concept, so "undock" means a full-page Lightning tab or a new
browser tab, not a draggable panel.

**Freshness is not a problem here.** Because every call above is lazy — nothing
fires until the rep clicks — the embed always reads `v_published_artifact_v1`
live. There is no cached copy in Salesforce to go stale, so an artifact
published thirty seconds ago is visible on the next click. That is a property
of the lazy design, not something we have to build.

---

## 7. Flow — the AI agent

```mermaid
sequenceDiagram
  actor FAE
  participant DWS as DWS API
  participant ORA as Oracle (DWS)
  participant AG as AI agent
  participant DBX as Databricks

  FAE->>DWS: suggest a reference design
  DWS->>ORA: check design_member (may this user see design 42?)
  DWS->>ORA: read design.opportunity_id
  DWS->>AG: design_id 42, opportunity 0064x…, caller
  AG->>DBX: opportunity context by id
  AG->>DBX: similar designs + published artifacts
  AG-->>DWS: recommendation
  DWS->>ORA: INSERT design_artifact kind RECOMMENDATION (internal)
```

The membership check is the important line. Point 3 has the agent resolving
opportunity context by id; without it, the agent becomes a way to read
opportunities the caller cannot open in Salesforce.

---

## 8. Trust boundaries

```
┌── customer-facing ────────────────────────────────────┐
│  Salesforce opportunity                               │
│    sees: published + externally eligible artifacts    │
│    never sees: diagram JSON, FAE notes, sketches,     │
│                drafts, AI recommendations             │
└───────────────────────────────────────────────────────┘
            ▲ /api/sfdc/**  →  v_published_artifact_v1 only
            │
┌── internal ───────────────────────────────────────────┐
│  DWS workspace                                        │
│    sees: everything, for design_members               │
│    /api/**  →  design_artifact, membership-checked    │
└───────────────────────────────────────────────────────┘
            ▲ REST, never SQL
            │
┌── service ────────────────────────────────────────────┐
│  BLK                                                  │
│    owns: diagram JSON, versions                       │
│    knows: design_id.  does NOT know: opportunity_id   │
└───────────────────────────────────────────────────────┘
```

Three separate things must be true before anything reaches a customer:
artifact `PUBLISHED`, artifact `external_visible = 'Y'`, and kind
`external_eligible = 'Y'`. The SFDC endpoints read a view that requires all
three, so they cannot leak a draft even if asked to.

---

## 9. What has to be built

| Piece | Where | Notes |
|---|---|---|
| CSP `frame-ancestors` + token auth | DWS, BLK | Blocks everything; do first |
| `/embed/opportunity/{id}` read-only view | DWS UI | Server-filtered, not a UI flag |
| `/api/sfdc/**` namespace | DWS API | Reads only `v_published_artifact_v1` |
| Design + artifact + publish model | DWS API | See data-model.md |
| Server-side PDF/PNG render | BLK | Largest hidden item |
| Artifact registration endpoint | DWS API | BLK calls it; never INSERTs |
| Opportunity validate-on-link | DWS API | The one proactive SFDC call |
| Outbox → Databricks | DWS API | Metadata + linkage only, never bytes |
| Collab auth (room-scoped token) | Relay | Or disable when `embed=1` |
| GoJS production licence | BLK | Domain-locked; procurement lead time |
| Salesforce LWC + Trusted Sites | SFDC | Per org, incl. sandboxes |
