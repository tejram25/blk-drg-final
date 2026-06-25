# Block Diagram Builder — Technical Walkthrough & Demo Guide

A collaborative, electronics‑aware **block diagram builder**: design system/architecture
diagrams from a component palette, collaborate live, search a real parts catalogue,
drop parts onto the canvas, and generate a **Bill of Materials**.

---

## 1. What it is & the tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular 17 (standalone components, Router, lazy loading), TypeScript, RxJS, Angular Material |
| **Canvas / diagramming** | AntV **X6** (`@antv/x6`) + plugins: dnd, snapline, selection, keyboard, history, transform, export, minimap |
| **Real‑time collaboration** | **Yjs** (CRDT) + **y‑websocket** server (port 1234) |
| **Backend** | **Spring Boot 3.2** — Spring Web, Spring Security (session auth), Spring Data JPA |
| **Database** | **H2** (file‑based, `./data/diagrams`) — swap for PostgreSQL in prod |
| **External integration** | **Arrow “Design Win” Part Search API** (OAuth2 client‑credentials) via a backend proxy |
| **Tests** | Frontend: Jasmine + Karma. Backend: JUnit 5 + Mockito (35 tests). |

**Two processes in dev:** `npm start` runs the Angular app **and** the y‑websocket collab
server together (`concurrently`). The Spring backend runs separately (`mvn spring-boot:run`).

---

## 2. Architecture

### Frontend (feature‑based, SOLID)
```
src/app/
  app.config.ts            providers: Router, HttpClient + interceptors, animations,
                           APP_INITIALIZER (restores the auth session before routing)
  app.routes.ts            /login, /editor, /editor/:id (guarded), 404 catch‑all
  core/                    singletons provided once
    app-config.ts          API/collab URL resolution (protocol‑matched)
    guards/auth.guard.ts   redirects to /login if not authenticated
    interceptors/          credentials (cookie) + error (toasts, retry, 401→login)
    services/              diagram, review, version, comment, collab, auth,
                           part-search, graph, notification, i18n
  shared/                  reusable, "dumb" components (own .ts/.html/.css each)
    components/            star-rating, confirm-dialog, command-palette, toast
  features/
    auth/                  login
    editor/                editor.component (smart container) + child components:
      components/          status-bar, zoom-dock, reviews-dialog, bom-dialog,
                           versions-dialog, comments-panel, part-search-panel
    errors/                not-found (404 page)
```

Key idea: the editor is the **smart container** that owns the X6 graph (via `GraphService`),
and the panels/dialogs are **presentational child components** wired with `@Input`/`@Output`
and dependency‑injected services. Every component has its **own HTML and CSS file** (no inline
templates).

### Backend (layered, SOLID)
```
com.example.diagram/
  config/        SecurityConfig, ArrowProperties
  domain/        JPA entities: Diagram, Review, DiagramVersion, Comment, User
  repository/    Spring Data repositories
  service/       interfaces (DiagramService, ReviewService, VersionService,
                 CommentService, BlockCatalogService, PartSearchService)
    impl/        implementations (business logic lives here)
  web/           thin REST controllers
    dto/         request/response records (entities never leak out of the API)
    error/       NotFoundException + GlobalExceptionHandler (@RestControllerAdvice)
  security/      UserDetailsServiceImpl
  bootstrap/     SampleDiagramSeeder, ReviewSeeder (seed data on startup)
```

SOLID highlights: controllers delegate to **service interfaces** (DIP); business logic is out
of controllers (SRP); DTO records decouple the API from entities; the block catalogue and
parts source sit behind interfaces (OCP) so they can change without touching callers.

---

## 3. Data model & persistence

H2 file DB, `ddl-auto=update` (tables auto‑created). Entities:

- **Diagram** — `id, name, contentJson (X6 graph.toJSON), updatedAt`
- **Review** — `diagramId, userEmail, userName, rating (1–5), comment` — unique `(diagram,user)`
- **DiagramVersion** — immutable snapshot: `diagramId, label, contentJson, author, createdAt`
- **Comment** — `diagramId, nodeId (pinned block), author, text, createdAt`
- **User** — `email, name, bcrypt password, enabled`

The diagram itself is stored as the **X6 graph JSON** (`{ cells: [...] }`) — nodes, edges,
positions, attributes, and any custom `data` (e.g. the full catalogue part on a part card).

---

## 4. Authentication & collaboration mechanics

**Auth** — session‑based. Register/login (BCrypt) issues a `JSESSIONID` cookie; the
`credentialsInterceptor` sends it with every request. `APP_INITIALIZER` calls `/auth/me`
once on startup so the route guard can decide synchronously. No roles — "logged‑in vs not".

