import { Platform, ViewStyle } from 'react-native';

/**
 * Design tokens — Netflix-discipline dark system.
 *
 * The stage is pure black (#000). Chrome is NEUTRAL dark grey — never tinted —
 * so content (diagrams) owns all the colour. Text is white/grey. Exactly one
 * accent exists: an electric blue→violet ramp, and it is spent ONLY on primary
 * actions and selection. Everything else stays monochrome. That restraint is
 * what reads premium; a tint on every surface reads cheap.
 */
export const colors = {
  // Brand — electric blue→violet. `primary` is the solid mid (selection,
  // active states); gradientFrom/To drive CTA gradients. 6-digit hex only
  // (screens derive alpha tints via `primary + '22'`).
  primary: '#7C5CFC',
  primaryDark: '#5A3EE8',
  primaryLight: '#9F84FF',
  primarySoft: '#1A1530',
  gradientFrom: '#4E5DFB',
  gradientTo: '#9B4DF7',
  accent: '#F5A623',

  // Surfaces — pure black stage, neutral grey elevation steps (no tint).
  bg: '#000000',
  surface: '#141414',
  surfaceAlt: '#1F1F1F',
  card: '#141414',
  border: '#262626',
  borderStrong: '#3A3A3A',
  chip: '#1F1F1F',

  // Text — Netflix greys.
  text: '#FFFFFF',
  subtext: '#B3B3B3',
  faint: '#6E6E6E',
  onPrimary: '#FFFFFF',

  // Status — vivid foregrounds, neutral-dark soft containers.
  danger: '#FF4D5E',
  dangerSoft: '#2A1215',
  success: '#22C48B',
  successSoft: '#0F231C',
  warning: '#F5A623',
  warningSoft: '#272008',
  info: '#38BDF8',

  // Editor canvas — same black stage; grid barely-there neutral.
  canvasBg: '#000000',
  canvasSurface: '#141414',
  canvasSurface2: '#1F1F1F',
  canvasGrid: '#101010',
  canvasBorder: '#262626',
  canvasText: '#EDEDED',
  canvasSubtext: '#9A9A9A',
  wire: '#38BDF8',
  wireFlow: '#22D3EE',
};

export const radius = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const space = (n: number) => n * 4;

export const font = {
  h1: { fontSize: 30, fontWeight: '800' as const, letterSpacing: -0.6 },
  h2: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' as const },
  title: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  overline: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.6 },
};

/** Cross-platform elevation. On pure black, depth comes from deep soft shadow. */
export function shadow(level: 1 | 2 | 3 = 1): ViewStyle {
  const cfg = {
    1: { o: 0.4, r: 10, y: 3, e: 3 },
    2: { o: 0.5, r: 20, y: 8, e: 6 },
    3: { o: 0.6, r: 32, y: 14, e: 12 },
  }[level];
  if (Platform.OS === 'web') {
    return { boxShadow: `0 ${cfg.y}px ${cfg.r}px rgba(0,0,0,${cfg.o})` } as unknown as ViewStyle;
  }
  return {
    shadowColor: '#000000',
    shadowOpacity: cfg.o,
    shadowRadius: cfg.r,
    shadowOffset: { width: 0, height: cfg.y },
    elevation: cfg.e,
  };
}

/** Electric halo for the few gradient CTAs — the only glow in the app. */
export function glow(color: string = colors.primary): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: `0 6px 26px ${color}52` } as unknown as ViewStyle;
  }
  return {
    shadowColor: color,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  };
}
