import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  type AbstractControl,
  FormArray,
  NonNullableFormBuilder,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ContractType, Employee, Team, UserRole } from '@core/api/models';
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
import { WEEKDAY_KEYS, dayError, type AvailabilityDayForm } from '../availability';
import {
  CONTRACT_TYPES,
  USER_ROLES,
  emptyEmployeeForm,
  toEmployeeInput,
  toFormModel,
} from '../employee-form.model';
import {
  emailRule,
  hourlyRateRule,
  hoursPerWeekRule,
  requiredRule,
  startDateRule,
  type RuleCode,
} from '../employee-form.rules';
import { EmployeeFormService } from '../employee-form.service';
import { injectTranslate } from '../translate';

/** Wraps a shared rule as a Reactive Forms validator. The error key is the rule code. */
function ruleValidator(rule: (value: string) => RuleCode | null): ValidatorFn {
  return (control): ValidationErrors | null => {
    const code = rule(String(control.value ?? ''));
    return code ? { [code]: true } : null;
  };
}

/** One weekday: the group is invalid when it is switched on with a missing or reversed time range. */
const dayValidator: ValidatorFn = (group): ValidationErrors | null => {
  const code = dayError(group.getRawValue() as AvailabilityDayForm);
  return code ? { [code]: true } : null;
};

/**
 * Create / edit form on Reactive Forms: the same fields, rules and save flow as `app-employee-form`.
 * The `ui-*` controls are built for Signal Forms, so each one is bridged by hand:
 * `[value]` in, `(valueChange)` out, `(touch)` for the touched flag. See `employee-form.config.ts`
 * for when to pick which variant.
 */
