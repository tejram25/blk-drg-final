import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TemplateService } from './template.service';
import { apiBaseUrl } from '../app-config';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('TemplateService', () => {
  let service: TemplateService;
  let http: HttpTestingController;
  const API = apiBaseUrl();

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [], providers: [TemplateService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()] });
    service = TestBed.inject(TemplateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists templates', () => {
    service.list().subscribe();
    const req = http.expectOne(`${API}/templates`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('uses a template via POST /use', () => {
    service.use(7).subscribe();
    const req = http.expectOne(`${API}/templates/7/use`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 7, name: 'T', usageCount: 1, contentJson: '{"cells":[]}', updatedAt: '', createdAt: '' });
  });

  it('creates a template with the request body', () => {
    service.create({ name: 'My T', description: 'd', category: 'Power', contentJson: '{"cells":[]}' }).subscribe();
    const req = http.expectOne(`${API}/templates`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'My T', description: 'd', category: 'Power', contentJson: '{"cells":[]}' });
    req.flush({ id: 1, name: 'My T', usageCount: 0, contentJson: '{"cells":[]}', updatedAt: '', createdAt: '' });
  });

  it('updates (improves) a template via PUT', () => {
    service.update(3, { name: 'New', contentJson: '{"cells":[]}' }).subscribe();
    const req = http.expectOne(`${API}/templates/3`);
    expect(req.request.method).toBe('PUT');
    req.flush({ id: 3, name: 'New', usageCount: 2, contentJson: '{"cells":[]}', updatedAt: '', createdAt: '' });
  });

  it('rates a template via POST /rating', () => {
    service.rate(5, 4).subscribe();
    const req = http.expectOne(`${API}/templates/5/rating`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ rating: 4 });
    req.flush({ id: 5, name: 'T', usageCount: 0, avgRating: 4, ratingCount: 1, myRating: 4,
      contentJson: '{"cells":[]}', updatedAt: '', createdAt: '' });
  });

  it('loads full reviews via GET /reviews', () => {
    service.reviews(5).subscribe();
    const req = http.expectOne(`${API}/templates/5/reviews`);
    expect(req.request.method).toBe('GET');
    req.flush({ average: 0, count: 0, distribution: {}, mine: null, reviews: [] });
  });

  it('submits a review via POST /reviews', () => {
    service.submitReview(5, 4, 'nice').subscribe();
    const req = http.expectOne(`${API}/templates/5/reviews`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ rating: 4, comment: 'nice' });
    req.flush({ average: 4, count: 1, distribution: { '4': 1 }, mine: { rating: 4, comment: 'nice' }, reviews: [] });
  });

  it('deletes a template', () => {
    service.delete(9).subscribe();
    const req = http.expectOne(`${API}/templates/9`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
