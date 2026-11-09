import type { EnvironmentProviders } from '@angular/core';
import { provideTransloco, type Translation, type TranslocoLoader } from '@jsverse/transloco';
import { of, type Observable } from 'rxjs';
import en from '../../../public/i18n/en.json';

/**
 * Real English strings in tests, so you can query by the text users see.
 * Pass feature scopes with their JSON, keyed by scope name:
 *
 *   provideTestTransloco({ schedule: scheduleEn })
 *
 * Scoped files are loaded by Transloco as `<scope>/en`.
 */
export function provideTestTransloco(
  scopes: Record<string, Translation> = {},
): EnvironmentProviders[] {
  class TestLoader implements TranslocoLoader {
    getTranslation(lang: string): Observable<Translation> {
      if (lang === 'en') return of(en as Translation);
      const [scope] = lang.split('/');
      return of(scopes[scope ?? ''] ?? {});
    }
  }
  return provideTransloco({
    config: { availableLangs: ['en'], defaultLang: 'en', prodMode: true },
    loader: TestLoader,
  });
}
