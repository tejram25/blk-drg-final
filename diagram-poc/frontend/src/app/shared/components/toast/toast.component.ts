import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { NotificationService, ToastKind } from '../../../core/services/notification.service';

/** Renders the stack of toasts from NotificationService (errors, successes, info). */
@Component({
    selector: 'app-toast',
    imports: [CommonModule, MatIconModule],
    templateUrl: './toast.component.html',
    styleUrls: ['./toast.component.css']
})
export class ToastComponent {
  private notify = inject(NotificationService);
  readonly toasts = this.notify.toasts;

  icon(kind: ToastKind): string {
    return kind === 'error' ? 'error' : kind === 'success' ? 'check_circle' : 'info';
  }

  dismiss(id: number): void {
    this.notify.dismiss(id);
  }
}
