/**
 * Rebuilds flow_diagrams.pptx.
 *
 * Two corrections against the uploaded version:
 *   1. Functional language only — no table, column, view, endpoint or SQL names.
 *   2. The Salesforce embedding was only half-told: level 1 (Salesforce hosts
 *      the workspace view) was there, level 2 (the workspace view hosts the
 *      block diagram canvas, opened from a preview image) was missing. Slide 4
 *      is new and carries it.
 *
 * One layout description drives both the .pptx and an HTML preview, so what is
 * inspected is what ships.
 */
const fs = require('fs');
const PptxGen = require('pptxgenjs');

// Arrow palette. Neutral greys are chrome only (zone borders, captions).
const BLACK = '000000', WHITE = 'FFFFFF';
const SKY = '0084D5', GREEN = '47D7AC', ORANGE = 'FF8674', COPPER = 'FFC845';
const INK = '1A1A1A', MUTE = '6B7280', RULE = 'B8BDC4', WASH = 'F6F7F8';

const W = 20, H = 11.25;
const FONT = 'Calibri', HEAD = 'Cambria';

// ---------------------------------------------------------------------------
// Layout primitives. Everything is inches.
// ---------------------------------------------------------------------------
const S = [];                       // slides
let cur = null;
const slide = (title, kicker) => { cur = { title, kicker, zones: [], nodes: [], arrows: [], notes: '' }; S.push(cur); return cur; };
const zone = (x, y, w, h, label) => cur.zones.push({ x, y, w, h, label });
const box = (id, x, y, w, h, title, sub, accent, opts = {}) => {
  const n = { id, x, y, w, h, title, sub, accent, ...opts };
  cur.nodes.push(n); return n;
};
const N = (id, sl) => (sl || cur).nodes.find((n) => n.id === id);

/** Orthogonal arrow between two boxes. `route` picks the corridor. */
const arrow = (from, to, label, opts = {}) => cur.arrows.push({ from, to, label, ...opts });

/** Label boxes must never be wider than the gap they sit in. */
const labW = (t) => Math.max(0.5, Math.min(1.5, t.length * 0.058 + 0.14));

// edge anchors
const anchor = (n, side) => ({
  L: { x: n.x, y: n.y + n.h / 2 }, R: { x: n.x + n.w, y: n.y + n.h / 2 },
  T: { x: n.x + n.w / 2, y: n.y }, B: { x: n.x + n.w / 2, y: n.y + n.h },
}[side]);

/** Waypoints for an arrow, given the two side codes. */
function path(a, sl) {
  const f = anchor(N(a.from, sl), a.fromSide), t = anchor(N(a.to, sl), a.toSide);
  if (a.fromSide === 'R' && a.toSide === 'L' && Math.abs(f.y - t.y) < 0.01) return [f, t];
  if (a.fromSide === 'L' && a.toSide === 'R' && Math.abs(f.y - t.y) < 0.01) return [f, t];
  if ((a.fromSide === 'B' || a.fromSide === 'T') && Math.abs(f.x - t.x) < 0.01) return [f, t];
  // different axes: one clean elbow
  if ((a.fromSide === 'R' || a.fromSide === 'L') && (a.toSide === 'T' || a.toSide === 'B') && a.mid === undefined)
    return [f, { x: t.x, y: f.y }, t];
  if ((a.fromSide === 'T' || a.fromSide === 'B') && (a.toSide === 'L' || a.toSide === 'R') && a.mid === undefined)
    return [f, { x: f.x, y: t.y }, t];
  // same axis: leave along the from-side axis, then turn twice
  if (a.fromSide === 'R' || a.fromSide === 'L') {
    const mx = a.mid ?? (f.x + t.x) / 2;
    return [f, { x: mx, y: f.y }, { x: mx, y: t.y }, t];
  }
  const my = a.mid ?? (f.y + t.y) / 2;
  return [f, { x: f.x, y: my }, { x: t.x, y: my }, t];
}

// ===========================================================================
// SLIDE 1 — system architecture
// ===========================================================================
slide('System architecture', 'Design Workspace · Block Diagram · Salesforce · one database · Databricks');

zone(0.5, 1.35, 13.1, 3.9, 'INTERNAL — DESIGN AND BUILD');
zone(13.95, 1.35, 5.55, 3.9, 'SHARED SERVICES — USED BY BOTH APPS');
zone(0.5, 5.5, 7.0, 2.05, 'STORED DATA — ONE DATABASE, ONE OWNER PER AREA, NEVER WRITTEN ACROSS');
zone(7.8, 5.5, 11.7, 2.05, 'ANALYTICS AND AI CONTEXT');
zone(0.5, 8.05, 15.3, 2.85, 'CUSTOMER-FACING SURFACE — TWO LEVELS OF EMBEDDING');
zone(16.1, 8.05, 3.4, 2.85, 'LEGEND');

