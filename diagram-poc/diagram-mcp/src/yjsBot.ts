import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import WS from "ws";
import { config } from "./config.js";
import { cellKeyForLink, cellKeyForNode, newKey, type LinkData, type NodeData } from "./model.js";

/**
 * A live participant in a diagram's collaboration room. It joins the same
 * y-websocket room the humans use (`gojs-<diagramId>`), announces itself in the
 * presence roster via awareness, and writes nodes/links straight into the shared
 * `cells` map — so every other client sees the AI's edits stream in with
 * attribution, exactly like a human collaborator. This is the piece that makes
 * "the agent joined the session" real rather than a one-shot generation.
 */
export class DiagramBot {
  readonly doc = new Y.Doc();
  private provider: WebsocketProvider;
  private cells: Y.Map<Record<string, unknown>>;
  private chat: Y.Array<Record<string, unknown>>;

  constructor(diagramId: number | string) {
    this.provider = new WebsocketProvider(config.collabWsUrl, `gojs-${diagramId}`, this.doc, {
      WebSocketPolyfill: WS as unknown as typeof WebSocket,
      connect: true,
    });
    this.cells = this.doc.getMap("cells");
    this.chat = this.doc.getArray("chat");
    this.provider.awareness.setLocalStateField("user", {
      name: config.botName,
      color: "#22d3ee",
      uid: config.botUid,
    });
  }

  /** Resolve once the room has synced (so we edit against current state). */
  whenSynced(): Promise<void> {
    if (this.provider.synced) return Promise.resolve();
    return new Promise((resolve) => this.provider.once("sync", () => resolve()));
  }

  /** Show/clear an "editing" presence flag other clients can render. */
  setEditing(active: boolean): void {
    this.provider.awareness.setLocalStateField("editing", active);
  }

  /** Insert a node into the shared canvas; returns its key. */
  addNode(node: Omit<NodeData, "key"> & { key?: string }): string {
    const key = node.key ?? newKey("n");
    this.cells.set(cellKeyForNode(key), { category: "block", size: "130 80", loc: "0 0", ...node, key });
    return key;
  }

  /** Insert a link into the shared canvas; returns its key. */
  addLink(link: Omit<LinkData, "key"> & { key?: string }): string {
    const key = link.key ?? newKey("l");
    this.cells.set(cellKeyForLink(key), { category: "link", ...link, key });
    return key;
  }

  /** Post a message into the session's shared chat thread. */
  sendChat(text: string): void {
    this.chat.push([
      {
        id: newKey("m"),
        name: config.botName,
        color: "#22d3ee",
        text,
        ts: Date.now(),
        clientId: this.provider.awareness.clientID,
      },
    ]);
  }

  disconnect(): void {
    this.setEditing(false);
    this.provider.destroy();
  }
}

/**
 * Standalone demo: `npm run bot:demo -- <diagramId>` joins the room and adds a
 * decoupling cap wired to ground, then posts a summary — the runnable version of
 * the concept POC. Open the same diagram in the app to watch it appear live.
 */
async function demo(): Promise<void> {
  const diagramId = process.argv.find((a) => /^\d+$/.test(a)) ?? "1";
  const bot = new DiagramBot(diagramId);
  console.error(`[bot] joining room gojs-${diagramId} at ${config.collabWsUrl} …`);
  await bot.whenSynced();
  bot.setEditing(true);
  console.error("[bot] synced. adding cells…");

  const cap = bot.addNode({ category: "symbol", shape: "elec-cap", text: "C1", loc: "305 70", size: "70 48" });
  const gnd = bot.addNode({ category: "symbol", shape: "elec-ground", text: "", loc: "305 300", size: "40 40" });
  bot.addLink({ from: "u1", to: cap });
  bot.addLink({ from: cap, to: gnd });
  bot.sendChat("Added C1 (0.1µF decoupling) on U1's VCC → GND. It's on the shared canvas — undo like any edit.");

  console.error("[bot] done. staying connected 5s so the edits flush…");
  await new Promise((r) => setTimeout(r, 5000));
  bot.disconnect();
  process.exit(0);
}

if (process.argv.includes("--demo")) {
  demo().catch((err) => {
    console.error("[bot] demo failed:", err);
    process.exit(1);
  });
}
