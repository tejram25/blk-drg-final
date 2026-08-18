#!/usr/bin/env node
/**
 * Starts the y-websocket collaboration relay WITH durable persistence, so
 * rooms — live diagram state and the session chat history — survive server
 * restarts (y-leveldb under the hood). Without this, a relay restart wiped
 * every room and its chat.
 *
 * Storage dir: $YPERSISTENCE, defaulting to ./collab-data next to this file
 * (gitignored). Port/host follow y-websocket's own env vars (PORT, HOST).
 */
import { spawn } from 'child_process';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.YPERSISTENCE = process.env.YPERSISTENCE || path.join(here, 'collab-data');

const PORT = Number(process.env.PORT) || 1234;
const HOST = process.env.HOST || 'localhost';
const probeHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;

// Preflight: is a relay already listening on this port? This is the common
// case when a previous `npm start` was suspended (Ctrl-Z) or left running in
// another terminal. Rather than crash with a cryptic LevelDB LOCK error, tell
// the user plainly and exit cleanly so `ng serve` keeps running.
function portInUse() {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port: PORT, host: probeHost });
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(800);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false)); // ECONNREFUSED => port is free
  });
}

if (await portInUse()) {
  console.log(
    `[collab] port ${PORT} is already in use — a collaboration relay is ` +
    `already running (or a previous run was suspended with Ctrl-Z).\n` +
    `[collab] Reusing the existing relay. If it is stale, stop it first:\n` +
    `[collab]   lsof -ti tcp:${PORT} | xargs kill    # macOS / Linux\n` +
    `[collab] then start again.`
  );
  process.exit(0);
}

console.log(`[collab] persisting rooms to ${process.env.YPERSISTENCE}`);

// The bin isn't in y-websocket's export map, so run it as a child process.
const bin = path.join(here, 'node_modules', 'y-websocket', 'bin', 'server.js');
const child = spawn(process.execPath, [bin], { stdio: ['inherit', 'inherit', 'pipe'], env: process.env });

// Surface the one failure users actually hit — a held/stale LevelDB lock — as
// a plain-English hint instead of a raw leveldown stack trace.
let sawLockError = false;
child.stderr.on('data', (buf) => {
  const text = buf.toString();
  process.stderr.write(text);
  if (/LOCK[^]*(Resource temporarily unavailable|already held)/i.test(text) ||
      /OpenError/.test(text)) {
    sawLockError = true;
  }
});
child.on('exit', (code) => {
  if (sawLockError) {
    console.error(
      `\n[collab] The persistence store (${process.env.YPERSISTENCE}) is locked ` +
      `by another process.\n` +
      `[collab] Another collab-server is still running — often a suspended ` +
      `\`npm start\` (Ctrl-Z). Stop it and retry:\n` +
      `[collab]   lsof -ti tcp:${PORT} | xargs kill\n` +
      `[collab]   # or clear a truly stale lock (only if nothing is running):\n` +
      `[collab]   rm -f "${path.join(process.env.YPERSISTENCE, 'LOCK')}"`
    );
  }
  process.exit(code ?? 0);
});
