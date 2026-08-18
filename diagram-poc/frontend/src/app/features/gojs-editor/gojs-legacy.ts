/**
 * Mapping for legacy AntV/X6 diagrams (samples, templates, and any diagram saved
 * before the GoJS migration). The old schematic (`elec-*`) and animated (`anim-*`)
 * symbols no longer exist, so they become functional blocks with a fitting icon;
 * old basic shapes map onto native GoJS figures. Used both at load time
 * (convertX6) and to regenerate the bundled sample resources.
 */

/** Legacy basic-shape name → native GoJS figure. */
export const LEGACY_FIGURE: Record<string, string> = {
  rect: 'Rectangle', 'basic-rect': 'Rectangle', 'basic-rectangle': 'Rectangle',
  'basic-rounded': 'RoundedRectangle', 'basic-square': 'Square',
  'basic-ellipse': 'Ellipse', 'basic-circle': 'Circle', 'basic-diamond': 'Diamond',
  'basic-triangle': 'Triangle', 'basic-parallelogram': 'FcParallelogram',
  'basic-hexagon': 'FcHexagon', 'basic-cylinder': 'FcCylinder', 'basic-cloud': 'FcCloud',
  'basic-process': 'Rectangle', 'basic-decision': 'Diamond', 'basic-terminator': 'FcTerminator',
};

/** Legacy electrical / animated component key → Material icon for its block. */
export const LEGACY_ICON: Record<string, string> = {
  // energy / animated
  solar: 'solar_power', 'wind-turbine': 'wind_power', inverter: 'bolt',
  'glow-battery': 'battery_charging_full', battery: 'battery_full', transformer: 'electrical_services',
  pylon: 'electric_bolt', relay: 'toggle_on', conveyor: 'linear_scale',
  'robot-arm': 'precision_manufacturing', 'stack-light': 'traffic', siren: 'notifications_active',
  'ev-charger': 'ev_station', bulb: 'lightbulb', lamp: 'lightbulb', motor: 'rotate_right',
  fan: 'toys', generator: 'power', gear: 'settings', antenna: 'cell_tower', drone: 'flight',
  heater: 'local_fire_department', pump: 'water_drop', tank: 'propane_tank', piston: 'compress',
  // electrical
  cell: 'battery_full', ic555: 'memory', mcu: 'developer_board', esp32: 'wifi',
  resistor: 'horizontal_rule', capacitor: 'battery_std', 'cap-pol': 'battery_std', inductor: 'waves',
  diode: 'change_history', led: 'lightbulb', ground: 'south', switch: 'toggle_off',
  fuse: 'power_input', opamp: 'change_history', crystal: 'graphic_eq', vdc: 'battery_charging_full',
  vac: 'waves', voltmeter: 'speed', ammeter: 'speed', npn: 'memory', pnp: 'memory', nmos: 'memory',
  zener: 'change_history', pot: 'tune', pushbutton: 'radio_button_checked', pc817: 'memory',
  '7805': 'memory', lm317: 'memory', lm741: 'memory', '7400': 'memory', '7404': 'memory',
  '74hc595': 'memory', l293d: 'memory',
};

function pretty(k: string): string {
  return k.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Native GoJS node data for a legacy non-card shape. Basic shapes become native
 * figures; electrical/animated parts become labelled functional blocks. The
 * caller adds `key` and `loc`.
 */
export function legacyNativeNode(shape: string, label: string, w: number, h: number): any {
  const fig = LEGACY_FIGURE[shape];
  if (fig) {
    return { category: 'shape', figure: fig, size: `${w} ${h}`, text: label,
      fill: '#ffffff', stroke: '#334155', labelColor: '#1f2937' };
  }
  const m = /^(elec|anim)-(.+)$/.exec(shape);
  if (m) {
    const energy = m[1] === 'anim';
    return { category: 'block', text: label || pretty(m[2]),
      color: energy ? '#b45309' : '#2563eb', icon: LEGACY_ICON[m[2]] || 'memory',
      subtitle: energy ? 'Energy' : 'Component' };
  }
  return { category: 'block', text: label || pretty(shape) || 'Node',
    color: '#64748b', icon: 'crop_square', subtitle: 'Imported' };
}
