import { Injectable, signal } from '@angular/core';
import { TemplatePortal } from '@angular/cdk/portal';

/**
 * Bridge between the block-diagram editor and the IDE shell chrome.
 *
 * The editor owns two pieces of chrome whose state lives deep inside
 * GojsEditorComponent:
 *   - the toolbar (File menu, diagram name, AI tools, Insert/View, collab…),
 *     which the shell renders as a full-width header row, and
 *   - the Components palette, which the shell renders as a tool window behind
 *     a "Components" icon in the activity bar — one left panel at a time,
 *     IntelliJ-style, instead of stacking next to the project tree.
 *
 * Rather than duplicating any of that into the shell, the editor registers both
 * as TemplatePortals here; bindings keep resolving against the editor. Because
 * only the editor attaches — on init — and clears on destroy, both pieces exist
 * exactly while a block diagram is open and vanish on any other page.
 */
@Injectable({ providedIn: 'root' })
export class EditorChromeService {
  private readonly _toolbar = signal<TemplatePortal | null>(null);
  private readonly _palette = signal<TemplatePortal | null>(null);
  readonly toolbar = this._toolbar.asReadonly();
  readonly palette = this._palette.asReadonly();

  attachToolbar(portal: TemplatePortal): void { this._toolbar.set(portal); }
  attachPalette(portal: TemplatePortal): void { this._palette.set(portal); }

  clear(): void {
    this._toolbar.set(null);
    this._palette.set(null);
  }
}
