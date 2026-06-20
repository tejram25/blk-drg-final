import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PartSearchService } from './part-search.service';
import { apiBaseUrl } from '../app-config';

describe('PartSearchService', () => {
  let service: PartSearchService;
  let http: HttpTestingController;
  const API = apiBaseUrl();

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [PartSearchService] });
    service = TestBed.inject(PartSearchService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('queries the proxy and flattens partserviceresult', () => {
    let hits: any[] = [];
    service.search('INA250').subscribe((h) => (hits = h));
    const req = http.expectOne((r) => r.url === `${API}/parts/search`);
    expect(req.request.params.get('q')).toBe('INA250');
    req.flush({
      partserviceresult: {
        parts: [
          { arwPartNum: { name: 'INA250A3PWR' }, supp: { name: 'TI' }, mfr: { name: 'Texas Instruments' },
            invOrgs: [{ desc: 'Current Sense Amp' }] },
        ],
      },
    });
    expect(hits.length).toBe(1);
    expect(hits[0].partNumber).toBe('INA250A3PWR');
    expect(hits[0].manufacturer).toBe('Texas Instruments');
  });
});
