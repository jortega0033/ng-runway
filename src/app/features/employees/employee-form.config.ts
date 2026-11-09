/**
 * Which employee form the app uses: the Signal Forms one or the Reactive Forms one.
 *
 * Both forms edit the same model (`employee-form.model.ts`), share the same rules
 * (`employee-form.rules.ts`) and the same save flow (`employee-form.service.ts`). They differ
 * only in how the form state is held. Change the constant below to switch for the whole app,
 * or add `?form=reactive` / `?form=signal` to `/employees/new` or `/employees/:id/edit` to
 * switch for one visit.
 *
 * Choose 'signal' (the default, `app-employee-form`) when:
 * - the project is new, or already uses signals and zoneless change detection;
 * - you want field state (touched, errors, submitting) as signals that templates read directly;
 * - the form tree maps to a plain object model, including arrays (here: the seven weekdays).
 * Signal Forms is the newer API: expect some churn between Angular releases.
 *
 * Choose 'reactive' (`app-employee-form-reactive`) when:
 * - the codebase has many Reactive Forms and its validators, directives and tests should be reused;
 * - you rely on `ControlValueAccessor` libraries or `valueChanges` pipelines (debounce, switchMap);
 * - the team knows it well and you want the most battle-tested forms API.
 * The reactive form here bridges the `ui-*` controls by hand (`[value]` + `(valueChange)`),
 * because those controls are built for Signal Forms and do not implement ControlValueAccessor.
 */
export type EmployeeFormVariant = 'signal' | 'reactive';

export const EMPLOYEE_FORM_VARIANT: EmployeeFormVariant = 'signal';

/** `?form=reactive` or `?form=signal` wins over the constant. Anything else is ignored. */
export function resolveFormVariant(
  queryValue: string | null | undefined,
  fallback: EmployeeFormVariant = EMPLOYEE_FORM_VARIANT,
): EmployeeFormVariant {
  return queryValue === 'reactive' || queryValue === 'signal' ? queryValue : fallback;
}
