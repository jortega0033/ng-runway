import type { ErrorHandler } from '@angular/core';
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { ToastService } from '@ui/toast/toast';

/**
 * Last stop for errors nobody caught. HTTP errors already got a toast from the interceptor,
 * so only real bugs are shown here. Send them to your logging service in `report`.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toasts = inject(ToastService);
  private readonly t = inject(TranslocoService);

  handleError(error: unknown): void {
    this.report(error);
    if (error instanceof HttpErrorResponse) return;
    this.toasts.show({
      variant: 'danger',
      title: this.t.translate('errors.unexpected'),
      message: this.t.translate('errors.unexpectedHint'),
    });
  }

  protected report(error: unknown): void {
    console.error(error);
  }
}
