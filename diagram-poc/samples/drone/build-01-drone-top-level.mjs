// Diagram 1 — "Top-level block diagram of a drone and its components".
// Coordinates are measured from the source artwork (853 x 812 px space) so the
// proportions match 1:1. Emits a GoJS GraphLinksModel the app can load.
import { writeFileSync } from 'node:fs';

const AD = 'Arrow Display';
const C = {
  blue:     '#0D9DDB',   // Flight Controller / ESC / Controller-Ground
  blueChip: '#5CBCE8',   // MCU, IMU, Sensor Suite, ground transceiver
  black:    '#000000',   // Power System
  darkChip: '#5B5B5B',   // LiPo Battery, Distribution Board
  grey:     '#A2A6A9',   // Communication Systems
  greyChip: '#8B8F92',   // Telemetry / Datalink / Transceiver
  escBg:    '#ECEDEE', escStroke: '#D9DCDE',
  motor:    '#6B2D5B',   // propeller-motor outline
  wire:     '#A6AAAD',
  ink:      '#141414', white: '#FFFFFF',
  droneWm:  '#D2D7DB', dash: '#4A4A4A',
};
const F = {
  title: `700 17px "${AD}", sans-serif`,
  cont:  `700 12.5px "${AD}", sans-serif`,
  chip:  `400 10.5px "${AD}", sans-serif`,
  cap:   `400 11.5px "${AD}", sans-serif`,
  small: `400 9.5px "${AD}", sans-serif`,
  wm:    `700 34px "${AD}", sans-serif`,
};

const nodes = [], links = [];
const N = (o) => nodes.push(o);
// centre + size from a measured rectangle
const R = (x, y, w, h) => ({ loc: `${x + w / 2} ${y + h / 2}`, size: `${w} ${h}` });

function group(key, text, o) {
  N({ key, isGroup: true, text, fill: o.fill, stroke: o.stroke, dashed: !!o.dashed,
      corner: o.corner ?? 0, borderWidth: o.borderWidth ?? 1.2,
      titleColor: o.titleColor ?? C.white, titleAlign: o.titleAlign ?? '0.5 0.5', titleFocus: '0.5 0.5',
      titleFont: o.titleFont ?? F.cont, pad: o.pad, ...(o.group ? { group: o.group } : {}) });
}
function chip(key, text, group, rect, o = {}) {
  N({ key, category: 'shape', group, figure: o.figure ?? 'Rectangle', text, ...rect,
      fill: o.fill, stroke: o.stroke ?? o.fill, labelColor: o.label ?? C.white, minSize: '1 1', strokeWidth: o.strokeWidth ?? 0,
      font: o.font ?? F.chip, fixedColor: true, ...(o.textWidth ? { textWidth: o.textWidth } : {}) });
}
function label(key, text, rect, o = {}) {
  N({ key, category: 'shape', figure: 'Rectangle', text, ...rect, fill: 'transparent',
      stroke: 'transparent', labelColor: o.color ?? C.ink, font: o.font ?? F.cap, minSize: '1 1', strokeWidth: 0,
      fixedColor: true, textWidth: o.textWidth ?? 400, ...(o.group ? { group: o.group } : {}) });
}
let lk = 0;
function link(from, to, fromPort, toPort, o = {}) {
  links.push({ key: --lk, from, to, fromPort, toPort, color: o.color ?? C.wire,
    width: o.width ?? 1.5, arrow: 'Triangle', arrowScale: o.arrowScale ?? 1.15, corner: o.corner ?? 10 });
}

// ---------- title ----------
label('title', 'Top-level block diagram of a drone and its components', R(128, 18, 600, 26), { font: F.title, textWidth: 600 });

// ---------- DRONE dashed boundary ----------
group('DRONE', 'DRONE', { fill: 'transparent', stroke: C.dash, dashed: true, corner: 0,
  borderWidth: 1.3, titleColor: C.droneWm, titleAlign: '0.38 0.84', titleFont: F.wm, pad: '45 42 12 20' });

// ---------- motors with propellers ----------
const motorRects = [R(90, 118, 48, 67), R(90, 195, 48, 67), R(90, 283, 48, 67), R(90, 368, 48, 67)];
motorRects.forEach((r, i) => N({ key: 'mot' + (i + 1), category: 'shape', group: 'DRONE', figure: 'FcPropMotor',
  text: '', ...r, fill: C.white, stroke: C.motor, labelColor: C.ink, font: F.small, fixedColor: true, minSize: '1 1', strokeWidth: 1.6 }));
label('motcap', 'Motors with\nPropellors', R(59, 444, 110, 30), { group: 'DRONE', font: F.chip, textWidth: 110 });

