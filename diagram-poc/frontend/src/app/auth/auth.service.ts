import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { apiBaseUrl } from '../app-config';

export interface AuthUser {
  email: string;
  name?: string;
}

export interface AuthConfig {
  inviteRequired: boolean;
}

/**
 * Session-based auth state.
 *
 * The backend issues a session cookie on register/login; the credentials
 * interceptor sends it with every request. No roles — authorization is simply
 * "logged-in vs not". Registration has no email step: the backend creates the
 * account and starts the session, so a successful register signs you straight in.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = apiBaseUrl();

  /** Current signed-in user, or null. Read in templates as `auth.user()`. */
  readonly user = signal<AuthUser | null>(null);
  /** True once the initial session check has finished (prevents a login flash). */
  readonly ready = signal(false);

  constructor(private http: HttpClient) {}

  get isAuthenticated(): boolean {
    return this.user() !== null;
  }

  /** Restore an existing session on app start (GET /auth/me). */
  async restore(): Promise<void> {
    try {
      const u = await firstValueFrom(this.http.get<AuthUser>(`${this.api}/auth/me`));
      this.user.set(u);
    } catch {
      this.user.set(null);
    } finally {
      this.ready.set(true);
    }
  }

  /** Whether registration requires an invite code (controls the extra field). */
  async getConfig(): Promise<AuthConfig> {
    try {
      return await firstValueFrom(this.http.get<AuthConfig>(`${this.api}/auth/config`));
    } catch {
      return { inviteRequired: false };
    }
  }

  /** Create an account and sign in (the backend starts the session). */
  async register(name: string, email: string, password: string, inviteCode?: string): Promise<void> {
    const u = await firstValueFrom(
      this.http.post<AuthUser>(`${this.api}/auth/register`, { name, email, password, inviteCode }));
    this.user.set(u);
  }

  /** Sign in; rejects with the HttpErrorResponse on failure. */
  async login(email: string, password: string): Promise<void> {
    const u = await firstValueFrom(
      this.http.post<AuthUser>(`${this.api}/auth/login`, { email, password }));
    this.user.set(u);
  }

  /** End the session. Clears local state even if the network call fails. */
  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.api}/auth/logout`, {}));
    } catch {
      /* ignore network errors on logout */
    } finally {
      this.user.set(null);
    }
  }
}
