// Diagram 6 — "Part selection by subsystem".
// Nested subsystem boxes: an outer coloured box, a banded sub-heading inside it,
// and one row per part number with a status badge. Coordinates measured from the
// source artwork so the proportions match 1:1.
import { writeFileSync } from 'node:fs';

const AD = 'Arrow Display';
const C = {
  ink: '#141414', white: '#FFFFFF', part: '#1F3FBF',
  confid: '#E4002B', noteBg: '#FCE9CE', noteLine: '#E8A33D', noteInk: '#B8651B',
  wire: '#8B1A3A',                       // the dark-red two-way arrows
  badge: '#F0B323', badgeInk: '#3A2A05',
};
// Each subsystem: outer outline, band fill, band outline.
const T = {
  ctrl:  { line: '#4E9A3E', band: '#DCEBD5', bandLine: '#4E9A3E' },
  sense: { line: '#C08A2E', band: '#FBE4C4', bandLine: '#C08A2E' },
  wired: { line: '#C9A227', band: '#FDF0C4', bandLine: '#C9A227' },
  power: { line: '#7C5AA6', band: '#E3DBEF', bandLine: '#7C5AA6' },
  wless: { line: '#2E6DB4', band: '#2E9BD6', bandLine: '#2E6DB4', bandInk: '#FFFFFF' },
  tx:    { line: '#A33B3B', band: '#F6D5D5', bandLine: '#A33B3B' },
  hmi:   { line: '#2E6DB4', band: '#CFE2F5', bandLine: '#2E6DB4' },
};
const F = {
  outer: `700 15px "${AD}", sans-serif`,
  band:  `700 9px "${AD}", sans-serif`,
  part:  `400 8.5px "${AD}", sans-serif`,
  cap:   `400 11px "${AD}", sans-serif`,
  head:  `400 9.5px "${AD}", sans-serif`,
  headI: `italic 400 9.5px "${AD}", sans-serif`,
  brand: `700 46px "${AD}", sans-serif`,
  conf:  `700 15px "${AD}", sans-serif`,
  note:  `700 8px "${AD}", sans-serif`,
  foot:  `700 11px "${AD}", sans-serif`,
};

const nodes = [], links = [];
const N = (o) => nodes.push(o);
const R = (x, y, w, h) => ({ loc: `${x + w / 2} ${y + h / 2}`, size: `${w} ${h}` });

/** The outer box for a subsystem: a big centred name, no band. */
function outer(key, text, t, o = {}) {
  N({ key, isGroup: true, text, fill: 'transparent', stroke: t.line, dashed: false,
      corner: 0, borderWidth: 1.4, titleColor: C.ink, titleFont: o.font ?? F.outer,
      titleAlign: '0.5 0 0 8', titleFocus: '0.5 0', pad: o.pad ?? '34 8 8 8' });
}
/** A sub-heading inside one: its name sits on a filled band across the top. */
function band(key, text, parent, t, o = {}) {
  N({ key, isGroup: true, text, group: parent, fill: 'transparent', stroke: 'transparent',
      dashed: false, corner: 0, borderWidth: 0,
      titleColor: o.ink ?? t.bandInk ?? C.ink, titleFont: F.band,
      titleBg: t.band, titleBorder: t.bandLine, titlePad: '3 8 3 8',
      titleSize2: `${o.w ?? 172} ${o.h ?? 15}`,
      titleAlign: '0.5 0 0 0', titleFocus: '0.5 0', pad: '20 0 0 0' });
}
/** One part-number row, with the status badge the drawing puts on every one. */
function part(key, text, parent, x, y, w, t) {
  N({ key, category: 'shape', shape: 'sh-rect', figure: 'Rectangle', text, group: parent,
      ...R(x, y, w, 16), minSize: '1 1',
      fill: C.white, stroke: t.bandLine, strokeWidth: 0.8, fixedColor: true,
      labelColor: C.part, font: F.part, textAlign: 'left', textWidth: w - 30,
      badge: '?', badgeFill: C.badge, badgeColor: C.badgeInk,
      badgeFont: `700 10px "${AD}", sans-serif`, badgeSize: '13 13',
      badgeSpot: '1 0.5 -10 0' });
}
function plain(key, o) {
  N({ key, category: 'shape', shape: 'sh-rect', figure: 'Rectangle', text: o.text ?? '',
      ...R(o.x, o.y, o.w, o.h), minSize: '1 1',
      fill: o.fill ?? 'transparent', stroke: o.stroke ?? 'transparent',
      strokeWidth: o.strokeWidth ?? 0, fixedColor: true,
      labelColor: o.labelColor ?? C.ink, font: o.font ?? F.cap,
      textAlign: o.textAlign ?? 'center', textWidth: o.textWidth ?? o.w });
}
/** The two-way link every subsystem has to the control unit. */
function link(from, to, fromPort, toPort) {
  links.push({ key: links.length + 1, from, to, fromPort, toPort,
    color: C.wire, width: 1.6, arrow: 'Triangle', arrowScale: 0.8, corner: 0, twoWay: true });
}

