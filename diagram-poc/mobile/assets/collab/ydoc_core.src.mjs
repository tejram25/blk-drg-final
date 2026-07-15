// Pure-CRDT core for live document co-editing.
//
// Holds the Yjs document (the web editor's `getMap('cells')`) and does ONLY
// synchronous CRDT computation — no networking, no timers. All I/O (the
// WebSocket and the y-websocket *sync* protocol framing) lives in Dart, which
// drives this core through string calls. That keeps the embedded JS runtime
// (flutter_js / QuickJS) free of WebSocket/setTimeout polyfills.
//
// Binary Yjs updates cross the Dart<->JS boundary as base64 strings.
//
// Cell convention matches the web editor exactly:
//   getMap('cells'): `n:<nodeKey>` -> node data, `l:<linkKey>` -> link data.

import * as Y from 'yjs';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toB64(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[c & 63] : '=';
  }
  return out;
}

function fromB64(str) {
  const clean = str.replace(/=+$/, '');
  const out = [];
  let buf = 0;
  let bits = 0;
  for (const ch of clean) {
    buf = (buf << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

function modelJson(cells) {
  const nodes = [];
  const links = [];
  cells.forEach((value, key) => {
    if (key.startsWith('n:')) nodes.push(value);
    else if (key.startsWith('l:')) links.push(value);
  });
  return JSON.stringify({ nodes, links });
}

function createCore() {
  const doc = new Y.Doc();
  const cells = doc.getMap('cells');
  const pending = []; // base64 updates produced by LOCAL edits, awaiting broadcast

  doc.on('update', (update, origin) => {
    if (origin !== 'remote') pending.push(toB64(update));
  });

  return {
    // ---- sync protocol helpers (called by the Dart transport) ----
    stateVector: () => toB64(Y.encodeStateVector(doc)),
    encodeUpdate: (svB64) =>
      toB64(Y.encodeStateAsUpdate(doc, svB64 ? fromB64(svB64) : undefined)),
    applyRemote: (updB64) => {
      Y.applyUpdate(doc, fromB64(updB64), 'remote');
      return modelJson(cells);
    },
    drainLocal: () => {
      const out = pending.slice();
      pending.length = 0;
      return JSON.stringify(out);
    },

    // ---- document mutations (called when the user edits on this device) ----
    setNode: (key, json) => cells.set('n:' + key, JSON.parse(json)),
    setLink: (key, json) => cells.set('l:' + key, JSON.parse(json)),
    deleteNode: (key) => cells.delete('n:' + key),
    deleteLink: (key) => cells.delete('l:' + key),
    seed: (nodesJson, linksJson) => {
      const nodes = JSON.parse(nodesJson);
      const links = JSON.parse(linksJson);
      doc.transact(() => {
        cells.clear();
        for (const n of nodes) cells.set('n:' + n.key, n);
        for (const l of links) cells.set('l:' + (l.key ?? `${l.from}->${l.to}`), l);
      });
    },
    model: () => modelJson(cells),
  };
}

// One document per runtime instance is all the editor needs.
if (typeof globalThis !== 'undefined') {
  globalThis.CollabCore = createCore();
  globalThis.createCollabCore = createCore; // for tests
}

export { createCore };
