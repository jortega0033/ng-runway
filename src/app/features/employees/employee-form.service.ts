import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { EmployeesApi } from '@core/api/employees.api';
import type { ApiErrorBody, Employee, EmployeeInput } from '@core/api/models';
import { ToastService } from '@ui/toast/toast';
import { injectTranslate } from './translate';

export type SaveResult = { ok: true; employee: Employee } | { ok: false; message: string };

/**
 * The save flow both form variants share: create or update, toast, open the profile.
 * A failed request does not throw; it comes back as `{ ok: false, message }` so each form can
 * put the message where its own state model wants it.
 */
@Injectable({ providedIn: 'root' })
export class EmployeeFormService {
  private readonly api = inject(EmployeesApi);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly t = injectTranslate();

  async save(existing: Employee | null, input: EmployeeInput): Promise<SaveResult> {
    try {
      const employee = await firstValueFrom(
        existing ? this.api.update(existing.id, input) : this.api.create(input),
      );
      this.toasts.show({
        variant: 'success',
        title: this.t(existing ? 'employees.form.updated' : 'employees.form.created'),
        message: `${employee.firstName} ${employee.lastName}`,
      });
      await this.router.navigate(['/employees', employee.id]);
      return { ok: true, employee };
    } catch (error) {
      return { ok: false, message: this.messageOf(error) };
    }
  }

  private messageOf(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Partial<ApiErrorBody> | null;
      if (body?.message) return body.message;
    }
    return this.t('errors.unknown');
  }
}
