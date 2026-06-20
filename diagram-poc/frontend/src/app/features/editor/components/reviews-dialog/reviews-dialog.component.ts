import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReviewData, ReviewService } from '../../../../core/services/review.service';
import { StarRatingComponent } from '../../../../shared/components/star-rating/star-rating.component';

/**
 * Reviews modal for a saved diagram: average + distribution, an editable
 * "your review" form, and the list of reviews. Self-contained — it loads and
 * submits via ReviewService and emits `saved` so the parent can refresh badges.
 */
@Component({
  selector: 'app-reviews-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, StarRatingComponent],
  templateUrl: './reviews-dialog.component.html',
  styleUrls: ['./reviews-dialog.component.css'],
})
export class ReviewsDialogComponent implements OnInit {
  @Input({ required: true }) diagramId!: number;
  @Input() diagramName = '';
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  data: ReviewData | null = null;
  myRating = 0;
  myComment = '';
  saving = false;
  readonly distKeys = [5, 4, 3, 2, 1];

  constructor(private reviews: ReviewService) {}

  ngOnInit(): void {
    this.reviews.forDiagram(this.diagramId).subscribe({
      next: (d) => this.apply(d),
      error: () => { /* keep the loading state */ },
    });
  }

  submit(): void {
    if (!this.myRating || this.saving) return;
    this.saving = true;
    this.reviews.submit(this.diagramId, this.myRating, this.myComment).subscribe({
      next: (d) => {
        this.apply(d);
        this.saving = false;
        this.saved.emit();
      },
      error: () => (this.saving = false),
    });
  }

  private apply(d: ReviewData): void {
    this.data = d;
    this.myRating = d.mine?.rating ?? 0;
    this.myComment = d.mine?.comment ?? '';
  }
}
