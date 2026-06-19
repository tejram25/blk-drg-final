# Block Diagram Builder — POC (Angular + Spring Boot + AntV X6)

A drag-and-drop block diagram builder, similar in spirit to the Arrow FAST tool but with user-created diagrams. Users drag blocks from a palette, connect them with animated "flowing wire" links, edit properties, and save/load diagrams via a Java backend.

## Quick preview (zero install)

Open `demo.html` in any browser (needs internet for the X6 CDN script). It shows the canvas, palette drag-drop, port connections, and the animated edges — no backend needed.

## Project layout

```
diagram-poc/
├── demo.html        ← standalone preview, open directly in a browser
├── backend/         ← Spring Boot 3 (Java 17), REST API + H2 database
└── frontend/        ← Angular 17 + AntV X6 diagramming library
```

## Run the backend

Requires Java 17+ and Maven.

```bash
cd backend
mvn spring-boot:run
```

API at http://localhost:8080/api — endpoints:

| Method | Path                 | Purpose                              |
|--------|----------------------|--------------------------------------|
| GET    | /api/block-types     | Palette catalog (feeds the sidebar)  |
| GET    | /api/diagrams        | List saved diagrams                  |
| GET    | /api/diagrams/{id}   | Full diagram (X6 JSON)               |
| POST   | /api/diagrams        | Create                               |
| PUT    | /api/diagrams/{id}   | Update                               |
| DELETE | /api/diagrams/{id}   | Delete                               |
| POST   | /api/auth/register   | Register + sign in (no email step)   |
| POST   | /api/auth/login      | Sign in (starts a session)           |
| GET    | /api/auth/me         | Current signed-in user (401 if none) |
| POST   | /api/auth/logout     | Sign out (ends the session)          |
| GET    | /api/auth/config     | Whether an invite code is required   |

Diagrams are stored in a file-based H2 DB (`backend/data/`). H2 console: http://localhost:8080/h2-console (JDBC URL `jdbc:h2:file:./data/diagrams`).

## Run the frontend

Requires Node 18+.

```bash
cd frontend
npm install
npm start
```

Open http://localhost:4200.

> If the generated `angular.json`/tsconfig ever conflicts with your CLI version, the fallback is: `ng new diagram-builder-frontend`, then `npm i @antv/x6 @antv/x6-plugin-dnd @antv/x6-plugin-snapline @antv/x6-plugin-selection @antv/x6-plugin-keyboard @antv/x6-plugin-history @antv/x6-plugin-transform yjs y-websocket`, and copy `src/app/` + `src/styles.css` + `src/main.ts` over.

> **Note:** node resizing uses `@antv/x6-plugin-transform`, collaboration uses `yjs` + `y-websocket`, and the toolbar uses `@angular/material` + `@angular/cdk` — run `npm install` again after pulling these changes.

## Sign in (registration)

The app is gated by a **session-based login**, and accounts are **self-service** — there are no preset accounts and no email step. On the login screen pick *Create account*, enter an email and a password (min 8 chars), and you're signed straight in. After that, use *Sign in* with the same credentials. Sign out from the user chip in the top-right.

`POST /api/auth/register` creates the account and starts the session in one step; `POST /api/auth/login` does the same for returning users. The `JSESSIONID` cookie then authorizes every request. There are **no roles** — authorization is simply "logged-in vs not": every `/api/**` endpoint except `/api/auth/**` requires an authenticated session. The Angular app sends the session cookie on every call (an HTTP interceptor sets `withCredentials`), checks for an existing session on start via `GET /api/auth/me`, and shows the login page or the canvas accordingly (`AppShellComponent`).

### Optional: gate sign-ups with an invite code

Registration is **open by default** (anyone who can reach the app can create an account). To keep it private, set a shared invite code in `backend/src/main/resources/application.properties`:

```properties
app.registration.invite-code=some-secret-code
```

When set, registrants must enter that exact code — the field appears automatically (the UI reads `GET /api/auth/config`). Leave it unset for open registration.

