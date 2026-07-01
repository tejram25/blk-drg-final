import { Injectable } from '@angular/core';
import * as go from 'gojs';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { collabServerUrl } from '../app-config';
import { NotificationService } from './notification.service';
import { ChatMessage, Participant, RemoteCursor } from './collab.service';

/**
 * Real-time collaboration for the GoJS editor, mirroring {@link CollabService}
 * but bound to a go.Diagram / GraphLinksModel instead of an X6 graph.
 *
 * Model: one Y.Map<mapKey, dataJSON> per room, where mapKey is `n:<key>` for a
 * node's data or `l:<key>` for a link's data. Local model changes are written
 * into the map; remote map changes are applied to the model. Node/link data is
 * kept fully JSON-serializable (locations/sizes/spots are stored as strings) so
 * a plain JSON copy round-trips faithfully.
 *
 * Only the first participant in a room seeds it from their canvas; later joiners
 * adopt the room's live state. Presence, cursors, chat and follow-viewport reuse
 * the same awareness protocol as the X6 service.
 */
const CURSOR_COLORS = ['#f5a623', '#22c55e', '#38bdf8', '#ef4444', '#a78bfa', '#ec4899', '#14b8a6'];

@Injectable({ providedIn: 'root' })
export class GojsCollabService {
  private doc: Y.Doc | null = null;
  private provider: WebsocketProvider | null = null;
  private cells: Y.Map<any> | null = null;
  private chatArr: Y.Array<any> | null = null;
  private diagram: go.Diagram | null = null;
  private seeded = false;

  private myClientId = 0;
  private myUserId = '';
  private myName = '';
  private myColor = '';

  /** true while applying a remote change (suppresses echo back to the room). */
  private applyingRemote = false;

  // dirty tracking across a local transaction
  private dirty = new Map<string, any>();
  private removed = new Set<string>();
  private changedListener: ((e: go.ChangedEvent) => void) | null = null;

  peers = 0;
  connected = false;
  cursors: RemoteCursor[] = [];
  participants: Participant[] = [];
  messages: ChatMessage[] = [];
  private lastCursorSent = 0;

  private knownNames = new Map<string, string>();
  private presentUids = new Set<string>();
  private pendingLeave = new Map<string, any>();
  private presenceSeeded = false;
  private readonly leaveGraceMs = 6000;

  private viewports = new Map<string, { x: number; y: number; scale: number }>();
  followUid: string | null = null;
  applyingViewport = false;

  constructor(private notify: NotificationService) {}

  get active(): boolean { return this.provider != null; }
  get isApplyingRemote(): boolean { return this.applyingRemote; }

  /** Join a room and two-way bind it to the diagram's model. */
  join(diagram: go.Diagram, room: string, displayName: string, userId: string, serverUrl = collabServerUrl()): void {
    this.leave();
    this.diagram = diagram;
    this.seeded = false;
    this.presenceSeeded = false;
    this.knownNames = new Map();
    this.presentUids = new Set();
    this.clearPendingLeave();
    this.followUid = null;
    this.viewports = new Map();
    this.doc = new Y.Doc();
    this.provider = new WebsocketProvider(serverUrl, `gojs-${room}`, this.doc);
    this.cells = this.doc.getMap('cells');
    this.chatArr = this.doc.getArray('chat');

    this.provider.on('status', (e: { status: string }) => { this.connected = e.status === 'connected'; });

    // ---- presence / cursors ----
    const awareness = this.provider.awareness;
    const color = CURSOR_COLORS[awareness.clientID % CURSOR_COLORS.length];
    const name = (displayName || '').trim() || 'User ' + (awareness.clientID % 1000);
    const uid = (userId || '').trim() || `client-${awareness.clientID}`;
    awareness.setLocalStateField('user', { name, color, uid });
    this.myClientId = awareness.clientID;
    this.myUserId = uid;
    this.myName = name;
    this.myColor = color;

    this.refreshMessages();
    this.chatArr.observe(() => this.refreshMessages());
    awareness.on('change', () => this.onAwarenessChange(awareness));

    // seed-vs-adopt on first sync
    this.provider.on('sync', (isSynced: boolean) => {
      if (!isSynced || !this.cells || !this.diagram || this.seeded) return;
      this.seeded = true;
      if (this.cells.size === 0) this.publishAll();
      else this.replaceModelFromRoom();
    });

    // ---- outbound: model -> Yjs ----
    this.changedListener = (e: go.ChangedEvent) => this.onModelChanged(e);
    diagram.model.addChangedListener(this.changedListener);

    // ---- inbound: Yjs -> model ----
    this.cells.observe((event) => this.onRemoteCells(event));
  }

