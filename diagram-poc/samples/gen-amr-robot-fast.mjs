/**
 * Generates an importable X6 diagram JSON that reconstructs the
 * "Sample - AMR Robot (FAST)" block diagram using only shapes this app
 * registers: basic-rectangle, basic-rounded, basic-text and the default edge.
 *
 * Run:  node diagram-poc/samples/gen-amr-robot-fast.mjs
 * Then import the produced .json via the app's Import -> JSON.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const cells = [];
let n = 0;
const id = (p) => `${p}-${++n}`;

const BLUE = '#1c9bd7';     // component boxes
const NAVY = '#0c3b66';     // robot chassis
const GREEN = '#34d3a6';    // central-processor group
const ORANGE = '#f4a82e';   // power-management group
const WHITE = '#ffffff';    // sub-system groups
const GRAY = '#e9ecef';     // "used everywhere" / charging groups
const TIRE = '#2b2f33';

// A filled box with a centered, wrapping label.
function box(x, y, w, h, text, {
  fill = BLUE, label = '#ffffff', stroke = 'none', strokeWidth = 0,
  rounded = false, fontSize = 13.5, bold = true, zIndex = 5,
} = {}) {
  const cid = id('box');
  cells.push({
    id: cid, shape: rounded ? 'basic-rounded' : 'basic-rectangle',
    x, y, width: w, height: h, zIndex,
    attrs: {
      body: { fill, stroke, strokeWidth },
      label: {
        text, fill, fontSize, fontWeight: bold ? 600 : 400,
        textWrap: { width: -12, height: -6, breakWord: true },
      },
    },
  });
  // fix: label fill should be the text colour, not the body fill
  cells[cells.length - 1].attrs.label.fill = label;
  return cid;
}

// A group container (background panel). Title is rendered as a separate text node.
function group(x, y, w, h, title, { fill = WHITE, titleColor = '#1f2937' } = {}) {
  const cid = id('grp');
  cells.push({
    id: cid, shape: 'basic-rectangle', x, y, width: w, height: h, zIndex: 2,
    attrs: { body: { fill, stroke: '#c9d2dc', strokeWidth: fill === WHITE ? 1.5 : 0 } },
  });
  if (title) {
    cells.push({
      id: id('t'), shape: 'basic-text', x, y: y + h - 24, width: w, height: 20, zIndex: 6,
      attrs: { label: { text: title, fill: titleColor, fontSize: 12.5, fontWeight: 700 } },
    });
  }
  return cid;
}

function edge(a, b, color, { z = 4 } = {}) {
  cells.push({
    shape: 'edge', source: { cell: a }, target: { cell: b }, zIndex: z,
    router: { name: 'manhattan' }, connector: { name: 'rounded' },
    attrs: { line: { stroke: color, strokeWidth: 3, targetMarker: null, sourceMarker: null } },
  });
}

// ---- chassis + wheels ----
const chassis = box(195, 88, 1110, 600, '', { fill: NAVY, rounded: true, zIndex: 1 });
for (const [wx, wy] of [[350, 30], [1018, 30], [350, 702], [1018, 702]]) {
  box(wx, wy, 150, 52, 'Wheel', { fill: TIRE, label: '#8b9099', rounded: true, fontSize: 11, bold: false, zIndex: 1 });
}

// ---- top: antenna + connectivity + central processor ----
const antenna = box(735, 33, 130, 38, 'Antenna');

group(556, 124, 360, 98, 'Connectivity');
const comm = box(566, 134, 164, 70, 'Communication Modules', { fontSize: 12.5 });
const gnss = box(742, 134, 164, 70, 'GNSS Modules');

group(700, 246, 224, 418, 'Central Processor', { fill: GREEN, titleColor: '#08402f' });
const mainProc = box(712, 256, 200, 120, 'Main Processor', { fontSize: 15 });
const ai = box(712, 388, 200, 60, 'AI Models');
const mem = box(712, 462, 200, 60, 'Memory');
const ros = box(712, 540, 200, 64, 'Robotics OS');

// ---- left: arm motor control, LED, sensors, sensor processor ----
const arm = box(228, 120, 162, 152, 'BLDC Motor Control (Robotic Arm)', { fontSize: 13 });

group(226, 328, 332, 70, '');
const led = box(238, 340, 100, 46, 'LED');
const ledDrv = box(398, 340, 148, 46, 'LED Drivers');

group(228, 440, 160, 222, 'Sensors');
const camera = box(240, 452, 136, 46, 'Camera');
const sensors = box(240, 510, 136, 46, 'Sensors');
const radar = box(240, 568, 136, 56, 'RADAR / LIDAR');

group(472, 440, 162, 222, 'Sensor Processor');
const sigAgg = box(484, 452, 140, 54, 'Signal Aggregation', { fontSize: 12.5 });
const analog = box(484, 516, 140, 48, 'Analog');
const rtProc = box(484, 574, 140, 50, 'Real Time Processor', { fontSize: 12.5 });

// ---- right-center: wheels motor control + power management ----
const wheelsCtl = box(975, 120, 256, 192, 'BLDC Motor Control (Wheels)', { fontSize: 15 });

group(964, 374, 288, 290, 'Power Management', { fill: ORANGE, titleColor: '#5a3b04' });
const smartFet = box(976, 386, 84, 66, 'Smart FETs', { fontSize: 12 });
const curSense = box(1068, 386, 88, 66, 'Current Sensing', { fontSize: 12 });
const efuse = box(1164, 386, 76, 66, 'eFuse', { fontSize: 12 });
const dcdc = box(976, 460, 120, 64, 'DC/DC Converters', { fontSize: 12 });
const ldo = box(1104, 460, 136, 64, 'LDO');
const bms = box(976, 534, 120, 70, 'BMS');
const battery = box(1104, 534, 136, 70, 'Battery');

// ---- right side panels (outside chassis) ----
group(1330, 55, 342, 300, 'Used everywhere', { fill: GRAY });
const ue = [
  'Circuit protection', 'Relays / Contactors',
  'IO Connectors', 'Board to Board Connectors',
  'Cable Assembly', 'W-t-W/ W-t-B Connectors',
  'Fans / Heatsinks', 'Buttons & Switches',
];
ue.forEach((label, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  box(1342 + col * 166, 70 + row * 68, 150, 58, label, { fontSize: 12.5 });
});

group(1385, 472, 256, 226, 'Charging Station', { fill: GRAY });
const wireless = box(1400, 486, 226, 44, 'Wireless Charging');
const pwrConn = box(1400, 560, 226, 44, 'Power Connectors');
box(1400, 636, 226, 44, 'AC/DC Power Supply');

// ---- bus wiring (evokes the FAST diagram's coloured links) ----
edge(mainProc, comm, GREEN);
edge(mainProc, gnss, GREEN);
edge(mainProc, sigAgg, GREEN);
edge(mainProc, arm, GREEN);
edge(mainProc, ledDrv, GREEN);
edge(mainProc, wheelsCtl, GREEN);
edge(mainProc, smartFet, GREEN);
edge(sigAgg, camera, GREEN);
edge(battery, wheelsCtl, '#ff6b6b');
edge(battery, arm, '#ff6b6b');
edge(antenna, comm, '#e2e8f0');
edge(battery, pwrConn, ORANGE);
edge(ldo, mem, ORANGE);

const out = { cells };
const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, 'amr-robot-fast.json');
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`Wrote ${cells.length} cells to ${file}`);
