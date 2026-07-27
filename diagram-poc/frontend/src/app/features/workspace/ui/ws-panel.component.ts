import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ws-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="pn">
      @if (heading) {
        <div class="pn-head">
          <h2>{{ heading }}</h2>
          <div class="pn-tools"><ng-content select="[panelTools]"></ng-content></div>
        </div>
      }
      <div class="pn-body" [class.flush]="flush"><ng-content></ng-content></div>
    </section>
  `,
  styles: [`
    .pn { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
          display: flex; flex-direction: column; min-width: 0; }
    .pn-head { display: flex; align-items: center; gap: 12px; padding: 12px 15px;
               border-bottom: 1px solid var(--border-soft); }
    h2 { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--text); }
    .pn-tools { margin-left: auto; display: flex; gap: 6px; align-items: center; }
    .pn-body { padding: 14px 15px; min-width: 0; }
    .pn-body.flush { padding: 0; }
  `],
})
export class WsPanelComponent {
  @Input() heading = '';
  @Input() flush = false;
}
