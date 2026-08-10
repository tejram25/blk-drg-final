// Diagram 3 — "Drone Flight Contoller" (title spelled as in the source artwork).
// Coordinates measured from the source artwork (1655 x 900 px space).
//
// The densest of the set: one processor block carrying ~20 named interfaces,
// with the peripheral ecosystem either side. Interfaces are chips sitting on
// the processor's edges, which is what the artwork shows and what makes each
// net land on its own point.
import { writeFileSync } from 'node:fs';

const AD = 'Arrow Display';
const C = {
  soc:    '#79C9EC',   // the processor die
  ic:     '#0D9DDB',   // interface blocks + blue modules
  grey:   '#8B8F92',   // ICs / modules
  conn:   '#3FD6B0',   // connectors
  black:  '#000000',   // antennas
  rfBg:   '#D6EEF9', rfStroke: '#AFDCF2',
  legend: '#F0F1F2',
  wire:   '#A6AAAD',
  ink:    '#141414', white: '#FFFFFF',
};
const F = {
  title: `700 17px "${AD}", sans-serif`,
  soc:   `400 15px "${AD}", sans-serif`,
  chip:  `400 9px "${AD}", sans-serif`,
  blk:   `400 9.5px "${AD}", sans-serif`,
  tiny:  `400 7.5px "${AD}", sans-serif`,
  net:   `400 7px "${AD}", sans-serif`,
};

const nodes = [], links = [];
const N = (o) => nodes.push(o);
const R = (x, y, w, h) => ({ loc: `${x + w / 2} ${y + h / 2}`, size: `${w} ${h}` });

function box(key, text, rect, o = {}) {
  N({ key, category: 'shape', figure: 'Rectangle', text, ...rect,
      fill: o.fill, stroke: o.stroke ?? o.fill, labelColor: o.label ?? C.white,
      font: o.font ?? F.blk, fixedColor: true, minSize: '1 1', strokeWidth: o.strokeWidth ?? 0,
      textWidth: o.textWidth ?? (rect.size.split(' ')[0] - 6),
      ...(o.dashPattern ? { dashPattern: true } : {}), ...(o.ports ? { ports: o.ports } : {}) });
}
const ic    = (k, t, r, o = {}) => box(k, t, r, { fill: C.grey, ...o });
const blue  = (k, t, r, o = {}) => box(k, t, r, { fill: C.ic, ...o });
const conn  = (k, t, r, o = {}) => box(k, t, r, { fill: C.conn, label: C.ink, ...o });
const ant   = (k, t, r, o = {}) => box(k, t, r, { fill: C.black, ...o });
// an interface block sitting on the processor edge
const iface = (k, t, r) => box(k, t, r, { fill: C.ic, font: F.chip });

function label(key, text, rect, o = {}) {
  N({ key, category: 'shape', figure: 'Rectangle', text, ...rect, fill: 'transparent',
      stroke: 'transparent', labelColor: o.color ?? C.ink, font: o.font ?? F.blk,
      fixedColor: true, minSize: '1 1', strokeWidth: 0,
      textWidth: o.textWidth ?? 400, ...(o.align ? { textAlign: o.align } : {}) });
}
let lk = 0;
function link(from, to, fromPort, toPort, o = {}) {
  links.push({ key: --lk, from, to, fromPort, toPort, color: o.color ?? C.wire, width: 1.1,
    arrow: 'Triangle', arrowScale: o.arrowScale ?? 0.85, corner: 0,
    ...(o.text ? { text: o.text, textColor: C.ink, textFont: F.net, textBg: 'rgba(255,255,255,0.92)' } : {}),
    ...(o.wire ? { wire: true } : {}) });
}

// ---------- title ----------
label('title', 'Drone Flight Contoller', R(660, 14, 340, 26), { font: F.title, textWidth: 340 });

// ================= the processor =================
box('soc', 'Processor', R(760, 57, 410, 775), { fill: C.soc, font: F.soc, textWidth: 200,
  ports: [{ portId: 'ddr', spot: '1 0.593' }, { portId: 'emmc', spot: '1 0.656' }] });