**Collaboration** — one Yjs document per diagram (room = diagram id). Local X6 changes are
written into a shared `Y.Map<cellId, cellJSON>`; remote map changes are applied back to the
graph. **Awareness** carries presence: live cursors, the participant roster, and (new) each
user’s **viewport** for follow‑mode. Chat is a shared `Y.Array`.

---

## 5. Feature catalogue (what to show, and how it works)

### Diagramming
- **Component palette** — Blocks (functional cards), basic shapes, ~35 electrical schematic
  symbols, ~37 animated symbols. Drag‑and‑drop via the X6 `dnd` plugin.
- **Editing** — move/resize/rotate (transform plugin), snaplines, multi‑select, undo/redo
  (history plugin), copy/cut/paste (Ctrl+C/X/V), duplicate (Ctrl+D), alignment & distribution,
  bring‑to‑front / send‑to‑back (Ctrl+Shift+F/B).
- **Zoom dock** + **minimap** (toggle) for navigating large diagrams.
- **Command palette** — **Ctrl/Cmd+K**: fuzzy‑searchable list of every action.

### Import / export
- **Import**: app JSON (X6 graph), **draw.io** XML, **images**, and **parts‑catalogue JSON**
  (`partserviceresult`) → rendered as rich **part cards**.
- **Export**: JSON, **draw.io**, **PNG**, **SVG** (X6 export plugin), and **Bill of Materials (CSV)**.
- **Exclude components from export**: PNG/SVG open a popup listing every component with a tick, so
  you can leave parts out of the picture. You can also **right‑click any component → Exclude from
  export**. Excluded components **stay on the canvas with an eye‑off badge** at their top‑right
  (click it to include again) — they're only dropped, with their wires, for the instant the image is
  captured, so you never lose sight of them while editing. Excluding a **group/container block
  cascades to everything inside it**, and excluded parts are left out of the **BOM and JSON** exports too.

### Collaboration
- **Live presence** — the "viewing this file" button **pulses green** while connected.
- **Join/leave toasts** — "X joined/left the session" to everyone.
- **Live cursors** + **roster**; **Follow mode** — click *Follow* on a participant to mirror
  their pan/zoom (viewport shared over Yjs awareness, guarded against feedback loops).
- **Session chat**.

### Reviews & versions
- **Reviews** — rate a saved diagram (1–5★) + comment; averages shown in the Open list; a modal
  shows the distribution and everyone’s reviews. Backend enforces one editable review per user.
- **Version history** — save labelled **snapshots** of the canvas and **restore** any of them.
- **Canvas comments** — pin a comment to a specific block; clicking it focuses/centres the block.

### Template repository (reusable, improvable, searchable)
- A shared, **dynamic library of starting points** (toolbar 🧩 *Template repository*, or Ctrl+K).
  Three actions: **Use** a template (starts a fresh diagram from it and bumps its usage count),
  **Improve** a template (load it, edit, and **Update template** in place — the change is shared),
  and **Save current as template** (publish your canvas with a name/category/description).
- **Search** box filters by name/description/category (scales to hundreds of templates), and each
  card shows a **star rating** — the community average + count, plus interactive *click-to-rate*
  for your own score. Click the **review count** to open the **full reviews modal** (the same one
  diagrams use, made data‑source‑agnostic) with the distribution, every review, and an editable
  "your review" (rating + comment; one per user).
- Gallery sorts by **most-used**, shows author + who last improved it. Seeded with starters
  (AMR Robot, Smart Microgrid, 555 Blinker, Parts & BOM) and demo ratings. Backend: `Template`
  + `TemplateRating` entities, `/api/templates` CRUD + `/use` + `/rating`; author/editor/rater
  resolved from the session, not the body.

### Error handling (production‑grade)
- A global **HTTP error interceptor** maps failures to friendly messages (backend message
  wins; sensible fallbacks per status), shows a **toast**, retries transient GET network
  errors, and on a **401 redirects to /login**. A `NotificationService` + `ToastComponent`
  drive success/error/info toasts app‑wide.

---

## 6. The headline flow: **Search a real part → drop on canvas → generate BOM**

This is the integration with Arrow’s **Design Win Part Search API** (from the API spec doc +
its embedded Postman collection).

### How auth works (OAuth2 client‑credentials)
```
POST {base}/auth/oauth2/token   header: version: v1
   body: { grant_type: client_credentials, client_id, client_secret }
   → { access_token, expires_in }              (Azure AD behind the scenes)
GET  {base}/arrowapi/dw/partservice/search?srchtxt=...   Authorization: Bearer <token>
   → partserviceresult JSON (parts[] with supplier, specs, images…)
```
There is **no refresh token** (that grant type doesn’t use one); you just request a new token
when it expires.

