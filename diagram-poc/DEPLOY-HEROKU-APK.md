# Deploy: Backend + Collab relay on Heroku, Android APK for the mobile app

This app is fully **de-branded** and runs **entirely on mocked data** — no Arrow
APIs, no credentials, no external accounts. Parts search and Design-Win serve
bundled sample JSON; AI uses a built-in rule engine.

You will deploy **two** Heroku apps and build **one** Android APK:

1. **Backend** (Spring Boot) → `https://<backend>.herokuapp.com`
2. **Collab relay** (Node/Yjs) → `wss://<relay>.herokuapp.com`
3. **APK** (React Native) → points at both.

Prerequisites: a free Heroku account, the **Heroku CLI**, **git**, and (for the
APK) a free **Expo** account + **EAS CLI**. The backend is in `diagram-poc/backend`,
the relay in `diagram-poc/collab-relay`, the app in `diagram-poc/react-native-app`.

---

## Part 1 — Backend to Heroku

The backend lives in a subdirectory, so we push just that folder with
`git subtree`. It already has a `Procfile`, `system.properties` (Java 17), binds
to `$PORT`, and uses in-memory H2 (data resets on restart — fine for a demo).

```bash
# from the repo root
heroku login
heroku create my-diagram-backend            # pick a unique name → <backend>

# push ONLY the backend subfolder as that app's root
git subtree push --prefix diagram-poc/backend heroku-backend main
```

If `git subtree push` complains (it can't force-push), use the split trick:

```bash
heroku git:remote -a my-diagram-backend -r heroku-backend
git subtree split --prefix diagram-poc/backend -b _backend_deploy
git push heroku-backend _backend_deploy:main --force
git branch -D _backend_deploy
```

Heroku auto-detects Maven, builds `target/app.jar`, and runs the `Procfile`.
Verify:

```bash
heroku logs --tail -a my-diagram-backend       # look for "Started ... in N seconds"
curl https://my-diagram-backend.herokuapp.com/actuator/health   # {"status":"UP"}
```

Note the URL — that's **`<backend>`** = `https://my-diagram-backend.herokuapp.com`.

(Optional) allow a browser web build's origin:
`heroku config:set APP_CORS_ALLOWED_ORIGINS=https://your-site -a my-diagram-backend`
— **not needed for the APK**, which is native and doesn't use CORS.

---

## Part 2 — Collab relay to Heroku

Same subtree approach for `diagram-poc/collab-relay` (Node app; binds `$PORT`).

```bash
heroku create my-diagram-relay               # → <relay>
heroku git:remote -a my-diagram-relay -r heroku-relay

git subtree split --prefix diagram-poc/collab-relay -b _relay_deploy
git push heroku-relay _relay_deploy:main --force
git branch -D _relay_deploy
```

Heroku detects Node, installs deps, runs `web: node collab-server.mjs`. Verify:

```bash
heroku logs --tail -a my-diagram-relay        # "[collab] Yjs relay listening on ws://0.0.0.0:<port>"
```

The relay speaks WSS automatically through Heroku's router, so the app connects
with `wss://my-diagram-relay.herokuapp.com`. That's **`<relay>`**.

> Heroku free/eco dynos sleep when idle; the first request after a nap takes a
> few seconds to wake. Fine for a demo.

---

## Part 3 — Build the Android APK (EAS)

The APK uses the app's **native canvas** (no GoJS) — so **no GoJS license** is
needed and there's no watermark.

1. Put your two Heroku URLs into `diagram-poc/react-native-app/eas.json`
   (replace the `YOUR-BACKEND` / `YOUR-RELAY` placeholders in the `preview` env):

   ```json
   "env": {
     "EXPO_PUBLIC_API_URL": "https://my-diagram-backend.herokuapp.com",
     "EXPO_PUBLIC_COLLAB_WS_URL": "wss://my-diagram-relay.herokuapp.com"
   }
   ```
   (The app derives the API base as `EXPO_PUBLIC_API_URL` + `/api` automatically.)

2. Build the APK:

   ```bash
   cd diagram-poc/react-native-app
   npm ci
   npm i -g eas-cli
   eas login                 # your Expo account
   eas init                  # creates the EAS project (sets projectId) — one time
   eas build -p android --profile preview
   ```

3. When the cloud build finishes, EAS prints a URL to **download the `.apk`**.
   Install it on any Android device (enable "Install unknown apps"), or
   distribute via MDM. Sign in with an account you register in the app (open
   registration; data lives in the backend's in-memory H2).

---

## Verify end-to-end

1. Open the APK, register/sign in → the diagram list loads from the Heroku backend.
2. Open a sample diagram, add components, wire them (Connect), attach a part
   (Part search returns the bundled sample catalogue).
3. Install the APK on a second device, open the **same diagram** → moves/wires/
   chat sync live via the Heroku relay (`gojs-<diagramId>` room).

## Notes
- **No credentials anywhere** — parts/Design-Win/AI are all mocked/offline.
- **Data is ephemeral** — accounts and saved diagrams reset when a dyno restarts
  or redeploys. Add Heroku Postgres later if you need persistence.
- **iOS**: `eas build -p ios --profile preview` needs an Apple Developer account;
  distribute via TestFlight/MDM.
