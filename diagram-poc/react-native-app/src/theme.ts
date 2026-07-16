import { Platform, ViewStyle } from 'react-native';

/**
 * Design tokens. One coherent system: an indigo brand ramp, semantic status
 * colours, layered surfaces, and a separate dark palette for the editor canvas.
 * Screens read these tokens (never raw hex) so the look stays consistent.
 */
export const colors = {
  // Brand
  primary: '#4f46e5',
  primaryDark: '#4338ca',
  primarySoft: '#eef2ff',
  accent: '#f59e0b',

  // Light surfaces
  bg: '#f4f5f9',
  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  card: '#ffffff',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  chip: '#eef2f7',

  // Text
  text: '#0f172a',
  subtext: '#64748b',
  faint: '#94a3b8',
  onPrimary: '#ffffff',

  // Status
  danger: '#e11d48',
  dangerSoft: '#ffe4e6',
  success: '#059669',
  successSoft: '#d1fae5',
  warning: '#d97706',
  warningSoft: '#fef3c7',
  info: '#2563eb',

  // Dark canvas (editor)
  canvasBg: '#0b0d12',
  canvasSurface: '#151922',
  canvasSurface2: '#1c2230',
  canvasGrid: '#1e2430',
  canvasBorder: '#2a3140',
  canvasText: '#e8ecf3',
  canvasSubtext: '#8b93a4',
  wire: '#38bdf8',
  wireFlow: '#22d3ee',
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

/** Cross-platform elevation (native shadow + Android elevation + web boxShadow). */
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