// ----- interfaces down the processor's left edge -----
iface('i_usb',   'USB',      R(772, 196, 60, 20));
iface('i_uart',  'UART',     R(772, 303, 60, 20));
iface('i_gpio',  'GPIO',     R(772, 361, 60, 17));
iface('i_pwm',   'PWM',      R(772, 379, 60, 17));
iface('i_dsi',   'DSI',      R(772, 397, 60, 17));
iface('i_i2c1',  'I2C',      R(772, 419, 60, 17));
iface('i_i2c2',  'I2C',      R(772, 443, 60, 17));
iface('i_pcie',  'PCIe',     R(772, 480, 60, 25));
iface('i_vbat',  'VBAT',     R(772, 525, 60, 25));
iface('i_i2c3',  'I2C',      R(772, 700, 60, 18));
box('i_usbdp', 'USB + DP', R(772, 738, 78, 92), { fill: C.ic, font: F.chip,
  ports: [{ portId: 'a', spot: '0 0.2' }, { portId: 'b', spot: '0 0.4' },
          { portId: 'c', spot: '0 0.6' }, { portId: 'd', spot: '0 0.8' }] });

// ----- interfaces down the processor's right edge -----
iface('o_dbg',   'Debug UART',        R(1078, 78, 92, 30));
iface('o_qup',   'QUPUART/SPI/\nI2C', R(1078, 122, 92, 34));
box('o_ssc', "Sensor Core IO's", R(1078, 180, 92, 76), { fill: C.ic, font: F.chip,
  ports: [{ portId: 'a', spot: '1 0.2' }, { portId: 'b', spot: '1 0.5' }, { portId: 'c', spot: '1 0.8' }] });
box('o_i2c', 'I2C', R(1078, 285, 66, 46), { fill: C.ic, font: F.chip,
  ports: [{ portId: 'a', spot: '1 0.3' }, { portId: 'b', spot: '1 0.7' }] });
iface('o_dmic1', 'DMIC Ports(x1)',    R(1078, 358, 92, 24));
iface('o_gpio',  'GPIO(PWM)',         R(1078, 393, 92, 22));
iface('o_wifi',  'Wi-Fi',             R(1078, 440, 60, 25));
iface('o_dmic2', 'DMIC Ports(x1)',    R(1078, 630, 92, 24));
iface('o_wcd',   'WCD Sound wire',    R(1078, 692, 92, 24));
iface('o_mi2s',  'MI2S',              R(1078, 775, 92, 23));

// ================= right-hand ecosystem =================
conn('debugcon', 'Debug\nConnector', R(1235, 78, 72, 32));
ic  ('gnss',     'GNSS Module',      R(1240, 124, 92, 40));
conn('ufl',      'U.FL\nConnector',  R(1342, 124, 66, 34));
ant ('gnssant',  'GNSS Antenna',     R(1450, 130, 84, 22), { font: F.tiny });
ic  ('mag',      'MAGNETIC\nSENSOR', R(1245, 174, 86, 28), { font: F.tiny });
ic  ('imu',      'IMU SENSOR',       R(1245, 207, 86, 24), { font: F.tiny });
ic  ('als',      'Ambient light sensor\n(Right side Button/Joystick flex)', R(1245, 236, 132, 28), { font: F.tiny, textWidth: 126 });
ic  ('hapdrv',   'Haptic Driver IC',  R(1245, 277, 86, 24), { font: F.tiny });
ic  ('hapmot',   'Haptic Motor',      R(1382, 277, 86, 24), { font: F.tiny });
ic  ('temp',     'Temperature\nSensors', R(1245, 316, 86, 28), { font: F.tiny });
ic  ('mic1',     '2x Digital MIC',    R(1245, 358, 86, 24), { font: F.tiny });
ant ('rgbled',   'RGB LED',           R(1245, 396, 62, 14), { font: F.net });
ant ('wifiant',  'Wi-Fi Antenna',     R(1212, 438, 88, 28), { font: F.tiny });
ic  ('ddr',      'DDR Memory',        R(1255, 504, 82, 26), { font: F.tiny });
ic  ('emmc',     'eMMC Memory',       R(1255, 552, 82, 26), { font: F.tiny });
ic  ('mic2',     '2x Digital MIC',    R(1375, 630, 86, 24), { font: F.tiny });
ic  ('codec',    'Audio Codec\nWCD9385', R(1255, 688, 120, 38), { font: F.tiny });
ic  ('spkamp',   'Speaker Amplifier\nWSA8815', R(1255, 774, 120, 38), { font: F.tiny });
ic  ('spk',      'Speakers',          R(1396, 780, 58, 28), { font: F.tiny });

// ================= left-hand ecosystem =================
box('rfbg', '', R(370, 138, 124, 112), { fill: C.rfBg, stroke: C.rfStroke, strokeWidth: 1, label: C.ink });
label('rfcap', 'Drone RF communication Module', R(348, 252, 168, 18), { font: F.net, textWidth: 168 });
blue('lte',   'LTE/5G Module', R(378, 156, 106, 32));
box('radio', 'Radio Module', R(378, 196, 106, 32), { fill: C.ic,
  ports: [{ portId: 'a', spot: '1 0.3' }, { portId: 'b', spot: '1 0.7' }] });

