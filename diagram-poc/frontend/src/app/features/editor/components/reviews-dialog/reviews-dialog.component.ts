import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReviewData, ReviewService, ReviewSource } from '../../../../core/services/review.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { StarRatingComponent } from '../../../../shared/components/star-rating/star-rating.component';

/**
 * Reviews modal: average + distribution, an editable "your review" form, and the
 * list of reviews. Data‑source‑agnostic — it works against a {@link ReviewSource},
 * so the same modal serves diagrams and templates. For backwards compatibility it
 * falls back to a diagram source built from `diagramId` when no `source` is given.
 * Emits `saved` so the parent can refresh any badges.
 */
@Component({
    selector: 'app-reviews-dialog',
    imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, StarRatingComponent],
    templateUrl: './reviews-dialog.component.html',
    styleUrls: ['./reviews-dialog.component.css']
})
export class ReviewsDialogComponent implements OnInit {
  /** Diagram backing (legacy/default). Ignored when an explicit `source` is set. */
  @Input() diagramId?: number;
  /** Subject name shown under the title (diagram or template name). */
  @Input() diagramName = '';
  /** Explicit data source (e.g. a template). Wins over `diagramId`. */
  @Input() source?: ReviewSource;
  /** Label for the empty "rate" state. */
  @Input() rateLabel = 'Rate this';
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  data: ReviewData | null = null;
  myRating = 0;
  myComment = '';
  saving = false;
  readonly distKeys = [5, 4, 3, 2, 1];

  constructor(private reviews: ReviewService, private notify: NotificationService) {}

  ngOnInit(): void {
    this.resolved().load().subscribe({
      next: (d) => this.apply(d),
      error: () => { /* keep the loading state */ },
    });
  }

  submit(): void {
    if (!this.myRating || this.saving) return;
    this.saving = true;
    this.resolved().submit(this.myRating, this.myComment).subscribe({
      next: (d) => {
        this.apply(d);
        this.saving = false;
        this.notify.success('Review saved');
        this.saved.emit();
      },
      error: () => (this.saving = false), // error toast handled globally
    });
  }

  /** The active source: the explicit one, or a diagram source from `diagramId`. */
  private resolved(): ReviewSource {
    if (this.source) return this.source;
    const id = this.diagramId!;
    return {
      load: () => this.reviews.forDiagram(id),
      submit: (rating, comment) => this.reviews.submit(id, rating, comment),
    };
  }

  private apply(d: ReviewData): void {
    this.data = d;
    this.myRating = d.mine?.rating ?? 0;
    this.myComment = d.mine?.comment ?? '';
  }
}