  leave(): void {
    this.clearPendingLeave();
    this.presentUids = new Set();
    this.presenceSeeded = false;
    this.dirty.clear();
    this.removed.clear();
    this.cursors = [];
    this.participants = [];
    this.messages = [];
    if (this.diagram && this.changedListener) {
      this.diagram.model.removeChangedListener(this.changedListener);
    }
    this.changedListener = null;
    this.provider?.destroy();
    this.doc?.destroy();
    this.provider = null;
    this.doc = null;
    this.cells = null;
    this.chatArr = null;
    this.diagram = null;
    this.seeded = false;
    this.connected = false;
    this.peers = 0;
    this.followUid = null;
    this.viewports = new Map();
  }

  // ---- outbound model changes ----

  private gm(): go.GraphLinksModel { return this.diagram!.model as go.GraphLinksModel; }

  private kindKey(data: any): string | null {
    const gm = this.gm();
    if (gm.nodeDataArray.indexOf(data) >= 0) return 'n:' + gm.getKeyForNodeData(data);
    if (gm.linkDataArray.indexOf(data) >= 0) return 'l:' + (data as any)['key'];
    return null;
  }

  private onModelChanged(e: go.ChangedEvent): void {
    if (this.applyingRemote || !this.cells) return;

    if (e.change === go.ChangedEvent.Insert || e.change === go.ChangedEvent.Remove) {
      const data = e.newValue ?? e.oldValue;
      const isNode = e.modelChange === 'nodeDataArray';
      const isLink = e.modelChange === 'linkDataArray';
      if ((isNode || isLink) && data) {
        const key = (isNode ? 'n:' : 'l:') + (data['key']);
        if (e.change === go.ChangedEvent.Remove) { this.removed.add(key); this.dirty.delete(key); }
        else { this.dirty.set(key, data); this.removed.delete(key); }
      }
    } else if (e.change === go.ChangedEvent.Property && e.object) {
      const key = this.kindKey(e.object);
      if (key) this.dirty.set(key, e.object);
    }

    if (e.isTransactionFinished) this.flush();
  }

  private flush(): void {
    if (!this.cells || !this.doc) { this.dirty.clear(); this.removed.clear(); return; }
    if (this.dirty.size === 0 && this.removed.size === 0) return;
    this.doc.transact(() => {
      this.removed.forEach((k) => this.cells!.delete(k));
      this.dirty.forEach((data, k) => this.cells!.set(k, this.plain(data)));
    });
    this.dirty.clear();
    this.removed.clear();
  }

  private plain(data: any): any {
    return JSON.parse(JSON.stringify(data));
  }

  // ---- inbound room changes ----

