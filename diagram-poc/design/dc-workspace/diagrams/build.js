/**
 * Generates the two stakeholder diagrams as GoJS model JSON that the block-diagram
 * editor loads directly (File ▸ Import ▸ Import JSON).
 *
 * These are FUNCTIONAL diagrams: they name capabilities and business steps, not
 * tables, columns, views or endpoints. The implementation detail lives in
 * data-model.md — keep it there, so this pair stays readable to people who do
 * not work on the schema. `check()` below fails the build if schema or endpoint
 * names creep back in.
 *
 * Nodes use category 'shape' — a native GoJS figure with an editable label and a
 * caption. `fixedColor: true` is required on every one: the editor's retheme()
 * pass overwrites fill/stroke/labelColor on load unless it is set.
 *
 * Run: node build.js
 */
const fs = require('fs');
const path = require('path');

// Arrow brand palette — the only six colours in play.
const BLACK = '#000000';
const WHITE = '#FFFFFF';
const SKY = '#0084D5';
const GREEN = '#47D7AC';
const ORANGE = '#FF8674';
const COPPER = '#FFC845';

let linkSeq = 0;
const link = (from, to, fromPort, toPort, text, opts = {}) => ({
  key: `l${++linkSeq}`, from, to, fromPort, toPort,
  ...(text ? { text } : {}), ...opts,
});
const dashed = { dash: [6, 4] };

// ---------------------------------------------------------------------------
// Diagram 1 — high-level architecture
//
// Every component uses the flowchart figure that matches what it *is*, so the
// picture is readable without the legend:
//   terminator (stadium) — a person
//   display               — a screen a user looks at
//   predefined process    — a service / deployable component
//   cylinder              — stored data
//   cloud                 — a system outside Arrow's control
//   parallelogram         — a data feed arriving from elsewhere
// ---------------------------------------------------------------------------

const AFIG = {
  actor:     { shape: 'fc-terminator',  figure: 'FcTerminator',     size: '230 74' },
  screen:    { shape: 'fc-display',     figure: 'FcDisplay',        size: '260 96' },
  service:   { shape: 'fc-predefined',  figure: 'FcPredefined',     size: '260 96' },
  store:     { shape: 'fc-database',    figure: 'FcCylinder',       size: '215 120' },
  lakehouse: { shape: 'fc-database',    figure: 'FcCylinder',       size: '235 132' },
  cloud:     { shape: 'sh-cloud',       figure: 'FcCloud',          size: '265 132' },
  feed:      { shape: 'fc-data',        figure: 'FcParallelogram',  size: '255 88' },
};

const node = (key, kind, x, y, text, sub, stroke, grp, extra = {}) => ({
  key, category: 'shape', ...AFIG[kind], text, ...(sub ? { sub } : {}),
  loc: `${x} ${y}`, fill: WHITE, stroke, labelColor: BLACK, fixedColor: true,
  ...(grp ? { group: grp } : {}), ...extra,
});
const group = (key, text) => ({ key, isGroup: true, text, expanded: true });
const legend = (key, kind, y, text, size) => ({
  key, category: 'shape', ...AFIG[kind], ...(size ? { size } : {}), text,
  loc: `2100 ${y}`, fill: WHITE, stroke: BLACK, labelColor: BLACK,
  fixedColor: true, group: 'g-legend',
});

