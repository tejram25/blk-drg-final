/**
 * Make a run dead straight wherever the two blocks allow it.
 *
 * `tidy-wires.mjs` only nudges a run that is already within a few pixels of
 * straight. This goes further: when two blocks face each other and their
 * extents overlap on the perpendicular axis, a straight wire is always
 * possible — put both pins somewhere in that overlapping band. It is how the
 * source artwork gets its long straight runs, and it moves no block, only the
 * connection points along their own edges.
 *
 * Pins shared by more than one wire are left alone, and two pins on the same
 * side are kept apart, so straightening one run cannot pile two wires onto one
 * point or drag a third wire with it.
 *
 *   node straighten-runs.mjs 04-key-suppliers.gojs.json [--write]
 */
const pw = await import(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright/index.js');
const { chromium } = pw.default ?? pw;
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const [, , modelPath, ...flags] = process.argv;
if (!modelPath) { console.error('usage: straighten-runs.mjs model.json [--write]'); process.exit(2); }
const write = flags.includes('--write');
/** Keep two connection points on one side this far apart. */
const APART = 10;

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
    const side = (n, id) => {
      let p = null; n.ports.each((q) => { if (q.portId === id) p = q; });
      const s = p && p.fromSpot;
      if (!s || s.isDefault()) return null;
      if (s.x === 0 || s.x === 1) return 'h';
      if (s.y === 0 || s.y === 1) return 'v';
      return null;
    };
    const out = [];
    d.links.each((l) => {
      const q = []; l.points.each((z) => q.push({ x: z.x, y: z.y }));
      let bends = 0;
      for (let i = 1; i + 1 < q.length; i++) {
        const a = q[i - 1], m = q[i], c = q[i + 1];
        if ((Math.abs(m.x - a.x) > 0.5 && Math.abs(c.y - m.y) > 0.5) ||
            (Math.abs(m.y - a.y) > 0.5 && Math.abs(c.x - m.x) > 0.5)) bends++;
      }
      out.push({
        key: l.data.key, bends,
        axis: (() => { const f = side(l.fromNode, l.data.fromPort), t = side(l.toNode, l.data.toPort); return f && f === t ? f : null; })(),
        fromBox: body(l.fromNode), toBox: body(l.toNode),
        a: q[0], z: q[q.length - 1],
      });
    });
    return out;
  }, { model: json, geo });
}

const model = JSON.parse(readFileSync(resolve(modelPath), 'utf8'));
const nodes = new Map(model.nodeDataArray.map((n) => [n.key, n]));
const links = new Map(model.linkDataArray.map((l) => [l.key, l]));
const pinUse = new Map();
for (const l of model.linkDataArray) for (const w of ['from', 'to']) {
  const id = `${l[w]}::${l[w + 'Port']}`;
  pinUse.set(id, (pinUse.get(id) || 0) + 1);
}

const before = await measure(JSON.stringify(model));
const wasStraight = before.filter((e) => e.bends === 0).length;
console.log(`${modelPath}: ${wasStraight} of ${before.length} runs straight, ${before.reduce((s, e) => s + e.bends, 0)} bends`);

/** Coordinates already taken on each node's side, so two pins never coincide. */
const taken = new Map();
const key = (node, sideOf) => `${node}::${sideOf}`;
const claim = (k, v) => {
  const list = taken.get(k) || [];
  if (list.some((u) => Math.abs(u - v) < APART)) return false;
  list.push(v); taken.set(k, list); return true;
};
const sideOfSpot = (spot, axis) => {
  const [x, y] = String(spot).trim().split(/\s+/).map(Number);
  return axis === 'h' ? (x === 0 ? 'L' : 'R') : (y === 0 ? 'T' : 'B');
};
// reserve what every wire already uses, so we only move what we choose to
for (const e of before) {
  const l = links.get(e.key);
  if (!l || !e.axis) continue;
  for (const [w, box] of [['from', e.fromBox], ['to', e.toBox]]) {
    const port = (nodes.get(l[w])?.ports || []).find((p) => p.portId === l[w + 'Port']);
    if (!port || !box) continue;
    const v = e.axis === 'h' ? e.a.y : e.a.x;
    claim(key(l[w], sideOfSpot(port.spot, e.axis)), e.axis === 'h' ? (w === 'from' ? e.a.y : e.z.y) : (w === 'from' ? e.a.x : e.z.x));
  }
}

let fixed = 0, blocked = 0, shared = 0;
for (const e of before) {
  if (!e.bends || !e.axis || !e.fromBox || !e.toBox) continue;
  const l = links.get(e.key);
  if (!l) continue;
  const h = e.axis === 'h';
  const lo = Math.max(h ? e.fromBox.y : e.fromBox.x, h ? e.toBox.y : e.toBox.x);
  const hi = Math.min(h ? e.fromBox.y + e.fromBox.h : e.fromBox.x + e.fromBox.w,
                      h ? e.toBox.y + e.toBox.h : e.toBox.x + e.toBox.w);
  if (hi - lo < 4) { blocked++; continue; }        // the blocks do not face each other at all
  const ports = ['from', 'to'].map((w) => (nodes.get(l[w])?.ports || []).find((p) => p.portId === l[w + 'Port']));
  if (ports.some((p) => !p)) { blocked++; continue; }
  if (['from', 'to'].some((w) => pinUse.get(`${l[w]}::${l[w + 'Port']}`) !== 1)) { shared++; continue; }

  // stay near where the wire already is, but inside the band both blocks share
  const now = h ? (e.a.y + e.z.y) / 2 : (e.a.x + e.z.x) / 2;
  let target = Math.min(hi - 2, Math.max(lo + 2, now));
  const sides = ['from', 'to'].map((w, i) => key(l[w], sideOfSpot(ports[i].spot, e.axis)));
  let ok = sides.every((k) => !(taken.get(k) || []).some((u) => Math.abs(u - target) < APART));
  if (!ok) {                                       // slide along the band for a free slot
    for (let d = APART; d <= hi - lo && !ok; d += APART) {
      for (const cand of [target + d, target - d]) {
        if (cand < lo + 2 || cand > hi - 2) continue;
        if (sides.every((k) => !(taken.get(k) || []).some((u) => Math.abs(u - cand) < APART))) { target = cand; ok = true; break; }
      }
    }
  }
  if (!ok) { blocked++; continue; }
  sides.forEach((k) => claim(k, target));
  ['from', 'to'].forEach((w, i) => {
    const box = i === 0 ? e.fromBox : e.toBox;
    const s = String(ports[i].spot).trim().split(/\s+/).map(Number);
    if (h) s[1] = Math.min(1, Math.max(0, (target - box.y) / box.h));
    else s[0] = Math.min(1, Math.max(0, (target - box.x) / box.w));
    ports[i].spot = `${+s[0].toFixed(4)} ${+s[1].toFixed(4)}`;
    l[(w) + 'SpotXY'] = undefined; delete l[w + 'SpotXY'];
  });
  delete l.fromEnd; delete l.toEnd;
  fixed++;
}

const after = await measure(JSON.stringify(model));
const nowStraight = after.filter((e) => e.bends === 0).length;
console.log(`  straightened ${fixed}; ${shared} share a pin, ${blocked} cannot be straight without moving a block`);
console.log(`  now: ${nowStraight} of ${after.length} runs straight, ${after.reduce((s, e) => s + e.bends, 0)} bends`);
await browser.close();
if (!write) { console.log('  (report only; pass --write to apply)'); process.exit(0); }
writeFileSync(resolve(modelPath), JSON.stringify(model, null, 1));
console.log('  written');
