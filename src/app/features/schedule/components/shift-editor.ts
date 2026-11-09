import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, disabled, form } from '@angular/forms/signals';
import { TranslocoService, TranslocoPipe, provideTranslocoScope } from '@jsverse/transloco';
import type { Employee, Shift, ShiftInput } from '@core/api/models';
import { detectConflicts } from '@core/domain/conflicts';
import { formatDuration, shiftNetMinutes } from '@core/domain/hours';
import { toMinutes } from '@core/domain/time';
import {
  BadgeComponent,
  ButtonComponent,
  DatePickerComponent,
  DialogService,
  DrawerComponent,
  FieldComponent,
  IconComponent,
  InputComponent,
  SelectComponent,
  TextareaComponent,
  TimePickerComponent,
  type SelectOption,
} from '@ui/index';
import { templateFor, validateDraft, type DraftProblem } from '../schedule.layout';
import type { ScheduleStoreType } from '../schedule.store';

export interface ShiftEditorData {
  store: ScheduleStoreType;
  /** The shift to edit, or `null` to add one. */
  shift: Shift | null;
  /** Starting values of a new shift. */
  defaults?: Partial<ShiftInput>;
}

export type ShiftEditorResult =
  { action: 'save'; id: string | null; input: ShiftInput } | { action: 'delete'; id: string };

interface EditorModel {
  employeeId: string;
  teamId: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: string;
  note: string;
}

/**
 * Drawer content to add, edit or view a shift. This is the keyboard and form route to everything
 * drag and drop does. Conflicts are recomputed with `detectConflicts` on every edit: they warn,
 * only an invalid time range blocks saving.
 */
