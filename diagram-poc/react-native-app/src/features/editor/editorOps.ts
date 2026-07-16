import { BlockType, isShape, isSymbol } from './catalogApi';
import { DiagramGraph, linkFromRaw, linkId, nodeFromRaw } from './model';
import { ELECTRICAL_META, ELECTRICAL_SYMBOLS } from './symbols';

/** Next unused integer node key. */
export function newKey(g: DiagramGraph): string {
  let max = 0;
  for (const n of g.nodes) {
    const k = parseInt(n.key, 10);
    if (!isNaN(k) && k > max) max = k;
  }
  return `${max + 1}`;
}

/** Next reference designator for a prefix (R1, R2, … / U1, U2 …). */
function nextRefdes(g: DiagramGraph, prefix: string): string {
  let max = 0;
  const re = new RegExp(`^${prefix}(\\d+)$`);
  for (const n of g.nodes) {
    const m = re.exec(n.text);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${max + 1}`;
}

/** Add a palette entry at (x,y); returns the new graph and the new node key. */
export function addNode(
  g: DiagramGraph,
  block: BlockType,
  x: number,
  y: number,
): { graph: DiagramGraph; key: string } {
  const key = newKey(g);
  const loc = `${x} ${y}`;
  let raw: Record<string, unknown>;

  if (isSymbol(block)) {
    const def = ELECTRICAL_SYMBOLS[block.shape!];
    const ref = ELECTRICAL_META[block.shape!]?.ref ?? '';
    raw = {
      key,
      category: 'symbol',
      shape: block.shape,
      text: ref ? nextRefdes(g, ref) : '',
      size: def ? `${def.width} ${def.height}` : '100 40',
      loc,
    };
  } else if (isShape(block)) {
    raw = { key, category: 'shape', shape: block.shape, text: block.label, color: '#ffffff', size: '140 90', loc };
  } else {
    raw = {
      key,
      category: 'block',
      text: block.label,
      subtitle: block.category,
      color: block.color,
      icon: block.icon ?? 'widgets',
      size: '150 64',
      loc,
    };
  }

  return {
    graph: { ...g, nodes: [...g.nodes, nodeFromRaw(raw)] },
    key,
  };
}

/** Connect two nodes (schematic wire between two symbols, else a connector). */
export function addLink(g: DiagramGraph, fromKey: string, toKey: string): DiagramGraph {
  if (fromKey === toKey) return g;
  const from = g.nodes.find((n) => n.key === fromKey);
  const to = g.nodes.find((n) => n.key === toKey);
  if (!from || !to) return g;
  const wire = from.category === 'symbol' && to.category === 'symbol';
  const raw: Record<string, unknown> = {
    category: 'link',
    from: fromKey,
    to: toKey,
    fromPort: '',
    toPort: '',
    ...(wire ? { wire: true } : {}),
  };
  return { ...g, links: [...g.links, linkFromRaw(raw)] };
}

/** One wire-style change (color / width / solid-vs-dashed-vs-flow / router). */
export interface WireStyle {
  color?: string;
  width?: number;
  style?: 'solid' | 'dashed' | 'flow';
  routing?: 'manhattan' | 'normal' | 'smooth';
}

/** Apply a style patch to the link identified by `id`; round-trips GoJS props. */
export function styleLink(g: DiagramGraph, id: string, patch: WireStyle): DiagramGraph {
  const links = g.links.map((l) => {
    if (linkId(l) !== id) return l;
    const raw = { ...l.raw };
    if (patch.color !== undefined) raw.color = patch.color;
    if (patch.width !== undefined) raw.width = patch.width;
    if (patch.routing !== undefined) raw.routing = patch.routing;
    if (patch.style !== undefined) {
      raw.dash = patch.style === 'solid' ? null : [6, 3];
      raw.flow = patch.style === 'flow';
    }
    return linkFromRaw(raw);
  });
  return { ...g, links };
}

/** Delete the link identified by `id`. */
export function deleteLink(g: DiagramGraph, id: string): DiagramGraph {
  return { ...g, links: g.links.filter((l) => linkId(l) !== id) };
}

/** Delete a node and every link touching it. */
export function deleteNode(g: DiagramGraph, key: string): DiagramGraph {
  return {
    nodes: g.nodes.filter((n) => n.key !== key),
    links: g.links.filter((l) => l.from !== key && l.to !== key),
  };
}

/** Attach a catalogue part to a node (web `attachedParts` shape, round-trips). */
export function attachPart(
  g: DiagramGraph,
  key: string,
  part: { partNumber: string; manufacturer: string; supplier?: string; description?: string },
  quantity = 1,
): DiagramGraph {
  const nodes = g.nodes.map((n) => {
    if (n.key !== key) return n;
    const existing = Array.isArray(n.raw.attachedParts) ? (n.raw.attachedParts as unknown[]) : [];
    const attachedParts = [
      ...existing,
      {
        part: {
          partNumber: part.partNumber,
          manufacturer: part.manufacturer,
          supplier: part.supplier ?? '',
          partDesc: part.description ?? '',
        },
        quantity,
      },
    ];
    return { ...n, raw: { ...n.raw, attachedParts } };
  });
  return { ...g, nodes };
}

export function attachedCount(raw: Record<string, unknown>): number {
  return Array.isArray(raw.attachedParts) ? (raw.attachedParts as unknown[]).length : 0;
}

/** Part records attached to a node ({partNumber, manufacturer, supplier, partDesc}). */
export function attachedParts(raw: Record<string, unknown>): Record<string, unknown>[] {
  const list = Array.isArray(raw.attachedParts) ? (raw.attachedParts as any[]) : [];
  return list.map((a) => (a?.part ?? a) as Record<string, unknown>).filter(Boolean);
}

/** All distinct part numbers referenced anywhere on the canvas (attached + linked). */
export function graphPartNumbers(g: DiagramGraph): string[] {
  const out = new Set<string>();
  for (const n of g.nodes) {
    for (const p of attachedParts(n.raw)) {
      const pn = (p as any).partNumber;
      if (typeof pn === 'string' && pn) out.add(pn);
    }
    const linked = Array.isArray(n.raw.components) ? (n.raw.components as any[]) : [];
    for (const l of linked) if (l?.partNumber) out.add(l.partNumber);
  }
  return [...out];
}

/** The first part number attached to a node, if any (for lifecycle/POS lookups). */
export function primaryPartNumber(raw: Record<string, unknown>): string | null {
  const p = attachedParts(raw)[0] as any;
  return p?.partNumber ?? null;
}

/** Components linked onto a node/box (web `components` array). */
export function linkedComponents(raw: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(raw.components) ? (raw.components as Record<string, unknown>[]) : [];
}

/** Link a suggested component to a node (deduped by part number). */
export function linkComponent(g: DiagramGraph, key: string, comp: Record<string, unknown>): DiagramGraph {
  const nodes = g.nodes.map((n) => {
    if (n.key !== key) return n;
    const list = linkedComponents(n.raw);
    if (list.some((c) => c.partNumber === comp.partNumber)) return n;
    return nodeFromRaw({ ...n.raw, components: [...list, comp] });
  });
  return { ...g, nodes };
}

/** Remove one linked component (by part number) from a node. */
export function unlinkComponent(g: DiagramGraph, key: string, partNumber: string): DiagramGraph {
  const nodes = g.nodes.map((n) => {
    if (n.key !== key) return n;
    const list = linkedComponents(n.raw).filter((c) => c.partNumber !== partNumber);
    return nodeFromRaw({ ...n.raw, components: list });
  });
  return { ...g, nodes };
}
