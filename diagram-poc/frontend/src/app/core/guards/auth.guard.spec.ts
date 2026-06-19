import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { signal } from '@angular/core';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  function configure(user: { email: string } | null) {
    const urlTree = {} as UrlTree;
    const router = {
      createUrlTree: jasmine.createSpy('createUrlTree').and.returnValue(urlTree),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal(user) } },
        { provide: Router, useValue: router },
      ],
    });
    return { router, urlTree };
  }

  const run = () =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  it('allows activation when signed in', () => {
    configure({ email: 'a@b.com' });
    expect(run()).toBeTrue();
  });

  it('redirects to /login when signed out', () => {
    const { router, urlTree } = configure(null);
    expect(run()).toBe(urlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });
});
