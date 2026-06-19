import { Injectable } from '@angular/core';
import { Cell, Graph } from '@antv/x6';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { collabServerUrl } from '../app-config';

/**
 * Real-time collaboration via Yjs (CRDT) + y-websocket.
 *
 * Model: one Y.Map<cellId, cellJSON> per session room. Local X6 changes are
 * written into the map; remote map changes are applied to the graph.
 *
 * Roles matter for the initial state: only the HOST seeds the room with their
 * canvas; guests always take the room's state. This prevents the
 * "union of two canvases" duplication that happens if both sides publish.
 *
 * Run the sync server locally with:  npm run collab-server   (port 1234)
 */
export interface RemoteCursor {
  id: number;
  name: string;
  color: string;
  /** pointer position in graph-local coordinates */
  x: number;
  y: number;
}

/** A member of the current session (includes you), for the roster UI. */
export interface Participant {
  id: number;
  name: string;
  color: string;
  isHost: boolean;
  /** true for the local user (so the UI can tag it "You"). */
  isSelf: boolean;
}

/** A chat message in the session, synced via the room's Yjs doc. */
export interface ChatMessage {
  id: string;
  name: string;
  color: string;
  text: string;
  /** epoch millis */
  ts: number;
  /** UI language the sender was using (source language for translation). */
  lang?: string;
  /** true if the local user sent it (right-aligned bubble). */
  isSelf: boolean;
}

const CURSOR_COLORS = ['#f5a623', '#22c55e', '#38bdf8', '#ef4444', '#a78bfa', '#ec4899', '#14b8a6'];

@Injectable({ providedIn: 'root' })
export class CollabService {

  private doc: Y.Doc | null = null;
  private provider: WebsocketProvider | null = null;
  private cells: Y.Map<any> | null = null;
  private chat: Y.Array<any> | null = null;
  private graph: Graph | null = null;
  private seeded = false;

  // local identity, captured on join so chat messages can be attributed.
  private myClientId = 0;
  /** stable account id (email) shared across this user's tabs. */
  private myUserId = '';
  private myName = '';
  private myColor = '';

  /** true while a remote change is being applied (suppresses echo). */
  private applyingRemote = false;
  /** throttle buffer for high-frequency events (drag/resize). */
  private pending = new Map<string, Cell>();
  private flushTimer: any = null;

  // bound handlers so leave() can detach them (otherwise they stack per join)
  private onAdded = ({ cell }: { cell: Cell }) => this.pushCell(cell);
  private onRemoved = ({ cell }: { cell: Cell }) => this.removeCell(cell);
  private onChanged = ({ cell }: { cell: Cell }) => this.pushCellThrottled(cell);

  peers = 0;
  connected = false;
  /** other members' live pointers (graph coordinates) */
  cursors: RemoteCursor[] = [];
  /** everyone in the room (including you), for the roster panel */
  participants: Participant[] = [];
  /** session chat history, oldest first */
  messages: ChatMessage[] = [];
  private lastCursorSent = 0;

  get active(): boolean {
    return this.provider != null;
  }

  /** Exposed so the History plugin can skip commands caused by remote edits. */
  get isApplyingRemote(): boolean {
    return this.applyingRemote;
  }

  /**
   * Join the room for a file and two-way bind it to the graph. The room id is the
   * file (diagram) id, so everyone viewing the same file shares one room.
   *
   * Seeding is decided on first sync: an empty room means we're first, so seed it
   * from the loaded canvas; otherwise adopt the room's (live) state.
   */
  join(
    graph: Graph,
    room: string,
    displayName: string,
    userId: string,
    serverUrl = collabServerUrl(),
  ): void {
    this.leave();
    this.graph = graph;
    this.seeded = false;
    this.doc = new Y.Doc();
    this.provider = new WebsocketProvider(serverUrl, `diagram-${room}`, this.doc);
    this.cells = this.doc.getMap('cells');
    this.chat = this.doc.getArray('chat');

    this.provider.on('status', (e: { status: string }) => {
      this.connected = e.status === 'connected';
    });

    // ---- presence: identity + live cursors via Yjs awareness ----
    const awareness = this.provider.awareness;
    const color = CURSOR_COLORS[awareness.clientID % CURSOR_COLORS.length];
    // Use the signed-in user's name; fall back to a generated label.
    const name = (displayName || '').trim() || 'User ' + (awareness.clientID % 1000);
    // uid is the stable account id (email): all of a user's tabs share it, so
    // presence can collapse them into a single participant.
    const uid = (userId || '').trim() || `client-${awareness.clientID}`;
    awareness.setLocalStateField('user', { name, color, uid });
    // remember who "I" am so chat messages and self-detection work
    this.myClientId = awareness.clientID;
    this.myUserId = uid;
    this.myName = name;
    this.myColor = color;

    // ---- chat: a shared, ordered log in the room's doc ----
    this.refreshMessages();
    this.chat.observe(() => this.refreshMessages());

    awareness.on('change', () => {
      const states = awareness.getStates();
      const cursors: RemoteCursor[] = [];
      // Collapse all of a user's tabs (same uid) into one roster entry / cursor.
      const byUid = new Map<string, Participant>();
      const cursorUids = new Set<string>();
      states.forEach((state: any, id: number) => {
        if (!state?.user) return;
        const uid = state.user.uid || `client-${id}`;
        const isSelf = uid === this.myUserId || id === awareness.clientID;
        if (!byUid.has(uid)) {
          byUid.set(uid, {
            id,
            name: state.user.name,
            color: state.user.color,
            isHost: !!state.user.isHost,
            isSelf,
          });
        } else if (isSelf) {
          byUid.get(uid)!.isSelf = true;
        }
        // Cursors: never show my own tabs; one cursor per other user.
        if (isSelf || !state?.cursor || cursorUids.has(uid)) return;
        cursorUids.add(uid);
        cursors.push({
          id,
          name: state.user.name,
          color: state.user.color,
          x: state.cursor.x,
          y: state.cursor.y,
        });
      });
      const roster = Array.from(byUid.values());
      roster.sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.id - b.id);
      this.peers = roster.length;
      this.cursors = cursors;
      this.participants = roster;
    });

