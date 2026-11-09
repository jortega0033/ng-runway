import { HttpContextToken, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '@ui/toast/toast';
import type { ApiErrorBody } from '../api/models';

/** Set on a request when the caller shows its own error message. */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Turns failed requests into toasts. A 401 signs the user out. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toasts = inject(ToastService);
  const auth = inject(AuthService);
  const t = inject(TranslocoService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && !req.context.get(SKIP_ERROR_TOAST)) {
        if (error.status === 401 && auth.isAuthenticated()) {
          auth.logout();
        }
        const body = error.error as Partial<ApiErrorBody> | null;
        const message =
          body?.message ??
          (error.status === 0 ? t.translate('errors.offline') : t.translate('errors.unknown'));
        toasts.show({ variant: 'danger', title: t.translate('errors.requestFailed'), message });
      }
      return throwError(() => error);
    }),
  );
};
