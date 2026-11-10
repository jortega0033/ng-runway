import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import {
  FormField,
  applyEach,
  email,
  form,
  required,
  submit,
  validate,
} from '@angular/forms/signals';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { Employee, Team } from '@core/api/models';
import { AuthService } from '@core/auth/auth.service';
import { todayIso } from '@core/domain/time';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  DatePickerComponent,
  FieldComponent,
  InputComponent,
  SelectComponent,
  SwitchComponent,
  TimePickerComponent,
  type SelectOption,
} from '@ui/index';
import { WEEKDAY_KEYS, dayError } from '../availability';
import { EmployeeFormService } from '../employee-form.service';
import {
  CONTRACT_TYPES,
  USER_ROLES,
  emptyEmployeeForm,
  toEmployeeInput,
  toFormModel,
  type EmployeeFormModel,
} from '../employee-form.model';
import {
  hourlyRateRule,
  hoursPerWeekRule,
  startDateRule,
  type RuleCode,
} from '../employee-form.rules';
import { injectTranslate } from '../translate';

/** What the template needs from a field to show its first error once it has been touched. */
type ErrorSource = () => {
  touched(): boolean;
  errors(): readonly { kind: string; message?: string }[];
};

const failWith = (code: RuleCode | null) => (code ? { kind: code } : null);

/**
 * Create / edit form on Signal Forms. The form model is a plain signal, `form()` wraps it in a
 * field tree and each `ui-*` control binds to one field with `[formField]`. Validation lives in
 * the schema function below; the rules themselves are shared with the Reactive Forms variant.
 */
@Component({
  selector: 'app-employee-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonComponent,
    CardComponent,
    DatePickerComponent,
    FieldComponent,
    FormField,
    InputComponent,
    SelectComponent,
    SwitchComponent,
    TimePickerComponent,
    TranslocoPipe,
  ],
  template: `
    <form class="flex flex-col gap-6" novalidate (submit)="onSubmit($event)">
      <fieldset class="m-0 flex min-w-0 flex-col gap-6 border-0 p-0" [disabled]="saving()">
        @if (attempted() && f().invalid()) {
          <ui-alert variant="danger" [heading]="'employees.form.fixErrors' | transloco">
            {{ 'employees.form.fixErrorsText' | transloco }}
          </ui-alert>
        }
        @for (message of serverErrors(); track $index) {
          <ui-alert variant="danger" [heading]="'employees.form.saveFailed' | transloco">
            {{ message }}
          </ui-alert>
        }

        <ui-card>
          <h2 card-header class="font-title text-lg font-semibold">
            {{ 'employees.form.sections.person' | transloco }}
          </h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ui-field
              [label]="'employees.form.firstName' | transloco"
              required
              [error]="errorOf(f.firstName)"
            >
              <ui-input [formField]="f.firstName" autocomplete="given-name" />
            </ui-field>
            <ui-field
              [label]="'employees.form.lastName' | transloco"
              required
              [error]="errorOf(f.lastName)"
            >
              <ui-input [formField]="f.lastName" autocomplete="family-name" />
            </ui-field>
            <ui-field
              [label]="'employees.form.email' | transloco"
              required
              [error]="errorOf(f.email)"
            >
              <ui-input [formField]="f.email" type="email" autocomplete="email" />
            </ui-field>
            <ui-field [label]="'employees.form.phone' | transloco" [error]="errorOf(f.phone)">
              <ui-input [formField]="f.phone" type="tel" autocomplete="tel" />
            </ui-field>
          </div>
        </ui-card>

        <ui-card>
          <h2 card-header class="font-title text-lg font-semibold">
            {{ 'employees.form.sections.job' | transloco }}
          </h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ui-field [label]="'employees.form.jobTitle' | transloco" [error]="errorOf(f.jobTitle)">
              <ui-input [formField]="f.jobTitle" />
            </ui-field>
            <ui-field
              [label]="'employees.form.team' | transloco"
              required
              [error]="errorOf(f.teamId)"
            >
              <ui-select
                [formField]="f.teamId"
                [options]="teamOptions()"
                [placeholder]="'employees.form.teamPlaceholder' | transloco"
              />
            </ui-field>
            <ui-field
              [label]="'employees.form.role' | transloco"
              [hint]="canAssignAdmin() ? '' : ('employees.form.adminOnlyHint' | transloco)"
            >
              <ui-select [formField]="f.userRole" [options]="roleOptions()" />
            </ui-field>
            <div class="flex items-end pb-1.5">
              <ui-switch [formField]="f.active">{{
                'employees.form.active' | transloco
              }}</ui-switch>
            </div>
          </div>
        </ui-card>

        <ui-card>
          <h2 card-header class="font-title text-lg font-semibold">
            {{ 'employees.form.sections.contract' | transloco }}
          </h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ui-field [label]="'employees.form.contractType' | transloco">
              <ui-select [formField]="f.contractType" [options]="contractOptions()" />
            </ui-field>
            <ui-field
              [label]="'employees.form.startDate' | transloco"
              required
              [error]="errorOf(f.startDate)"
            >
              <ui-date-picker
                [formField]="f.startDate"
                [buttonLabel]="'employees.form.pickers.openCalendar' | transloco"
                [calendarLabel]="'employees.form.pickers.calendar' | transloco"
                [previousMonthLabel]="'common.previousMonth' | transloco"
                [nextMonthLabel]="'common.nextMonth' | transloco"
              />
            </ui-field>
            <ui-field
              [label]="'employees.form.hoursPerWeek' | transloco"
              [hint]="'employees.form.hoursHint' | transloco"
              required
              [error]="errorOf(f.hoursPerWeek)"
            >
              <ui-input [formField]="f.hoursPerWeek" type="text" />
            </ui-field>
            <ui-field
              [label]="'employees.form.hourlyRate' | transloco"
              [hint]="'employees.form.rateHint' | transloco"
              required
              [error]="errorOf(f.hourlyRate)"
            >
              <ui-input [formField]="f.hourlyRate" type="text" />
            </ui-field>
          </div>
        </ui-card>

        <ui-card>
          <h2 card-header class="font-title text-lg font-semibold">
            {{ 'employees.form.sections.availability' | transloco }}
          </h2>
          <p class="mb-3 text-base text-foreground-subtle">
            {{ 'employees.form.availabilityHint' | transloco }}
          </p>
          <ul class="m-0 flex list-none flex-col divide-y divide-border-subtle p-0">
            @for (day of f.availability; track $index) {
              <li class="flex flex-wrap items-start gap-x-6 gap-y-2 py-3">
                <div class="w-40 pt-2">
                  <ui-switch [formField]="day.available">{{ weekdayLabel($index) }}</ui-switch>
                </div>
                @if (day.available().value()) {
                  <ui-field [label]="'employees.form.from' | transloco">
                    <ui-time-picker
                      [formField]="day.from"
                      [step]="30"
                      [buttonLabel]="'employees.form.pickers.openTimes' | transloco"
                      [listLabel]="'employees.form.pickers.times' | transloco"
                    />
                  </ui-field>
                  <ui-field [label]="'employees.form.to' | transloco" [error]="errorOf(day.to)">
                    <ui-time-picker
                      [formField]="day.to"
                      [step]="30"
                      [buttonLabel]="'employees.form.pickers.openTimes' | transloco"
                      [listLabel]="'employees.form.pickers.times' | transloco"
                    />
                  </ui-field>
                }
              </li>
            }
          </ul>
        </ui-card>

        <div class="flex items-center justify-end gap-2">
          <button ui-button type="button" variant="secondary" (click)="cancel()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button ui-button type="submit" [loading]="saving()" [disabled]="saving()">
            {{ 'common.save' | transloco }}
          </button>
        </div>
      </fieldset>
    </form>
  `,
})
export class EmployeeFormComponent {
  readonly employee = input<Employee | null>(null);
  readonly teams = input.required<readonly Team[]>();

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly saver = inject(EmployeeFormService);
  private readonly t = injectTranslate();

