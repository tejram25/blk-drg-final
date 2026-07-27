/**
 * Canvas palette for GoJS.
 *
 * GoJS paints to a <canvas>, so it needs real colour strings — it cannot use
 * `var(--token)`. This resolves the app's CSS custom properties once per theme
 * change, keeping the diagram on the same Arrow palette as the chrome instead
 * of drifting into its own hard-coded colours.
 */

export interface CanvasTheme {
  canvas: string;
  grid: string;
  node: string;
  nodeStroke: string;
  nodeText: string;
  nodeSub: string;
  wire: string;
  wireSig: string;
  sym: string;
  symFill: string;
  accent: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
}

/** Read one CSS custom property off <html>, falling back when unset. */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Resolve the current canvas palette from the active theme's tokens. */
export function readCanvasTheme(): CanvasTheme {
  return {
    canvas: cssVar('--canvas', '#0a0a0a'),
    grid: cssVar('--grid', '#242424'),
    node: cssVar('--node', '#161616'),
    nodeStroke: cssVar('--node-stroke', '#3a3a3a'),
    nodeText: cssVar('--node-text', '#ffffff'),
    nodeSub: cssVar('--node-sub', '#8f8f8f'),
    wire: cssVar('--wire', '#0084d5'),
    wireSig: cssVar('--wire-sig', '#6e6e6e'),
    sym: cssVar('--sym', '#e8e8e8'),
    symFill: cssVar('--sym-fill', '#00131f'),
    accent: cssVar('--accent', '#0084d5'),
    panel: cssVar('--panel', '#121212'),
    border: cssVar('--border', '#2a2a2a'),
    text: cssVar('--text', '#ffffff'),
    muted: cssVar('--muted', '#a8a8a8'),
  };
}

/**
 * Wire colours offered in the picker. Restricted to the Arrow palette plus two
 * neutrals, so a user cannot introduce an off-brand colour into a diagram.
 */
export const WIRE_COLORS = [
  '#0084D5', // Sky Blue — power / default
  '#47D7AC', // Patina Green
  '#FFC845', // Copper Yellow
  '#FF8674', // Solar Orange
  '#8F8F8F', // neutral — signal
  '#C8C8C8', // light neutral
];
