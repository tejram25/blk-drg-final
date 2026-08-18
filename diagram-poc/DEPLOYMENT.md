# Deploying to dev 

This app is **three separate processes**, all currently **single-instance** (state is in memory). Read the "Must-knows" section — a couple of items will silently break the app if missed (HTTPS/WebSocket and running more than one replica).

## Components

| Service | Tech | Listens on | Notes |
|---|---|---|---|
| Frontend | Angular 17 — static build | served via proxy (80/443) | plain static files, no Node runtime at serve time |
| Backend API | Spring Boot 3.2 (Java 17) | `8080` | REST under `/api`, file-based H2 DB |
| Collab server | `y-websocket` (Node 18+) | `1234` | WebSocket; realtime canvas + chat; in-memory rooms |

Runtimes needed: **Java 17+** (backend run), **Maven** (backend build), **Node 18+** (frontend build + collab server).

## Build & run

**Frontend** (set endpoints first — see Configuration):
```bash
cd frontend
npm ci
npm run build           # outputs static files to dist/diagram-builder-frontend/browser/
```
Serve the contents of `dist/diagram-builder-frontend/browser/` as static files, with SPA fallback to `index.html`.

**Backend:**
```bash
cd backend
mvn clean package       # -> target/diagram-builder-0.0.1-SNAPSHOT.jar
java -jar target/diagram-builder-0.0.1-SNAPSHOT.jar
```

**Collab server** (run as a managed process — systemd/pm2/container):
```bash
cd frontend
HOST=0.0.0.0 PORT=1234 node node_modules/.bin/y-websocket
```

## Recommended topology: one HTTPS origin + reverse proxy

Put all three behind a single TLS-terminating reverse proxy and route by path. This is the cleanest option — it removes CORS and mixed-content problems entirely:

- `/`        → static frontend
- `/api`     → `http://backend:8080`
- `/collab`  → `http://collab:1234`  **(must forward WebSocket upgrade headers)**

Then build the frontend pointing at those paths in `frontend/src/environments/environment.prod.ts`:
```ts
apiBase: '/api',
collabUrl: '/collab',
```

### nginx example
```nginx
server {
  listen 443 ssl;
  server_name dev.example.com;
  # ssl_certificate / ssl_certificate_key ...

  root /var/www/diagram/browser;
  location / { try_files $uri $uri/ /index.html; }

  location /api/ {
    proxy_pass http://127.0.0.1:8080;
  }

  location /collab {
    proxy_pass http://127.0.0.1:1234;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # required for WebSocket
    proxy_set_header Connection "upgrade";       # required for WebSocket
    proxy_read_timeout 1h;                        # keep long-lived sockets open
  }
}
```

## Must-knows / gotchas

1. **Serve over HTTPS, and the proxy must handle the WebSocket upgrade.** The frontend auto-matches protocol: on an HTTPS page it calls `https://` for the API and `wss://` for collab. If the backend/collab aren't reachable over TLS (directly or via the proxy above), the browser blocks them as mixed content and **saving + realtime collaboration + chat silently fail**. The `/collab` location must pass `Upgrade`/`Connection` headers or the WebSocket never connects.

2. **Run exactly one instance of the backend and one of the collab server.** Collaboration session codes live in the backend's memory (`CollabSessionController`) and the shared documents live in the `y-websocket` process's memory. More than one replica → users land in different copies and codes won't resolve. No autoscaling. (Scaling later needs a shared store/Redis + sticky WebSocket sessions.)

3. **Database persistence.** Backend uses file-based H2 at `./data/` relative to its working directory (`spring.datasource.url=jdbc:h2:file:./data/diagrams`). **Mount a persistent volume there**, or saved diagrams reset on every redeploy. Schema auto-migrates (`ddl-auto=update`). This is a POC datastore — plan to swap to PostgreSQL for anything beyond dev.

4. **Disable the H2 web console in shared environments.** It's currently enabled at `/h2-console` (`spring.h2.console.enabled=true`) — that's a full DB admin UI. Set `spring.h2.console.enabled=false` (or firewall it) for dev/stage.

5. **CORS is an explicit allowlist.** The backend permits credentialed requests only from origin patterns in `app.cors.allowed-origins` — defaulting to local dev plus `https://*.arrow.com`, so the standard Arrow reverse-proxy deployment works out of the box. Note that even behind a same-origin reverse proxy the browser sends an `Origin` header on POSTs and the backend can't always detect same-origin, so the deployment origin must be allowlisted. For a host outside `*.arrow.com`, set `APP_CORS_ALLOWED_ORIGINS=https://your.host` (comma-separated; wildcards allowed). Never set it to a bare `*` — credentials + reflected any-origin lets any site read a signed-in user's data.

6. **Outbound translation call (optional feature).** Chat message translation uses Chrome's private on-device engine when available; otherwise it falls back to the free **MyMemory** API, called **from the user's browser** to `https://api.mymemory.translated.net`. If you apply a Content-Security-Policy, `connect-src` must allow that host plus `'self'` (and the API/WS origins if not same-origin). No server-side egress needed. The on-device engine only activates over HTTPS.

7. **Authentication is session-cookie based, so the API must be same-origin with the app.** The recommended reverse-proxy topology already satisfies this (`/` and `/api` on one origin), and `environment.prod.ts` defaults to `apiBase: '/api'`. Serving the API on a different origin would force the session cookie to `SameSite=None; Secure` (HTTPS only) plus credentialed CORS — prefer same-origin. Sessions live in the backend's memory, so run a **single** backend instance (same constraint as the collab server). **CSRF is disabled** for the POC; see the note in `SecurityConfig.java` to enable it.

8. **Accounts are self-registered (email + password, no verification) and persisted in H2.** Registration is open by default — to gate it, set `app.registration.invite-code` in `application.properties` so sign-ups require a shared code. Users live in the `app_users` table, so mount the DB volume (gotcha #3) or accounts reset on redeploy. No SMTP/email is involved.

## Configuration knobs

| What | Where | Default |
|---|---|---|
| API base + collab URL | `frontend/src/environments/environment.prod.ts` (**build-time**) | empty = auto-derive to `<host>:8080` / `<host>:1234` |
| Backend port | `backend/.../application.properties` → `server.port` | `8080` |
| Collab host/port | `y-websocket` env vars `HOST` / `PORT` | `0.0.0.0` / `1234` |
| DB file location | `application.properties` → `spring.datasource.url` | `./data/diagrams` |

> Frontend endpoints are baked in at **build time**, not read from runtime env vars. If you need the same artifact to target multiple environments, build once per environment (or we can switch to a runtime-loaded config file — ask).

## Smoke test after deploy

1. `GET https://<host>/api/block-types` → `200` with JSON.
2. Open the app, drag a block onto the canvas, **Save**, reload → it appears under "Open saved…". (API path OK)
3. Open the app in two browsers; **Collaborate → Start a session** in one, **Join** with the code in the other → edits and chat sync live. (WebSocket path OK — this is the one most likely to fail behind a proxy)
4. Switch the header language; the UI translates instantly. (Static-only, should always work)