// internal, row 1
box('fae', 0.85, 2.0, 2.4, 0.95, 'FAE', 'designs the solution', BLACK, { kind: 'person' });
box('dws', 4.10, 2.0, 2.4, 0.95, 'Design Workspace', 'projects · designs · documents', SKY, { kind: 'screen' });
box('blk', 7.35, 2.0, 2.4, 0.95, 'Block diagram editor', 'canvas · parts · wiring', GREEN, { kind: 'screen' });
box('exp', 10.60, 2.0, 2.4, 0.95, 'Export service', 'makes the PDF and preview image', GREEN);
// internal, row 2
box('mgr', 0.85, 3.85, 2.4, 0.95, 'FAE manager', 'approves what customers see', BLACK, { kind: 'person' });
box('dwss', 4.10, 3.85, 2.4, 0.95, 'Workspace services', 'designs · documents · approval', SKY);
box('blks', 7.35, 3.85, 2.4, 0.95, 'Diagram services', 'diagrams · history · export', GREEN);

// shared services
box('sso', 14.30, 1.95, 4.85, 0.8, 'Single sign-on', 'one Arrow login for both apps', BLACK);
box('cat', 14.30, 3.00, 4.85, 0.8, 'Part catalogue', 'regional — eu · ap · ac', BLACK);
box('relay', 14.30, 4.05, 4.85, 0.8, 'Live collaboration', 'off in the Salesforce view', BLACK);

// stored data
box('dwsd', 0.825, 6.02, 2.55, 1.2, 'Workspace data', 'designs · documents · who may see them', COPPER, { kind: 'store' });
box('blkd', 4.60, 6.02, 2.55, 1.2, 'Diagram data', 'diagrams and their history', COPPER, { kind: 'store' });

// analytics
box('feed', 8.15, 6.02, 2.2, 1.2, 'Change feed', 'says what changed — never the files', COPPER, { kind: 'store', fill: COPPER });
box('lake', 11.05, 6.02, 2.4, 1.2, 'Databricks lakehouse', 'unified business context layer', COPPER, { kind: 'store', fill: COPPER });
box('ai', 14.25, 6.14, 2.1, 0.95, 'AI assistant', 'suggests reference designs and parts', BLACK);
box('src', 16.75, 6.14, 2.5, 0.95, 'Existing platform feeds', 'Salesforce · FAST · SiliconExpert · Eng KB — not ours', BLACK, { kind: 'feed' });

// customer-facing
box('pub', 0.65, 8.60, 2.9, 0.95, 'Published-content service', 'filters on the server, not in the UI', SKY);
box('view', 4.55, 8.60, 3.0, 0.95, 'Workspace view', 'a preview image per approved design', SKY, { kind: 'screen' });
box('sf', 8.55, 8.60, 3.0, 0.95, 'Salesforce', 'opportunity page · Design tab', ORANGE, { kind: 'cloud' });
box('rep', 12.55, 8.60, 2.9, 0.95, 'Sales rep', 'shares with the customer', BLACK, { kind: 'person' });
box('canvas', 4.55, 9.85, 3.0, 0.9, 'Block diagram canvas', 'opens on clicking a preview · read-only', GREEN, { kind: 'screen' });

arrow('fae', 'dws', 'designs', { fromSide: 'R', toSide: 'L' });
arrow('mgr', 'dwss', 'approves', { fromSide: 'R', toSide: 'L' });
arrow('dws', 'blk', 'micro-frontend', { fromSide: 'R', toSide: 'L', dash: true, color: SKY });
arrow('blk', 'exp', 'export', { fromSide: 'R', toSide: 'L' });
arrow('dws', 'dwss', '', { fromSide: 'B', toSide: 'T' });
arrow('blk', 'blks', '', { fromSide: 'B', toSide: 'T' });
arrow('exp', 'dwss', 'hands the file over', { fromSide: 'B', toSide: 'T', mid: 3.42 });
arrow('dwss', 'dwsd', 'saves', { fromSide: 'B', toSide: 'T', mid: 5.32 });
arrow('blks', 'blkd', 'saves', { fromSide: 'B', toSide: 'T', mid: 5.32 });
arrow('blkd', 'dwsd', 'read-only', { fromSide: 'L', toSide: 'R', dash: true });
arrow('dwsd', 'feed', 'same step as the change', { fromSide: 'B', toSide: 'B', mid: 7.60, color: COPPER });
arrow('feed', 'lake', 'ingest', { fromSide: 'R', toSide: 'L', color: COPPER });
arrow('lake', 'ai', 'context', { fromSide: 'R', toSide: 'L' });
arrow('src', 'lake', '', { fromSide: 'T', toSide: 'T', mid: 5.86, dash: true });
arrow('rep', 'sf', 'opens it', { fromSide: 'L', toSide: 'R', color: ORANGE });
arrow('sf', 'view', 'embeds · 1', { fromSide: 'L', toSide: 'R', color: ORANGE, dash: true });
arrow('view', 'canvas', 'embeds · 2', { fromSide: 'B', toSide: 'T', color: ORANGE, dash: true });
arrow('view', 'pub', 'asks for it', { fromSide: 'L', toSide: 'R', color: ORANGE });
arrow('canvas', 'pub', 'approved only', { fromSide: 'L', toSide: 'B', color: ORANGE });
arrow('pub', 'dwsd', 'approved only', { fromSide: 'T', toSide: 'B', color: ORANGE });

