// Diagram 5 — "Solar generation and storage, end to end".
// Coordinates measured from the source artwork (853 x 1201 px space), so the
// proportions match 1:1. Emits a GoJS GraphLinksModel the app can load.
import { writeFileSync } from 'node:fs';

const AD = 'Arrow Display';
const C = {
  chip:      '#3FA9DC',   // the light-blue part chips
  chipDark:  '#151B54',   // the navy "chosen part" chips
  chipGrey:  '#A9ACAF',   // the grey "not fitted" chips
  contLine:  '#3B3B3B',   // container outline
  wire:      '#EC4899',   // the magenta signal arrows
  ink:       '#141414',
  white:     '#FFFFFF',
  head:      '#141414',
  confid:    '#E4002B',   // Arrow red
  noteBg:    '#FCE9CE', noteLine: '#E8A33D', noteInk: '#B8651B',
  icon:      '#141414',
};
const F = {
  cont:  `400 10px "${AD}", sans-serif`,
  chip:  `400 9.5px "${AD}", sans-serif`,
  cap:   `400 11px "${AD}", sans-serif`,
  head:  `400 9.5px "${AD}", sans-serif`,
  headI: `italic 400 9.5px "${AD}", sans-serif`,
  brand: `700 46px "${AD}", sans-serif`,
  conf:  `700 15px "${AD}", sans-serif`,
  note:  `700 8px "${AD}", sans-serif`,
};

const nodes = [], links = [];
const N = (o) => nodes.push(o);
const R = (x, y, w, h) => ({ loc: `${x + w / 2} ${y + h / 2}`, size: `${w} ${h}` });

/** A subsystem box with its name across the top. */
function group(key, text, x, y, w, h, o = {}) {
  N({ key, isGroup: true, text, fill: o.fill ?? 'transparent', stroke: o.stroke ?? C.contLine,
      dashed: false, corner: 0, borderWidth: o.borderWidth ?? 1,
      titleColor: C.ink, titleFont: o.titleFont ?? F.cont,
      titleAlign: o.titleAlign ?? '0.5 0 0 6', titleFocus: o.titleFocus ?? '0.5 0',
      ...R(x, y, w, h), pad: o.pad ?? '30 9 9 9' });
}
/** One part chip inside a subsystem. */
function chip(key, text, group, x, y, w, h, o = {}) {
  N({ key, category: 'shape', shape: 'sh-rect', figure: 'Rectangle', text, group,
      ...R(x, y, w, h), minSize: '1 1',
      fill: o.fill ?? C.chip, stroke: o.fill ?? C.chip, strokeWidth: 0, fixedColor: true,
      labelColor: o.labelColor ?? C.white, font: o.font ?? F.chip,
      textAlign: 'center', textWidth: w - 8 });
}
/** A caption or an icon: a block with neither fill nor outline. */
function plain(key, o) {
  N({ key, category: 'shape', shape: o.shape ?? 'sh-rect', figure: o.figure ?? 'Rectangle',
      text: o.text ?? '', ...R(o.x, o.y, o.w, o.h), minSize: '1 1',
      fill: o.fill ?? 'transparent', stroke: o.stroke ?? 'transparent',
      strokeWidth: o.strokeWidth ?? 0, fixedColor: true,
      labelColor: o.labelColor ?? C.ink, font: o.font ?? F.cap,
      textAlign: o.textAlign ?? 'center', textWidth: o.textWidth ?? o.w });
}
function wire(from, to, o = {}) {
  links.push({ key: links.length + 1, from, to,
    fromPort: o.fromPort ?? 'R', toPort: o.toPort ?? 'L',
    color: C.wire, width: 1.4, arrow: 'Triangle', arrowScale: 0.75, corner: 0,
    ...(o.twoWay ? { twoWay: true } : {}), ...(o.fromEnd ? { fromEnd: o.fromEnd } : {}) });
}

// ---------------------------------------------------------------- header ----
plain('brand', { x: 8, y: 8, w: 262, h: 62, text: 'ARROW', font: F.brand, textAlign: 'left' });
plain('confidential', { x: 62, y: 90, w: 200, h: 18, text: 'CONFIDENTIAL', font: F.conf,
                        labelColor: C.confid, textAlign: 'left' });
const HEAD = [['Customer:', 'Customer Name'], ['Project:', 'Project'],
              ['Description:', 'Project Description'], ['Production:', 'Production Date'],
              ['EAU:', '1234']];
HEAD.forEach(([k, v], i) => {
  plain(`hk${i}`, { x: 284, y: 8 + i * 16, w: 78, h: 14, text: k, font: F.head, textAlign: 'left' });
  plain(`hv${i}`, { x: 366, y: 8 + i * 16, w: 130, h: 14, text: v, font: F.headI, textAlign: 'left' });
});
plain('modbox', { x: 634, y: 8, w: 200, h: 52, fill: C.noteBg, stroke: C.noteLine, strokeWidth: 1 });
plain('modk1', { x: 642, y: 16, w: 150, h: 14, text: 'Modified Date:', font: F.note,
                 labelColor: C.noteInk, textAlign: 'left' });
