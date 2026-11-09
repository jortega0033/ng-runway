import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  ButtonComponent,
  DialogComponent,
  DialogService,
  DrawerComponent,
  DrawerService,
  IconButtonComponent,
  PopoverTriggerDirective,
  ToastComponent,
  ToastService,
  TooltipDirective,
  type DialogSize,
  type Toast,
  type ToastVariant,
} from '@ui/index';

@Component({
  selector: 'app-ds-demo-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogComponent, ButtonComponent],
  template: `
    <ui-dialog title="Swap shift">
      Maria van der Berg asked to swap her Tuesday early shift (06:00-14:00) with Tom Okafor. Both
      employees stay within their weekly hour limits.
      <ng-container uiDialogFooter>
        <button ui-button type="button" variant="secondary" (click)="ref.close()">Decline</button>
        <button ui-button type="button" (click)="ref.close()">Approve swap</button>
      </ng-container>
    </ui-dialog>
  `,
})
export class DemoDialogComponent {
  protected readonly ref = inject(DialogRef);
}

@Component({
  selector: 'app-ds-demo-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerComponent, ButtonComponent],
  template: `
    <ui-drawer title="Employee details">
      <p>Sven Lindqvist, Night team. Contract: 32 h per week, permanent.</p>
      <p class="mt-2">Next shift: Thursday 22:00-06:00, Warehouse B.</p>
      <ng-container uiDrawerFooter>
        <button ui-button type="button" variant="secondary" (click)="ref.close()">Close</button>
        <button ui-button type="button" (click)="ref.close()">Edit employee</button>
      </ng-container>
    </ui-drawer>
  `,
})
export class DemoDrawerComponent {
  protected readonly ref = inject(DialogRef);
}

const SIZES: readonly DialogSize[] = ['sm', 'md', 'lg'];
const VARIANTS: readonly ToastVariant[] = ['info', 'success', 'warning', 'danger'];

const STATIC_TOASTS: readonly Toast[] = [
  {
    id: -1,
    variant: 'info',
    title: 'Sync started',
    message: '12 employees are updating.',
    durationMs: 0,
  },
  {
    id: -2,
    variant: 'success',
    title: 'Roster published',
    message: 'Week 46 is live.',
    durationMs: 0,
  },
  {
    id: -3,
    variant: 'warning',
    title: 'Overtime limit',
    message: 'Anna Kowalski reaches 48 h.',
    durationMs: 0,
  },
  {
    id: -4,
    variant: 'danger',
    title: 'Save failed',
    message: 'Check your connection.',
    durationMs: 0,
  },
];

