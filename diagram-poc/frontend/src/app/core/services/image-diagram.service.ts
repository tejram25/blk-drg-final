import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiBaseUrl } from '../app-config';

/** A block detected in an imported diagram image. x/y are on a 0-1000 × 0-700 grid. */
export interface ExtractedNode {
  id: string;
  label: string;
  /** Smaller role caption under the title (may be empty). */
  sub?: string;
  kind: string;
  /** The box's fill colour from the image (hex/rgb), if any. */
  color?: string;
  x: number;
  y: number;
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

const API = apiBaseUrl();

/**
 * Turns an imported diagram image into an editable block diagram, using a local
 * vision model server-side. The response describes the detected blocks and
 * connections; the editor maps each block to a real palette component.
 */
@Injectable({ providedIn: 'root' })
export class ImageDiagramService {
  constructor(private http: HttpClient) {}

  /** @param image a data URL (`data:image/...;base64,...`). */
  extract(image: string): Observable<ImageDiagramResult> {
    return this.http.post<ImageDiagramResult>(`${API}/image-to-diagram`, { image });
  }
}
