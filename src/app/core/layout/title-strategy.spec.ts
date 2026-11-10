import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router, TitleStrategy, provideRouter } from '@angular/router';
import {
  TranslocoService,
  provideTransloco,
  type Translation,
  type TranslocoLoader,
} from '@jsverse/transloco';
import { firstValueFrom, of } from 'rxjs';
import { TranslatedTitleStrategy } from './title-strategy';

const TEXTS: Record<string, Translation> = {
  en: { nav: { timesheets: 'Timesheets' } },
  nl: { nav: { timesheets: 'Urenstaten' } },
};

class Loader implements TranslocoLoader {
  getTranslation(lang: string) {
    return of(TEXTS[lang] ?? {});
  }
}

@Component({ template: '' })
class Page {}

describe('TranslatedTitleStrategy', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'timesheets', title: 'nav.timesheets', component: Page },
          { path: 'plain', component: Page },
        ]),
        { provide: TitleStrategy, useExisting: TranslatedTitleStrategy },
        provideTransloco({
          config: { availableLangs: ['en', 'nl'], defaultLang: 'en', prodMode: true },
          loader: Loader,
        }),
      ],
    });
    const transloco = TestBed.inject(TranslocoService);
    await firstValueFrom(transloco.load('en'));
    await firstValueFrom(transloco.load('nl'));
  });

  it('sets "<Page> · ng-runway" from the route title key and follows the language', async () => {
    const router = TestBed.inject(Router);
    const title = TestBed.inject(Title);
    await router.navigateByUrl('/timesheets');
    expect(title.getTitle()).toBe('Timesheets · ng-runway');

    TestBed.inject(TranslocoService).setActiveLang('nl');
    expect(title.getTitle()).toBe('Urenstaten · ng-runway');
  });

  it('falls back to the app name when a route has no title', async () => {
    await TestBed.inject(Router).navigateByUrl('/plain');
    expect(TestBed.inject(Title).getTitle()).toBe('ng-runway');
  });
});
