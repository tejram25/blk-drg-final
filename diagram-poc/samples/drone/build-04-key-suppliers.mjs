// Diagram 4 — "Resources from Key Suppliers".
// Coordinates measured from the source artwork (1240 x 760 px space).
//
// Two SoCs side by side — image capture / autonomous navigation, and video
// processing / connectivity — each ringed by interface blocks, with the
// sensor, memory, radio and power ecosystem around them.
import { writeFileSync } from 'node:fs';

const AD = 'Arrow Display';
const C = {
  soc:    '#1BA0DC',   // processing units
  iface:  '#3EB4E4',   // interface blocks on a SoC edge
  mod:    '#3FD6B0',   // modules / antennas (green)
  conn:   '#000000',   // connectors (black)
  ic:     '#8B8F92',   // ICs
  legend: '#F0F1F2',
  wire:   '#8FA6B4',
  ink:    '#141414', white: '#FFFFFF',
};
const F = {
  title: `700 17px "${AD}", sans-serif`,
  soc:   `600 11px "${AD}", sans-serif`,
  chip:  `400 8px "${AD}", sans-serif`,
  blk:   `400 8.5px "${AD}", sans-serif`,
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
      ...(o.ports ? { ports: o.ports } : {}) });
}
const ic    = (k, t, r, o = {}) => box(k, t, r, { fill: C.ic, font: F.tiny, ...o });
const mod   = (k, t, r, o = {}) => box(k, t, r, { fill: C.mod, label: C.ink, font: F.tiny, ...o });
const conn  = (k, t, r, o = {}) => box(k, t, r, { fill: C.conn, font: F.tiny, ...o });
const iface = (k, t, r, o = {}) => box(k, t, r, { fill: C.iface, font: F.chip, ...o });

function label(key, text, rect, o = {}) {
  N({ key, category: 'shape', figure: 'Rectangle', text, ...rect, fill: 'transparent',
      stroke: 'transparent', labelColor: o.color ?? C.ink, font: o.font ?? F.blk,
      fixedColor: true, minSize: '1 1', strokeWidth: 0,
      textWidth: o.textWidth ?? 400, ...(o.align ? { textAlign: o.align } : {}) });
}
let lk = 0;
function link(from, to, fromPort, toPort, o = {}) {
  links.push({ key: --lk, from, to, fromPort, toPort, color: o.color ?? C.wire, width: 1.1,
    arrow: 'Triangle', arrowScale: o.arrowScale ?? 0.8, corner: 0,
    ...(o.text ? { text: o.text, textColor: C.ink, textFont: F.net, textBg: 'transparent',
        textOffset: o.labelOffset ?? '0 -6', ...(o.labelAt ? { textFraction: o.labelAt } : {}) } : {}),
    ...(o.wire ? { wire: true } : {}) });
}

// ---------- title ----------
label('title', 'Resources from Key Suppliers', R(450, 10, 340, 26), { font: F.title, textWidth: 340 });

// ================= the two SoCs =================
box('soc1', 'Image capture\nAutonomous navigation and real-time control\nSoC',
    R(130, 368, 500, 208), { fill: C.soc, font: F.soc, textWidth: 300,
    ports: [{ portId: 'e1', spot: '1 0.16' }, { portId: 'e2', spot: '1 0.34' },
            { portId: 'e3', spot: '1 0.52' }, { portId: 'e4', spot: '1 0.70' },
            { portId: 'e5', spot: '1 0.86' }] });
box('soc2', 'Video processing\nand connectivity\nSoC',
    R(700, 368, 240, 208), { fill: C.soc, font: F.soc, textWidth: 180 });

// ----- interface blocks along soc1's top edge -----
iface('s1_spi',  'SPI',                 R(178, 368, 34, 20));
iface('s1_gnss', 'SPI+GPIOs+\nUSB2.0+UART', R(232, 368, 102, 24));
iface('s1_ddr',  'DDR',                 R(468, 368, 34, 20));
iface('s1_lvds', 'LVDS2\nLane',         R(530, 362, 46, 26));
iface('s1_jtag', 'JTAG',                R(602, 368, 38, 20));

