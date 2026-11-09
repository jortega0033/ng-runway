import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal, type EnvironmentProviders } from '@angular/core';
import {
  TranslocoService,
  provideTransloco,
  type Translation,
  type TranslocoLoader,
} from '@jsverse/transloco';
import type { Observable } from 'rxjs';

export const LANGUAGES = ['en', 'nl'] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_STORAGE_KEY = 'lang';

/** Loads the shared strings from `public/i18n/<lang>.json`, next to index.html. */
@Injectable({ providedIn: 'root' })
export class HttpTranslocoLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string): Observable<Translation> {
    return this.http.get<Translation>(new URL(`i18n/${lang}.json`, document.baseURI).toString());
  }
}

export function provideI18n(): EnvironmentProviders[] {
  return provideTransloco({
    config: {
      availableLangs: [...LANGUAGES],
      defaultLang: readStoredLanguage(),
      fallbackLang: 'en',
      reRenderOnLangChange: true,
      prodMode: true,
    },
    loader: HttpTranslocoLoader,
  });
}

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'en' || stored === 'nl') return stored;
  } catch {
    // Storage blocked: fall back to the browser language below.
  }
  return typeof navigator !== 'undefined' && navigator.language.startsWith('nl') ? 'nl' : 'en';
}

/** Current language and the switch. Saves the choice and keeps `<html lang>` in sync. */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly current = signal<Language>(this.transloco.getActiveLang() as Language);
  readonly language = this.current.asReadonly();

  constructor() {
    document.documentElement.lang = this.current();
  }

  set(language: Language): void {
    this.transloco.setActiveLang(language);
    this.current.set(language);
    document.documentElement.lang = language;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Ignore: the choice just will not survive a reload.
    }
  }
}
