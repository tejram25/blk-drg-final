import { Graph } from '@antv/x6';

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

  return { width: W, height: H, paths, texts, pins };
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
};

const DEFAULT_STROKE = '#e2e8f0';

/** Register every symbol as an X6 node shape. Call once before creating nodes. */
export function registerElectricalShapes(): void {
  Object.entries(ELECTRICAL_SYMBOLS).forEach(([name, def]) => {
    const markup: any[] = [
      // invisible hit-area / selection body
      { tagName: 'rect', selector: 'body' },
      // wrapper group lets the drawing scale when the node is resized
      {
        tagName: 'g',
        selector: 'wrap',
        children: [
          ...def.paths.map((_, i) => ({
            tagName: 'path',
            selector: `p${i}`,
            groupSelector: 'sym',
          })),
          ...(def.texts ?? []).map((_, i) => ({
            tagName: 'text',
            selector: `t${i}`,
          })),
        ],
      },
      { tagName: 'text', selector: 'label' },
    ];

    const attrs: Record<string, any> = {
      body: { refWidth: '100%', refHeight: '100%', fill: 'transparent', stroke: 'none' },
      sym: {
        stroke: DEFAULT_STROKE,
        strokeWidth: 2,
        fill: 'none',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      },
      label: {
        textAnchor: 'middle',
        textVerticalAnchor: 'top',
        refX: 0.5,
        refY: '100%',
        refY2: 6,
        fontSize: 11,
        fill: '#94a3b8',
      },
    };
    def.paths.forEach((p, i) => {
      attrs[`p${i}`] = { d: p.d, ...(p.fill ? { fill: DEFAULT_STROKE } : {}) };
    });
    (def.texts ?? []).forEach((t, i) => {
      attrs[`t${i}`] = {
        x: t.x, y: t.y, text: t.text,
        fontSize: t.size ?? 8,
        fontWeight: t.bold ? 700 : 400,
        fill: t.bold ? DEFAULT_STROKE : '#94a3b8',
        textAnchor: t.anchor ?? 'middle',
        fontFamily: 'Roboto, sans-serif',
      };
    });

    Graph.registerNode(
      name,
      {
        width: def.width,
        height: def.height,
        markup,
        attrs,
        ports: {
          groups: {
            pin: {
              position: 'absolute',
              attrs: {
                circle: { r: 4, magnet: true, stroke: '#22d3ee', fill: '#0f172a', strokeWidth: 1.5 },
              },
            },
          },
          items: def.pins.map((p, i) => ({
            id: `pin${i}`,
            group: 'pin',
            // percentages so pins track the node when it is resized
            args: { x: `${(p.x / def.width) * 100}%`, y: `${(p.y / def.height) * 100}%` },
          })),
        },
      },
      true, // overwrite on hot-reload
    );
  });
}