cur.legend = [
  ['person', 'Person'], ['screen', 'Screen'], ['box', 'Service'],
  ['store', 'Stored data'], ['cloud', 'External system'], ['feed', 'Not ours'],
];
cur.notes = 'Read it in four moves. Top band: the FAE designs in the workspace and the block diagram editor runs inside it as a micro-frontend — not a separate app. Middle: one database, two owners; neither side writes the other’s data. Analytics: the change feed is written in the same step as the change, so it cannot miss anything, and Databricks holds meaning, never the files. Bottom band: the customer-facing surface, and the two levels of embedding — Salesforce hosts the workspace view, the workspace view hosts the canvas.';

// ===========================================================================
// Flow slides — shared lane geometry
// ===========================================================================
const LANES = {
  fae:  { x: 0.30, label: 'FAE / APPROVER',   color: BLACK },
  blk:  { x: 4.25, label: 'BLOCK DIAGRAM',    color: GREEN },
  dws:  { x: 8.20, label: 'DESIGN WORKSPACE', color: SKY },
  data: { x: 12.15, label: 'STORED DATA',     color: COPPER },
  sf:   { x: 16.10, label: 'SALESFORCE',      color: ORANGE },
};
const LW = 3.6;                       // lane width
const ROWC = (i) => 2.50 + i * 1.55;  // row centreline — every shape centres on it

const lanes = (keys) => {
  cur.lanes = keys.map((k) => ({ ...LANES[k], key: k }));
};
/** Shape widths per kind, so a lane reads as a column but shapes keep sane proportions. */
const KW = { store: 2.7, decision: 3.0, term: 3.15, cloud: 3.0, doc: 3.15 };
const KH = { store: 1.2, decision: 1.35 };
const stepAt = (id, lane, row, title, sub, opts = {}) => {
  const w = opts.w ?? KW[opts.kind] ?? 3.15;
  const h = opts.h ?? KH[opts.kind] ?? 0.95;
  return box(id, LANES[lane].x + (LW - w) / 2, ROWC(row) - h / 2, w, h, title, sub, LANES[lane].color, opts);
};

// ===========================================================================
// SLIDE 2 — create, link, build
// ===========================================================================
slide('End-to-end flow — create, link, build', '1 OF 3 · A DESIGN CAN START WITH OR WITHOUT AN OPPORTUNITY');
lanes(['fae', 'blk', 'dws', 'data', 'sf']);

stepAt('a1', 'fae', 0, 'FAE opens Design Workspace', 'start', { kind: 'term' });
stepAt('a2', 'dws', 0, 'Create a design', 'name, customer, region');
stepAt('a3', 'data', 0, 'Design is saved', 'a draft, with no opportunity yet', { kind: 'store' });

stepAt('a4', 'fae', 1, 'Linked to a Salesforce opportunity?', 'ad-hoc designs are allowed', { kind: 'decision', h: 1.05 });
stepAt('a5', 'dws', 1, 'Check the opportunity exists', 'the only time we call Salesforce');
stepAt('a6', 'sf', 1, 'Opportunity record', 'read-only check', { kind: 'cloud' });

stepAt('a7', 'data', 2, 'Link recorded, change feed notified', 'both in one step, so the feed cannot miss it');

stepAt('a8', 'fae', 3, 'Open a block diagram', '');
stepAt('a9', 'blk', 3, 'Editor opens inside the workspace', 'micro-frontend, not a separate app');
stepAt('a10', 'data', 3, 'Diagram is loaded', '', { kind: 'store' });

stepAt('a11', 'blk', 4, 'Place blocks, search parts, wire', 'part search follows the design’s region');
stepAt('a12', 'blk', 5, 'Work is saved automatically', '');

arrow('a1', 'a2', '', { fromSide: 'R', toSide: 'L' });
arrow('a2', 'a3', 'saves', { fromSide: 'R', toSide: 'L' });
arrow('a1', 'a4', '', { fromSide: 'B', toSide: 'T' });
arrow('a4', 'a5', 'yes', { fromSide: 'R', toSide: 'L' });
arrow('a5', 'a6', 'checks', { fromSide: 'R', toSide: 'L' });
arrow('a5', 'a7', 'records it', { fromSide: 'B', toSide: 'T', mid: 4.86 });
arrow('a4', 'a8', 'no — ad-hoc design', { fromSide: 'B', toSide: 'T' });
arrow('a7', 'a8', 'continue', { fromSide: 'B', toSide: 'T', mid: 6.30 });
arrow('a8', 'a9', '', { fromSide: 'R', toSide: 'L' });
arrow('a9', 'a10', 'reads', { fromSide: 'R', toSide: 'L' });
arrow('a9', 'a11', '', { fromSide: 'B', toSide: 'T' });
arrow('a11', 'a12', '', { fromSide: 'B', toSide: 'T' });
arrow('a12', 'a10', 'saves', { fromSide: 'R', toSide: 'B' });
cur.notes = 'The decision on the left is worth pausing on: “no” is a valid answer. A design can be started cold, without an opportunity, and linked later. That was confirmed in the stakeholder round.';

