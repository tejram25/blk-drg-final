# Block Diagram Builder — React Native (Expo) app

A cross-platform rebuild of the collaborative, electronics-aware block-diagram /
schematic builder, in **React Native + Expo** — one **TypeScript** codebase for
**iOS, Android, and web**. It talks to the existing **Spring Boot** service in
`diagram-poc/backend` as its Backend-for-Frontend (BFF).

## Why Expo (vs. the Flutter build on the `flutter-integration` branch)

- **No local Android Studio / Xcode needed to run**: install **Expo Go** on a
  phone, run `npx expo start`, scan the QR → it runs. Great for locked-down /
  no-admin machines.
- **iOS without a Mac**: build in the cloud with **EAS Build**.
- **Yjs collaboration is native JS** — no embedded-JS bridge (the hard part of
  the Flutter port).
- **The electrical symbols are reused verbatim** from the web app's
  `electrical-shapes.ts` and rendered with `react-native-svg`.
- TypeScript — close to the existing Angular web app.

## Architecture

```
App.tsx                       # providers (Query, Auth, Gesture, SafeArea) + navigation
src/
  config.ts                   # API + collab URLs (EXPO_PUBLIC_* overrides)
  api/client.ts               # fetch wrapper, session-cookie auth, error mapping
  theme.ts
  navigation.ts               # stack param list
  features/
    auth/                     # authApi, AuthContext, Login/Register screens
    diagrams/                 # diagramsApi, DiagramListScreen (React Query)
    editor/
      model.ts                # parse the GoJS GraphLinksModel JSON
      symbols.ts              # electrical symbols, reused from the web app
      DiagramCanvas.tsx       # react-native-svg canvas: pan / pinch / drag
      EditorScreen.tsx
  Preview.tsx                 # EXPO_PUBLIC_PREVIEW=1 renders a sample schematic (for screenshots)
```

State: **React Query** for server state, a small **Auth context** for the
session. Navigation: **React Navigation** (native stack).

## Run it

Backend first (from `diagram-poc/backend`):

```bash
ARROW_MOCK=true mvn -o spring-boot:run     # BFF on :8080
```

Then the app (from `diagram-poc/react-native-app`):

```bash
npm install
npx expo start                              # scan the QR with Expo Go
```

Point it at your backend (localhost means the *device*, so use the right host):

```bash
# physical phone on the same Wi-Fi
EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:8080 npx expo start
```

Other targets:

```bash
npx expo start --web        # browser
npx expo run:android        # emulator/device (needs Android SDK)
```

## Quality gates

```bash
npx tsc --noEmit            # typecheck (clean)
npx expo export --platform web    # web bundle (used for screenshots)
```

## Status & roadmap

**Done:** core (config, session-cookie API client, theme, navigation), auth
(login/register/session), diagram list (open/create/delete), and the editor
canvas — parse a diagram, render blocks + orthogonal links + the full
electrical-symbol set as SVG, with pan / pinch-zoom / tap-select / drag.

**Next (parity with the web/Flutter builds):** palette + create/delete, wiring,
part search + Design-Win attach, comments/reviews/versions, and live
collaboration — which is straightforward here since **Yjs + y-websocket run
directly in JS** (no bridge).
