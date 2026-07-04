import { ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  FeedbackBoard, FeedbackLoopService, FeedbackThread,
} from '../../../../core/services/feedback-loop.service';

const ROLE_KEY = 'diagram.feedback.role';
/** Starter suggestions only — any tag typed by the user becomes a role. */
const DEFAULT_ROLES = ['Sales', 'Engineering', 'Customer'];

/**
 * The feedback loop dock: threaded reviews between whoever works the diagram.
 * Each participant acts under a free-form role tag (sales / engineering /
 * customer / QA / …) — roles are suggestions, never a fixed set — and each
 * reply can carry a decision that moves the loop:
 * comment → stays open · request changes → changes-requested · approve →
 * approved · close → closed (a new comment reopens it).
 */
@Component({
  selector: 'app-feedback-loop-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './feedback-loop-panel.component.html',
  styleUrls: ['./feedback-loop-panel.component.css'],
})
export class FeedbackLoopPanelComponent implements OnInit {
  @Input() diagramId: number | null = null;
  @Input() selectedNodeId: string | null = null;
  @Input() selectedNodeLabel = '';
  @Output() close = new EventEmitter<void>();
  @Output() focusNode = new EventEmitter<string>();
  /** Emitted whenever threads change so the host can refresh its badge. */
  @Output() changed = new EventEmitter<void>();

  board: FeedbackBoard = { threads: [], roles: [] };
  loading = false;
  error = '';
  sending = false;

  /** The role tag this user is acting under (persisted across sessions). */
  role = localStorage.getItem(ROLE_KEY) || '';

  composeOpen = false;
  newTitle = '';
  newText = '';
  attachToNode = true;

  openThreadId: number | null = null;
  replyText = '';

  constructor(private api: FeedbackLoopService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.reload();
  }

  get roleSuggestions(): string[] {
    return [...new Set([...this.board.roles, ...DEFAULT_ROLES])];
  }

  /** Threads that still need someone's attention. */
  get openCount(): number {
    return this.board.threads.filter((t) => t.status === 'open' || t.status === 'changes-requested').length;
  }

  reload(): void {
    if (this.diagramId == null) return;
    this.loading = true;
    this.api.board(this.diagramId).subscribe({
      next: (b) => { this.board = b; this.loading = false; this.error = ''; this.cdr.detectChanges(); },
      error: (e) => { this.loading = false; this.error = this.reason(e); this.cdr.detectChanges(); },
    });
  }

  saveRole(): void {
    localStorage.setItem(ROLE_KEY, this.role.trim());
  }

  submitThread(): void {
    if (this.diagramId == null || this.sending) return;
    const text = this.newText.trim();
    if (!text && !this.newTitle.trim()) return;
    this.sending = true;
    this.saveRole();
    this.api.create(this.diagramId, {
      title: this.newTitle.trim(), text,
      nodeId: this.attachToNode && this.selectedNodeId ? this.selectedNodeId : null,
      role: this.role.trim(),
    }).subscribe({
      next: (t) => {
        this.sending = false;
        this.composeOpen = false;
        this.newTitle = ''; this.newText = '';
        this.board = { ...this.board, threads: [t, ...this.board.threads] };
        this.openThreadId = t.id;
        this.changed.emit();
        this.cdr.detectChanges();
      },
      error: (e) => { this.sending = false; this.error = this.reason(e); this.cdr.detectChanges(); },
    });
  }

  reply(thread: FeedbackThread, decision: string): void {
    if (this.sending) return;
    const text = this.replyText.trim();
    if (!text && decision === 'comment') return;
    this.sending = true;
    this.saveRole();
    this.api.reply(thread.id, { role: this.role.trim(), decision, text }).subscribe({
      next: (t) => {
        this.sending = false;
        this.replyText = '';
        this.board = {
          ...this.board,
          threads: this.board.threads.map((x) => (x.id === t.id ? t : x)),
        };
        this.changed.emit();
        this.cdr.detectChanges();
      },
      error: (e) => { this.sending = false; this.error = this.reason(e); this.cdr.detectChanges(); },
    });
  }

  toggleThread(t: FeedbackThread): void {
    this.openThreadId = this.openThreadId === t.id ? null : t.id;
    this.replyText = '';
  }

  statusLabel(s: string): string {
    return s === 'changes-requested' ? 'Changes requested'
      : s === 'approved' ? 'Approved'
      : s === 'closed' ? 'Closed' : 'Open';
  }

  decisionIcon(d: string): string {
    return d === 'request-changes' ? 'published_with_changes'
      : d === 'approve' ? 'check_circle'
      : d === 'close' ? 'cancel' : 'chat_bubble';
  }

  decisionLabel(d: string): string {
    return d === 'request-changes' ? 'requested changes'
      : d === 'approve' ? 'approved'
      : d === 'close' ? 'closed the discussion' : '';
  }

  private reason(e: any): string {
    return e?.error?.message || e?.message || 'Feedback request failed.';
  }
}