@Component({
  selector: 'app-employee-form-reactive',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonComponent,
    CardComponent,
    DatePickerComponent,
    FieldComponent,
    InputComponent,
    SelectComponent,
    SwitchComponent,
    TimePickerComponent,
    TranslocoPipe,
  ],
  template: `
    <form class="flex flex-col gap-6" novalidate (submit)="onSubmit($event)">
      <fieldset class="m-0 flex min-w-0 flex-col gap-6 border-0 p-0" [disabled]="saving()">
        @if (attempted() && form.invalid) {
          <ui-alert variant="danger" [heading]="'employees.form.fixErrors' | transloco">
            {{ 'employees.form.fixErrorsText' | transloco }}
          </ui-alert>
        }
        @if (serverError()) {
          <ui-alert variant="danger" [heading]="'employees.form.saveFailed' | transloco">
            {{ serverError() }}
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
              [error]="errorOf(c.firstName)"
            >
              <ui-input
                autocomplete="given-name"
                [value]="c.firstName.value"
                (valueChange)="c.firstName.setValue($event)"
                (touch)="c.firstName.markAsTouched()"
              />
            </ui-field>
            <ui-field
              [label]="'employees.form.lastName' | transloco"
              required
              [error]="errorOf(c.lastName)"
            >
              <ui-input
                autocomplete="family-name"
                [value]="c.lastName.value"
                (valueChange)="c.lastName.setValue($event)"
                (touch)="c.lastName.markAsTouched()"
              />
            </ui-field>
            <ui-field
              [label]="'employees.form.email' | transloco"
              required
              [error]="errorOf(c.email)"
            >
              <ui-input
                type="email"
                autocomplete="email"
                [value]="c.email.value"
                (valueChange)="c.email.setValue($event)"
                (touch)="c.email.markAsTouched()"
              />
            </ui-field>
            <ui-field [label]="'employees.form.phone' | transloco">
              <ui-input
                type="tel"
                autocomplete="tel"
                [value]="c.phone.value"
                (valueChange)="c.phone.setValue($event)"
                (touch)="c.phone.markAsTouched()"
              />
            </ui-field>
          </div>
        </ui-card>

        <ui-card>
          <h2 card-header class="font-title text-lg font-semibold">
            {{ 'employees.form.sections.job' | transloco }}
          </h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ui-field [label]="'employees.form.jobTitle' | transloco">
              <ui-input
                [value]="c.jobTitle.value"
                (valueChange)="c.jobTitle.setValue($event)"
                (touch)="c.jobTitle.markAsTouched()"
              />
            </ui-field>
            <ui-field
              [label]="'employees.form.team' | transloco"
              required
              [error]="errorOf(c.teamId)"
            >
              <ui-select
                [options]="teamOptions()"
                [placeholder]="'employees.form.teamPlaceholder' | transloco"
                [value]="c.teamId.value"
                (valueChange)="c.teamId.setValue($event)"
                (touch)="c.teamId.markAsTouched()"
              />
            </ui-field>
            <ui-field
              [label]="'employees.form.role' | transloco"
              [hint]="canAssignAdmin() ? '' : ('employees.form.adminOnlyHint' | transloco)"
            >
              <ui-select
                [options]="roleOptions()"
                [value]="c.userRole.value"
                (valueChange)="setRole($event)"
              />
            </ui-field>
            <div class="flex items-end pb-1.5">
              <ui-switch [checked]="c.active.value" (checkedChange)="c.active.setValue($event)">
                {{ 'employees.form.active' | transloco }}
              </ui-switch>
            </div>
          </div>
        </ui-card>

        <ui-card>
          <h2 card-header class="font-title text-lg font-semibold">
            {{ 'employees.form.sections.contract' | transloco }}
          </h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ui-field [label]="'employees.form.contractType' | transloco">
              <ui-select
                [options]="contractOptions()"
                [value]="c.contractType.value"
                (valueChange)="setContract($event)"
              />
            </ui-field>
            <ui-field
              [label]="'employees.form.startDate' | transloco"
              required
              [error]="errorOf(c.startDate)"
            >
              <ui-date-picker
                [buttonLabel]="'employees.form.pickers.openCalendar' | transloco"
                [calendarLabel]="'employees.form.pickers.calendar' | transloco"
                [value]="c.startDate.value"
                (valueChange)="c.startDate.setValue($event)"
                (touch)="c.startDate.markAsTouched()"
              />
            </ui-field>
            <ui-field
              [label]="'employees.form.hoursPerWeek' | transloco"
              [hint]="'employees.form.hoursHint' | transloco"
              required
              [error]="errorOf(c.hoursPerWeek)"
            >
              <ui-input
                [value]="c.hoursPerWeek.value"
                (valueChange)="c.hoursPerWeek.setValue($event)"
                (touch)="c.hoursPerWeek.markAsTouched()"
              />
            </ui-field>
            <ui-field
              [label]="'employees.form.hourlyRate' | transloco"
              [hint]="'employees.form.rateHint' | transloco"
              required
              [error]="errorOf(c.hourlyRate)"
            >
              <ui-input
                [value]="c.hourlyRate.value"
                (valueChange)="c.hourlyRate.setValue($event)"
                (touch)="c.hourlyRate.markAsTouched()"
              />
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
            @for (day of c.availability.controls; track $index) {
              <li class="flex flex-wrap items-start gap-x-6 gap-y-2 py-3">
                <div class="w-40 pt-2">
                  <ui-switch
                    [checked]="day.controls.available.value"
                    (checkedChange)="day.controls.available.setValue($event)"
                  >
                    {{ weekdayLabel($index) }}
                  </ui-switch>
                </div>
                @if (day.controls.available.value) {
                  <ui-field [label]="'employees.form.from' | transloco">
                    <ui-time-picker
                      [step]="30"
                      [buttonLabel]="'employees.form.pickers.openTimes' | transloco"
                      [listLabel]="'employees.form.pickers.times' | transloco"
                      [value]="day.controls.from.value"
                      (valueChange)="day.controls.from.setValue($event)"
                      (touch)="day.markAllAsTouched()"
                    />
                  </ui-field>
                  <ui-field [label]="'employees.form.to' | transloco" [error]="errorOf(day)">
                    <ui-time-picker
                      [step]="30"
                      [buttonLabel]="'employees.form.pickers.openTimes' | transloco"
                      [listLabel]="'employees.form.pickers.times' | transloco"
                      [value]="day.controls.to.value"
                      (valueChange)="day.controls.to.setValue($event)"
                      (touch)="day.markAllAsTouched()"
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
export class EmployeeFormReactiveComponent implements OnInit {
  readonly employee = input<Employee | null>(null);
  readonly teams = input.required<readonly Team[]>();

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly saver = inject(EmployeeFormService);
  private readonly t = injectTranslate();

  protected readonly form = this.fb.group({
    firstName: this.fb.control('', ruleValidator(requiredRule)),
    lastName: this.fb.control('', ruleValidator(requiredRule)),
    email: this.fb.control('', ruleValidator(emailRule)),
    phone: this.fb.control(''),
    jobTitle: this.fb.control(''),
    teamId: this.fb.control('', ruleValidator(requiredRule)),
    userRole: this.fb.control<UserRole>('employee'),
    contractType: this.fb.control<ContractType>('permanent'),
    hoursPerWeek: this.fb.control('', ruleValidator(hoursPerWeekRule)),
    hourlyRate: this.fb.control('', ruleValidator(hourlyRateRule)),
    startDate: this.fb.control('', ruleValidator(startDateRule)),
    active: this.fb.control(true),
    availability: new FormArray(WEEKDAY_KEYS.map(() => this.dayGroup())),
  });

  /** Shorthand for the template. */
  protected readonly c = this.form.controls;

  protected readonly attempted = signal(false);
  protected readonly saving = signal(false);
  protected readonly serverError = signal('');
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

  ngOnInit(): void {
    const existing = this.employee();
    this.form.setValue(existing ? toFormModel(existing) : emptyEmployeeForm(todayIso()));
  }

  private dayGroup() {
    return this.fb.group(
      { available: this.fb.control(false), from: this.fb.control(''), to: this.fb.control('') },
      { validators: dayValidator },
    );
  }

  protected setRole(value: string): void {
    this.c.userRole.setValue(value as UserRole);
  }

  protected setContract(value: string): void {
    this.c.contractType.setValue(value as ContractType);
  }

  protected weekdayLabel(index: number): string {
    return this.t(`employees.weekdays.${WEEKDAY_KEYS[index] ?? 'mon'}`);
  }

  /** The first error of a control or group, translated, once it has been touched. */
  protected errorOf(control: AbstractControl): string {
    const code = control.touched ? Object.keys(control.errors ?? {})[0] : undefined;
    return code ? this.t(`employees.form.errors.${code}`) : '';
  }

  protected cancel(): void {
    const existing = this.employee();
    void this.router.navigate(existing ? ['/employees', existing.id] : ['/employees']);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.attempted.set(true);
    this.serverError.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;

    this.saving.set(true);
    const model = this.form.getRawValue();
    const input = toEmployeeInput(model, { teams: this.teams(), existing: this.employee() });
    const result = await this.saver.save(this.employee(), input);
    this.saving.set(false);
    if (!result.ok) this.serverError.set(result.message);
  }
}
