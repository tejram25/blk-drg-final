import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DiagramService } from './diagram.service';
import { apiBaseUrl } from '../app-config';

describe('DiagramService', () => {
  let service: DiagramService;
  let http: HttpTestingController;
  const API = apiBaseUrl();

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DiagramService],
    });
    service = TestBed.inject(DiagramService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists diagrams via GET /diagrams', () => {
    service.list().subscribe();
    const req = http.expectOne(`${API}/diagrams`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('posts a review with the rating and comment in the body', () => {
    service.postReview(7, 5, 'great template').subscribe();
    const req = http.expectOne(`${API}/diagrams/7/reviews`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ rating: 5, comment: 'great template' });
    req.flush({ average: 5, count: 1, distribution: {}, mine: { rating: 5, comment: 'great template' }, reviews: [] });
  });

  it('fetches the review summary via GET /reviews/summary', () => {
    service.reviewSummary().subscribe();
    const req = http.expectOne(`${API}/reviews/summary`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
