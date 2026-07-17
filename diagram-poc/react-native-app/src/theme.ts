import { Platform, ViewStyle } from 'react-native';

/**
 * Design tokens — "Obsidian × Electric Blue".
 *
 * A black-first premium system: near-black blue-tinted backgrounds (true #000
 * reads flat and cheap; a cold undertone gives OLED depth), layered surfaces
 * that step up in lightness, hairline borders instead of heavy dividers, one
 * electric-blue brand ramp used sparingly for actions, and soft dark
 * "container" tints for status colours. Screens read these tokens (never raw
 * hex) so the look stays consistent across iOS, Android and web.
 */
export const colors = {
  // Brand — electric blue ramp. `primary` stays 6-digit hex (screens derive
  // alpha tints via `primary + '22'`).
  primary: '#3D7BFF',
  primaryDark: '#2557E8',
  primaryLight: '#5E93FF',
  primarySoft: '#101F3D',
  accent: '#F5A623',

  // Surfaces — black first, stepping lighter with elevation.
  bg: '#05080F',
  surface: '#0C121F',
  surfaceAlt: '#111A2C',
  card: '#0C121F',
  border: '#1B2438',
  borderStrong: '#2A3A5C',
  chip: '#141D31',

  // Text
  text: '#F0F4FB',
  subtext: '#8D9AB2',
  faint: '#57647D',
  onPrimary: '#FFFFFF',

  // Status — vivid foregrounds + dark soft containers.
  danger: '#FB4D6D',
  dangerSoft: '#2B1120',
  success: '#22C48B',
  successSoft: '#0A261F',
  warning: '#F5A623',
  warningSoft: '#2A2009',
  info: '#38BDF8',

  // Editor canvas — same family, one step darker than app chrome.
  canvasBg: '#05080F',
  canvasSurface: '#0C121F',
  canvasSurface2: '#141D31',
  canvasGrid: '#0E1524',
  canvasBorder: '#1B2438',
  canvasText: '#E9EFF9',
  canvasSubtext: '#8D9AB2',
  wire: '#38BDF8',
  wireFlow: '#22D3EE',
};

export const radius = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const space = (n: number) => n * 4;

export const font = {
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' as const },
  title: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  overline: { fontSize: 11, fontWeight: '800' as const, letterSpacing: 0.6 },
};

/** Cross-platform elevation. On dark surfaces shadows must be deeper to read. */
export function shadow(level: 1 | 2 | 3 = 1): ViewStyle {
  const cfg = {
    1: { o: 0.35, r: 10, y: 3, e: 3 },
    2: { o: 0.45, r: 20, y: 8, e: 6 },
    3: { o: 0.55, r: 32, y: 14, e: 12 },
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

/** Coloured glow for primary CTAs (FAB, hero buttons) — the premium halo. */
export function glow(color: string = colors.primary): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: `0 6px 24px ${color}59` } as unknown as ViewStyle;
  }
  return {
    shadowColor: color,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  };
}
