# Diagram MCP server + Yjs session bot

A scaffold that turns the Block Diagram app into something an AI agent can **read
and edit** — and, via the live bot, **join a collaboration session** and edit the
shared canvas alongside humans.

It's the concrete version of "agent in the session = **copilot + MCP + Yjs**":

```
Copilot chat   →   Agent (LLM)   →   MCP tools          →   Yjs room
(invoke)           (reason)          (act, grounded)        (where edits land: shared, live, undoable)
   this is the client            ── this repo ──            this repo (yjsBot.ts)
```

Everything here is a **thin adapter over endpoints that already exist** on the
Spring BFF — there is no new business logic to trust. The AI team plugs their
model/agent in on top; this gives them the tool surface and the live-edit path.

> Status: scaffold. Endpoints, auth, the GoJS model shape, and the Yjs room/cell
> layout are wired to the real app. Build it, point it at a running backend +
> relay, and it works; the AI team owns the reasoning layer that calls it.

---

## Two things it gives you

1. **An MCP server** (`src/index.ts`) — resources + tools over stdio for any
   MCP-capable client (an in-editor copilot, Claude Desktop, your agent).
2. **A Yjs session bot** (`src/yjsBot.ts`) — a real y-websocket client that joins
   `gojs-<diagramId>`, appears in the presence roster, and writes nodes/links
   into the shared `cells` map so every client sees the AI edit live.

## Setup

```bash
cd diagram-poc/diagram-mcp
npm install
cp .env.example .env      # fill in BFF url + agent credentials + relay ws url
npm run build
```

Requires: the **backend** running (`diagram-poc/backend`) and, for the live bot,
the **collab relay** (`diagram-poc/collab-relay`).

## Run the MCP server

```bash
npm start          # serves on stdio
```

Register it with an MCP client. Example (Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "diagram": {
      "command": "node",
      "args": ["/absolute/path/diagram-poc/diagram-mcp/dist/index.js"],
      "env": {
        "DIAGRAM_BFF_URL": "http://localhost:8080",
        "DIAGRAM_BFF_EMAIL": "agent@example.com",
        "DIAGRAM_BFF_PASSWORD": "…"
      }
    }
  }
}
```

Then ask the model: *"List my diagrams, open #1, and add a 0.1µF decoupling cap
to U1 wired to ground — search the catalogue for a real part first."* It will
call `list_diagrams` → `get_diagram` → `search_parts` → `add_block` → `add_link`
→ `attach_part`.

## Run the live session bot (the demo)

```bash
npm run bot:demo -- 1      # 1 = diagramId / room gojs-1
```

Open the same diagram in the app and watch **C1 + GND appear on the shared canvas**
with the bot in the presence roster. This is the runnable version of the concept POC.

---

## Tools

| Tool | Wraps | Purpose |
|---|---|---|
| `list_block_types` | `GET /api/block-types` | Valid `shape` keys (grounding) |
| `search_parts` | `GET /api/parts/search` | Real parts — call before attaching |
| `list_diagrams` | `GET /api/diagrams` | Enumerate diagrams |
| `get_diagram` | `GET /api/diagrams/{id}` | Read a diagram's model |
| `create_diagram` | `POST /api/diagrams` | New diagram |
| `add_block` | `PUT /api/diagrams/{id}` | Add a block/symbol |
| `add_link` | `PUT /api/diagrams/{id}` | Connect two blocks |
| `attach_part` | `PUT /api/diagrams/{id}` | Attach a catalogue part + qty |
| `recommend_parts` | `POST /api/recommendations` | Grounded part suggestions |
| `run_design_review` | `POST /api/design-review` | Review a diagram (auto-summarised) |
| `image_to_diagram` | `POST /api/image-to-diagram` | Image → nodes+links (needs vision model) |
| `suggest_next_block` | `POST /api/box-suggestions` | Next-block suggestions |

## Resources

| URI | Content |
|---|---|
| `catalog://block-types` | The palette / valid `shape` keys |
| `diagram://{id}` | A diagram's full GoJS model |

---

## The one contract everything shares

A diagram is a **GoJS `GraphLinksModel`** stored as the diagram's `contentJson`:

```jsonc
{
  "class": "GraphLinksModel",
  "nodeDataArray": [
    { "key": "u1", "category": "symbol", "shape": "elec-ic555",
      "text": "U1", "loc": "305 176", "size": "110 80" }
  ],
  "linkDataArray": [ { "key": "l1", "category": "link", "from": "u1", "to": "c1" } ]
}
```

- `loc` is the node **centre** (`"x y"`); `size` is `"w h"`.
- `shape` **must** be a key from `list_block_types`, else it renders as a generic box.
- The **same** node/link objects are what the Yjs room stores under `cells`
  (`n:<key>` / `l:<key>`) — so `model.ts` drives both the REST save and the live path.

Freeze this schema early: it's the seam between the AI team's model and the app,
and it renders identically on GoJS desktop, GoJS web, and RN native SVG.

## For the AI team — where to plug in

- **Text → diagram / copilot reasoning:** your agent calls these tools. Keep it
  grounded — make it `search_parts` and pick from `list_block_types` rather than
  inventing values.
- **Live edits:** route `add_block`/`add_link` through `DiagramBot` (same methods)
  instead of REST when you want edits to stream into an open session in real time.
- **Auto-layout:** models place nodes badly — let them emit topology and run a
  layout pass to assign `loc` (GoJS has layered/tree layouts on the client).
- **Image → diagram quality:** `image_to_diagram` is VLM-direct today; the hybrid
  detector+OCR approach and symbol-class mapping to `elec-*` keys live in the BFF's
  `ImageDiagramService`.

## Notes / TODO

- Auth is the app's password + session-cookie flow; the server logs in lazily and
  retries once on 401. Swap for a service account in production.
- SDK pinned to `@modelcontextprotocol/sdk@^1.12`; if you upgrade and the
  `registerTool`/`registerResource` signatures change, adjust `tools.ts`/`index.ts`.
