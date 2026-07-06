# Block Diagram Builder — Technical Walkthrough & Demo Guide

A collaborative, electronics‑aware **block diagram & schematic builder**: design
system/architecture diagrams from a component palette, capture real schematics with
electrical symbols, collaborate live, search a real parts catalogue, drop parts onto the
canvas, run a **feedback‑loop discussion** between sales/engineering/customer, and generate
a **Bill of Materials** and **netlist**.

---

## 1. What it is & the tech stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular 21 (standalone components, Router, lazy loading), TypeScript, RxJS, Angular Material |
| **Canvas / diagramming** | **GoJS 4** (`gojs`) — node/link templates, ports, orthogonal wire routing, groups, tooltips, overview (minimap) |
| **Real‑time collaboration** | **Yjs** (CRDT) + **y‑websocket** relay (port 1234) with **durable persistence** (`y‑leveldb`) so rooms & chat survive restarts |
| **Backend** | **Spring Boot 3.2** (Java 17) — Spring Web, Spring Security (session auth), Spring Data JPA |
| **Database** | **H2** (file‑based, `./data/diagrams`) — swap for PostgreSQL in prod |
| **External integration** | **Arrow “Design Win” Part Search API** (OAuth2 client‑credentials) via a backend proxy |
| **AI (optional)** | **Ollama** (local) for image‑to‑diagram and design‑review assists; degrades gracefully when disabled |
| **Tests** | Frontend: Jasmine + Karma. Backend: JUnit 5 + Mockito (57 tests). |

**Two processes in dev:** `npm start` runs the Angular app **and** the durable y‑websocket
collab relay together (`concurrently`). The Spring backend runs separately (`mvn spring-boot:run`).

---

## 2. Architecture

### Frontend (feature‑based, SOLID)
```
src/app/
  app.config.ts            providers: Router, HttpClient + interceptors, animations,
                           APP_INITIALIZER (restores the auth session before routing)
  app.routes.ts            /login, /editor, /editor/:id (guarded), /gojs alias, 404 catch‑all
  core/                    singletons provided once
    app-config.ts          API/collab URL resolution (protocol‑matched: wss on https)
    guards/auth.guard.ts   redirects to /login if not authenticated
    interceptors/          credentials (cookie) + error (toasts, retry, 401→login)
    services/              diagram, gojs-collab, review, version, comment, feedback-loop,
                           design-review, recommendation, lifecycle, image-diagram,
                           box-suggestion, part-search, bom, auth, notification, i18n
  shared/                  reusable, "dumb" components (own .ts/.html/.css each)
    components/            star-rating, confirm-dialog, command-palette, toast
  features/
    auth/                  login
    gojs-editor/           gojs-editor.component (smart container) + GoJS templates,
                           symbol libraries, schematic/netlist/BOM, draw.io export
    editor/                shared child components & symbol data:
      components/          zoom-dock, reviews-dialog, bom-dialog, versions-dialog,
                           comments-panel, part-search-panel, designwin-panel,
                           feedback-loop-panel (Discussions), templates-dialog, …
      electrical-shapes.ts / animated-shapes.ts / basic-shapes.ts
    errors/                not-found (404 page)
```

Key idea: **`gojs-editor.component` is the smart container** that owns the GoJS `Diagram`
and its collaboration binding, and the panels/dialogs are **presentational child components**
wired with `@Input`/`@Output` and dependency‑injected services. Every component has its **own
HTML and CSS file** (no inline templates).

### Backend (layered, SOLID)
```
com.example.diagram/
  config/        SecurityConfig, ArrowProperties
  domain/        JPA entities: Diagram, Review, DiagramVersion, Comment, User,
                 Template, TemplateRating, Feedback, FeedbackThread, FeedbackEntry, UsageEvent
  repository/    Spring Data repositories
  service/       interfaces (DiagramService, ReviewService, VersionService, CommentService,
                 PartSearchService, TemplateService, FeedbackLoopService, DesignWinService,
                 RecommendationService, LifecycleService, ImageDiagramService, …)
    impl/        implementations (business logic lives here)
  web/           thin REST controllers (Diagram, Review, Version, Comment, PartSearch,
                 Template, FeedbackLoop, DesignWin, Recommendation, Lifecycle, ImageDiagram,
                 BoxSuggestion, DesignReview, Integration, Metrics, System, Auth)
    dto/         request/response records (entities never leak out of the API)
    error/       NotFoundException + GlobalExceptionHandler (@RestControllerAdvice)
  security/      UserDetailsServiceImpl
  bootstrap/     SampleDiagramSeeder, ReviewSeeder, DiscussionSeeder,
                 TemplateSeeder, TemplateRatingSeeder (seed data on startup)
```

