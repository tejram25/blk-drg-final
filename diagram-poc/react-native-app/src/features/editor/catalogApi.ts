import { api } from '../../api/client';
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

/** The full palette: functional blocks + basic shapes (from the BFF) plus the
 *  client-side electrical symbols. */
export async function fetchPalette(): Promise<BlockType[]> {
  const server = await api.get<Record<string, string>[]>('/block-types');
  const fromServer: BlockType[] = (server ?? []).map((m) => ({
    key: m.key,
    label: m.label,
    category: m.category ?? 'Blocks',
    color: m.color ?? '#1d4ed8',
    icon: m.icon,
    shape: m.shape,
  }));
  return [...fromServer, ...electricalPalette()];
}
