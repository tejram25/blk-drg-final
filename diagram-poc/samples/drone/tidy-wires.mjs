/**
 * Clean up a diagram's wiring: straighten runs that are nearly straight, and
 * pull apart wires that are drawn on top of each other.
 *
 * Two things make an otherwise correct drawing look hand-made, and both come
 * from the router rather than from the layout:
 *
 * 1. **Doglegs.** Orthogonal routing turns a 1 px difference between two
 *    nearly-aligned pins into a full S-bend. Every one of those reads as a
 *    wobble in a line that is meant to be straight.
 * 2. **Wires drawn as one.** Two wires making the same journey get the same
 *    crossbar position, so they overlap for part of their length and read as a
 *    single line that mysteriously has two arrowheads.
 *
 * The source artwork solves the second one by nesting: of two wires between
 * the same pair of columns, the one travelling furthest turns first. That is
 * `fromEndSegmentLength` in GoJS, so this writes `fromEnd` per wire.
 *
 *   node tidy-wires.mjs 01-drone-top-level.gojs.json          # report only
 *   node tidy-wires.mjs 01-drone-top-level.gojs.json --write
 *
 * Idempotent: a second run finds nothing left to do.
 */
const pw = await import(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright/index.js');
const { chromium } = pw.default ?? pw;
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const [, , modelPath, ...flags] = process.argv;
if (!modelPath) { console.error('usage: tidy-wires.mjs model.json [--write]'); process.exit(2); }
const write = flags.includes('--write');

const goSrc = readFileSync(resolve(__dir, '../../frontend/node_modules/gojs/release/go.js'), 'utf8');
const geo = JSON.parse(readFileSync(resolve(__dir, 'figures.json'), 'utf8'));

/** A run this close to straight was meant to be straight. */
const STRAIGHTEN_TOL = 6;
/** How much to lengthen one wire's first segment to move its crossbar clear. */
const NUDGE = 14;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1700, height: 1080 } });
page.on('pageerror', (e) => console.error('PAGEERROR:', e.message));

/** Load a model in the harness and report its geometry. */
async function measure(json) {
  await page.goto('file://' + resolve(__dir, 'render-harness.html'));
  await page.addScriptTag({ content: goSrc });
  return page.evaluate(async ({ model, geo, tol }) => {
    const d = window.buildDiagram(model, geo);
    await new Promise((r) => setTimeout(r, 450));
    d.updateAllTargetBindings();
    await new Promise((r) => setTimeout(r, 250));

    const ends = [], segs = [];
    d.links.each((l) => {
      const q = []; l.points.each((z) => q.push({ x: z.x, y: z.y }));
      const a = q[0], z = q[q.length - 1];
      // The *body* rectangle a pin's spot is a fraction of — taken from the four
      // edge rails that bound it, not from actualBounds, which a label overhangs.
      const box = (n) => {
        if (!n) return null;
        const rail = (id) => { let f = null; n.ports.each((q) => { if (q.portId === id) f = q; }); return f && f.getDocumentBounds(); };
        const L = rail('L'), R = rail('R'), T = rail('T'), B = rail('B');
        if (!L || !R || !T || !B) return null;
        return { x: L.x, y: T.y, w: R.x + R.width - L.x, h: B.y + B.height - T.y };
      };
      ends.push({ key: l.data.key, from: l.data.from, to: l.data.to,
                  fromPort: l.data.fromPort, toPort: l.data.toPort,
                  a, z, dx: Math.abs(a.x - z.x), dy: Math.abs(a.y - z.y),
                  fromBox: box(l.fromNode), toBox: box(l.toNode), bends: q.length - 1 });
      for (let i = 0; i + 1 < q.length; i++) {
        const s = q[i], e = q[i + 1];
        if (Math.abs(s.x - e.x) < 0.5 && Math.abs(s.y - e.y) > 1) segs.push({ v: 1, at: s.x, lo: Math.min(s.y, e.y), hi: Math.max(s.y, e.y), k: l.data.key });
        else if (Math.abs(s.y - e.y) < 0.5 && Math.abs(s.x - e.x) > 1) segs.push({ v: 0, at: s.y, lo: Math.min(s.x, e.x), hi: Math.max(s.x, e.x), k: l.data.key });
      }
    });
    const clashes = [];
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const a = segs[i], c = segs[j];
      if (a.v !== c.v || a.k === c.k || Math.abs(a.at - c.at) > 1.5) continue;
      const ov = Math.min(a.hi, c.hi) - Math.max(a.lo, c.lo);
      if (ov > 3) clashes.push({ a: a.k, b: c.k, overlap: ov });
    }
    // Only a run whose two ends face along the *same* axis can be straightened.
    // An L-shaped run (out of a right edge, into a top edge) is meant to bend,
    // and squaring it up would put the wire somewhere else entirely.
    const axis = (link, which) => {
      const node = which === 'from' ? link.fromNode : link.toNode;
      const id = link.data[which + 'Port'];
      let port = null;
      node?.ports.each((q) => { if (q.portId === id) port = q; });
      const s = port && port.fromSpot;
      if (!s || s.isDefault()) return null;
      if (s.x === 0 && s.y === 0.5) return 'h';
      if (s.x === 1 && s.y === 0.5) return 'h';
      if (s.y === 0 && s.x === 0.5) return 'v';
      if (s.y === 1 && s.x === 0.5) return 'v';
      return null;
    };
    const facing = new Map();
    d.links.each((l) => {
      const f = axis(l, 'from'), t = axis(l, 'to');
      facing.set(l.data.key, f && f === t ? f : null);
    });
    const kinks = ends.filter((e) => {
      const ax = facing.get(e.key);
      if (!ax || e.bends <= 1) return false;
      // 0.25: below a quarter of a model unit nothing is visible at any
      // sane render scale, and chasing it would just churn the JSON.
      return ax === 'h' ? (e.dy > 0.25 && e.dy < tol && e.dx > 12)
                        : (e.dx > 0.25 && e.dx < tol && e.dy > 12);
    }).map((e) => ({ ...e, axis: facing.get(e.key) }));
    return { ends, clashes, kinks };
  }, { model: json, geo, tol: STRAIGHTEN_TOL });
}

