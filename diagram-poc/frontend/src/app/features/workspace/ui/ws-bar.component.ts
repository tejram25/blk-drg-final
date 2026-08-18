import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Horizontal proportion bar used for category / stage breakdowns. */
@Component({
  selector: 'ws-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="row">
      <span class="lbl">{{ label }}</span>
      <span class="track"><span class="fill" [style.width.%]="pct"></span></span>
      <span class="val">{{ value }}</span>
    </div>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: minmax(90px, 1fr) 2fr auto; gap: 10px;
           align-items: center; padding: 5px 0; font-size: 12.5px; }
    .lbl { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .track { height: 7px; border-radius: 999px; background: var(--panel-2); overflow: hidden; }
    .fill { display: block; height: 100%; border-radius: 999px; background: var(--accent); }
    .val { color: var(--text); font-weight: 600; font-variant-numeric: tabular-nums; }
  `],
})
export class WsBarComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() pct = 0;
}
