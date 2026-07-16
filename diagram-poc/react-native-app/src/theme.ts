/** Shared palette + spacing, mirroring the web app's dark-canvas aesthetic. */
export const colors = {
  primary: '#1d4ed8',
  accent: '#f5a623',
  // Light
  bg: '#f6f7f9',
  surface: '#ffffff',
  border: '#d2d6dc',
  text: '#1f2937',
  subtext: '#6b7280',
  // Dark canvas (editor)
  canvasBg: '#0e0f11',
  canvasSurface: '#141518',
  canvasGrid: '#22252b',
  canvasText: '#e5e7eb',
  canvasSubtext: '#9aa0a8',
  danger: '#dc2626',
  success: '#15803d',
};

export const radius = { sm: 8, md: 12, lg: 14, pill: 999 };
export const space = (n: number) => n * 4;