ic  ('usbhub', 'USB HUB',        R(650, 176, 90, 52));
ic  ('mcu',    'Microcontroller', R(568, 262, 92, 78));
blue('joy',    'Joystick and Button', R(374, 296, 116, 28));
blue('led',    'LED',            R(414, 336, 52, 14), { font: F.net });
ic  ('pwmmux', 'PWM\nMux',       R(628, 364, 52, 32), { font: F.tiny });
blue('disp',   'Display and\nTouch Combo', R(528, 388, 80, 44), { font: F.tiny });
ic  ('hall',   'Hall Effect\nSensor', R(448, 436, 82, 30), { font: F.tiny });
ic  ('dsup',   'Display\nSupply', R(576, 464, 38, 34), { font: F.net });
ic  ('vconv',  'Voltage Converter', R(664, 518, 88, 34), { font: F.tiny });
ic  ('mosfet', 'MOSFET',         R(538, 526, 36, 14), { font: F.net });
ic  ('chgic',  'Battery Charging\nIC', R(434, 524, 58, 156), { font: F.tiny, textWidth: 54 });
box('balance', 'Battery Cell\nBalancer and\nProtection.\n+\nFuel Gauge', R(500, 562, 74, 128), { fill: C.grey, font: F.tiny, textWidth: 70,
  ports: [{ portId: 'a', spot: '1 0.18' }, { portId: 'b', spot: '1 0.45' }, { portId: 'c', spot: '1 0.85' }] });
ic  ('cell1',  'Individual\ncell with\nProtection', R(598, 572, 68, 42), { font: F.net, textWidth: 64 });
ic  ('cell2',  'Individual\ncell with\nProtection', R(598, 620, 68, 42), { font: F.net, textWidth: 64 });
label('cellcap', '2x Cell', R(672, 618, 44, 14), { font: F.net, textWidth: 44 });
ic  ('pdctl',  'PD Controller', R(352, 562, 64, 98), { font: F.tiny, textWidth: 58 });
box('typec', 'Replaceable\nUSB Type C\nBoard', R(158, 518, 76, 284), { fill: C.ic, font: F.tiny, textWidth: 70,
  ports: [{ portId: 'p1', spot: '1 0.14' }, { portId: 'p2', spot: '1 0.30' }, { portId: 'p3', spot: '1 0.46' },
          { portId: 'p4', spot: '1 0.62' }, { portId: 'p5', spot: '1 0.78' }] });
box('cardedge', 'Card\nedge\nConnector', R(266, 528, 56, 174), { fill: C.conn, label: C.ink, font: F.tiny, textWidth: 50,
  ports: [{ portId: 'l1', spot: '0 0.14' }, { portId: 'l2', spot: '0 0.30' }, { portId: 'l3', spot: '0 0.46' },
          { portId: 'l4', spot: '0 0.62' }, { portId: 'l5', spot: '0 0.78' },
          { portId: 'r1', spot: '1 0.18' }, { portId: 'r2', spot: '1 0.38' }, { portId: 'r3', spot: '1 0.56' },
          { portId: 'r4', spot: '1 0.72' }, { portId: 'r5', spot: '1 0.88' }] });
ic  ('sw5v',   '5V Load Switch', R(592, 736, 64, 22), { font: F.net });
ic  ('auxsw',  'AUX switch',     R(592, 798, 94, 36), { font: F.tiny });

// ================= legend =================
box('legbg', '', R(1176, 852, 384, 30), { fill: C.legend, label: C.ink });
conn('lg1', 'Connector', R(1186, 856, 108, 22), { font: F.tiny });
ant ('lg2', 'Antenna',   R(1300, 856, 108, 22), { font: F.tiny });
ic  ('lg3', 'IC',        R(1414, 856, 108, 22), { font: F.tiny });

