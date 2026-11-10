import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import {
  FormField,
  form,
  required,
  submit,
  validate,
  type FieldTree,
} from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AbsencesApi } from '@core/api/absences.api';
import type { AbsenceRequest, AbsenceType, AbsenceTypeKey, Employee } from '@core/api/models';
import {
  AlertComponent,
  ButtonComponent,
  DatePickerComponent,
  DialogComponent,
  FieldComponent,
  SelectComponent,
  TextareaComponent,
  ToastService,
  type SelectOption,
} from '@ui/index';
import { isRangeValid, previewRequest, REQUESTABLE_TYPES } from './absence-math';

export interface RequestDialogData {
  /** Who the request is for by default: the signed-in user. */
  employeeId: string;
  /** Managers and admins pick an employee; for everyone else this is `null`. */
  employees: Employee[] | null;
  types: AbsenceType[];
}

interface RequestModel {
  employeeId: string;
  /** An `AbsenceTypeKey`; kept as a string because the select control works with strings. */
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
}

/** Form to ask for time off, with a live preview of the days used and the balance left. */
@Component({
  selector: 'app-absence-request-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonComponent,
    DatePickerComponent,
    DialogComponent,
    FieldComponent,
    FormField,
    SelectComponent,
    TextareaComponent,
    TranslocoPipe,
  ],
  template: `
    <ui-dialog
      [title]="'absences.request.title' | transloco"
      [closeLabel]="'common.close' | transloco"
    >
      <form class="flex flex-col gap-4" novalidate (submit)="onSubmit($event)">
        @if (data.employees) {
          <ui-field [label]="'absences.request.employee' | transloco">
            <ui-select [formField]="f.employeeId" [options]="employeeOptions" />
          </ui-field>
        }
        <ui-field [label]="'absences.request.type' | transloco" [error]="error(f.type)" required>
          <ui-select [formField]="f.type" [options]="typeOptions()" />
        </ui-field>
        <div class="grid gap-4 sm:grid-cols-2">
          <ui-field
            [label]="'absences.request.startDate' | transloco"
            [error]="error(f.startDate)"
            required
          >
            <ui-date-picker
              [formField]="f.startDate"
              [buttonLabel]="'absences.request.chooseDate' | transloco"
              [calendarLabel]="'absences.request.calendar' | transloco"
              [previousMonthLabel]="'common.previousMonth' | transloco"
              [nextMonthLabel]="'common.nextMonth' | transloco"
            />
          </ui-field>
          <ui-field
            [label]="'absences.request.endDate' | transloco"
            [error]="error(f.endDate)"
            required
          >
            <ui-date-picker
              [formField]="f.endDate"
              [buttonLabel]="'absences.request.chooseDate' | transloco"
              [calendarLabel]="'absences.request.calendar' | transloco"
              [previousMonthLabel]="'common.previousMonth' | transloco"
              [nextMonthLabel]="'common.nextMonth' | transloco"
            />
          </ui-field>
        </div>
        <ui-field
          [label]="'absences.request.reason' | transloco"
          [hint]="'absences.request.reasonHint' | transloco"
        >
          <ui-textarea [formField]="f.reason" [rows]="3" />
        </ui-field>

        <div
          class="rounded-md border border-border-subtle bg-background-muted p-3 text-base"
          aria-live="polite"
        >
          <p class="text-foreground">
            {{ 'absences.request.days' | transloco: { count: preview().days } }}
          </p>
          @if (balances.isLoading()) {
            <p class="text-foreground-subtle">{{ 'common.loading' | transloco }}</p>
          } @else if (preview().remainingAfter !== null) {
            <p class="text-foreground-subtle">
              {{
                'absences.request.remaining'
                  | transloco
                    : {
                        after: preview().remainingAfter,
                        before: preview().remainingBefore,
                        total: preview().entitlementDays,
                      }
              }}
            </p>
          } @else {
            <p class="text-foreground-subtle">{{ 'absences.request.noBalance' | transloco }}</p>
          }
        </div>
        @if (preview().exceeds) {
          <ui-alert variant="warning" [heading]="'absences.request.exceedsTitle' | transloco">
            {{
              'absences.request.exceedsText'
                | transloco: { count: -(preview().remainingAfter ?? 0) }
            }}
          </ui-alert>
        }
      </form>
      <ng-container uiDialogFooter>
        <button ui-button type="button" variant="secondary" (click)="ref.close()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button ui-button type="button" [loading]="saving()" (click)="onSubmit()">
          {{ 'absences.request.submit' | transloco }}
        </button>
      </ng-container>
    </ui-dialog>
  `,
})
export class AbsenceRequestDialog {
  protected readonly data = inject<RequestDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<AbsenceRequest>>(DialogRef);
  private readonly api = inject(AbsencesApi);
  private readonly toasts = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);

  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('absences'));
  private readonly t = (key: string, params?: Record<string, unknown>) => {
    this.scopeLoaded();
    return this.transloco.translate(key, params);
  };

  protected readonly saving = signal(false);

  private readonly model = signal<RequestModel>({
    employeeId: this.data.employeeId,
    type: 'vacation',
    startDate: '',
    endDate: '',
    reason: '',
  });

  protected readonly f = form(this.model, (p) => {
    required(p.type, { message: this.t('absences.request.errors.type') });
    required(p.startDate, { message: this.t('absences.request.errors.startDate') });
    required(p.endDate, { message: this.t('absences.request.errors.endDate') });
    validate(p.endDate, ({ value, valueOf }) => {
      const start = valueOf(p.startDate);
      return value() && start && !isRangeValid(start, value())
        ? { kind: 'endBeforeStart', message: this.t('absences.request.errors.endBeforeStart') }
        : undefined;
    });
  });

  protected readonly employeeOptions: SelectOption[] = (this.data.employees ?? []).map((e) => ({
    value: e.id,
    label: `${e.firstName} ${e.lastName}`,
  }));

  protected readonly typeOptions = computed<SelectOption[]>(() =>
    this.data.types
      .filter((type) => REQUESTABLE_TYPES.includes(type.key))
      .map((type) => ({ value: type.key, label: this.t(`absences.types.${type.key}`) })),
  );

  protected readonly balances = rxResource({
    params: () => this.model().employeeId,
    stream: ({ params }) => this.api.balances(params),
  });

  protected readonly preview = computed(() => {
    const { type, startDate, endDate } = this.model();
    const balance = this.balances.value()?.find((b) => b.type === type) ?? null;
    return previewRequest(startDate, endDate, balance);
  });

  /** Shows the first error of a field once it was touched or the form was submitted. */
  protected error(field: FieldTree<string>): string {
    const state = field();
    return state.touched() ? (state.errors()[0]?.message ?? '') : '';
  }

  protected async onSubmit(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.saving()) return;
    // A failed submit marks every field as touched; once the errors render, focus the first one.
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      { injector: this.injector },
    );
    await submit(this.f, async () => {
      this.saving.set(true);
      try {
        const value = this.model();
        const created = await firstValueFrom(
          this.api.create({
            employeeId: value.employeeId,
            type: value.type as AbsenceTypeKey,
            startDate: value.startDate,
            endDate: value.endDate,
            reason: value.reason.trim(),
          }),
        );
        this.toasts.show({
          variant: 'success',
          title: this.t('absences.request.sentTitle'),
          message: this.t('absences.request.sentText', { count: this.preview().days }),
        });
        this.ref.close(created);
      } catch {
        // The error toast comes from the interceptor; the dialog stays open for another try.
      } finally {
        this.saving.set(false);
      }
    });
  }
}
