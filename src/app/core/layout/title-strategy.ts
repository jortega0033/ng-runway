import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { BehaviorSubject, of, switchMap } from 'rxjs';

export const APP_TITLE = 'ng-runway';

/**
 * Sets `document.title` to "<Page> · ng-runway". A route's `title` is a Transloco key (for
 * example `title: 'nav.timesheets'`), so the title follows the active language.
 */
@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private readonly key = new BehaviorSubject<string | undefined>(undefined);

  constructor() {
    super();
    this.key
      .pipe(
        // `selectTranslate` emits again whenever the active language changes.
        switchMap((key) => (key ? this.transloco.selectTranslate(key) : of(undefined))),
        takeUntilDestroyed(),
      )
      .subscribe((page) => this.title.setTitle(page ? `${page} · ${APP_TITLE}` : APP_TITLE));
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key.next(this.buildTitle(snapshot));
  }
}