SOLID highlights: controllers delegate to **service interfaces** (DIP); business logic is out
of controllers (SRP); DTO records decouple the API from entities; the parts source and block
catalogue sit behind interfaces (OCP) so they can change without touching callers.

---

## 3. Data model & persistence

H2 file DB, `ddl-auto=update` (tables auto‑created). Core entities:

- **Diagram** — `id, name, contentJson (GoJS model JSON), classification, updatedAt`
- **Review** — `diagramId, userEmail, userName, rating (1–5), comment` — unique `(diagram,user)`
- **DiagramVersion** — immutable snapshot: `diagramId, label, contentJson, author, createdAt`
- **Comment** — `diagramId, nodeId (pinned block), author, text, createdAt`
- **FeedbackThread / FeedbackEntry** — the **Discussions** feature: a thread anchored to a
  diagram (optionally a block), with entries carrying a free‑form **role tag** and a **decision**
  that moves the thread’s status (see §5).
- **Template / TemplateRating** — the reusable template repository + its ratings.
- **User** — `email, name, bcrypt password, enabled`

The diagram is stored as the **GoJS model JSON** (`nodeDataArray` / `linkDataArray`) — nodes,
wires, ports, locations/sizes/angles (as strings so a plain‑JSON copy round‑trips), and any
custom data (e.g. the catalogue part on a part card, refdes/value on a schematic symbol).

> Legacy X6 diagrams (`{ cells: [...] }`) still import: the editor converts them to the GoJS
> model on load.

---

## 4. Authentication & collaboration mechanics

**Auth** — session‑based. Register/login (BCrypt) issues a `JSESSIONID` cookie; the
`credentialsInterceptor` sends it with every request. `APP_INITIALIZER` calls `/auth/me`
once on startup so the route guard can decide synchronously. No roles — "logged‑in vs not".

**Collaboration** — one Yjs document per diagram (room = diagram id). Local GoJS model
changes are written into a shared `Y.Map` keyed by `n:<key>` / `l:<key>`; remote map changes
are applied back to the model (echo‑suppressed inside the applying transaction). **Awareness**
carries presence: live cursors, the participant roster, and each user’s **viewport** for
follow‑mode. Chat is a shared `Y.Array`.

- **Seed‑vs‑adopt**: the first person in a room seeds it from their canvas; later joiners adopt
  the room’s live state. Ghost awareness left by a crashed/refreshed tab (same uid) never causes
  a false "adopt", and a solo user re‑publishes the saved truth (heals partial rooms).
- **Durable rooms**: the relay (`collab-server.mjs`) persists rooms via `y‑leveldb`, so a relay
  restart keeps live diagram state **and** chat history.
- **Join/leave toasts** name the actual user (from awareness), with a short grace window so a
  quick refresh doesn’t spam "left/joined".

---

## 5. Feature catalogue (what to show, and how it works)

### Diagramming
- **Component palette** — **Blocks** (functional cards), **basic shapes**, **~75 electrical
  schematic symbols**, **~22 animated symbols**. Drag‑and‑drop onto the GoJS canvas.
- **Editing** — move/resize, snapping, multi‑select, undo/redo, copy/cut/paste (Ctrl+C/X/V),
  duplicate, alignment & distribution, bring‑to‑front / send‑to‑back.
- **Zoom dock** + **minimap** (View → Minimap) for navigating large diagrams.
- **Command palette** — **Ctrl/Cmd+K**: fuzzy‑searchable list of every action.

### Schematic capture (real electronics)
- **Electrical symbols** carry pins as **directional ports** (wires exit the correct side, so
  they never cut through the body), an editable **reference designator** (R1, C1, U1…) and a
  **value** label placed to avoid the wire exits.
- **Wiring ergonomics** — orthogonal wires with a cyan live preview, **magnetic straightening**
  when two pins are nearly aligned, and **junction dots** where ≥2 wires meet.
- **Net labels / connect‑by‑name** — VCC/GND and named‑net flags tie nodes together without a
  drawn wire.
- **Netlist + BOM (electrical)** — Export builds nets by union‑find over the wiring and emits a
  human‑readable **netlist + grouped BOM** text file.

