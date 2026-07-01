import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VersionService } from './version.service';
import { apiBaseUrl } from '../app-config';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('VersionService', () => {
  let service: VersionService;
  let http: HttpTestingController;
  const API = apiBaseUrl();

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [], providers: [VersionService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()] });
    service = TestBed.inject(VersionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('snapshots with label and content', () => {
    service.snapshot(2, 'v1', '{"cells":[]}').subscribe();
    const req = http.expectOne(`${API}/diagrams/2/versions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ label: 'v1', contentJson: '{"cells":[]}' });
    req.flush({ id: 1, label: 'v1', authorName: 'A', createdAt: '' });
  });

  it('lists versions', () => {
    service.list(2).subscribe();
    const req = http.expectOne(`${API}/diagrams/2/versions`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
