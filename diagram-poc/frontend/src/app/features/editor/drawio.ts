import { Graph } from '@antv/x6';
import { BASIC_SHAPES } from './basic-shapes';

/**
 * draw.io (diagrams.net / mxGraph) interop.
 *
 *  - importDrawio(xml)  → editable X6 nodes + edges
 *  - exportDrawio(graph) → a .drawio XML string (uncompressed mxGraphModel,
 *    which draw.io opens directly)
 *
 * draw.io's native format is mxGraph XML: an <mxGraphModel> whose <root> holds
 * <mxCell> elements (vertices and edges). Vertex shapes are encoded in the
 * `style` string (e.g. "ellipse;...", "rhombus;...", "shape=cylinder3;..."),
 * which we map to our registered shapes. Cloud-saved diagrams wrap the model in
 * a deflate-compressed <diagram> node; we transparently inflate those.
 */

export interface DrawioCells {
  nodes: any[];
  edges: any[];
}

// ---------- style parsing ----------

interface ParsedStyle {
  /** bare tokens with no '=' (e.g. "ellipse", "rounded") */
  tokens: string[];
  /** key=value pairs */
  kv: Record<string, string>;
}

function parseStyle(style: string): ParsedStyle {
  const tokens: string[] = [];
  const kv: Record<string, string> = {};
  (style || '').split(';').forEach((part) => {
    const p = part.trim();
    if (!p) return;
    const eq = p.indexOf('=');
    if (eq === -1) tokens.push(p.toLowerCase());
    else kv[p.slice(0, eq).trim().toLowerCase()] = p.slice(eq + 1).trim();
  });
  return { tokens, kv };
}

/** Map a draw.io vertex style to one of our registered shape names. */
function detectShape({ tokens, kv }: ParsedStyle): string {
  const has = (t: string) => tokens.includes(t);
  const shape = (kv['shape'] || '').toLowerCase();

  if (has('cloud') || shape === 'cloud') return 'basic-cloud';
  if (has('ellipse') || shape === 'ellipse') return 'basic-ellipse';
  if (has('rhombus') || shape === 'rhombus' || shape.includes('decision')) return 'basic-diamond';
  if (has('triangle') || shape === 'triangle') return 'basic-triangle';
  if (has('hexagon') || shape === 'hexagon') return 'basic-hexagon';
  if (has('parallelogram') || shape === 'parallelogram') return 'basic-parallelogram';
  if (has('cylinder') || shape.startsWith('cylinder') || shape.includes('datastore')) return 'basic-cylinder';
  if (shape === 'process' || shape === 'process2') return 'basic-process';
  if (has('step') || shape === 'step') return 'basic-step';
  if (has('trapezoid') || shape === 'trapezoid') return 'basic-trapezoid';
  if (shape === 'document') return 'basic-document';
  if (shape === 'note') return 'basic-note';
  if (shape === 'callout') return 'basic-callout';
  if (shape === 'actor' || shape === 'umlactor') return 'basic-actor';
  if (shape.includes('terminator')) return 'basic-rounded';
  if (has('text') || kv['text'] === '1') return 'basic-text';
  if (kv['rounded'] === '1') return 'basic-rounded';
  return 'basic-rectangle';
}

/** draw.io labels may carry HTML (html=1) — reduce to plain text. */
function htmlToText(value: string): string {
  if (!value) return '';
  const withBreaks = value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  const ta = document.createElement('textarea');
  ta.innerHTML = withBreaks;
  return ta.value.replace(/\n{2,}/g, '\n').trim();
}

function xmlEscape(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- compressed-diagram inflate ----------

/** Inflate draw.io's base64 + raw-deflate + URI-encoded diagram payload. */
async function inflateDiagram(b64: string): Promise<string> {
  const DS = (window as any).DecompressionStream;
  if (!DS) {
    throw new Error(
      'This .drawio file is compressed and your browser cannot inflate it. ' +
      'In draw.io use File → Save As / Export and untick "Compressed", then import again.',
    );
  }
  const bytes = Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DS('deflate-raw'));
  const buf = await new Response(stream).arrayBuffer();
  return decodeURIComponent(new TextDecoder().decode(buf));
}

// ---------- import ----------

