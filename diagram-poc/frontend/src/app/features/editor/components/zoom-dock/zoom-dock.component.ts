import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '../../../../core/services/i18n/translate.pipe';

/** Floating zoom controls. Presentation only — the parent performs the zoom. */
@Component({
  selector: 'app-zoom-dock',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe],
  templateUrl: './zoom-dock.component.html',
  styleUrls: ['./zoom-dock.component.css'],
})
export class ZoomDockComponent {
  @Input() zoom = 100;
  @Output() zoomIn = new EventEmitter<void>();
  @Output() zoomOut = new EventEmitter<void>();
  @Output() fit = new EventEmitter<void>();
  @Output() reset = new EventEmitter<void>();
}
