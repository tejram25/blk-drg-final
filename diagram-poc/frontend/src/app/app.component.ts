import {
  AfterViewChecked, AfterViewInit, Component, ElementRef, OnDestroy, ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Edge, Graph, Node } from '@antv/x6';
import { Dnd } from '@antv/x6-plugin-dnd';
import { Snapline } from '@antv/x6-plugin-snapline';
import { Selection } from '@antv/x6-plugin-selection';
import { Keyboard } from '@antv/x6-plugin-keyboard';
import { History } from '@antv/x6-plugin-history';
import { Transform } from '@antv/x6-plugin-transform';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { BlockType, DiagramService, DiagramSummary } from './diagram.service';
import { AuthService } from './auth/auth.service';
import { CollabService, ChatMessage } from './collab.service';
import { TranslateService } from './i18n/translate.service';
import { TranslatePipe } from './i18n/translate.pipe';
import { MessageTranslateService } from './i18n/message-translate.service';
import { ELECTRICAL_SYMBOLS, registerElectricalShapes } from './electrical-shapes';
import { ANIMATED_SYMBOLS, partsToSvg, registerAnimatedShapes } from './animated-shapes';
import { BASIC_SHAPES, isBasic, registerBasicShapes } from './basic-shapes';
import { importDrawio, exportDrawio } from './drawio';

/** Node shape for imported images: picture + ports + caption. */
function registerImageNode(): void {
  Graph.registerNode('img-node', {
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'image', selector: 'img' },
      { tagName: 'text', selector: 'label' },
    ],
    attrs: {
      body: { refWidth: '100%', refHeight: '100%', fill: 'transparent', stroke: 'none' },
      img: { refWidth: '100%', refHeight: '100%', preserveAspectRatio: 'xMidYMid meet' },
      label: {
        textAnchor: 'middle', textVerticalAnchor: 'top',
        refX: 0.5, refY: '100%', refY2: 6, fontSize: 11, fill: '#94a3b8',
      },
    },
    ports: {
      groups: {
        top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
        right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
        bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
        left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
      },
      items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
    },
  }, true);
}

/** FAST-style card node for functional blocks: white card, icon badge, title. */
function registerBlockCard(): void {
  Graph.registerNode('block-card', {
    width: 160, height: 56,
    markup: [
      { tagName: 'rect', selector: 'body' },
      { tagName: 'rect', selector: 'badge' },
      { tagName: 'text', selector: 'icon' },
      { tagName: 'text', selector: 'title' },
      { tagName: 'text', selector: 'subtitle' },
    ],
    attrs: {
      body: {
        refWidth: '100%', refHeight: '100%', rx: 10, ry: 10,
        fill: '#ffffff', stroke: '#d2d6dc', strokeWidth: 1.5,
      },
      badge: { x: 10, y: 10, width: 36, height: 36, rx: 8, fill: '#1d4ed8' },
      icon: {
        x: 28, y: 35, text: 'widgets', fontFamily: 'Material Icons',
        fontSize: 20, fill: '#ffffff', textAnchor: 'middle',
      },
      title: {
        x: 56, y: 27, text: '', fontSize: 12.5, fontWeight: 600,
        fill: '#1f2937', textAnchor: 'start', fontFamily: 'Roboto, sans-serif',
      },
      subtitle: {
        x: 56, y: 42, text: 'Module', fontSize: 10,
        fill: '#9aa0a8', textAnchor: 'start', fontFamily: 'Roboto, sans-serif',
      },
    },
    ports: PORT_GROUPS,
  }, true);
}