// ===========================================================================
// SLIDE 3 — export and approve
// ===========================================================================
slide('End-to-end flow — export and approve', '2 OF 3 · NOTHING LEAVES ARROW UNTIL AN APPROVER SAYS SO');
lanes(['fae', 'blk', 'dws', 'data', 'sf']);

stepAt('b1', 'fae', 0, 'Export to PDF', 'from the block diagram');
stepAt('b2', 'blk', 0, 'File and preview image produced', '');
stepAt('b3', 'dws', 0, 'Filed against the design', 'the editor hands it over, it never files it itself');
stepAt('b4', 'data', 0, 'Saved as a draft', 'internal only until someone approves it', { kind: 'store' });

stepAt('b5', 'fae', 1, 'Approver publishes it?', 'only an approver on this design can', { kind: 'decision', h: 1.05 });
stepAt('b6', 'dws', 1, 'Check the approver’s role', 'refused if the caller is not an approver');

stepAt('b7', 'dws', 2, 'Stays a draft — internal only', 'never reaches Salesforce', { kind: 'doc' });
stepAt('b8', 'data', 2, 'Marked approved and customer-visible', 'refused for anything that may never leave Arrow');

stepAt('b9', 'data', 3, 'Who approved it, and when, is recorded', '', { kind: 'store' });
stepAt('b10', 'data', 4, 'Platform ingest job', 'picks up the change · owned by the data platform team', { fill: COPPER });
stepAt('b11', 'data', 5, 'Databricks lakehouse', 'linkage, metadata and meaning — never the files', { kind: 'store', fill: COPPER });

arrow('b1', 'b2', '', { fromSide: 'R', toSide: 'L' });
arrow('b2', 'b3', 'hands over', { fromSide: 'R', toSide: 'L' });
arrow('b3', 'b4', 'saves', { fromSide: 'R', toSide: 'L' });
arrow('b3', 'b5', '', { fromSide: 'B', toSide: 'T', mid: 3.30 });
arrow('b5', 'b6', 'yes', { fromSide: 'R', toSide: 'L' });
arrow('b5', 'b7', 'no', { fromSide: 'B', toSide: 'L' });
arrow('b6', 'b8', 'saves', { fromSide: 'R', toSide: 'L' });
arrow('b8', 'b9', '', { fromSide: 'B', toSide: 'T' });
arrow('b9', 'b10', '', { fromSide: 'B', toSide: 'T', color: COPPER });
arrow('b10', 'b11', '', { fromSide: 'B', toSide: 'T', color: COPPER });
cur.panel = {
  x: 16.10, y: 2.05, w: 3.6, h: 2.6,
  head: 'Why two steps?',
  body: 'Exporting produces a draft. Only an approver makes it customer-visible — and the refusal is enforced by the system, not by convention.\n\nSalesforce is not involved anywhere on this slide.',
};
cur.notes = 'Two separate steps by design. Exporting produces a draft; only an approver makes it customer-visible, and the refusal is enforced by the system rather than by convention. The copper pair at the bottom is the Databricks feed — it carries meaning, never the files.';

// ===========================================================================
// SLIDE 4 — the customer sees it (the part that was missing)
// ===========================================================================
slide('End-to-end flow — the customer sees it', '3 OF 3 · TWO LEVELS OF EMBEDDING, BOTH FILTERED ON THE SERVER');
lanes(['blk', 'dws', 'data', 'sf']);

stepAt('c1', 'sf', 0, 'Sales rep opens the opportunity', 'nothing loads yet');
stepAt('c2', 'sf', 1, 'Clicks View Design', 'the workspace view opens in the page — embedding level 1');
stepAt('c3', 'dws', 2, 'Ask for this design’s content', 'filtered on the server, not in the UI');
stepAt('c4', 'data', 2, 'Approved, customer-visible only', 'everything else is invisible to this request', { kind: 'store' });
stepAt('c5', 'dws', 3, 'Designs shown as preview images', 'one image per approved design');
stepAt('c6', 'blk', 4, 'Canvas opens on clicking a preview', 'inside the workspace view — embedding level 2 · read-only');
stepAt('c7', 'sf', 5, 'Rep shares the PDF with the customer', 'end', { kind: 'term' });

arrow('c1', 'c2', '', { fromSide: 'B', toSide: 'T' });
arrow('c2', 'c3', 'on click', { fromSide: 'L', toSide: 'T', color: ORANGE });
arrow('c3', 'c4', 'filtered', { fromSide: 'R', toSide: 'L', color: ORANGE });
arrow('c4', 'c5', '', { fromSide: 'B', toSide: 'R', color: ORANGE });
arrow('c5', 'c6', 'on click', { fromSide: 'L', toSide: 'R', color: ORANGE });
arrow('c6', 'c7', 'download', { fromSide: 'B', toSide: 'L', color: ORANGE });

