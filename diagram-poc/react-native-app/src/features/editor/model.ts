/** A node parsed from a GoJS node-data entry (`loc: "x y"`, `size: "w h"`). */
export interface DiagramNode {
  key: string;
  category: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  shape?: string;
  raw: Record<string, unknown>;
}

export interface DiagramLink {
  from: string;
  to: string;
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

function parseNode(raw: Record<string, unknown>): DiagramNode {
  const loc = parsePair(raw.loc) ?? [0, 0];
  const size = parsePair(raw.size) ?? [120, 60];
  const color = (raw.color ?? raw.fill) as string | undefined;
  return {
    key: `${raw.key}`,
    category: (raw.category as string) ?? '',
    text: (raw.text as string) ?? '',
    x: loc[0],
    y: loc[1],
    w: size[0],
    h: size[1],
    color: typeof color === 'string' && color.startsWith('#') ? color : undefined,
    shape: raw.shape as string | undefined,
    raw,
  };
}

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

/** Parse a GoJS GraphLinksModel JSON string; returns an empty graph on error. */
export function parseModel(contentJson: string): DiagramGraph {
  if (!contentJson || !contentJson.trim()) return { nodes: [], links: [] };
  try {
    const d = JSON.parse(contentJson);
    const nodes = Array.isArray(d.nodeDataArray) ? d.nodeDataArray.map(parseNode) : [];
    const links = Array.isArray(d.linkDataArray) ? d.linkDataArray.map(parseLink) : [];
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
