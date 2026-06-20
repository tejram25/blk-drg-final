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
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
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
