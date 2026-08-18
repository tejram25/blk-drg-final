import { Component, EventEmitter, Input, Output } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FeedbackRequest } from '../../../../core/services/feedback.service';

/**
 * Feedback-loop dialog: category, 1-5 rating and a free-text message.
 * Presentational — the parent submits it and shows the toast.
 */
@Component({
    selector: 'app-feedback-dialog',
    imports: [FormsModule, MatButtonModule, MatIconModule],
    templateUrl: './feedback-dialog.component.html',
    styleUrls: ['./feedback-dialog.component.css']
})
export class FeedbackDialogComponent {
  @Input() submitting = false;
  @Output() submitFeedback = new EventEmitter<FeedbackRequest>();
  @Output() close = new EventEmitter<void>();

  categories = [
    { key: 'usability', label: 'Usability' },
    { key: 'bug', label: 'Bug' },
    { key: 'feature', label: 'Feature request' },
    { key: 'ai-quality', label: 'AI quality' },
    { key: 'general', label: 'General' },
  ];

  category = 'usability';
  rating = 0;
  message = '';

  stars = [1, 2, 3, 4, 5];

  get canSubmit(): boolean {
    return !this.submitting && (this.rating > 0 || this.message.trim().length > 0);
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.submitFeedback.emit({
      category: this.category,
      rating: this.rating,
      message: this.message.trim(),
    });
  }
}