const arch = {
  class: 'GraphLinksModel',
  linkFromPortIdProperty: 'fromPort',
  linkToPortIdProperty: 'toPort',
  linkKeyProperty: 'key',
  nodeDataArray: [
    group('g-internal', 'Internal — design and build'),
    group('g-oracle', 'Stored data — one database, one owner per area'),
    group('g-feed', 'Analytics and AI context'),
    group('g-shared', 'Shared services — used by both apps'),
    group('g-customer', 'Customer-facing surface — two levels of micro-frontend, everything here is visible outside Arrow'),
    group('g-legend', 'Legend'),

    // Title block
    { key: 'n-title', category: 'shape', shape: 'fc-process', figure: 'Rectangle', size: '280 58',
      text: 'System architecture', sub: 'Design Workspace · Block Diagram · Salesforce',
      loc: '180 -90', fill: BLACK, stroke: BLACK, labelColor: WHITE, fixedColor: true },

    // Legend — one sample of every figure the diagram uses
    legend('lg-actor', 'actor', 760, 'Person', '180 54'),
    legend('lg-screen', 'screen', 880, 'Screen', '180 60'),
    legend('lg-svc', 'service', 1000, 'Service', '180 60'),
    legend('lg-store', 'store', 1130, 'Stored data', '155 80'),
    legend('lg-cloud', 'cloud', 1270, 'External system', '180 80'),
    legend('lg-feed', 'feed', 1390, 'External data feed', '180 58'),

    // Tier 1 — people and the screens they use.
    // Level-1 nesting also exists internally: the editor runs inside the workspace.
    node('n-fae', 'actor', 180, 140, 'FAE', 'designs the solution', BLACK, 'g-internal'),
    node('n-dwsui', 'screen', 560, 140, 'Design Workspace', 'projects · designs · documents', SKY, 'g-internal'),
    node('n-blkui', 'screen', 940, 140, 'Block diagram editor', 'canvas · parts · wiring', GREEN, 'g-internal'),
    node('n-render', 'service', 1320, 140, 'Export service', 'turns a diagram into a PDF or image', GREEN, 'g-internal'),

    // Tier 2 — services
    node('n-mgr', 'actor', 180, 360, 'FAE manager', 'approves what customers see', BLACK, 'g-internal'),
    node('n-dwsapi', 'service', 560, 360, 'Workspace services', 'designs · documents · approval', SKY, 'g-internal'),
    node('n-blkapi', 'service', 940, 360, 'Diagram services', 'diagrams · history · export', GREEN, 'g-internal'),

    // Tier 3 — stored data, one cylinder per area of ownership
    node('n-oradws', 'store', 560, 560, 'Workspace data', 'designs · documents · who may see them', COPPER, 'g-oracle'),
    node('n-orablk', 'store', 940, 560, 'Diagram data', 'diagrams and their history', COPPER, 'g-oracle'),

    // Tier 4 — the feed and the lakehouse
    node('n-outbox', 'store', 940, 780, 'Change feed', 'says what changed · never the files themselves', COPPER, 'g-feed',
      { fill: COPPER }),
    node('n-dbx', 'lakehouse', 1320, 780, 'Databricks lakehouse', 'unified business context layer', COPPER, 'g-feed',
      { fill: COPPER }),
    node('n-agent', 'service', 1700, 780, 'AI assistant', 'suggests reference designs and parts', BLACK, 'g-feed'),

    // Tier 5 — platform feeds we neither own nor operate
    node('n-sffeed', 'feed', 1150, 990, 'Salesforce → Databricks', 'existing platform pipeline · not ours', BLACK, 'g-feed'),
    node('n-srcs', 'feed', 1530, 990, 'FAST · SiliconExpert · Eng KB', 'existing platform sources · not ours', BLACK, 'g-feed'),

    // Shared services
    node('n-idp', 'service', 2100, 140, 'Single sign-on', 'one Arrow login for both apps', BLACK, 'g-shared'),
    node('n-cat', 'service', 2100, 360, 'Part catalogue', 'regional — eu · ap · ac', BLACK, 'g-shared'),
    node('n-relay', 'service', 2100, 560, 'Live collaboration', 'off in the Salesforce view', BLACK, 'g-shared'),

    // Customer-facing band. Reads right to left, and the nesting goes downward:
    // Salesforce page → workspace view → block diagram canvas.
    node('n-rep', 'actor', 1700, 1240, 'Sales rep', 'shares with the customer', BLACK, 'g-customer'),
    node('n-opp', 'cloud', 1320, 1240, 'Salesforce', 'opportunity page · Design tab', ORANGE, 'g-customer'),
    node('n-embed', 'screen', 940, 1240, 'Workspace view', 'image preview per approved design', SKY, 'g-customer'),
    node('n-sfdcapi', 'service', 560, 1240, 'Published-content service', 'filters on the server, not in the UI', SKY, 'g-customer'),
    node('n-blkview', 'screen', 940, 1450, 'Block diagram canvas', 'opens on clicking a preview · read-only', GREEN, 'g-customer'),
  ],
  linkDataArray: [
    // internal build path — the editor is itself a micro-frontend inside the workspace
    link('n-fae', 'n-dwsui', 'R', 'L', 'designs'),
    link('n-mgr', 'n-dwsapi', 'R', 'L', 'approves'),
    link('n-dwsui', 'n-dwsapi', 'B', 'T'),
    link('n-dwsui', 'n-blkui', 'R', 'L', 'micro-frontend', dashed),
    link('n-blkui', 'n-blkapi', 'B', 'T'),
    link('n-blkui', 'n-render', 'R', 'L', 'export'),
    link('n-render', 'n-dwsapi', 'B', 'T', 'hands the file over'),

    // writes — each side owns its own data
    link('n-dwsapi', 'n-oradws', 'B', 'T', 'saves'),
    link('n-blkapi', 'n-orablk', 'B', 'T', 'saves'),
    link('n-orablk', 'n-oradws', 'L', 'R', 'read-only, never written across', dashed),

    // Databricks feed
    link('n-oradws', 'n-outbox', 'B', 'L', 'in the same step as the change', { color: COPPER, width: 2.5 }),
    link('n-outbox', 'n-dbx', 'R', 'L', 'platform ingest job picks it up', { color: COPPER, width: 2.5 }),
    link('n-dbx', 'n-agent', 'R', 'L', 'context'),
    link('n-sffeed', 'n-dbx', 'T', 'B', '', dashed),
    link('n-srcs', 'n-dbx', 'T', 'B', '', dashed),

    // customer-facing path, and the two levels of nesting
    link('n-rep', 'n-opp', 'L', 'R', 'opens the opportunity', { color: ORANGE, width: 2.5 }),
    link('n-opp', 'n-embed', 'L', 'R', 'micro-frontend · level 1', { color: ORANGE, width: 2.5, dash: [6, 4] }),
    link('n-embed', 'n-blkview', 'B', 'T', 'micro-frontend · level 2', { color: ORANGE, width: 2.5, dash: [6, 4] }),
    link('n-embed', 'n-sfdcapi', 'L', 'R', 'asks for this design’s content', { color: ORANGE, width: 2.5 }),
    link('n-blkview', 'n-sfdcapi', 'L', 'B', 'approved designs only', { color: ORANGE, width: 2.5 }),
    link('n-sfdcapi', 'n-oradws', 'L', 'L', 'approved and customer-visible only', { color: ORANGE, width: 2.5 }),
  ],
};

