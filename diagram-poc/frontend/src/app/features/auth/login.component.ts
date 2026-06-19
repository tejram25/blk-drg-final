import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

type Mode = 'signin' | 'register';

/**
 * Sign-in / create-account screen. Shown by AppShellComponent whenever there's no
 * authenticated session. Registration has no email step — a successful register (or
 * sign-in) sets AuthService.user, which flips the shell straight to the app.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrap">
      <form class="login-card" (ngSubmit)="submit()" autocomplete="on">
        <div class="brand">
          <span class="material-icons brand-glyph">schema</span>
          <span class="brand-name">Block Diagram Builder</span>
        </div>

        <!-- Mode tabs -->
        <div class="tabs" role="tablist">
          <button type="button" class="tab" [class.active]="mode === 'signin'"
                  (click)="setMode('signin')" [disabled]="loading">Sign in</button>
          <button type="button" class="tab" [class.active]="mode === 'register'"
                  (click)="setMode('register')" [disabled]="loading">Create account</button>
        </div>

        <p class="sub">
          {{ mode === 'signin'
              ? 'Sign in to open the diagram workspace.'
              : 'Create an account to get started.' }}
        </p>

        <ng-container *ngIf="mode === 'register'">
          <label for="login-name">Name</label>
          <input id="login-name" name="name" type="text" autocomplete="name"
                 [(ngModel)]="name" [disabled]="loading" />
        </ng-container>

        <label for="login-email">Email</label>
        <input id="login-email" name="email" type="email" autocomplete="email"
               [(ngModel)]="email" [disabled]="loading" autofocus />

        <label for="login-password">Password</label>
        <input id="login-password" name="password" type="password"
               [autocomplete]="mode === 'register' ? 'new-password' : 'current-password'"
               [(ngModel)]="password" [disabled]="loading" />

        <ng-container *ngIf="mode === 'register'">
          <label for="login-confirm">Confirm password</label>
          <input id="login-confirm" name="confirm" type="password" autocomplete="new-password"
                 [(ngModel)]="confirm" [disabled]="loading" />

          <ng-container *ngIf="inviteRequired">
            <label for="login-invite">Invite code</label>
            <input id="login-invite" name="invite" type="text" autocomplete="off"
                   [(ngModel)]="inviteCode" [disabled]="loading" />
          </ng-container>

          <p class="hint">At least 8 characters.</p>
        </ng-container>

        <p class="error" *ngIf="error">{{ error }}</p>

        <button type="submit" class="signin" [disabled]="loading">
          {{ loading
              ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
              : (mode === 'signin' ? 'Sign in' : 'Create account') }}
        </button>

        <p class="switch">
          <ng-container *ngIf="mode === 'signin'">
            New here?
            <button type="button" class="link" (click)="setMode('register')" [disabled]="loading">Create an account</button>
          </ng-container>
          <ng-container *ngIf="mode === 'register'">
            Already have an account?
            <button type="button" class="link" (click)="setMode('signin')" [disabled]="loading">Sign in</button>
          </ng-container>
        </p>
      </form>
    </div>
  `,
  styles: [`
    .login-wrap {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
      background:
        radial-gradient(1100px 560px at 50% -12%, #1f2a44 0%, rgba(20,21,24,0) 62%),
        #141518;
    }
    .login-card {
      width: 100%; max-width: 372px;
      display: flex; flex-direction: column;
      background: #1b1d22; border: 1px solid #2c2e36; border-radius: 14px;
      padding: 26px 26px 22px; box-shadow: 0 20px 60px rgba(0,0,0,.45);
    }
    .brand { display: flex; align-items: center; gap: 9px; margin-bottom: 16px; }
    .brand-glyph { color: #f5a623; font-size: 26px; }
    .brand-name { font-weight: 700; font-size: 15px; color: #ececef; letter-spacing: .2px; }
    .tabs { display: flex; gap: 6px; background: #141518; border: 1px solid #2c2e36; border-radius: 10px; padding: 4px; margin-bottom: 16px; }
    .tab {
      flex: 1; padding: 8px 10px; border: none; border-radius: 7px; cursor: pointer;
      background: transparent; color: #9aa0a8; font-size: 13px; font-weight: 600; font-family: inherit;
    }
    .tab.active { background: #26282f; color: #fff; }
    .tab:disabled { cursor: default; }
    .sub { margin: 0 0 16px; font-size: 13px; color: #9aa0a8; }
    label { font-size: 12px; color: #b4b6bd; margin: 10px 0 6px; font-weight: 600; }
    input {
      height: 40px; padding: 0 12px; border-radius: 9px;
      background: #141518; border: 1px solid #34353c; color: #ececef;
      font-size: 14px; outline: none; font-family: inherit;
    }
    input:focus { border-color: #f5a623; box-shadow: 0 0 0 3px rgba(245,166,35,.15); }
    .hint { margin: 6px 0 0; font-size: 11.5px; color: #7e828b; }
    .error { margin: 12px 0 0; color: #ff6b6b; font-size: 13px; }
    .signin {
      margin-top: 20px; height: 42px; border: none; border-radius: 9px; cursor: pointer;
      background: #f5a623; color: #1a1303; font-weight: 700; font-size: 14px; font-family: inherit;
    }
    .signin:disabled { opacity: .6; cursor: default; }
    .signin:not(:disabled):hover { background: #ffb733; }
    .switch { margin: 16px 0 0; font-size: 13px; color: #9aa0a8; text-align: center; }
    .link {
      background: none; border: none; padding: 0; cursor: pointer; font-family: inherit;
      color: #f5a623; font-size: 13px; font-weight: 600; text-decoration: underline;
    }
    .link:disabled { opacity: .6; cursor: default; }
  `],
})
export class LoginComponent implements OnInit {
  mode: Mode = 'signin';
  name = '';
  email = '';
  password = '';
  confirm = '';
  inviteCode = '';
  inviteRequired = false;
  error = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    this.inviteRequired = (await this.auth.getConfig()).inviteRequired;
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.error = '';
    this.name = '';
    this.confirm = '';
    this.inviteCode = '';
  }

  async submit(): Promise<void> {
    if (this.loading) return;
    this.error = '';

    const email = this.email.trim();
    if (!email || !this.password) {
      this.error = 'Enter your email and password.';
      return;
    }
    if (this.mode === 'register') {
      if (!this.name.trim()) {
        this.error = 'Enter your name.';
        return;
      }
      if (this.password.length < 8) {
        this.error = 'Password must be at least 8 characters.';
        return;
      }
      if (this.password !== this.confirm) {
        this.error = 'Passwords do not match.';
        return;
      }
      if (this.inviteRequired && !this.inviteCode.trim()) {
        this.error = 'Enter the invite code.';
        return;
      }
    }

    this.loading = true;
    try {
      if (this.mode === 'register') {
        await this.auth.register(this.name.trim(), email, this.password, this.inviteCode.trim() || undefined);
      } else {
        await this.auth.login(email, this.password);
      }
      // Signed in — go to the editor.
      await this.router.navigateByUrl('/editor');
    } catch (e: any) {
      this.error = e?.error?.message
        || (e?.status === 0
            ? 'Cannot reach the server — is the backend running?'
            : 'Something went wrong. Please try again.');
    } finally {
      this.loading = false;
    }
  }
}
