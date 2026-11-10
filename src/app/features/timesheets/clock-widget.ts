import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { finalize, map, tap, type Observable } from 'rxjs';
import { ClockApi } from '@core/api/clock.api';
import type { ClockEntry } from '@core/api/models';
import { formatDuration } from '@core/domain/hours';
import { AuthService } from '@core/auth/auth.service';
import {
  ButtonComponent,
  CardComponent,
  SkeletonComponent,
  ToastService,
  AlertComponent,
} from '@ui/index';
import { formatTime } from './timesheet-format';
import {
  clockStatus,
  formatClock,
  runningBreakSeconds,
  workedSeconds,
  type ClockStatus,
} from './timesheet-math';

type ClockAction = 'in' | 'out' | 'start-break' | 'end-break';

/**
 * Clock in, break and clock out for the signed-in employee. The counter shows time worked
 * (breaks excluded), so it stands still while a break runs; the break has its own counter.
 */
@Component({
  selector: 'app-clock-widget',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonComponent, CardComponent, SkeletonComponent, TranslocoPipe],
  template: `
    <ui-card>
      <section
        class="flex flex-wrap items-center justify-between gap-x-8 gap-y-4"
        [attr.aria-label]="'timesheets.clock.title' | transloco"
      >
        <div class="min-w-0">
          <h2 class="font-title text-lg font-semibold">
            {{ 'timesheets.clock.title' | transloco }}
          </h2>
          @if (current.isLoading()) {
            <ui-skeleton class="mt-2 h-5 w-48" />
          } @else if (current.error()) {
            <ui-alert variant="danger" class="mt-2">
              {{ 'timesheets.clock.loadError' | transloco }}
              <button
                ui-button
                type="button"
                size="sm"
                variant="secondary"
                class="ml-2"
                (click)="current.reload()"
              >
                {{ 'common.retry' | transloco }}
              </button>
            </ui-alert>
          } @else {
            <p role="status" class="mt-1 text-base text-foreground-subtle">{{ statusText() }}</p>
          }
        </div>

        <div class="flex flex-col">
          <span class="text-sm text-foreground-subtle" id="clock-worked-label">
            {{ 'timesheets.clock.worked' | transloco }}
          </span>
          <span
            role="timer"
            aria-labelledby="clock-worked-label"
            class="font-title text-4xl font-semibold tabular-nums"
            >{{ workedLabel() }}</span
          >
          @if (status() === 'break') {
            <span class="text-base text-foreground-subtle tabular-nums">
              {{ 'timesheets.clock.breakRunning' | transloco: { time: breakLabel() } }}
            </span>
          }
        </div>

        <div
          #actions
          class="flex flex-wrap gap-2"
          role="group"
          [attr.aria-label]="'timesheets.clock.actions' | transloco"
        >
          <button
            ui-button
            type="button"
            [disabled]="isDisabled('in')"
            [loading]="pending() === 'in'"
            (click)="run('in')"
          >
            {{ 'timesheets.clock.in' | transloco }}
          </button>
          <button
            ui-button
            type="button"
            variant="secondary"
            [disabled]="isDisabled('start-break')"
            [loading]="pending() === 'start-break'"
            (click)="run('start-break')"
          >
            {{ 'timesheets.clock.startBreak' | transloco }}
          </button>
          <button
            ui-button
            type="button"
            variant="secondary"
            [disabled]="isDisabled('end-break')"
            [loading]="pending() === 'end-break'"
            (click)="run('end-break')"
          >
            {{ 'timesheets.clock.endBreak' | transloco }}
          </button>
          <button
            ui-button
            type="button"
            variant="danger"
            [disabled]="isDisabled('out')"
            [loading]="pending() === 'out'"
            (click)="run('out')"
          >
            {{ 'timesheets.clock.out' | transloco }}
          </button>
        </div>
      </section>
    </ui-card>
  `,
})
export class ClockWidgetComponent {
  private readonly api = inject(ClockApi);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);
  private readonly actions = viewChild<ElementRef<HTMLElement>>('actions');

  /** Emitted after every successful clock action, so the week view can reload. */
  readonly changed = output();

  /** The employee's running entry, `null` when not clocked in. */
  protected readonly entry = signal<ClockEntry | null>(null);
  protected readonly pending = signal<ClockAction | null>(null);
  private readonly now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  protected readonly current = rxResource({
    params: () => this.auth.user()?.id,
    stream: ({ params }) =>
      this.api.entries({ employeeId: params, status: 'open' }).pipe(
        map((entries) => entries.find((e) => e.clockOut === null) ?? null),
        // Set the entry as a side effect of loading so retry and reload share one path.
        tap((open) => this.setEntry(open)),
      ),
  });

  protected readonly status = computed<ClockStatus>(() => clockStatus(this.entry()));
  protected readonly workedLabel = computed(() => {
    const entry = this.entry();
    return formatClock(entry ? workedSeconds(entry, this.now()) : 0);
  });
  protected readonly breakLabel = computed(() => {
    const entry = this.entry();
    return formatClock(entry ? runningBreakSeconds(entry, this.now()) : 0);
  });
  /** Emits when the scope file is loaded and on every language change, so the status stays current. */
  private readonly scopeLoaded = toSignal(this.transloco.selectTranslation('timesheets'));

  protected readonly statusText = computed(() => {
    this.scopeLoaded();
    const entry = this.entry();
    switch (this.status()) {
      case 'working':
        return this.transloco.translate('timesheets.clock.workingSince', {
          time: formatTime(entry?.clockIn ?? null),
        });
      case 'break': {
        const running = entry?.breaks.find((b) => b.end === null);
        return this.transloco.translate('timesheets.clock.onBreakSince', {
          time: formatTime(running?.start ?? null),
        });
      }
      default:
        return this.transloco.translate('timesheets.clock.notClockedIn');
    }
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  /**
   * The running action keeps its button enabled (it shows a spinner through `loading`), so keyboard
   * focus stays on it; the other buttons are blocked until the request is done.
   */
  protected isDisabled(action: ClockAction): boolean {
    if (this.current.isLoading() || this.current.error()) return true;
    if (this.pending() !== null && this.pending() !== action) return true;
    return !this.allowed(action);
  }

  protected canRun(action: ClockAction): boolean {
    return this.pending() === null && !this.current.isLoading() && !this.current.error()
      ? this.allowed(action)
      : false;
  }

  private allowed(action: ClockAction): boolean {
    const status = this.status();
    switch (action) {
      case 'in':
        return status === 'out';
      case 'out':
        return status !== 'out';
      case 'start-break':
        return status === 'working';
      case 'end-break':
        return status === 'break';
    }
  }

  protected run(action: ClockAction): void {
    if (!this.canRun(action)) return;
    this.pending.set(action);
    this.request(action)
      .pipe(finalize(() => this.pending.set(null)))
      .subscribe({
        next: (entry) => {
          const group = this.actions()?.nativeElement;
          const active = document.activeElement;
          const hadFocus = !!group && (group.contains(active) || active === document.body);
          this.setEntry(entry.clockOut === null ? entry : null);
          // The button that was just used is disabled now; hand focus to the next action.
          if (hadFocus) afterNextRender(() => this.focusNextAction(), { injector: this.injector });
          this.announce(action, entry);
          this.changed.emit();
        },
        // The error toast comes from the interceptor. Reload so the buttons match the server.
        error: () => this.current.reload(),
      });
  }

  private focusNextAction(): void {
    this.actions()
      ?.nativeElement.querySelector<HTMLButtonElement>('button:not([disabled])')
      ?.focus();
  }

  private request(action: ClockAction): Observable<ClockEntry> {
    switch (action) {
      case 'in':
        return this.api.clockIn();
      case 'out':
        return this.api.clockOut();
      case 'start-break':
        return this.api.startBreak();
      case 'end-break':
        return this.api.endBreak();
    }
  }

  private announce(action: ClockAction, entry: ClockEntry): void {
    if (action === 'in') {
      this.toasts.show({
        variant: 'success',
        title: this.transloco.translate('timesheets.clock.clockedInTitle'),
        message: this.transloco.translate('timesheets.clock.clockedInText', {
          time: formatTime(entry.clockIn),
        }),
      });
    } else if (action === 'out') {
      this.toasts.show({
        variant: 'success',
        title: this.transloco.translate('timesheets.clock.clockedOutTitle'),
        message: this.transloco.translate('timesheets.clock.clockedOutText', {
          duration: formatDuration(Math.floor(workedSeconds(entry, this.now()) / 60)),
        }),
      });
    }
  }

  /** Stores the entry and runs the one-second timer only while an entry is open. */
  private setEntry(entry: ClockEntry | null): void {
    this.entry.set(entry);
    this.now.set(Date.now());
    if (entry) {
      this.timer ??= setInterval(() => this.now.set(Date.now()), 1000);
    } else {
      this.stopTimer();
    }
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
