import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastComponent } from './shared/components/toast/toast.component';
import { ThemeService } from './core/services/theme.service';

/** Root component: the router outlet plus the global toast overlay. */
@Component({
    selector: 'app-root',
    imports: [RouterOutlet, ToastComponent],
    templateUrl: './app.component.html'
})
export class AppComponent {
  /** Injected for its constructor side effect: applies the stored theme on boot. */
  private readonly theme = inject(ThemeService);
}