// ---------------------------------------------------------------------------
// Diagram 2 — end-to-end flow
// ---------------------------------------------------------------------------

const LANE = { fae: 180, blk: 540, dws: 900, ora: 1260, sf: 1620 };
const LANE_COLOR = { fae: BLACK, blk: GREEN, dws: SKY, ora: COPPER, sf: ORANGE };
const LANE_TEXT = { fae: WHITE, blk: BLACK, dws: WHITE, ora: BLACK, sf: BLACK };

const FIG = {
  process: { shape: 'fc-process', figure: 'Rectangle', size: '290 76' },
  terminator: { shape: 'fc-terminator', figure: 'FcTerminator', size: '290 64' },
  decision: { shape: 'fc-decision', figure: 'Diamond', size: '300 130' },
  data: { shape: 'fc-database', figure: 'FcCylinder', size: '230 100' },
  document: { shape: 'fc-document', figure: 'FcDocument', size: '280 84' },
  header: { shape: 'fc-process', figure: 'Rectangle', size: '300 48' },
};

const step = (key, lane, y, kind, text, sub, override = {}) => ({
  key, category: 'shape', ...FIG[kind], text, ...(sub ? { sub } : {}),
  loc: `${LANE[lane]} ${y}`,
  fill: WHITE, stroke: LANE_COLOR[lane], labelColor: BLACK, fixedColor: true,
  ...override,
});
const header = (key, lane, text) => ({
  key, category: 'shape', ...FIG.header, text, loc: `${LANE[lane]} 60`,
  fill: LANE_COLOR[lane], stroke: LANE_COLOR[lane], labelColor: LANE_TEXT[lane], fixedColor: true,
});

