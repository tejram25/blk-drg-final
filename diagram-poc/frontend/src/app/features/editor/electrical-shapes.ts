/**
 * Schematic symbol definitions for the electrical palette.
 * Each symbol is drawn with SVG paths in a fixed local coordinate space,
 * with connection pins (ports) at absolute positions.
 *
 * The shape names here ("elec-*") match the "shape" field returned by
 * GET /api/block-types for items in the "Electrical" category.
 */

export interface SymbolPath {
  d: string;
  /** true → filled with the stroke color (e.g. diode triangle) */
  fill?: boolean;
}

export interface SymbolText {
  x: number;
  y: number;
  text: string;
  size?: number;
  anchor?: 'start' | 'middle' | 'end';
  bold?: boolean;
}

export interface SymbolDef {
  width: number;
  height: number;
  paths: SymbolPath[];
  /** static labels inside the symbol (e.g. IC pin names) */
  texts?: SymbolText[];
  /** pin positions in local coordinates */
  pins: { x: number; y: number }[];
  /** electrical pin names matching `pins` by index (A/K, B/C/E, VCC…) for netlists */
  pinNames?: string[];
}

/**
 * Factory for IC symbols: rectangular body, labeled pin stubs on any side.
 * Pin order in the result: left (top→bottom), right (top→bottom),
 * top (left→right), bottom (left→right) — i.e. pin0 is the first left pin.
 */
function ic(
  title: string,
  cfg: { left?: string[]; right?: string[]; top?: string[]; bottom?: string[]; width?: number },
): SymbolDef {
  const W = cfg.width ?? 130;
  const left = cfg.left ?? [];
  const right = cfg.right ?? [];
  const top = cfg.top ?? [];
  const bottom = cfg.bottom ?? [];
  const rows = Math.max(left.length, right.length, 1);
  const H = Math.max(80, rows * 26 + 40);
  const bodyL = 20, bodyR = W - 20, bodyT = 14, bodyB = H - 14;

  const paths: SymbolPath[] = [
    { d: `M ${bodyL} ${bodyT} L ${bodyR} ${bodyT} L ${bodyR} ${bodyB} L ${bodyL} ${bodyB} Z` },
  ];
  const texts: SymbolText[] = [
    { x: W / 2, y: (bodyT + bodyB) / 2 + 4, text: title, size: 11, bold: true },
  ];
  const pins: { x: number; y: number }[] = [];
  // Pin names track the push order below (left, right, top, bottom).
  const pinNames = [...left, ...right, ...top, ...bottom];

  left.forEach((label, i) => {
    const y = Math.round(bodyT + ((bodyB - bodyT) / (left.length + 1)) * (i + 1));
    paths.push({ d: `M 0 ${y} L ${bodyL} ${y}` });
    pins.push({ x: 0, y });
    texts.push({ x: bodyL + 5, y: y + 3, text: label, size: 7.5, anchor: 'start' });
  });
  right.forEach((label, i) => {
    const y = Math.round(bodyT + ((bodyB - bodyT) / (right.length + 1)) * (i + 1));
    paths.push({ d: `M ${bodyR} ${y} L ${W} ${y}` });
    pins.push({ x: W, y });
    texts.push({ x: bodyR - 5, y: y + 3, text: label, size: 7.5, anchor: 'end' });
  });
  top.forEach((label, i) => {
    const x = Math.round(bodyL + ((bodyR - bodyL) / (top.length + 1)) * (i + 1));
    paths.push({ d: `M ${x} 0 L ${x} ${bodyT}` });
    pins.push({ x, y: 0 });
    texts.push({ x, y: bodyT + 11, text: label, size: 7.5 });
  });
  bottom.forEach((label, i) => {
    const x = Math.round(bodyL + ((bodyR - bodyL) / (bottom.length + 1)) * (i + 1));
    paths.push({ d: `M ${x} ${bodyB} L ${x} ${H}` });
    pins.push({ x, y: H });
    texts.push({ x, y: bodyB - 6, text: label, size: 7.5 });
  });

  return { width: W, height: H, paths, texts, pins, pinNames };
}