@Component({
  selector: 'app-ds-overlays',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    IconButtonComponent,
    PopoverTriggerDirective,
    ToastComponent,
    TooltipDirective,
  ],
  template: `
    <section class="space-y-10">
      <div class="space-y-3">
        <h2 class="font-title text-2xl">Dialog</h2>
        <p class="text-base text-foreground-subtle">
          Sizes, Escape and backdrop close, focus returns to the button that opened it.
        </p>
        <div class="flex flex-wrap gap-2">
          @for (size of sizes; track size) {
            <button ui-button type="button" variant="secondary" (click)="openDialog(size)">
              Open {{ size }}
            </button>
          }
          <button ui-button type="button" variant="secondary" (click)="confirm(false)">
            Confirm
          </button>
          <button ui-button type="button" variant="danger" (click)="confirm(true)">
            Confirm (danger)
          </button>
        </div>
        @if (answer() !== null) {
          <p class="text-base">Last answer: {{ answer() ? 'confirmed' : 'cancelled' }}</p>
        }
      </div>

      <div class="space-y-3">
        <h2 class="font-title text-2xl">Drawer</h2>
        <div class="flex flex-wrap gap-2">
          @for (size of sizes; track size) {
            <button ui-button type="button" variant="secondary" (click)="openDrawer(size)">
              Open {{ size }}
            </button>
          }
        </div>
      </div>

      <div class="space-y-3">
        <h2 class="font-title text-2xl">Popover</h2>
        <div class="flex flex-wrap items-start gap-2">
          <button ui-button type="button" variant="secondary" [uiPopoverTrigger]="filters">
            Filters
          </button>
          <button
            ui-button
            type="button"
            variant="secondary"
            [uiPopoverTrigger]="filters"
            uiPopoverPosition="bottom-end"
          >
            Aligned to the end
          </button>
          <button ui-button type="button" variant="secondary" disabled>Disabled trigger</button>
        </div>
        <ng-template #filters let-close="close">
          <div class="w-64 space-y-2 p-3 text-base">
            <p class="font-medium">Shift filters</p>
            <p class="text-foreground-subtle">Showing early, late and night shifts.</p>
            <div class="flex justify-end">
              <button ui-button type="button" size="sm" (click)="close()">Done</button>
            </div>
          </div>
        </ng-template>
      </div>

      <div class="space-y-3">
        <h2 class="font-title text-2xl">Tooltip</h2>
        <p class="text-base text-foreground-subtle">
          Hover, or Tab to the control. Escape dismisses it.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <button ui-button type="button" variant="secondary" uiTooltip="Copy the roster link">
            Top (default)
          </button>
          <button
            ui-button
            type="button"
            variant="secondary"
            uiTooltip="Opens the print preview"
            uiTooltipPosition="bottom"
          >
            Bottom
          </button>

          <button
            ui-icon-button
            type="button"
            icon="download"
            label="Export roster"
            uiTooltip="Export roster as CSV"
          ></button>

          <button
            ui-icon-button
            type="button"
            icon="trash"
            label="Delete shift"
            uiTooltip="Delete shift"
            [uiTooltipDelay]="0"
          ></button>
        </div>
      </div>

      <div class="space-y-3">
        <h2 class="font-title text-2xl">Toast</h2>
        <p class="text-base text-foreground-subtle">
          Buttons use ToastService and need a ui-toast-container in the app shell. The previews
          below are static.
        </p>
        <div class="flex flex-wrap gap-2">
          @for (variant of variants; track variant) {
            <button ui-button type="button" variant="secondary" (click)="toast(variant)">
              {{ variant }}
            </button>
          }
          <button ui-button type="button" variant="secondary" (click)="sticky()">
            Stays until dismissed
          </button>
        </div>
        <div class="grid max-w-md gap-2">
          @for (item of staticToasts; track item.id) {
            <ui-toast [toast]="item" (dismissed)="noop()" />
          }
        </div>
      </div>
    </section>
  `,
})
export class OverlaysSectionComponent {
  private readonly dialogs = inject(DialogService);
  private readonly drawers = inject(DrawerService);
  private readonly toasts = inject(ToastService);

  protected readonly sizes = SIZES;
  protected readonly variants = VARIANTS;
  protected readonly staticToasts = STATIC_TOASTS;
  protected readonly answer = signal<boolean | null>(null);

  protected openDialog(size: DialogSize): void {
    this.dialogs.open(DemoDialogComponent, { size });
  }

  protected openDrawer(size: DialogSize): void {
    this.drawers.open(DemoDrawerComponent, { size });
  }

  protected async confirm(danger: boolean): Promise<void> {
    this.answer.set(
      await this.dialogs.confirm({
        title: danger ? 'Delete shift?' : 'Publish roster?',
        message: danger
          ? 'The night shift on 12 November will be removed for 6 employees.'
          : 'Employees will be notified about week 46.',
        confirmLabel: danger ? 'Delete' : 'Publish',
        danger,
      }),
    );
  }

  protected toast(variant: ToastVariant): void {
    this.toasts.show({
      variant,
      title: `${variant[0].toUpperCase()}${variant.slice(1)} message`,
      message: 'Closes after 5 seconds. Hover to pause.',
    });
  }

  protected sticky(): void {
    this.toasts.show({ variant: 'danger', title: 'Connection lost', durationMs: 0 });
  }

  protected noop(): void {
    // Static previews cannot be dismissed.
  }
}