interface RawCell {
  id: string;
  parent: string | null;
  vertex: boolean;
  edge: boolean;
  group: boolean;
  value: string;
  style: string;
  source: string | null;
  target: string | null;
  x: number; y: number; w: number; h: number;
}

function readGeometry(cell: Element): { x: number; y: number; w: number; h: number } {
  const geo = Array.from(cell.children).find((c) => c.getAttribute('as') === 'geometry');
  return {
    x: parseFloat(geo?.getAttribute('x') || '0') || 0,
    y: parseFloat(geo?.getAttribute('y') || '0') || 0,
    w: parseFloat(geo?.getAttribute('width') || '0') || 0,
    h: parseFloat(geo?.getAttribute('height') || '0') || 0,
  };
}

export async function importDrawio(xml: string): Promise<DrawioCells> {
  const parser = new DOMParser();
  let doc = parser.parseFromString(xml, 'text/xml');

  // Uncompressed files expose <mxGraphModel> directly. Cloud-saved files wrap a
  // compressed payload inside <diagram> — inflate then re-parse.
  let model = doc.querySelector('mxGraphModel');
  if (!model) {
    const diagram = doc.querySelector('diagram');
    const payload = diagram?.textContent?.trim();
    if (payload) {
      doc = parser.parseFromString(await inflateDiagram(payload), 'text/xml');
      model = doc.querySelector('mxGraphModel');
    }
  }
  if (!model) throw new Error('No <mxGraphModel> found — is this a draw.io file?');

  const rawById = new Map<string, RawCell>();
  Array.from(model.querySelectorAll('mxCell')).forEach((cell) => {
    const id = cell.getAttribute('id');
    if (!id) return;
    const { tokens } = parseStyle(cell.getAttribute('style') || '');
    const g = readGeometry(cell);
    rawById.set(id, {
      id,
      parent: cell.getAttribute('parent'),
      vertex: cell.getAttribute('vertex') === '1',
      edge: cell.getAttribute('edge') === '1',
      group: tokens.includes('group'),
      value: cell.getAttribute('value') || '',
      style: cell.getAttribute('style') || '',
      source: cell.getAttribute('source'),
      target: cell.getAttribute('target'),
      ...g,
    });
  });

  // Child geometry is relative to ancestor vertices — accumulate their offsets.
  const offsetOf = (parentId: string | null): { x: number; y: number } => {
    let x = 0, y = 0;
    const seen = new Set<string>();
    let cur = parentId ? rawById.get(parentId) : undefined;
    while (cur && cur.vertex && !seen.has(cur.id)) {
      seen.add(cur.id);
      x += cur.x; y += cur.y;
      cur = cur.parent ? rawById.get(cur.parent) : undefined;
    }
    return { x, y };
  };

  const nodes: any[] = [];
  const nodeIds = new Set<string>();

  rawById.forEach((c) => {
    if (!c.vertex || c.group || (c.w === 0 && c.h === 0)) return;
    const parsed = parseStyle(c.style);
    const shape = detectShape(parsed);
    const def = BASIC_SHAPES[shape];
    const off = offsetOf(c.parent);
    const { kv } = parsed;

    const body: Record<string, any> = {};
    if (kv['fillcolor'] && kv['fillcolor'].toLowerCase() !== 'none') body.fill = kv['fillcolor'];
    if (kv['strokecolor'] && kv['strokecolor'].toLowerCase() !== 'none') body.stroke = kv['strokecolor'];

    const label: Record<string, any> = { text: htmlToText(c.value) };
    if (kv['fontcolor']) label.fill = kv['fontcolor'];
    if (kv['fontsize']) label.fontSize = parseFloat(kv['fontsize']) || 13;

    nodes.push({
      id: c.id,
      shape,
      x: c.x + off.x,
      y: c.y + off.y,
      width: c.w || def.width,
      height: c.h || def.height,
      angle: parseFloat(kv['rotation'] || '0') || 0,
      attrs: { body, label },
      data: { drawioStyle: c.style },
    });
    nodeIds.add(c.id);
  });

  const edges: any[] = [];
  rawById.forEach((c) => {
    if (!c.edge || !c.source || !c.target) return;
    if (!nodeIds.has(c.source) || !nodeIds.has(c.target)) return;
    const { kv } = parseStyle(c.style);
    const line: Record<string, any> = {
      stroke: kv['strokecolor'] || '#64748b',
      strokeWidth: parseFloat(kv['strokewidth'] || '2') || 2,
    };
    if (kv['dashed'] === '1') line.strokeDasharray = 6;
    if (kv['endarrow'] !== 'none') line.targetMarker = { name: 'block', width: 9, height: 7 };
    else line.targetMarker = null;

    edges.push({
      id: c.id,
      source: { cell: c.source },
      target: { cell: c.target },
      attrs: { line },
      labels: c.value ? [{ attrs: { label: { text: htmlToText(c.value) } } }] : [],
      router: { name: 'manhattan' },
      connector: { name: 'rounded', args: { radius: 8 } },
      zIndex: -1,
      data: { drawioStyle: c.style },
    });
  });

  return { nodes, edges };
}

