import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

/**
 * Small presentational primitives shared by the workspace pages, kept in one
 * file so the page components stay focused on their own content and every
 * module gets the same page header, panel chrome and stat treatment.
 */

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