**Same-origin requirement.** Session cookies need the API same-origin with the app. In dev an Angular proxy (`frontend/proxy.conf.json` routes `/api` → `:8080`) handles it, so `npm start` is unchanged. In prod, serve the frontend and API from one origin (see `DEPLOYMENT.md`); `environment.prod.ts` defaults to `apiBase: '/api'`.

> **POC security notes.** Passwords are BCrypt-hashed and users are persisted in the H2 database (`app_users` table). **CSRF is disabled** (acceptable for a same-origin POC; see the comment in `SecurityConfig.java` to turn it on). The collaboration WebSocket (`:1234`) is not itself authenticated — the login gate protects the API and the UI, not the raw socket.

## Configuration & deployment

The backend API and the collaboration WebSocket URLs are resolved at runtime from the current page, so the app works both in local dev and once deployed:

- **Protocol is matched automatically** — on an `http://` page it uses `http://` + `ws://`; on an `https://` page it uses `https://` + `wss://`. This avoids the mixed-content blocking browsers apply to insecure requests from an HTTPS page (a common "works locally, breaks on dev" surprise).
- **Endpoints are configurable** in `src/environments/environment.ts` (dev) and `src/environments/environment.prod.ts` (prod, swapped in on `ng build`). Leave `apiBase` / `collabUrl` empty to auto-derive from the page using `apiPort` (8080) and `collabPort` (1234), or set them to a full URL (`https://api.example.com/api`, `wss://collab.example.com`) or a same-origin path (`/api`, `/collab`) when behind a reverse proxy.

For an HTTPS deployment, make sure the Spring backend is reachable over `https` and the `y-websocket` server over `wss` (typically by terminating TLS at a reverse proxy that forwards `/api` to :8080 and `/collab` to :1234), then point `environment.prod.ts` at those paths.

## Using it

1. Drag a block from the left palette onto the canvas. The palette has three sections: **Blocks** (colored boxes), **Electrical** (schematic symbols), and **Animated** (FAST-style moving components).
2. Hover a block → small circles (ports) appear on each side. Drag from a port to another block to connect. Edges animate like the FAST tool's flowing wires. Click a wire to recolor or delete it.
3. Click a node → drag corner handles to resize, the top handle to rotate (15° steps). Symbols and pins scale with the node.
4. Click a block → property panel on the right (rename, recolor, delete). Del key also deletes.
5. **Add image** in the toolbar (or drag an image file onto the canvas) imports a picture as a connectable node; it's embedded in the diagram JSON.
6. **White/Dark canvas** toggles the background; symbol colors adapt automatically.
7. Right-mouse drag pans; Ctrl+scroll zooms. Undo/Redo in the toolbar.
8. Name the diagram → Save → it's stored via the Java API. Reopen from the "Open saved…" dropdown. A ready-made "Sample - Smart Microgrid" diagram is seeded on first backend start.
9. Export JSON downloads the raw X6 graph JSON.

## Real-time collaboration

Multi-user editing is built on [Yjs](https://github.com/yjs/yjs) (CRDT, MIT-licensed) + WebSocket. **Collaboration is automatic and per file** — no sessions, no codes. The room id is the diagram's id, so anyone who opens the same saved diagram is collaborating live, identified by their own account name.

1. Start the sync server — either on its own or together with the app:

   ```bash
   npm run collab-server     # just the sync server (port 1234)
   npm run start:all         # Angular dev server + sync server in one terminal
   ```

   On a shared dev server, bind it to all interfaces: `HOST=0.0.0.0 PORT=1234 npm run collab-server`.

2. **Open a saved diagram** (via "Open saved…"). You're connected to that file's room immediately — the header shows a green presence button with the number of people viewing; click it for the roster (you're tagged **You**), and each person's live cursor carries their name. Add/move/resize/recolor/delete — changes appear everywhere instantly.
3. **Chat:** when you're in a file, the **Chat** button opens a Teams-style panel docked on the right; messages show the sender's name and color, your own are right-aligned, and the button shows an unread count while closed. Chat is scoped to the file.

A brand-new, unsaved diagram isn't shared until you **Save** it (that's when it gets an id). Switching files moves you to that file's room.

Under the hood the room is `diagram-<id>`. The **first** person to open a file seeds the room from the saved copy; later joiners adopt the room's live state. Concurrent edits merge automatically (last writer wins per cell). Saving persists the current canvas to the backend (any participant can save); the live room is transient — it lives in the `y-websocket` process memory while at least one person has the file open, so **save to keep changes**. Identities ride on Yjs *awareness* (the signed-in user's name + a color), and chat is a shared `Y.Array` in the same room doc — neither needs extra backend. (The old `/api/collab/sessions` code endpoint is no longer used by the app.)

