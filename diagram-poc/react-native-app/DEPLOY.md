# Deploying the app

## Web (your existing VM drag-and-drop flow)

The Expo app exports a static web build — the same kind of `dist/` folder as the
Angular app. From `diagram-poc/react-native-app`:

```bash
npm ci
EXPO_PUBLIC_API_URL=https://<vm-host-or-ip>:8080 \
EXPO_PUBLIC_GOJS_LICENSE=<your-gojs-key> \
npx expo export --platform web
```

Then drag the **contents of `dist/`** to your VM's deploy location, exactly like
the Angular build. Done.

Things that matter:

- **`EXPO_PUBLIC_API_URL` is baked in at export time.** It must be the backend
  URL that *users' browsers* can reach (the VM's hostname/IP, not `localhost`).
  Changing it means re-exporting.
- **CORS**: the backend only accepts browser calls from allow-listed origins.
  Add the deployed site's origin on the backend host:
  `APP_CORS_ALLOWED_ORIGINS=https://<site-origin>,http://localhost:4200 …`
  (If you reverse-proxy `/api` to the backend on the same origin, CORS never
  triggers and you can set `EXPO_PUBLIC_API_URL` to the site's own origin.)
- **Session cookie**: same-site setups work as-is. If the site is served from a
  different origin than the API over HTTPS, set the backend cookie to
  `SameSite=None; Secure` (see `server.servlet.session.cookie.*` in
  `application.properties`).
- **GoJS license**: without `EXPO_PUBLIC_GOJS_LICENSE` the canvas shows the
  evaluation watermark.
- Optional collaboration: `EXPO_PUBLIC_COLLAB_WS_URL=wss://<host>:1234` if the
  y-websocket server runs on the VM.

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
