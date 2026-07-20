#!/usr/bin/env node
/**
 * Standalone Yjs collaboration relay (Heroku-ready).
 *
 * Speaks the y-websocket wire protocol (sync + awareness), so the mobile app
 * (and any web build) join the same `gojs-<diagramId>` rooms and co-edit live.
 * In-memory only — a restart clears live rooms (fine for a demo). Binds to the
 * platform-assigned $PORT.
 */
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

const PORT = Number(process.env.PORT) || 1234;
const HOST = process.env.HOST || '0.0.0.0';

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

    awareness.on('update', ({ added, updated, removed }) => {
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

  // y-websocket handshake: send our sync-step-1 and current awareness.
  {
    const enc = encoding.createEncoder();
    encoding.writeVarUint(enc, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(enc, room.doc);
    send(conn, encoding.toUint8Array(enc));
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
console.log('[collab] rooms created on demand (gojs-<diagramId>); in-memory only.');
