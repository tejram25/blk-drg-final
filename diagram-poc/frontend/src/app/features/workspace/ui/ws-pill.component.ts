import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Status pill. `tone` drives colour; the label always carries the meaning. */
@Component({
  selector: 'ws-pill',
  standalone: true,
  imports: [CommonModule],
  template: `<span class="pill" [attr.data-tone]="tone"><ng-content></ng-content></span>`,
  styles: [`
    .pill { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .04em;
            text-transform: uppercase; padding: 3px 8px; border-radius: 999px;
            background: var(--panel-2); color: var(--muted); white-space: nowrap; }
    .pill[data-tone='ok'] { background: color-mix(in srgb, var(--ok) 16%, transparent); color: var(--ok); }
    .pill[data-tone='warn'] { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
    .pill[data-tone='risk'] { background: color-mix(in srgb, var(--danger) 16%, transparent); color: var(--danger); }
    .pill[data-tone='accent'] { background: var(--accent-soft); color: var(--accent-ink); }
  `],
})
export class WsPillComponent {
  @Input() tone: '' | 'ok' | 'warn' | 'risk' | 'accent' = '';
}

