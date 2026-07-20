# Deploy free on Render + build the Android APK

No install, no admin rights, no credit card (Render free tier). Deploy two
services from the GitHub repo's web UI, then build the APK with EAS (cloud).

- **Backend** (Spring Boot, via Dockerfile) → `https://<backend>.onrender.com`
- **Collab relay** (Node) → `wss://<relay>.onrender.com`

Everything runs on **mocked/offline data** — no credentials anywhere.

> Free Render services **sleep after ~15 min idle** and take ~30–60 s to wake on
> the next request. Fine for a demo.

---

## 1. Backend — Render Web Service (Docker)

1. Sign up at https://render.com (GitHub login is easiest) and authorize the
   `tejram25/blk-drg-final` repo.
2. **New → Web Service** → pick the repo.
3. Configure:
   - **Branch**: `react-native-apk`
   - **Root Directory**: `diagram-poc/backend`
   - **Runtime/Environment**: **Docker** (auto-detected from the Dockerfile)
   - **Instance Type**: **Free**
   - Name: `my-diagram-backend`
4. **Create Web Service**. First build takes a few minutes (Maven build inside
   Docker). When live, check:
   `https://my-diagram-backend.onrender.com/actuator/health` → `{"status":"UP"}`

That URL is **`<backend>`**.

## 2. Collab relay — Render Web Service (Node)

1. **New → Web Service** → same repo.
2. Configure:
   - **Branch**: `react-native-apk`
   - **Root Directory**: `diagram-poc/collab-relay`
   - **Runtime**: **Node**
   - **Build Command**: `npm install`
   - **Start Command**: `node collab-server.mjs`
   - **Instance Type**: **Free**
   - Name: `my-diagram-relay`
3. **Create Web Service**. When live, the logs show
   `[collab] Yjs relay listening ...`. Render serves it over `wss://` at
   `wss://my-diagram-relay.onrender.com` — that's **`<relay>`**.

## 3. Android APK (EAS — cloud build, no admin)

1. Edit `diagram-poc/react-native-app/eas.json`, set the `preview` env to your
   two Render URLs:
   ```json
   "env": {
     "EXPO_PUBLIC_API_URL": "https://my-diagram-backend.onrender.com",
     "EXPO_PUBLIC_COLLAB_WS_URL": "wss://my-diagram-relay.onrender.com"
   }
   ```
2. Build:
   ```bash
   cd diagram-poc/react-native-app
   npm ci
   npm i -g eas-cli
   eas login
   eas init
   eas build -p android --profile preview
   ```
3. EAS prints a **`.apk` download link** — install it on any Android device.

## 4. (Optional) Shareable web UI — Render Static Site + QR

Deploy the app's **web build** so anyone can open it in a browser (no install,
any device) and you can share a link / QR. Static sites are free and never sleep.

To keep login working on every browser (Safari blocks cross-site cookies), the
static site proxies `/api` to the backend so the API is **same-origin**.

1. **New → Static Site** → same repo.
2. Configure:
   - **Branch**: `react-native-apk`
   - **Root Directory**: `diagram-poc/react-native-app`
   - **Build Command**: `npm ci && npx expo export --platform web`
   - **Publish Directory**: `dist`
   - Name: `my-diagram-ui`
3. **Environment** (Add Environment Variables):
   - `EXPO_PUBLIC_API_ROOT` = `/api`   ← same-origin, via the rewrite below
   - `EXPO_PUBLIC_COLLAB_WS_URL` = `wss://my-diagram-relay.onrender.com`
   - (leave `EXPO_PUBLIC_GOJS_LICENSE` unset for the demo — the canvas shows a
     small GoJS evaluation watermark; add a licence to remove it.)
4. **Redirects/Rewrites** — add these two, IN ORDER:
   1. Source `/api/*` → Destination `https://my-diagram-backend.onrender.com/api/:splat` → **Rewrite**
   2. Source `/*` → Destination `/index.html` → **Rewrite**  (SPA fallback)
5. **Create Static Site**. When live, share `https://my-diagram-ui.onrender.com`
   (a QR of that URL opens the app on any phone).

WebSockets (collab) connect directly to the relay's `wss://…onrender.com` — not
subject to CORS — so live collaboration works from the shared web app too.

> Note: data is in-memory (H2) and resets whenever a free service restarts/sleeps.