export const ELECTRICAL_SYMBOLS: Record<string, SymbolDef> = {
  'elec-resistor': {
    width: 100, height: 40,
    paths: [{ d: 'M 0 20 L 20 20 L 26 8 L 38 32 L 50 8 L 62 32 L 74 8 L 80 20 L 100 20' }],
    pins: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
  },
  'elec-capacitor': {
    width: 100, height: 40,
    paths: [
      { d: 'M 0 20 L 44 20' },
      { d: 'M 56 20 L 100 20' },
      { d: 'M 44 6 L 44 34' },
      { d: 'M 56 6 L 56 34' },
    ],
    pins: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
  },
  'elec-inductor': {
    width: 100, height: 40,
    paths: [{
      d: 'M 0 20 L 20 20 A 7.5 9 0 0 1 35 20 A 7.5 9 0 0 1 50 20 A 7.5 9 0 0 1 65 20 A 7.5 9 0 0 1 80 20 L 100 20',
    }],
    pins: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
  },
  'elec-diode': {
    width: 100, height: 40,
    paths: [
      { d: 'M 0 20 L 38 20' },
      { d: 'M 62 20 L 100 20' },
      { d: 'M 62 8 L 62 32' },
      { d: 'M 38 8 L 38 32 L 62 20 Z', fill: true },
    ],
    pins: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
  },
  'elec-led': {
    width: 100, height: 52,
    paths: [
      { d: 'M 0 32 L 38 32' },
      { d: 'M 62 32 L 100 32' },
      { d: 'M 62 20 L 62 44' },
      { d: 'M 38 20 L 38 44 L 62 32 Z', fill: true },
      { d: 'M 47 17 L 55 7 M 55 7 L 50 8 M 55 7 L 54 12' },
      { d: 'M 56 20 L 64 10 M 64 10 L 59 11 M 64 10 L 63 15' },
    ],
    pins: [{ x: 0, y: 32 }, { x: 100, y: 32 }],
  },
  'elec-npn': {
    width: 60, height: 60,
    paths: [
      { d: 'M 20 12 L 20 48' },          // base bar
      { d: 'M 0 30 L 20 30' },           // base lead
      { d: 'M 20 22 L 46 10 L 46 0' },   // collector
      { d: 'M 20 38 L 46 50 L 46 60' },  // emitter
      { d: 'M 40 47.3 L 30.4 46.7 L 33.3 40.3 Z', fill: true }, // emitter arrow
    ],
    pins: [{ x: 0, y: 30 }, { x: 46, y: 0 }, { x: 46, y: 60 }],
  },
  'elec-ground': {
    width: 40, height: 32,
    paths: [
      { d: 'M 20 0 L 20 14' },
      { d: 'M 4 14 L 36 14' },
      { d: 'M 10 21 L 30 21' },
      { d: 'M 16 28 L 24 28' },
    ],
    pins: [{ x: 20, y: 0 }],
  },
  'elec-vdc': {
    width: 60, height: 60,
    paths: [
      { d: 'M 12 30 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0' },
      { d: 'M 30 0 L 30 12' },
      { d: 'M 30 48 L 30 60' },
      { d: 'M 30 19 L 30 27 M 26 23 L 34 23' }, // +
      { d: 'M 26 38 L 34 38' },                 // −
    ],
    pins: [{ x: 30, y: 0 }, { x: 30, y: 60 }],
  },
  'elec-vac': {
    width: 60, height: 60,
    paths: [
      { d: 'M 12 30 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0' },
      { d: 'M 30 0 L 30 12' },
      { d: 'M 30 48 L 30 60' },
      { d: 'M 20 30 Q 25 18 30 30 Q 35 42 40 30' }, // sine
    ],
    pins: [{ x: 30, y: 0 }, { x: 30, y: 60 }],
  },
  'elec-switch': {
    width: 100, height: 40,
    paths: [
      { d: 'M 0 20 L 30 20' },
      { d: 'M 70 20 L 100 20' },
      { d: 'M 30 20 L 68 4' }, // lever
      { d: 'M 27 20 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: true },
      { d: 'M 67 20 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: true },
    ],
    pins: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
  },
  'elec-fuse': {
    width: 100, height: 40,
    paths: [
      { d: 'M 0 20 L 100 20' },
      { d: 'M 30 12 L 70 12 L 70 28 L 30 28 Z' },
    ],
    pins: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
  },
  'elec-pnp': {
    width: 60, height: 60,
    paths: [
      { d: 'M 20 12 L 20 48' },          // base bar
      { d: 'M 0 30 L 20 30' },           // base lead
      { d: 'M 20 22 L 46 10 L 46 0' },   // collector
      { d: 'M 20 38 L 46 50 L 46 60' },  // emitter
      { d: 'M 24 39.9 L 30.7 46.8 L 33.6 40.4 Z', fill: true }, // arrow toward base
    ],
    pins: [{ x: 0, y: 30 }, { x: 46, y: 0 }, { x: 46, y: 60 }],
  },
  'elec-nmos': {
    width: 60, height: 60,
    paths: [
      { d: 'M 0 30 L 16 30' },           // gate lead
      { d: 'M 16 16 L 16 44' },          // gate bar
      { d: 'M 24 12 L 24 48' },          // channel bar
      { d: 'M 24 16 L 46 16 L 46 0' },   // drain
      { d: 'M 24 44 L 46 44 L 46 60' },  // source
      { d: 'M 36 30 L 26 30' },          // body arrow line
      { d: 'M 24 30 L 31 26.5 L 31 33.5 Z', fill: true },
    ],
    pins: [{ x: 0, y: 30 }, { x: 46, y: 0 }, { x: 46, y: 60 }],
  },
  'elec-zener': {
    width: 100, height: 40,
    paths: [
      { d: 'M 0 20 L 38 20' },
      { d: 'M 62 20 L 100 20' },
      { d: 'M 62 8 L 62 32 M 62 8 L 56 4 M 62 32 L 68 36' }, // bent cathode bar
      { d: 'M 38 8 L 38 32 L 62 20 Z', fill: true },
    ],
    pins: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
  },
  'elec-pot': {
    width: 100, height: 56,
    paths: [
      { d: 'M 0 36 L 20 36 L 26 24 L 38 48 L 50 24 L 62 48 L 74 24 L 80 36 L 100 36' },
      { d: 'M 50 4 L 50 24' },                       // wiper stem
      { d: 'M 50 30 L 45.5 21 L 54.5 21 Z', fill: true }, // wiper arrow
    ],
    pins: [{ x: 0, y: 36 }, { x: 100, y: 36 }, { x: 50, y: 0 }],
  },
  'elec-cap-pol': {
    width: 100, height: 40,
    paths: [
      { d: 'M 0 20 L 44 20' },
      { d: 'M 58 20 L 100 20' },
      { d: 'M 44 6 L 44 34' },                       // + plate (straight)
      { d: 'M 60 6 A 20 20 0 0 0 60 34' },           // − plate (curved)
      { d: 'M 30 8 L 38 8 M 34 4 L 34 12' },         // + sign
    ],
    pins: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
  },
  'elec-cell': {
    width: 100, height: 40,
    paths: [
      { d: 'M 0 20 L 46 20' },
      { d: 'M 56 20 L 100 20' },
      { d: 'M 46 6 L 46 34' },                       // long plate (+)
      { d: 'M 56 13 L 56 27', fill: false },         // short plate (−)
      { d: 'M 55 13 L 57 13 L 57 27 L 55 27 Z', fill: true },
      { d: 'M 32 8 L 40 8 M 36 4 L 36 12' },         // + sign
    ],
    pins: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
  },
  'elec-opamp': {
    width: 90, height: 60,
    paths: [
      { d: 'M 20 8 L 20 52 L 70 30 Z' },
      { d: 'M 0 20 L 20 20 M 0 40 L 20 40' },        // inputs
      { d: 'M 70 30 L 90 30' },                      // output
      { d: 'M 25 20 L 31 20' },                      // − (inverting, top)
      { d: 'M 25 40 L 31 40 M 28 37 L 28 43' },      // + (non-inverting)
    ],
    pins: [{ x: 0, y: 20 }, { x: 0, y: 40 }, { x: 90, y: 30 }],
  },
  'elec-crystal': {
    width: 100, height: 40,
    paths: [
      { d: 'M 0 20 L 38 20' },
      { d: 'M 62 20 L 100 20' },
      { d: 'M 38 10 L 38 30 M 62 10 L 62 30' },      // plates
      { d: 'M 44 6 L 56 6 L 56 34 L 44 34 Z' },      // quartz slab
    ],
    pins: [{ x: 0, y: 20 }, { x: 100, y: 20 }],
  },
  'elec-pushbutton': {
    width: 100, height: 44,
    paths: [
      { d: 'M 0 28 L 30 28' },
      { d: 'M 70 28 L 100 28' },
      { d: 'M 27 28 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: true },
      { d: 'M 67 28 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: true },
      { d: 'M 30 16 L 70 16' },                      // bridge
      { d: 'M 50 16 L 50 8 M 42 8 L 58 8' },         // actuator
    ],
    pins: [{ x: 0, y: 28 }, { x: 100, y: 28 }],
  },
  'elec-lamp': {
    width: 60, height: 60,
    paths: [
      { d: 'M 12 30 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0' },
      { d: 'M 17.3 17.3 L 42.7 42.7 M 42.7 17.3 L 17.3 42.7' },
      { d: 'M 0 30 L 12 30 M 48 30 L 60 30' },
    ],
    pins: [{ x: 0, y: 30 }, { x: 60, y: 30 }],
  },
  'elec-ammeter': {
    width: 60, height: 60,
    paths: [
      { d: 'M 12 30 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0' },
      { d: 'M 24 38 L 30 22 L 36 38 M 26.5 32 L 33.5 32' }, // A
      { d: 'M 0 30 L 12 30 M 48 30 L 60 30' },
    ],
    pins: [{ x: 0, y: 30 }, { x: 60, y: 30 }],
  },
  'elec-voltmeter': {
    width: 60, height: 60,
    paths: [
      { d: 'M 12 30 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0' },
      { d: 'M 24 22 L 30 38 L 36 22' },              // V
      { d: 'M 0 30 L 12 30 M 48 30 L 60 30' },
    ],
    pins: [{ x: 0, y: 30 }, { x: 60, y: 30 }],
  },
  'elec-motor': {
    width: 60, height: 60,
    paths: [
      { d: 'M 12 30 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0' },
      { d: 'M 23 38 L 23 22 L 30 32 L 37 22 L 37 38' }, // M
      { d: 'M 0 30 L 12 30 M 48 30 L 60 30' },
    ],
    pins: [{ x: 0, y: 30 }, { x: 60, y: 30 }],
  },
  'elec-ic555': {
    width: 120, height: 140,
    paths: [
      { d: 'M 20 15 L 100 15 L 100 125 L 20 125 Z' },             // body
      { d: 'M 60 0 L 60 15 M 60 125 L 60 140' },                  // VCC / GND stubs
      { d: 'M 0 35 L 20 35 M 0 60 L 20 60 M 0 85 L 20 85 M 0 110 L 20 110' },   // left stubs
      { d: 'M 100 35 L 120 35 M 100 75 L 120 75' },               // right stubs
    ],
    texts: [
      { x: 60, y: 74, text: '555', size: 18, bold: true },
      { x: 60, y: 27, text: 'VCC', size: 8 },
      { x: 60, y: 120, text: 'GND', size: 8 },
      { x: 26, y: 38, text: 'DIS', size: 8, anchor: 'start' },
      { x: 26, y: 63, text: 'THR', size: 8, anchor: 'start' },
      { x: 26, y: 88, text: 'TRG', size: 8, anchor: 'start' },
      { x: 26, y: 113, text: 'CTL', size: 8, anchor: 'start' },
      { x: 94, y: 38, text: 'RST', size: 8, anchor: 'end' },
      { x: 94, y: 78, text: 'OUT', size: 8, anchor: 'end' },
    ],
    // pin0 VCC, pin1 GND, pin2 DIS, pin3 THR, pin4 TRG, pin5 CTL, pin6 RST, pin7 OUT
    pins: [
      { x: 60, y: 0 }, { x: 60, y: 140 },
      { x: 0, y: 35 }, { x: 0, y: 60 }, { x: 0, y: 85 }, { x: 0, y: 110 },
      { x: 120, y: 35 }, { x: 120, y: 75 },
    ],
  },
  // ---- IC family (generated by the ic() factory) ----
  'elec-lm741':   ic('LM741',     { left: ['IN−', 'IN+'], right: ['OUT'], top: ['V+'], bottom: ['V−'], width: 120 }),
  'elec-7805':    ic('7805',      { left: ['IN'], right: ['OUT'], bottom: ['GND'], width: 110 }),
  'elec-lm317':   ic('LM317',     { left: ['IN'], right: ['OUT'], bottom: ['ADJ'], width: 110 }),
  'elec-7400':    ic('7400',      { left: ['1A', '1B', '2A', '2B'], right: ['1Y', '2Y'], top: ['VCC'], bottom: ['GND'] }),
  'elec-7404':    ic('7404',      { left: ['1A', '2A', '3A'], right: ['1Y', '2Y', '3Y'], top: ['VCC'], bottom: ['GND'] }),
  'elec-74hc595': ic('74HC595',   { left: ['DS', 'SHCP', 'STCP', 'OE'], right: ['Q0', 'Q1', 'Q2', 'Q3'], top: ['VCC'], bottom: ['GND'], width: 140 }),
  'elec-l293d':   ic('L293D',     { left: ['EN1', 'IN1', 'IN2'], right: ['OUT1', 'OUT2'], top: ['VS', 'VSS'], bottom: ['GND'], width: 140 }),
  'elec-pc817':   ic('PC817',     { left: ['A', 'K'], right: ['C', 'E'], width: 110 }),
  'elec-mcu':     ic('ATmega328', { left: ['RST', 'XTAL1', 'XTAL2', 'RX', 'TX'], right: ['D2', 'D3', 'A0', 'A1'], top: ['VCC'], bottom: ['GND'], width: 150 }),
  'elec-esp32':   ic('ESP32',     { left: ['EN', 'RX', 'TX', 'IO0'], right: ['IO2', 'IO4', 'IO5'], top: ['3V3'], bottom: ['GND'], width: 140 }),

  // ---- logic gates (ANSI distinctive shapes) ----
  'elec-and': { width: 96, height: 60, paths: [
    { d: 'M 22 10 L 46 10 A 20 20 0 0 1 46 50 L 22 50 Z' },
    { d: 'M 0 22 L 22 22' }, { d: 'M 0 38 L 22 38' }, { d: 'M 66 30 L 96 30' },
  ], pins: [{ x: 0, y: 22 }, { x: 0, y: 38 }, { x: 96, y: 30 }] },
  'elec-or': { width: 96, height: 60, paths: [
    { d: 'M 18 10 Q 40 30 18 50 Q 52 50 70 30 Q 52 10 18 10 Z' },
    { d: 'M 0 22 L 26 22' }, { d: 'M 0 38 L 26 38' }, { d: 'M 70 30 L 96 30' },
  ], pins: [{ x: 0, y: 22 }, { x: 0, y: 38 }, { x: 96, y: 30 }] },
  'elec-not': { width: 96, height: 60, paths: [
    { d: 'M 22 12 L 22 48 L 60 30 Z' },
    { d: 'M 60 30 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0' },
    { d: 'M 0 30 L 22 30' }, { d: 'M 70 30 L 96 30' },
  ], pins: [{ x: 0, y: 30 }, { x: 96, y: 30 }] },
  'elec-nand': { width: 104, height: 60, paths: [
    { d: 'M 22 10 L 46 10 A 20 20 0 0 1 46 50 L 22 50 Z' },
    { d: 'M 66 30 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0' },
    { d: 'M 0 22 L 22 22' }, { d: 'M 0 38 L 22 38' }, { d: 'M 76 30 L 104 30' },
  ], pins: [{ x: 0, y: 22 }, { x: 0, y: 38 }, { x: 104, y: 30 }] },
  'elec-nor': { width: 104, height: 60, paths: [
    { d: 'M 18 10 Q 40 30 18 50 Q 52 50 70 30 Q 52 10 18 10 Z' },
    { d: 'M 70 30 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0' },
    { d: 'M 0 22 L 26 22' }, { d: 'M 0 38 L 26 38' }, { d: 'M 80 30 L 104 30' },
  ], pins: [{ x: 0, y: 22 }, { x: 0, y: 38 }, { x: 104, y: 30 }] },
  'elec-xor': { width: 100, height: 60, paths: [
    { d: 'M 10 10 Q 32 30 10 50' },
    { d: 'M 20 10 Q 42 30 20 50 Q 54 50 72 30 Q 54 10 20 10 Z' },
    { d: 'M 0 22 L 22 22' }, { d: 'M 0 38 L 22 38' }, { d: 'M 72 30 L 100 30' },
  ], pins: [{ x: 0, y: 22 }, { x: 0, y: 38 }, { x: 100, y: 30 }] },
  'elec-xnor': { width: 108, height: 60, paths: [
    { d: 'M 10 10 Q 32 30 10 50' },
    { d: 'M 20 10 Q 42 30 20 50 Q 54 50 72 30 Q 54 10 20 10 Z' },
    { d: 'M 72 30 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0' },
    { d: 'M 0 22 L 22 22' }, { d: 'M 0 38 L 22 38' }, { d: 'M 82 30 L 108 30' },
  ], pins: [{ x: 0, y: 22 }, { x: 0, y: 38 }, { x: 108, y: 30 }] },
  'elec-buffer': { width: 96, height: 60, paths: [
    { d: 'M 22 12 L 22 48 L 64 30 Z' },
    { d: 'M 0 30 L 22 30' }, { d: 'M 64 30 L 96 30' },
  ], pins: [{ x: 0, y: 30 }, { x: 96, y: 30 }] },

  // ---- discretes ----
  'elec-schottky': { width: 100, height: 40, paths: [
    { d: 'M 0 20 L 38 20' }, { d: 'M 62 20 L 100 20' },
    { d: 'M 62 8 L 62 32' }, { d: 'M 56 8 L 62 8 L 62 12' }, { d: 'M 68 32 L 62 32 L 62 28' },
    { d: 'M 38 8 L 38 32 L 62 20 Z', fill: true },
  ], pins: [{ x: 0, y: 20 }, { x: 100, y: 20 }] },
  'elec-photodiode': { width: 100, height: 48, paths: [
    { d: 'M 0 28 L 38 28' }, { d: 'M 62 28 L 100 28' }, { d: 'M 62 16 L 62 40' },
    { d: 'M 38 16 L 38 40 L 62 28 Z', fill: true },
    { d: 'M 30 2 L 22 12 M 22 12 L 27 11 M 22 12 L 23 7' },
    { d: 'M 40 2 L 32 12 M 32 12 L 37 11 M 32 12 L 33 7' },
  ], pins: [{ x: 0, y: 28 }, { x: 100, y: 28 }] },
  'elec-thermistor': { width: 100, height: 44, paths: [
    { d: 'M 0 22 L 20 22' }, { d: 'M 80 22 L 100 22' },
    { d: 'M 20 12 L 80 12 L 80 32 L 20 32 Z' }, { d: 'M 12 38 L 88 6' },
  ], pins: [{ x: 0, y: 22 }, { x: 100, y: 22 }] },
  'elec-varistor': { width: 100, height: 44, paths: [
    { d: 'M 0 22 L 20 22' }, { d: 'M 80 22 L 100 22' },
    { d: 'M 20 12 L 80 12 L 80 32 L 20 32 Z' },
    { d: 'M 14 36 L 78 10 M 78 10 L 71 11 M 78 10 L 76 16' },
  ], pins: [{ x: 0, y: 22 }, { x: 100, y: 22 }] },
  'elec-jfet': { width: 60, height: 60, paths: [
    { d: 'M 0 30 L 20 30' }, { d: 'M 20 30 L 27 26.5 L 27 33.5 Z', fill: true },
    { d: 'M 27 14 L 27 46' }, { d: 'M 27 20 L 46 20 L 46 0' }, { d: 'M 27 40 L 46 40 L 46 60' },
  ], pins: [{ x: 0, y: 30 }, { x: 46, y: 0 }, { x: 46, y: 60 }] },
  'elec-pmos': { width: 60, height: 60, paths: [
    { d: 'M 0 30 L 16 30' }, { d: 'M 16 16 L 16 44' }, { d: 'M 24 12 L 24 48' },
    { d: 'M 24 16 L 46 16 L 46 0' }, { d: 'M 24 44 L 46 44 L 46 60' },
    { d: 'M 24 30 L 30 30' }, { d: 'M 36 30 L 29 26.5 L 29 33.5 Z', fill: true },
  ], pins: [{ x: 0, y: 30 }, { x: 46, y: 0 }, { x: 46, y: 60 }] },
  'elec-battery': { width: 100, height: 44, paths: [
    { d: 'M 0 22 L 30 22' }, { d: 'M 70 22 L 100 22' },
    { d: 'M 30 10 L 30 34' }, { d: 'M 40 15 L 40 29' },
    { d: 'M 50 10 L 50 34' }, { d: 'M 60 15 L 60 29' },
    { d: 'M 20 8 L 28 8 M 24 4 L 24 12' },
  ], pins: [{ x: 0, y: 22 }, { x: 100, y: 22 }] },
  'elec-isrc': { width: 60, height: 60, paths: [
    { d: 'M 12 30 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0' },
    { d: 'M 30 0 L 30 12' }, { d: 'M 30 48 L 30 60' },
    { d: 'M 30 40 L 30 20' }, { d: 'M 30 20 L 26 26 M 30 20 L 34 26' },
  ], pins: [{ x: 30, y: 0 }, { x: 30, y: 60 }] },

  // ---- electromechanical / transducers ----
  'elec-transformer': { width: 68, height: 60, paths: [
    { d: 'M 24 0 L 24 8' }, { d: 'M 24 52 L 24 60' },
    { d: 'M 24 8 A 6 6 0 0 0 24 20 A 6 6 0 0 0 24 32 A 6 6 0 0 0 24 44 A 6 6 0 0 0 24 52' },
    { d: 'M 44 0 L 44 8' }, { d: 'M 44 52 L 44 60' },
    { d: 'M 44 8 A 6 6 0 0 1 44 20 A 6 6 0 0 1 44 32 A 6 6 0 0 1 44 44 A 6 6 0 0 1 44 52' },
    { d: 'M 32 8 L 32 52' }, { d: 'M 36 8 L 36 52' },
  ], pins: [{ x: 24, y: 0 }, { x: 24, y: 60 }, { x: 44, y: 0 }, { x: 44, y: 60 }] },
  'elec-relay': { width: 90, height: 66, paths: [
    { d: 'M 20 20 L 44 20 L 44 46 L 20 46 Z' },
    { d: 'M 22 33 L 27 27 L 31 39 L 35 27 L 39 39 L 42 33' },
    { d: 'M 32 20 L 32 8 L 0 8' }, { d: 'M 32 46 L 32 58 L 0 58' },
    { d: 'M 64 33 L 90 33' }, { d: 'M 64 18 L 90 18' }, { d: 'M 64 48 L 90 48' },
    { d: 'M 64 33 L 66 20' },
    { d: 'M 61 33 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: true },
  ], pins: [{ x: 0, y: 8 }, { x: 0, y: 58 }, { x: 90, y: 33 }, { x: 90, y: 18 }, { x: 90, y: 48 }] },
  'elec-spdt': { width: 100, height: 60, paths: [
    { d: 'M 0 30 L 24 30' }, { d: 'M 21 30 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: true },
    { d: 'M 60 16 L 100 16' }, { d: 'M 57 16 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: true },
    { d: 'M 60 44 L 100 44' }, { d: 'M 57 44 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0', fill: true },
    { d: 'M 24 30 L 58 18' },
  ], pins: [{ x: 0, y: 30 }, { x: 100, y: 16 }, { x: 100, y: 44 }] },
  'elec-speaker': { width: 52, height: 60, paths: [
    { d: 'M 18 22 L 30 22 L 30 38 L 18 38 Z' },
    { d: 'M 30 26 L 48 12 L 48 48 L 30 34 Z' },
    { d: 'M 0 26 L 18 26' }, { d: 'M 0 34 L 18 34' },
  ], pins: [{ x: 0, y: 26 }, { x: 0, y: 34 }] },
  'elec-buzzer': { width: 54, height: 60, paths: [
    { d: 'M 26 12 A 22 22 0 0 1 26 48 L 26 12 Z' },
    { d: 'M 0 22 L 26 22' }, { d: 'M 0 40 L 26 40' },
  ], pins: [{ x: 0, y: 22 }, { x: 0, y: 40 }] },
  'elec-mic': { width: 60, height: 60, paths: [
    { d: 'M 12 30 a 18 18 0 1 0 36 0 a 18 18 0 1 0 -36 0' },
    { d: 'M 12 30 L 48 30' }, { d: 'M 23 46 L 23 60' }, { d: 'M 37 46 L 37 60' },
  ], pins: [{ x: 23, y: 60 }, { x: 37, y: 60 }] },
  'elec-antenna': { width: 44, height: 60, paths: [
    { d: 'M 22 50 L 22 16' }, { d: 'M 22 16 L 8 4' }, { d: 'M 22 16 L 36 4' }, { d: 'M 22 50 L 22 60' },
  ], pins: [{ x: 22, y: 60 }] },

  // ---- connectors / test ----
  'elec-header4': { width: 84, height: 60, paths: [
    { d: 'M 8 18 L 76 18 L 76 38 L 8 38 Z' },
    { d: 'M 16 38 L 16 56' }, { d: 'M 34 38 L 34 56' }, { d: 'M 50 38 L 50 56' }, { d: 'M 68 38 L 68 56' },
    { d: 'M 12 24 L 20 24 L 20 32 L 12 32 Z', fill: true },
    { d: 'M 30 24 L 38 24 L 38 32 L 30 32 Z', fill: true },
    { d: 'M 46 24 L 54 24 L 54 32 L 46 32 Z', fill: true },
    { d: 'M 64 24 L 72 24 L 72 32 L 64 32 Z', fill: true },
  ], pins: [{ x: 16, y: 56 }, { x: 34, y: 56 }, { x: 50, y: 56 }, { x: 68, y: 56 }] },
  'elec-conn2': { width: 80, height: 50, paths: [
    { d: 'M 10 14 L 70 14 L 70 46 L 10 46 Z' },
    { d: 'M 25 30 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0' },
    { d: 'M 43 30 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0' },
    { d: 'M 31 14 L 31 0' }, { d: 'M 49 14 L 49 0' },
  ], pins: [{ x: 31, y: 0 }, { x: 49, y: 0 }] },
  'elec-testpoint': { width: 40, height: 44, paths: [
    { d: 'M 20 22 L 20 44' },
    { d: 'M 14 16 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0', fill: true },
  ], pins: [{ x: 20, y: 44 }] },
};

/**
 * Reference-designator prefix and default value per symbol. Drives automatic
 * refdes numbering (R1, C1, U1…) on drop, the value label under each part, and
 * the BOM / netlist. Symbols that are net markers (ground) use an empty ref so
 * they never get a designator or a BOM line.
 */
export const ELECTRICAL_META: Record<string, { ref: string; value: string }> = {
  'elec-resistor': { ref: 'R', value: '10k' }, 'elec-capacitor': { ref: 'C', value: '100nF' },
  'elec-cap-pol': { ref: 'C', value: '10µF' }, 'elec-inductor': { ref: 'L', value: '10µH' },
  'elec-diode': { ref: 'D', value: '1N4148' }, 'elec-zener': { ref: 'D', value: '5V1' },
  'elec-schottky': { ref: 'D', value: '1N5819' }, 'elec-led': { ref: 'D', value: 'LED' },
  'elec-photodiode': { ref: 'D', value: 'PD' }, 'elec-npn': { ref: 'Q', value: '2N2222' },
  'elec-pnp': { ref: 'Q', value: '2N3906' }, 'elec-nmos': { ref: 'Q', value: 'IRF540' },
  'elec-pmos': { ref: 'Q', value: 'IRF9540' }, 'elec-jfet': { ref: 'Q', value: 'J201' },
  'elec-ground': { ref: '', value: '' }, 'elec-vdc': { ref: 'V', value: '5V' },
  'elec-vac': { ref: 'V', value: '230V' }, 'elec-isrc': { ref: 'I', value: '1mA' },
  'elec-cell': { ref: 'BT', value: '1.5V' }, 'elec-battery': { ref: 'BT', value: '9V' },
  'elec-switch': { ref: 'SW', value: '' }, 'elec-spdt': { ref: 'SW', value: '' },
  'elec-pushbutton': { ref: 'SW', value: '' }, 'elec-relay': { ref: 'K', value: '' },
  'elec-fuse': { ref: 'F', value: '1A' }, 'elec-pot': { ref: 'RV', value: '10k' },
  'elec-thermistor': { ref: 'RT', value: '10k' }, 'elec-varistor': { ref: 'RV', value: '' },
  'elec-crystal': { ref: 'Y', value: '16MHz' }, 'elec-lamp': { ref: 'LA', value: '' },
  'elec-motor': { ref: 'M', value: '' }, 'elec-speaker': { ref: 'LS', value: '8Ω' },
  'elec-buzzer': { ref: 'LS', value: '' }, 'elec-mic': { ref: 'MK', value: '' },
  'elec-antenna': { ref: 'ANT', value: '' }, 'elec-transformer': { ref: 'T', value: '' },
  'elec-ammeter': { ref: 'M', value: 'A' }, 'elec-voltmeter': { ref: 'M', value: 'V' },
  'elec-header4': { ref: 'J', value: '1x4' }, 'elec-conn2': { ref: 'J', value: '2P' },
  'elec-testpoint': { ref: 'TP', value: '' }, 'elec-opamp': { ref: 'U', value: '' },
  'elec-lm741': { ref: 'U', value: 'LM741' }, 'elec-ic555': { ref: 'U', value: 'NE555' },
  'elec-7805': { ref: 'U', value: '7805' }, 'elec-lm317': { ref: 'U', value: 'LM317' },
  'elec-7400': { ref: 'U', value: '7400' }, 'elec-7404': { ref: 'U', value: '7404' },
  'elec-74hc595': { ref: 'U', value: '74HC595' }, 'elec-l293d': { ref: 'U', value: 'L293D' },
  'elec-pc817': { ref: 'U', value: 'PC817' }, 'elec-mcu': { ref: 'U', value: 'ATmega328' },
  'elec-esp32': { ref: 'U', value: 'ESP32' }, 'elec-and': { ref: 'U', value: '7408' },
  'elec-or': { ref: 'U', value: '7432' }, 'elec-not': { ref: 'U', value: '7404' },
  'elec-nand': { ref: 'U', value: '7400' }, 'elec-nor': { ref: 'U', value: '7402' },
  'elec-xor': { ref: 'U', value: '7486' }, 'elec-xnor': { ref: 'U', value: '74266' },
  'elec-buffer': { ref: 'U', value: '7407' },
};

/** Refdes prefix + default value for an electrical symbol (empty for net markers / unknown). */
export function elecMeta(shape: string | undefined): { ref: string; value: string } {
  return (shape && ELECTRICAL_META[shape]) || { ref: '', value: '' };
}

/**
 * Electrical pin names for the hand-drawn symbols, by pin index (symbols built
 * with the ic() factory already carry names from their pin labels). Used by the
 * netlist so connections read "Q1.B" / "U1.THR" instead of bare pin numbers.
 */
const PIN_NAMES: Record<string, string[]> = {
  'elec-diode': ['A', 'K'], 'elec-zener': ['A', 'K'], 'elec-schottky': ['A', 'K'],
  'elec-led': ['A', 'K'], 'elec-photodiode': ['A', 'K'],
  'elec-npn': ['B', 'C', 'E'], 'elec-pnp': ['B', 'C', 'E'],
  'elec-nmos': ['G', 'D', 'S'], 'elec-pmos': ['G', 'D', 'S'], 'elec-jfet': ['G', 'D', 'S'],
  'elec-vdc': ['+', '-'], 'elec-vac': ['~1', '~2'], 'elec-isrc': ['+', '-'],
  'elec-cell': ['+', '-'], 'elec-battery': ['+', '-'], 'elec-cap-pol': ['+', '-'],
  'elec-pot': ['1', '2', 'W'], 'elec-opamp': ['IN-', 'IN+', 'OUT'],
  'elec-relay': ['A1', 'A2', 'COM', 'NO', 'NC'], 'elec-spdt': ['COM', 'A', 'B'],
  'elec-transformer': ['P1', 'P2', 'S1', 'S2'],
  'elec-and': ['A', 'B', 'Y'], 'elec-or': ['A', 'B', 'Y'], 'elec-nand': ['A', 'B', 'Y'],
  'elec-nor': ['A', 'B', 'Y'], 'elec-xor': ['A', 'B', 'Y'], 'elec-xnor': ['A', 'B', 'Y'],
  'elec-not': ['A', 'Y'], 'elec-buffer': ['A', 'Y'],
  'elec-header4': ['1', '2', '3', '4'], 'elec-conn2': ['1', '2'],
  'elec-speaker': ['+', '-'], 'elec-buzzer': ['+', '-'], 'elec-mic': ['+', '-'],
  'elec-ic555': ['VCC', 'GND', 'DIS', 'THR', 'TRG', 'CTL', 'RST', 'OUT'],
};
for (const [k, names] of Object.entries(PIN_NAMES)) {
  const def = ELECTRICAL_SYMBOLS[k];
  if (def && !def.pinNames) def.pinNames = names;
}

/** Netlist pin name for a symbol's pin index: named pin or 1-based number. */
export function elecPinName(shape: string | undefined, index: number): string {
  const names = shape ? ELECTRICAL_SYMBOLS[shape]?.pinNames : undefined;
  return names?.[index] ?? String(index + 1);
}

