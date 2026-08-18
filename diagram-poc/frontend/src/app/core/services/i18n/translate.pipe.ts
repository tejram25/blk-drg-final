import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from './translate.service';

/**
 * {{ 'some.id' | translate }} — looks the key up in the active language.
 *
 * Impure so it re-evaluates when the language changes (the active language is
 * mutable app state, not an input to the pipe). The lookup is a cheap object
 * read, so running it per change-detection pass is fine for this app.
 */
@Pipe({ name: 'translate', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  constructor(private i18n: TranslateService) {}

  transform(key: string): string {
    return this.i18n.t(key);
  }
}
