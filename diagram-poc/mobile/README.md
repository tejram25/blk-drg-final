# Block Diagram Builder — Flutter app (Android + iOS)

A native mobile rebuild of the collaborative, electronics-aware block-diagram /
schematic builder. It runs on **Android and iOS** from a single Flutter
codebase and talks to the existing **Spring Boot** service in
`diagram-poc/backend`, which acts as the **Backend-for-Frontend (BFF)**.

## Why BFF

The Spring Boot backend already aggregates the domain services (diagrams,
auth, parts, reviews, recommendations, …) and exposes a REST API shaped for a
single client. Rather than stand up a second gateway, the mobile app consumes
that same API as its BFF. Authentication uses the backend's **server-side
session cookie** (`JSESSIONID`); the app persists cookies across launches, so
there is no token handling on the client.

```
Flutter app  ──HTTPS/JSON──▶  Spring Boot BFF  ──▶  domain services + DB
(Android/iOS)                 (diagram-poc/backend)
```

## Architecture

Feature-first clean architecture. Each feature owns its `data` (repositories +
DTO mapping), `domain` (models), and `presentation` (Riverpod controllers +
screens) layers.

```
lib/
  main.dart                     # bootstrap: build async singletons, inject via ProviderScope
  app/
    app.dart                    # MaterialApp.router
    router.dart                 # go_router + auth-guard redirect
    theme.dart                  # light/dark Material 3 themes
  core/
    config/app_config.dart      # API base URL (--dart-define), timeouts
    network/api_client.dart     # Dio + persistent cookie jar (session auth)
    network/api_exception.dart  # normalized, user-facing errors
    di/providers.dart           # core DI (ApiClient)
  features/
    auth/       (login, register, session restore)
    diagrams/   (list, create, delete)
    editor/     (diagram model + interactive canvas)
```

**State management:** Riverpod (`AsyncNotifier` for auth and the diagram list).
The editor uses a plain `ChangeNotifier` session so it stays independent of any
package's family-notifier API.

**The canvas** (`features/editor/presentation/diagram_canvas.dart`) is a
hand-rolled `CustomPainter` renderer — the mobile counterpart to the web GoJS
canvas, with no web-only dependency. It parses the GoJS `GraphLinksModel` JSON
saved by the web editor (`nodeDataArray` / `linkDataArray`, `loc: "x y"`),
renders node cards and orthogonal links, and supports pan, pinch-zoom,
tap-to-select and one-finger node drag. Edited positions are serialized back
into the same model shape on save, preserving fields the mobile client doesn't
model yet.

## Running

The app needs the backend running. From `diagram-poc/backend`:

```bash
ARROW_MOCK=true mvn -o spring-boot:run      # serves the BFF on :8080
```

Then, from `diagram-poc/mobile`:

```bash
flutter pub get
flutter run                                 # Android emulator (defaults to 10.0.2.2:8080)
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:8080   # physical device on LAN
```

- **Android emulator** reaches the host backend via `10.0.2.2` (the default).
- **iOS simulator** reaches it via `localhost` — pass
  `--dart-define=API_BASE_URL=http://localhost:8080`.
- **Physical device** — pass your machine's LAN IP.

Cleartext HTTP is enabled only for local dev hosts (Android
`network_security_config.xml`, iOS `NSAllowsLocalNetworking`); release builds
are HTTPS-only.

## Quality gates

```bash
flutter analyze        # static analysis — currently clean
flutter test           # unit tests (diagram model parser)
```

## Status & roadmap

**Implemented (this branch):**
- Core: config, session-cookie networking, error mapping, theming, DI, routing
  with an auth guard.
- Auth: login, register (with invite-code support), session restore, logout.
- Diagrams: list, create, delete, pull-to-refresh.
- Editor:
  - Load and render a diagram on the interactive canvas; pan / pinch-zoom /
    tap-to-select / one-finger node drag; save.
  - **Palette** (blocks + shapes + electrical symbols) with tap-to-place;
    delete selected node and its links.
  - **Tap-to-connect wiring**: tap two components to link them (schematic wire
    between symbols, connector otherwise).
  - **Electrical symbols** rendered as vector schematic art — the full ~75
    symbol set, generated from the web app's definitions (`tool/gen_symbols.mjs`
    → `electrical_symbols.g.dart`) so a symbol looks identical on both.
  - **Part search + attach**: search the catalogue (`/api/parts/search`) and
    attach an MPN to a node; stored under `attachedParts` in the same shape the
    web editor uses (round-trips), shown as a count badge on the node.

**Next phases (parity with the web app):**
- Real-time collaboration (the web app uses Yjs/y-websocket; the mobile client
  would bridge the same room protocol or a WebSocket sync channel).
- Design-Win panel, BOM roll-up, comments, reviews, templates, versioning.
- Pin-accurate wire endpoints; offline cache + optimistic sync; CI
  build/signing for the app stores.

### Regenerating the electrical symbols

```bash
node tool/gen_symbols.mjs   # re-reads the web app's electrical-shapes.ts
```

> Building signed Android/iOS binaries requires the Android SDK / Xcode
> toolchains on the build machine; this repo's code is verified with
> `flutter analyze` and `flutter test`.
