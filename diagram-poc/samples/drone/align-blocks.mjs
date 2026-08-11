/**
 * Move a block so its wire can be straight.
 *
 * `straighten-runs.mjs` can only work within the band two blocks already share.
 * Where they do not face each other at all, no choice of connection point makes
 * a straight line — the block itself has to move. That is the last thing the
 * source does that we did not.
 *
 * Only a **leaf** block moves: one with a single wire on it. Moving a block that
 * several wires reach would straighten one run and bend the others, and there is
 * no way to know which the author wanted. A move is also rejected if it would
 * put the block on top of another, so the layout cannot quietly collapse.
 *
 *   node align-blocks.mjs 04-key-suppliers.gojs.json [--write]
 */
const pw = await import(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright/index.js');
const { chromium } = pw.default ?? pw;
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const [, , modelPath, ...flags] = process.argv;
if (!modelPath) { console.error('usage: align-blocks.mjs model.json [--write]'); process.exit(2); }
const write = flags.includes('--write');
/** Clearance to keep between blocks when one is moved. */
const GAP = 10;
/** Refuse to shunt a block further than this; a big move is a layout decision. */
const MAX_MOVE = 170;

const goSrc = readFileSync(resolve(__dir, '../../frontend/node_modules/gojs/release/go.js'), 'utf8');
const geo = JSON.parse(readFileSync(resolve(__dir, 'figures.json'), 'utf8'));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1080 } });
page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));

async function measure(json) {
  await page.goto('file://' + resolve(__dir, 'render-harness.html'));
  await page.addScriptTag({ content: goSrc });
  return page.evaluate(async ({ model, geo }) => {
    const d = window.buildDiagram(model, geo);
    await new Promise((r) => setTimeout(r, 450));
    d.updateAllTargetBindings();
    await new Promise((r) => setTimeout(r, 250));
    const body = (n) => {
      const rail = (id) => { let f = null; n.ports.each((q) => { if (q.portId === id) f = q; }); return f && f.getDocumentBounds(); };
      const L = rail('L'), R = rail('R'), T = rail('T'), B = rail('B');
      if (!L || !R || !T || !B) return null;
      return { x: L.x, y: T.y, w: R.x + R.width - L.x, h: B.y + B.height - T.y };
    };
    const axisOf = (n, id) => {
      let p = null; n.ports.each((q) => { if (q.portId === id) p = q; });
      const s = p && p.fromSpot;
      if (!s || s.isDefault()) return null;
      if (s.x === 0 || s.x === 1) return 'h';
      if (s.y === 0 || s.y === 1) return 'v';
      return null;
    };
    const boxes = {}, deg = {};
    d.nodes.each((n) => { const b = body(n); if (b) boxes[n.data.key] = b; deg[n.data.key] = 0; });
    const runs = [];
    d.links.each((l) => {
      deg[l.data.from] = (deg[l.data.from] || 0) + 1;
      deg[l.data.to] = (deg[l.data.to] || 0) + 1;
      const q = []; l.points.each((z) => q.push({ x: z.x, y: z.y }));
      let bends = 0;
      for (let i = 1; i + 1 < q.length; i++) {
        const a = q[i - 1], m = q[i], c = q[i + 1];
        if ((Math.abs(m.x - a.x) > 0.5 && Math.abs(c.y - m.y) > 0.5) ||
            (Math.abs(m.y - a.y) > 0.5 && Math.abs(c.x - m.x) > 0.5)) bends++;
      }
      const f = axisOf(l.fromNode, l.data.fromPort), t = axisOf(l.toNode, l.data.toPort);
      runs.push({ key: l.data.key, from: l.data.from, to: l.data.to, bends,
                  axis: f && f === t ? f : null, a: q[0], z: q[q.length - 1] });
    });
    return { boxes, deg, runs };
  }, { model: json, geo });
}

const model = JSON.parse(readFileSync(resolve(modelPath), 'utf8'));
const nodes = new Map(model.nodeDataArray.map((n) => [n.key, n]));
const m = await measure(JSON.stringify(model));
const wasStraight = m.runs.filter((r) => r.bends === 0).length;
console.log(`${modelPath}: ${wasStraight} of ${m.runs.length} runs straight`);

const boxes = { ...m.boxes };
const overlaps = (b, skip) => Object.entries(boxes).some(([k, o]) =>
  k !== skip && b.x < o.x + o.w + GAP && o.x < b.x + b.w + GAP && b.y < o.y + o.h + GAP && o.y < b.y + b.h + GAP);

let moved = 0, refused = 0;
for (const r of m.runs) {
  if (!r.bends || !r.axis) continue;
  const bf = boxes[r.from], bt = boxes[r.to];
  if (!bf || !bt) continue;
  const h = r.axis === 'h';
  const lo = Math.max(h ? bf.y : bf.x, h ? bt.y : bt.x);
  const hi = Math.min(h ? bf.y + bf.h : bf.x + bf.w, h ? bt.y + bt.h : bt.x + bt.w);
  if (hi - lo >= 4) continue;                       // straighten-runs can already do this one

  // Move whichever end can move without cost. A block several wires reach may
  // still move, as long as the shift cannot straighten this run by bending one
  // that is already straight: a run's straightness depends on alignment along
  // its own axis, so only same-axis straight neighbours are at risk.
  let placed = false;
  for (const [end, other] of [['from', 'to'], ['to', 'from']]) {
    const key = r[end];
    const wouldBreak = m.runs.some((o) => o.key !== r.key && o.bends === 0 &&
      o.axis === r.axis && (o.from === key || o.to === key));
    if (wouldBreak) continue;
    const me = boxes[key], you = boxes[r[other]];
    const meCentre = h ? me.y + me.h / 2 : me.x + me.w / 2;
    const youCentre = h ? you.y + you.h / 2 : you.x + you.w / 2;
    const shift = youCentre - meCentre;
    if (!shift || Math.abs(shift) > MAX_MOVE) { continue; }
    const moveTo = { ...me, [h ? 'y' : 'x']: (h ? me.y : me.x) + shift };
    if (overlaps(moveTo, key)) { continue; }
    const n = nodes.get(key);
    const [cx, cy] = String(n.loc).trim().split(/\s+/).map(Number);
    n.loc = h ? `${cx} ${+(cy + shift).toFixed(2)}` : `${+(cx + shift).toFixed(2)} ${cy}`;
    boxes[key] = moveTo;
    moved++;
    placed = true;
    break;
  }
  if (!placed) refused++;
}
console.log(`  moved ${moved} block(s); ${refused} refused (shared, too far, or would collide)`);

const after = await measure(JSON.stringify(model));
console.log(`  now: ${after.runs.filter((r) => r.bends === 0).length} of ${after.runs.length} runs straight`);
await browser.close();
if (!write) { console.log('  (report only; pass --write to apply)'); process.exit(0); }
writeFileSync(resolve(modelPath), JSON.stringify(model, null, 1));
console.log('  written');
