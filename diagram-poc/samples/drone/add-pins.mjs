/**
 * Turn a diagram's automatic wire endpoints into named pins.
 *
 * The four reference drawings were built against the edge rails: a wire says
 * "leave from the right side" and GoJS spreads however many wires share that
 * side along it. That routes correctly but leaves nothing to grab — the
 * connection points are computed, not stored, so a reader cannot see them and
 * an editor cannot move one without moving the rest.
 *
 * This reads back the geometry GoJS actually produced and writes it into the
 * model: a pin on each block where a wire meets it, and each wire pointing at
 * its own pin. Nothing moves — every pin is placed at the point that end of
 * that wire is already drawn at — but afterwards every connection is an object
 * on the canvas that can be dragged, renamed or deleted.
 *
 *   node add-pins.mjs 01-drone-top-level.gojs.json          # report only
 *   node add-pins.mjs 01-drone-top-level.gojs.json --write
 *
 * Safe to re-run: ends that already point at a pin are left alone.
 */
const pw = await import(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright/index.js');
const { chromium } = pw.default ?? pw;
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const [, , modelPath, ...flags] = process.argv;
if (!modelPath) { console.error('usage: add-pins.mjs model.json [--write]'); process.exit(2); }
const write = flags.includes('--write');

const raw = readFileSync(resolve(modelPath), 'utf8');
const goSrc = readFileSync(resolve(__dir, '../../frontend/node_modules/gojs/release/go.js'), 'utf8');
const geo = JSON.parse(readFileSync(resolve(__dir, 'figures.json'), 'utf8'));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
let found;
try {
  const page = await browser.newPage({ viewport: { width: 1700, height: 1080 } });
  page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));
  await page.goto('file://' + resolve(__dir, 'render-harness.html'));
  await page.addScriptTag({ content: goSrc });
  found = await page.evaluate(async ({ model, geo }) => {
    const go = window.go;
    const diagram = window.buildDiagram(model, geo);
    await new Promise((r) => setTimeout(r, 500));
    diagram.updateAllTargetBindings();
    await new Promise((r) => setTimeout(r, 300));

    const RAILS = ['T', 'R', 'B', 'L'];
    /** The body rectangle, taken from the four edge rails that bound it. */
    const bodyOf = (node) => {
      const rail = (id) => { let f = null; node.ports.each((p) => { if (p.portId === id) f = p; }); return f && f.getDocumentBounds(); };
      const L = rail('L'), R = rail('R'), T = rail('T'), B = rail('B');
      if (!L || !R || !T || !B) return null;
      return { l: L.x, r: R.x + R.width, t: T.y, b: B.y + B.height };
    };

    const out = [];
    diagram.links.each((link) => {
      for (const which of ['from', 'to']) {
        const portId = String(link.data[which + 'Port'] ?? '');
        // Already a named pin (or a wire we cannot place): leave it be.
        if (portId && !RAILS.includes(portId)) continue;
        const node = which === 'from' ? link.fromNode : link.toNode;
        if (!node) continue;
        const body = bodyOf(node);
        if (!body) continue;
        const pt = which === 'from' ? link.points.first() : link.points.last();
        const w = body.r - body.l, h = body.b - body.t;
        if (!(w > 0 && h > 0)) continue;
        // Which edge, decided by the endpoint itself rather than by the
        // declared rail: a wire with no port at all still lands on one.
        const d = [['L', Math.abs(pt.x - body.l)], ['R', Math.abs(pt.x - body.r)],
                   ['T', Math.abs(pt.y - body.t)], ['B', Math.abs(pt.y - body.b)]].sort((a, b) => a[1] - b[1]);
        const side = d[0][0];
        const along = side === 'L' || side === 'R'
          ? (pt.y - body.t) / h : (pt.x - body.l) / w;
        out.push({
          link: link.data.key ?? null, which, node: node.data.key, side,
          along: Math.min(1, Math.max(0, along)),
          // How far off the edge the endpoint sits; a healthy one is ~0.
          slack: Math.round(d[0][1] * 100) / 100,
        });
      }
    });
    return out;
  }, { model: raw, geo });
} finally {
  await browser.close();
}

const model = JSON.parse(raw);
const nodes = new Map(model.nodeDataArray.map((n) => [n.key, n]));
const links = new Map(model.linkDataArray.map((l) => [l.key, l]));

const worst = found.reduce((m, f) => Math.max(m, f.slack), 0);
console.log(`${modelPath}: ${found.length} rail ends, worst off-edge slack ${worst}px`);

/** Group by node+side so wires meeting at one point end up sharing one pin. */
const spotOf = (side, along) => side === 'L' ? `0 ${along}` : side === 'R' ? `1 ${along}`
  : side === 'T' ? `${along} 0` : `${along} 1`;

let added = 0;
const byNode = new Map();
for (const f of found) {
  if (!byNode.has(f.node)) byNode.set(f.node, []);
  byNode.get(f.node).push(f);
}
for (const [key, ends] of byNode) {
  const node = nodes.get(key);
  if (!node) continue;
  const ports = Array.isArray(node.ports) ? node.ports.slice() : [];
  let next = ports.reduce((max, p) => {
    const m = /^p(\d+)$/.exec(String(p.portId || ''));
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  // Deterministic order, so re-running names the pins the same way.
  ends.sort((a, b) => (a.side.localeCompare(b.side)) || (a.along - b.along));
  const placed = [];
  for (const e of ends) {
    // Two wires that already meet at one point stay one connection point.
    let hit = placed.find((q) => q.side === e.side && Math.abs(q.along - e.along) < 0.004);
    if (!hit) {
      hit = { side: e.side, along: e.along, portId: 'p' + (++next) };
      placed.push(hit);
      ports.push({ portId: hit.portId, spot: spotOf(e.side, Number(e.along.toFixed(4))) });
      added++;
    }
    const link = links.get(e.link);
    if (link) link[e.which + 'Port'] = hit.portId;
  }
  node.ports = ports;
}

console.log(`  ${added} pins across ${byNode.size} nodes`);
if (!write) { console.log('  (report only; pass --write to apply)'); process.exit(0); }
// Indent 1, no trailing newline: exactly what the generators emit, so the only
// lines this shows up as in a diff are the ones it actually changed.
writeFileSync(resolve(modelPath), JSON.stringify(model, null, 1));
console.log('  written');