### Animated symbols
- FAST‑style moving components (fan, gear, wind turbine, conveyor, inverter, battery, pump,
  stack light…). Because a GoJS `Picture` can’t run CSS `@keyframes`, each symbol plays a
  **pre‑rendered SVG frame loop** on the canvas (rotors spin about their true axle, pulses/glows
  throb, belts march, batteries charge). Frames are flipped directly on the Picture, so the
  **model is never written** — no collab traffic, no autosave churn.

### Discussions (feedback loop between sales · engineering · customer)
- A **generic, dynamic** review loop — no hardcoded actors. Each participant posts under a
  **free‑form role tag** (Sales / Engineering / Customer / QA / …), and each reply can carry a
  **decision** that moves the thread: *comment* → stays open · *request changes* →
  changes‑requested · *approve* → approved · *close* → closed (a new comment reopens it).
- Threads can be **anchored to a block**; "View block" focuses/centres it. The header shows an
  **unread/open badge**. Roles already used on a diagram are offered as suggestions.

### Collaboration
- **Live presence** — the "viewing this file" button **pulses green** while connected; roster
  + live cursors; **Follow mode** mirrors a participant’s pan/zoom.
- **Session chat** with **live notifications** — a message from another participant while your
  chat dock is closed raises a **toast** (sender + preview) and a **pulsing unread badge**;
  persisted history replayed at join is never counted as unread.

### Parts, Design Win & AI assists
- **Search parts** — the Arrow catalogue proxy (see §6); results drop as **part cards**.
- **Design Win explorer** — customer/project/board context that biases suggestions toward a
  customer’s **approved parts**, plus a **field‑proven (POS)** check on a selection.
- **Recommendations (AI)** and **Design review (AI)** panels; **image‑to‑diagram** import
  (drop a schematic photo → nodes/wires) when a local Ollama model is configured.
- **Part lifecycle** check and a **Project workspace** panel.

### Import / export
- **Import**: app JSON (GoJS model **or** legacy X6), **draw.io** XML, **images**, and
  **parts‑catalogue JSON** → rich **part cards**.
- **Export**: JSON, **draw.io** (symbols export as their real artwork), **PNG**, **SVG**,
  **Bill of Materials (CSV)**, and **Netlist + BOM (electrical)**.

### Reviews & versions
- **Reviews** — rate a saved diagram (1–5★) + comment; **averages show as star chips in the
  Open list**; a modal shows the distribution and everyone’s reviews. One editable review per user.
- **Version history** — save labelled **snapshots** and **restore** any of them.
- **Canvas comments** — pin a comment to a block; clicking it focuses/centres the block.

### Template repository
- A shared, **dynamic library of starting points** (**Insert → Template repository**, or Ctrl+K): **Use** a template,
  **Improve** it in place, or **Save current as template**. Search filters by name/description/
  category; each card shows a **star rating** and opens the same reviews modal diagrams use.
  Seeded with starters (AMR Robot, Smart Microgrid, 555 Blinker, Parts & BOM) and demo ratings.

### Error handling (production‑grade)
- A global **HTTP error interceptor** maps failures to friendly messages (backend message wins),
  shows a **toast**, retries transient GET network errors, and on **401 redirects to /login**.

### Internationalisation
- **English, Spanish, French, German, Chinese, Japanese** via a live header menu; defaults to
  the browser language, remembers your choice (`localStorage`), switches instantly (no rebuild).

---

## 6. The headline flow: **Search a real part → drop on canvas → generate BOM**

Integration with Arrow’s **Design Win Part Search API** (from the API spec + its Postman collection).

### How auth works (OAuth2 client‑credentials)
```
POST {base}/auth/oauth2/token   header: version: v1
   body: { grant_type: client_credentials, client_id, client_secret }
   → { access_token, expires_in }              (Azure AD behind the scenes)
GET  {base}/arrowapi/dw/partservice/search?srchtxt=...   Authorization: Bearer <token>
   → partserviceresult JSON (parts[] with supplier, specs, images…)
```
There is **no refresh token** (that grant type doesn’t use one); request a new token when it expires.

### Why a backend proxy (not direct from the browser)
The browser must **not** hold the client secret, and the API is cross‑origin/behind Azure APIM.
So the **Spring backend proxies** it:
```
Angular  ──►  /api/parts/search?q=   ──►  PartSearchService
                                          • fetches & CACHES the OAuth Bearer token
                                          • forwards the search with that token
                                          • returns the raw partserviceresult JSON
```
- **Credentials are never committed** — env vars (`ARROW_CLIENT_ID/SECRET`) or a **gitignored**
  `application-local.properties`.
