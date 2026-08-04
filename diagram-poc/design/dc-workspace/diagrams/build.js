/**
 * Generates the two stakeholder diagrams as GoJS model JSON that the block-diagram
 * editor loads directly (Import ▸ JSON).
 *
 * Node shapes match the editor's own templates:
 *   category 'block' — icon card with title + subtitle, ports T/R/B/L
 *   category 'shape' — native GoJS figure with an editable label and a caption
 *
 * `fixedColor: true` is required on every 'shape' node: retheme() overwrites
 * fill/stroke/labelColor on load unless it is set.
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

const WIRE = '#94a3b8'; // the editor's default link colour

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
//   cylinder              — stored data (an Oracle schema, a table, the lakehouse)
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

const arch = {
  class: 'GraphLinksModel',
  linkFromPortIdProperty: 'fromPort',
  linkToPortIdProperty: 'toPort',
  linkKeyProperty: 'key',
  nodeDataArray: [
    group('g-internal', 'Internal — design and build'),
    group('g-oracle', 'Oracle — one instance, two schemas, one writer each'),
    group('g-feed', 'Analytics and AI context'),
    group('g-shared', 'Shared services — called by both apps'),
    group('g-customer', 'Customer-facing surface — everything here is visible outside Arrow'),

    // Tier 1 — people and the screens they use
    group('g-legend', 'Legend'),

    // Title block
    { key: 'n-title', category: 'shape', shape: 'fc-process', figure: 'Rectangle', size: '280 58',
      text: 'System architecture', sub: 'DWS · BLK · Salesforce · Oracle · Databricks',
      loc: '180 -90', fill: BLACK, stroke: BLACK, labelColor: WHITE, fixedColor: true },

    // Legend — one sample of every figure the diagram uses
    { key: 'lg-actor', category: 'shape', shape: 'fc-terminator', figure: 'FcTerminator', size: '180 54',
      text: 'Person', loc: '2100 760', fill: WHITE, stroke: BLACK, labelColor: BLACK, fixedColor: true, group: 'g-legend' },
    { key: 'lg-screen', category: 'shape', shape: 'fc-display', figure: 'FcDisplay', size: '180 60',
      text: 'Screen', loc: '2100 880', fill: WHITE, stroke: BLACK, labelColor: BLACK, fixedColor: true, group: 'g-legend' },
    { key: 'lg-svc', category: 'shape', shape: 'fc-predefined', figure: 'FcPredefined', size: '180 60',
      text: 'Service', loc: '2100 1000', fill: WHITE, stroke: BLACK, labelColor: BLACK, fixedColor: true, group: 'g-legend' },
    { key: 'lg-store', category: 'shape', shape: 'fc-database', figure: 'FcCylinder', size: '155 80',
      text: 'Data store', loc: '2100 1130', fill: WHITE, stroke: BLACK, labelColor: BLACK, fixedColor: true, group: 'g-legend' },
    { key: 'lg-cloud', category: 'shape', shape: 'sh-cloud', figure: 'FcCloud', size: '180 80',
      text: 'External system', loc: '2100 1270', fill: WHITE, stroke: BLACK, labelColor: BLACK, fixedColor: true, group: 'g-legend' },
    { key: 'lg-feed', category: 'shape', shape: 'fc-data', figure: 'FcParallelogram', size: '180 58',
      text: 'External feed', loc: '2100 1390', fill: WHITE, stroke: BLACK, labelColor: BLACK, fixedColor: true, group: 'g-legend' },

    node('n-fae', 'actor', 180, 140, 'FAE', 'designs the solution', BLACK, 'g-internal'),
    node('n-dwsui', 'screen', 560, 140, 'DWS workspace', 'designs · artifacts · members', SKY, 'g-internal'),
    node('n-blkui', 'screen', 940, 140, 'BLK editor', 'GoJS canvas · parts · wiring', GREEN, 'g-internal'),
    node('n-render', 'service', 1320, 140, 'Render service', 'PDF and PNG artifact bytes', GREEN, 'g-internal'),

    // Tier 2 — services
    node('n-mgr', 'actor', 180, 360, 'FAE manager', 'approves publishing', BLACK, 'g-internal'),
    node('n-dwsapi', 'service', 560, 360, 'DWS API', 'designs · artifacts · publish', SKY, 'g-internal'),
    node('n-blkapi', 'service', 940, 360, 'BLK API', 'diagrams · versions · export', GREEN, 'g-internal'),

    // Tier 3 — Oracle, one cylinder per schema
    node('n-oradws', 'store', 560, 560, 'Oracle — DWS schema', 'design · artifact · member', COPPER, 'g-oracle'),
    node('n-orablk', 'store', 940, 560, 'Oracle — BLK schema', 'diagram · content · version', COPPER, 'g-oracle'),

    // Tier 4 — the feed and the lakehouse
    node('n-outbox', 'store', 940, 780, 'dws.outbox_event', 'metadata only · never artifact bytes', COPPER, 'g-feed',
      { fill: COPPER }),
    node('n-dbx', 'lakehouse', 1320, 780, 'Databricks lakehouse', 'unified business context layer', COPPER, 'g-feed',
      { fill: COPPER }),
    node('n-agent', 'service', 1700, 780, 'AI agent', 'called by the DWS API · reads context', BLACK, 'g-feed'),

    // Tier 5 — platform feeds we neither own nor operate
    node('n-sffeed', 'feed', 1150, 990, 'Salesforce → Databricks', 'existing platform pipeline · not ours', BLACK, 'g-feed'),
    node('n-srcs', 'feed', 1530, 990, 'FAST · SiliconExpert · Eng KB', 'existing platform sources · not ours', BLACK, 'g-feed'),

    // Shared services
    node('n-idp', 'service', 2100, 140, 'Arrow IdP', 'SSO — DWS and BLK', BLACK, 'g-shared'),
    node('n-cat', 'service', 2100, 360, 'Part catalogue', 'called by BLK API · eu · ap · ac', BLACK, 'g-shared'),
    node('n-relay', 'service', 2100, 560, 'Collab relay', 'y-websocket · off in the embed', BLACK, 'g-shared'),

    // Customer-facing band — flows right to left, back into our data
    node('n-rep', 'actor', 1700, 1240, 'Sales rep', 'shares with the customer', BLACK, 'g-customer'),
    node('n-opp', 'cloud', 1320, 1240, 'Salesforce', 'Opportunity record page · Design tab', ORANGE, 'g-customer'),
    node('n-embed', 'screen', 940, 1240, 'DWS embed view', 'read-only · published artifacts only', SKY, 'g-customer'),
    node('n-sfdcapi', 'service', 560, 1240, '/api/sfdc/**', 'server-filtered, never a UI flag', SKY, 'g-customer'),
  ],
  linkDataArray: [
    // internal build path
    link('n-fae', 'n-dwsui', 'R', 'L', 'designs'),
    link('n-mgr', 'n-dwsapi', 'R', 'L', 'approves and publishes'),
    link('n-dwsui', 'n-dwsapi', 'B', 'T'),
    link('n-dwsui', 'n-blkui', 'R', 'L', 'iframe /editor/118?embed=1', dashed),
    link('n-blkui', 'n-blkapi', 'B', 'T'),
    link('n-blkui', 'n-render', 'R', 'L', 'export'),
    link('n-render', 'n-dwsapi', 'B', 'T', 'POST /designs/42/artifacts'),

    // writes — each service writes only its own schema
    link('n-dwsapi', 'n-oradws', 'B', 'T', 'writes'),
    link('n-blkapi', 'n-orablk', 'B', 'T', 'writes'),
    link('n-orablk', 'n-oradws', 'L', 'R', 'V_DIAGRAM_V1 — read-only view', dashed),

    // Databricks feed
    link('n-oradws', 'n-outbox', 'B', 'L', 'same transaction', { color: COPPER, width: 2.5 }),
    link('n-outbox', 'n-dbx', 'R', 'L', 'ingest reads unshipped rows', { color: COPPER, width: 2.5 }),
    link('n-dbx', 'n-agent', 'R', 'L', 'context for recommendations'),
    link('n-sffeed', 'n-dbx', 'T', 'B', '', dashed),
    link('n-srcs', 'n-dbx', 'T', 'B', '', dashed),

    // customer-facing path
    link('n-rep', 'n-opp', 'L', 'R', 'opens the opportunity', { color: ORANGE, width: 2.5 }),
    link('n-opp', 'n-embed', 'L', 'R', 'iframe /embed/opportunity/0064x…', { color: ORANGE, width: 2.5, dash: [6, 4] }),
    link('n-embed', 'n-sfdcapi', 'L', 'R', 'designs, then artifacts', { color: ORANGE, width: 2.5 }),
    link('n-sfdcapi', 'n-oradws', 'L', 'L', 'v_published_artifact_v1 only', { color: ORANGE, width: 2.5 }),
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
      text: 'End-to-end flow', sub: 'create · build · export · publish · customer sees it',
      loc: '180 -60', fill: BLACK, stroke: BLACK, labelColor: WHITE, fixedColor: true },

    header('h-fae', 'fae', 'FAE / approver'),
    header('h-blk', 'blk', 'Block Diagram (BLK)'),
    header('h-dws', 'dws', 'Design Workspace (DWS)'),
    header('h-ora', 'ora', 'Oracle'),
    header('h-sf', 'sf', 'Salesforce'),

    step('s1', 'fae', 180, 'terminator', 'FAE opens Design Workspace', 'start'),
    step('s2', 'dws', 180, 'process', 'Create design', 'POST /api/designs'),
    step('s3', 'ora', 180, 'data', 'INSERT dws.design', 'stage DRAFT, no opportunity yet'),

    step('s4', 'fae', 320, 'decision', 'Linked to a Salesforce opportunity?', 'ad-hoc designs are allowed'),
    step('s5', 'dws', 320, 'process', 'Validate the opportunity', 'the only proactive call into Salesforce'),
    step('s6', 'ora', 460, 'process', 'UPDATE opportunity_id, INSERT outbox_event', 'one transaction, so the feed cannot miss it'),

    step('s7', 'fae', 600, 'process', 'Open a block diagram', 'Design ▸ Block diagrams'),
    step('s8', 'blk', 600, 'process', 'Load the diagram', 'iframe /editor/118?embed=1'),
    step('s9', 'ora', 600, 'data', 'BLK schema: diagram + content', ''),
    step('s10', 'blk', 740, 'process', 'Place blocks, search parts, wire', 'part search by region: eu · ap · ac'),
    step('s11', 'blk', 880, 'process', 'Autosave', 'UPDATE diagram_content'),

    step('s12', 'fae', 1020, 'process', 'Export to PDF', ''),
    step('s13', 'blk', 1020, 'process', 'Server-side render', 'PDF / PNG bytes'),
    step('s14', 'dws', 1020, 'process', 'Register the artifact', 'BLK posts to the DWS API — it never INSERTs'),
    step('s15', 'ora', 1020, 'data', 'design_artifact + artifact_file', "DRAFT, external_visible = 'N'"),

    step('s16', 'fae', 1160, 'decision', 'Approver publishes it?', 'design_member.role must be APPROVER'),
    step('s17', 'dws', 1160, 'process', 'Check the membership role', '403 if the caller is not an approver'),
    step('s21', 'dws', 1300, 'document', 'Stays DRAFT — internal only', 'never reaches Salesforce'),

    step('s18', 'ora', 1300, 'process', "PUBLISHED, external_visible = 'Y'", 'the trigger rejects kinds that are not externally eligible'),
    step('s19', 'ora', 1440, 'data', 'artifact_publication + outbox_event', 'who published it, when, which file'),
    step('s20', 'ora', 1580, 'process', 'Databricks ingest job', 'reads unshipped outbox rows · owned by the data platform team',
      { fill: COPPER, stroke: BLACK }),
    step('s20b', 'ora', 1720, 'data', 'Databricks lakehouse', 'linkage, metadata and semantics — never artifact bytes',
      { fill: COPPER, stroke: BLACK }),

    step('s22', 'sf', 1440, 'process', 'Sales rep opens the Opportunity', 'no call yet — the button is only rendered'),
    step('s23', 'sf', 1860, 'process', 'Clicks View Design', 'iframe /embed/opportunity/0064x…'),
    step('s24', 'dws', 1860, 'process', 'GET /api/sfdc/**', 'server-filtered, never a UI flag'),
    step('s25', 'ora', 2000, 'process', 'SELECT v_published_artifact_v1', 'PUBLISHED + external_visible + eligible kind'),
    step('s26', 'sf', 2140, 'terminator', 'Customer-safe PDF is shown', 'end'),
  ],
  linkDataArray: [
    link('s1', 's2', 'R', 'L'),
    link('s2', 's3', 'R', 'L', 'writes'),
    link('s1', 's4', 'B', 'T'),
    link('s4', 's5', 'R', 'L', 'yes'),
    link('s5', 's6', 'R', 'L', 'link and emit'),
    link('s4', 's7', 'B', 'T', 'no — ad-hoc design'),
    link('s6', 's7', 'L', 'R', 'continue'),
    link('s7', 's8', 'R', 'L'),
    link('s8', 's9', 'R', 'L', 'reads'),
    link('s8', 's10', 'B', 'T'),
    link('s10', 's11', 'B', 'T'),
    link('s11', 's9', 'R', 'B', 'writes'),
    link('s11', 's12', 'L', 'T'),
    link('s12', 's13', 'R', 'L'),
    link('s13', 's14', 'R', 'L', 'POST /designs/42/artifacts'),
    link('s14', 's15', 'R', 'L', 'writes'),
    link('s14', 's16', 'B', 'T'),
    link('s16', 's17', 'R', 'L', 'yes'),
    link('s16', 's21', 'B', 'L', 'no'),
    link('s17', 's18', 'R', 'L', 'writes'),
    link('s18', 's19', 'B', 'T'),
    link('s19', 's20', 'B', 'T', '', { color: COPPER, width: 2.5 }),
    link('s20', 's20b', 'B', 'T', '', { color: COPPER, width: 2.5 }),
    link('s19', 's22', 'R', 'L', 'now visible to the rep', { color: ORANGE, width: 2.5 }),
    link('s22', 's23', 'B', 'T'),
    link('s23', 's24', 'L', 'R', 'lazy — only on click', { color: ORANGE, width: 2.5 }),
    link('s24', 's25', 'R', 'L', 'reads the view, not the table', { color: ORANGE, width: 2.5 }),
    link('s25', 's26', 'R', 'L', 'stream the file', { color: ORANGE, width: 2.5 }),
  ],
};

// ---------------------------------------------------------------------------
// Geometry check — catch overlapping cards before a stakeholder does
// ---------------------------------------------------------------------------

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
  const hits = [];
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      if (a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b) hits.push(`${a.key} ↔ ${b.key}`);
    }
  const keys = new Set(model.nodeDataArray.map((n) => n.key));
  const bad = model.linkDataArray.filter((l) => !keys.has(l.from) || !keys.has(l.to));
  console.log(
    `${name}: ${model.nodeDataArray.length} nodes, ${model.linkDataArray.length} links, ` +
    `${hits.length} overlaps${hits.length ? ' → ' + hits.join(', ') : ''}` +
    `${bad.length ? ', DANGLING ' + bad.map((l) => l.from + '→' + l.to).join(', ') : ''}`,
  );
  return hits.length === 0 && bad.length === 0;
}

const ok1 = check('architecture', arch);
const ok2 = check('flow', flow);

const out = (file, model) =>
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(model, null, 2) + '\n');
out('01-architecture.gojs.json', arch);
out('02-end-to-end-flow.gojs.json', flow);
console.log(ok1 && ok2 ? 'written' : 'written WITH PROBLEMS');
process.exit(ok1 && ok2 ? 0 : 1);