// The inset: what "embedded" actually means, drawn as containment.
cur.inset = {
  x: 0.35, y: 2.05, w: 3.5, h: 5.6,
  caption: 'What “embedded” means',
  rings: [
    { label: 'Salesforce page', color: ORANGE, inset: 0.0 },
    { label: 'Workspace view', color: SKY, inset: 0.42 },
    { label: 'Block diagram canvas', color: GREEN, inset: 0.84 },
  ],
  foot: 'One page, three owners. Each level is filtered by its own service — nothing is hidden by the UI alone.',
};
cur.notes = 'This is the slide the earlier deck was missing. Level 1: Salesforce hosts the workspace view. Level 2: the workspace view hosts the block diagram canvas, opened by clicking a preview image. The important point is on the right — an unapproved design is not merely hidden from the rep, it is never returned to the page in the first place.';

// ===========================================================================
// Renderers
// ===========================================================================
const NODE_FILL = (n) => n.fill || WHITE;
const NODE_TEXT = (n) => (n.fill ? BLACK : INK);

function pptxShape(n) {
  if (n.kind === 'store') return 'flowChartMagneticDrum';
  if (n.kind === 'decision') return 'flowChartDecision';
  if (n.kind === 'term') return 'flowChartTerminator';
  if (n.kind === 'person') return 'flowChartTerminator';
  if (n.kind === 'screen') return 'flowChartDisplay';
  if (n.kind === 'cloud') return 'cloud';
  if (n.kind === 'feed') return 'flowChartInputOutput';
  if (n.kind === 'doc') return 'flowChartDocument';
  return 'roundRect';
}

