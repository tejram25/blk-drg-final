import { Platform, ViewStyle } from 'react-native';

/**
 * Design tokens — Arrow.com corporate system.
 *
 * Mirrors arrow.com: a black navigation chrome (header/toolbars), clean white
 * content on a light-grey page, thin neutral borders, and Arrow's signature
 * green (Pantone 369 ≈ #64A70B) as the ONE call-to-action colour. Buttons are
 * flat green with white text; links/info lean corporate blue; everything else
 * stays neutral so product content leads — exactly like the site.
 *
 * `chrome*` tokens style the black bars; `canvas*` tokens style the editor
 * drawing surface (light, engineering-paper look with dark symbols).
 */
export const colors = {
  // Brand — arrow.com's corporate blue ramp (site link/CTA blue). 6-digit hex
  // only (screens derive `primary+'22'`).
  primary: '#0068C9',
  primaryDark: '#00509B',
  primaryLight: '#2E8AE0',
  primarySoft: '#E5F1FB',
  gradientFrom: '#0F79D8',
  gradientTo: '#0059AC',
  accent: '#F5A623',

  // Content surfaces — white on light grey, thin neutral borders.
  bg: '#F5F6F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8FA',
  card: '#FFFFFF',
  border: '#E2E5E9',
  borderStrong: '#C9CED4',
  chip: '#EFF1F3',

  // Text
  text: '#15191E',
  subtext: '#58606B',
  faint: '#8B939D',
  onPrimary: '#FFFFFF',

  // Status
  danger: '#D93838',
  dangerSoft: '#FDECEC',
  success: '#2E9E5B',
  successSoft: '#E7F5EC',
  warning: '#B97609',
  warningSoft: '#FCF3E2',
  info: '#0068C9',

  // Black navigation chrome (arrow.com's top bar) — headers, toolbars, docks.
  chrome: '#0B0D0F',
  chromeAlt: '#1D2126',
  chromeBorder: '#2A2F35',
  chromeText: '#FFFFFF',
  chromeSubtext: '#9BA3AC',

  // Editor canvas — light engineering paper, dark symbols.
  canvasBg: '#F7F8F9',
  canvasSurface: '#FFFFFF',
  canvasSurface2: '#EFF1F3',
  canvasGrid: '#E9EBEE',
  canvasBorder: '#D9DDE2',
  canvasText: '#1A2027',
  canvasSubtext: '#5B6470',
  wire: '#0A85C7',
  wireFlow: '#0AA9C2',
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

/** Cross-platform elevation — soft slate shadows for the light theme. */
export function shadow(level: 1 | 2 | 3 = 1): ViewStyle {
  const cfg = {
    1: { o: 0.06, r: 8, y: 2, e: 2 },
    2: { o: 0.1, r: 16, y: 6, e: 5 },
    3: { o: 0.16, r: 28, y: 12, e: 10 },
  }[level];
  if (Platform.OS === 'web') {
    return { boxShadow: `0 ${cfg.y}px ${cfg.r}px rgba(15,23,42,${cfg.o})` } as unknown as ViewStyle;
  }
  return {
    shadowColor: '#0f172a',
    shadowOpacity: cfg.o,
    shadowRadius: cfg.r,
    shadowOffset: { width: 0, height: cfg.y },
    elevation: cfg.e,
  };
}

/** Subtle green emphasis for the few flat-green CTAs (Arrow is flat, not glowy). */
export function glow(color: string = colors.primary): ViewStyle {
  if (Platform.OS === 'web') {
    return { boxShadow: `0 4px 14px ${color}3D` } as unknown as ViewStyle;
  }
  return {
    shadowColor: color,
    shadowOpacity: 0.28,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  };
}
