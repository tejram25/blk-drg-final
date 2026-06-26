import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { RecommendationService } from './recommendation.service';
import { apiBaseUrl } from '../app-config';

describe('RecommendationService', () => {
  let service: RecommendationService;
  let http: HttpTestingController;
  const API = apiBaseUrl();

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [RecommendationService] });
    service = TestBed.inject(RecommendationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts goal + currentParts and returns results', () => {
    let result: any;
    service.recommend('Power supply', ['LM317T']).subscribe((r) => (result = r));
    const req = http.expectOne(`${API}/recommendations`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ goal: 'Power supply', currentParts: ['LM317T'] });
    req.flush({ items: [], model: 'rule-based', aiGenerated: false });
    expect(result.model).toBe('rule-based');
  });
});
