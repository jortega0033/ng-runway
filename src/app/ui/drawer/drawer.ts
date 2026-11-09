import { DialogRef } from '@angular/cdk/dialog';
import type { ComponentType } from '@angular/cdk/portal';
import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  type TemplateRef,
  booleanAttribute,
  inject,
  input,
  output,
} from '@angular/core';
import { IconButtonComponent } from '../button/icon-button';
import { OVERLAY_TITLE_ID, type DialogSize } from '../dialog/dialog';
import { DialogService } from '../dialog/dialog-service';

export type DrawerSize = DialogSize;

let nextId = 0;

/**
 * Visual shell of a right-side panel: title, scrolling body, footer actions.
 * Open it through `DrawerService`; it shares the dialog mechanics (focus trap, Escape, backdrop).
 */
@Component({
  selector: 'ui-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent],
  host: {
    class:
      'flex h-full w-full flex-col border-l border-border-subtle bg-background-surface-page ' +
      'text-foreground shadow-xl',
  },
  template: `
    <header class="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
      <h2 [id]="titleId" class="font-title text-xl font-semibold">{{ title() }}</h2>
      @if (closable()) {
        <button
          ui-icon-button
          type="button"
          icon="x"
          size="sm"
          class="-mt-1 -mr-2"
          [label]="closeLabel()"
          (click)="close()"
        ></button>
      }
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-base text-foreground-subtle">
      <ng-content />
    </div>
    <footer class="hidden justify-end gap-2 border-t border-border-subtle px-5 py-3 has-[*]:flex">
      <ng-content select="[uiDrawerFooter]" />
    </footer>
  `,
})
export class DrawerComponent {
  private readonly ref = inject<DialogRef | null>(DialogRef, { optional: true });

  readonly title = input.required<string>();
  readonly closable = input(true, { transform: booleanAttribute });
  readonly closeLabel = input('Close');
  readonly closeRequested = output();

  protected readonly titleId =
    inject(OVERLAY_TITLE_ID, { optional: true }) ?? `ui-drawer-${nextId++}`;

  protected close(): void {
    this.closeRequested.emit();
    this.ref?.close();
  }
}

export interface DrawerConfig<D = unknown> {
  readonly size?: DrawerSize;
  readonly data?: D;
  readonly ariaLabel?: string;
  readonly disableClose?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DrawerService {
  private readonly dialogs = inject(DialogService);

  open<R = unknown, D = unknown, C = unknown>(
    content: ComponentType<C> | TemplateRef<C>,
    config: DrawerConfig<D> = {},
  ): DialogRef<R, C> {
    return this.dialogs.open<R, D, C>(content, { ...config, placement: 'end' });
  }
}
