/**
 * Minimal draw.io (mxGraph) interop for the GoJS editor. Exports the current
 * diagram to a .drawio XML document and imports a .drawio/.xml file into GoJS
 * node/link data. Fidelity is intentionally simple: block geometry, labels and
 * connections round-trip; rich symbol artwork does not.
 */
import * as go from 'gojs';

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Serialize a GoJS diagram to a draw.io/mxGraph XML string. */
export function exportDrawio(diagram: go.Diagram, name: string): string {
  const cells: string[] = [
    '<mxCell id="0"/>',
    '<mxCell id="1" parent="0"/>',
  ];

  diagram.nodes.each((n) => {
    const b = n.actualBounds;
    const label = esc(n.data?.text || n.data?.shape || '');
    const fill = n.data?.color || '#ffffff';
    const style = `rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};`;
    cells.push(
      `<mxCell id="${esc(String(n.key))}" value="${label}" style="${style}" vertex="1" parent="1">` +
      `<mxGeometry x="${Math.round(b.x)}" y="${Math.round(b.y)}" width="${Math.round(b.width)}" height="${Math.round(b.height)}" as="geometry"/>` +
      `</mxCell>`,
    );
  });

  let edgeId = 1;
  diagram.links.each((l) => {
    const src = l.fromNode ? esc(String(l.fromNode.key)) : '';
    const tgt = l.toNode ? esc(String(l.toNode.key)) : '';
    if (!src || !tgt) return;
    cells.push(
      `<mxCell id="e${edgeId++}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;" edge="1" parent="1" ` +
      `source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry"/></mxCell>`,
    );
  });

  return (
    `<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" ` +
    `arrows="1" fold="1" page="1" pageScale="1" pageWidth="850" pageHeight="1100" math="0" shadow="0">` +
    `<root>${cells.join('')}</root></mxGraphModel>`
  );
}

/**
 * Parse a draw.io/mxGraph XML string into GoJS data objects. Vertices become
 * block nodes; edges become links (marked with `category: 'link'` so the caller
 * can route them to addLinkData). Returns [] when nothing usable is found.
 */
export function importDrawio(xml: string): go.ObjectData[] {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const cells = Array.from(doc.getElementsByTagName('mxCell'));
  const out: go.ObjectData[] = [];
  const nodeKeys = new Set<string>();

  for (const c of cells) {
    if (c.getAttribute('vertex') !== '1') continue;
    const id = c.getAttribute('id') || '';
    if (!id) continue;
    const geo = c.getElementsByTagName('mxGeometry')[0];
    const x = Number(geo?.getAttribute('x') || 0);
    const y = Number(geo?.getAttribute('y') || 0);
    const w = Number(geo?.getAttribute('width') || 120);
    const h = Number(geo?.getAttribute('height') || 60);
    const style = c.getAttribute('style') || '';
    const fill = /fillColor=([^;]+)/.exec(style)?.[1];
    nodeKeys.add(id);
    out.push({
      key: id, category: 'block',
      text: (c.getAttribute('value') || '').replace(/<[^>]+>/g, '').trim(),
      subtitle: 'Imported',
      color: fill && fill !== 'none' ? fill : '#1d4ed8',
      icon: 'crop_square',
      loc: go.Point.stringify(new go.Point(x + w / 2, y + h / 2)),
    });
  }

  for (const c of cells) {
    if (c.getAttribute('edge') !== '1') continue;
    const from = c.getAttribute('source') || '';
    const to = c.getAttribute('target') || '';
    if (!nodeKeys.has(from) || !nodeKeys.has(to)) continue;
    out.push({ category: 'link', from, to });
  }

  return out;
}