linkSeq = 0;
const flow = {
  class: 'GraphLinksModel',
  linkFromPortIdProperty: 'fromPort',
  linkToPortIdProperty: 'toPort',
  linkKeyProperty: 'key',
  nodeDataArray: [
    { key: 'f-title', category: 'shape', shape: 'fc-process', figure: 'Rectangle', size: '280 58',
      text: 'End-to-end flow', sub: 'create · build · export · approve · customer sees it',
      loc: '180 -60', fill: BLACK, stroke: BLACK, labelColor: WHITE, fixedColor: true },

    header('h-fae', 'fae', 'FAE / approver'),
    header('h-blk', 'blk', 'Block Diagram'),
    header('h-dws', 'dws', 'Design Workspace'),
    header('h-ora', 'ora', 'Stored data'),
    header('h-sf', 'sf', 'Salesforce'),

    step('s1', 'fae', 180, 'terminator', 'FAE opens Design Workspace', 'start'),
    step('s2', 'dws', 180, 'process', 'Create a design', 'name, customer, region'),
    step('s3', 'ora', 180, 'data', 'Design is saved', 'a draft, with no opportunity yet'),

    step('s4', 'fae', 320, 'decision', 'Linked to a Salesforce opportunity?', 'ad-hoc designs are allowed'),
    step('s5', 'dws', 320, 'process', 'Check the opportunity exists', 'the only time we call Salesforce'),
    step('s6', 'ora', 460, 'process', 'Link recorded, change feed notified', 'both in one step, so the feed cannot miss it'),

    step('s7', 'fae', 600, 'process', 'Open a block diagram', ''),
    step('s8', 'blk', 600, 'process', 'Editor opens inside the workspace', 'micro-frontend, not a separate app'),
    step('s9', 'ora', 600, 'data', 'Diagram is loaded', ''),
    step('s10', 'blk', 740, 'process', 'Place blocks, search parts, wire', 'part search follows the design’s region'),
    step('s11', 'blk', 880, 'process', 'Work is saved automatically', ''),

    step('s12', 'fae', 1020, 'process', 'Export to PDF', ''),
    step('s13', 'blk', 1020, 'process', 'File and preview image produced', ''),
    step('s14', 'dws', 1020, 'process', 'Filed against the design', 'the editor hands it over, it never files it itself'),
    step('s15', 'ora', 1020, 'data', 'Saved as a draft', 'internal only until someone approves it'),

    step('s16', 'fae', 1160, 'decision', 'Approver publishes it?', 'only an approver on this design can'),
    step('s17', 'dws', 1160, 'process', 'Check the approver’s role', 'refused if the caller is not an approver'),
    step('s21', 'dws', 1300, 'document', 'Stays a draft — internal only', 'never reaches Salesforce'),

    step('s18', 'ora', 1300, 'process', 'Marked approved and customer-visible', 'refused for anything that may never leave Arrow'),
    step('s19', 'ora', 1440, 'data', 'Who approved it, and when, is recorded', ''),
    step('s20', 'ora', 1580, 'process', 'Platform ingest job', 'picks up the change · owned by the data platform team',
      { fill: COPPER, stroke: BLACK }),
    step('s20b', 'ora', 1720, 'data', 'Databricks lakehouse', 'linkage, metadata and meaning — never the files',
      { fill: COPPER, stroke: BLACK }),

    step('s22', 'sf', 1440, 'process', 'Sales rep opens the opportunity', 'nothing loads yet'),
    step('s23', 'sf', 1860, 'process', 'Clicks View Design', 'workspace view opens in the page · micro-frontend level 1'),
    step('s24', 'dws', 1860, 'process', 'Ask for this design’s content', 'filtered on the server, not in the UI'),
    step('s25', 'ora', 2000, 'process', 'Approved, customer-visible only', 'everything else is invisible to this request'),
    step('s26', 'dws', 2140, 'process', 'Designs shown as preview images', 'one image per approved design'),
    step('s27', 'blk', 2280, 'process', 'Canvas opens on clicking a preview', 'inside the workspace view · micro-frontend level 2 · read-only'),
    step('s28', 'sf', 2420, 'terminator', 'Rep shares the PDF with the customer', 'end'),
  ],
  linkDataArray: [
    link('s1', 's2', 'R', 'L'),
    link('s2', 's3', 'R', 'L', 'saves'),
    link('s1', 's4', 'B', 'T'),
    link('s4', 's5', 'R', 'L', 'yes'),
    link('s5', 's6', 'R', 'L', 'record the link'),
    link('s4', 's7', 'B', 'T', 'no — ad-hoc design'),
    link('s6', 's7', 'L', 'R', 'continue'),
    link('s7', 's8', 'R', 'L'),
    link('s8', 's9', 'R', 'L', 'reads'),
    link('s8', 's10', 'B', 'T'),
    link('s10', 's11', 'B', 'T'),
    link('s11', 's9', 'R', 'B', 'saves'),
    link('s11', 's12', 'L', 'T'),
    link('s12', 's13', 'R', 'L'),
    link('s13', 's14', 'R', 'L', 'hands them over'),
    link('s14', 's15', 'R', 'L', 'saves'),
    link('s14', 's16', 'B', 'T'),
    link('s16', 's17', 'R', 'L', 'yes'),
    link('s16', 's21', 'B', 'L', 'no'),
    link('s17', 's18', 'R', 'L', 'saves'),
    link('s18', 's19', 'B', 'T'),
    link('s19', 's20', 'B', 'T', '', { color: COPPER, width: 2.5 }),
    link('s20', 's20b', 'B', 'T', '', { color: COPPER, width: 2.5 }),
    link('s19', 's22', 'R', 'L', 'now visible to the rep', { color: ORANGE, width: 2.5 }),
    link('s22', 's23', 'B', 'T'),
    link('s23', 's24', 'L', 'R', 'only on click', { color: ORANGE, width: 2.5 }),
    link('s24', 's25', 'R', 'L', 'server-side filter', { color: ORANGE, width: 2.5 }),
    link('s25', 's26', 'L', 'R', '', { color: ORANGE, width: 2.5 }),
    link('s26', 's27', 'L', 'R', 'click a preview', { color: ORANGE, width: 2.5 }),
    link('s27', 's28', 'R', 'L', 'download', { color: ORANGE, width: 2.5 }),
  ],
};

