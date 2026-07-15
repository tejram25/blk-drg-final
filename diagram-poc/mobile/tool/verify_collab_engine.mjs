// Verify the bundled collaboration engine co-edits the SAME Y.Doc/cells map as
// a web-style peer (raw yjs + y-websocket), using the web's n:/l: convention.
import { createCollab } from '/home/user/blk-drg-final/diagram-poc/mobile/assets/collab/ydoc_engine.bundle.js';
import * as Y from '/home/user/blk-drg-final/diagram-poc/frontend/node_modules/yjs/dist/yjs.mjs';
import { WebsocketProvider } from '/home/user/blk-drg-final/diagram-poc/frontend/node_modules/y-websocket/src/y-websocket.js';
import WS from '/home/user/blk-drg-final/diagram-poc/frontend/node_modules/ws/index.js';

const URL = 'ws://127.0.0.1:1234';
const ROOM = 'gojs-77';

// ---- Web-style peer: exactly what the Angular app does ----
const webDoc = new Y.Doc();
const webProvider = new WebsocketProvider(URL, ROOM, webDoc, { WebSocketPolyfill: WS });
const webCells = webDoc.getMap('cells');
let webSawMobileNode = false;
webCells.observe(() => {
  const v = webCells.get('n:m1');
  if (v && v.text === 'FromMobile') webSawMobileNode = true;
});

// ---- Mobile engine (the bundle the Flutter app will run) ----
const mobile = createCollab({
  url: URL,
  room: ROOM,
  WebSocketPolyfill: WS,
  user: { name: 'MobileUser', color: '#3b82f6', uid: 'mobile-1' },
  onModel: () => {},
});

let mobileSawWebNode = false;
const poll = setInterval(() => {
  const model = mobile.model();
  if (model.nodes.some((n) => n && n.text === 'FromWeb')) mobileSawWebNode = true;
}, 200);

// Give both time to connect, then edit from both sides.
setTimeout(() => {
  mobile.setNode('m1', { key: 'm1', category: 'block', text: 'FromMobile', loc: '10 10' });
  webCells.set('n:w1', { key: 'w1', category: 'block', text: 'FromWeb', loc: '99 99' });
}, 1500);

setTimeout(() => {
  clearInterval(poll);
  console.log('web-saw-mobile-node:', webSawMobileNode ? 'YES' : 'NO');
  console.log('mobile-saw-web-node:', mobileSawWebNode ? 'YES' : 'NO');
  console.log('mobile-final-model-nodes:', mobile.model().nodes.map((n) => n.text).sort().join(','));
  const ok = webSawMobileNode && mobileSawWebNode;
  console.log(ok ? 'RESULT PASS bidirectional-crdt-sync' : 'RESULT FAIL');
  mobile.destroy();
  webProvider.destroy();
  process.exit(ok ? 0 : 1);
}, 5000);