## Languages (i18n)

The UI supports **English, Spanish, French, German, Chinese, and Japanese** via a **live language menu** in the header. On first visit it defaults to the **browser/system language** (falling back to English if that isn't supported); once you pick a language from the menu, that choice is remembered across reloads (`localStorage`). Switching is instant — no rebuild. Plain `npm start` shows it working.

It's a small runtime layer: `TranslateService` (`src/app/i18n/`) holds the active language and looks strings up in a generated table; a `translate` pipe renders them — `{{ 'some.id' | translate }}` in markup, or `[matTooltip]="'some.id' | translate"` / `[placeholder]="…"` for attributes. No extra dependencies and no per-locale builds.

**Chat messages** are user-generated text, so they're translated on demand rather than from the table: each incoming message has a **Translate** link (with a **Show original** toggle) that renders it in your selected language via `MessageTranslateService`. It prefers Chrome's built-in **on-device** translator (Chrome 138+) — private, nothing leaves the browser — and falls back to the free **MyMemory** web API on other browsers, so translation works everywhere. Every message is tagged with the sender's language, so the source is known without a detector. Note: the MyMemory fallback sends the message text to that third-party service and has a free-tier daily limit; the on-device path keeps everything local. To swap in a self-hosted/keyed service (e.g. LibreTranslate), change `viaMyMemory()` in `MessageTranslateService`.

### Editing translations

Every string lives in one dictionary in `i18n/generate-i18n.mjs`, which generates `src/app/i18n/translations.ts`:

```bash
cd frontend
node i18n/generate-i18n.mjs       # regenerates src/app/i18n/translations.ts
```

To add or change a string: use `{{ 'my.id' | translate }}` (or `[matTooltip]`/`[placeholder]="'my.id' | translate"`) in the template, add a row with the same id + translations to `i18n/generate-i18n.mjs`, and re-run the script. To add a language, add its column to each row plus an entry in the `LANGS` list.

Palette **categories and component names** come from data (the backend `/api/block-types` and the symbol registries), not from the template, so they're translated separately: they live in the `DATA` table in the same script (keyed by their English text) and are rendered with `i18n.td('English label')`. Anything not listed — e.g. a block a user renamed — falls back to its original text. Search matches both the English and translated names.

> Translations are machine-generated — have a native speaker review before shipping. A few dynamic strings set in TypeScript (transient status-bar messages, the light/dark canvas tooltip) are still English; wrap them with `i18n.t('id')` if you want them translated too.

## How it works

- **AntV X6** (MIT-licensed) handles the canvas: nodes, ports, manhattan-routed edges, selection, snaplines, history. The diagram serializes with `graph.toJSON()` and restores with `graph.fromJSON()`.
- The **animated wires** are plain CSS: edges get `stroke-dasharray` plus a `stroke-dashoffset` keyframe animation (`flowing-line` in `styles.css`) — the same effect you saw in FAST.
- The **palette is data-driven**: Angular fetches `/api/block-types` from Spring Boot, so new block types can come from a database table later without touching the frontend.
- **Spring Boot** stores the whole diagram as a JSON string. For production, switch H2 → PostgreSQL and the column to `jsonb`.

## Next steps after the POC

- Authentication + per-user diagrams (Spring Security / JWT)
- Block metadata (link blocks to product/part data, like FAST's drill-down)
- Custom node shapes (icons, multi-port blocks) via X6 node registration
- PNG/SVG export (`@antv/x6-plugin-export`)
- Validation rules (e.g., which block types may connect to which)
