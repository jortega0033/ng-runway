import { DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  booleanAttribute,
  inject,
  input,
  output,
} from '@angular/core';
import { IconButtonComponent } from '../button/icon-button';

export type DialogSize = 'sm' | 'md' | 'lg';

/** Id the `ui-dialog` / `ui-drawer` title must use so the CDK container is labelled by it. */
export const OVERLAY_TITLE_ID = new InjectionToken<string>('OVERLAY_TITLE_ID');

let nextId = 0;

/**
 * Visual shell of a modal: title, body and footer actions. Open it through `DialogService`
 * (the CDK container supplies role="dialog", the focus trap and Escape handling).
 *
 * ```html
 * <ui-dialog title="Delete shift">
 *   Body text
 *   <ng-container uiDialogFooter><button ui-button>Delete</button></ng-container>
 * </ui-dialog>
 * ```
 */
@Component({
  selector: 'ui-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent],
  host: {
    class:
      'flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-xl border border-border-subtle ' +
      'bg-background-surface-page text-foreground shadow-xl',
  },
  template: `
    <header class="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
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
    <div class="min-h-0 flex-1 overflow-y-auto px-5 pb-5 text-base text-foreground-subtle">
      <ng-content />
    </div>
    <footer class="hidden justify-end gap-2 border-t border-border-subtle px-5 py-3 has-[*]:flex">
      <ng-content select="[uiDialogFooter]" />
    </footer>
  `,
})
export class DialogComponent {
  private readonly ref = inject<DialogRef | null>(DialogRef, { optional: true });

  readonly title = input.required<string>();
  readonly closable = input(true, { transform: booleanAttribute });
  readonly closeLabel = input('Close');
  /** Emitted before the dialog closes itself from the close button. */
  readonly closeRequested = output();

  protected readonly titleId =
    inject(OVERLAY_TITLE_ID, { optional: true }) ?? `ui-dialog-${nextId++}`;

  protected close(): void {
    this.closeRequested.emit();
    this.ref?.close();
  }
}
