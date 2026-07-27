import { Injectable, signal } from '@angular/core';
import { TemplatePortal } from '@angular/cdk/portal';

/**
 * Bridge between the block-diagram editor and the IDE shell header.
 *
 * The editor owns a full toolbar (File menu, diagram name, AI tools, Insert/View,
 * collaboration…) whose state lives deep inside GojsEditorComponent. Rather than
 * duplicating that into the shell, the editor registers its toolbar as a
 * TemplatePortal here and the shell renders it in its header area.
 *
 * Because only the editor ever attaches — on init — and clears on destroy, the
 * toolbar automatically appears exactly while a block diagram is open and
 * vanishes on any other page.
 */
@Injectable({ providedIn: 'root' })
export class EditorToolbarService {
  private readonly _portal = signal<TemplatePortal | null>(null);
  readonly portal = this._portal.asReadonly();

  attach(portal: TemplatePortal): void { this._portal.set(portal); }
  clear(): void { this._portal.set(null); }
}
