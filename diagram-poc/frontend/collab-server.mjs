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
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.YPERSISTENCE = process.env.YPERSISTENCE || path.join(here, 'collab-data');
console.log(`[collab] persisting rooms to ${process.env.YPERSISTENCE}`);

// The bin isn't in y-websocket's export map, so run it as a child process.
const bin = path.join(here, 'node_modules', 'y-websocket', 'bin', 'server.js');
const child = spawn(process.execPath, [bin], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
