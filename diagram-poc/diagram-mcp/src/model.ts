/**
 * Helpers for the diagram's persisted `contentJson`, which is a GoJS
 * GraphLinksModel: `{ class, nodeDataArray, linkDataArray }`. A node's position
 * is `loc: "<centerX> <centerY>"` and its size is `size: "<w> <h>"` (the desktop
 * app saves the centre, matching GoJS locationSpot Center). Links carry
 * `from`/`to` node keys and optional `fromPort`/`toPort`.
 *
 * The same node/link objects are what the Yjs room stores under `cells`
 * (`n:<key>` / `l:<key>`), so these shapes drive both the REST save and the
 * live-collaboration path.
 */

export interface NodeData {
  key: string;
  category?: string; // 'symbol' | 'anim' | 'shape' | 'block' | 'part'
  shape?: string; // catalogue key, e.g. 'elec-cap' (must exist in /api/block-types)
  text?: string;
  loc?: string; // "centerX centerY"
  size?: string; // "w h"
  color?: string;
  part?: Record<string, unknown>;
  quantity?: number;
  [k: string]: unknown;
}

export interface LinkData {
  key?: string;
  category?: "link";
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
  [k: string]: unknown;
}

export interface GraphModel {
  class: string;
  nodeDataArray: NodeData[];
  linkDataArray: LinkData[];
  [k: string]: unknown;
}

/** Parse `contentJson` into a model, tolerating an empty/blank document. */
export function parseModel(contentJson: string | null | undefined): GraphModel {
  if (!contentJson || !contentJson.trim()) return emptyModel();
  const m = JSON.parse(contentJson) as Partial<GraphModel>;
  return {
    class: m.class ?? "GraphLinksModel",
    nodeDataArray: Array.isArray(m.nodeDataArray) ? m.nodeDataArray : [],
    linkDataArray: Array.isArray(m.linkDataArray) ? m.linkDataArray : [],
    ...m,
  };
}

export function emptyModel(): GraphModel {
  return { class: "GraphLinksModel", nodeDataArray: [], linkDataArray: [] };
}

export function serialize(model: GraphModel): string {
  return JSON.stringify(model);
}

/** A short, collision-resistant key for a new cell. */
export function newKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Add a node in place; returns its key. */
export function addNode(model: GraphModel, node: Omit<NodeData, "key"> & { key?: string }): string {
  const key = node.key ?? newKey("n");
  model.nodeDataArray.push({ category: "block", size: "130 80", loc: "0 0", ...node, key });
  return key;
}

/** Add a link in place; returns its key. */
export function addLink(model: GraphModel, link: Omit<LinkData, "key"> & { key?: string }): string {
  const key = link.key ?? newKey("l");
  model.linkDataArray.push({ ...link, category: "link", key } as LinkData);
  return key;
}

/** Attach a catalogue part (with quantity) to an existing node's part list. */
export function attachPart(model: GraphModel, nodeKey: string, part: Record<string, unknown>, quantity = 1): boolean {
  const node = model.nodeDataArray.find((n) => n.key === nodeKey);
  if (!node) return false;
  const parts = Array.isArray(node.parts) ? (node.parts as Record<string, unknown>[]) : [];
  parts.push({ part, quantity });
  node.parts = parts;
  return true;
}

/** Reduce the model to the `{name,type}` blocks + `{from,to}` links the design-review endpoint expects. */
export function toReviewShape(model: GraphModel): {
  blocks: { name: string; type: string }[];
  links: { from: string; to: string }[];
} {
  return {
    blocks: model.nodeDataArray.map((n) => ({
      name: String(n.text ?? n.key),
      type: String(n.shape ?? n.category ?? "block"),
    })),
    links: model.linkDataArray.map((l) => ({ from: String(l.from), to: String(l.to) })),
  };
}

/** The `cells`-map key a node/link occupies in the Yjs room. */
export const cellKeyForNode = (key: string) => `n:${key}`;
export const cellKeyForLink = (key: string) => `l:${key}`;
