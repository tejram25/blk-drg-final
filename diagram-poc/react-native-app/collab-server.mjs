#!/usr/bin/env node
/**
 * Self-contained Yjs collaboration relay for the app.
 *
 * Speaks the exact y-websocket wire protocol (sync + awareness), so it serves
 * BOTH this React Native app and the Angular desktop app — they join the same
 * `gojs-<diagramId>` rooms, so two phones (or a phone + a desktop) on the same
 * diagram co-edit and share the session chat.
 *
 * Run it on the machine the phones can reach, bound to the LAN:
 *   HOST=0.0.0.0 PORT=1234 node collab-server.mjs
 * (npm run collab). Then the app connects to ws://<that-machine-ip>:1234, which
 * it derives automatically in Expo Go, or set EXPO_PUBLIC_COLLAB_WS_URL.
 *
 * In-memory only (no persistence) — a restart clears live rooms; that's fine
 * for a POC. Deps (ws, yjs, y-protocols, lib0) are already installed.
 */
import ws from 'ws';
import * as Y from 'yjs';

// ws 7 exposes Server; ws 8+ exposes WebSocketServer — support both.
const WebSocketServer = ws.WebSocketServer || ws.Server;
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

import net from 'net';

const PORT = Number(process.env.PORT) || 1234;
const HOST = process.env.HOST || '0.0.0.0';

// If a relay is already listening on this port — typically the one the Angular
// app starts (`npm run start:lan`) — reuse it instead of crashing on EADDRINUSE.
// Both apps speak the same protocol and join the same `gojs-<id>` rooms, so a
// single relay serves web + mobile. You only need THIS server when Angular's
// relay isn't running.
const probeHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
const inUse = await new Promise((resolve) => {
  const sock = net.createConnection({ port: PORT, host: probeHost });
  const done = (v) => { sock.destroy(); resolve(v); };
  sock.setTimeout(700);
  sock.once('connect', () => done(true));
  sock.once('timeout', () => done(false));
  sock.once('error', () => done(false));
});
if (inUse) {
  console.log(`[collab] port ${PORT} already has a relay (e.g. the Angular app's) — reusing it.`);
  console.log('[collab] Web (Angular) and mobile (React) share this one relay. Nothing to start here.');
  process.exit(0);
}

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

/** One shared doc + awareness per room, with the set of connected sockets. */
const rooms = new Map();

function getRoom(name) {
  let room = rooms.get(name);
  if (!room) {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);
    const conns = new Set();

    doc.on('update', (update, origin) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.writeUpdate(enc, update);
      const msg = encoding.toUint8Array(enc);
      conns.forEach((c) => { if (c !== origin) send(c, msg); });
    });

    awareness.on('update', ({ added, updated, removed }, origin) => {
      const changed = added.concat(updated, removed);
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
      const msg = encoding.toUint8Array(enc);
      conns.forEach((c) => send(c, msg));
    });

    room = { doc, awareness, conns };
    rooms.set(name, room);
  }
  return room;
}

function send(conn, msg) {
  if (conn.readyState !== 1) return; // OPEN
  try { conn.send(msg); } catch { /* dropped socket */ }
}

const wss = new WebSocketServer({ host: HOST, port: PORT });

wss.on('connection', (conn, req) => {
  const roomName = (req.url || '/').slice(1).split('?')[0] || 'default';
  const room = getRoom(roomName);
  room.conns.add(conn);
  conn.binaryType = 'arraybuffer';

  // Step 1 of the y-websocket handshake: send our sync-step-1.
  {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(enc, room.doc);
    send(conn, encoding.toUint8Array(enc));
    // Send current awareness (who's already here) to the newcomer.
    const states = room.awareness.getStates();
    if (states.size > 0) {
      const aenc = encoding.createEncoder();
      encoding.writeVarUint(aenc, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        aenc,
        awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys())),
      );
      send(conn, encoding.toUint8Array(aenc));
    }
  }

  conn.on('message', (data) => {
    const buf = new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer || data);
    const dec = decoding.createDecoder(buf);
    const enc = encoding.createEncoder();
    const type = decoding.readVarUint(dec);
    if (type === MESSAGE_SYNC) {
      encoding.writeVarUint(enc, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(dec, enc, room.doc, conn);
      if (encoding.length(enc) > 1) send(conn, encoding.toUint8Array(enc));
    } else if (type === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(dec), conn);
    }
  });

  const cleanup = () => {
    room.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(room.awareness, [conn.__clientId].filter(Boolean), null);
    if (room.conns.size === 0) rooms.delete(roomName); // free empty rooms
  };
  conn.on('close', cleanup);
  conn.on('error', cleanup);
});

console.log(`[collab] Yjs relay listening on ws://${HOST}:${PORT}`);
console.log('[collab] rooms are created on demand (gojs-<diagramId>); in-memory only.');
