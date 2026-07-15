#!/usr/bin/env bash
# Bundle the collaboration engine (yjs + y-websocket + our wrapper) into a
# single JS asset the Flutter app loads at runtime via an embedded JS engine.
#
# yjs / y-websocket / esbuild come from the web app's node_modules, so run this
# after `npm install` in diagram-poc/frontend.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"          # diagram-poc/mobile
FRONTEND="$(cd "$HERE/../frontend" && pwd)"

# The pure-CRDT core is what the app runs under flutter_js: IIFE format (no
# top-level ESM export, which the script-eval runtime can't link).
SRC="$HERE/assets/collab/ydoc_core.src.mjs"
OUT="$HERE/assets/collab/ydoc_core.bundle.js"

tmp="$FRONTEND/_ydoc_build_tmp.mjs"
# Drop the ESM export line for the script-eval build.
sed 's/^export { createCore };//' "$SRC" > "$tmp"
trap 'rm -f "$tmp"' EXIT

"$FRONTEND/node_modules/.bin/esbuild" "$tmp" \
  --bundle --format=iife --platform=neutral \
  --outfile="$OUT"

echo "Built $OUT ($(wc -c < "$OUT") bytes)"
echo "Verify interop against a running relay (ws://127.0.0.1:1234):"
echo "  node $HERE/tool/verify_collab_engine.mjs"
