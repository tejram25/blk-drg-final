# Deploying the app

## Web — same drag-and-drop flow as Angular (Apache htdocs)

The Expo app exports a static web build — the same kind of `dist/` folder the
Angular build drops into Apache `htdocs`. It reuses the Angular deployment's
**same origin, same reverse-proxy paths and the same collab server** — nothing
new to stand up on the VM.

Angular deploy (for reference):
`.../frontend/dist/diagram-builder-frontend/browser/` → `htdocs/diagram-builder-frontend/`
→ `https://usdendrh5070.arrow.com/diagram-builder-frontend/`

React deploy (mirror it under a sibling folder, e.g. `diagram-builder-mobile`):

```bash
cd diagram-poc/react-native-app
npm ci
EXPO_BASE_URL=/diagram-builder-mobile \
EXPO_PUBLIC_API_ROOT=https://usdendrh5070.arrow.com/diagram-api \
EXPO_PUBLIC_COLLAB_WS_URL=wss://usdendrh5070.arrow.com/diagram-collab \
EXPO_PUBLIC_GOJS_LICENSE=<your-gojs-key> \
npx expo export --platform web
```

Then drag the **contents of `dist/`** into
`/b001/app/apache_http_dev/htdocs/diagram-builder-mobile/`, exactly like the
Angular `browser/` contents. Open `https://usdendrh5070.arrow.com/diagram-builder-mobile/`.

Why each variable:

- **`EXPO_BASE_URL=/diagram-builder-mobile`** — the sub-path the site is served
  from, so every asset URL is prefixed correctly (equivalent to Angular's
  `--base-href`). It MUST match the htdocs folder name. Baked at export time.
- **`EXPO_PUBLIC_API_ROOT`** — reuses the **existing** Apache proxy the Angular
  app already relies on (`/diagram-api` → backend `/api`). Same origin ⇒ the
  auth session cookie stays first-party and there's no CORS to configure.
- **`EXPO_PUBLIC_COLLAB_WS_URL`** — the **same** collab endpoint Angular uses
  (`/diagram-collab` → the `HOST=127.0.0.1 PORT=1234` y-websocket). Web + phones
  join the identical `gojs-<diagramId>` rooms, so they co-edit together.
- **GoJS license** — without `EXPO_PUBLIC_GOJS_LICENSE` the canvas shows the
  evaluation watermark.

No Apache change is needed if `/diagram-api` and `/diagram-collab` already proxy
for the Angular app — the React site rides on both.

## Collaboration — ONE shared relay for web + mobile

Angular and this app use the **same** Yjs relay and the **same** `gojs-<diagramId>`
rooms, so a browser (Angular) and phones (React) editing the same diagram
collaborate together — live edits, presence and chat. You run **one** relay, not
two.

- The Angular app already starts a relay. Start it bound to the LAN so phones can
  reach it: `cd ../frontend && npm run start:lan` (plain `npm start` binds the
  relay to `localhost`, which phones cannot reach).
- The React app auto-targets `ws://<dev-machine-ip>:1234` in Expo Go — the same
  machine and port — so it connects to that relay automatically. Nothing else to
  start.
- `npm run collab` / `npm run collab:lan` here is only a **fallback** for when the
  Angular relay isn't running; if one is already up on :1234 it detects it and
  exits (reuse), so it never conflicts.
- Deployed web build: point both to the same public relay with
  `EXPO_PUBLIC_COLLAB_WS_URL=wss://<host>:1234`.

The backend deploys as before (Spring Boot):
`cd ../backend && mvn package && java -jar target/*.jar`
(mock part search is on by default; set `ARROW_MOCK=false` + Arrow credentials
for live APIs).

Phones can use the deployed site directly — the UI is responsive and works in
mobile Safari/Chrome ("Add to Home Screen" gives it an app icon).

## Native iOS/Android binaries (different pipeline — not drag-and-drop)

A real installable app is built with EAS:

```bash
npm i -g eas-cli
eas build -p android --profile preview   # → .apk to sideload / MDM-distribute
eas build -p ios --profile preview      # needs an Apple Developer account
```

Android `.apk` can be handed out directly; iOS requires TestFlight or the
company's Apple Business Manager/MDM. The VM plays no role in native builds.