- Clear errors: **503** if unconfigured, **502** on upstream failure, real cause logged server‑side.

### Mock mode (for the demo, no live API needed)
`PartSearchService` has two implementations selected by `@ConditionalOnProperty(arrow.mock)`:
- `ArrowPartSearchService` (live) — default.
- `MockPartSearchService` (when `arrow.mock=true`) — serves a small bundled catalogue
  (`sample-parts.json`) filtered by query.

Start the backend with **`arrow.mock=true`** (env `ARROW_MOCK=true` or in
`application-local.properties`) and search works offline. The backend logs which mode it booted in.

### Part cards & the BOM
- A searched/imported part becomes a **part‑card** node: package thumbnail, part number,
  supplier, and up to four key‑spec lines. **The full catalogue object is stored on the node’s
  data** (nothing is lost).
- **`BomService`** scans the canvas for part cards, **groups by part number and tallies
  quantity**, then renders a table (`BomDialogComponent`) and a **CSV download**. Two identical
  parts → one line, qty 2.

---

## 7. Engineering practices to mention

- **GoJS migration**: the canvas was ported from AntV X6 to **GoJS 4** (node/link templates,
  ports, orthogonal routing) with the Yjs collaboration layer re‑bound onto the GoJS model.
- **Lazy loading**: the heavy editor loads on demand behind the route guard.
- **Tests**: backend `mvn test` → **57 JUnit tests** (services, validation, aggregation, mock,
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

# Frontend + durable collab relay
cd diagram-poc/frontend
npm install
npm start                                    # → http://localhost:4200 (+ relay on :1234)
```
If the dev server shows `504 (Outdated Optimize Dep)`, clear the Vite cache:
`rm -rf .angular/cache node_modules/.vite && npm start`.

> **Optional AI**: image‑to‑diagram / design‑review assists use a local **Ollama**
> (`OLLAMA_ENABLED=true`, a vision model pulled, e.g. `llava`). With it off, those actions
> simply report that the assistant is unavailable — nothing else breaks.

---

## 9. Suggested 5‑minute demo script

1. **Sign in** → land in the editor (the heavy chunk lazy‑loads — note the fast initial load).
2. **Open a sample** — Open dropdown → **Sample - 555 LED Blinker** to show a real **schematic**
   (electrical symbols, refdes/values, clean orthogonal wiring, junction dots, GND/VCC flags).
3. **Discussions** — open the **Discussions** panel: the seeded sales → customer → engineering
   thread ("Blink rate feels too slow") with a **Changes requested** status, anchored to the 555.
   Note the free‑form role tags and the decision that moved the status.
4. **Animations** — open **Sample - Smart Microgrid**: the turbine blades spin, the battery
   charges, the conveyor turns — all on the GoJS canvas, with **no collab/model churn**.
5. **Search parts → BOM** — Ctrl+K → "Search parts" → search `amplifier` → **+ Add**
   `INA250A3PWR` twice (to show quantities) → **Export → Bill of Materials (CSV)** → grouped
   table (INA250 **Qty 2**) → **Download CSV**. Or export **Netlist + BOM (electrical)**.
6. **Collaboration** — open the same diagram in a second browser profile → **green live pulse**,
   named **join toast**, live cursors, **Follow mode**. Send a chat message from one side with the
   other’s chat closed → **toast + pulsing unread badge**.
7. **Reviews & versions** — the Open dropdown shows **★ rating chips**; save a **version**; pin a
   **comment** to a block.
8. **Command palette** — Ctrl+K to show everything is keyboard‑discoverable.

> Have `arrow.mock=true` set so parts search works offline. Sample searches:
> `INA250A3PWR`, `LM317`, `ESP32`, or keywords `amplifier`, `regulator`, `capacitor`, `diode`.

### Ready-made BOM sample (no setup)
For a zero‑setup BOM demo, import `diagram-poc/samples/bom-demo.json` (**Import → JSON**).
It’s a finished diagram: catalogue **part cards** arranged inside labelled group shapes
(*Power Supply*, *Sensing & Comms*, *Compute & Motor Control*) with deliberate duplicates.
**Export → Bill of Materials (CSV)** then shows the grouped lines — e.g. the 0.1µF capacitor
at **Qty 4**, INA250 / DS91C176 / LM317 at **Qty 2**. Regenerate it any time with
`node diagram-poc/samples/gen-bom-demo.mjs`.
