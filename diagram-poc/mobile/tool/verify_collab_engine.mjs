// Proves the FULL collaboration design (minus the flutter_js glue): the pure-CRDT
// core driven through the y-websocket *sync* protocol — framed exactly as the
// Dart transport will frame it — co-edits with a real web peer.
import '/home/user/blk-drg-final/diagram-poc/mobile/assets/collab/ydoc_core.bundle.js';
import * as Y from '/home/user/blk-drg-final/diagram-poc/frontend/node_modules/yjs/dist/yjs.mjs';
import { WebsocketProvider } from '/home/user/blk-drg-final/diagram-poc/frontend/node_modules/y-websocket/src/y-websocket.js';
import WS from '/home/user/blk-drg-final/diagram-poc/frontend/node_modules/ws/index.js';

const URL = 'ws://127.0.0.1:1234';
const ROOM = 'gojs-99';
const core = globalThis.CollabCore;

// ---- lib0-style varint framing (mirrors Dart lib0.dart) ----
function writeVarUint(arr, n) { while (n > 0x7f) { arr.push(0x80 | (n & 0x7f)); n >>>= 7; } arr.push(n & 0x7f); }
function encoder() { const a = []; return { a, u: (n) => writeVarUint(a, n), b: (bytes) => { writeVarUint(a, bytes.length); for (const x of bytes) a.push(x); }, out: () => Uint8Array.from(a) }; }
function decoder(bytes) { let p = 0; return { hasMore: () => p < bytes.length, u: () => { let n = 0, s = 0; for (;;) { const b = bytes[p++]; n |= (b & 0x7f) << s; if (b < 0x80) return n >>> 0; s += 7; } }, b: () => { const len = (() => { let n = 0, s = 0; for (;;) { const x = bytes[p++]; n |= (x & 0x7f) << s; if (x < 0x80) return n >>> 0; s += 7; } })(); const out = bytes.slice(p, p + len); p += len; return out; } }; }
const b64ToBytes = (s) => { const buf = Buffer.from(s, 'base64'); return Uint8Array.from(buf); };
const bytesToB64 = (b) => Buffer.from(b).toString('base64');

const SYNC = 0, STEP1 = 0, STEP2 = 1, UPDATE = 2;

// ---- web peer (real app behavior) ----
const webDoc = new Y.Doc();
const webProvider = new WebsocketProvider(URL, ROOM, webDoc, { WebSocketPolyfill: WS });
const webCells = webDoc.getMap('cells');
let webSawCore = false;
webCells.observe(() => { const v = webCells.get('n:c1'); if (v && v.text === 'FromCore') webSawCore = true; });

// ---- our transport: WebSocket + sync protocol driving the CRDT core ----
const sock = new WS(`${URL}/${ROOM}`);
sock.binaryType = 'arraybuffer';
let coreSawWeb = false;

function send(bytes) { sock.send(bytes); }
function sendStep1() { const e = encoder(); e.u(SYNC); e.u(STEP1); e.b(b64ToBytes(core.stateVector())); send(e.out()); }
function sendStep2(remoteSVBytes) { const e = encoder(); e.u(SYNC); e.u(STEP2); e.b(b64ToBytes(core.encodeUpdate(bytesToB64(remoteSVBytes)))); send(e.out()); }
function broadcastLocal() { for (const u of JSON.parse(core.drainLocal())) { const e = encoder(); e.u(SYNC); e.u(UPDATE); e.b(b64ToBytes(u)); send(e.out()); } }

sock.on('open', () => sendStep1());
sock.on('message', (data) => {
  const d = decoder(new Uint8Array(data));
  while (d.hasMore()) {
    const type = d.u();
    if (type === SYNC) {
      const sub = d.u();
      const payload = d.b();
      if (sub === STEP1) sendStep2(payload);
      else { const model = JSON.parse(core.applyRemote(bytesToB64(payload))); if (model.nodes.some((n) => n && n.text === 'FromWebNine')) coreSawWeb = true; }
    } else { d.b(); /* awareness/other: skip payload */ }
  }
});

setTimeout(() => {
  core.setNode('c1', JSON.stringify({ key: 'c1', category: 'block', text: 'FromCore', loc: '5 5' }));
  broadcastLocal();
  webCells.set('n:w9', { key: 'w9', category: 'block', text: 'FromWebNine', loc: '9 9' });
}, 1800);

setTimeout(() => {
  console.log('web-saw-core:', webSawCore ? 'YES' : 'NO');
  console.log('core-saw-web:', coreSawWeb ? 'YES' : 'NO');
  console.log('core-model:', JSON.parse(core.model()).nodes.map((n) => n.text).sort().join(','));
  const ok = webSawCore && coreSawWeb;
  console.log(ok ? 'RESULT PASS full-crdt-transport' : 'RESULT FAIL');
  process.exit(ok ? 0 : 1);
}, 5000);
