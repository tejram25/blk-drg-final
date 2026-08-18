import { Injectable, signal } from '@angular/core';

export type ToastKind = 'error' | 'success' | 'info';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

/**
 * Central place to surface user-facing messages (errors, successes, info) as
 * dismissable toasts. Components/interceptors call it; ToastComponent renders
 * the `toasts` signal. Identical active messages are de-duped to avoid spam
 * when several requests fail at once.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private seq = 0;
  readonly toasts = signal<Toast[]>([]);

  error(text: string): number {
    return this.push('error', text, 7000);
  }

  success(text: string): number {
    return this.push('success', text, 4000);
  }

  info(text: string): number {
    return this.push('info', text, 4000);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: ToastKind, text: string, ttlMs: number): number {
    const existing = this.toasts().find((t) => t.kind === kind && t.text === text);
    if (existing) return existing.id; // already showing the same message
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { id, kind, text }]);
    if (ttlMs > 0) {
      setTimeout(() => this.dismiss(id), ttlMs);
    }
    return id;
  }
}
