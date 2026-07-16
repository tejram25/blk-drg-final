import { api } from '../../api/client';
import { ANIM_SHAPES } from './animated';
import { BASIC_SHAPES } from './shapes';
import { ELECTRICAL_META, ELECTRICAL_SYMBOLS } from './symbols';

export interface BlockType {
  key: string;
  label: string;
  category: string;
  color: string;
  icon?: string;
  shape?: string;
}

export function isSymbol(b: BlockType): boolean {
  return (b.shape ?? '').startsWith('elec-');
}
export function isShape(b: BlockType): boolean {
  return (b.shape ?? '').startsWith('basic-');
}
export function isAnim(b: BlockType): boolean {
  return (b.shape ?? '').startsWith('anim-');
}

function electricalPalette(): BlockType[] {
  return Object.keys(ELECTRICAL_SYMBOLS).map((shape) => {
    const meta = ELECTRICAL_META[shape];
    const base = shape.replace('elec-', '');
    const pretty = base ? base[0].toUpperCase() + base.slice(1) : shape;
    const value = meta?.value ?? '';
    return {
      key: shape,
      label: value ? `${pretty} (${value})` : pretty,
      category: 'Electrical',
      color: '#e2e8f0',
      shape,
    };
  });
}

const SHAPE_COLORS: Record<string, string> = {
  'basic-rectangle': '#dbeafe', 'basic-rounded': '#e0e7ff', 'basic-square': '#cffafe',
  'basic-circle': '#fce7f3', 'basic-ellipse': '#fae8ff', 'basic-diamond': '#fef3c7',
  'basic-triangle': '#dcfce7', 'basic-trapezoid': '#d1fae5', 'basic-parallelogram': '#e0f2fe',
  'basic-hexagon': '#ede9fe', 'basic-pentagon': '#fee2e2', 'basic-star': '#fef9c3',
  'basic-cylinder': '#e2e8f0', 'basic-cloud': '#eff6ff', 'basic-document': '#f1f5f9',
  'basic-note': '#fefce8', 'basic-callout': '#f0fdfa', 'basic-process': '#e2e8f0', 'basic-step': '#ecfccb',
};

function shapesPalette(): BlockType[] {
  return Object.entries(BASIC_SHAPES).map(([shape, label]) => ({
    key: shape,
    label,
    category: 'Shapes',
    color: SHAPE_COLORS[shape] ?? '#e2e8f0',
    shape,
  }));
}

function animPalette(): BlockType[] {
  return Object.entries(ANIM_SHAPES).map(([shape, label]) => ({
    key: shape,
    label,
    category: 'Animated',
    color: '#fde68a',
    shape,
  }));
}

/** The full palette: functional blocks + basic shapes (from the BFF) plus the
 *  client-side electrical symbols. */
export async function fetchPalette(): Promise<BlockType[]> {
  const server = await api.get<Record<string, string>[]>('/block-types');
  const fromServer: BlockType[] = (server ?? [])
    // Drop any server rows we render locally (basic shapes) to avoid duplicates.
    .filter((m) => !(m.shape ?? '').startsWith('basic-') && !(m.shape ?? '').startsWith('anim-'))
    .map((m) => ({
      key: m.key,
      label: m.label,
      category: m.category ?? 'Blocks',
      color: m.color ?? '#1d4ed8',
      icon: m.icon,
      shape: m.shape,
    }));
  return [...fromServer, ...shapesPalette(), ...animPalette(), ...electricalPalette()];
}