    // Decide seed-vs-adopt once the initial sync completes: an empty room means
    // we're the first one here, so seed it from the loaded canvas; otherwise the
    // file is already live, so adopt the room's state.
    this.provider.on('sync', (isSynced: boolean) => {
      if (!isSynced || !this.cells || !this.graph || this.seeded) return;
      this.seeded = true;
      if (this.cells.size === 0) {
        this.publishAll();
      } else {
        this.replaceGraphFromRoom();
      }
    });

    // ---- outbound: X6 -> Yjs ----
    graph.on('cell:added', this.onAdded);
    graph.on('cell:removed', this.onRemoved);
    graph.on('cell:changed', this.onChanged);

    // ---- inbound: Yjs -> X6 ----
    this.cells.observe((event) => {
      if (event.transaction.local || !this.graph) return;
      this.applyingRemote = true;
      try {
        event.changes.keys.forEach((change, id) => {
          if (change.action === 'delete') {
            const cell = this.graph!.getCellById(id);
            if (cell) cell.remove();
            return;
          }
          const json = this.cells!.get(id);
          if (!json) return;
          const existing = this.graph!.getCellById(id);
          if (existing) {
            // Update IN PLACE. Removing + re-adding would cascade-delete the
            // node's wires and cause flicker/ghost copies on remote screens.
            existing.prop(json);
          } else if (json.source && json.target) {
            this.graph!.addEdge(json);
          } else {
            this.graph!.addNode(json);
          }
        });
      } finally {
        this.applyingRemote = false;
      }
    });
  }

  /** Broadcast the local pointer (graph coords); pass null when it leaves the canvas. */
  setLocalCursor(point: { x: number; y: number } | null): void {
    if (!this.provider) return;
    const now = Date.now();
    if (point && now - this.lastCursorSent < 16) return; // ~60 updates/s max
    this.lastCursorSent = now;
    this.provider.awareness.setLocalStateField('cursor', point);
  }

  /** Append a chat message to the shared log (broadcast to everyone in the room). */
  sendChat(text: string, lang = ''): void {
    const body = (text || '').trim();
    if (!body || !this.chat) return;
    this.chat.push([{
      id: `${this.myClientId}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      clientId: this.myClientId,
      name: this.myName,
      color: this.myColor,
      text: body,
      ts: Date.now(),
      lang,
    }]);
  }

  /** Rebuild the local view of the chat log from the Y.Array. */
  private refreshMessages(): void {
    if (!this.chat) { this.messages = []; return; }
    this.messages = this.chat.toArray().map((m: any) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      text: m.text,
      ts: m.ts,
      lang: m.lang,
      isSelf: m.clientId === this.myClientId,
    }));
  }

  leave(): void {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    this.pending.clear();
    this.cursors = [];
    this.participants = [];
    this.messages = [];
    if (this.graph) {
      this.graph.off('cell:added', this.onAdded);
      this.graph.off('cell:removed', this.onRemoved);
      this.graph.off('cell:changed', this.onChanged);
    }
    this.provider?.destroy();
    this.doc?.destroy();
    this.provider = null;
    this.doc = null;
    this.cells = null;
    this.chat = null;
    this.graph = null;
    this.seeded = false;
    this.connected = false;
    this.peers = 0;
  }

  /**
   * Replace the room's content with the local canvas. Used when seeding and
   * whenever a participant loads/clears a whole diagram (fromJSON emits no
   * per-cell events, so those changes would otherwise never reach the room).
   */
  publishAll(): void {
    if (!this.cells || !this.graph || !this.doc) return;
    this.doc.transact(() => {
      const liveIds = new Set(this.graph!.getCells().map((c) => c.id));
      const stale: string[] = [];
      this.cells!.forEach((_v, key) => { if (!liveIds.has(key)) stale.push(key); });
      stale.forEach((key) => this.cells!.delete(key));
      this.graph!.getCells().forEach((c) => this.cells!.set(c.id, c.toJSON()));
    });
  }

  // ---- helpers ----

  private pushCell(cell: Cell): void {
    if (this.applyingRemote || !this.cells) return;
    this.cells.set(cell.id, cell.toJSON());
  }

  private removeCell(cell: Cell): void {
    if (this.applyingRemote || !this.cells) return;
    this.cells.delete(cell.id);
  }

  /** Collapse rapid-fire changes (dragging emits dozens per second). */
  private pushCellThrottled(cell: Cell): void {
    if (this.applyingRemote || !this.cells) return;
    this.pending.set(cell.id, cell);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (!this.cells || !this.doc) return;
      this.doc.transact(() => {
        this.pending.forEach((c, id) => {
          if (c.model) this.cells!.set(id, c.toJSON()); // skip cells removed meanwhile
        });
      });
      this.pending.clear();
    }, 80);
  }

  /** Make the local graph exactly mirror the room (guests, initial sync). */
  private replaceGraphFromRoom(): void {
    if (!this.graph || !this.cells) return;
    this.applyingRemote = true;
    try {
      const cells: any[] = [];
      this.cells.forEach((json) => cells.push(json));
      this.graph.fromJSON({ cells });
    } finally {
      this.applyingRemote = false;
    }
  }
}