const model = JSON.parse(readFileSync(resolve(modelPath), 'utf8'));
const nodes = new Map(model.nodeDataArray.map((n) => [n.key, n]));
const links = new Map(model.linkDataArray.map((l) => [l.key, l]));

/** How many wires share this pin — a pin two wires meet at must not be moved. */
const pinUse = new Map();
for (const l of model.linkDataArray) for (const w of ['from', 'to']) {
  const id = `${l[w]}::${l[w + 'Port']}`;
  pinUse.set(id, (pinUse.get(id) || 0) + 1);
}

let before = await measure(JSON.stringify(model));
console.log(`${modelPath}: ${before.kinks.length} doglegs, ${before.clashes.length} overlapping pairs`);

// --- 1. straighten ---
let straightened = 0;
for (const k of before.kinks) {
  const link = links.get(k.key);
  if (!link) continue;
  const horizontal = k.axis === 'h';   // a horizontal run: align the two y's
  // Move whichever end's pin only this wire uses; prefer the "to" end, which is
  // where the wire was dropped rather than aimed.
  const order = ['to', 'from'].filter((w) => pinUse.get(`${link[w]}::${link[w + 'Port']}`) === 1);
  let done = false;
  for (const w of order) {
    const node = nodes.get(link[w]);
    const port = (node?.ports || []).find((q) => q.portId === link[w + 'Port']);
    const box = w === 'from' ? k.fromBox : k.toBox;
    if (!node || !port || !box) continue;
    const target = w === 'to' ? k.a : k.z;      // match the other end
    const spot = String(port.spot).trim().split(/\s+/).map(Number);
    if (horizontal) spot[1] = Math.min(1, Math.max(0, (target.y - box.y) / box.h));
    else spot[0] = Math.min(1, Math.max(0, (target.x - box.x) / box.w));
    port.spot = `${+spot[0].toFixed(4)} ${+spot[1].toFixed(4)}`;
    straightened++; done = true; break;
  }
  if (!done) console.log(`  ! ${k.key} ${k.from}->${k.to}: both pins are shared, left alone`);
}

// --- 2. separate overlapping wires ---
// Re-measure first: straightening changes which wires overlap.
let mid = await measure(JSON.stringify(model));
let separated = 0;
for (let round = 0; round < 6 && mid.clashes.length; round++) {
  const byKey = new Map(mid.ends.map((e) => [e.key, e]));
  const moved = new Set();
  for (const c of mid.clashes) {
    // Nest them: the wire travelling furthest across turns first, so the one
    // with the *shorter* cross travel is the one pushed outward.
    const ea = byKey.get(c.a), eb = byKey.get(c.b);
    if (!ea || !eb) continue;
    const cross = (e) => Math.min(e.dx, e.dy);
    const pick = cross(ea) <= cross(eb) ? c.a : c.b;
    if (moved.has(pick)) continue;
    const link = links.get(pick);
    if (!link) continue;
    link.fromEnd = (typeof link.fromEnd === 'number' ? link.fromEnd : 10) + NUDGE;
    moved.add(pick); separated++;
  }
  if (!moved.size) break;
  mid = await measure(JSON.stringify(model));
}

const after = mid;
console.log(`  straightened ${straightened}, nudged ${separated}`);
console.log(`  now: ${after.kinks.length} doglegs, ${after.clashes.length} overlapping pairs`);
for (const k of after.kinks)
  console.log(`  ! still kinked: ${k.key} ${k.from}:${k.fromPort}->${k.to}:${k.toPort} ${k.axis} off ${Math.round(Math.min(k.dx, k.dy) * 10) / 10}px`
    + ` a=${Math.round(k.a.x)},${Math.round(k.a.y)} z=${Math.round(k.z.x)},${Math.round(k.z.y)}`);
for (const c of after.clashes) console.log(`  ! still overlapping: ${c.a} and ${c.b} by ${Math.round(c.overlap)}px`);

await browser.close();
if (!write) { console.log('  (report only; pass --write to apply)'); process.exit(0); }
writeFileSync(resolve(modelPath), JSON.stringify(model, null, 1));
console.log('  written');
