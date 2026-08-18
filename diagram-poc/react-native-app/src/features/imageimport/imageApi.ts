import { api } from '../../api/client';
import { DiagramGraph, linkFromRaw, nodeFromRaw } from '../editor/model';

export interface ExtractedNode {
  id: string;
  label: string;
  sub?: string;
  kind: string;
  color?: string;
  x: number; // 0..1000
  y: number; // 0..700
}
export interface ExtractedLink {
  from: string;
  to: string;
  label?: string;
}
export interface ImageDiagramResult {
  title: string;
  nodes: ExtractedNode[];
  links: ExtractedLink[];
  model: string;
  note?: string;
}

/** Turn an imported diagram image into an editable block diagram (vision model server-side). */
export const imageApi = {
  extract: (image: string) => api.post<ImageDiagramResult>('/image-to-diagram', { image }),
};

/** Build a GoJS-shaped graph from the extracted blocks (0-1000 × 0-700 grid). */
export function graphFromImageResult(res: ImageDiagramResult): DiagramGraph {
  const idToKey: Record<string, string> = {};
  const nodes = res.nodes.map((n, i) => {
    const key = `${i + 1}`;
    idToKey[n.id] = key;
    const raw: Record<string, unknown> = {
      key,
      category: 'block',
      text: n.label,
      subtitle: n.sub || n.kind || '',
      kind: n.kind || '',
      color: n.color || '#e2e8f0',
      icon: 'widgets',
      size: '150 64',
      loc: `${Math.round(n.x * 1.1)} ${Math.round(n.y * 1.1)}`,
    };
    return nodeFromRaw(raw);
  });
  const links = res.links
    .filter((l) => idToKey[l.from] && idToKey[l.to])
    .map((l) =>
      linkFromRaw({ category: 'link', from: idToKey[l.from], to: idToKey[l.to], fromPort: '', toPort: '' }),
    );
  return { nodes, links };
}