@Component({
  selector: 'app-shift-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideTranslocoScope('schedule')],
  imports: [
    FormField,
    TranslocoPipe,
    BadgeComponent,
    ButtonComponent,
    DatePickerComponent,
    DrawerComponent,
    FieldComponent,
    IconComponent,
    InputComponent,
    SelectComponent,
    TextareaComponent,
    TimePickerComponent,
  ],
  template: `
    <ui-drawer [title]="title() | transloco" [closeLabel]="'schedule.editor.close' | transloco">
      <form class="flex flex-col gap-4" (submit)="$event.preventDefault(); save()">
        <ui-field [label]="'schedule.editor.employee' | transloco">
          <ui-select [formField]="f.employeeId" [options]="employeeOptions()" />
        </ui-field>

        @if (!model().employeeId) {
          <ui-field
            [label]="'schedule.editor.team' | transloco"
            [hint]="'schedule.editor.teamHint' | transloco"
          >
            <ui-select [formField]="f.teamId" [options]="teamOptions()" />
          </ui-field>
        }

        <ui-field [label]="'schedule.editor.date' | transloco" [error]="errorFor('dateRequired')">
          <ui-date-picker [formField]="f.date" [weekStartsOn]="1" />
        </ui-field>

        <ui-field [label]="'schedule.editor.template' | transloco">
          <ui-select
            [options]="templateOptions()"
            [value]="matchedTemplateId()"
            [disabled]="readOnly"
            (valueChange)="applyTemplate($event)"
          />
        </ui-field>

        <div class="grid grid-cols-2 gap-3">
          <ui-field [label]="'schedule.editor.start' | transloco" [error]="timeError()">
            <ui-time-picker [formField]="f.start" />
          </ui-field>
          <ui-field [label]="'schedule.editor.end' | transloco" [error]="timeError()">
            <ui-time-picker [formField]="f.end" />
          </ui-field>
        </div>

        <ui-field [label]="'schedule.editor.break' | transloco" [error]="errorFor('breakTooLong')">
          <ui-input type="number" [formField]="f.breakMinutes" />
        </ui-field>

        <ui-field [label]="'schedule.editor.note' | transloco">
          <ui-textarea
            [formField]="f.note"
            [rows]="3"
            [placeholder]="'schedule.editor.notePlaceholder' | transloco"
          />
        </ui-field>

        <p class="flex flex-wrap items-center gap-2 text-base text-foreground-subtle">
          <span>{{ 'schedule.editor.net' | transloco: { duration: netLabel() } }}</span>
          @if (overnight()) {
            <span>{{ 'schedule.editor.overnight' | transloco }}</span>
          }
          @if (shift) {
            <ui-badge [variant]="shift.status === 'draft' ? 'warning' : 'success'">
              {{ 'schedule.shift.' + shift.status | transloco }}
            </ui-badge>
          }
        </p>

        <section
          class="rounded-md border border-border-subtle bg-background-muted p-3"
          aria-live="polite"
          [attr.aria-label]="'schedule.editor.conflictsTitle' | transloco"
        >
          <h3 class="mb-1 text-base font-medium text-foreground">
            {{ 'schedule.editor.conflictsTitle' | transloco }}
          </h3>
          @if (conflicts().length === 0) {
            <p class="text-base text-foreground-subtle">
              {{ 'schedule.editor.noConflicts' | transloco }}
            </p>
          } @else {
            <p class="mb-2 text-sm text-foreground-subtle">
              {{ 'schedule.editor.conflictsHint' | transloco }}
            </p>
            <ul class="flex flex-col gap-1.5">
              @for (conflict of conflicts(); track conflict.type + conflict.messageKey) {
                <li class="flex items-start gap-2 text-base text-foreground-warning-strong">
                  <ui-icon name="alert-triangle" [size]="20" class="mt-0.5 shrink-0" />
                  <span>{{ 'schedule.conflicts.' + conflict.messageKey | transloco }}</span>
                </li>
              }
            </ul>
          }
        </section>
      </form>

      <ng-container uiDrawerFooter>
        @if (!readOnly) {
          @if (shift) {
            <button ui-button type="button" variant="danger" class="mr-auto" (click)="remove()">
              {{ 'schedule.editor.delete' | transloco }}
            </button>
          }
          <button ui-button type="button" variant="secondary" (click)="ref.close()">
            {{ 'schedule.editor.cancel' | transloco }}
          </button>
          <button ui-button type="button" [disabled]="problems().length > 0" (click)="save()">
            {{ (shift ? 'schedule.editor.save' : 'schedule.editor.add') | transloco }}
          </button>
        } @else {
          <button ui-button type="button" variant="secondary" (click)="ref.close()">
            {{ 'schedule.editor.close' | transloco }}
          </button>
        }
      </ng-container>
    </ui-drawer>
  `,
})
export class ShiftEditorComponent {
  protected readonly ref = inject<DialogRef<ShiftEditorResult>>(DialogRef);
  private readonly data = inject<ShiftEditorData>(DIALOG_DATA);
  private readonly dialogs = inject(DialogService);
  private readonly transloco = inject(TranslocoService);

  private readonly store = this.data.store;
  protected readonly shift = this.data.shift;
  protected readonly readOnly = !this.store.canEdit();

  protected readonly model = signal<EditorModel>(this.initialModel());
  protected readonly f = form(this.model, (path) => {
    if (this.readOnly) {
      disabled(path.employeeId);
      disabled(path.teamId);
      disabled(path.date);
      disabled(path.start);
      disabled(path.end);
      disabled(path.breakMinutes);
      disabled(path.note);
    }
  });

  protected readonly title = computed(() =>
    this.readOnly
      ? 'schedule.editor.titleView'
      : this.shift
        ? 'schedule.editor.titleEdit'
        : 'schedule.editor.titleNew',
  );

  private readonly draft = computed(() => {
    const m = this.model();
    return {
      date: m.date,
      start: m.start,
      end: m.end,
      breakMinutes: m.breakMinutes.trim() === '' ? 0 : Number(m.breakMinutes),
    };
  });

  protected readonly problems = computed<DraftProblem[]>(() => validateDraft(this.draft()));