  /** The form model follows the `employee` input and can still be edited freely. */
  protected readonly model = linkedSignal<EmployeeFormModel>(() => {
    const existing = this.employee();
    return existing ? toFormModel(existing) : emptyEmployeeForm(todayIso());
  });

  protected readonly f = form(this.model, (p) => {
    required(p.firstName);
    required(p.lastName);
    required(p.email);
    email(p.email);
    required(p.teamId);
    validate(p.startDate, (ctx) => failWith(startDateRule(ctx.value())));
    validate(p.hoursPerWeek, (ctx) => failWith(hoursPerWeekRule(ctx.value())));
    validate(p.hourlyRate, (ctx) => failWith(hourlyRateRule(ctx.value())));
    // The times are one validation unit per weekday: the error shows under the "to" time.
    applyEach(p.availability, (day) => {
      validate(day.to, (ctx) =>
        failWith(
          dayError({
            available: ctx.valueOf(day.available),
            from: ctx.valueOf(day.from),
            to: ctx.value(),
          }),
        ),
      );
    });
  });

  protected readonly attempted = signal(false);
  protected readonly saving = computed(() => this.f().submitting());
  protected readonly canAssignAdmin = computed(() => this.auth.hasRole(['admin']));

  protected readonly teamOptions = computed<SelectOption[]>(() =>
    this.teams().map((team) => ({ value: team.id, label: team.name })),
  );
  protected readonly roleOptions = computed<SelectOption[]>(() =>
    USER_ROLES.map((role) => ({
      value: role,
      label: this.t(`roles.${role}`),
      disabled: role === 'admin' && !this.canAssignAdmin(),
    })),
  );
  protected readonly contractOptions = computed<SelectOption[]>(() =>
    CONTRACT_TYPES.map((type) => ({ value: type, label: this.t(`employees.contract.${type}`) })),
  );

  /** Errors the server sent back for the whole form (the ones that belong to no single field). */
  protected readonly serverErrors = computed(() =>
    this.f()
      .errors()
      .filter((error) => error.kind === 'server')
      .map((error) => error.message ?? ''),
  );

  protected cancel(): void {
    const existing = this.employee();
    void this.router.navigate(existing ? ['/employees', existing.id] : ['/employees']);
  }

  protected weekdayLabel(index: number): string {
    return this.t(`employees.weekdays.${WEEKDAY_KEYS[index] ?? 'mon'}`);
  }

  /** The first error of a field, translated, once the user has touched it or tried to submit. */
  protected errorOf(field: ErrorSource): string {
    const state = field();
    const first = state.touched() ? state.errors()[0] : undefined;
    if (!first) return '';
    return first.kind === 'server'
      ? (first.message ?? '')
      : this.t(`employees.form.errors.${first.kind}`);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.attempted.set(true);
    // submit() marks every field as touched, skips the action while the form is invalid and
    // blocks a second submit while the first one runs.
    await submit(this.f, async () => {
      const input = toEmployeeInput(this.model(), {
        teams: this.teams(),
        existing: this.employee(),
      });
      const result = await this.saver.save(this.employee(), input);
      return result.ok ? undefined : { kind: 'server', message: result.message };
    });
  }
}
