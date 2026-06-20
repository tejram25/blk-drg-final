import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { CommentService } from './comment.service';
import { apiBaseUrl } from '../app-config';

describe('CommentService', () => {
  let service: CommentService;
  let http: HttpTestingController;
  const API = apiBaseUrl();

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule], providers: [CommentService] });
    service = TestBed.inject(CommentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('adds a comment pinned to a node', () => {
    service.add(3, 'node-7', 'looks good').subscribe();
    const req = http.expectOne(`${API}/diagrams/3/comments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nodeId: 'node-7', text: 'looks good' });
    req.flush({ id: 1, nodeId: 'node-7', authorName: 'A', text: 'looks good', createdAt: '', self: true });
  });

  it('deletes a comment', () => {
    service.delete(9).subscribe();
    const req = http.expectOne(`${API}/comments/9`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
