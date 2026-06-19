import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth/auth.service';
import { LoginComponent } from './auth/login.component';
import { AppComponent } from './app.component';

/**
 * Root shell. Runs the initial session check, then renders either the login
 * screen or the diagram app (`<app-canvas>`). The canvas component isn't created
 * until you're signed in, so no diagram/API calls fire before authentication.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LoginComponent, AppComponent],
  template: `
    <ng-container [ngSwitch]="view()">
      <div *ngSwitchCase="'loading'" class="boot">
        <span class="material-icons spin">autorenew</span>
        <span>Loading…</span>
      </div>
      <app-login *ngSwitchCase="'login'"></app-login>
      <app-canvas *ngSwitchCase="'app'"></app-canvas>
    </ng-container>
  `,
  styles: [`
    .boot {
      height: 100vh; display: flex; flex-direction: column;
      gap: 12px; align-items: center; justify-content: center; color: #9aa0a8;
    }
    .boot .material-icons { font-size: 34px; color: #f5a623; }
    .spin { animation: shell-spin 1s linear infinite; }
    @keyframes shell-spin { to { transform: rotate(360deg); } }
  `],
})
export class AppShellComponent implements OnInit {
  constructor(public auth: AuthService) {}

  ngOnInit(): void {
    this.auth.restore();
  }

  view(): 'loading' | 'login' | 'app' {
    if (!this.auth.ready()) return 'loading';
    return this.auth.user() ? 'app' : 'login';
  }
}