  private onRemoteCells(event: Y.YMapEvent<any>): void {
    if (event.transaction.local || !this.diagram || !this.cells) return;
    const gm = this.gm();
    this.applyingRemote = true;
    const prevSkip = gm.skipsUndoManager;
    gm.skipsUndoManager = true;
    gm.startTransaction('remote');
    try {
      event.changes.keys.forEach((change, key) => {
        const isNode = key.startsWith('n:');
        const rawKey = key.slice(2);
        if (change.action === 'delete') {
          const data = isNode ? gm.findNodeDataForKey(this.coerceKey(rawKey)) : gm.findLinkDataForKey(this.coerceKey(rawKey));
          if (data) { isNode ? gm.removeNodeData(data) : gm.removeLinkData(data); }
          return;
        }
        const json = this.cells!.get(key);
        if (!json) return;
        if (isNode) {
          const existing = gm.findNodeDataForKey(this.coerceKey(rawKey));
          if (existing) gm.assignAllDataProperties(existing, json);
          else gm.addNodeData(json);
        } else {
          const existing = gm.findLinkDataForKey(this.coerceKey(rawKey));
          if (existing) gm.assignAllDataProperties(existing, json);
          else gm.addLinkData(json);
        }
      });
    } finally {
      gm.commitTransaction('remote');
      gm.skipsUndoManager = prevSkip;
      this.applyingRemote = false;
    }
  }

  /** Keys may be numbers or strings; coerce a stringified key back for lookup. */
  private coerceKey(raw: string): go.Key {
    const n = Number(raw);
    return raw !== '' && !isNaN(n) ? n : raw;
  }

  /** Replace the room's contents with the local model (seeding / full republish). */
  publishAll(): void {
    if (!this.cells || !this.diagram || !this.doc) return;
    const gm = this.gm();
    this.doc.transact(() => {
      const live = new Set<string>();
      gm.nodeDataArray.forEach((d) => live.add('n:' + gm.getKeyForNodeData(d)));
      gm.linkDataArray.forEach((d: any) => live.add('l:' + d['key']));
      const stale: string[] = [];
      this.cells!.forEach((_v, k) => { if (!live.has(k)) stale.push(k); });
      stale.forEach((k) => this.cells!.delete(k));
      gm.nodeDataArray.forEach((d) => this.cells!.set('n:' + gm.getKeyForNodeData(d), this.plain(d)));
      gm.linkDataArray.forEach((d: any) => this.cells!.set('l:' + d['key'], this.plain(d)));
    });
  }

  /** Rebuild the local model to mirror the room (initial adopt). */
  private replaceModelFromRoom(): void {
    if (!this.diagram || !this.cells) return;
    const nodes: any[] = [];
    const links: any[] = [];
    this.cells.forEach((json, key) => {
      if (key.startsWith('n:')) nodes.push(json);
      else links.push(json);
    });
    this.applyingRemote = true;
    try {
      const gm = this.emptyLike();
      gm.nodeDataArray = nodes;
      gm.linkDataArray = links;
      this.diagram.model = gm;
      // re-attach outbound listener to the new model
      if (this.changedListener) gm.addChangedListener(this.changedListener);
    } finally {
      this.applyingRemote = false;
    }
  }

  private emptyLike(): go.GraphLinksModel {
    const m = new go.GraphLinksModel<go.ObjectData, go.ObjectData>([], []);
    m.linkFromPortIdProperty = 'fromPort';
    m.linkToPortIdProperty = 'toPort';
    m.linkKeyProperty = 'key';
    m.copiesArrays = true;
    m.copiesArrayObjects = true;
    return m;
  }

  // ---- cursors / viewport ----

  setLocalCursor(point: { x: number; y: number } | null): void {
    if (!this.provider) return;
    const now = Date.now();
    if (point && now - this.lastCursorSent < 16) return;
    this.lastCursorSent = now;
    this.provider.awareness.setLocalStateField('cursor', point);
  }

  setLocalViewport(vp: { x: number; y: number; scale: number }): void {
    if (!this.provider || this.applyingViewport) return;
    this.provider.awareness.setLocalStateField('viewport', vp);
  }

  toggleFollow(uid: string): void {
    if (!uid || uid === this.myUserId) return;
    this.followUid = this.followUid === uid ? null : uid;
    if (this.followUid) this.applyViewport(this.viewports.get(this.followUid));
  }