// ================= wiring =================
// right side
link('o_dbg', 'debugcon', 'R', 'L', { text: 'GPIO_TX' });
link('debugcon', 'o_dbg', 'L', 'R', { text: 'GPIO_RX' });
link('o_qup', 'gnss', 'R', 'L', { text: 'UART' });
link('gnss', 'ufl', 'R', 'L');
link('ufl', 'gnssant', 'R', 'L');
link('o_ssc', 'mag', 'a', 'L', { text: 'SSC_I3C0' });
link('o_ssc', 'imu', 'b', 'L', { text: 'SSC_I3C0' });
link('o_ssc', 'als', 'c', 'L', { text: 'SSC_I2C4' });
link('o_i2c', 'hapdrv', 'a', 'L', { text: 'I2C' });
link('hapdrv', 'hapmot', 'R', 'L');
link('o_i2c', 'temp', 'b', 'L', { text: 'I2C' });
link('o_dmic1', 'mic1', 'R', 'L', { text: '1CH- DMIC' });
link('o_gpio', 'rgbled', 'R', 'L');
link('o_wifi', 'wifiant', 'R', 'L');
link('soc', 'ddr', 'ddr', 'L', { text: 'DDR' });
link('soc', 'emmc', 'emmc', 'L', { text: 'DDR' });
link('o_dmic2', 'mic2', 'R', 'L', { text: '1CH-DMIC' });
link('o_wcd', 'codec', 'R', 'L', { text: 'SWR' });
link('codec', 'spkamp', 'B', 'T', { text: 'SWR\nPDM' });
link('spkamp', 'spk', 'R', 'L');
link('o_mi2s', 'spkamp', 'R', 'L');

// left side
link('lte', 'usbhub', 'R', 'L', { text: 'VBUS' });
link('radio', 'mcu', 'a', 'L', { text: 'USB' });
link('radio', 'mcu', 'b', 'L', { text: 'GPIO' });
link('usbhub', 'i_usb', 'R', 'L', { text: 'USB' });
link('mcu', 'usbhub', 'T', 'B', { text: 'USB' });
link('mcu', 'i_uart', 'R', 'L');
link('joy', 'mcu', 'R', 'L');
link('mcu', 'led', 'B', 'R');
link('mcu', 'pwmmux', 'B', 'T', { text: 'PWM' });
link('pwmmux', 'i_pwm', 'R', 'L', { text: 'PWM' });
link('pwmmux', 'i_gpio', 'R', 'L', { text: 'Selection' });
link('disp', 'i_dsi', 'R', 'L', { text: 'DSI' });
link('disp', 'i_i2c1', 'R', 'L', { text: 'I2C' });
link('hall', 'i_i2c2', 'R', 'L', { text: 'I2C' });
link('dsup', 'disp', 'T', 'B');
link('vconv', 'i_vbat', 'R', 'L');
link('mosfet', 'vconv', 'R', 'L', { text: 'VSYS' });
link('chgic', 'mosfet', 'T', 'L', { text: 'VBAT' });
link('balance', 'mosfet', 'T', 'B', { text: 'VBATT' });
link('balance', 'cell1', 'a', 'L');
link('balance', 'cell2', 'b', 'L');
link('pdctl', 'chgic', 'R', 'L', { text: 'VBUS' });
link('cardedge', 'pdctl', 'r1', 'L', { text: 'CC1\nCC2' });
link('typec', 'cardedge', 'p1', 'l1', { text: 'VBUS' });
link('typec', 'cardedge', 'p2', 'l2', { text: 'CCx' });
link('typec', 'cardedge', 'p3', 'l3', { text: 'USB0 2.0' });
link('typec', 'cardedge', 'p4', 'l4', { text: 'USB0 3.0' });
link('typec', 'cardedge', 'p5', 'l5', { text: 'SBUx' });
link('balance', 'i_i2c3', 'c', 'L', { text: 'I2C' });
link('sw5v', 'i_usbdp', 'R', 'a', { text: '5V VBUS' });
link('cardedge', 'i_usbdp', 'r2', 'b', { text: 'USB0 2.0' });
link('cardedge', 'i_usbdp', 'r3', 'c', { text: 'USB2.0' });
link('cardedge', 'auxsw', 'r4', 'L', { text: 'USB_SBU1' });
link('cardedge', 'auxsw', 'r5', 'L', { text: 'USB_SBU2' });
link('auxsw', 'i_usbdp', 'R', 'd', { text: 'DP_AUX' });
link('pdctl', 'cardedge', 'B', 'B', { text: 'USB0 2.0' });

const model = { class: 'GraphLinksModel', linkFromPortIdProperty: 'fromPort',
  linkToPortIdProperty: 'toPort', linkKeyProperty: 'key', nodeDataArray: nodes, linkDataArray: links };
writeFileSync(new URL('./03-flight-controller.gojs.json', import.meta.url), JSON.stringify(model, null, 1));
console.log('nodes', nodes.length, 'links', links.length);
