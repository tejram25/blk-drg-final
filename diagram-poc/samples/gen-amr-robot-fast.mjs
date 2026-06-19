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
        text, fill: label, fontSize, fontWeight: bold ? 600 : 400,
        textWrap: { width: -12, height: -6, breakWord: true },
      },
    },
  });
  return cid;
}

// A group container (background panel) with a bottom-aligned title.
function group(x, y, w, h, title, { fill = WHITE, titleColor = '#1f2937' } = {}) {
  const cid = id('grp');
  cells.push({
    id: cid, shape: 'basic-rectangle', x, y, width: w, height: h, zIndex: 2,
    attrs: { body: { fill, stroke: '#c9d2dc', strokeWidth: fill === WHITE ? 1.5 : 0 } },
  });
  if (title) {
    cells.push({
      id: id('t'), shape: 'basic-text', x, y: y + h - 22, width: w, height: 20, zIndex: 6,
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
box(195, 88, 1110, 600, '', { fill: NAVY, rounded: true, zIndex: 1 });
for (const [wx, wy] of [[358, 28], [1022, 28], [358, 700], [1022, 700]]) {
  box(wx, wy, 152, 54, 'Wheel', { fill: TIRE, label: '#8b9099', rounded: true, fontSize: 11, bold: false, zIndex: 1 });
}

// ---- top: antenna + connectivity + central processor ----
const antenna = box(735, 33, 130, 38, 'Antenna');

group(556, 124, 360, 98, 'Connectivity');
const comm = box(566, 134, 164, 64, 'Communication Modules', { fontSize: 12.5 });
const gnss = box(742, 134, 164, 64, 'GNSS Modules');

group(700, 246, 224, 418, 'Central Processor', { fill: GREEN, titleColor: '#08402f' });
const mainProc = box(712, 256, 200, 130, 'Main Processor', { fontSize: 15 });
const ai = box(712, 420, 200, 58, 'AI Models');
const mem = box(712, 498, 200, 58, 'Memory');
const ros = box(712, 576, 200, 58, 'Robotics OS');

// ---- left: arm motor control, LED, sensors, sensor processor ----
const arm = box(228, 118, 162, 156, 'BLDC Motor Control (Robotic Arm)', { fontSize: 13 });

group(226, 330, 332, 68, '');
const led = box(238, 341, 100, 46, 'LED');
const ledDrv = box(400, 341, 146, 46, 'LED Drivers');

group(228, 440, 160, 222, 'Sensors');
const camera = box(240, 452, 136, 46, 'Camera');
box(240, 510, 136, 46, 'Sensors');
box(240, 568, 136, 50, 'RADAR / LIDAR');

group(472, 440, 162, 222, 'Sensor Processor');
const sigAgg = box(484, 452, 140, 52, 'Signal Aggregation', { fontSize: 12.5 });
box(484, 516, 140, 46, 'Analog');
box(484, 570, 140, 50, 'Real Time Processor', { fontSize: 12.5 });

// ---- right-center: wheels motor control + power management ----
const wheelsCtl = box(975, 120, 256, 192, 'BLDC Motor Control (Wheels)', { fontSize: 15 });

group(964, 374, 288, 290, 'Power Management', { fill: ORANGE, titleColor: '#5a3b04' });
const smartFet = box(976, 394, 84, 64, 'Smart FETs', { fontSize: 12 });
box(1068, 394, 88, 64, 'Current Sensing', { fontSize: 12 });
box(1164, 394, 76, 64, 'eFuse', { fontSize: 12 });
box(976, 468, 120, 62, 'DC/DC Converters', { fontSize: 12 });
box(1104, 468, 136, 62, 'LDO');
box(976, 540, 120, 66, 'BMS');
const battery = box(1104, 540, 136, 66, 'Battery');

// ---- right side panels (outside chassis) ----
group(1328, 55, 344, 306, 'Used everywhere', { fill: GRAY });
const ue = [
  'Circuit protection', 'Relays / Contactors',
  'IO Connectors', 'Board to Board Connectors',
  'Cable Assembly', 'W-t-W/ W-t-B Connectors',
  'Fans / Heatsinks', 'Buttons & Switches',
];
ue.forEach((label, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  box(1342 + col * 166, 68 + row * 68, 150, 58, label, { fontSize: 12.5 });
});

group(1385, 470, 256, 228, 'Charging Station', { fill: GRAY });
const wireless = box(1400, 484, 226, 44, 'Wireless Charging');
const pwrConn = box(1400, 554, 226, 44, 'Power Connectors');
box(1400, 624, 226, 44, 'AC/DC Power Supply');

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

const out = { cells };
const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, 'amr-robot-fast.json');
writeFileSync(file, JSON.stringify(out, null, 2));
console.log(`Wrote ${cells.length} cells to ${file}`);
