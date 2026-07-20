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

## Verify
Register in the app → diagram list loads from Render → open a sample, add parts
(bundled catalogue), wire components. Install on a 2nd device, open the same
diagram → live sync via the Render relay.

> Note: data is in-memory (H2) and resets whenever a free service restarts/sleeps.
