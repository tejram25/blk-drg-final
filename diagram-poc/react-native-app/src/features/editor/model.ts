/** A connection port on a node: an id plus its position as a fraction of w/h. */
export interface NodePort {
  portId: string;
  fx: number;
  fy: number;
}

import { ELECTRICAL_SYMBOLS } from './symbols';

/**
 * A node. NOTE: `loc` in the data is the node's CENTRE (GoJS locationSpot
 * Center, as the desktop app saves), while x/y here are the derived TOP-LEFT
 * corner used by the renderers.
 */
export interface DiagramNode {
  key: string;
  category: string;
  text: string;
  value?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  shape?: string;
  ports?: NodePort[];
  raw: Record<string, unknown>;
}

export interface DiagramLink {
  from: string;
  to: string;
  fromPort?: string;
  toPort?: string;
  isWire: boolean;
  points: { x: number; y: number }[];
  color?: string;
  width?: number;
  dashed?: boolean;
  routing?: string;
  raw: Record<string, unknown>;
}

/** Stable identity for a link (its GoJS key, else the endpoint pair). */
export const linkId = (l: { from: string; to: string; raw: Record<string, unknown> }) =>
  `${l.raw.key ?? `${l.from}->${l.to}`}`;

export interface DiagramGraph {
  nodes: DiagramNode[];
  links: DiagramLink[];
}

function parsePair(v: unknown): [number, number] | null {
  if (typeof v !== 'string') return null;
  const p = v.trim().split(/\s+/);
  if (p.length < 2) return null;
  const a = Number(p[0]);
  const b = Number(p[1]);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
}

function parsePorts(raw: Record<string, unknown>): NodePort[] | undefined {
  if (!Array.isArray(raw.ports)) return undefined;
  const out: NodePort[] = [];
  for (const p of raw.ports as any[]) {
    const spot = parsePair(p?.spot);
    if (p?.portId != null && spot) out.push({ portId: `${p.portId}`, fx: spot[0], fy: spot[1] });
  }
  return out.length ? out : undefined;
}

function parseNode(raw: Record<string, unknown>): DiagramNode {
  const loc = parsePair(raw.loc) ?? [0, 0];
  const size = parsePair(raw.size) ?? [120, 60];
  const color = (raw.color ?? raw.fill) as string | undefined;
  // loc is the node centre → derive the top-left corner the renderers use.
  return {
    key: `${raw.key}`,
    category: (raw.category as string) ?? '',
    text: (raw.text as string) ?? '',
    value: typeof raw.value === 'string' ? (raw.value as string) : undefined,
    x: loc[0] - size[0] / 2,
    y: loc[1] - size[1] / 2,
    w: size[0],
    h: size[1],
    color: typeof color === 'string' && color.startsWith('#') ? color : undefined,
    shape: raw.shape as string | undefined,
    ports: parsePorts(raw),
    raw,
  };
}

/** `loc` string (centre) for a node whose top-left is at (x,y) with size w×h. */
export const centerLoc = (x: number, y: number, w: number, h: number) =>
  `${Math.round(x + w / 2)} ${Math.round(y + h / 2)}`;

function parseLink(raw: Record<string, unknown>): DiagramLink {
  const pts: { x: number; y: number }[] = [];
  if (Array.isArray(raw.points)) {
    for (let i = 0; i + 1 < raw.points.length; i += 2) {
      pts.push({ x: Number(raw.points[i]), y: Number(raw.points[i + 1]) });
    }
  }
  const dash = raw.dash;
  return {
    from: `${raw.from}`,
    to: `${raw.to}`,
    fromPort: raw.fromPort != null ? `${raw.fromPort}` : undefined,
    toPort: raw.toPort != null ? `${raw.toPort}` : undefined,
    isWire: raw.wire === true || raw.category === 'wire',
    points: pts,
    color: typeof raw.color === 'string' ? (raw.color as string) : undefined,
    width: typeof raw.width === 'number' ? (raw.width as number) : undefined,
    dashed: Array.isArray(dash) && dash.length > 0,
    routing: typeof raw.routing === 'string' ? (raw.routing as string) : undefined,
    raw,
  };
}

/** Build a DiagramNode / DiagramLink from a raw GoJS data object. */
export const nodeFromRaw = (raw: Record<string, unknown>) => parseNode(raw);
export const linkFromRaw = (raw: Record<string, unknown>) => parseLink(raw);

/**
 * Convert a legacy AntV X6 graph (`{cells:[...]}`) into GoJS-shaped node/link
 * data (centre-based loc), mirroring the desktop app's convertX6 so the older
 * sample diagrams (Smart Microgrid, AMR Robot) load instead of coming up blank.
 */