  protected readonly conflicts = computed(() => {
    if (this.problems().length > 0) return [];
    const m = this.model();
    const d = this.draft();
    return detectConflicts({
      shift: {
        id: this.shift?.id ?? 'new-shift',
        employeeId: m.employeeId || null,
        ...d,
      },
      employee: this.store.employeesById().get(m.employeeId),
      shifts: this.store.shifts(),
      absences: this.store.absences(),
    });
  });

  protected readonly netLabel = computed(() =>
    this.problems().length > 0 ? '-' : formatDuration(shiftNetMinutes(this.draft())),
  );
  protected readonly overnight = computed(() => {
    const d = this.draft();
    return this.problems().length === 0 && toMinutes(d.end) <= toMinutes(d.start);
  });

  protected readonly matchedTemplateId = computed(
    () => templateFor(this.draft(), this.store.templates())?.id ?? '',
  );

  protected readonly employeeOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.transloco.translate('schedule.editor.openOption') },
    ...this.store
      .employees()
      .filter((e) => e.active || e.id === this.shift?.employeeId)
      .map((e) => ({ value: e.id, label: employeeName(e) })),
  ]);
  protected readonly teamOptions = computed<SelectOption[]>(() =>
    this.store.teams().map((t) => ({ value: t.id, label: t.name })),
  );
  protected readonly templateOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.transloco.translate('schedule.editor.noTemplate') },
    ...this.store
      .templates()
      .map((t) => ({ value: t.id, label: `${t.name} (${t.start}-${t.end})` })),
  ]);

  protected errorFor(problem: DraftProblem): string {
    return this.problems().includes(problem)
      ? this.transloco.translate(`schedule.editor.problems.${problem}`)
      : '';
  }

  protected timeError(): string {
    return this.errorFor('timeRequired') || this.errorFor('sameTime');
  }

  protected applyTemplate(templateId: string): void {
    const template = this.store.templates().find((t) => t.id === templateId);
    if (!template) return;
    this.model.update((m) => ({
      ...m,
      start: template.start,
      end: template.end,
      breakMinutes: String(template.breakMinutes),
    }));
  }

  protected save(): void {
    if (this.readOnly || this.problems().length > 0) return;
    const m = this.model();
    const employee = this.store.employeesById().get(m.employeeId);
    const team = this.store.teamsById().get(m.teamId);
    const d = this.draft();
    const input: ShiftInput = {
      employeeId: m.employeeId || null,
      teamId: employee?.teamId ?? m.teamId,
      locationId: employee?.locationId ?? team?.locationId ?? this.shift?.locationId ?? '',
      date: d.date,
      start: d.start,
      end: d.end,
      breakMinutes: d.breakMinutes,
      status: this.shift?.status ?? 'draft',
      note: m.note.trim(),
    };
    this.ref.close({ action: 'save', id: this.shift?.id ?? null, input });
  }

  protected async remove(): Promise<void> {
    if (!this.shift) return;
    const ok = await this.dialogs.confirm({
      title: this.transloco.translate('schedule.dialog.deleteTitle'),
      message: this.transloco.translate('schedule.dialog.deleteMessage'),
      confirmLabel: this.transloco.translate('schedule.dialog.deleteConfirm'),
      cancelLabel: this.transloco.translate('schedule.dialog.cancel'),
      danger: true,
    });
    if (ok) this.ref.close({ action: 'delete', id: this.shift.id });
  }

  private initialModel(): EditorModel {
    const { shift, defaults, store } = this.data;
    const source = shift ?? defaults ?? {};
    const employeeId = source.employeeId ?? '';
    return {
      employeeId,
      teamId:
        source.teamId ??
        (store.teamId() || store.teamsInLocation()[0]?.id || store.teams()[0]?.id || ''),
      date: source.date ?? store.selectedDay(),
      start: source.start ?? '09:00',
      end: source.end ?? '17:00',
      breakMinutes: String(source.breakMinutes ?? 30),
      note: source.note ?? '',
    };
  }
}

function employeeName(e: Employee): string {
  return `${e.firstName} ${e.lastName}`;
}