plain('modk2', { x: 642, y: 36, w: 150, h: 14, text: 'Last Modified By:', font: F.note,
                 labelColor: C.noteInk, textAlign: 'left' });

// ------------------------------------------------------------- the plant ----
plain('sun', { x: 106, y: 182, w: 46, h: 46, figure: 'FcSun', shape: 'fc-sun',
               stroke: C.icon, strokeWidth: 1.4 });
plain('pv', { x: 98, y: 236, w: 66, h: 62, figure: 'FcSolarPanel', shape: 'fc-solar-panel',
              stroke: C.icon, strokeWidth: 1.2 });
plain('cell', { x: 124, y: 344, w: 22, h: 46, figure: 'FcBatteryCell', shape: 'fc-battery-cell',
                stroke: C.icon, strokeWidth: 1.2 });
plain('conn', { x: 100, y: 990, w: 40, h: 22, figure: 'FcCard', shape: 'fc-card',
                stroke: C.icon, strokeWidth: 1.2, text: '' });
plain('radio', { x: 692, y: 1046, w: 34, h: 34, figure: 'FcRadiating', shape: 'fc-radiating',
                 stroke: '#1E5AA8', strokeWidth: 1.6 });
plain('gateway', { x: 762, y: 348, w: 46, h: 42, figure: 'FcMonitor', shape: 'fc-monitor',
                   stroke: C.icon, strokeWidth: 1.2 });
plain('acgrid', { x: 796, y: 246, w: 52, h: 34, text: 'AC\ngrid', font: F.cap, textAlign: 'left' });
plain('gwlabel', { x: 748, y: 1052, w: 78, h: 34, text: 'Gateway\nor router', font: F.cap });

// ------------------------------------------------------------ subsystems ----
group('solar', 'Solar Centralized\ngeneration', 202, 212, 128, 92);
chip('cSolar', 'Smart string\ncombiner box', 'solar', 210, 256, 116, 44, { fill: C.chipDark });

group('bank', 'Battery bank', 202, 320, 128, 176);
chip('cBms', 'Battery\nmanagement\nsystems', 'bank', 214, 364, 104, 46);
chip('cBuck1', 'Buck\nregulators', 'bank', 214, 418, 104, 42);
chip('cMcu1', 'MCUs', 'bank', 214, 468, 104, 42);

group('inv', 'Drivers and power stage (Inverter)', 360, 176, 250, 296);
chip('cPmod', 'Power\nmodules', 'inv', 374, 216, 108, 42);
chip('cMosf1', 'Power\nMOSFETs', 'inv', 490, 216, 108, 42);
chip('cGate', 'Gate\ndrivers', 'inv', 374, 266, 108, 42);
chip('cIgbt', 'IGBTs', 'inv', 490, 266, 108, 42);
chip('cUltra1', 'Ultrafast\nrectifiers', 'inv', 374, 316, 108, 42);
chip('cSic', 'SiC\ndiodes', 'inv', 490, 316, 108, 42);
chip('cSchot1', 'Power\nschottky', 'inv', 374, 366, 108, 42);
chip('cProt1', 'Protection', 'inv', 490, 366, 108, 42);
chip('cScr', 'Thyristors (SCR)\nand AC switches', 'inv', 374, 416, 108, 42, { fill: C.chipGrey });

group('meter', 'Metering', 636, 212, 134, 92);
chip('cMeter', 'Electricity\nmetering', 'meter', 646, 256, 114, 42, { fill: C.chipDark });

group('pm', 'Power management', 158, 504, 250, 344);
chip('cHv', 'High voltage\nconverters', 'pm', 172, 544, 108, 46);
chip('cMosf2', 'Power\nMOSFETs', 'pm', 288, 544, 108, 46);
chip('cPwm', 'PWM\ncontrollers', 'pm', 172, 598, 108, 46);
chip('cRes', 'Resonant\ncontrollers', 'pm', 288, 598, 108, 46);
chip('cSchot2', 'Power\nschottky', 'pm', 172, 652, 108, 46);
chip('cUltra2', 'Ultrafast\nrectifiers', 'pm', 288, 652, 108, 46);
chip('cLdo', 'Low dropout\n(LDO)\nlinear regulators', 'pm', 172, 700, 108, 46);
chip('cBuck2', 'Bluck\nregulators', 'pm', 288, 700, 108, 46);
chip('cProt2', 'Protection', 'pm', 172, 750, 108, 42);
chip('cVref', 'Voltage\nrefereences', 'pm', 288, 750, 108, 42);
chip('cEfuse', 'E-fuses', 'pm', 172, 800, 108, 42);

group('sig', 'Signal conditioning', 440, 504, 130, 136);
chip('cOpamp', 'Operational\namplifiers\n(Op amps)', 'sig', 452, 542, 106, 48, { fill: C.chipGrey });
chip('cCurr', 'Current\nsensing', 'sig', 452, 596, 106, 42);