function build() {
  const p = new PptxGen();
  p.defineLayout({ name: 'BIG', width: W, height: H });
  p.layout = 'BIG';
  p.author = 'Arrow';

  for (const sl of S) {
    const s = p.addSlide();
    s.background = { color: WHITE };

    s.addText(sl.title, { x: 0.5, y: 0.28, w: 14, h: 0.62, fontFace: HEAD, fontSize: 30, bold: true, color: INK, margin: 0 });
    s.addText(sl.kicker, { x: 0.5, y: 0.9, w: 18, h: 0.32, fontFace: FONT, fontSize: 11, color: MUTE, charSpacing: 1.2, margin: 0 });

    for (const z of sl.zones) {
      s.addShape('roundRect', {
        x: z.x, y: z.y, w: z.w, h: z.h, rectRadius: 0.06,
        fill: { color: WASH }, line: { color: RULE, width: 0.75, dashType: 'dash' },
      });
      s.addText(z.label, { x: z.x + 0.16, y: z.y + 0.08, w: z.w - 0.3, h: 0.26, fontFace: FONT, fontSize: 9, bold: true, color: MUTE, charSpacing: 0.9, margin: 0 });
    }

    if (sl.lanes) {
      for (const L of sl.lanes) {
        s.addShape('roundRect', { x: L.x, y: 1.35, w: LW, h: 0.44, rectRadius: 0.05, fill: { color: L.color }, line: { color: L.color, width: 1 } });
        s.addText(L.label, {
          x: L.x, y: 1.35, w: LW, h: 0.44, align: 'center', valign: 'middle', margin: 0,
          fontFace: FONT, fontSize: 10.5, bold: true, charSpacing: 0.8,
          color: (L.color === COPPER || L.color === GREEN || L.color === ORANGE) ? BLACK : WHITE,
        });
      }
    }

    if (sl.panel) {
      const P = sl.panel;
      s.addShape('roundRect', { x: P.x, y: P.y, w: P.w, h: P.h, rectRadius: 0.06, fill: { color: WASH }, line: { color: RULE, width: 0.75, dashType: 'dash' } });
      s.addText(P.head, { x: P.x + 0.22, y: P.y + 0.2, w: P.w - 0.44, h: 0.34, fontFace: FONT, fontSize: 13, bold: true, color: INK, margin: 0 });
      s.addText(P.body, { x: P.x + 0.22, y: P.y + 0.62, w: P.w - 0.44, h: P.h - 0.85, fontFace: FONT, fontSize: 10.5, color: MUTE, margin: 0, valign: 'top' });
    }

    if (sl.inset) {
      const I = sl.inset;
      s.addText(I.caption, { x: I.x, y: I.y - 0.42, w: I.w, h: 0.3, fontFace: FONT, fontSize: 11, bold: true, color: INK, margin: 0 });
      const ringH = I.h - 1.5;
      I.rings.forEach((r, i) => {
        const pad = r.inset;
        s.addShape('roundRect', {
          x: I.x + pad, y: I.y + pad * 1.55, w: I.w - pad * 2, h: ringH - pad * 3.1, rectRadius: 0.05,
          fill: { color: WHITE }, line: { color: r.color, width: 2 },
        });
        s.addText(r.label, {
          x: I.x + pad + 0.08, y: I.y + pad * 1.55 + 0.1, w: I.w - pad * 2 - 0.16, h: 0.3,
          align: 'center', fontFace: FONT, fontSize: 10, bold: true, color: r.color, margin: 0,
        });
      });
      s.addText(I.foot, { x: I.x, y: I.y + I.h - 1.35, w: I.w, h: 1.2, fontFace: FONT, fontSize: 9.5, color: MUTE, margin: 0 });
    }

    // arrows first, so boxes sit on top of any near-miss
    for (const a of sl.arrows) {
      const pts = path(a, sl);
      const col = a.color || MUTE;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i], p2 = pts[i + 1];
        const last = i === pts.length - 2;
        s.addShape('line', {
          x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y),
          w: Math.abs(p2.x - p1.x), h: Math.abs(p2.y - p1.y),
          flipH: p2.x < p1.x, flipV: p2.y < p1.y,
          line: {
            color: col, width: a.color ? 1.75 : 1.25,
            dashType: a.dash ? 'dash' : 'solid',
            endArrowType: last ? 'triangle' : 'none',
          },
        });
      }
      if (a.label) {
        const m = pts.length === 2
          ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
          : { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 };
        const lw = labW(a.label);
        s.addText(a.label, {
          x: m.x - lw / 2, y: m.y - 0.15, w: lw, h: 0.3, align: 'center', valign: 'middle',
          fontFace: FONT, fontSize: 8, color: INK, margin: 0,
          fill: { color: WHITE }, shrinkText: true,
        });
      }
    }

    for (const n of sl.nodes) {
      const shp = pptxShape(n);
      s.addShape(shp, {
        x: n.x, y: n.y, w: n.w, h: n.h, ...(shp === 'roundRect' ? { rectRadius: 0.06 } : {}),
        fill: { color: NODE_FILL(n) }, line: { color: n.accent, width: 1.75 },
      });
      const tY = n.kind === 'store' ? n.y + 0.1 : n.y;
      s.addText(
        [
          { text: n.title, options: { fontSize: 11.5, bold: true, color: NODE_TEXT(n), breakLine: !!n.sub } },
          ...(n.sub ? [{ text: n.sub, options: { fontSize: 8.5, color: n.fill ? BLACK : MUTE } }] : []),
        ],
        { x: n.x + 0.12, y: tY, w: n.w - 0.24, h: n.h - (n.kind === 'store' ? 0.2 : 0), align: 'center', valign: 'middle', fontFace: FONT, margin: 0, shrinkText: true },
      );
    }

    if (sl.legend) {
      let ly = 8.55;
      for (const [kind, label] of sl.legend) {
        const fake = { x: 16.4, y: ly, w: 1.15, h: 0.3, kind };
        const shp = pptxShape(fake);
        s.addShape(shp, { x: fake.x, y: fake.y, w: fake.w, h: fake.h, ...(shp === 'roundRect' ? { rectRadius: 0.05 } : {}), fill: { color: WHITE }, line: { color: INK, width: 1.25 } });
        s.addText(label, { x: 17.7, y: ly, w: 1.7, h: 0.3, valign: 'middle', fontFace: FONT, fontSize: 9.5, color: INK, margin: 0 });
        ly += 0.39;
      }
    }

    if (sl.notes) s.addNotes(sl.notes);
  }

  return p.writeFile({ fileName: 'flow_diagrams.pptx' });
}