// ----- interface blocks along soc1's bottom edge -----
const s1b = [['s1_i2c1','I2C',144],['s1_i2c2','I2C',188],['s1_i2c3','I2C',232],['s1_i2c4','I2C',276],
             ['s1_uarts','UARTs',320],['s1_gpios','GPIOs',364],['s1_i2c5','I2C',408],
             ['s1_lvds2','LVDS',452],['s1_xgpio','xGPIO',496],['s1_i2c6','I2C',540],['s1_spi2','SPI',584]];
s1b.forEach(([k, t, x]) => iface(k, t, R(x, 556, 40, 20)));

// ----- soc1 left-edge interfaces -----
iface('s1_l1', 'I2C+GPIO', R(130, 420, 56, 20));
iface('s1_l2', 'I2C+GPIO', R(130, 456, 56, 20));

// ----- soc2 interface blocks -----
iface('s2_eth',  'Ethernet',   R(700, 400, 56, 18));
iface('s2_pcie', 'PCIe/USB',   R(700, 424, 56, 18));
iface('s2_spi',  'SPI',        R(700, 448, 56, 18));
iface('s2_csi',  'CSI/LVDS',   R(700, 472, 56, 18));
iface('s2_i2c',  'I2C',        R(700, 496, 56, 18));
iface('s2_i2cu', 'I2C/UART',   R(700, 520, 56, 18));
iface('s2_usbp', 'USB/PcIe',   R(884, 400, 56, 18));
iface('s2_uart', 'UART',       R(884, 424, 56, 18));
iface('s2_usb',  'USB',        R(884, 500, 56, 18));
iface('s2_gpio', 'GPIO',       R(884, 550, 56, 18));
const s2b = [['s2_uart2','UART',714],['s2_ddrs','DDRS',760],['s2_i2c2','I2C',808]];
s2b.forEach(([k, t, x]) => iface(k, t, R(x, 556, 42, 20)));

// soc1 -> soc2 shared interfaces (mirrored pairs)
iface('s1_eth',  'Ethernet',  R(574, 400, 56, 18));
iface('s1_pcie', 'PCIe/USB',  R(574, 424, 56, 18));
iface('s1_spi3', 'SPI',       R(574, 448, 56, 18));
iface('s1_csi',  'CSI/LVDS',  R(574, 472, 56, 18));
iface('s1_i2c7', 'I2C',       R(574, 496, 56, 18));
iface('s1_i2cu', 'I2C/UART',  R(574, 520, 56, 18));

// ================= top ecosystem =================
ic  ('imu',    'IMU\nSensor',        R(168, 300, 54, 40));
ic  ('gnssmod','GNSS Module',        R(240, 300, 86, 40));
ic  ('emmc',   'eMMC\nMemory',       R(340, 300, 62, 40));
ic  ('lpddr',  'LPDDR4/\nLPDDR5',    R(444, 300, 74, 40));
mod ('avoid',  'Obstacle avoidance\nsensor\n(rear side Radar)', R(528, 264, 110, 50));
ic  ('ledpwm', 'LED PWM\ndriver',    R(390, 236, 68, 34));
ic  ('rgbled', 'RGB LEDs',           R(390, 180, 68, 26));
mod ('actant', 'Active antenna\nL1/L2/L5', R(232, 236, 96, 30));
conn('jtag',   'JTAG Conn',          R(662, 294, 62, 26));