// ---------- ESC rail ----------
group('ESC', '', { fill: C.escBg, stroke: C.escStroke, corner: 0, group: 'DRONE', borderWidth: 1, pad: '28 23 12 17' });
const escRects = [R(209, 185, 65, 30), R(209, 248, 65, 30), R(209, 310, 65, 30), R(209, 371, 65, 30)];
escRects.forEach((r, i) => chip('esc' + (i + 1), 'ESC', 'ESC', r, { fill: C.blue }));

// ---------- Power System ----------
group('PWR', 'Power System', { fill: C.black, stroke: C.black, group: 'DRONE',
  titleAlign: '0.5 0.907', pad: '27 15 58 15' });
chip('lipo', 'LiPo\nBattery', 'PWR', R(358, 172, 89, 50), { fill: C.darkChip, textWidth: 80 });
chip('dist', 'Distribution\nBoard', 'PWR', R(342, 258, 120, 97), { fill: C.darkChip, textWidth: 104 });

// ---------- Flight Controller ----------
group('FC', 'Flight Controller', { fill: C.blue, stroke: C.blue, group: 'DRONE',
  titleAlign: '0.5 0.482', pad: '20 27 22 25' });
chip('mcu', 'MCU', 'FC', R(548, 165, 70, 33), { fill: C.blueChip });
chip('imu', 'IMU', 'FC', R(673, 165, 70, 33), { fill: C.blueChip });
chip('sens', 'Sensor Suite', 'FC', R(585, 258, 130, 33), { fill: C.blueChip });

// ---------- Communication Systems ----------
group('COMM', 'Communication Systems', { fill: C.grey, stroke: C.grey, group: 'DRONE',
  titleAlign: '0.5 0.586', pad: '15 20 5 17' });
chip('tele', 'Telemetry\nSystems', 'COMM', R(545, 381, 95, 44), { fill: C.greyChip, textWidth: 86 });
chip('dlink', 'Datalink\nSystems', 'COMM', R(653, 381, 95, 44), { fill: C.greyChip, textWidth: 86 });
chip('trx', 'Transceiver (Tx/Rx)', 'COMM', R(570, 483, 160, 30), { fill: C.greyChip });

// ---------- antennas & RF link ----------
N({ key: 'ant_d', category: 'shape', group: 'DRONE', figure: 'FcAntennaCurl', text: '',
    ...R(604, 522, 34, 38), fill: 'transparent', stroke: C.ink, fixedColor: true, minSize: '1 1', strokeWidth: 1.6 });
label('ant_d_l', 'Antenna', R(642, 543, 60, 18), { group: 'DRONE', font: F.small, textWidth: 60 });

label('cc', 'Control Commands', R(388, 608, 170, 20), { font: F.cap, textWidth: 170 });
label('fd', 'Feedback/ Data', R(552, 630, 145, 20), { font: F.cap, textWidth: 145 });

N({ key: 'ant_g', category: 'shape', figure: 'FcAntennaCurl', text: '', ...R(360, 632, 34, 38),
    fill: 'transparent', stroke: C.ink, fixedColor: true, minSize: '1 1', strokeWidth: 1.6 });
label('ant_g_l', 'Antenna', R(310, 643, 58, 18), { font: F.small, textWidth: 58 });

// ---------- Controller / Ground ----------
group('GND', 'Controller / Ground', { fill: C.blue, stroke: C.blue,
  titleAlign: '0.5 0.62', pad: '5 15 62 15' });
chip('gtrx', 'Transceiver (Tx/Rx)', 'GND', R(290, 700, 165, 28), { fill: C.blueChip });

// ================= wiring =================
// Flight Controller -> ESC rail (PWM control), routed over the top
link('FC', 'ESC', 'T', 'T');
// battery -> distribution board
link('lipo', 'dist', 'B', 'T');
// distribution board -> all four ESCs
escRects.forEach((_, i) => link('dist', 'esc' + (i + 1), 'L', 'R'));
// power -> flight controller
link('dist', 'FC', 'R', 'L');
// each ESC -> its motor
escRects.forEach((_, i) => link('esc' + (i + 1), 'mot' + (i + 1), 'L', 'R'));
// flight controller -> communication systems
link('FC', 'COMM', 'B', 'T');
// transceiver -> drone antenna
link('trx', 'ant_d', 'B', 'T');
// RF: drone -> ground (feedback/data) and ground -> drone (control commands)
link('ant_d', 'ant_g', 'B', 'R');
link('ant_g', 'ant_d', 'T', 'L');
// ground antenna -> ground transceiver
link('ant_g', 'gtrx', 'B', 'T');

const model = { class: 'GraphLinksModel', linkFromPortIdProperty: 'fromPort',
  linkToPortIdProperty: 'toPort', linkKeyProperty: 'key', nodeDataArray: nodes, linkDataArray: links };
writeFileSync(new URL('./d1.json', import.meta.url), JSON.stringify(model, null, 1));
console.log('nodes', nodes.length, 'links', links.length);
