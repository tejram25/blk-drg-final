import { BlockType, isShape, isSymbol } from './catalogApi';
import { DiagramGraph, linkFromRaw, nodeFromRaw } from './model';
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
