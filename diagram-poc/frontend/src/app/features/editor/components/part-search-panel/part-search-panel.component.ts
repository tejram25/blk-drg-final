import { Component, EventEmitter, Output, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { PartHit, PartSearchService } from '../../../../core/services/part-search.service';

/**
 * Side dock to search the Arrow parts catalogue (via the backend proxy) and add
 * a result to the canvas as a part card.
 */
@Component({
  selector: 'app-part-search-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './part-search-panel.component.html',
  styleUrls: ['./part-search-panel.component.css'],
})
export class PartSearchPanelComponent implements AfterViewInit {
  @Output() close = new EventEmitter<void>();
  @Output() addPart = new EventEmitter<any>();
  @ViewChild('box') boxRef!: ElementRef<HTMLInputElement>;

  query = '';
  results: PartHit[] = [];
  loading = false;
  searched = false;

  constructor(private api: PartSearchService) {}

  ngAfterViewInit(): void {
    setTimeout(() => this.boxRef?.nativeElement.focus());
  }

  search(): void {
    const q = this.query.trim();
    if (!q || this.loading) return;
    this.loading = true;
    this.searched = true;
    this.api.search(q).subscribe({
      next: (hits) => { this.results = hits; this.loading = false; },
      error: () => { this.results = []; this.loading = false; }, // error toast shown globally
    });
  }

  add(hit: PartHit): void {
    this.addPart.emit(hit.raw);
  }
}
