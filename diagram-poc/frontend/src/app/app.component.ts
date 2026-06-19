import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root component: a router outlet. Auth gating is handled by the route guard. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
export class AppComponent {}