/** A band plus its rows, laid out top-down; returns the y after the last row. */
function section(id, title, parent, t, x, y, w, rows) {
  band(id, title, parent, t, { w, h: title.includes('\n') ? 26 : 15 });
  const top = y + (title.includes('\n') ? 30 : 20);
  rows.forEach((r, i) => part(`${id}_${i}`, r, id, x, top + i * 19, w, t));
  return top + rows.length * 19;
}

// ---------------------------------------------------------------- header ----
plain('brand', { x: 8, y: 8, w: 262, h: 62, text: 'ARROW', font: F.brand, textAlign: 'left' });
plain('confidential', { x: 62, y: 90, w: 200, h: 18, text: 'CONFIDENTIAL', font: F.conf,
                        labelColor: C.confid, textAlign: 'left' });
[['Customer:', 'Customer Name'], ['Project:', 'Project'], ['Description:', 'Project Description'],
 ['Production:', 'Production Date'], ['EAU:', '1234']].forEach(([k, v], i) => {
  plain(`hk${i}`, { x: 284, y: 8 + i * 16, w: 78, h: 14, text: k, font: F.head, textAlign: 'left' });
  plain(`hv${i}`, { x: 366, y: 8 + i * 16, w: 130, h: 14, text: v, font: F.headI, textAlign: 'left' });
});
plain('modbox', { x: 634, y: 8, w: 200, h: 52, fill: C.noteBg, stroke: C.noteLine, strokeWidth: 1 });
plain('modk1', { x: 642, y: 16, w: 180, h: 14, text: 'Modified Date: 7 May 2024 | 3:59 PM',
                 font: F.note, labelColor: C.noteInk, textAlign: 'left' });
plain('modk2', { x: 642, y: 36, w: 180, h: 14, text: 'Last Modified By:', font: F.note,
                 labelColor: C.noteInk, textAlign: 'left' });

// Columns, because a container has no position of its own — it sits where its
// members are. These are the only coordinates that matter.
const LEFT = 120, LEFT2 = 300, MID = 540, RIGHT = 800, RIGHT2 = 980;
const CW = 168, MW = 200;

// ---------------------------------------------------- control unit (centre) ----
outer('ctrl', 'Control Unit', T.ctrl, { pad: '44 12 12 12' });
band('mcus', 'MCUs', 'ctrl', T.ctrl, { w: MW });
const U5 = ['STMICRO^STM32U599ZJT6Q', 'STMICRO^STM32U599BJY6QTR', 'STMICRO^STM32U599NIH6Q',
            'STMICRO^STM32U599NJH6Q', 'STMICRO^STM32U599VIT6Q', 'STMICRO^STM32U599VJT6',
            'STMICRO^STM32U599ZIT6Q', 'STMICRO^STM32U599BJY6QTR', 'STMICRO^STM32U599NJH6Q'];
const L4 = ['STMICR_DIG^STM32L4Q5VGT6', 'STMICRO^STM32L4P5AEI6', 'STMICRO^STM32L4P5AGI6',
            'STMICRO^STM32L4P5QEI6', 'STMICR_DIG^STM32L4P5ZET6', 'STMICR_DIG^STM32L4P5QGI6',
            'STMICRO^STM32L4Q5AGI6', 'STMICR_DIG^STM32L4Q5QGI6', 'STMICR_DIG^STM32L4Q5ZGT6'];
let y = section('u5', 'MCU - STM32U5 Series', 'mcus', T.ctrl, MID, 230, MW, U5);
y = section('l4', 'MCU - STM32L4+ Series', 'mcus', T.ctrl, MID, y + 14, MW, L4);
section('esd', 'ESD Supressors', 'ctrl', T.ctrl, MID, y + 46, MW,
        ['NEXPERIA^PESD4USB5BBTBR-QZ', 'EATON^STSP84050U800']);

// ------------------------------------------------------------ left column ----
outer('sense', 'Sensing', T.sense);
section('tsen', 'Temperature Sensors', 'sense', T.sense, LEFT, 230, CW,
        ['STMICRO^STTS751-0DP3F', 'STMICRO^STTS22HTR']);