// --- HTML preview from the same layout, for visual inspection ---------------
function preview() {
  const px = (v) => v * 96;
  const svgShape = (n) => {
    const x = px(n.x), y = px(n.y), w = px(n.w), h = px(n.h);
    const fill = '#' + NODE_FILL(n), st = '#' + n.accent;
    if (n.kind === 'store') {
      const ry = Math.min(h * 0.16, 14);
      return `<path d="M${x} ${y + ry} a${w / 2} ${ry} 0 0 1 ${w} 0 v${h - 2 * ry} a${w / 2} ${ry} 0 0 1 ${-w} 0 Z" fill="${fill}" stroke="${st}" stroke-width="2"/>
        <path d="M${x} ${y + ry} a${w / 2} ${ry} 0 0 0 ${w} 0" fill="none" stroke="${st}" stroke-width="2"/>`;
    }
    if (n.kind === 'decision')
      return `<path d="M${x + w / 2} ${y} L${x + w} ${y + h / 2} L${x + w / 2} ${y + h} L${x} ${y + h / 2} Z" fill="${fill}" stroke="${st}" stroke-width="2"/>`;
    if (n.kind === 'term' || n.kind === 'person')
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${st}" stroke-width="2"/>`;
    if (n.kind === 'screen')
      return `<path d="M${x} ${y + h / 2} L${x + w * 0.2} ${y} L${x + w * 0.86} ${y} Q${x + w} ${y} ${x + w} ${y + h / 2} Q${x + w} ${y + h} ${x + w * 0.86} ${y + h} L${x + w * 0.2} ${y + h} Z" fill="${fill}" stroke="${st}" stroke-width="2"/>`;
    if (n.kind === 'cloud')
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2.4}" fill="${fill}" stroke="${st}" stroke-width="2"/>`;
    if (n.kind === 'feed')
      return `<path d="M${x + w * 0.12} ${y} L${x + w} ${y} L${x + w * 0.88} ${y + h} L${x} ${y + h} Z" fill="${fill}" stroke="${st}" stroke-width="2"/>`;
    if (n.kind === 'doc')
      return `<path d="M${x} ${y} L${x + w} ${y} L${x + w} ${y + h * 0.82} Q${x + w * 0.75} ${y + h} ${x + w / 2} ${y + h * 0.88} Q${x + w * 0.25} ${y + h * 0.76} ${x} ${y + h * 0.9} Z" fill="${fill}" stroke="${st}" stroke-width="2"/>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" stroke="${st}" stroke-width="2"/>`;
  };

  let html = `<style>body{margin:0;background:#333;font-family:Calibri,system-ui,sans-serif}
  .s{width:${px(W)}px;height:${px(H)}px;background:#fff;position:relative;margin:14px auto;overflow:hidden}
  .t{position:absolute;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.15}</style>`;

  for (const sl of S) {
    const saved = cur; cur = sl;
    html += `<div class="s"><svg width="${px(W)}" height="${px(H)}" style="position:absolute;left:0;top:0">
      <defs><marker id="ah" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6 z" fill="context-stroke"/></marker></defs>`;
    for (const z of sl.zones)
      html += `<rect x="${px(z.x)}" y="${px(z.y)}" width="${px(z.w)}" height="${px(z.h)}" rx="6" fill="#${WASH}" stroke="#${RULE}" stroke-dasharray="6 4"/>`;
    for (const L of (sl.lanes || []))
      html += `<rect x="${px(L.x)}" y="${px(1.35)}" width="${px(LW)}" height="${px(0.44)}" rx="5" fill="#${L.color}"/>`;
    if (sl.panel) {
      const P = sl.panel;
      html += `<rect x="${px(P.x)}" y="${px(P.y)}" width="${px(P.w)}" height="${px(P.h)}" rx="6" fill="#${WASH}" stroke="#${RULE}" stroke-dasharray="6 4"/>`;
    }
    if (sl.inset) {
      const I = sl.inset, ringH = I.h - 1.5;
      for (const r of I.rings)
        html += `<rect x="${px(I.x + r.inset)}" y="${px(I.y + r.inset * 1.55)}" width="${px(I.w - r.inset * 2)}" height="${px(ringH - r.inset * 3.1)}" rx="5" fill="#fff" stroke="#${r.color}" stroke-width="2"/>`;
    }
    for (const a of sl.arrows) {
      const pts = path(a, sl), col = '#' + (a.color || MUTE);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${px(p.x)} ${px(p.y)}`).join(' ');
      html += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${a.color ? 2 : 1.5}"${a.dash ? ' stroke-dasharray="6 4"' : ''} marker-end="url(#ah)"/>`;
    }
    for (const n of sl.nodes) html += svgShape(n);
    if (sl.legend) {
      let ly = 8.55;
      for (const [kind] of sl.legend) { html += svgShape({ x: 16.4, y: ly, w: 1.15, h: 0.3, kind, accent: INK }); ly += 0.39; }
    }
    html += `</svg>`;

    html += `<div class="t" style="left:${px(0.5)}px;top:${px(0.28)}px;width:${px(14)}px;height:${px(0.62)}px;justify-content:flex-start;font:bold 30px Cambria,serif;color:#${INK}">${sl.title}</div>`;
    html += `<div class="t" style="left:${px(0.5)}px;top:${px(0.9)}px;width:${px(18)}px;height:${px(0.32)}px;justify-content:flex-start;font:11px Calibri;color:#${MUTE};letter-spacing:.9px">${sl.kicker}</div>`;
    for (const z of sl.zones)
      html += `<div class="t" style="left:${px(z.x + 0.16)}px;top:${px(z.y + 0.08)}px;width:${px(z.w - 0.3)}px;height:${px(0.26)}px;justify-content:flex-start;font:bold 9px Calibri;color:#${MUTE};letter-spacing:.9px">${z.label}</div>`;
    for (const L of (sl.lanes || []))
      html += `<div class="t" style="left:${px(L.x)}px;top:${px(1.35)}px;width:${px(LW)}px;height:${px(0.44)}px;font:bold 10.5px Calibri;color:${(L.color === COPPER || L.color === GREEN || L.color === ORANGE) ? '#000' : '#fff'};letter-spacing:.8px">${L.label}</div>`;
    if (sl.panel) {
      const P = sl.panel;
      html += `<div class="t" style="left:${px(P.x + 0.22)}px;top:${px(P.y + 0.2)}px;width:${px(P.w - 0.44)}px;height:${px(0.34)}px;justify-content:flex-start;font:bold 13px Calibri;color:#${INK}">${P.head}</div>`;
      html += `<div class="t" style="left:${px(P.x + 0.22)}px;top:${px(P.y + 0.62)}px;width:${px(P.w - 0.44)}px;height:${px(P.h - 0.85)}px;justify-content:flex-start;align-items:flex-start;text-align:left;white-space:pre-line;font:10.5px Calibri;color:#${MUTE}">${P.body}</div>`;
    }
    if (sl.inset) {
      const I = sl.inset;
      html += `<div class="t" style="left:${px(I.x)}px;top:${px(I.y - 0.42)}px;width:${px(I.w)}px;height:${px(0.3)}px;justify-content:flex-start;font:bold 11px Calibri;color:#${INK}">${I.caption}</div>`;
      for (const r of I.rings)
        html += `<div class="t" style="left:${px(I.x + r.inset + 0.08)}px;top:${px(I.y + r.inset * 1.55 + 0.1)}px;width:${px(I.w - r.inset * 2 - 0.16)}px;height:${px(0.3)}px;font:bold 10px Calibri;color:#${r.color}">${r.label}</div>`;
      html += `<div class="t" style="left:${px(I.x)}px;top:${px(I.y + I.h - 1.35)}px;width:${px(I.w)}px;height:${px(1.2)}px;justify-content:flex-start;align-items:flex-start;text-align:left;font:9.5px Calibri;color:#${MUTE}">${I.foot}</div>`;
    }
    for (const a of sl.arrows) {
      if (!a.label) continue;
      const pts = path(a, sl);
      const m = pts.length === 2
        ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
        : { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 };
      const lw = labW(a.label);
      html += `<div class="t" style="left:${px(m.x - lw / 2)}px;top:${px(m.y - 0.15)}px;width:${px(lw)}px;height:${px(0.3)}px;background:#fff;font:8px Calibri;color:#${INK}">${a.label}</div>`;
    }
    for (const n of sl.nodes) {
      const tY = n.kind === 'store' ? n.y + 0.1 : n.y;
      html += `<div class="t" style="left:${px(n.x + 0.12)}px;top:${px(tY)}px;width:${px(n.w - 0.24)}px;height:${px(n.h - (n.kind === 'store' ? 0.2 : 0))}px;flex-direction:column">
        <div style="font:bold 11.5px Calibri;color:#${NODE_TEXT(n)}">${n.title}</div>
        ${n.sub ? `<div style="font:8.5px Calibri;color:#${n.fill ? '000000' : MUTE}">${n.sub}</div>` : ''}</div>`;
    }
    if (sl.legend) {
      let ly = 8.55;
      for (const [, label] of sl.legend) {
        html += `<div class="t" style="left:${px(17.7)}px;top:${px(ly)}px;width:${px(1.7)}px;height:${px(0.3)}px;justify-content:flex-start;font:9.5px Calibri;color:#${INK}">${label}</div>`;
        ly += 0.39;
      }
    }
    html += `</div>`;
    cur = saved;
  }
  fs.writeFileSync('preview.html', html);
}

