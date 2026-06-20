import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../core/services/i18n/translate.pipe';

/** Bottom status bar: shows the latest status message (or "ready") and hints. */
@Component({
  selector: 'app-status-bar',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './status-bar.component.html',
  styleUrls: ['./status-bar.component.css'],
})
export class StatusBarComponent {
  @Input() status = '';
}