const PORT_GROUPS = {
  groups: {
    top:    { position: 'top',    attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
    right:  { position: 'right',  attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
    bottom: { position: 'bottom', attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
    left:   { position: 'left',   attrs: { circle: { r: 4, magnet: true, stroke: '#94a3b8', fill: '#0f172a', strokeWidth: 1.5 } } },
  },
  items: [
    { group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' },
  ],
};

@Component({
  selector: 'app-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe],
  template: `
    <div class="layout">
      <!-- Top bar -->
      <header class="topbar">
        <!-- Palette toggle (compact screens) -->
        <span class="panel-toggle">
          <button mat-icon-button [class.on]="paletteOpen" (click)="paletteOpen = !paletteOpen"
                  [matTooltip]="'palette.components' | translate">
            <mat-icon>widgets</mat-icon>
          </button>
        </span>

        <!-- Brand -->
        <div class="brand">
          <span class="brand-mark"><mat-icon>schema</mat-icon></span>
          <span class="brand-name">{{ 'app.brand' | translate }}</span>
        </div>
        <span class="vsep"></span>

        <!-- Document -->
        <input class="doc-name" [(ngModel)]="diagramName"
               [placeholder]="'doc.placeholder' | translate"
               [matTooltip]="'doc.tooltip' | translate" />
        <div class="dd open-dd">
          <button type="button" class="dd-trigger" [class.open]="openMenuOpen"
                  (click)="openMenuOpen = !openMenuOpen" [matTooltip]="'open.tooltip' | translate">
            <span class="dd-val">{{ selectedDiagramId != null ? selectedDiagramName : ('open.saved' | translate) }}</span>
            <svg class="dd-caret" width="11" height="7" viewBox="0 0 12 8"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="dd-menu" *ngIf="openMenuOpen">
            <button type="button" class="dd-item" [class.sel]="selectedDiagramId == null"
                    (click)="selectedDiagramId = null; openMenuOpen = false; load()">{{ 'open.saved' | translate }}</button>
            <button type="button" class="dd-item" *ngFor="let d of savedDiagrams" [class.sel]="selectedDiagramId === d.id"
                    (click)="selectedDiagramId = d.id; openMenuOpen = false; load()">{{ d.name }}</button>
          </div>
        </div>
        <button mat-stroked-button (click)="newDiagram()"><span>{{ 'btn.new' | translate }}</span></button>
        <button mat-flat-button (click)="save()"><span>{{ 'btn.save' | translate }}</span></button>

        <span class="spacer"></span>

        <!-- History -->
        <div class="tool-group">
          <button mat-icon-button [matTooltip]="'tip.undo' | translate" (click)="undo()"><mat-icon>undo</mat-icon></button>
          <button mat-icon-button [matTooltip]="'tip.redo' | translate" (click)="redo()"><mat-icon>redo</mat-icon></button>
        </div>
        <span class="vsep"></span>

        <!-- View & insert -->
        <div class="tool-group">
          <button mat-icon-button [matTooltip]="lightCanvas ? 'Dark canvas' : 'White canvas'"
                  (click)="toggleCanvasTheme()">
            <mat-icon>{{ lightCanvas ? 'dark_mode' : 'light_mode' }}</mat-icon>
          </button>
          <button mat-icon-button [matTooltip]="'tip.addImage' | translate" (click)="fileInput.click()">
            <mat-icon>image</mat-icon>
          </button>
          <input #fileInput type="file" accept="image/*" hidden (change)="onImageSelected($event)" />
          <input #jsonInput type="file" accept=".json,application/json" hidden
                 (change)="onJsonSelected($event)" />
          <input #drawioInput type="file" accept=".drawio,.xml,application/xml,text/xml" hidden
                 (change)="onDrawioSelected($event)" />
          <!-- Import (JSON / draw.io) -->
          <span class="menu-wrap">
            <button type="button" mat-icon-button [class.on]="importMenuOpen"
                    (click)="importMenuOpen = !importMenuOpen" matTooltip="Import">
              <mat-icon>upload</mat-icon>
            </button>
            <div class="dropdown-menu" *ngIf="importMenuOpen">
              <button type="button" class="menu-item" (click)="jsonInput.click(); importMenuOpen = false">
                <mat-icon>data_object</mat-icon><span>{{ 'tip.importJson' | translate }}</span>
              </button>
              <button type="button" class="menu-item" (click)="drawioInput.click(); importMenuOpen = false">
                <mat-icon>account_tree</mat-icon><span>Import from draw.io</span>
              </button>
            </div>
          </span>
          <!-- Export (JSON / draw.io) -->
          <span class="menu-wrap">
            <button type="button" mat-icon-button [class.on]="exportMenuOpen"
                    (click)="exportMenuOpen = !exportMenuOpen" matTooltip="Export">
              <mat-icon>download</mat-icon>
            </button>
            <div class="dropdown-menu" *ngIf="exportMenuOpen">
              <button type="button" class="menu-item" (click)="exportJson(); exportMenuOpen = false">
                <mat-icon>data_object</mat-icon><span>{{ 'tip.exportJson' | translate }}</span>
              </button>
              <button type="button" class="menu-item" (click)="exportDrawioFile(); exportMenuOpen = false">
                <mat-icon>account_tree</mat-icon><span>Export to draw.io</span>
              </button>
            </div>
          </span>
        </div>
        <span class="vsep"></span>

        <!-- Properties toggle (compact screens) -->
        <span class="panel-toggle" *ngIf="selectedNode">
          <button mat-icon-button [class.on]="propsOpen" (click)="propsOpen = !propsOpen"
                  [matTooltip]="'props.title' | translate">
            <mat-icon>tune</mat-icon>
          </button>
        </span>

        <!-- Presence (automatic, per file) -->
        <div class="menu-wrap" *ngIf="collab.active">
          <button type="button" mat-stroked-button class="presence-btn"
                  (click)="presenceOpen = !presenceOpen"
                  [matTooltip]="collab.peers + ' viewing this file'">
            <mat-icon>group</mat-icon>
            <span>{{ collab.peers }}</span>
          </button>

          <div class="dropdown-menu presence-menu" *ngIf="presenceOpen">
            <div class="roster-title">Viewing this file ({{ collab.participants.length }})</div>
            <div class="roster-row" *ngFor="let p of collab.participants; trackBy: participantTrack">
              <span class="roster-dot" [style.background]="p.color"></span>
              <span class="roster-name">{{ p.name }}</span>
              <span class="roster-tag you" *ngIf="p.isSelf">You</span>
            </div>
          </div>
        </div>

        <!-- Chat toggle (only during a session) -->
        <button class="chat-toggle" mat-stroked-button *ngIf="collab.active"
                [class.chat-on]="chatOpen" (click)="toggleChat()"
                [matTooltip]="'chat.tip' | translate">
          <span>{{ 'chat.label' | translate }}</span>
          <span class="chat-badge" *ngIf="unreadChat > 0">{{ unreadChat }}</span>
        </button>

        <!-- Language switcher -->
        <div class="lang-wrap">
          <button mat-stroked-button (click)="langMenuOpen = !langMenuOpen"
                  [matTooltip]="'lang.tooltip' | translate">
            <mat-icon>language</mat-icon>
            {{ currentLangLabel }}
            <mat-icon class="lang-caret">arrow_drop_down</mat-icon>
          </button>
          <div class="lang-menu" *ngIf="langMenuOpen">
            <button *ngFor="let l of languages" class="lang-item"
                    [class.active]="l.code === currentLang" (click)="switchLang(l.code)">
              <span>{{ l.label }}</span>
              <mat-icon *ngIf="l.code === currentLang">check</mat-icon>
            </button>
          </div>
        </div>

        <!-- Signed-in user + account menu -->
        <div class="menu-wrap user-wrap" *ngIf="auth.user() as u">
          <button type="button" class="user-chip" [class.on]="accountMenuOpen"
                  (click)="accountMenuOpen = !accountMenuOpen" [matTooltip]="u.name || u.email">
            <mat-icon>account_circle</mat-icon>
            <span class="user-name">{{ u.name || u.email }}</span>
            <mat-icon class="caret">arrow_drop_down</mat-icon>
          </button>
          <div class="dropdown-menu account-menu" *ngIf="accountMenuOpen">
            <div class="account-head">
              <mat-icon>account_circle</mat-icon>
              <div class="account-id">
                <span class="account-name">{{ u.name || u.email }}</span>
                <span class="account-email" *ngIf="u.name">{{ u.email }}</span>
              </div>
            </div>
            <div class="menu-sep"></div>
            <button type="button" class="menu-item" (click)="accountMenuOpen = false; logout()">
              <mat-icon>logout</mat-icon><span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div class="body">
        <!-- Palette -->
        <aside class="palette" [class.open]="paletteOpen">
          <div class="panel-title">{{ 'palette.components' | translate }}</div>
          <div class="search-wrap">
            <mat-icon>search</mat-icon>
            <input class="search" [(ngModel)]="paletteQuery" [placeholder]="'palette.search' | translate" />
          </div>

          <div class="dd cat-dd" *ngIf="!paletteQuery">
            <button type="button" class="dd-trigger" [class.open]="catMenuOpen" (click)="catMenuOpen = !catMenuOpen">
              <span class="dd-val">{{ i18n.td(activeCategory) }}</span>
              <svg class="dd-caret" width="11" height="7" viewBox="0 0 12 8"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <div class="dd-menu" *ngIf="catMenuOpen">
              <button type="button" class="dd-item" *ngFor="let cat of categories" [class.sel]="cat === activeCategory"
                      (click)="activeCategory = cat; catMenuOpen = false">{{ i18n.td(cat) }}</button>
            </div>
          </div>

          <div class="palette-grid">
            <ng-container *ngFor="let b of visibleItems">
              <!-- Schematic symbol item -->
              <div *ngIf="b.shape && isElectrical(b.shape)" class="symbol-item" (mousedown)="startDrag(b, $event)">
                <svg [attr.viewBox]="symbolViewBox(b.shape)" width="62"
                     [attr.height]="isIc(b.shape) ? 40 : 26">
                  <path *ngFor="let p of symbolPaths(b.shape)"
                        [attr.d]="p.d"
                        [attr.fill]="p.fill ? '#e2e8f0' : 'none'"
                        stroke="#e2e8f0" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round" />
                  <text *ngFor="let t of symbolTitleTexts(b.shape)"
                        [attr.x]="t.x" [attr.y]="t.y" text-anchor="middle"
                        fill="#e2e8f0" font-weight="700"
                        [attr.font-size]="t.size ? t.size * 1.6 : 16">{{ t.text }}</text>
                </svg>
                <span>{{ i18n.td(b.label) }}</span>
              </div>
              <!-- Basic geometric shape item -->
              <div *ngIf="b.shape && isBasic(b.shape)" class="symbol-item" (mousedown)="startDrag(b, $event)">
                <svg viewBox="0 0 60 40" width="62" height="40"
                     fill="none" stroke="#e2e8f0" stroke-width="2"
                     stroke-linejoin="round" [innerHTML]="basicPreview(b.shape)"></svg>
                <span>{{ i18n.td(b.label) }}</span>
              </div>
              <!-- Animated component item (live preview) -->
              <div *ngIf="b.shape && !isElectrical(b.shape) && !isBasic(b.shape)" class="symbol-item" (mousedown)="startDrag(b, $event)">
                <svg [attr.viewBox]="symbolViewBox(b.shape)" width="62" height="40"
                     [innerHTML]="animatedPreview(b.shape)"></svg>
                <span>{{ i18n.td(b.label) }}</span>
              </div>
              <!-- Card block item -->
              <div *ngIf="!b.shape" class="block-chip" (mousedown)="startDrag(b, $event)">
                <span class="chip-badge" [style.background]="b.color">
                  <span class="material-icons">{{ b.icon || 'widgets' }}</span>
                </span>
                <span class="chip-label">{{ i18n.td(b.label) }}</span>
              </div>
            </ng-container>
            <p class="empty" *ngIf="paletteQuery && visibleItems.length === 0">
              <span>{{ 'palette.noMatch' | translate }}</span> "{{ paletteQuery }}"
            </p>
          </div>

          <p class="hint">{{ 'palette.hint' | translate }}</p>
        </aside>

        <!-- Canvas -->
        <main class="canvas-wrap">
          <div #canvas class="canvas"
               (dragover)="$event.preventDefault()"
               (drop)="onCanvasDrop($event)"
               (mousemove)="onCanvasMouseMove($event)"
               (mouseleave)="onCanvasMouseLeave()"></div>

          <!-- Live cursors of other session members -->
          <div class="remote-cursor" *ngFor="let c of remoteCursors(); trackBy: cursorTrack"
               [style.transform]="'translate3d(' + c.sx + 'px,' + c.sy + 'px,0)'">
            <svg width="16" height="20" viewBox="0 0 16 20">
              <path d="M 1 1 L 1 15 L 4.8 11.8 L 7.4 18.4 L 10.2 17.2 L 7.6 10.8 L 12.6 10.4 Z"
                    [attr.fill]="c.color" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
            </svg>
            <span class="cursor-name" [style.background]="c.color">{{ c.name }}</span>
          </div>

          <!-- Zoom controls -->
          <div class="zoom-dock">
            <button mat-icon-button [matTooltip]="'zoom.out' | translate" (click)="zoomOut()">
              <mat-icon>remove</mat-icon>
            </button>
            <span class="zoom-pct" [matTooltip]="'zoom.reset' | translate" (click)="zoomReset()">{{ zoomPct }}%</span>
            <button mat-icon-button [matTooltip]="'zoom.in' | translate" (click)="zoomIn()">
              <mat-icon>add</mat-icon>
            </button>
            <button mat-icon-button [matTooltip]="'zoom.fit' | translate" (click)="zoomFit()">
              <mat-icon>fit_screen</mat-icon>
            </button>
          </div>

          <!-- Click-away backdrop for the wire popovers -->
          <div class="dock-backdrop" *ngIf="wirePop" (click)="wirePop = null"></div>

          <!-- Wire dock: compact; each trigger opens a popover to choose from -->
          <div class="wire-dock">
            <span class="dock-label">
              <ng-container *ngIf="selectedEdge">{{ 'wire.selected' | translate }}</ng-container>
              <ng-container *ngIf="!selectedEdge">{{ 'wire.label' | translate }}</ng-container>
            </span>

            <!-- color trigger -->
            <button class="dock-trigger" [matTooltip]="'wire.tipColor' | translate"
                    [class.active]="wirePop === 'color'" (click)="toggleWirePop('color')">
              <span class="trigger-swatch" [style.background]="wireColor"></span>
              <mat-icon class="trigger-caret">expand_more</mat-icon>
            </button>

            <!-- style trigger -->
            <button class="dock-trigger" [matTooltip]="'wire.tipStyle' | translate"
                    [class.active]="wirePop === 'style'" (click)="toggleWirePop('style')">
              <svg viewBox="0 0 36 12" width="26" height="9">
                <path d="M 1 6 H 35" stroke="currentColor" stroke-width="2"
                      [attr.stroke-dasharray]="wireStyle === 'solid' ? null : '5 3'"
                      [class.dock-flow]="wireStyle === 'flow'"/>
              </svg>
              <mat-icon class="trigger-caret">expand_more</mat-icon>
            </button>

            <ng-container *ngIf="selectedEdge">
              <span class="dock-sep"></span>
              <button mat-icon-button [matTooltip]="'wire.delete' | translate" class="dock-del" (click)="deleteSelectedEdge()">
                <mat-icon>delete</mat-icon>
              </button>
            </ng-container>

            <!-- Color popover -->
            <div class="dock-pop" *ngIf="wirePop === 'color'">
              <span class="pop-title">{{ 'wire.popColor' | translate }}</span>
              <div class="swatches">
                <button *ngFor="let c of wireColors" class="swatch" [style.background]="c"
                        [class.active]="wireColor === c" (click)="setWireColor(c); wirePop = null"></button>
                <input type="color" class="swatch custom" matTooltip="Custom color"
                       [ngModel]="wireColor" (ngModelChange)="setWireColor($event)" />
              </div>
            </div>

            <!-- Style / width / routing popover -->
            <div class="dock-pop" *ngIf="wirePop === 'style'">
              <div class="pop-section">
                <span class="pop-title">{{ 'wire.popStyle' | translate }}</span>
                <div class="dock-group">
                  <button class="dock-btn" [matTooltip]="'wire.flow' | translate"
                          [class.active]="wireStyle === 'flow'" (click)="setWireStyle('flow')">
                    <svg viewBox="0 0 36 12" width="30" height="10"><path d="M 1 6 H 35" stroke="currentColor" stroke-width="2" stroke-dasharray="5 3" class="dock-flow"/></svg>
                  </button>
                  <button class="dock-btn" [matTooltip]="'wire.dashed' | translate"
                          [class.active]="wireStyle === 'dashed'" (click)="setWireStyle('dashed')">
                    <svg viewBox="0 0 36 12" width="30" height="10"><path d="M 1 6 H 35" stroke="currentColor" stroke-width="2" stroke-dasharray="5 3"/></svg>
                  </button>
                  <button class="dock-btn" [matTooltip]="'wire.solid' | translate"
                          [class.active]="wireStyle === 'solid'" (click)="setWireStyle('solid')">
                    <svg viewBox="0 0 36 12" width="30" height="10"><path d="M 1 6 H 35" stroke="currentColor" stroke-width="2"/></svg>
                  </button>
                </div>
              </div>

              <div class="pop-section">
                <span class="pop-title">{{ 'wire.popWidth' | translate }}</span>
                <div class="dock-group">
                  <button class="dock-btn" [matTooltip]="'wire.thin' | translate" [class.active]="wireWidth === 1.5" (click)="setWireWidth(1.5)">
                    <svg viewBox="0 0 24 12" width="20" height="10"><path d="M 2 6 H 22" stroke="currentColor" stroke-width="1.2"/></svg>
                  </button>
                  <button class="dock-btn" [matTooltip]="'wire.medium' | translate" [class.active]="wireWidth === 2" (click)="setWireWidth(2)">
                    <svg viewBox="0 0 24 12" width="20" height="10"><path d="M 2 6 H 22" stroke="currentColor" stroke-width="2.4"/></svg>
                  </button>
                  <button class="dock-btn" [matTooltip]="'wire.thick' | translate" [class.active]="wireWidth === 3" (click)="setWireWidth(3)">
                    <svg viewBox="0 0 24 12" width="20" height="10"><path d="M 2 6 H 22" stroke="currentColor" stroke-width="4"/></svg>
                  </button>
                </div>
              </div>

              <div class="pop-section">
                <span class="pop-title">{{ 'wire.popRouting' | translate }}</span>
                <div class="dock-group">
                  <button class="dock-btn" [matTooltip]="'wire.rightAngle' | translate" [class.active]="wireRouter === 'manhattan'" (click)="setWireRouter('manhattan')">
                    <svg viewBox="0 0 24 16" width="20" height="13"><path d="M 2 14 H 12 V 2 H 22" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                  </button>
                  <button class="dock-btn" [matTooltip]="'wire.straight' | translate" [class.active]="wireRouter === 'normal'" (click)="setWireRouter('normal')">
                    <svg viewBox="0 0 24 16" width="20" height="13"><path d="M 2 14 L 22 2" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                  </button>
                  <button class="dock-btn" [matTooltip]="'wire.curved' | translate" [class.active]="wireRouter === 'smooth'" (click)="setWireRouter('smooth')">
                    <svg viewBox="0 0 24 16" width="20" height="13"><path d="M 2 14 C 10 14 14 2 22 2" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </main>

        <!-- Property panel -->
        <aside class="props" *ngIf="selectedNode" [class.open]="propsOpen">
          <h3>{{ 'props.title' | translate }}</h3>
          <div class="prop-type">
            <mat-icon>category</mat-icon>{{ nodeTypeName }}
          </div>

          <label><span>{{ 'props.name' | translate }}</span>
            <input [ngModel]="selectedNode.attr(labelAttrPath)"
                   (ngModelChange)="selectedNode.attr(labelAttrPath, $event)" />
          </label>
          <label><span>{{ 'props.partNumber' | translate }}</span>
            <input [ngModel]="dataField('partNumber')"
                   (ngModelChange)="setDataField('partNumber', $event)"
                   [placeholder]="'props.partPlaceholder' | translate" />
          </label>
          <label><span>{{ 'props.category' | translate }}</span>
            <input [ngModel]="dataField('category') || defaultCategory"
                   (ngModelChange)="setDataField('category', $event)" />
          </label>
          <label><span>{{ 'props.notes' | translate }}</span>
            <textarea rows="2" [ngModel]="dataField('notes')"
                      (ngModelChange)="setDataField('notes', $event)"
                      [placeholder]="'props.notesPlaceholder' | translate"></textarea>
          </label>

          <div class="prop-section">{{ 'props.appearance' | translate }}</div>
          <ng-container *ngIf="!isSymbol">
            <div class="prop-row">
              <label><span>{{ 'props.fill' | translate }}</span>
                <input type="color"
                       [ngModel]="selectedNode.attr('body/fill')"
                       (ngModelChange)="selectedNode.attr('body/fill', $event)" />
              </label>
              <label><span>{{ 'props.border' | translate }}</span>
                <input type="color"
                       [ngModel]="selectedNode.attr('body/stroke')"
                       (ngModelChange)="selectedNode.attr('body/stroke', $event)" />
              </label>
            </div>
            <label *ngIf="isCard"><span>{{ 'props.badgeColor' | translate }}</span>
              <input type="color"
                     [ngModel]="selectedNode.attr('badge/fill')"
                     (ngModelChange)="selectedNode.attr('badge/fill', $event)" />
            </label>
          </ng-container>
          <label *ngIf="isSymbol"><span>{{ 'props.symbolColor' | translate }}</span>
            <input type="color"
                   [ngModel]="selectedNode.attr(colorAttrPath)"
                   (ngModelChange)="setNodeColor($event)" />
          </label>

          <button mat-stroked-button color="warn" (click)="deleteSelected()">
            <mat-icon>delete</mat-icon><span>{{ 'props.delete' | translate }}</span>
          </button>
        </aside>

        <!-- Session chat: right-side dock (Teams-style), toggled from the header -->
        <aside class="chat-dock" *ngIf="collab.active && chatOpen">
          <div class="chat-head">
            <span class="chat-title">{{ 'chat.session' | translate }}</span>
            <span class="chat-count">{{ collab.participants.length }} <span>{{ 'common.online' | translate }}</span></span>
            <button class="chat-close" [matTooltip]="'chat.close' | translate" (click)="toggleChat()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="chat-log" #chatLog>
            <p class="chat-empty" *ngIf="collab.messages.length === 0">{{ 'chat.empty' | translate }}</p>
            <div class="chat-msg" *ngFor="let m of collab.messages; trackBy: chatTrack"
                 [class.mine]="m.isSelf">
              <div class="chat-meta" *ngIf="!m.isSelf">
                <span class="roster-dot" [style.background]="m.color"></span>
                <span class="chat-from">{{ m.name }}</span>
                <span class="chat-time">{{ fmtTime(m.ts) }}</span>
              </div>
              <div class="chat-bubble">{{ msgState(m.id)?.state === 'done' && !msgState(m.id)?.showOriginal ? msgState(m.id)!.text : m.text }}</div>
              <div class="chat-actions" *ngIf="!m.isSelf" [ngSwitch]="msgState(m.id)?.state">
                <span *ngSwitchCase="'loading'" class="chat-act muted">{{ 'chat.translating' | translate }}</span>
                <span *ngSwitchCase="'same'" class="chat-act muted">{{ 'chat.sameLang' | translate }}</span>
                <span *ngSwitchCase="'error'" class="chat-act muted">{{ 'chat.translateError' | translate }}</span>
                <span *ngSwitchCase="'unsupported'" class="chat-act muted">{{ 'chat.translateUnsupported' | translate }}</span>
                <ng-container *ngSwitchCase="'done'">
                  <button class="chat-act" *ngIf="!msgState(m.id)?.showOriginal" (click)="revertMessage(m)">{{ 'chat.showOriginal' | translate }}</button>
                  <button class="chat-act" *ngIf="msgState(m.id)?.showOriginal" (click)="translateMessage(m)">{{ 'chat.showTranslation' | translate }}</button>
                </ng-container>
                <button *ngSwitchDefault class="chat-act" (click)="translateMessage(m)">{{ 'chat.translate' | translate }}</button>
              </div>
              <span class="chat-time" *ngIf="m.isSelf">{{ fmtTime(m.ts) }}</span>
            </div>
          </div>

          <div class="chat-input">
            <input [(ngModel)]="chatDraft" [placeholder]="'chat.placeholder' | translate" maxlength="500"
                   (keyup.enter)="sendChat()" />
            <button mat-icon-button [matTooltip]="'chat.send' | translate" (click)="sendChat()" [disabled]="!chatDraft.trim()">
              <mat-icon>send</mat-icon>
            </button>
          </div>
        </aside>
      </div>

      <!-- Status bar -->
      <footer class="statusbar">
        <span class="status-dot" [class.busy]="!!status"></span>
        <span class="status-text" *ngIf="status">{{ status }}</span>
        <span class="status-text" *ngIf="!status">{{ 'status.ready' | translate }}</span>
        <span class="spacer"></span>
        <span class="kbd-hints">{{ 'footer.hints' | translate }}</span>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      --bg: #141518; --bg-deep: #0e0f11;
      --panel: #1d1e23; --panel-2: #26272d;
      --border: #34353c; --border-soft: #2b2c32;
      --text: #ececef; --muted: #9b9ca4; --faint: #6b6c74;
      --accent: #f5a623; --accent-soft: #f5a62333;
      --brand: #a3e635;
      --ok: #22c55e; --danger: #ef4444;
    }
    .layout {
      display: flex; flex-direction: column; height: 100vh;
      background: var(--bg); color: var(--text);
      font-family: Roboto, 'Segoe UI', system-ui, sans-serif;
    }

    /* ---- Top bar ---- */
    .topbar {
      display: flex; align-items: center; flex-wrap: wrap;
      gap: 6px; row-gap: 6px;
      min-height: 48px; flex-shrink: 0; padding: 5px 10px;
      background: var(--panel);
      border-bottom: 1px solid var(--border-soft);
      box-shadow: 0 1px 0 rgba(0,0,0,.3);
    }
    .brand { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
    .brand-mark {
      width: 32px; height: 32px; border-radius: 8px;
      display: inline-flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, var(--accent), #d97706);
      box-shadow: 0 2px 8px rgba(245, 166, 35, .3);
    }
    .brand-mark mat-icon { color: #1a1303; font-size: 20px; width: 20px; height: 20px; }
    .brand-name { font-size: 15px; font-weight: 600; letter-spacing: -.01em; white-space: nowrap; }
    .vsep { width: 1px; height: 20px; background: var(--border-soft); flex-shrink: 0; }
    .spacer { flex: 1; }
    .tool-group { display: flex; align-items: center; gap: 2px; }

    input, select {
      background: var(--bg-deep); color: var(--text); border: 1px solid var(--border);
      border-radius: 8px; padding: 0 12px; height: 36px; font-size: 13px;
      font-family: inherit; outline: none;
      transition: border-color .15s, box-shadow .15s;
    }
    input:focus, select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
    }
    /* Modern native dropdowns: drop the OS look, add a custom chevron + dark menu. */
    select {
      appearance: none; -webkit-appearance: none; cursor: pointer;
      padding-right: 32px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none' stroke='%239aa0a8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 11px center;
    }
    select:hover { border-color: #44454d; background-color: var(--panel-2); }
    select:focus {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none' stroke='%23f5a623' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E");
    }
    select option { background: var(--panel); color: var(--text); }
    input::placeholder { color: var(--faint); }
    .doc-name { width: 150px; min-width: 0; height: 32px; font-weight: 500; background: transparent; }
    .doc-name:hover { background: var(--bg-deep); }
    .open-dd { width: 140px; flex-shrink: 1; min-width: 100px; }

    /* Header controls run a touch shorter than the 36px form default so the bar
       stays compact and everything fits one row on typical desktop widths. */
    .topbar .mdc-button { height: 32px; min-width: 0; padding: 0 12px; }
    .topbar .dd-trigger { height: 32px; }
    .mdc-button mat-icon { margin-right: 4px; }
    button.collab-on {
      --mdc-outlined-button-outline-color: var(--ok);
      --mdc-outlined-button-label-text-color: #86efac;
    }

    /* ---- Collab panel ---- */
    .collab-wrap { position: relative; }
    .collab-panel {
      position: absolute; top: calc(100% + 6px); right: 0; z-index: 50; width: 260px;
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      padding: 14px; box-shadow: 0 12px 34px rgba(0,0,0,.5);
    }
    .collab-panel h4 { margin: 0 0 10px; font-size: 13px; color: var(--text); }
    .collab-panel button[mat-flat-button],
    .collab-panel button[mat-stroked-button] { width: 100%; margin-top: 4px; }
    .collab-panel .join-row button[mat-stroked-button] { width: auto; margin-top: 0; }
    .divider {
      display: flex; align-items: center; gap: 8px; margin: 12px 0;
      color: var(--faint); font-size: 11px;
    }
    .divider::before, .divider::after { content: ''; flex: 1; border-top: 1px solid var(--border-soft); }
    .join-row { display: flex; gap: 6px; }
    .join-row input {
      flex: 1; min-width: 0; width: 0; box-sizing: border-box;
      text-align: center; letter-spacing: 3px; font-size: 15px;
    }
    .join-row button { flex-shrink: 0; }
    .code-display {
      text-align: center; font-size: 26px; font-weight: 700; letter-spacing: 6px;
      color: #86efac; background: var(--bg-deep); border: 1px dashed var(--ok);
      border-radius: 8px; padding: 10px 0; margin-bottom: 8px; user-select: all;
    }
    .panel-hint { font-size: 11px; color: var(--muted); line-height: 1.5; margin: 10px 0; }
    .panel-error { font-size: 12px; color: #fca5a5; margin: 8px 0 0; }

    /* ---- Login (name entry) ---- */
    .field-label { display: block; font-size: 11px; color: var(--muted); margin: 2px 0 5px; }
    .name-input {
      width: 100%; box-sizing: border-box; margin-bottom: 8px;
      background: var(--bg-deep); color: var(--text); border: 1px solid var(--border);
      border-radius: 8px; padding: 8px 12px; font-size: 13px; font-family: inherit; outline: none;
    }
    .name-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
    .identity-bar {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      margin-bottom: 12px; font-size: 12px; color: var(--muted);
    }
    .identity-who { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .identity-who strong { color: var(--text); font-weight: 600; }
    .link-btn {
      background: none; border: none; color: var(--accent); font-size: 12px;
      cursor: pointer; padding: 0; flex-shrink: 0;
    }
    .link-btn:hover { text-decoration: underline; }

    /* ---- Participant roster ---- */
    .roster { margin: 12px 0; border-top: 1px solid var(--border-soft); padding-top: 10px; }
    .roster-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: var(--faint); margin-bottom: 8px;
    }
    .roster-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 13px; color: var(--text); }
    .roster-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .roster-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .roster-tag {
      font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
      text-transform: uppercase; letter-spacing: .04em; flex-shrink: 0;
    }
    .roster-tag.host { background: rgba(245,166,35,.18); color: #f5a623; }
    .roster-tag.you { background: rgba(56,189,248,.18); color: #38bdf8; }

    /* ---- Presence (auto collaboration) ---- */
    .presence-btn { display: inline-flex; align-items: center; gap: 6px; }
    .presence-menu { min-width: 200px; }
    .presence-menu .roster-title { margin-bottom: 6px; }
    .presence-menu .roster-row { padding: 4px 2px; }

    /* ---- Session chat (header button + right-side dock) ---- */
    .chat-toggle.chat-on { border-color: var(--accent); color: var(--accent); }
    .chat-badge {
      min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box;
      border-radius: 999px; background: #ef4444; color: #fff; font-size: 11px;
      font-weight: 700; line-height: 1; margin-left: 6px;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .chat-dock {
      width: 320px; flex-shrink: 0; display: flex; flex-direction: column;
      min-height: 0; overflow: hidden;
      background: var(--panel); border-left: 1px solid var(--border-soft);
    }
    .chat-head {
      display: flex; align-items: center; gap: 8px; padding: 10px 12px;
      border-bottom: 1px solid var(--border-soft); background: var(--bg-deep);
    }
    .chat-head > mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--accent); }
    .chat-title { font-size: 13px; font-weight: 600; color: var(--text); }
    .chat-count { font-size: 11px; color: var(--faint); margin-left: auto; }
    .chat-close {
      display: flex; background: none; border: none; color: var(--muted);
      cursor: pointer; padding: 2px; border-radius: 6px;
    }
    .chat-close:hover { background: var(--border-soft); color: var(--text); }
    .chat-close mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .chat-log {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .chat-empty { color: var(--faint); font-size: 12px; text-align: center; margin: auto; }
    .chat-msg { display: flex; flex-direction: column; gap: 3px; max-width: 86%; align-self: flex-start; }
    .chat-msg.mine { align-self: flex-end; align-items: flex-end; }
    .chat-meta { display: flex; align-items: center; gap: 6px; }
    .chat-from { font-size: 11px; font-weight: 600; color: var(--text); }
    .chat-time { font-size: 10px; color: var(--faint); }
    .chat-bubble {
      background: var(--bg-deep); border: 1px solid var(--border-soft); color: var(--text);
      padding: 7px 11px; border-radius: 12px; font-size: 13px; line-height: 1.4;
      word-break: break-word; white-space: pre-wrap;
    }
    .chat-msg.mine .chat-bubble { background: var(--accent); color: #1a1205; border-color: transparent; }
    .chat-actions { display: flex; gap: 10px; padding: 0 2px; }
    .chat-act {
      background: none; border: none; padding: 0; font-size: 11px;
      color: var(--accent); cursor: pointer;
    }
    .chat-act:hover { text-decoration: underline; }
    .chat-act.muted { color: var(--faint); cursor: default; }
    .chat-act.muted:hover { text-decoration: none; }
    .chat-input {
      display: flex; align-items: center; gap: 4px; padding: 8px;
      border-top: 1px solid var(--border-soft);
    }
    .chat-input input {
      flex: 1; min-width: 0; background: var(--bg-deep); color: var(--text);
      border: 1px solid var(--border); border-radius: 999px;
      padding: 9px 14px; font-size: 13px; font-family: inherit; outline: none;
    }
    .chat-input input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

    /* ---- Language switcher ---- */
    .lang-wrap { position: relative; flex-shrink: 0; }
    .lang-caret { margin-left: -4px; }
    .lang-menu {
      position: absolute; top: calc(100% + 6px); right: 0; z-index: 50; min-width: 168px;
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      padding: 6px; box-shadow: 0 12px 34px rgba(0,0,0,.5);
    }
    .lang-item {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      width: 100%; background: none; border: none; color: var(--text);
      font-size: 13px; padding: 8px 10px; border-radius: 8px; cursor: pointer; text-align: left;
    }
    .lang-item:hover { background: var(--panel-2); }
    .lang-item.active { color: var(--accent); }
    .lang-item mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* ---- Dropdown menus (export, account) ---- */
    .menu-wrap { position: relative; flex-shrink: 0; }
    .dropdown-menu {
      position: absolute; top: calc(100% + 6px); right: 0; z-index: 50; min-width: 188px;
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      padding: 6px; box-shadow: 0 12px 34px rgba(0,0,0,.5);
    }
    .dropdown-menu.account-menu { min-width: 220px; }
    .menu-item {
      display: flex; align-items: center; gap: 10px; width: 100%;
      background: none; border: none; color: var(--text);
      font-size: 13px; font-family: inherit; padding: 9px 10px; border-radius: 8px;
      cursor: pointer; text-align: left;
    }
    .menu-item:hover { background: var(--panel-2); }
    .menu-item mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--muted); flex: none; }
    .menu-sep { height: 1px; background: var(--border-soft); margin: 6px 4px; }
    .account-head { display: flex; align-items: center; gap: 10px; padding: 8px 10px 4px; }
    .account-head > mat-icon { font-size: 30px; width: 30px; height: 30px; color: var(--accent); flex: none; }
    .account-id { display: flex; flex-direction: column; min-width: 0; }
    .account-name { font-weight: 600; font-size: 13px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .account-email { font-size: 11.5px; color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* ---- Layout ---- */
    .body { display: flex; flex: 1; min-height: 0; position: relative; }

    /* ---- Palette ---- */
    .palette {
      width: clamp(200px, 17vw, 260px); padding: 14px; background: var(--panel);
      border-right: 1px solid var(--border-soft); overflow-y: auto;
      display: flex; flex-direction: column;
    }
    .panel-title {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .09em; color: var(--faint); margin-bottom: 10px;
    }
    .search-wrap { position: relative; margin-bottom: 10px; }
    .search-wrap mat-icon {
      position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
      font-size: 17px; width: 17px; height: 17px; color: var(--faint); pointer-events: none;
    }
    .search { width: 100%; box-sizing: border-box; padding-left: 32px; }
    /* ---- Custom dropdowns (black + amber theme) ---- */
    .dd { position: relative; }
    .cat-dd { margin-bottom: 12px; }
    .dd-trigger {
      display: inline-flex; align-items: center; justify-content: space-between; gap: 8px;
      width: 100%; height: 36px; padding: 0 10px 0 12px;
      background: var(--bg-deep); border: 1px solid var(--border); border-radius: 8px;
      color: var(--text); font-size: 13px; font-weight: 600; font-family: inherit; cursor: pointer;
      transition: border-color .15s, box-shadow .15s, background .15s;
    }
    .dd-trigger:hover { border-color: #44454d; background: var(--panel-2); }
    .dd-trigger.open { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
    .dd-val { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .dd-caret { color: var(--muted); flex: none; transition: transform .18s ease; }
    .dd-trigger.open .dd-caret { transform: rotate(180deg); color: var(--accent); }
    .dd-menu {
      position: absolute; left: 0; right: 0; top: calc(100% + 6px); z-index: 60;
      background: var(--bg-deep); border: 1px solid var(--border); border-radius: 10px;
      padding: 5px; box-shadow: 0 16px 38px rgba(0,0,0,.6);
      max-height: 300px; overflow-y: auto;
      transform-origin: top center; animation: dd-in .15s ease;
    }
    .open-dd .dd-menu { min-width: 230px; right: auto; }
    @keyframes dd-in { from { opacity: 0; transform: translateY(-5px) scale(.97); } to { opacity: 1; transform: none; } }
    .dd-item {
      display: block; width: 100%; text-align: left; cursor: pointer;
      padding: 8px 10px; border: none; border-radius: 7px; background: transparent;
      color: var(--text); font-size: 13px; font-family: inherit;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      transition: background .12s, color .12s;
    }
    .dd-item:hover { background: rgba(245,166,35,.16); color: #fff; }
    .dd-item.sel { background: var(--accent); color: #1a1303; font-weight: 600; }
    .palette-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-content: start;
    }
    .block-chip {
      grid-column: 1 / -1; display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 9px;
      background: var(--bg-deep); border: 1px solid var(--border-soft);
      cursor: grab; user-select: none;
      transition: border-color .15s, transform .1s;
    }
    .block-chip:hover { border-color: var(--accent); transform: translateY(-1px); }
    .chip-badge {
      width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .chip-badge .material-icons { font-size: 17px; color: #fff; }
    .chip-label { font-size: 12px; font-weight: 500; color: var(--text); line-height: 1.25; }
    .symbol-item {
      background: var(--bg-deep); border: 1px solid var(--border-soft); border-radius: 9px;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 9px 4px 7px; cursor: grab; user-select: none;
      transition: border-color .15s, transform .1s;
    }
    .symbol-item:hover { border-color: var(--accent); transform: translateY(-1px); }
    .symbol-item:active, .block-chip:active { cursor: grabbing; }
    .symbol-item span {
      font-size: 10.5px; color: var(--muted); font-weight: 500;
      text-align: center; line-height: 1.25;
    }
    .empty { grid-column: 1 / -1; font-size: 12px; color: var(--faint); text-align: center; }
    .hint { font-size: 11px; color: var(--faint); line-height: 1.5; margin-top: 12px; }

    /* ---- Canvas & property panels ---- */
    .canvas-wrap { flex: 1; position: relative; min-width: 0; }
    .canvas { width: 100%; height: 100%; }

    /* ---- Wire dock (floating, bottom center) ---- */
    .wire-dock {
      position: absolute; bottom: 18px; left: 18px; z-index: 40;
      display: flex; align-items: center; gap: 8px;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 11px; padding: 5px 9px;
      box-shadow: 0 10px 30px rgba(0,0,0,.45);
    }
    /* compact triggers that open a popover */
    .dock-trigger {
      display: inline-flex; align-items: center; gap: 1px;
      height: 28px; padding: 0 2px 0 6px; cursor: pointer;
      background: transparent; color: var(--muted);
      border: 1px solid var(--border-soft); border-radius: 8px;
    }
    .dock-trigger:hover { background: var(--panel-2); color: var(--text); }
    .dock-trigger.active { border-color: var(--accent); color: var(--text); }
    .trigger-swatch {
      width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
      outline: 1px solid rgba(255,255,255,.18);
    }
    .trigger-caret { font-size: 16px; width: 16px; height: 16px; }
    /* popovers float above the dock */
    .dock-backdrop { position: absolute; inset: 0; z-index: 35; }
    .dock-pop {
      position: absolute; left: 0; bottom: calc(100% + 8px);
      display: flex; flex-direction: column; gap: 12px; min-width: 150px;
      background: var(--panel); border: 1px solid var(--border); border-radius: 12px;
      padding: 11px 12px; box-shadow: 0 14px 36px rgba(0,0,0,.55);
    }
    .pop-section { display: flex; flex-direction: column; gap: 6px; }
    .pop-title {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .07em; color: var(--faint);
    }
    .dock-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .07em; color: var(--faint); white-space: nowrap;
    }
    .dock-sep { width: 1px; height: 22px; background: var(--border-soft); flex-shrink: 0; }
    .swatches { display: flex; align-items: center; gap: 6px; }
    .swatch {
      width: 18px; height: 18px; border-radius: 50%; border: 2px solid transparent;
      padding: 0; cursor: pointer; flex-shrink: 0;
      outline: 1px solid rgba(255,255,255,.18);
    }
    .swatch.active { border-color: var(--text); outline: 2px solid var(--accent); }
    .swatch.custom {
      background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
      height: 18px; width: 18px; overflow: hidden;
    }
    .swatch.custom::-webkit-color-swatch-wrapper { padding: 0; opacity: 0; }
    .dock-group { display: flex; align-items: center; gap: 2px; }
    .dock-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 38px; height: 28px; border: 1px solid transparent; border-radius: 7px;
      background: transparent; color: var(--muted); cursor: pointer;
      transition: background .12s, color .12s;
    }
    .dock-btn:hover { background: var(--panel-2); color: var(--text); }
    .dock-btn.active { background: var(--panel-2); color: var(--accent); border-color: var(--border); }
    @keyframes dock-flow-anim { to { stroke-dashoffset: -16; } }
    .dock-flow { animation: dock-flow-anim 1.2s linear infinite; }

    /* ---- Zoom dock (floating, bottom right) ---- */
    .zoom-dock {
      position: absolute; bottom: 18px; right: 18px; z-index: 30;
      display: flex; align-items: center; gap: 4px;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: 11px; padding: 5px 9px;
      box-shadow: 0 10px 30px rgba(0,0,0,.45);
    }
    /* shrink the Material icon buttons so the zoom dock matches the wire dock */
    .zoom-dock button[mat-icon-button] {
      width: 28px; height: 28px; padding: 0; line-height: 28px;
      --mdc-icon-button-state-layer-size: 28px;
    }
    .zoom-dock button[mat-icon-button] mat-icon {
      font-size: 18px; width: 18px; height: 18px; line-height: 18px;
    }
    .zoom-pct {
      min-width: 40px; text-align: center; font-size: 12px; font-weight: 600;
      color: var(--muted); cursor: pointer; user-select: none;
      border-radius: 6px; height: 28px; line-height: 28px; padding: 0 2px;
    }
    .zoom-pct:hover { background: var(--panel-2); color: var(--text); }

    /* ---- Remote collaborator cursors ---- */
    .remote-cursor {
      position: absolute; left: 0; top: 0; z-index: 35; pointer-events: none;
      transition: transform .03s linear; will-change: transform;
    }
    .cursor-name {
      position: absolute; left: 12px; top: 16px;
      font-size: 10px; font-weight: 600; color: #fff;
      padding: 2px 7px; border-radius: 8px; white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,.3);
    }
    .dock-del { --mdc-icon-button-icon-color: #fca5a5; }
    .props {
      width: clamp(195px, 18vw, 240px); padding: 12px; background: var(--panel);
      border-left: 1px solid var(--border-soft); overflow-y: auto;
    }
    .props h3 {
      margin: 0 0 10px; font-size: 12px; text-transform: uppercase;
      letter-spacing: .06em; color: var(--accent);
      border-bottom: 1px solid var(--border-soft); padding-bottom: 8px;
    }
    .props label { display: block; font-size: 12px; margin-bottom: 12px; color: var(--muted); }
    .props input, .props textarea { display: block; width: 100%; margin-top: 4px; box-sizing: border-box; }
    .props textarea {
      background: var(--bg-deep); color: var(--text); border: 1px solid var(--border);
      border-radius: 8px; padding: 8px 12px; font-size: 12.5px; font-family: inherit;
      resize: vertical; min-height: 48px; outline: none;
    }
    .props textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
    .props input[type="color"] { padding: 2px 4px; height: 32px; cursor: pointer; }
    .props button[mat-stroked-button] { width: 100%; margin-top: 6px; }
    .prop-type {
      display: flex; align-items: center; gap: 6px;
      font-size: 11.5px; color: var(--muted);
      background: var(--bg-deep); border: 1px solid var(--border-soft);
      border-radius: 7px; padding: 7px 9px; margin-bottom: 14px;
    }
    .prop-type mat-icon { font-size: 15px; width: 15px; height: 15px; color: var(--accent); }
    .prop-section {
      font-size: 10.5px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .08em; color: var(--faint);
      margin: 14px 0 10px; padding-top: 12px;
      border-top: 1px solid var(--border-soft);
    }
    .prop-row { display: flex; gap: 8px; }
    .prop-row label { flex: 1; min-width: 0; }

    /* ---- Status bar ---- */
    .statusbar {
      display: flex; align-items: center; gap: 8px;
      height: 28px; flex-shrink: 0; padding: 0 14px;
      background: var(--panel); border-top: 1px solid var(--border-soft);
      font-size: 11.5px; color: var(--muted);
    }
    .status-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--ok); flex-shrink: 0;
    }
    .status-dot.busy { background: var(--accent); }
    .status-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .kbd-hints { color: var(--faint); white-space: nowrap; }

    /* ---- Scrollbars ---- */
    .palette::-webkit-scrollbar, .props::-webkit-scrollbar { width: 8px; }
    .palette::-webkit-scrollbar-thumb, .props::-webkit-scrollbar-thumb {
      background: var(--border); border-radius: 4px;
    }
    .palette::-webkit-scrollbar-thumb:hover, .props::-webkit-scrollbar-thumb:hover {
      background: #45464e;
    }

    /* ---- Responsive ---- */
    /* Drawer toggles live in the toolbar; shown only on compact screens. */
    .panel-toggle { display: none; align-items: center; }
    .panel-toggle .on, .panel-toggle .on mat-icon { color: var(--accent); }

    @media (max-width: 1200px) {
      .brand-name { display: none; }
    }

    /* Compact (tablets & below): palette + properties become toolbar-toggled
       drawers that push the canvas; the toolbar wraps instead of overflowing. */
    @media (max-width: 1024px) {
      .topbar { flex-wrap: wrap; height: auto; min-height: 48px; padding: 6px 10px; row-gap: 6px; }
      .kbd-hints { display: none; }
      .doc-name { width: clamp(110px, 24vw, 200px); }
      .panel-toggle { display: inline-flex; }
      .palette { width: min(260px, 72vw); }
      .palette:not(.open) { display: none; }
      .props { width: min(280px, 78vw); }
      .props:not(.open) { display: none; }
      .chat-dock { width: min(320px, 80vw); }
    }

    /* Phones */
    @media (max-width: 560px) {
      .topbar { padding: 6px 8px; gap: 6px; }
      .brand { display: none; }
      .doc-name { width: clamp(90px, 36vw, 170px); }
      .open-dd { display: none; }
      .topbar .mdc-button .mdc-button__label { display: none; }
      .topbar .mdc-button mat-icon { margin-right: 0; }
      .palette { width: min(300px, 84vw); padding: 10px; }
      .props { width: min(320px, 88vw); }
      .chat-dock { width: 100vw; }
      .palette-grid { grid-template-columns: 1fr 1fr; }
      .wire-dock { left: 12px; bottom: 12px; }
      .zoom-dock { right: 12px; bottom: 12px; }
    }
  `],
})
export class AppComponent implements AfterViewInit, AfterViewChecked, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLDivElement>;
  @ViewChild('chatLog') chatLogRef?: ElementRef<HTMLDivElement>;

  graph!: Graph;
  dnd!: Dnd;

  blockTypes: BlockType[] = [];
  savedDiagrams: DiagramSummary[] = [];
  selectedDiagramId: number | null = null;
  currentId: number | null = null;
  diagramName = 'Untitled diagram';
  selectedNode: Node | null = null;
  selectedEdge: Edge | null = null;
  status = '';
  lightCanvas = true; // white canvas matches the light workspace; toggle for dark
  paletteQuery = '';
  activeCategory = 'Blocks';
  catMenuOpen = false;
  openMenuOpen = false;
  /** Compact-screen drawers: palette and properties auto-hide behind toolbar toggles. */
  paletteOpen = false;
  propsOpen = false;

  constructor(
    private api: DiagramService,
    private sanitizer: DomSanitizer,
    public collab: CollabService,
    public i18n: TranslateService,
    public msgTranslate: MessageTranslateService,
    public auth: AuthService,
  ) {}

  /** End the session and return to the login screen. */
  logout(): void {
    // Drop out of any collaboration room first, so we're removed from the room's
    // presence right away instead of waiting for the async sign-out call and the
    // subsequent component teardown (ngOnDestroy also calls leave() as a backstop).
    this.resetCollab();
    this.auth.logout();
  }

  // ---------- Language (i18n) ----------

  langMenuOpen = false;
  exportMenuOpen = false;
  importMenuOpen = false;
  accountMenuOpen = false;

  /** Languages offered in the switcher (from the translation table). */
  get languages() {
    return this.i18n.languages;
  }

  get currentLang(): string {
    return this.i18n.lang;
  }

  get currentLangLabel(): string {
    return this.i18n.currentLabel;
  }

  /** Switch the UI language instantly (persisted across reloads). */
  switchLang(code: string): void {
    this.langMenuOpen = false;
    this.i18n.setLang(code);
  }

  // ---------- Chat message translation (on-device) ----------

  /** Per-message translation state, keyed by message id. */
  private msgTx = new Map<string, {
    state: 'loading' | 'done' | 'same' | 'error' | 'unsupported';
    text?: string;
    showOriginal?: boolean;
  }>();

  msgState(id: string) {
    return this.msgTx.get(id);
  }

  /** Translate a message into the current UI language (or re-show its translation). */
  async translateMessage(m: ChatMessage): Promise<void> {
    const cur = this.msgTx.get(m.id);
    if (cur?.state === 'done') { this.msgTx.set(m.id, { ...cur, showOriginal: false }); return; }
    if (!this.msgTranslate.supported) { this.msgTx.set(m.id, { state: 'unsupported' }); return; }
    this.msgTx.set(m.id, { state: 'loading' });
    try {
      const r = await this.msgTranslate.translate(m.text, m.lang ?? '', this.i18n.lang);
      this.msgTx.set(m.id, r.same
        ? { state: 'same' }
        : { state: 'done', text: r.text, showOriginal: false });
    } catch {
      this.msgTx.set(m.id, { state: 'error' });
    }
  }

  /** Toggle a translated message back to its original text. */
  revertMessage(m: ChatMessage): void {
    const cur = this.msgTx.get(m.id);
    if (cur?.state === 'done') this.msgTx.set(m.id, { ...cur, showOriginal: true });
  }

  ngAfterViewInit(): void {
    registerElectricalShapes();
    registerAnimatedShapes();
    registerBasicShapes();
    registerImageNode();
    registerBlockCard();
    this.initGraph();
    this.canvasRef.nativeElement.classList.toggle('canvas-light', this.lightCanvas);
    this.loadPalette();
    this.refreshList();
  }

  ngOnDestroy(): void {
    this.collab.leave();
    this.graph?.dispose();
  }

  // ---------- Collaboration (automatic, per file) ----------

  /** Roster popover open state. */
  presenceOpen = false;
  /** The file id whose collab room we're currently joined to (null = none). */
  collabFileId: number | null = null;

  /** Display name for collaboration: the signed-in user's name (or email). */
  get myDisplayName(): string {
    const u = this.auth.user();
    return u?.name?.trim() || u?.email || 'User';
  }

  /** Stable identity (account email) so all of a user's tabs count as one person. */
  get myUserId(): string {
    return this.auth.user()?.email || '';
  }

  /**
   * Keep collaboration in sync with the open file. The room is the diagram id, so
   * everyone viewing the same saved file shares one room. A new/unsaved diagram
   * (no id) isn't shared until it's saved.
   */
  private syncCollab(): void {
    const fileId = this.currentId;
    if (fileId == null) {
      this.resetCollab();
      return;
    }
    if (this.collab.active && this.collabFileId === fileId) return;
    this.resetCollab();
    this.collab.join(this.graph, String(fileId), this.myDisplayName, this.myUserId);
    this.collabFileId = fileId;
    this.status = 'Collaborating on this file';
  }

  /** Leave the current room and reset the collab/chat UI state. */
  private resetCollab(): void {
    if (this.collab.active) this.collab.leave();
    this.collabFileId = null;
    this.presenceOpen = false;
    this.chatOpen = false;
    this.chatDraft = '';
    this.lastSeenChatCount = 0;
  }

  participantTrack(_i: number, p: { id: number }): number {
    return p.id;
  }

  // ---- live cursors ----

  onCanvasMouseMove(e: MouseEvent): void {
    if (!this.collab.active) return;
    const p = this.graph.clientToLocal(e.clientX, e.clientY);
    this.collab.setLocalCursor({ x: p.x, y: p.y });
  }

  onCanvasMouseLeave(): void {
    if (this.collab.active) this.collab.setLocalCursor(null);
  }

  /** Remote cursors mapped from graph coordinates to pixels inside the canvas wrap. */
  remoteCursors(): { id: number; name: string; color: string; sx: number; sy: number }[] {
    if (!this.collab.active || !this.graph || !this.canvasRef) return [];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return this.collab.cursors.map((c) => {
      const client = this.graph.localToClient(c.x, c.y);
      return { id: c.id, name: c.name, color: c.color, sx: client.x - rect.left, sy: client.y - rect.top };
    }).filter((c) => c.sx >= -20 && c.sy >= -20 && c.sx <= rect.width + 20 && c.sy <= rect.height + 20);
  }

  cursorTrack(_i: number, c: { id: number }): number {
    return c.id;
  }

  // ---------- Session chat ----------

  chatOpen = false;
  chatDraft = '';
  /** how many messages had been seen last time the chat was open (for the unread badge). */
  lastSeenChatCount = 0;
  private lastRenderedChatCount = 0;

  /** Unread = messages that arrived while the chat panel was closed. */
  get unreadChat(): number {
    if (!this.collab.active || this.chatOpen) return 0;
    return Math.max(0, this.collab.messages.length - this.lastSeenChatCount);
  }

  toggleChat(): void {
    this.chatOpen = !this.chatOpen;
    if (this.chatOpen) {
      this.lastSeenChatCount = this.collab.messages.length;
      setTimeout(() => this.scrollChatToBottom());
    }
  }

  sendChat(): void {
    const text = this.chatDraft.trim();
    if (!text) return;
    this.collab.sendChat(text, this.i18n.lang);
    this.chatDraft = '';
    this.lastSeenChatCount = this.collab.messages.length;
    setTimeout(() => this.scrollChatToBottom());
  }

  chatTrack(_i: number, m: { id: string }): string {
    return m.id;
  }

  /** Short HH:MM timestamp for a message. */
  fmtTime(ts: number): string {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private scrollChatToBottom(): void {
    const el = this.chatLogRef?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  // Keep the chat scrolled to the newest message, and mark messages read while open.
  ngAfterViewChecked(): void {
    if (this.chatOpen && this.collab.messages.length !== this.lastRenderedChatCount) {
      this.lastRenderedChatCount = this.collab.messages.length;
      this.lastSeenChatCount = this.collab.messages.length;
      this.scrollChatToBottom();
    }
  }

  // ---------- Graph setup ----------

  private initGraph(): void {
    this.graph = new Graph({
      container: this.canvasRef.nativeElement,
      autoResize: true,
      background: { color: '#ffffff' },
      grid: { size: 10, visible: true, type: 'dot', args: { color: '#cbd5e1', thickness: 1 } },
      panning: { enabled: true, eventTypes: ['rightMouseDown'] },
      mousewheel: { enabled: true, modifiers: ['ctrl', 'meta'] },
      connecting: {
        router: 'manhattan',
        connector: { name: 'rounded', args: { radius: 8 } },
        anchor: 'center',
        connectionPoint: 'boundary',
        snap: { radius: 20 },
        allowBlank: false,
        allowLoop: false,
        allowNode: false, // must connect port-to-port
        highlight: true,
        // New wires take whatever is selected in the wire dock
        createEdge: () =>
          this.graph.createEdge({
            attrs: { line: this.wireLineAttrs() },
            router: this.wireRouterCfg(),
            connector: this.wireConnectorCfg(),
            zIndex: -1,
          }),
      },
      highlighting: {
        magnetAvailable: {
          name: 'stroke',
          args: { attrs: { stroke: '#22d3ee', 'stroke-width': 2 } },
        },
      },
    });

    this.graph
      .use(new Snapline({ enabled: true }))
      .use(new Selection({
        enabled: true,
        multiple: true,
        rubberband: true,        // drag on blank canvas to lasso-select
        movable: true,           // dragging one selected node moves the whole selection
        strict: false,           // rubberband selects nodes it touches, not only fully-contained
        showNodeSelectionBox: false,
      }))
      .use(new Keyboard({ enabled: true }))
      .use(new History({
        enabled: true,
        // Don't record changes applied from collaborators — otherwise local
        // Undo would silently revert other people's work.
        beforeAddCommand: () => !this.collab.isApplyingRemote,
      }))
      .use(new Transform({
        resizing: {
          enabled: true, minWidth: 30, minHeight: 24,
          // keep imported pictures (and squares/circles) from being squashed
          preserveAspectRatio: (node: Node) =>
            node.shape === 'img-node' || !!BASIC_SHAPES[node.shape]?.keepRatio,
        },
        rotating: { enabled: true, grid: 15 },
      }));

    // Symbol drawings (elec-*/anim-*) use fixed coordinates, so scale the
    // wrapper group whenever the node is resized.
    this.graph.on('node:change:size', ({ node }) => this.syncSymbolScale(node));

    this.dnd = new Dnd({ target: this.graph });

    // Delete with keyboard — covers plugin selection AND the clicked
    // node/edge (edges aren't part of the Selection plugin's set).
    this.graph.bindKey(['delete', 'backspace'], () => {
      const cells = [...this.graph.getSelectedCells()];
      if (this.selectedNode && !cells.includes(this.selectedNode)) cells.push(this.selectedNode);
      if (this.selectedEdge && !cells.includes(this.selectedEdge)) cells.push(this.selectedEdge);
      if (cells.length) this.graph.removeCells(cells);
      this.selectedNode = null;
      this.selectedEdge = null;
      return false;
    });

    // Select everything
    this.graph.bindKey(['ctrl+a', 'meta+a'], () => {
      this.graph.resetSelection(this.graph.getNodes());
      return false;
    });
    // Clear selection / close panels
    this.graph.bindKey('esc', () => {
      this.graph.cleanSelection();
      this.selectedNode = null;
      this.selectedEdge = null;
      this.highlightWire(null);
      return false;
    });
    // Keyboard zoom
    this.graph.bindKey(['ctrl+=', 'meta+='], () => { this.zoomIn(); return false; });
    this.graph.bindKey(['ctrl+-', 'meta+-'], () => { this.zoomOut(); return false; });

    // Track selection for the property panels
    this.graph.on('node:click', ({ node }) => {
      this.selectedNode = node;
      this.selectedEdge = null;
      this.highlightWire(null);
    });
    this.graph.on('edge:click', ({ edge }) => {
      this.selectedEdge = edge;
      this.selectedNode = null;
      this.syncWireDock(edge);
      this.highlightWire(edge);
    });
    this.graph.on('blank:click', () => {
      this.selectedNode = null;
      this.selectedEdge = null;
      this.highlightWire(null);
    });
    // If the selected cell vanishes (Del key, collaborator deleted it,
    // diagram load), close its property panel instead of editing a ghost.
    this.graph.on('cell:removed', ({ cell }) => {
      if (cell === this.selectedNode) this.selectedNode = null;
      if (cell === this.selectedEdge) this.selectedEdge = null;
    });
  }

  // ---------- Palette ----------

  private loadPalette(): void {
    this.api.getBlockTypes().subscribe({
      next: (types) => (this.blockTypes = this.mergeShapeTypes(types)),
      error: () => {
        this.status = 'Backend offline - using local palette';
        this.blockTypes = [
          { key: 'processor', label: 'Main Processor', color: '#1d4ed8', icon: 'developer_board' },
          { key: 'sensor', label: 'Sensor', color: '#15803d', icon: 'sensors' },
          { key: 'motor', label: 'Motor Control', color: '#b45309', icon: 'rotate_right' },
          { key: 'battery', label: 'Battery / BMS', color: '#a16207', icon: 'battery_charging_full' },
          { key: 'comms', label: 'Comm Module', color: '#6d28d9', icon: 'wifi' },
          ...Object.entries(BASIC_SHAPES).map(([shape, def]) => ({
            key: shape.replace('basic-', ''),
            label: def.label,
            color: '#ffffff',
            category: 'Shapes',
            shape,
          })),
          ...Object.keys(ELECTRICAL_SYMBOLS).map((shape) => ({
            key: shape.replace('elec-', ''),
            label: this.symbolLabel(shape),
            color: '#e2e8f0',
            category: 'Electrical',
            shape,
          })),
          ...Object.keys(ANIMATED_SYMBOLS).map((shape) => ({
            key: shape.replace('anim-', ''),
            label: this.symbolLabel(shape),
            color: '#e2e8f0',
            category: 'Animated',
            shape,
          })),
        ];
      },
    });
  }

  // Palette helpers ----------------------------------------------------

  /** Ensure every registered basic shape shows in the palette, even if the
   *  backend's block-types list predates them (keeps shapes client-driven). */
  private mergeShapeTypes(types: BlockType[]): BlockType[] {
    const present = new Set(types.map((t) => t.shape).filter(Boolean));
    const extra: BlockType[] = Object.entries(BASIC_SHAPES)
      .filter(([shape]) => !present.has(shape))
      .map(([shape, def]) => ({
        key: shape.replace('basic-', ''),
        label: def.label,
        color: '#ffffff',
        category: 'Shapes',
        shape,
      }));
    return [...types, ...extra];
  }

  get selectedDiagramName(): string {
    return this.savedDiagrams.find((d) => d.id === this.selectedDiagramId)?.name ?? '';
  }

  get categories(): string[] {
    const cats = new Set(this.blockTypes.map((b) => b.category ?? 'Blocks'));
    return [...cats];
  }

  byCategory(cat: string): BlockType[] {
    return this.blockTypes.filter((b) => (b.category ?? 'Blocks') === cat);
  }

  /** Items for the palette: search across everything, otherwise the active tab. */
  get visibleItems(): BlockType[] {
    const q = this.paletteQuery.trim().toLowerCase();
    if (q) {
      return this.blockTypes.filter((b) =>
        b.label.toLowerCase().includes(q) || this.i18n.td(b.label).toLowerCase().includes(q));
    }
    return this.byCategory(this.activeCategory);
  }

  isElectrical(shape: string): boolean {
    return shape.startsWith('elec-');
  }

  isBasic(shape: string): boolean {
    return isBasic(shape);
  }

  /** Outline preview for a basic geometric shape in the palette. */
  basicPreview(shape: string): SafeHtml {
    let html = this.previewCache.get(shape);
    if (!html) {
      html = this.sanitizer.bypassSecurityTrustHtml(BASIC_SHAPES[shape]?.preview ?? '');
      this.previewCache.set(shape, html);
    }
    return html;
  }

  private syncSymbolScale(node: Node): void {
    const def = ELECTRICAL_SYMBOLS[node.shape] ?? ANIMATED_SYMBOLS[node.shape];
    if (!def) return;
    const { width, height } = node.getSize();
    node.attr('wrap/transform', `scale(${width / def.width},${height / def.height})`);
  }

  symbolViewBox(shape: string): string {
    const def = ELECTRICAL_SYMBOLS[shape] ?? ANIMATED_SYMBOLS[shape];
    return def ? `-4 -4 ${def.width + 8} ${def.height + 8}` : '0 0 100 40';
  }

  symbolPaths(shape: string) {
    return ELECTRICAL_SYMBOLS[shape]?.paths ?? [];
  }

  isIc(shape: string): boolean {
    return (ELECTRICAL_SYMBOLS[shape]?.texts?.length ?? 0) > 0;
  }

  /** Bold texts only (the IC title) — pin labels are too small for previews. */
  symbolTitleTexts(shape: string) {
    return (ELECTRICAL_SYMBOLS[shape]?.texts ?? []).filter((t) => t.bold);
  }

  private previewCache = new Map<string, SafeHtml>();

  animatedPreview(shape: string): SafeHtml {
    let html = this.previewCache.get(shape);
    if (!html) {
      html = this.sanitizer.bypassSecurityTrustHtml(partsToSvg(shape));
      this.previewCache.set(shape, html);
    }
    return html;
  }

  private symbolLabel(shape: string): string {
    const k = shape.replace(/^(elec|anim)-/, '');
    const names: Record<string, string> = {
      resistor: 'Resistor', capacitor: 'Capacitor', inductor: 'Inductor',
      diode: 'Diode', led: 'LED', npn: 'NPN Transistor', ground: 'Ground',
      vdc: 'DC Source', vac: 'AC Source', switch: 'Switch', fuse: 'Fuse',
      pnp: 'PNP Transistor', nmos: 'N-MOSFET', zener: 'Zener Diode',
      pot: 'Potentiometer', 'cap-pol': 'Polarized Cap', cell: 'Battery Cell',
      opamp: 'Op-Amp', crystal: 'Crystal', pushbutton: 'Push Button',
      lamp: 'Lamp', ammeter: 'Ammeter', voltmeter: 'Voltmeter', motor: 'DC Motor',
      ic555: '555 Timer IC', lm741: 'LM741 Op-Amp', '7805': '7805 Regulator',
      lm317: 'LM317 Regulator', '7400': '7400 NAND', '7404': '7404 Inverter',
      '74hc595': '74HC595 Shift Reg', l293d: 'L293D Motor Drv',
      pc817: 'PC817 Optocoupler', mcu: 'ATmega328 MCU', esp32: 'ESP32 Module',
      'robot-arm': 'Robotic Arm', siren: 'Siren Light', fan: 'Fan',
      conveyor: 'Conveyor', gear: 'Gear Motor', antenna: 'Antenna Tower',
      pump: 'Pump', 'stack-light': 'Stack Light', piston: 'Piston',
      tank: 'Liquid Tank', drone: 'Drone', 'glow-battery': 'Battery (Charging)',
      inverter: 'Inverter', transformer: 'Transformer', solar: 'Solar Panel',
      'wind-turbine': 'Wind Turbine', generator: 'Generator',
      'ev-charger': 'EV Charger', pylon: 'Power Pylon', relay: 'Relay',
      heater: 'Heater', bulb: 'Bulb',
    };
    return names[k] ?? k;
  }

  // Property panel helpers ----------------------------------------------

  /** Electrical symbols are recolored via stroke; cards via badge; rest via body fill. */
  get colorAttrPath(): string {
    const shape = this.selectedNode?.shape ?? '';
    if (shape.startsWith('elec-')) return 'sym/stroke';
    if (shape === 'block-card') return 'badge/fill';
    return 'body/fill';
  }

  /** Card blocks keep their name in 'title'; everything else uses 'label'. */
  get labelAttrPath(): string {
    return this.selectedNode?.shape === 'block-card' ? 'title/text' : 'label/text';
  }

  get nodeTypeName(): string {
    const shape = this.selectedNode?.shape ?? '';
    if (shape === 'block-card') return this.i18n.td('Functional block');
    if (shape === 'img-node') return this.i18n.td('Image');
    if (shape.startsWith('elec-')) return `${this.i18n.td('Electrical')} · ${this.i18n.td(this.symbolLabel(shape))}`;
    if (shape.startsWith('anim-')) return `${this.i18n.td('Animated')} · ${this.i18n.td(this.symbolLabel(shape))}`;
    if (isBasic(shape)) return `${this.i18n.td('Shapes')} · ${this.i18n.td(BASIC_SHAPES[shape]?.label ?? 'Shape')}`;
    return this.i18n.td('Component');
  }

  get isCard(): boolean { return this.selectedNode?.shape === 'block-card'; }

  get isSymbol(): boolean {
    const s = this.selectedNode?.shape ?? '';
    return s.startsWith('elec-') || s.startsWith('anim-');
  }

  get defaultCategory(): string {
    const shape = this.selectedNode?.shape ?? '';
    if (shape.startsWith('elec-')) return 'Electrical';
    if (shape.startsWith('anim-')) return 'Animated';
    if (isBasic(shape)) return 'Shapes';
    if (shape === 'img-node') return 'Image';
    return 'Blocks';
  }

  /** Custom metadata (part number, category, notes) lives in node data and saves with the diagram. */
  dataField(key: string): string {
    return this.selectedNode?.getData()?.[key] ?? '';
  }

  setDataField(key: string, value: string): void {
    this.selectedNode?.setData({ [key]: value });
  }

  setNodeColor(color: string): void {
    if (!this.selectedNode) return;
    this.selectedNode.attr(this.colorAttrPath, color);
    if (this.colorAttrPath === 'sym/stroke') {
      // keep filled parts (diode triangle, arrows) in sync with the stroke
      const def = ELECTRICAL_SYMBOLS[this.selectedNode.shape];
      def?.paths.forEach((p, i) => {
        if (p.fill) this.selectedNode!.attr(`p${i}/fill`, color);
      });
    }
  }

  startDrag(block: BlockType, e: MouseEvent): void {
    if (block.shape) {
      // Electrical schematic symbol — geometry/ports come from the registered shape
      const node = this.graph.createNode({
        shape: block.shape,
        data: { typeKey: block.key },
        attrs: { label: { text: block.label } },
      });
      this.dnd.start(node, e);
      return;
    }
    // Functional block → FAST-style card with icon badge
    const node = this.graph.createNode({
      shape: 'block-card',
      data: { typeKey: block.key },
      attrs: {
        badge: { fill: block.color },
        icon: { text: block.icon || 'widgets' },
        title: { text: block.label },
        subtitle: { text: 'Module' },
      },
    });
    this.dnd.start(node, e);
  }

  // ---------- Toolbar actions ----------

  save(): void {
    const dto = {
      name: this.diagramName || 'Untitled diagram',
      contentJson: JSON.stringify(this.graph.toJSON()),
    };
    const req = this.currentId
      ? this.api.update(this.currentId, dto)
      : this.api.create(dto);

    req.subscribe({
      next: (saved) => {
        this.currentId = saved.id ?? this.currentId;
        this.status = `Saved "${saved.name}"`;
        this.refreshList();
        // A brand-new diagram now has an id — connect it to its room.
        this.syncCollab();
      },
      error: () => (this.status = 'Save failed - is the backend running?'),
    });
  }

  load(): void {
    if (this.selectedDiagramId == null) return;
    this.api.get(this.selectedDiagramId).subscribe({
      next: (d) => {
        // Leave the previously open file's room FIRST: drops our presence there
        // immediately and prevents the incoming canvas from bleeding into the old
        // room. We then join the new file's room via syncCollab() below.
        this.resetCollab();
        this.graph.fromJSON(JSON.parse(d.contentJson));
        this.currentId = d.id ?? null;
        this.diagramName = d.name;
        this.selectedNode = null;
        this.selectedEdge = null;
        this.status = `Opened "${d.name}"`;
        // Connect to this file's collaboration room (seeds it or adopts live state).
        this.syncCollab();
      },
      error: () => (this.status = 'Load failed'),
    });
  }

  newDiagram(): void {
    // Leave the current file's room BEFORE clearing the canvas. clearCells()
    // emits a per-cell 'removed' event for every cell; while still joined, the
    // collab service broadcasts those as deletions and wipes the diagram for
    // everyone collaborating on the file we were just viewing. (A new, unsaved
    // diagram has no id, so it isn't shared again until it's saved.)
    this.resetCollab();
    this.graph.clearCells();
    this.currentId = null;
    this.selectedDiagramId = null;
    this.diagramName = 'Untitled diagram';
    this.selectedNode = null;
    this.selectedEdge = null;
    this.status = '';
  }

  refreshList(): void {
    this.api.list().subscribe({
      next: (list) => (this.savedDiagrams = list),
      error: () => {},
    });
  }

  undo(): void { this.graph.canUndo() && this.graph.undo(); }
  redo(): void { this.graph.canRedo() && this.graph.redo(); }

  // ---------- Zoom ----------

  get zoomPct(): number {
    return this.graph ? Math.round(this.graph.zoom() * 100) : 100;
  }

  zoomIn(): void {
    this.graph.zoom(0.2);
    if (this.graph.zoom() > 3) this.graph.zoomTo(3);
  }

  zoomOut(): void {
    this.graph.zoom(-0.2);
    if (this.graph.zoom() < 0.2) this.graph.zoomTo(0.2);
  }

  zoomFit(): void {
    this.graph.zoomToFit({ padding: 24, maxScale: 1.5 });
  }

  zoomReset(): void {
    this.graph.zoomTo(1);
    this.graph.centerContent();
  }

  toggleCanvasTheme(): void {
    this.lightCanvas = !this.lightCanvas;
    // CSS class drives recoloring of light strokes so symbols stay readable
    this.canvasRef.nativeElement.classList.toggle('canvas-light', this.lightCanvas);
    this.graph.drawBackground({ color: this.lightCanvas ? '#ffffff' : '#0f172a' });
    this.graph.drawGrid({
      type: 'dot',
      args: { color: this.lightCanvas ? '#cbd5e1' : '#334155', thickness: 1 },
    });
  }

  deleteSelected(): void {
    if (this.selectedNode) {
      this.graph.removeCell(this.selectedNode);
      this.selectedNode = null;
    }
  }

  // ---------- Image import ----------

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      // place at the center of the visible canvas
      const rect = this.canvasRef.nativeElement.getBoundingClientRect();
      const p = this.graph.clientToLocal(rect.left + rect.width / 2, rect.top + rect.height / 2);
      this.addImageNode(file, p.x, p.y);
    }
    input.value = ''; // allow re-selecting the same file
  }

  onCanvasDrop(event: DragEvent): void {
    const file = Array.from(event.dataTransfer?.files ?? [])
      .find((f) => f.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    const p = this.graph.clientToLocal(event.clientX, event.clientY);
    this.addImageNode(file, p.x, p.y);
  }

  private addImageNode(file: File, cx: number, cy: number): void {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      const probe = new Image();
      probe.onload = () => {
        const max = 220;
        const scale = Math.min(1, max / Math.max(probe.width, probe.height));
        const w = Math.max(40, Math.round(probe.width * scale));
        const h = Math.max(40, Math.round(probe.height * scale));
        this.graph.addNode({
          shape: 'img-node',
          x: cx - w / 2, y: cy - h / 2, width: w, height: h,
          attrs: {
            img: { 'xlink:href': url },
            label: { text: file.name.replace(/\.[^.]+$/, '') },
          },
        });
        this.status = `Added image "${file.name}"`;
      };
      probe.src = url;
    };
    reader.readAsDataURL(file);
  }

  deleteSelectedEdge(): void {
    if (this.selectedEdge) {
      this.graph.removeCell(this.selectedEdge);
      this.selectedEdge = null;
    }
  }

  /**
   * Visual cue for the selected wire. Done with a DOM class (not model attrs)
   * so the highlight is local-only and never syncs to collaborators.
   */
  private highlightWire(edge: Edge | null): void {
    this.canvasRef.nativeElement
      .querySelectorAll('.wire-selected')
      .forEach((el) => el.classList.remove('wire-selected'));
    if (edge) {
      const view = this.graph.findViewByCell(edge) as any;
      view?.container?.classList.add('wire-selected');
    }
  }

  // ---------- Wire dock ----------

  wireColors = ['#22d3ee', '#22c55e', '#f5a623', '#ef4444', '#a78bfa', '#64748b'];
  wireColor = '#22d3ee';
  wireStyle: 'flow' | 'dashed' | 'solid' = 'flow'; // animated dashes by default; dock can switch
  wireWidth = 2;
  wireRouter: 'manhattan' | 'normal' | 'smooth' = 'manhattan';
  /** which wire popover is open (compact dock): color, style, or none. */
  wirePop: 'color' | 'style' | null = null;

  toggleWirePop(which: 'color' | 'style'): void {
    this.wirePop = this.wirePop === which ? null : which;
  }

  wireLineAttrs(): any {
    return {
      stroke: this.wireColor,
      strokeWidth: this.wireWidth,
      strokeDasharray: this.wireStyle === 'solid' ? 'none' : 6,
      targetMarker: { name: 'block', width: 9, height: 7 },
      style: { animation: this.wireStyle === 'flow' ? 'flowing-line 30s infinite linear' : 'none' },
    };
  }

  wireRouterCfg(): any {
    return { name: this.wireRouter === 'manhattan' ? 'manhattan' : 'normal' };
  }

  wireConnectorCfg(): any {
    return this.wireRouter === 'smooth'
      ? { name: 'smooth' }
      : { name: 'rounded', args: { radius: 8 } };
  }

  setWireColor(c: string): void {
    this.wireColor = c;
    this.selectedEdge?.attr('line/stroke', c);
  }

  setWireStyle(s: 'flow' | 'dashed' | 'solid'): void {
    this.wireStyle = s;
    if (this.selectedEdge) {
      this.selectedEdge.attr('line/strokeDasharray', s === 'solid' ? 'none' : 6);
      this.selectedEdge.attr('line/style/animation', s === 'flow' ? 'flowing-line 30s infinite linear' : 'none');
    }
  }

  setWireWidth(w: number): void {
    this.wireWidth = w;
    this.selectedEdge?.attr('line/strokeWidth', w);
  }

  setWireRouter(r: 'manhattan' | 'normal' | 'smooth'): void {
    this.wireRouter = r;
    if (this.selectedEdge) {
      this.selectedEdge.setRouter(this.wireRouterCfg());
      this.selectedEdge.setConnector(this.wireConnectorCfg());
    }
  }

  /** Reflect a clicked wire's current style in the dock. */
  private syncWireDock(edge: Edge): void {
    const stroke = edge.attr('line/stroke') as any;
    if (stroke) this.wireColor = String(stroke);
    const w = edge.attr('line/strokeWidth') as any;
    if (w) this.wireWidth = Number(w);
    const dash = edge.attr('line/strokeDasharray') as any;
    const anim = edge.attr('line/style/animation') as any;
    this.wireStyle = !dash || dash === 'none'
      ? 'solid'
      : (anim && anim !== 'none' ? 'flow' : 'dashed');
    const router = edge.getRouter() as any;
    const connector = edge.getConnector() as any;
    this.wireRouter = connector?.name === 'smooth'
      ? 'smooth'
      : (router?.name === 'normal' ? 'normal' : 'manhattan');
  }

  exportJson(): void {
    const blob = new Blob([JSON.stringify(this.graph.toJSON(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.diagramName || 'diagram'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  onJsonSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.importJsonText(String(reader.result), file.name);
      reader.readAsText(file);
    }
    input.value = ''; // allow re-selecting the same file
  }

  /** Load a previously exported diagram JSON (X6 graph.toJSON() shape) onto the canvas. */
  private importJsonText(text: string, fileName: string): void {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (err: any) {
      this.status = `JSON import failed: ${err?.message || 'file is not valid JSON'}`;
      return;
    }

    // Accept the exported { cells: [...] } shape, or a bare array of cells.
    const rawCells: any[] | null =
      Array.isArray(data?.cells) ? data.cells : (Array.isArray(data) ? data : null);

    let cells: any[];
    let skipped = 0;
    let isPartsCatalog = false;

    if (rawCells) {
      // X6's fromJSON throws on the FIRST cell whose `shape` isn't registered, which
      // rejects the entire file. Keep only the cells this app knows how to render, so a
      // file with a stray/foreign cell still imports everything else instead of nothing.
      const isKnown = (shape: unknown): boolean => {
        if (typeof shape !== 'string') return false;
        try { return Node.registry.exist(shape) || Edge.registry.exist(shape); }
        catch { return true; } // registry API unavailable: don't over-filter
      };
      cells = rawCells.filter((c) => c && isKnown(c.shape));
      skipped = rawCells.length - cells.length;
      if (cells.length === 0) {
        this.status = rawCells.length
          ? `Import failed: none of the ${rawCells.length} cells use a shape this app supports`
          : 'That file contains no diagram cells';
        return;
      }
    } else {
      // Not a diagram export — try a parts-catalog API response (partserviceresult),
      // turning each catalogued part into a functional-block card on the canvas.
      const partCells = this.partsResultToCells(data);
      if (!partCells) {
        this.status = 'That file is not a valid diagram JSON';
        return;
      }
      if (partCells.length === 0) {
        this.status = 'No parts found in this catalog file';
        return;
      }
      cells = partCells;
      isPartsCatalog = true;
    }

    // An imported diagram is a fresh, unsaved document. Leave any current collab room
    // first (so the import can't overwrite the file we were viewing for other people)
    // and clear the saved-file id so Save creates a new diagram instead of overwriting.
    this.resetCollab();
    this.currentId = null;
    this.selectedDiagramId = null;
    this.selectedNode = null;
    this.selectedEdge = null;

    try {
      this.graph.fromJSON({ cells });
    } catch (err: any) {
      this.status = `JSON import failed: ${err?.message || err}`;
      return;
    }

    this.diagramName = fileName.replace(/\.[^.]+$/, '') || 'Imported diagram';
    try { this.graph.zoomToFit({ padding: 24, maxScale: 1.5 }); } catch { /* framing is best-effort */ }
    if (isPartsCatalog) {
      this.status = `Imported ${cells.length} part${cells.length === 1 ? '' : 's'} from catalog`;
    } else {
      this.status = skipped
        ? `Imported ${cells.length} cells (skipped ${skipped} with unsupported shapes)`
        : `Imported ${cells.length} cells from JSON`;
    }
  }

  /**
   * Convert a parts-catalog API response (the `partserviceresult` shape produced by
   * the part-search service) into block-card node metadata, one card per part, laid
   * out in a grid. Returns `null` when the payload isn't a parts catalog so the
   * caller can fall through to its generic "not a diagram" handling.
   */
  private partsResultToCells(data: any): any[] | null {
    const parts = data?.partserviceresult?.parts;
    if (!Array.isArray(parts)) return null;

    const CARD_W = 200;
    const CARD_H = 64;
    const GAP_X = 40;
    const GAP_Y = 48;
    const cols = Math.max(1, Math.min(parts.length, 4));

    return parts.map((part: any, i: number) => {
      const title =
        part?.arwPartNum?.name || part?.suppPartNum?.name || part?.partKey || 'Part';
      const subtitle =
        part?.supp?.name || part?.mfr?.name || part?.icc?.name || 'Component';
      const row = Math.floor(i / cols);
      const col = i % cols;
      return {
        shape: 'block-card',
        x: 40 + col * (CARD_W + GAP_X),
        y: 40 + row * (CARD_H + GAP_Y),
        width: CARD_W,
        height: CARD_H,
        data: { typeKey: 'part', part },
        attrs: {
          badge: { fill: '#1d4ed8' },
          icon: { text: 'memory' },
          title: { text: String(title) },
          subtitle: { text: String(subtitle) },
        },
      };
    });
  }

  // ---------- draw.io interop ----------

  onDrawioSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => this.importDrawioXml(String(reader.result), file.name);
      reader.readAsText(file);
    }
    input.value = ''; // allow re-selecting the same file
  }

  /** Parse a .drawio/.xml file into editable nodes + edges on the canvas. */
  private async importDrawioXml(xml: string, fileName: string): Promise<void> {
    try {
      const { nodes, edges } = await importDrawio(xml);
      if (nodes.length === 0) {
        this.status = 'No shapes found in that draw.io file';
        return;
      }
      this.graph.startBatch('import-drawio');
      nodes.forEach((n) => this.graph.addNode(n));
      edges.forEach((e) => { try { this.graph.addEdge(e); } catch { /* skip dangling edge */ } });
      this.graph.stopBatch('import-drawio');

      if (!this.diagramName) this.diagramName = fileName.replace(/\.[^.]+$/, '');
      this.graph.zoomToFit({ padding: 24, maxScale: 1.5 });
      this.status = `Imported ${nodes.length} shapes from draw.io`;
      // fromJSON-style bulk add emits per-cell events, but push the whole canvas
      // to any active session so guests get the import in one shot.
      if (this.collab.active) this.collab.publishAll();
    } catch (err: any) {
      this.status = `draw.io import failed: ${err?.message || err}`;
    }
  }

  exportDrawioFile(): void {
    const xml = exportDrawio(this.graph, this.diagramName || 'diagram');
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.diagramName || 'diagram'}.drawio`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
