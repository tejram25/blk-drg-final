# Frontend startup & load performance

Measured on the reference Linux container (`ng serve`, Angular 21 + Vite):

| Step | Time |
|---|---|
| `ng serve` → server listening, cold cache (`.angular/cache` deleted) | ~9 s |
| `ng serve` → server listening, warm cache | ~8 s |
| First page load in the browser | ~1.0 s |
| Editor route (`/workspace/block-diagram/:id`), first visit | ~0.7 s |

If you see numbers far worse than these, the cause is almost always the
environment rather than the app — see "Why it feels slow on Windows" below.

## What the app already does

- **Everything after login is lazy-loaded.** The initial bundle is 465 kB raw
  (114 kB transferred). GoJS — 1.63 MB on its own — is in the
  `gojs-editor-component` chunk and is fetched only when a diagram is opened,
  never on the dashboard or project pages.
- **Fonts are WOFF2** (~31 kB each). TTF is kept only as a fallback `src`, so
  modern browsers never download it.
- **Animations load asynchronously** (`provideAnimationsAsync`), keeping the
  animation engine out of the initial bundle.
- **Dev builds skip vendor source maps.** GoJS alone emits a 2.5 MB `.map` and
  `@angular/core` 1.6 MB — 7.4 MB total that nobody steps through. App-code
  source maps are still generated, so debugging your own code is unaffected.

## Why the first load is always heavier than later ones

`ng serve` reports "ready" as soon as the dev server is listening, but Vite
pre-bundles dependencies **lazily, on the first browser request**. So the first
load after a cold start pays for optimizing GoJS, Angular, Yjs and friends into
`.angular/cache/…/vite/deps`. Subsequent loads — and every reload after that —
hit that cache and are much faster.

Deleting `.angular/cache` (or changing a dependency) throws that work away and
the next load pays it again. That is expected, not a bug.

## Why it feels slow on Windows

Same code is typically 3–10× slower to build and reload on Windows than on
Linux/macOS. In rough order of impact:

1. **Defender / corporate antivirus scanning `node_modules`.** Every file the
   bundler touches gets scanned. Excluding the project folder and `node_modules`
   from real-time scanning is usually the single biggest win.
2. **The project living on a network drive or OneDrive-synced folder.** Both
   make thousands of small file reads dramatically slower, and OneDrive will
   also try to sync `node_modules` and `.angular/cache`. Keep the repo on a
   local disk, outside any synced folder.
3. **WSL2 crossing the filesystem boundary.** Running `npm start` from WSL
   against a `/mnt/c/...` path is very slow. Keep the repo inside the WSL
   filesystem (`~/…`), or run natively in Windows — not half and half.

## Things that are *not* the problem

- **`npm start` also starts the collaboration relay** (`concurrently` runs
  `ng serve` + `collab-server.mjs`). The relay starts in well under a second; it
  is not part of the wait. Use `npm run serve` if you want the app alone.
- **The GoJS chunk size.** It is lazy; it never delays the dashboard or project
  pages, only the first time a diagram is opened in a session.

## If you need it faster still

- `npm run serve` instead of `npm start` when you are not testing collaboration.
- Keep the dev server running and let hot-reload do the work — an incremental
  rebuild after a file save is a fraction of a cold start.
- Do not delete `.angular/cache` as a troubleshooting reflex; it is the thing
  making restarts fast.