// ---------- export ----------

/** Best-effort label readout across the app's shape families. */
function nodeLabel(node: any): string {
  return (
    node.attr('label/text') ||
    node.attr('title/text') ||
    ''
  );
}

/** Build a draw.io style string for a node (reuse the original if imported). */
function styleForNode(node: any): string {
  const original = node.getData?.()?.drawioStyle;
  let base: string;
  if (original) {
    base = String(original);
  } else if (BASIC_SHAPES[node.shape]) {
    base = BASIC_SHAPES[node.shape].drawioStyle;
  } else {
    // elec-*/anim-*/block-card/img-node have no draw.io equivalent → plain box
    base = 'rounded=1;whiteSpace=wrap;html=1;';
  }
  // overlay current colors so edits round-trip
  const fill = node.attr('body/fill');
  const stroke = node.attr('body/stroke');
  const extra: string[] = [];
  if (fill && fill !== 'none' && !/fillColor=/i.test(base)) extra.push(`fillColor=${fill}`);
  if (stroke && stroke !== 'none' && !/strokeColor=/i.test(base)) extra.push(`strokeColor=${stroke}`);
  const sep = base.endsWith(';') || base === '' ? '' : ';';
  return base + (extra.length ? sep + extra.join(';') + ';' : '');
}

export function exportDrawio(graph: Graph, name = 'diagram'): string {
  const parts: string[] = [];
  parts.push('<mxCell id="0" />');
  parts.push('<mxCell id="1" parent="0" />');

  graph.getNodes().forEach((node) => {
    const { x, y } = node.position();
    const { width, height } = node.size();
    const style = styleForNode(node);
    const value = xmlEscape(nodeLabel(node));
    parts.push(
      `<mxCell id="${xmlEscape(node.id)}" value="${value}" style="${xmlEscape(style)}" vertex="1" parent="1">` +
        `<mxGeometry x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(width)}" height="${Math.round(height)}" as="geometry" />` +
      `</mxCell>`,
    );
  });

  graph.getEdges().forEach((edge) => {
    const s = edge.getSourceCellId();
    const t = edge.getTargetCellId();
    if (!s || !t) return;
    const stroke = edge.attr('line/stroke') || '#64748b';
    const dashed = edge.attr('line/strokeDasharray') ? 'dashed=1;' : '';
    const style = `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;${dashed}strokeColor=${stroke};`;
    const labels = (edge.getLabels?.() || []) as any[];
    const labelText = labels.length ? (labels[0]?.attrs?.label?.text ?? '') : '';
    const label = xmlEscape(String(labelText));
    parts.push(
      `<mxCell id="${xmlEscape(edge.id)}" value="${label}" style="${xmlEscape(style)}" edge="1" parent="1" source="${xmlEscape(s)}" target="${xmlEscape(t)}">` +
        `<mxGeometry relative="1" as="geometry" />` +
      `</mxCell>`,
    );
  });

  return (
    `<mxfile host="diagram-builder">` +
      `<diagram name="${xmlEscape(name)}" id="page-1">` +
        `<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" ` +
        `connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">` +
          `<root>${parts.join('')}</root>` +
        `</mxGraphModel>` +
      `</diagram>` +
    `</mxfile>`
  );
}