// ================= right / power chain =================
conn('nanosim','Nano SIM\nConnector', R(660, 122, 74, 40));
ic  ('simbrd', 'SIM Board\nConnector', R(654, 198, 80, 34));
mod ('lteant1','LTE\nAntenna 1',     R(742, 122, 56, 34));
mod ('lteant2','LTE\nAntenna 2',     R(806, 122, 56, 34));
mod ('lteconn','LTE\nAntenna\nConnector', R(742, 190, 56, 42));
conn('lteant3','LTE\nAntenna',       R(806, 190, 56, 42));
ic  ('ltemod', 'LTE Modem',          R(742, 272, 86, 48));
ic  ('ufs',    'UFS Memory',         R(846, 272, 78, 48));
conn('batt',   'Battery',            R(852, 88, 56, 42));
ic  ('battif', 'Battery\nInterface\nConnector', R(938, 84, 62, 46));
ic  ('hotswap','HOT SWAP\nController', R(1024, 88, 78, 34));
ic  ('supercap','Supercaps',         R(1024, 156, 78, 24));
ic  ('pmc',    'Power\nmanagement\nand control\ncircuitry', R(916, 200, 84, 62));
ic  ('inprot', 'Input Power\nprotection\ncircuit',  R(1020, 194, 84, 52));
label('syspwr', 'System\npower supply', R(908, 268, 92, 26), { font: F.net, textWidth: 92 });

// ================= right ecosystem =================
mod ('wifiant1','WiFi 6\nAntenna 1', R(1096, 396, 62, 34));
mod ('wifiant2','WiFi 6\nAntenna 2', R(1096, 442, 62, 34));
ic  ('wifimod', 'WiFi + BT\nModule',  R(984, 396, 76, 80));
conn('usbc',    'USB Type-C\nConnector', R(1058, 494, 74, 44));
label('buttons', 'Buttons', R(970, 558, 54, 16), { font: F.net, textWidth: 54 });

// ================= bottom ecosystem =================
ic  ('baro2',  'Barometers',    R(110, 616, 78, 28));
ic  ('tsens',  'Temperature\nSensor', R(226, 616, 74, 30));
ic  ('fandrv', 'Fan Driver\nDRV10983DPWPR', R(304, 612, 74, 34));
conn('fanconn','FAN\nConnector', R(296, 668, 62, 32));
ic  ('ambient','Ambient\ntemperature\nSensor interface\nconnector', R(164, 664, 82, 50), { fill: C.conn });
mod ('motorctl','Motor\nController\nModules', R(400, 660, 76, 44));
ic  ('cams',   'Camera\nModules',   R(478, 630, 76, 44));
ic  ('imu2',   'IMU\nSensor',       R(576, 630, 62, 40));
ic  ('norflash','NOR Flash',        R(636, 598, 68, 26));
conn('dbgcon', 'Debug\nConnector',  R(730, 612, 66, 34));
ic  ('lpddr2', 'LPDDR4\nMemory',    R(788, 612, 62, 34));
ic  ('tsens2', 'Temperature\nSensor', R(858, 612, 72, 34));

// ================= left ecosystem =================
mod ('range',  '1D Range\nsensor',   R(20, 420, 84, 28));
mod ('magneto','Magnetometer\nsensor', R(20, 452, 84, 28));
mod ('baro',   'Barometer',          R(20, 484, 84, 24));

// ================= legend =================
box('legbg', '', R(886, 690, 300, 56), { fill: C.legend, label: C.ink });
label('legttl', 'KEY:', R(892, 700, 34, 16), { font: F.tiny, textWidth: 34 });
mod ('lg1', 'Modules/\nAntennas', R(896, 700, 74, 36), { font: F.net });
conn('lg2', 'Connectors',         R(976, 706, 66, 24), { font: F.net });
ic  ('lg3', 'ICs',                R(1048, 706, 56, 24), { font: F.net });
box('lg4', 'Processing\nUnits', R(1110, 700, 66, 36), { fill: C.soc, font: F.net });

// ================= wiring =================
// soc1 top
link('imu', 's1_spi', 'B', 'T', { text: 'SPI', labelOffset: '-12 0' });
link('gnssmod', 's1_gnss', 'B', 'T', { wire: true });
link('emmc', 's1_gnss', 'B', 'T', { wire: true });
link('lpddr', 's1_ddr', 'B', 'T', { text: 'DDR', labelOffset: '-12 0' });
link('avoid', 's1_lvds', 'B', 'T', { wire: true });
link('jtag', 's1_jtag', 'B', 'T', { wire: true });
link('actant', 'gnssmod', 'B', 'T', { wire: true });
link('rgbled', 'ledpwm', 'B', 'T', { wire: true });
link('ledpwm', 'emmc', 'B', 'T', { wire: true });