  private applyViewport(vp?: { x: number; y: number; scale: number }): void {
    if (!vp || !this.diagram) return;
    this.applyingViewport = true;
    try {
      this.diagram.scale = vp.scale;
      this.diagram.position = new go.Point(vp.x, vp.y);
    } finally {
      this.applyingViewport = false;
    }
  }

  // ---- chat ----

  sendChat(text: string, lang = ''): void {
    const body = (text || '').trim();
    if (!body || !this.chatArr) return;
    this.chatArr.push([{
      id: `${this.myClientId}-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      clientId: this.myClientId, name: this.myName, color: this.myColor,
      text: body, ts: Date.now(), lang,
    }]);
  }

  private refreshMessages(): void {
    if (!this.chatArr) { this.messages = []; return; }
    this.messages = this.chatArr.toArray().map((m: any) => ({
      id: m.id, name: m.name, color: m.color, text: m.text, ts: m.ts, lang: m.lang,
      isSelf: m.clientId === this.myClientId,
    }));
  }

  // ---- awareness handling (presence roster + cursors + follow) ----

  private onAwarenessChange(awareness: any): void {
    const states = awareness.getStates();
    const cursors: RemoteCursor[] = [];
    const byUid = new Map<string, Participant>();
    const cursorUids = new Set<string>();
    const freshViewports = new Map<string, { x: number; y: number; scale: number }>();
    states.forEach((state: any, id: number) => {
      if (!state?.user) return;
      const uid = state.user.uid || `client-${id}`;
      if (state.viewport) freshViewports.set(uid, state.viewport);
      const isSelf = uid === this.myUserId || id === awareness.clientID;
      if (!byUid.has(uid)) {
        byUid.set(uid, { id, uid, name: state.user.name, color: state.user.color, isHost: !!state.user.isHost, isSelf });
      } else if (isSelf) {
        byUid.get(uid)!.isSelf = true;
      }
      if (isSelf || !state?.cursor || cursorUids.has(uid)) return;
      cursorUids.add(uid);
      cursors.push({ id, name: state.user.name, color: state.user.color, x: state.cursor.x, y: state.cursor.y });
    });
    const roster = Array.from(byUid.values());
    roster.sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.id - b.id);
    this.peers = roster.length;
    this.cursors = cursors;
    this.participants = roster;
    this.knownNames = new Map(Array.from(byUid.entries()).map(([uid, p]) => [uid, p.name]));

    const currentUids = new Set(byUid.keys());
    if (!this.presenceSeeded) {
      this.presenceSeeded = true;
      this.presentUids = new Set(currentUids);
    } else {
      currentUids.forEach((uid) => {
        const timer = this.pendingLeave.get(uid);
        if (timer) { clearTimeout(timer); this.pendingLeave.delete(uid); }
        if (this.presentUids.has(uid)) return;
        this.presentUids.add(uid);
        const member = byUid.get(uid);
        if (member && !member.isSelf) this.notify.info(`${member.name || 'Someone'} joined the session`);
      });
      this.presentUids.forEach((uid) => {
        if (currentUids.has(uid) || uid === this.myUserId || this.pendingLeave.has(uid)) return;
        const timer = setTimeout(() => {
          this.pendingLeave.delete(uid);
          this.presentUids.delete(uid);
          this.notify.info(`${this.knownNames.get(uid) || 'Someone'} left the session`);
        }, this.leaveGraceMs);
        this.pendingLeave.set(uid, timer);
      });
    }

    this.viewports = freshViewports;
    if (this.followUid) {
      if (!currentUids.has(this.followUid)) this.followUid = null;
      else this.applyViewport(freshViewports.get(this.followUid));
    }
  }

  private clearPendingLeave(): void {
    this.pendingLeave.forEach((t) => clearTimeout(t));
    this.pendingLeave.clear();
  }
}
