import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ws-stat',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="st">
      <div class="st-top">
        <span class="st-label">{{ label }}</span>
        @if (icon) { <mat-icon [attr.data-tone]="tone">{{ icon }}</mat-icon> }
      </div>
      <div class="st-value">{{ value }}</div>
      @if (hint) { <div class="st-hint" [attr.data-tone]="tone">{{ hint }}</div> }
    </div>
  `,
  styles: [`
    .st { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 13px 15px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .st-top { display: flex; align-items: center; gap: 8px; }
    .st-label { font-size: 10.5px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase;
                color: var(--faint); }
    .st-top mat-icon { margin-left: auto; font-size: 17px; width: 17px; height: 17px; color: var(--faint); }
    .st-value { font-size: 23px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums;
                line-height: 1.1; }
    .st-hint { font-size: 11.5px; color: var(--muted); }
    [data-tone='ok'] { color: var(--ok); }
    [data-tone='warn'] { color: var(--warn); }
    [data-tone='risk'] { color: var(--danger); }
    [data-tone='accent'] { color: var(--accent-ink); }
  `],
})
export class WsStatComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() hint = '';
  @Input() icon = '';
  @Input() tone: '' | 'ok' | 'warn' | 'risk' | 'accent' = '';
}