// --- geometry check --------------------------------------------------------
const BAD = [/\b(SELECT|INSERT|UPDATE|DELETE)\b/, /\b(dws|blk)\.[a-z_]/i, /\bv_[a-z_]+/i,
  /_(event|artifact|member|content|file|publication)\b/i, /\/(api|editor|embed)\b/, /\?[a-z]+=/i, /\b(GET|POST|PUT) /];
let problems = 0;
S.forEach((sl, si) => {
  const ns = sl.nodes;
  for (let i = 0; i < ns.length; i++)
    for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i], b = ns[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
        console.log(`slide ${si + 1} OVERLAP ${a.id} ↔ ${b.id}`); problems++;
      }
    }
  ns.forEach((n) => {
    if (n.x < 0.25 || n.y < 0.25 || n.x + n.w > W - 0.25 || n.y + n.h > H - 0.25) {
      console.log(`slide ${si + 1} OFF-SLIDE ${n.id}`); problems++;
    }
    [n.title, n.sub].forEach((t) => {
      if (t && BAD.some((re) => re.test(t))) { console.log(`slide ${si + 1} TOO LOW-LEVEL ${n.id}: "${t}"`); problems++; }
    });
  });
  sl.arrows.forEach((a) => {
    if (a.label && BAD.some((re) => re.test(a.label))) { console.log(`slide ${si + 1} TOO LOW-LEVEL ${a.from}→${a.to}: "${a.label}"`); problems++; }
  });
});
console.log(`${S.length} slides, ${S.reduce((t, s) => t + s.nodes.length, 0)} boxes, ${S.reduce((t, s) => t + s.arrows.length, 0)} arrows — ${problems ? problems + ' PROBLEMS' : 'clean'}`);

preview();
build().then(() => console.log('flow_diagrams.pptx written'));