// soc1 left
link('range', 's1_l1', 'R', 'L', { wire: true });
link('magneto', 's1_l1', 'R', 'L', { wire: true });
link('baro', 's1_l2', 'R', 'L', { wire: true });

// soc1 bottom
link('s1_i2c1', 'baro2', 'B', 'T', { wire: true });
link('s1_i2c2', 'tsens', 'B', 'T', { wire: true });
link('s1_i2c3', 'fandrv', 'B', 'T', { wire: true });
link('s1_i2c4', 'fandrv', 'B', 'T', { wire: true });
link('s1_uarts', 'motorctl', 'B', 'T', { wire: true });
link('s1_gpios', 'motorctl', 'B', 'T', { wire: true });
link('s1_i2c5', 'cams', 'B', 'T', { wire: true });
link('s1_lvds2', 'cams', 'B', 'T', { wire: true });
link('s1_xgpio', 'imu2', 'B', 'T', { wire: true });
link('s1_i2c6', 'imu2', 'B', 'T', { wire: true });
link('s1_spi2', 'norflash', 'B', 'T', { wire: true });
link('fandrv', 'fanconn', 'B', 'T', { wire: true });
link('ambient', 'baro2', 'T', 'B', { wire: true });

// soc1 <-> soc2
link('s1_eth', 's2_eth', 'R', 'L', { wire: true });
link('s1_pcie', 's2_pcie', 'R', 'L', { wire: true });
link('s1_spi3', 's2_spi', 'R', 'L', { wire: true });
link('s1_csi', 's2_csi', 'R', 'L', { wire: true });
link('s1_i2c7', 's2_i2c', 'R', 'L', { wire: true });
link('s1_i2cu', 's2_i2cu', 'R', 'L', { wire: true });

// soc2 bottom + right
link('s2_uart2', 'dbgcon', 'B', 'T', { wire: true });
link('s2_ddrs', 'lpddr2', 'B', 'T', { wire: true });
link('s2_i2c2', 'tsens2', 'B', 'T', { wire: true });
link('norflash', 's2_uart2', 'R', 'L', { wire: true });
link('s2_usbp', 'wifimod', 'R', 'L', { wire: true });
link('s2_uart', 'wifimod', 'R', 'L', { wire: true });
link('wifimod', 'wifiant1', 'R', 'L', { wire: true });
link('wifimod', 'wifiant2', 'R', 'L', { wire: true });
link('s2_usb', 'usbc', 'R', 'L', { wire: true });
link('s2_gpio', 'buttons', 'R', 'L', { wire: true });

// LTE / power
link('nanosim', 'simbrd', 'B', 'T', { wire: true });
link('simbrd', 'ltemod', 'R', 'L', { wire: true });
link('lteant1', 'lteconn', 'B', 'T', { wire: true });
link('lteant2', 'lteant3', 'B', 'T', { wire: true });
link('lteconn', 'ltemod', 'B', 'T', { wire: true });
link('lteant3', 'ltemod', 'B', 'T', { wire: true });
link('ltemod', 'soc2', 'B', 'T', { wire: true });
link('ufs', 'soc2', 'B', 'T', { wire: true });
link('batt', 'battif', 'R', 'L', { text: 'VBATT' });
link('battif', 'hotswap', 'R', 'L', { wire: true });
link('hotswap', 'supercap', 'B', 'T', { wire: true });
link('hotswap', 'inprot', 'B', 'T', { wire: true });
link('inprot', 'pmc', 'L', 'R', { text: 'VBAT' });
link('battif', 'pmc', 'B', 'T', { text: 'UART/I2C', labelOffset: '-20 0' });

const model = { class: 'GraphLinksModel', linkFromPortIdProperty: 'fromPort',
  linkToPortIdProperty: 'toPort', linkKeyProperty: 'key', nodeDataArray: nodes, linkDataArray: links };
writeFileSync(new URL('./04-key-suppliers.gojs.json', import.meta.url), JSON.stringify(model, null, 1));
console.log('nodes', nodes.length, 'links', links.length);
