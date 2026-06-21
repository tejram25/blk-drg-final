/**
 * Generates an importable X6 diagram JSON for demoing the Bill of Materials
 * feature: catalogue part cards (shape "part-card", each carrying the full
 * catalogue object in data.part) laid out neatly INSIDE labelled container
 * shapes (basic-rounded), with a couple of duplicates so the BOM shows real
 * quantity tallying.
 *
 * The cards are built exactly like EditorComponent.buildPartCardCell so they
 * render correctly on import AND so exportBom() (which reads each node's
 * data.part) groups them by part number.
 *
 * Run:  node diagram-poc/samples/gen-bom-demo.mjs
 * Then: app -> Import -> JSON -> bom-demo.json, and Export -> Bill of Materials (CSV).
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cells = [];
let n = 0;
const id = (p) => `${p}-${++n}`;

const CARD_W = 240;
const CARD_H = 140;

// ---- Catalogue parts (same data the mock parts API / sample-parts.json serves) ----
const CATALOG = {
  INA250: {
    partKey: '104677992',
    arwPartNum: { name: 'INA250A3PWR' }, suppPartNum: { name: 'INA250A3PWR' },
    supp: { cd: 'Texas Instruments|TI', name: 'Texas Instruments' },
    mfr: { cd: 'TI', name: 'Texas Instruments' },
    icc: { name: 'Amplifier - Special Purpose' },
    invOrgs: [{ desc: 'Current Sense Amplifier, Single, 36V, Automotive, 16-Pin TSSOP' }],
    paramData: [
      { name: 'Type', val: 'Current Sense Amplifier', uom: ' ' },
      { name: 'Number of Channels', val: '1', uom: ' ' },
      { name: 'Single Supply Voltage (Min)', val: '2.7', uom: 'V' },
      { name: 'Single Supply Voltage (Max)', val: '36', uom: 'V' },
      { name: 'Operating Temp Range', val: '-40C to 125C', uom: ' ' },
      { name: 'Pin Count', val: '16', uom: ' ' },
      { name: 'Package Type', val: 'TSSOP', uom: ' ' },
    ],
  },
  DS91C176: {
    partKey: '200110045',
    arwPartNum: { name: 'DS91C176TMA/NOPB' }, suppPartNum: { name: 'DS91C176TMA' },
    supp: { cd: 'Texas Instruments|TI', name: 'Texas Instruments' },
    mfr: { cd: 'TI', name: 'Texas Instruments' },
    icc: { name: 'Transceiver' },
    invOrgs: [{ desc: 'Multipoint LVDS Transceiver, 8-Pin SOIC' }],
    paramData: [
      { name: 'Type', val: 'LVDS Transceiver', uom: ' ' },
      { name: 'Number of Channels', val: '1', uom: ' ' },
      { name: 'Single Supply Voltage (Min)', val: '3', uom: 'V' },
      { name: 'Single Supply Voltage (Max)', val: '3.6', uom: 'V' },
      { name: 'Pin Count', val: '8', uom: ' ' },
      { name: 'Package Type', val: 'SOIC', uom: ' ' },
    ],
  },
  LM317: {
    partKey: '300220088',
    arwPartNum: { name: 'LM317T' }, suppPartNum: { name: 'LM317T' },
    supp: { cd: 'Arrow', name: 'Arrow' },
    mfr: { cd: 'STM', name: 'STMicroelectronics' },
    icc: { name: 'Linear Regulator' },
    invOrgs: [{ desc: 'Adjustable Positive Voltage Regulator, 1.5A, TO-220' }],
    paramData: [
      { name: 'Type', val: 'Adjustable LDO Regulator', uom: ' ' },
      { name: 'Single Supply Voltage (Min)', val: '1.25', uom: 'V' },
      { name: 'Single Supply Voltage (Max)', val: '37', uom: 'V' },
      { name: 'Pin Count', val: '3', uom: ' ' },
      { name: 'Package Type', val: 'TO-220', uom: ' ' },
    ],
  },
  ESP32: {
    partKey: '400330011',
    arwPartNum: { name: 'ESP32-WROOM-32' }, suppPartNum: { name: 'ESP32-WROOM-32' },
    supp: { cd: 'Mouser', name: 'Mouser' },
    mfr: { cd: 'ESP', name: 'Espressif Systems' },
    icc: { name: 'Wireless Module' },
    invOrgs: [{ desc: 'Wi-Fi + Bluetooth/BLE MCU Module, PCB Antenna' }],
    paramData: [
      { name: 'Type', val: 'Wi-Fi/BLE MCU Module', uom: ' ' },
      { name: 'Single Supply Voltage (Min)', val: '3.0', uom: 'V' },
      { name: 'Single Supply Voltage (Max)', val: '3.6', uom: 'V' },
      { name: 'Pin Count', val: '38', uom: ' ' },
      { name: 'Package Type', val: 'SMD Module', uom: ' ' },
    ],
  },
  CAP: {
    partKey: '500440022',
    arwPartNum: { name: 'GRM188R71H104KA93D' }, suppPartNum: { name: 'GRM188R71H104KA93D' },
    supp: { cd: 'Digi-Key', name: 'Digi-Key' },
    mfr: { cd: 'MUR', name: 'Murata' },
    icc: { name: 'Ceramic Capacitor' },
    invOrgs: [{ desc: '0.1uF 50V X7R 0603 Ceramic Capacitor' }],
    paramData: [
      { name: 'Type', val: 'MLCC Capacitor', uom: ' ' },
      { name: 'Package Type', val: '0603', uom: ' ' },
    ],
  },
  BAV23S: {
    partKey: '600550033',
    arwPartNum: { name: 'BAV23S' }, suppPartNum: { name: 'BAV23S' },
    supp: { cd: 'Arrow', name: 'Arrow' },
    mfr: { cd: 'ONSEMI', name: 'onsemi' },
    icc: { name: 'Switching Diode' },
    invOrgs: [{ desc: 'Dual Series Switching Diode, 200V, SOT-23' }],
    paramData: [
      { name: 'Type', val: 'Switching Diode', uom: ' ' },
      { name: 'Pin Count', val: '3', uom: ' ' },
      { name: 'Package Type', val: 'SOT-23', uom: ' ' },
    ],
  },
};

// ---- Spec extraction, mirroring EditorComponent.buildPartCardCell ----
function specMap(part) {
  const byName = {};
  for (const p of part.paramData || []) {
    if (p?.name) byName[String(p.name).trim()] = { val: String(p.val ?? '').trim(), uom: String(p.uom ?? '').trim() };
  }
  return (name) => {
    const p = byName[name];
    if (!p || !p.val || /^not required$/i.test(p.val)) return '';
    return p.uom && p.uom !== ' ' ? `${p.val} ${p.uom}`.trim() : p.val;
  };
}

function partCard(part, x, y) {
  const spec = specMap(part);
  const title = part.arwPartNum?.name || part.suppPartNum?.name || part.partKey || 'Part';
  const supplier = part.supp?.name || part.mfr?.name || part.icc?.name || 'Component';

  const supplyMin = spec('Single Supply Voltage (Min)');
  const supplyMax = spec('Single Supply Voltage (Max)');
  const supply = supplyMin && supplyMax ? `${supplyMin} – ${supplyMax}` : (supplyMin || supplyMax || '');
  const pkg = [spec('Pin Count') && `${spec('Pin Count')}-pin`, spec('Package Type')].filter(Boolean).join(' ');
  const lines = [
    spec('Type') && `Type: ${spec('Type')}`,
    supply && `Supply: ${supply}`,
    spec('Number of Channels') && `Channels: ${spec('Number of Channels')}`,
    spec('Operating Temp Range') && `Temp: ${spec('Operating Temp Range')}`,
    pkg && `Pkg: ${pkg}`,
  ].filter(Boolean).slice(0, 4);

  const tip = part.invOrgs?.[0]?.desc || `${title} — ${supplier}`;
  cells.push({
    id: id('part'), shape: 'part-card', x, y, width: CARD_W, height: CARD_H, zIndex: 20,
    data: { typeKey: 'part', part },
    attrs: {
      tip: { text: String(tip) },
      img: { 'xlink:href': '', opacity: 0 },
      title: { text: String(title) },
      supplier: { text: String(supplier) },
      spec0: { text: lines[0] || '' },
      spec1: { text: lines[1] || '' },
      spec2: { text: lines[2] || '' },
      spec3: { text: lines[3] || '' },
    },
  });
}

// A labelled grouping container with the title pinned to the top.
function group(x, y, w, h, text, fill) {
  const cid = id('group');
  cells.push({
    id: cid, shape: 'basic-rounded', x, y, width: w, height: h, zIndex: 1,
    attrs: {
      body: { fill, stroke: '#cbd5e1', strokeWidth: 1.5 },
      label: {
        text, fill: '#0f172a', fontSize: 16, fontWeight: 700,
        refY: 24, refY2: 0, textVerticalAnchor: 'middle',
      },
    },
  });
  return cid;
}

function edge(source, target) {
  cells.push({
    id: id('edge'), shape: 'edge', zIndex: 2,
    source: { cell: source }, target: { cell: target },
    attrs: {
      line: { stroke: '#64748b', strokeWidth: 2, strokeDasharray: '6 4', targetMarker: { name: 'block', width: 10, height: 8 } },
    },
  });
}

// ---- Layout: three functional groups, 2x2 part grid inside each ----
const GROUP_W = 560;
const GROUP_H = 400;
const PAD = 28;          // inner padding from the container edge
const TITLE_H = 56;      // reserved for the group title
const GAP = 24;          // gap between cards

function fillGroup(gx, gy, parts) {
  parts.slice(0, 4).forEach((part, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = gx + PAD + col * (CARD_W + GAP);
    const y = gy + TITLE_H + row * (CARD_H + GAP);
    partCard(part, x, y);
  });
}

const TITLE_Y = 24;
cells.push({
  id: id('text'), shape: 'basic-text', x: 40, y: TITLE_Y, width: 760, height: 36, zIndex: 1,
  attrs: { label: { text: 'AMR Robot — Bill of Materials demo', fill: '#0f172a', fontSize: 22, fontWeight: 700, textAnchor: 'start', refX: 0 } },
});

const TOP = 84;
const gA = group(40, TOP, GROUP_W, GROUP_H, 'Power Supply', '#eef6ff');
fillGroup(40, TOP, [CATALOG.LM317, CATALOG.LM317, CATALOG.CAP, CATALOG.BAV23S]);

const gB = group(40 + GROUP_W + 60, TOP, GROUP_W, GROUP_H, 'Sensing & Comms', '#f3fbf6');
fillGroup(40 + GROUP_W + 60, TOP, [CATALOG.INA250, CATALOG.INA250, CATALOG.DS91C176, CATALOG.CAP]);

const gC = group(40 + (GROUP_W + 60) * 2, TOP, GROUP_W, GROUP_H, 'Compute & Motor Control', '#fff7ed');
fillGroup(40 + (GROUP_W + 60) * 2, TOP, [CATALOG.ESP32, CATALOG.CAP, CATALOG.CAP, CATALOG.DS91C176]);

// Signal/power flow between the functional groups.
edge(gA, gB);
edge(gB, gC);

const out = { cells };
const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, 'bom-demo.json');
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`Wrote ${file} — ${cells.length} cells (${cells.filter((c) => c.shape === 'part-card').length} part cards).`);
