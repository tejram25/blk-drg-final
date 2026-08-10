// Diagram 2 — "Drone/Drone controller: Battery with Charger".
// Coordinates measured from the source artwork (1240 x 430 px space).
import { writeFileSync } from 'node:fs';

const AD = 'Arrow Display';
const C = {
  ic:      '#0D9DDB',   // ICs
  conn:    '#3FD6B0',   // connectors
  cell:    '#000000',   // cells
  comp:    '#8B8F92',   // individual components
  legendBg:'#F0F1F2',
  wire:    '#A6AAAD',
  ink:     '#141414', white: '#FFFFFF', dash: '#4A4A4A',
};
const F = {
  title: `700 17px "${AD}", sans-serif`,
  big:   `700 13px "${AD}", sans-serif`,
  chip:  `400 11px "${AD}", sans-serif`,
  net:   `400 9px "${AD}", sans-serif`,
  note:  `400 9.5px "${AD}", sans-serif`,
  key:   `400 10px "${AD}", sans-serif`,
};

const nodes = [], links = [];
const N = (o) => nodes.push(o);
const R = (x, y, w, h) => ({ loc: `${x + w / 2} ${y + h / 2}`, size: `${w} ${h}` });

function box(key, text, rect, o = {}) {
  N({ key, category: 'shape', figure: o.figure ?? 'Rectangle', text, ...rect,
      fill: o.fill, stroke: o.stroke ?? o.fill, labelColor: o.label ?? C.white,
      font: o.font ?? F.chip, fixedColor: true, minSize: '1 1',
      strokeWidth: o.strokeWidth ?? 0, textWidth: o.textWidth ?? 400,
      ...(o.ports ? { ports: o.ports } : {}), ...(o.group ? { group: o.group } : {}) });
}
// dashed-outline placeholder (Test Points, LEDs)
function ghost(key, text, rect) {
  N({ key, category: 'shape', figure: 'Rectangle', text, ...rect, fill: 'transparent',
      stroke: '#6B7176', labelColor: C.ink, font: F.chip, fixedColor: true,
      minSize: '1 1', strokeWidth: 1.2, textWidth: 400, dashPattern: true });
}
function label(key, text, rect, o = {}) {
  N({ key, category: 'shape', figure: 'Rectangle', text, ...rect, fill: 'transparent',
      stroke: 'transparent', labelColor: o.color ?? C.ink, font: o.font ?? F.note,
      fixedColor: true, minSize: '1 1', strokeWidth: 0, textWidth: o.textWidth ?? 400,
      ...(o.align ? { textAlign: o.align } : {}),
      ...(o.group ? { group: o.group } : {}) });
}
let lk = 0;
function link(from, to, fromPort, toPort, o = {}) {
  links.push({ key: --lk, from, to, fromPort, toPort, color: o.color ?? C.wire, width: 1.4,
    arrow: 'Triangle', arrowScale: o.arrowScale ?? 1.0, corner: 0,
    ...(o.text ? { text: o.text, textColor: C.ink, textFont: F.net, textBg: 'transparent',
        textOffset: o.labelOffset ?? '0 -7', ...(o.labelAt ? { textFraction: o.labelAt } : {}) } : {}),
    ...(o.wire ? { wire: true } : {}) });
}

// ---------- title ----------
label('title', 'Drone/Drone controller: Battery with Charger', R(320, 8, 600, 26), { font: F.title, textWidth: 600 });

// ---------- main power path, left to right ----------
box('typec', 'Type-C Connector for\nCharging (Sink only)', R(40, 78, 175, 92), { fill: C.conn, label: C.ink, font: F.big, textWidth: 160,
  ports: [{ portId: 'a', spot: '1 0.25' }, { portId: 'b', spot: '1 0.5' }, { portId: 'c', spot: '1 0.75' }] });
box('pd',    'PD Controller',        R(268, 88, 150, 72), { fill: C.ic, font: F.big,
  ports: [{ portId: 'a', spot: '0 0.25' }, { portId: 'b', spot: '0 0.5' }, { portId: 'c', spot: '0 0.75' },
           { portId: 'd', spot: '0.5 1' }, { portId: 'e', spot: '0.85 1' }, { portId: 'f', spot: '0.1 1' }] });
