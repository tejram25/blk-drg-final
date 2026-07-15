# Collaboration engine — live document co-editing (CRDT)

Real-time co-editing that joins the **web editor's exact `Y.Doc` room** with full
CRDT merge — not a Dart reimplementation of Yjs.

## Design: CRDT in JS, I/O in Dart

- `ydoc_core.src.mjs` → `ydoc_core.bundle.js` — the **pure CRDT core**: the Yjs
  document (`getMap('cells')`) and *only* synchronous CRDT computation
  (`applyRemote`, `encodeUpdate`, `stateVector`, `drainLocal`, cell mutations).
  No networking, no timers — so the embedded JS runtime needs no WebSocket /
  setTimeout polyfills. Bundled IIFE (script-eval, not ESM).
- Dart owns everything else:
  - `collab_doc_engine.dart` — runs the core under [`flutter_js`], owns the
    WebSocket (`web_socket_channel`), and speaks the y-websocket **sync**
    protocol.
  - `sync_protocol.dart` — the sync message framing (step1/step2/update) on the
    shared `lib0` var-int codec.

Binary Yjs updates cross the Dart↔JS boundary as base64.

## Cell convention (matches the web editor)

`getMap('cells')`: `n:<nodeKey>` → node data, `l:<linkKey>` → link data.
See `frontend/.../gojs-collab.service.ts`.

## What is verified vs device-pending

**Verified** (against a real `y-websocket` relay + a web-style Yjs peer):
- The CRDT core + the full sync-protocol transport co-edit bidirectionally:

  ```bash
  # from diagram-poc/frontend, with node_modules installed
  HOST=127.0.0.1 PORT=1234 node node_modules/y-websocket/bin/server.js
  node ../mobile/tool/verify_collab_engine.mjs
  # → RESULT PASS full-crdt-transport  (web sees mobile edit; mobile sees web edit; models merge)
  ```
- The Dart sync framing (`sync_protocol.dart`) has unit tests
  (`test/sync_protocol_test.dart`).

**Device-pending** (needs native QuickJS, can't run in CI here): the
`flutter_js` runtime binding — loading the bundle and the `evaluate()` calls in
`collab_doc_engine.dart`. Run it on a device/emulator to confirm. It is opt-in
and never on the default path; presence collaboration (`collab_service.dart`)
ships and is verified independently.

## Rebuilding

```bash
tool/build_collab_engine.sh   # after `npm install` in diagram-poc/frontend
```