function convertLegacy(cells: any[]): { nodeDataArray: any[]; linkDataArray: any[] } {
  const nodeDataArray: any[] = [];
  const linkDataArray: any[] = [];
  const elecKeys = new Set<string>();
  const edges: any[] = [];

  for (const c of cells || []) {
    if (c?.shape === 'edge' || c?.source || c?.target) {
      edges.push(c);
      continue;
    }
    const pos = c.position ?? { x: c.x ?? 0, y: c.y ?? 0 };
    const size = c.size ?? { width: c.width ?? 140, height: c.height ?? 60 };
    const loc = `${pos.x + size.width / 2} ${pos.y + size.height / 2}`;
    const a = c.attrs ?? {};
    const key = c.id;
    const shape: string = c.shape ?? '';
    const label = a.label?.text ?? a.title?.text ?? '';
    const sizeStr = `${size.width} ${size.height}`;

    if (shape === 'block-card') {
      nodeDataArray.push({ key, category: 'block', loc, size: sizeStr, text: a.title?.text ?? label,
        color: a.badge?.fill ?? '#1d4ed8', subtitle: a.subtitle?.text ?? 'Module' });
    } else if (shape === 'part-card') {
      nodeDataArray.push({ key, category: 'block', loc, size: sizeStr, text: a.title?.text ?? 'Part',
        color: '#f59e0b', subtitle: 'Part' });
    } else if (ELECTRICAL_SYMBOLS[shape]) {
      const def = ELECTRICAL_SYMBOLS[shape];
      elecKeys.add(key);
      nodeDataArray.push({ key, category: 'symbol', shape, loc, size: `${def.width} ${def.height}`, text: label,
        ports: def.pins.map((p, i) => ({ portId: `p${i}`, spot: `${p.x / def.width} ${p.y / def.height}` })) });
    } else if (shape.startsWith('basic-')) {
      const fill = a.body?.fill ?? a.rect?.fill;
      nodeDataArray.push({ key, category: 'shape', shape, loc, size: sizeStr, text: label,
        color: fill && fill !== 'none' ? fill : '#e2e8f0' });
    } else {
      // rect / unknown / animated-not-ported → a coloured box or a labelled block.
      const body = a.body ?? a.rect ?? {};
      const fill = body.fill && body.fill !== 'none' ? body.fill : null;
      if (fill) {
        nodeDataArray.push({ key, category: 'shape', shape: (body.rx ?? 0) > 0 ? 'basic-rounded' : 'basic-rectangle',
          loc, size: sizeStr, text: label, color: fill });
      } else {
        nodeDataArray.push({ key, category: 'block', loc, size: sizeStr,
          text: label || shape || 'Node', color: '#64748b', subtitle: 'Imported' });
      }
    }
  }

  for (const c of edges) {
    const from = c.source?.cell ?? (typeof c.source === 'string' ? c.source : null);
    const to = c.target?.cell ?? (typeof c.target === 'string' ? c.target : null);
    if (!from || !to) continue;
    const port = (end: any) => {
      const p = end?.port;
      return typeof p === 'string' ? p.replace(/^pin(\d+)$/, 'p$1') : '';
    };
    const line = c.attrs?.line ?? {};
    const link: any = { category: 'link', from, to, fromPort: port(c.source), toPort: port(c.target),
      wire: elecKeys.has(from) && elecKeys.has(to) };
    if (line.stroke) link.color = line.stroke;
    if (line.strokeWidth) link.width = line.strokeWidth;
    if (line.strokeDasharray) {
      link.dash = [6, 3];
      link.flow = true;
    }
    linkDataArray.push(link);
  }
  return { nodeDataArray, linkDataArray };
}

/** Parse a diagram's contentJson (GoJS GraphLinksModel or legacy X6 cells). */
export function parseModel(contentJson: string): DiagramGraph {
  if (!contentJson || !contentJson.trim()) return { nodes: [], links: [] };
  try {
    const d = JSON.parse(contentJson);
    const src = Array.isArray(d.cells) ? convertLegacy(d.cells) : d;
    const nodes = Array.isArray(src.nodeDataArray) ? src.nodeDataArray.map(parseNode) : [];
    const links = Array.isArray(src.linkDataArray) ? src.linkDataArray.map(parseLink) : [];
    return { nodes, links };
  } catch {
    return { nodes: [], links: [] };
  }
}

export function contentBounds(g: DiagramGraph) {
  if (g.nodes.length === 0) return { x: 0, y: 0, w: 800, h: 600 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of g.nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export const nodeCenter = (n: DiagramNode) => ({ x: n.x + n.w / 2, y: n.y + n.h / 2 });