box('fet1',  'FETs',                 R(478, 108, 62, 44), { fill: C.comp });
box('batfet','BATFET',               R(590, 108, 70, 44), { fill: C.comp });
box('fet2',  'FETs',                 R(722, 108, 62, 44), { fill: C.comp });
box('cells', 'Multiple Series cells', R(880, 78, 200, 92), { fill: C.cell, font: F.big, textWidth: 180 });

// ---------- lower row ----------
box('flash', 'FLASH',                R(301, 212, 84, 38), { fill: C.ic, font: F.big });
ghost('tp',  'Test\nPoints',          R(412, 206, 62, 52));
box('v33',   'VBUS to\n3.3V',         R(198, 252, 84, 46), { fill: C.ic, font: F.big, textWidth: 76 });
label('vsys', '20V/5A, VSYS?\nVBAT', R(60, 258, 120, 30), { font: F.net, textWidth: 120, align: 'right' });
box('chg',   'Battery Charger',      R(492, 268, 175, 92), { fill: C.ic, font: F.big, textWidth: 150 });
box('fuel',  'Fuel Gauge and\nBattery Cell\nProtection IC', R(680, 258, 175, 92), { fill: C.ic, font: F.big, textWidth: 155 });
box('ntc',   'N xNTC',               R(905, 275, 110, 46), { fill: C.comp });
ghost('leds','LEDs',                  R(742, 380, 62, 32));

// ---------- pack-level protection note ----------
label('packttl', 'Pack level Protection:', R(1030, 262, 210, 18), { font: F.big, textWidth: 210, align: 'left' });
label('pack',
  '•  Thermal Protection (Over Temperature)\n' +
  '•  Overcharge Protection (OVP)\n' +
  '•  Over-discharge Protection (UVP)\n' +
  '•  Charge overcurrent Protection (OCC)\n' +
  '•  Discharge overcurrent Protection (OCD)',
  R(1030, 284, 215, 78), { font: F.note, textWidth: 215, align: 'left' });

// ---------- KEY legend ----------
box('keybg', '', R(30, 368, 486, 48), { fill: C.legendBg, label: C.ink });
label('keyttl', 'KEY:', R(38, 382, 40, 20), { font: F.big, textWidth: 40 });
box('k1', 'Cell',                  R(84, 380, 96, 24), { fill: C.cell,  font: F.key });
box('k2', 'IC',                    R(190, 380, 96, 24), { fill: C.ic,    font: F.key });
box('k3', 'Connector',             R(296, 380, 96, 24), { fill: C.conn,  font: F.key, label: C.ink });
box('k4', 'Individual\nComponents', R(402, 376, 96, 32), { fill: C.comp, font: F.key, textWidth: 90 });

// ---------- wiring ----------
link('typec', 'pd', 'a', 'a', { text: 'USB_VBUS 20V/5A', labelAt: 0.12 });
link('typec', 'pd', 'b', 'b', { text: 'CCx' });
link('typec', 'pd', 'c', 'c', { text: 'USB2.0' });
link('pd',    'fet1',  'R', 'L', { text: 'V_USB_PD' });
link('fet1',  'batfet','R', 'L', { text: 'V_CHG' });
link('batfet','fet2',  'R', 'L', { text: 'V_BAT' });
link('fet2',  'cells', 'R', 'L', { text: 'V_CELLS' });
link('pd',    'flash', 'd', 'T');
link('pd',    'tp',    'e', 'L', { text: 'I2C2', labelOffset: '-14 0', labelAt: 0.25 });
link('v33',   'pd',    'T', 'f', { text: '3.3V', labelOffset: '-16 0' });
link('vsys',  'v33',   'R', 'L', { wire: true });
link('chg',   'fet1',  'T', 'B');
link('chg',   'batfet','T', 'B');
link('fuel',  'fet2',  'T', 'B');
link('ntc',   'fuel',  'L', 'R');
link('fuel',  'leds',  'B', 'T');

const model = { class: 'GraphLinksModel', linkFromPortIdProperty: 'fromPort',
  linkToPortIdProperty: 'toPort', linkKeyProperty: 'key', nodeDataArray: nodes, linkDataArray: links };
writeFileSync(new URL('./02-battery-charger.gojs.json', import.meta.url), JSON.stringify(model, null, 1));
console.log('nodes', nodes.length, 'links', links.length);
