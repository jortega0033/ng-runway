import { inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { asapScheduler, observeOn, scan } from 'rxjs';

type Params = Record<string, string | number>;

/**
 * `t('employees.title')` for TypeScript code (column headers, toast text, select options).
 *
 * Reading the version signal inside the function makes any computed that calls it update when
 * a scope finishes loading or the language changes, which `TranslocoService.translate` alone
 * does not do. The events arrive in a microtask because the `transloco` pipe loads a scope
 * while a template renders, and signals must not be written then.
 * Templates should keep using the pipe.
 */
export function injectTranslate(): (key: string, params?: Params) => string {
  const transloco = inject(TranslocoService);
  const version = toSignal(
    transloco.events$.pipe(
      observeOn(asapScheduler),
      scan((count) => count + 1, 0),
    ),
    { initialValue: 0 },
  );
  return (key, params) => {
    version();
    return transloco.translate(key, params);
  };
}