section('inemo', 'iNEMO inertial modules', 'sense', T.sense, LEFT, 306, CW, ['STMICRO^ISM330DLCTR']);

outer('wired', 'Wired Connectivity', T.wired);
section('usbp', 'USB Protection', 'wired', T.wired, LEFT, 470, CW,
        ['STMICRO^ECMF4-40A100N10', 'STMICRO^TCPP02-M18']);
section('usbc', 'USB type C', 'wired', T.wired, LEFT, 546, CW, ['STMICRO^STUSB1600AQTR']);

outer('power', 'Power\nmamagemnnet', T.power, { pad: '58 12 12 12' });
section('dcdc', 'DC-DC Controller', 'power', T.power, LEFT, 720, CW,
        ['ALLEGRO^A8660KESTR-J', 'STMICRO^L6981NDR', 'STMICRO^L6981CDR', 'STMICRO^L6981C33DR']);
section('vreg', 'Voltage Regulators', 'power', T.power, LEFT, 830, CW,
        ['STMICRO^LD1117ADT-TR', 'STMICRO^LM217LD13TR']);
section('acdc', 'AC-DC Converter', 'power', T.power, LEFT2, 700, CW,
        ['STMICRO^L6566A', 'STMICRO^L6699D', 'STMICRO^SRK2001A']);
section('prot', 'Protection', 'power', T.power, LEFT2, 796, CW,
        ['STMICRO^STEF12EPUR', '*STMICRO^SM6T6V8A']);
section('pmos', 'Power MOSFETs', 'power', T.power, LEFT2, 872, CW, ['STMICRO^STL320N4LF8']);

// ----------------------------------------------------------- right column ----
outer('wless', 'Wireless\nConnectivity', T.wless, { pad: '58 12 12 12' });
section('ble', 'Bluetooth low energy', 'wless', T.wless, RIGHT, 240, CW, ['STMICRO^STM32WB55RGV6']);
section('filt', 'Filters', 'wless', T.wless, RIGHT, 306, CW, ['STMICRO^MLPF-WB55-01E3']);

outer('tx', 'Transmitter unit (TX)', T.tx);
section('hvm', 'HV multiplexers', 'tx', T.tx, RIGHT, 470, CW, ['STMICRO^STHV64SW']);
section('hvp', 'HV pulsers', 'tx', T.tx, RIGHT, 536, CW, ['STMICRO^STHV1600L', 'STMICRO^STHVUP64']);

outer('hmi', 'HMI', T.hmi);
section('lcd', 'LCD backlight and\nLED controllers', 'hmi', T.hmi, RIGHT, 730, CW,
        ['STMICRO^LED7707TR', 'STMICRO^LED7708TR', 'STMICRO^ALED7707', 'STMICRO^LED7706TR']);
section('audio', 'Audio amplifiers', 'hmi', T.hmi, RIGHT, 850, CW,
        ['STMICRO^STA350BWTR', 'STMICRO^TDA7492P13TR']);
section('lar', 'LED Array Driver', 'hmi', T.hmi, RIGHT2, 712, CW, ['STMICRO^LED1202JR']);
section('lbp', 'LCD backlight protection', 'hmi', T.hmi, RIGHT2, 778, CW, ['*STMICRO^ESDU401-1BF4']);
section('aprot', 'Audio protection', 'hmi', T.hmi, RIGHT2, 844, CW,
        ['*STMICRO^ESDA6V1BC6', 'COMCHIP^CPDT6-5V4-HF', 'MICROCHIP^SM1605CE3/TR13']);

// ----------------------------------------------------------------- wires ----
link('sense', 'ctrl', 'R', 'L');
link('wired', 'ctrl', 'R', 'L');
link('power', 'ctrl', 'R', 'L');
link('ctrl', 'wless', 'R', 'L');
link('ctrl', 'tx', 'R', 'L');
link('ctrl', 'hmi', 'R', 'L');

plain('footnote', { x: 380, y: 1010, w: 460, h: 20, font: F.foot, textAlign: 'left',
  text: 'Note: Part numbers marked with an asterisk (*) are not registrable.' });

const model = {
  class: 'GraphLinksModel',
  linkFromPortIdProperty: 'fromPort',
  linkToPortIdProperty: 'toPort',
  linkKeyProperty: 'key',
  nodeDataArray: nodes,
  linkDataArray: links,
};
writeFileSync(new URL('./06-part-selection.gojs.json', import.meta.url),
  JSON.stringify(model, null, 1));
console.log(`06-part-selection: ${nodes.length} nodes, ${links.length} links`);
