import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { CommentItem, CommentService } from '../../../../core/services/comment.service';

/**
 * Side dock listing a diagram's comments. New comments are pinned to the
 * currently selected block (or general if none). Clicking a pinned comment asks
 * the parent to focus that block.
 */
@Component({
  selector: 'app-comments-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './comments-panel.component.html',
  styleUrls: ['./comments-panel.component.css'],
})
export class CommentsPanelComponent implements OnInit {
  @Input({ required: true }) diagramId!: number;
  @Input() selectedNodeId: string | null = null;
  @Input() selectedNodeLabel = '';
  @Output() close = new EventEmitter<void>();
  @Output() focusNode = new EventEmitter<string>();

  comments: CommentItem[] = [];
  draft = '';
  loading = true;

  constructor(private api: CommentService) {}

  ngOnInit(): void {
    this.api.list(this.diagramId).subscribe({
      next: (c) => { this.comments = c; this.loading = false; },
      error: () => (this.loading = false),
    });
  }

  send(): void {
    const text = this.draft.trim();
    if (!text) return;
    this.api.add(this.diagramId, this.selectedNodeId, text).subscribe({
      next: (c) => {
        this.comments = [...this.comments, c];
        this.draft = '';
      },
    });
  }

  remove(c: CommentItem): void {
    this.api.delete(c.id).subscribe({
      next: () => (this.comments = this.comments.filter((x) => x.id !== c.id)),
    });
  }

  focus(c: CommentItem): void {
    if (c.nodeId) this.focusNode.emit(c.nodeId);
  }
}
