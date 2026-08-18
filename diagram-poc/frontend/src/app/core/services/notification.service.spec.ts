import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
  });

  it('adds an error toast', () => {
    service.error('boom');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].kind).toBe('error');
    expect(service.toasts()[0].text).toBe('boom');
  });

  it('de-dupes identical active messages', () => {
    const first = service.error('boom');
    const second = service.error('boom');
    expect(second).toBe(first);
    expect(service.toasts().length).toBe(1);
  });

  it('keeps different messages separate', () => {
    service.error('a');
    service.success('b');
    expect(service.toasts().length).toBe(2);
  });

  it('dismiss removes a toast by id', () => {
    const id = service.success('ok');
    service.dismiss(id);
    expect(service.toasts().length).toBe(0);
  });
});
