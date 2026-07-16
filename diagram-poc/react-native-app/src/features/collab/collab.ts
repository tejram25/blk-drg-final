import { useEffect, useRef, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { COLLAB_WS_URL } from '../../config';

export interface Peer {
  uid: string;
  name: string;
  color: string;
}

export interface CollabModel {
  nodes: Record<string, unknown>[];
  links: Record<string, unknown>[];
}

const PALETTE = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

/**
 * Live document session over the web app's y-websocket room. The Yjs doc holds
 * `getMap('cells')` with `n:<nodeKey>` / `l:<linkKey>` entries (plain objects),
 * exactly matching the Angular gojs-collab service — so web and RN co-edit the
 * same document. In React Native / web this is plain JS: no bridge needed.
 */
export class CollabSession {
  readonly doc = new Y.Doc();
  readonly provider: WebsocketProvider;
  readonly cells: Y.Map<Record<string, unknown>>;
  readonly color: string;

  constructor(
    diagramId: number,
    user: { name: string; uid: string },
    private handlers: {
      onRemoteModel: (m: CollabModel) => void;
      onPeers: (peers: Peer[]) => void;
      onSync: (roomHasContent: boolean) => void;
    },
  ) {
    this.provider = new WebsocketProvider(COLLAB_WS_URL, `gojs-${diagramId}`, this.doc);
    this.cells = this.doc.getMap('cells');
    this.color = PALETTE[this.provider.awareness.clientID % PALETTE.length];
    this.provider.awareness.setLocalStateField('user', {
      name: user.name,
      color: this.color,
      uid: user.uid,
    });

    // Only remote edits update the local canvas; local edits are already applied.
    this.cells.observe((e) => {
      if (e.transaction.local) return;
      this.handlers.onRemoteModel(this.model());
    });
    this.provider.awareness.on('change', () => this.handlers.onPeers(this.peers()));
    this.provider.on('sync', (isSynced: boolean) => {
      if (isSynced) this.handlers.onSync(this.cells.size > 0);
    });
  }

  model(): CollabModel {
    const nodes: Record<string, unknown>[] = [];
    const links: Record<string, unknown>[] = [];
    this.cells.forEach((v, k) => {
      if (k.startsWith('n:')) nodes.push(v);
      else if (k.startsWith('l:')) links.push(v);
    });
    return { nodes, links };
  }

  peers(): Peer[] {
    const out: Peer[] = [];
    this.provider.awareness.getStates().forEach((state, id) => {
      if (id === this.provider.awareness.clientID) return;
      const u = (state as { user?: Peer }).user;
      if (u) out.push(u);
    });
    return out;
  }

  setNode(key: string, data: Record<string, unknown>) {
    this.cells.set('n:' + key, data);
  }
  setLink(key: string, data: Record<string, unknown>) {
    this.cells.set('l:' + key, data);
  }
  deleteNode(key: string) {
    this.cells.delete('n:' + key);
    // drop links touching the node
    this.doc.transact(() => {
      this.cells.forEach((v, k) => {
        if (k.startsWith('l:') && (v.from === key || v.to === key)) this.cells.delete(k);
      });
    });
  }

  /** Seed an empty room from the local model. */
  seed(nodes: Record<string, unknown>[], links: Record<string, unknown>[]) {
    this.doc.transact(() => {
      for (const n of nodes) this.cells.set('n:' + n.key, n);
      for (const l of links) this.cells.set('l:' + (l.key ?? `${l.from}->${l.to}`), l);
    });
  }

  destroy() {
    this.provider.awareness.setLocalState(null);
    this.provider.destroy();
    this.doc.destroy();
  }
}

/** React hook: manage a CollabSession's lifecycle + presence state. */
export function useCollab(
  active: boolean,
  diagramId: number,
  user: { name: string; uid: string },
  onRemoteModel: (m: CollabModel) => void,
  onSync: (roomHasContent: boolean) => void,
) {
  const [peers, setPeers] = useState<Peer[]>([]);
  const ref = useRef<CollabSession | null>(null);

  useEffect(() => {
    if (!active) return;
    const s = new CollabSession(diagramId, user, {
      onRemoteModel,
      onPeers: setPeers,
      onSync,
    });
    ref.current = s;
    return () => {
      s.destroy();
      ref.current = null;
      setPeers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, diagramId]);

  return { peers, session: ref };
}
