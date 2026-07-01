import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DiagramService } from './diagram.service';
import { apiBaseUrl } from '../app-config';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('DiagramService', () => {
  let service: DiagramService;
  let http: HttpTestingController;
  const API = apiBaseUrl();

  beforeEach(() => {
    TestBed.configureTestingModule({
    imports: [],
    providers: [DiagramService, provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()]
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

  it('creates a diagram via POST /diagrams', () => {
    service.create({ name: 'n', contentJson: '{}' }).subscribe();
    const req = http.expectOne(`${API}/diagrams`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'n', contentJson: '{}' });
    req.flush({ id: 1, name: 'n', contentJson: '{}' });
  });

  it('deletes a diagram via DELETE /diagrams/:id', () => {
    service.delete(5).subscribe();
    const req = http.expectOne(`${API}/diagrams/5`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
