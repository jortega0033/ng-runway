import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import type { Shift, ShiftInput, UserRole } from '@core/api/models';
import { HasRoleDirective } from '@core/auth/has-role.directive';
import {
  ButtonComponent,
  CardComponent,
  DialogService,
  DrawerService,
  EmptyStateComponent,
  FieldComponent,
  IconButtonComponent,
  IconComponent,
  PageHeaderComponent,
  SegmentedComponent,
  SelectComponent,
  SkeletonComponent,
  ToastService,
  type SelectOption,
} from '@ui/index';
import { ScheduleGridComponent } from '../components/schedule-grid';
import {
  ShiftEditorComponent,
  type ShiftEditorData,
  type ShiftEditorResult,
} from '../components/shift-editor';
import { formatRange, type ScheduleView } from '../schedule.layout';
import { ScheduleStore } from '../schedule.store';

const MANAGERS: readonly UserRole[] = ['admin', 'manager'];

/** The schedule: toolbar, grid and the shift editor. State lives in `ScheduleStore`. */
@Component({
  selector: 'app-schedule-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    FieldComponent,
    HasRoleDirective,
    IconButtonComponent,
    IconComponent,
    PageHeaderComponent,
    ScheduleGridComponent,
    SegmentedComponent,
    SelectComponent,
    SkeletonComponent,
    TranslocoPipe,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <ui-page-header
        [title]="'schedule.title' | transloco"
        [description]="
          (store.canEdit() ? 'schedule.description' : 'schedule.descriptionReadonly') | transloco
        "
      >
        <ng-container actions>
          <ng-container *hasRole="managers">
            <button
              ui-button
              type="button"
              variant="secondary"
              [loading]="store.copying()"
              (click)="copyPreviousWeek()"
            >
              <ui-icon name="copy" [size]="16" />
              {{ 'schedule.toolbar.copy' | transloco }}
            </button>
            <button
              ui-button
              type="button"
              [loading]="store.publishing()"
              [disabled]="store.draftCount() === 0"
              [attr.aria-label]="
                'schedule.toolbar.publishCount' | transloco: { count: store.draftCount() }
              "
              (click)="publishWeek()"
            >
              {{ 'schedule.toolbar.publish' | transloco }}
              <span
                aria-hidden="true"
                class="rounded-sm bg-background-surface-page px-1.5 text-sm text-foreground tabular-nums"
                >{{ store.draftCount() }}</span
              >
            </button>
          </ng-container>
        </ng-container>
      </ui-page-header>

      <div
        role="toolbar"
        class="flex flex-wrap items-end gap-x-4 gap-y-3"
        [attr.aria-label]="'schedule.toolbar.label' | transloco"
      >
        <ui-segmented
          [label]="'schedule.toolbar.view' | transloco"
          [options]="viewOptions()"
          [value]="store.view()"
          (valueChange)="setView($event)"
        />

        <div class="flex items-center gap-1">
          <button
            ui-icon-button
            type="button"
            icon="chevron-left"
            variant="secondary"
            [label]="
              (isDay() ? 'schedule.toolbar.previousDay' : 'schedule.toolbar.previousWeek')
                | transloco
            "
            (click)="store.previous()"
          ></button>
          <button ui-button type="button" variant="secondary" (click)="store.goToToday()">
            {{ 'schedule.toolbar.today' | transloco }}
          </button>
          <button
            ui-icon-button
            type="button"
            icon="chevron-right"
            variant="secondary"
            [label]="
              (isDay() ? 'schedule.toolbar.nextDay' : 'schedule.toolbar.nextWeek') | transloco
            "
            (click)="store.next()"
          ></button>
        </div>

        <p class="min-w-44 font-title text-xl font-semibold text-foreground" aria-live="polite">
          {{ rangeLabel() }}
        </p>

        <div class="ml-auto flex flex-wrap items-end gap-3">
          <ui-field [label]="'schedule.toolbar.location' | transloco">
            <ui-select
              [options]="locationOptions()"
              [value]="store.locationId()"
              (valueChange)="store.setLocation($event)"
            />
          </ui-field>
          <ui-field [label]="'schedule.toolbar.team' | transloco">
            <ui-select
              [options]="teamOptions()"
              [value]="store.teamId()"
              (valueChange)="store.setTeam($event)"
            />
          </ui-field>
          <ui-field *hasRole="managers" [label]="'schedule.toolbar.template' | transloco">
            <ui-select
              [options]="templateOptions()"
              [value]="store.activeTemplateId()"
              (valueChange)="store.setActiveTemplate($event)"
            />
          </ui-field>
        </div>
      </div>

      @if (store.error()) {
        <ui-card>
          <ui-empty-state
            icon="alert-circle"
            [title]="'schedule.state.errorTitle' | transloco"
            [message]="'schedule.state.errorMessage' | transloco"
          >
            <button empty-action ui-button type="button" (click)="store.retry()">
              {{ 'schedule.state.retry' | transloco }}
            </button>
          </ui-empty-state>
        </ui-card>
      } @else if (!store.lookupsLoaded()) {
        <div
          class="flex flex-col gap-2 rounded-lg border border-border-subtle p-3"
          role="status"
          aria-busy="true"
          [attr.aria-label]="'schedule.state.loading' | transloco"
        >
          @for (row of skeletonRows; track row) {
            <ui-skeleton class="h-12 w-full" />
          }
        </div>
      } @else {
        @if (store.isEmpty()) {
          <ui-card>
            <ui-empty-state
              icon="calendar"
              [title]="'schedule.state.emptyTitle' | transloco"
              [message]="
                (store.canEdit() ? 'schedule.state.emptyMessage' : 'schedule.state.emptyEmployee')
                  | transloco
              "
            >
              <ng-container empty-action>
                <ng-container *hasRole="managers">
                  <button ui-button type="button" (click)="addShift()">
                    {{ 'schedule.grid.addShift' | transloco }}
                  </button>
                </ng-container>
              </ng-container>
            </ui-empty-state>
          </ui-card>
        }
        @if (!store.isEmpty() || store.canEdit()) {
          <div
            [class.opacity-60]="store.loading()"
            [attr.aria-busy]="store.loading() ? 'true' : null"
          >
            <app-schedule-grid (editShift)="editShift($event)" (addShift)="addShift($event)" />
          </div>
        }

        <ul class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground-subtle">
          <li class="flex items-center gap-1.5">
            <span
              class="h-3 w-5 rounded-sm border border-dashed border-border-overlay-strong bg-background-muted"
              aria-hidden="true"
            ></span>
            {{ 'schedule.legend.draft' | transloco }}
          </li>
          <li class="flex items-center gap-1.5">
            <span
              class="h-3 w-5 rounded-sm border border-border bg-background-surface-page"
              aria-hidden="true"
            ></span>
            {{ 'schedule.legend.published' | transloco }}
          </li>
          <li class="flex items-center gap-1.5">
            <ui-icon name="alert-triangle" [size]="16" class="text-foreground-warning-strong" />
            {{ 'schedule.legend.conflict' | transloco }}
          </li>
        </ul>
      }

      <div class="sr-only" role="status" aria-live="polite">{{ store.announcement() }}</div>
    </div>
  `,
})
export class SchedulePage {
  protected readonly store = inject(ScheduleStore);
  private readonly transloco = inject(TranslocoService);
  private readonly drawers = inject(DrawerService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly managers = MANAGERS;
  protected readonly skeletonRows = [1, 2, 3, 4, 5, 6];
  protected readonly isDay = computed(() => this.store.view() === 'day');

  private readonly activeLang = toSignal(this.transloco.langChanges$, {
    initialValue: this.transloco.getActiveLang(),
  });
  // A new object arrives whenever the 'schedule' texts load, so reading it makes labels built in
  // code refresh once the texts exist instead of showing a raw key.
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('schedule'));
  private readonly lang = computed(() => {
    this.scopeLoaded();
    return this.activeLang();
  });

  protected readonly rangeLabel = computed(() => {
    const lang = this.lang();
    if (this.isDay()) return formatRange(this.store.selectedDay(), this.store.selectedDay(), lang);
    const { from, to } = this.store.weekRange();
    return formatRange(from, to, lang);
  });

  protected readonly viewOptions = computed<SelectOption[]>(() => {
    this.lang();
    return [
      { value: 'week', label: this.transloco.translate('schedule.toolbar.week') },
      { value: 'day', label: this.transloco.translate('schedule.toolbar.day') },
    ];
  });

  protected readonly locationOptions = computed<SelectOption[]>(() => {
    this.lang();
    return [
      { value: '', label: this.transloco.translate('schedule.toolbar.allLocations') },
      ...this.store.locations().map((l) => ({ value: l.id, label: l.name })),
    ];
  });

  protected readonly teamOptions = computed<SelectOption[]>(() => {
    this.lang();
    return [
      { value: '', label: this.transloco.translate('schedule.toolbar.allTeams') },
      ...this.store.teamsInLocation().map((t) => ({ value: t.id, label: t.name })),
    ];
  });

  protected readonly templateOptions = computed<SelectOption[]>(() => {
    this.lang();
    return [
      { value: '', label: this.transloco.translate('schedule.toolbar.noTemplate') },
      ...this.store
        .templates()
        .map((t) => ({ value: t.id, label: `${t.name} (${t.start}-${t.end})` })),
    ];
  });

  protected setView(view: string): void {
    this.store.setView(view as ScheduleView);
  }

  protected editShift(shift: Shift): void {
    void this.openEditor(shift);
  }

  protected addShift(defaults: Partial<ShiftInput> = {}): void {
    const template = this.store.templates().find((t) => t.id === this.store.activeTemplateId());
    void this.openEditor(null, {
      date: this.store.view() === 'day' ? this.store.selectedDay() : this.store.weekStart(),
      ...(template
        ? { start: template.start, end: template.end, breakMinutes: template.breakMinutes }
        : {}),
      ...defaults,
    });
  }

  private async openEditor(shift: Shift | null, defaults?: Partial<ShiftInput>): Promise<void> {
    const ref = this.drawers.open<ShiftEditorResult, ShiftEditorData, ShiftEditorComponent>(
      ShiftEditorComponent,
      { size: 'md', data: { store: this.store, shift, defaults } },
    );
    const result = await firstValueFrom(ref.closed, { defaultValue: undefined });
    if (!result) return;
    if (result.action === 'delete') {
      await this.store.deleteShift(result.id);
    } else if (result.id) {
      await this.store.updateShift(result.id, result.input, 'edit');
    } else {
      await this.store.createShift(result.input);
    }
  }

  protected async publishWeek(): Promise<void> {
    const count = this.store.draftCount();
    if (count === 0) return;
    const { from, to } = this.store.weekRange();
    const ok = await this.dialogs.confirm({
      title: this.transloco.translate('schedule.dialog.publishTitle'),
      message: this.transloco.translate('schedule.dialog.publishMessage', {
        count,
        range: formatRange(from, to, this.lang()),
      }),
      confirmLabel: this.transloco.translate('schedule.dialog.publishConfirm'),
      cancelLabel: this.transloco.translate('schedule.dialog.cancel'),
    });
    if (!ok) return;
    const published = await this.store.publishWeek();
    if (published !== null) {
      this.toasts.show({
        variant: 'success',
        title: this.transloco.translate('schedule.toast.publishedTitle'),
        message: this.transloco.translate('schedule.toast.publishedMessage', { count: published }),
      });
    }
  }

  protected async copyPreviousWeek(): Promise<void> {
    const { from, to } = this.store.weekRange();
    const existing = this.store.scopedShifts().length;
    const ok = await this.dialogs.confirm({
      title: this.transloco.translate('schedule.dialog.copyTitle'),
      message: this.transloco.translate(
        existing > 0 ? 'schedule.dialog.copyMessageExisting' : 'schedule.dialog.copyMessage',
        { range: formatRange(from, to, this.lang()), count: existing },
      ),
      confirmLabel: this.transloco.translate('schedule.dialog.copyConfirm'),
      cancelLabel: this.transloco.translate('schedule.dialog.cancel'),
    });
    if (!ok) return;
    const copied = await this.store.copyPreviousWeek();
    if (copied !== null) {
      this.toasts.show({
        variant: 'success',
        title: this.transloco.translate('schedule.toast.copiedTitle'),
        message: this.transloco.translate('schedule.toast.copiedMessage', { count: copied }),
      });
    }
  }
}
