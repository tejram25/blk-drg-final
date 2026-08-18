import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ws-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="ph">
      <div class="ph-text">
        <h1>{{ title }}</h1>
        @if (subtitle) { <p>{{ subtitle }}</p> }
      </div>
      <div class="ph-actions"><ng-content></ng-content></div>
    </header>
  `,
  styles: [`
    .ph { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 18px; flex-wrap: wrap; }
    .ph-text { min-width: 0; }
    h1 { margin: 0; font-size: 21px; font-weight: 600; letter-spacing: -.01em; color: var(--text); }
    p { margin: 4px 0 0; font-size: 13px; color: var(--muted); max-width: 70ch; }
    .ph-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  `],
})
export class WsPageHeaderComponent {
  @Input() title = '';
  @Input() subtitle = '';
}