### Why a backend proxy (not direct from the browser)
The browser must **not** hold the client secret, and the API is cross‑origin/behind Azure APIM.
So the **Spring backend proxies** it:
```
Angular  ──►  /api/parts/search?q=   ──►  PartSearchService
                                          • fetches & CACHES the OAuth Bearer token
                                          • forwards the search with that token
                                          • returns the raw partserviceresult JSON
```
- **Credentials are never committed** — they come from env vars (`ARROW_CLIENT_ID/SECRET`) or a
  **gitignored** `application-local.properties`.
- Clear errors: **503** if unconfigured, **502** on upstream failure, with the real upstream
  cause logged server‑side.

### Mock mode (for the demo, no live API needed)
`PartSearchService` has two implementations selected by `@ConditionalOnProperty(arrow.mock)`:
- `ArrowPartSearchService` (live) — default.
- `MockPartSearchService` (when `arrow.mock=true`) — serves a small bundled catalogue
  (`sample-parts.json`, 6 real parts) filtered by query.

Start the backend with **`arrow.mock=true`** (env `ARROW_MOCK=true` or in
`application-local.properties`) and search works offline. The backend logs which mode it
booted in.

### Part cards & the BOM
- A searched/imported part becomes a registered **`part-card`** X6 node: package thumbnail,
  part number, supplier, and up to four key‑spec lines. **The full catalogue object is stored
  in the node’s `data.part`** (nothing is lost). Cards **scale their text/image when resized**.
- **`BomService`** scans the canvas for `part-card` nodes, reads each `data.part`, **groups by
  part number and tallies quantity**, then renders a table (`BomDialogComponent`) and a
  **CSV download** (with proper comma‑escaping). Two identical parts → one line, qty 2.

---

## 7. Engineering practices to mention

- **Branching**: `main` (original) → `restructure` (clean, stable, tested architecture) →
  `features` (everything new). `restructure` is the safe baseline.
- **Bundle size**: routing + lazy loading dropped the **initial bundle from ~1.1 MB to ~444 KB**
  (the heavy editor loads on demand).
- **Tests**: backend `mvn test` → **35/35 green** (services, validation, aggregation, mock,
  entity lifecycle). Frontend Karma/Jasmine specs for services & components.
- **Security**: secrets via env / gitignored file; session cookies HttpOnly + SameSite=Lax;
  BCrypt; the parts proxy keeps the client secret server‑side.
- **No inline templates/CSS** — every component is `.ts` + `.html` + `.css`.

---

## 8. How to run it

```bash
# Backend (with sample parts catalogue for the demo)
cd diagram-poc/backend
ARROW_MOCK=true mvn spring-boot:run          # → http://localhost:8080

# Frontend + collab server
cd diagram-poc/frontend
npm install
npm start                                    # → http://localhost:4200
```
If the dev server shows `504 (Outdated Optimize Dep)`, clear the Vite cache:
`rm -rf .angular/cache node_modules/.vite && npm start`.

---

## 9. Suggested 5‑minute demo script

1. **Sign in** → land in the editor (the heavy chunk lazy‑loads — note the fast initial load).
2. **Build a quick diagram** — drag a couple of blocks/shapes from the palette, wire them.
3. **Search parts** — toolbar 🌐 (or Ctrl+K → "Search parts") → search `amplifier` → **+ Add**
   `INA250A3PWR`; add it **twice** (to show quantities). Add `LM317` and `ESP32`.
4. **Resize a part card** — show the text/image scaling with the box; bring it to front over a block.
5. **Generate the BOM** — Export → **Bill of Materials (CSV)** → show the grouped table
   (INA250 with **Qty 2**) → **Download CSV**.
6. **Collaboration** — open the same diagram in a second browser profile → show the **green live
   pulse**, the **join toast**, live cursors, and **Follow mode**.
7. **Reviews & versions** — open the Open dropdown to show **★ ratings**; save a **version**;
   pin a **comment** to a block.
8. **Command palette** — Ctrl+K to show everything is keyboard‑discoverable.

> Have `arrow.mock=true` set so parts search works offline. Sample parts to search:
> `INA250A3PWR`, `LM317`, `ESP32`, or keywords `amplifier`, `regulator`, `capacitor`, `diode`.

### Ready-made BOM sample (no setup)
For a zero-setup BOM demo, import `diagram-poc/samples/bom-demo.json`
(**Import → JSON**). It's a finished diagram: 12 catalogue **part cards** arranged
inside three labelled group shapes (*Power Supply*, *Sensing & Comms*,
*Compute & Motor Control*), with deliberate duplicates. **Export → Bill of
Materials (CSV)** then shows **6 grouped lines** — e.g. the 0.1µF capacitor at
**Qty 4**, INA250 / DS91C176 / LM317 at **Qty 2** — demonstrating the quantity
tally. Regenerate it any time with `node diagram-poc/samples/gen-bom-demo.mjs`.
