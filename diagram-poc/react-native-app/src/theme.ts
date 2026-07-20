import { Platform, ViewStyle } from 'react-native';

/**
 * Design tokens.
 *
 * A black navigation chrome (header/toolbars), clean white content on a
 * light-grey page, thin neutral borders, and a signature blue as the primary
 * call-to-action colour; everything else stays neutral so product content leads.
 *
 * `chrome*` tokens style the black bars; `canvas*` tokens style the editor
 * drawing surface (light, engineering-paper look with dark symbols).
 */
export const colors = {
  // Brand palette (primary blue #0084D5; neutral greys; secondary accents mint
  // #47D7AC, gold #FFC845, coral #FF8674). 6-digit hex only.
  primary: '#0084D5',
  primaryDark: '#0066A6',
  primaryLight: '#33A0E3',
  primarySoft: '#E5F4FC',
  gradientFrom: '#0D93E4',
  gradientTo: '#0072B9',
  accent: '#FFC845',

  // Content surfaces — white on light grey, thin neutral borders.
  bg: '#F5F6F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8FA',
  card: '#FFFFFF',
  border: '#E2E5E9',
  borderStrong: '#C9CED4',
  chip: '#EFF1F3',

  // Text — brand black + the template's official greys.
  text: '#0A0A0A',
  subtext: '#666666',
  faint: '#A3A6A3',
  onPrimary: '#FFFFFF',

  // Status
  danger: '#D93838',
  dangerSoft: '#FDECEC',
  success: '#2E9E5B',
  successSoft: '#E7F5EC',
  warning: '#B97609',
  warningSoft: '#FCF3E2',
  info: '#0563C1',

  // Black navigation chrome — headers, toolbars, docks.
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

/**
 * Typography. Headings and CTAs use the bundled display typeface (loaded in
 * App.tsx via expo-font); body copy stays on the system UI font. The custom
 * faces carry their own weight, so those tokens set fontFamily not fontWeight.
 */
export const fonts = {
  regular: 'Display-Regular',
  medium: 'Display-Medium',
  bold: 'Display-Bold',
};

export const font = {
  h1: { fontSize: 28, fontFamily: fonts.bold, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontFamily: fonts.bold, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontFamily: fonts.medium },
  title: { fontSize: 16, fontFamily: fonts.bold },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontFamily: fonts.medium },
  caption: { fontSize: 12, fontWeight: '500' as const },
  overline: { fontSize: 11, fontFamily: fonts.medium, letterSpacing: 0.6 },
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

/** Subtle green emphasis for the few flat-green CTAs (flat, not glowy). */
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
