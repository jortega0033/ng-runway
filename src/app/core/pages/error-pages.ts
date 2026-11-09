import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LinkComponent } from '@ui/link/link';

@Component({
  selector: 'app-error-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LinkComponent, RouterLink, TranslocoPipe],
  template: `
    <main class="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 class="font-title text-4xl font-semibold text-foreground">
        {{ titleKey() | transloco }}
      </h1>
      <p class="max-w-md text-base text-foreground-subtle">{{ textKey() | transloco }}</p>
      <a ui-link routerLink="/dashboard">{{ 'errors.goHome' | transloco }}</a>
    </main>
  `,
})
export class ErrorPage {
  readonly titleKey = input('errors.notFoundTitle');
  readonly textKey = input('errors.notFoundText');
}

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorPage],
  template: `<app-error-page />`,
})
export class NotFoundPage {}

@Component({
  selector: 'app-forbidden-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorPage],
  template: `<app-error-page titleKey="errors.forbiddenTitle" textKey="errors.forbiddenText" />`,
})
export class ForbiddenPage {}
