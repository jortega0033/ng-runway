import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injectable,
  type OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IconButtonComponent } from '../button/icon-button';
import { IconComponent, type IconName } from '../icon/icon';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface ToastOptions {
  readonly variant: ToastVariant;
  readonly title: string;
  readonly message?: string;
  /** Milliseconds before it closes itself. `0` keeps it until dismissed. Default 5000. */
  readonly durationMs?: number;
}

export interface Toast {
  readonly id: number;
  readonly variant: ToastVariant;
  readonly title: string;
  readonly message: string;
  readonly durationMs: number;
}

export const DEFAULT_TOAST_DURATION_MS = 5000;

/** Holds the visible toasts. Render them once with `<ui-toast-container />` in the app shell. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly list = signal<readonly Toast[]>([]);
  private nextId = 1;

  /** Oldest first, newest last. */
  readonly toasts = this.list.asReadonly();

  show(options: ToastOptions): number {
    const toast: Toast = {
      id: this.nextId++,
      variant: options.variant,
      title: options.title,
      message: options.message ?? '',
      durationMs: options.durationMs ?? DEFAULT_TOAST_DURATION_MS,
    };
    this.list.update((all) => [...all, toast]);
    return toast.id;
  }

  dismiss(id: number): void {
    this.list.update((all) => all.filter((t) => t.id !== id));
  }

  clear(): void {
    this.list.set([]);
  }
}

const ICONS: Record<ToastVariant, { name: IconName; color: string }> = {
  info: { name: 'info', color: 'text-foreground-brand' },
  success: { name: 'check-circle', color: 'text-foreground-success' },
  warning: { name: 'alert-triangle', color: 'text-foreground-warning' },
  danger: { name: 'alert-circle', color: 'text-foreground-danger' },
};

/**
 * One notification. Danger and warning interrupt (role alert), info and success are polite
 * (role status). The timer pauses while the pointer is over it or focus is inside it.
 * Its stack position comes from the `--index` custom property set by the container.
 */
@Component({
  selector: 'ui-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, IconButtonComponent],
  host: {
    '[attr.role]': 'urgent() ? "alert" : "status"',
    class:
      'pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-background-surface-page ' +
      'p-3 text-foreground shadow-lg transition-transform duration-200 animate-slide-fade ' +
      'motion-reduce:animate-none motion-reduce:transition-none',
    '[style.transform]': '"translate(var(--x, 0px), var(--y, 0px)) scale(var(--scale, 1))"',
    '(mouseenter)': 'setHover(true)',
    '(mouseleave)': 'setHover(false)',
    '(focusin)': 'setFocus(true)',
    '(focusout)': 'setFocus(false)',
  },
  template: `
    <ui-icon [class]="'mt-0.5 ' + icon().color" [name]="icon().name" />
    <div class="min-w-0 flex-1">
      <p class="text-base font-medium">{{ toast().title }}</p>
      @if (toast().message) {
        <p class="text-base text-foreground-subtle">{{ toast().message }}</p>
      }
    </div>

    <button
      ui-icon-button
      type="button"
      icon="x"
      size="sm"
      class="-mt-1 -mr-1"
      [label]="dismissLabel()"
      (click)="dismissed.emit()"
    ></button>
  `,
})
export class ToastComponent implements OnInit {
  readonly toast = input.required<Toast>();
  readonly dismissLabel = input('Dismiss notification');
  readonly dismissed = output();

  protected readonly urgent = computed(
    () => this.toast().variant === 'danger' || this.toast().variant === 'warning',
  );
  protected readonly icon = computed(() => ICONS[this.toast().variant]);

  private remaining = 0;
  private startedAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private hovered = false;
  private focused = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearTimer());
  }

  ngOnInit(): void {
    this.remaining = this.toast().durationMs;
    this.startTimer();
  }

  protected setHover(value: boolean): void {
    this.hovered = value;
    this.sync();
  }

  protected setFocus(value: boolean): void {
    this.focused = value;
    this.sync();
  }

  private sync(): void {
    if (this.hovered || this.focused) {
      if (this.timer === null) return;
      this.remaining = Math.max(0, this.remaining - (Date.now() - this.startedAt));
      this.clearTimer();
    } else {
      this.startTimer();
    }
  }

  private startTimer(): void {
    if (this.timer !== null || this.remaining <= 0) return;
    this.startedAt = Date.now();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.dismissed.emit();
    }, this.remaining);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

/** Fixed bottom-right stack. Newest toast in front; older ones peek out behind it. */
@Component({
  selector: 'ui-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastComponent],
  host: {
    role: 'region',
    '[attr.aria-label]': 'label()',
    class:
      'pointer-events-none fixed right-4 bottom-4 z-[1100] grid w-[min(24rem,calc(100vw-2rem))] ' +
      'items-end',
  },
  template: `
    @for (toast of toasts(); track toast.id; let i = $index; let count = $count) {
      <ui-toast
        class="col-start-1 row-start-1"
        [toast]="toast"
        [dismissLabel]="dismissLabel()"
        [style.--index]="count - i"
        [style.z-index]="i"
        [class.invisible]="count - i > 4"
        (dismissed)="service.dismiss(toast.id)"
      />
    }
  `,
})
export class ToastContainerComponent {
  protected readonly service = inject(ToastService);
  protected readonly toasts = this.service.toasts;

  readonly label = input('Notifications');
  readonly dismissLabel = input('Dismiss notification');
}
