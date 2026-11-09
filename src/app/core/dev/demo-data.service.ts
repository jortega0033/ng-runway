import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { DevApi } from '../api/dev.api';
import { AuthService } from '../auth/auth.service';
import { DialogService, ToastService, type ConfirmOptions } from '@ui/index';

export interface ResetDemoTexts {
  confirm: ConfirmOptions;
  /** Title of the success toast. */
  done: string;
}

/** Loads the app again at its base URL. Replaced in tests, where navigation is not possible. */
export const RELOAD_APP = new InjectionToken<() => void>('RELOAD_APP', {
  providedIn: 'root',
  factory: () => {
    const document = inject(DOCUMENT);
    return () => document.defaultView?.location.assign(document.baseURI);
  },
});

/**
 * Puts the mocked database back to its seed. Asks first, then signs the user out and reloads
 * the app, because every screen holds data that no longer exists.
 */
@Injectable({ providedIn: 'root' })
export class DemoDataService {
  private readonly dialogs = inject(DialogService);
  private readonly api = inject(DevApi);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly reload = inject(RELOAD_APP);

  /** Resolves `true` when the data was reset, `false` when the user said no or the request failed. */
  async reset(texts: ResetDemoTexts): Promise<boolean> {
    if (!(await this.dialogs.confirm({ danger: true, ...texts.confirm }))) return false;
    try {
      await new Promise<void>((resolve, reject) =>
        this.api.resetDemoData().subscribe({ complete: resolve, error: reject }),
      );
    } catch {
      return false; // the error interceptor already showed a toast
    }
    this.auth.logout(false);
    this.toasts.show({ variant: 'success', title: texts.done });
    this.reload();
    return true;
  }
}
