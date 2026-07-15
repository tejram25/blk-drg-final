// Collaboration engine for live document co-editing.
//
// Wraps the REAL yjs + y-websocket libraries so the Flutter app can join the
// exact same room and Y.Doc the web editor uses, with full CRDT semantics —
// rather than reimplementing Yjs in Dart. It is host-agnostic: the caller
// provides a `WebSocketPolyfill` (Node's `ws` in tests; a Dart-bridged socket
// under flutter_js on device).
//
// Cell convention MUST match the web editor (gojs-collab.service.ts):
//   doc.getMap('cells'):  key `n:<nodeKey>` -> node data,  `l:<linkKey>` -> link data
//   values are plain JSON objects.
//
// Bundled (with yjs + y-websocket inlined) to `ydoc_engine.bundle.js` and
// exposed as `globalThis.Collab`.

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

function modelFromCells(cells) {
  const nodes = [];
  const links = [];
  cells.forEach((value, key) => {
    if (key.startsWith('n:')) nodes.push(value);
    else if (key.startsWith('l:')) links.push(value);
  });
  return { nodes, links };
}

function peersFromAwareness(awareness) {
  const peers = [];
  awareness.getStates().forEach((state, id) => {
    if (id === awareness.clientID) return;
    if (state && state.user) peers.push(state.user);
  });
  return peers;
}

// options: { url, room, WebSocketPolyfill, user, onModel(fn), onPeers(fn) }
export function createCollab(options) {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(options.url, options.room, doc, {
    WebSocketPolyfill: options.WebSocketPolyfill,
  });
  const cells = doc.getMap('cells');

  if (options.user) provider.awareness.setLocalStateField('user', options.user);

  const emitModel = () => options.onModel && options.onModel(modelFromCells(cells));
  cells.observe(emitModel);
  if (options.onPeers) {
    provider.awareness.on('change', () =>
      options.onPeers(peersFromAwareness(provider.awareness)),
    );
  }

  return {
    // Upsert a node/link cell (data is a plain object).
    setNode: (key, data) => cells.set('n:' + key, data),
    setLink: (key, data) => cells.set('l:' + key, data),
    deleteNode: (key) => cells.delete('n:' + key),
    deleteLink: (key) => cells.delete('l:' + key),
    // Replace the whole document (used to seed an empty room).
    seed: (nodes, links) => {
      doc.transact(() => {
        cells.clear();
        for (const n of nodes) cells.set('n:' + n.key, n);
        for (const l of links) cells.set('l:' + (l.key ?? `${l.from}->${l.to}`), l);
      });
    },
    model: () => modelFromCells(cells),
    isSynced: () => provider.synced,
    destroy: () => {
      provider.destroy();
      doc.destroy();
    },
  };
}

// Expose for a JS engine host (flutter_js) that has no ESM module linking.
if (typeof globalThis !== 'undefined') {
  globalThis.Collab = { createCollab };
}