// ---------------------------------------------------------------------------
// Checks — catch overlapping cards, dangling links, and implementation detail
// leaking onto a functional diagram
// ---------------------------------------------------------------------------

const TOO_LOW_LEVEL = [
  /\b(SELECT|INSERT|UPDATE|DELETE)\b/,          // SQL
  /\b(dws|blk)\.[a-z_]+/i,                      // schema-qualified names
  /\bv_[a-z_]+/i,                               // view names
  /_(event|artifact|member|content|file|publication)\b/i,
  /\/(api|editor|embed)\b/,                     // URL paths
  /\?[a-z]+=/i,                                 // query strings
  /\b(GET|POST|PUT|PATCH) /,                    // HTTP verbs
];

function boxes(model) {
  return model.nodeDataArray
    .filter((n) => n.loc && n.size)
    .map((n) => {
      const [x, y] = n.loc.split(' ').map(Number);
      const [w, h] = n.size.split(' ').map(Number);
      return { key: n.key, l: x - w / 2, r: x + w / 2, t: y - h / 2, b: y + h / 2 };
    });
}

function check(name, model) {
  const bs = boxes(model);
  const overlaps = [];
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) overlaps.push(`${a.key} ↔ ${b.key}`);
    }

  const keys = new Set(model.nodeDataArray.map((n) => n.key));
  const dangling = model.linkDataArray.filter((l) => !keys.has(l.from) || !keys.has(l.to));

  const leaks = [];
  const scan = (owner, s) => {
    if (typeof s === 'string' && TOO_LOW_LEVEL.some((re) => re.test(s))) leaks.push(`${owner}: "${s}"`);
  };
  model.nodeDataArray.forEach((n) => { scan(n.key, n.text); scan(n.key, n.sub); });
  model.linkDataArray.forEach((l) => scan(`${l.from}→${l.to}`, l.text));

  const ok = !overlaps.length && !dangling.length && !leaks.length;
  console.log(
    `${name}: ${model.nodeDataArray.length} nodes, ${model.linkDataArray.length} links` +
    (ok ? ' — clean' : '') +
    (overlaps.length ? `\n  OVERLAP ${overlaps.join(', ')}` : '') +
    (dangling.length ? `\n  DANGLING ${dangling.map((l) => l.from + '→' + l.to).join(', ')}` : '') +
    (leaks.length ? `\n  TOO LOW-LEVEL ${leaks.join('; ')}` : ''),
  );
  return ok;
}

const ok1 = check('architecture', arch);
const ok2 = check('flow', flow);

const out = (file, model) =>
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(model, null, 2) + '\n');
out('01-architecture.gojs.json', arch);
out('02-end-to-end-flow.gojs.json', flow);
console.log(ok1 && ok2 ? 'written' : 'written WITH PROBLEMS');
process.exit(ok1 && ok2 ? 0 : 1);
