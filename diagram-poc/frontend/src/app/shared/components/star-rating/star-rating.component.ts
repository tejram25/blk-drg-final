import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

/**
 * Reusable star rating. Read-only mode renders a (possibly fractional) average
 * with full/half/empty stars; interactive mode lets the user pick a rating with
 * hover preview and emits `ratingChange`.
 */
@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './star-rating.component.html',
  styleUrls: ['./star-rating.component.css'],
})
export class StarRatingComponent {
  @Input() rating = 0;
  @Input() max = 5;
  @Input() readonly = true;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Output() ratingChange = new EventEmitter<number>();

  hover = 0;

  get stars(): number[] {
    return Array.from({ length: this.max }, (_, i) => i + 1);
  }

  icon(star: number): string {
    if (this.readonly) {
      if (this.rating >= star) return 'star';
      if (this.rating >= star - 0.5) return 'star_half';
      return 'star_border';
    }
    return star <= (this.hover || this.rating) ? 'star' : 'star_border';
  }

  pick(star: number): void {
    if (this.readonly) return;
    this.rating = star;
    this.ratingChange.emit(star);
  }
}
