import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReviewService } from './review.service';
import { apiBaseUrl } from '../app-config';

describe('ReviewService', () => {
  let service: ReviewService;
  let http: HttpTestingController;
  const API = apiBaseUrl();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ReviewService],
    });
    service = TestBed.inject(ReviewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('submits a review with the rating and comment in the body', () => {
    service.submit(7, 5, 'great template').subscribe();
    const req = http.expectOne(`${API}/diagrams/7/reviews`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ rating: 5, comment: 'great template' });
    req.flush({ average: 5, count: 1, distribution: {}, mine: { rating: 5, comment: 'great template' }, reviews: [] });
  });

  it('fetches the review summary via GET /reviews/summary', () => {
    service.summary().subscribe();
    const req = http.expectOne(`${API}/reviews/summary`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('fetches reviews for a diagram via GET /diagrams/:id/reviews', () => {
    service.forDiagram(3).subscribe();
    const req = http.expectOne(`${API}/diagrams/3/reviews`);
    expect(req.request.method).toBe('GET');
    req.flush({ average: 0, count: 0, distribution: {}, mine: null, reviews: [] });
  });
});