group('sense', 'Sensing', 592, 616, 126, 126);
chip('cTemp', 'Temperature\nsensors', 'sense', 604, 650, 102, 42);
chip('cHum', 'Humidity sensors', 'sense', 604, 700, 102, 42, { fill: C.chipGrey });

group('ctrl', 'Control unit', 440, 654, 130, 288);
chip('cMcu2', 'MCUs', 'ctrl', 452, 690, 106, 42);
chip('cSec', 'Embedded\nsecurity', 'ctrl', 452, 740, 106, 42, { fill: C.chipDark });
chip('cEep', 'Serial\nEEPROM', 'ctrl', 452, 790, 106, 42);
chip('cFlash', 'Flash', 'ctrl', 452, 840, 106, 42, { fill: C.chipGrey });
chip('cEsd1', 'ESD\nprotection', 'ctrl', 452, 890, 106, 42);

group('hmi', 'HMI', 592, 756, 126, 186);
chip('cMcu3', 'MCUs', 'hmi', 604, 814, 102, 42);
chip('cTouch', 'Touch screen\ncontrollers', 'hmi', 604, 864, 102, 42, { fill: C.chipGrey });
chip('cLed', 'LED\ndrivers', 'hmi', 604, 914, 102, 42);

group('wired', 'Wired connectivity', 158, 856, 250, 344);
chip('cIso', 'Digital\nisolators', 'wired', 172, 922, 108, 46);
chip('cLvl', 'Level\ntranslators', 'wired', 288, 922, 108, 46);
chip('cEthP', 'Ethernet data line\nprotection', 'wired', 172, 972, 108, 46);
chip('cEthPhy', 'Ethernet\nPHY', 'wired', 288, 972, 108, 46, { fill: C.chipGrey });
chip('cUsbP', 'USB data line\nprotection', 'wired', 172, 1022, 108, 46);
chip('cUsbT', 'USB transceivers', 'wired', 288, 1022, 108, 46);
chip('cEsdD', 'ESD data line\nprotection', 'wired', 172, 1072, 108, 46);
chip('cRs232', 'RS-232/RS-\n485/RS-422\ninterface', 'wired', 288, 1072, 108, 46, { fill: C.chipGrey });
chip('cCanP', 'CAN data line\nprotection', 'wired', 172, 1122, 108, 46);
chip('cCanT', 'CAN\ntransceivers', 'wired', 288, 1122, 108, 46);
chip('cLine', 'Line\ndrivers', 'wired', 172, 1172, 108, 46);
chip('cPlc', 'Power line\ntransceivers', 'wired', 288, 1172, 108, 46);

group('wireless', 'Wireless connectivity', 440, 964, 250, 196);
chip('cBle', 'Bluetooth\nlow energy', 'wireless', 454, 1004, 108, 46);
chip('cZig', 'Zigbee', 'wireless', 570, 1004, 108, 46);
chip('cWifi', 'Wi-Fi', 'wireless', 454, 1054, 108, 46, { fill: C.chipGrey });
chip('cLora', 'LoRa', 'wireless', 570, 1054, 108, 46);
chip('cFilt', 'Filters', 'wireless', 454, 1104, 108, 46);
chip('cBal', 'Baluns', 'wireless', 570, 1104, 108, 46);

// ----------------------------------------------------------------- wires ----
wire('pv', 'solar');                                     // panels into the combiner
wire('cell', 'bank');                                    // cells into the bank
wire('solar', 'inv', { fromPort: 'R', toPort: 'L' });    // generation into the inverter
wire('inv', 'meter');                                    // inverter into metering
wire('meter', 'acgrid');                                 // metering out to the grid
wire('meter', 'gateway', { fromPort: 'B', toPort: 'T' });
wire('pm', 'inv', { fromPort: 'T', toPort: 'B' });       // rails up to the power stage
wire('sig', 'ctrl', { fromPort: 'B', toPort: 'T' });     // conditioned signals into control
wire('sense', 'ctrl', { fromPort: 'L', toPort: 'R', twoWay: true });
wire('hmi', 'ctrl', { fromPort: 'L', toPort: 'R', twoWay: true });
wire('ctrl', 'pm', { fromPort: 'L', toPort: 'R', twoWay: true });
wire('wired', 'ctrl', { fromPort: 'R', toPort: 'L', twoWay: true });
wire('wireless', 'ctrl', { fromPort: 'T', toPort: 'B' });
wire('gateway', 'gwlabel', { fromPort: 'B', toPort: 'T' });
wire('conn', 'wired');

const model = {
  class: 'GraphLinksModel',
  linkFromPortIdProperty: 'fromPort',
  linkToPortIdProperty: 'toPort',
  linkKeyProperty: 'key',
  nodeDataArray: nodes,
  linkDataArray: links,
};
writeFileSync(new URL('./05-solar-storage.gojs.json', import.meta.url),
  JSON.stringify(model, null, 1));
console.log(`05-solar-storage: ${nodes.length} nodes, ${links.length} links`);
